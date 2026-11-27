using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Pickup;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Services;

internal static class FacilityIdentity
{
    internal record Candidate(string Name, string Address = null, string City = null, string Region = null,
        string PostalCode = null, string Country = null, string AlternateName = null, string Website = null,
        string SourceKey = null, double? Latitude = null, double? Longitude = null, bool Approximate = true)
    {
        internal static Candidate From(PickupVenue venue, FacilityProfile profile = null) =>
            new(venue.Name, venue.Address, venue.City, venue.Region, venue.PostalCode, venue.Country, profile?.AlternateName,
                profile?.Website, profile?.SourceKey, venue.Latitude, venue.Longitude, profile?.ApproximateCoordinates != false);
    }

    internal record Match(PickupVenue Venue, bool Definitive, string Reason);
    internal record Option(int Id, string Name, string Address, string City, string Region, string PostalCode,
        string Country, string TimeZone, bool Definitive, string Reason, bool CanViewDirectory);
    internal record Conflict(string Code, string Message, Option[] Matches, bool CanReviewDistinct);

    internal static Task Lock(DataContext db) => db.Database.ExecuteSqlRawAsync(
        "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='LeagueHub:FacilityIdentity', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000, 'Facility review is busy. Try again.', 1;");

    internal static async Task<List<Match>> Find(DataContext db, Candidate input, int? exclude = null, bool includeWeakNames = false)
    {
        if (string.IsNullOrWhiteSpace(input.Name) && string.IsNullOrWhiteSpace(input.Address) &&
            string.IsNullOrWhiteSpace(input.SourceKey) && string.IsNullOrWhiteSpace(input.Website)) return [];
        var venues = await db.PickupVenues.AsNoTracking().Where(v => v.Id != exclude).ToListAsync();
        var profiles = await db.FacilityProfiles.AsNoTracking().ToDictionaryAsync(p => p.VenueId);
        var providers = await db.FacilityProviderIdentities.AsNoTracking()
            .Where(p => p.SourceKey == ProviderKey(input.SourceKey)).Select(p => p.VenueId).ToListAsync();
        var aliases = (await db.FacilityMerges.AsNoTracking()
            .Select(m => new { m.TargetVenueId, m.SourceName, m.SourceAlternateName }).ToListAsync()).ToLookup(m => m.TargetVenueId);
        return venues.Select(v => {
            var current = Candidate.From(v, profiles.GetValueOrDefault(v.Id));
            if (providers.Contains(v.Id) || (!string.IsNullOrWhiteSpace(input.SourceKey) &&
                ProviderKey(current.SourceKey) == ProviderKey(input.SourceKey)))
                return new Match(v, true, "Same provider record");
            var comparison = Compare(input, current, aliases[v.Id].SelectMany(a => new[] { a.SourceName, a.SourceAlternateName }),
                includeWeakNames);
            return comparison == null ? null : new Match(v, comparison.Value.Definitive, comparison.Value.Reason);
        }).Where(m => m != null).OrderByDescending(m => m.Definitive).ThenBy(m => m.Venue.Name)
            .ThenBy(m => m.Venue.Id).ToList();
    }

    internal static async Task<Conflict> Describe(DataContext db, List<Match> matches, bool admin, int? account, bool preview)
    {
        var ids = matches.Select(m => m.Venue.Id).ToArray();
        var directory = (await Controllers.FacilitiesController.Directory(db).Where(v => ids.Contains(v.Id))
            .Select(v => v.Id).ToListAsync()).ToHashSet();
        List<int> own = admin || !account.HasValue ? [] : await db.PickupSessions
            .Where(s => ids.Contains(s.VenueId) && (s.OrganizerId == account ||
                (s.Visibility == SessionVisibility.Public && s.State != SessionState.Draft && s.State != SessionState.Cancelled)))
            .Select(s => s.VenueId).Distinct().ToListAsync();
        var visible = matches.Where(m => admin || directory.Contains(m.Venue.Id) || own.Contains(m.Venue.Id)).ToArray();
        return new Conflict("facility-match", (!preview && visible.Length == 0)
            ? "A facility needs administrator review before it can be saved."
            : "Review possible matches before saving a new facility.",
            visible.Take(12).Select(m => new Option(m.Venue.Id, m.Venue.Name, m.Venue.Address,
                m.Venue.City, m.Venue.Region, m.Venue.PostalCode, m.Venue.Country, m.Venue.TimeZone,
                m.Definitive, m.Reason, admin || directory.Contains(m.Venue.Id))).ToArray(),
            admin && matches.Count != 0 && matches.All(m => !m.Definitive));
    }

    internal static string ProviderKey(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();

    internal static string Key(Candidate value)
    {
        var street = Street(value.Address);
        var locality = Postal(value.PostalCode);
        if (locality.Length == 0 && Tokens(value.City).Length > 0 && PickupLocations.StateCode(value.Region).Length > 0)
            locality = Tokens(value.City) + "|" + PickupLocations.StateCode(value.Region);
        var name = CompactName(value.Name);
        if (!street.Any(char.IsDigit) || locality.Length == 0 || name.Length == 0) return null;
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            string.Join("|", Country(value.Country), locality, street, name))));
    }

    internal static (bool Definitive, string Reason)? Compare(Candidate a, Candidate b,
        IEnumerable<string> aliases = null, bool includeWeakNames = false)
    {
        if (Country(a.Country) != Country(b.Country)) return null;
        var streetA = Street(a.Address);
        var streetB = Street(b.Address);
        var zipA = Postal(a.PostalCode);
        var zipB = Postal(b.PostalCode);
        var placeA = Locality(a);
        var placeB = Locality(b);
        var stateA = placeA.State;
        var stateB = placeB.State;
        var zipMatch = zipA.Length > 0 && zipA == zipB;
        var cityMatch = placeA.City.Length > 0 && placeA.City == placeB.City &&
            (stateA == stateB || stateA.Length == 0 || stateB.Length == 0);
        var samePlace = zipMatch || cityMatch;
        var sameStreet = streetA.Length != 0 && streetA == streetB;
        if (streetA.Length != 0 && streetB.Length != 0 && !sameStreet) return null;
        var nameA = Names([a.Name, a.AlternateName]);
        var nameB = Names(new[] { b.Name, b.AlternateName }.Concat(aliases ?? []));
        var canonicalNamesMatch = nameA.Overlaps(nameB);
        var exactName = CompactName(a.Name) is { Length: > 0 } canonical && canonical == CompactName(b.Name);
        var qualifiedLocality = zipMatch || (cityMatch && stateA.Length != 0 && stateA == stateB);
        if (exactName && sameStreet && qualifiedLocality && streetA.Any(char.IsDigit)) return (true, "Same normalized name and address");
        if (sameStreet && qualifiedLocality && streetA.Any(char.IsDigit) &&
            Names(new[] { b.AlternateName }.Concat(aliases ?? [])).Contains(CompactName(a.Name)))
            return (true, "Known business alias and matching address");
        if (canonicalNamesMatch && sameStreet && samePlace) return (false, "Matching business name or alias and address");
        if (sameStreet && samePlace) return (false, "Same address; businesses may share a building");
        var site = Website(a.Website);
        if (samePlace && site != null && site == Website(b.Website)) return (false, "Same website and locality");
        if (canonicalNamesMatch && samePlace) return (false, "Matching business name or alias in this locality");
        if (samePlace && (Abbreviation(nameA, nameB) || Abbreviation(nameB, nameA)))
            return (false, "Possible abbreviated business name in this locality");
        if (Nearby(a, b)) return (false, "Verified location nearby; review the business identity");
        if (includeWeakNames && canonicalNamesMatch && (zipA.Length == 0 || zipB.Length == 0 || zipMatch))
            return (false, "Matching name with incomplete location");
        return null;
    }

    private static bool Nearby(Candidate a, Candidate b) => !a.Approximate && !b.Approximate &&
        PickupLocations.ValidPoint(a.Latitude, a.Longitude) && PickupLocations.ValidPoint(b.Latitude, b.Longitude) &&
        PickupLocations.Distance(new(a.Latitude.Value, a.Longitude.Value), new(b.Latitude.Value, b.Longitude.Value)) <= .04;
    private static string Tokens(string value) => string.Join(" ", Regex.Matches(
        Regex.Replace((value ?? "").Normalize(NormalizationForm.FormD), @"\p{Mn}", "").ToUpperInvariant(),
        @"[\p{L}\p{Nd}]+").Select(m => m.Value));
    private static string Name(string value) => Regex.Replace(
        Regex.Replace(Tokens(value), "^THE ", ""), @" (LLC|INC|LTD|CORP)$", "");
    private static string CompactName(string value) => Name(value).Replace(" ", "");
    private static HashSet<string> Names(IEnumerable<string> input) => input.Where(s => !string.IsNullOrWhiteSpace(s))
        .SelectMany(s => new[] { s, s.Split('&', 2)[0] })
        .SelectMany(s => new[] { Name(s), CompactName(s) }).Where(s => s.Length > 0).ToHashSet();
    private static bool Abbreviation(HashSet<string> names, HashSet<string> other) =>
        names.Any(name => name.Length is >= 3 and <= 6 && !name.Contains(' ') &&
            other.Any(value => string.Concat(value.Split(' ').Select(part => part[0])) == name));
    private static string Street(string value) => string.Join(" ", Tokens(value).Split(' ').Select(part => part switch {
        "AVENUE" => "AVE", "STREET" => "ST", "ROAD" => "RD", "BOULEVARD" => "BLVD",
        "DRIVE" => "DR", "LANE" => "LN", "COURT" => "CT", "HIGHWAY" => "HWY",
        "SUITE" => "STE",
        "NORTH" => "N", "SOUTH" => "S", "EAST" => "E", "WEST" => "W", _ => part
    }));
    private static string Country(string value) => Tokens(value) switch
    { "" or "US" or "USA" or "UNITED STATES" or "UNITED STATES OF AMERICA" => "US", "CAN" or "CANADA" => "CA", var country => country };
    private static (string City, string State) Locality(Candidate value)
    {
        var parts = (value.City ?? "").Split(',', 2, StringSplitOptions.TrimEntries);
        var region = string.IsNullOrWhiteSpace(value.Region) && parts.Length == 2 ? parts[1] : value.Region;
        var place = PickupLocations.Display(parts[0], region, value.PostalCode, value.Country);
        return (Tokens(place.City), PickupLocations.StateCode(place.Region));
    }
    private static string Postal(string value)
    {
        var postal = Tokens(value);
        return Regex.IsMatch(postal, @"^\d{5} \d{4}$") ? postal[..5] : postal;
    }
    private static string Website(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme is "http" or "https") ? Regex.Replace(uri.IdnHost.ToLowerInvariant(), "^www\\.", "") +
        uri.AbsolutePath.TrimEnd('/').ToLowerInvariant() : null;
}

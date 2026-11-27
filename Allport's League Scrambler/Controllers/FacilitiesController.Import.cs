using System;
using System.Data;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Pickup;
using Allport_s_League_Scrambler.Security;
using Allport_s_League_Scrambler.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Allport_s_League_Scrambler.Controllers;

public sealed partial class FacilitiesController
{
    [Authorize(Roles = "Admin"), EnableRateLimiting("facility-lookup"), HttpGet("lookup")]
    public async Task<IActionResult> Lookup([FromServices] IConfiguration configuration, [FromServices] IHttpClientFactory clients,
        string location, string q, string sport, int radius = 10, double? latitude = null, double? longitude = null,
        CancellationToken cancellation = default)
    {
        if (!Uri.TryCreate(configuration["FacilityLookup:OverpassEndpoint"], UriKind.Absolute, out var endpoint) ||
            endpoint.Scheme != Uri.UriSchemeHttps || endpoint.UserInfo.Length != 0)
            return StatusCode(503, new { message = "An approved OpenStreetMap Overpass endpoint has not been configured." });
        if (radius is not (5 or 10 or 25) || location?.Length > 100 || q?.Length > 100 || sport?.Length > 40 ||
            ((latitude != null || longitude != null) && !PickupLocations.ValidPoint(latitude, longitude)))
            return BadRequest(new { message = "Check the name, location, and search radius." });
        var point = latitude.HasValue ? new PickupLocations.Point(latitude.Value, longitude.Value) : null;
        var search = PickupLocations.Resolve(location, point);
        if (search.Centers.Count != 1)
            return BadRequest(new { message = "Enter a ZIP code or an unambiguous city and state." });
        var center = search.Centers[0];
        var around = FormattableString.Invariant($"(around:{radius * 1609},{center.Latitude},{center.Longitude})");
        var query = "[out:json][timeout:10];(nwr" + around + "[\"leisure\"~\"^(sports_centre|pitch|sports_hall|stadium|swimming_pool)$\"][\"name\"];"
            + "nwr" + around + "[\"sport\"][\"name\"];);out center 100;";
        using var client = clients.CreateClient("facility-overpass");
        client.DefaultRequestHeaders.UserAgent.ParseAdd("AllportsLeagueHub-FacilityReview/1.0");
        try
        {
            using var content = new FormUrlEncodedContent(new[] { new System.Collections.Generic.KeyValuePair<string, string>("data", query) });
            using var response = await client.PostAsync(endpoint, content, cancellation);
            if (!response.IsSuccessStatusCode) return StatusCode(502, new { message = "The approved facility source did not respond." });
            using var data = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
            if (!data.RootElement.TryGetProperty("elements", out var elements) || elements.ValueKind != JsonValueKind.Array)
                return StatusCode(502, new { message = "The approved facility source returned an unexpected result." });
            var found = elements.EnumerateArray().Select(ReadCandidate).Where(candidate => candidate != null &&
                (string.IsNullOrWhiteSpace(q) || candidate.Name.Contains(q.Trim(), StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrWhiteSpace(sport) || candidate.Activities.Any(activity =>
                    activity.Contains(sport.Trim(), StringComparison.OrdinalIgnoreCase))))
                .OrderBy(candidate => candidate.Name).Take(30).ToArray();
            return Ok(found);
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or TaskCanceledException)
        { return StatusCode(502, new { message = "The approved facility source is temporarily unavailable." }); }
    }

    private record Candidate(string SourceKey, string Source, string Name, string Address, string City,
        string Region, string PostalCode, string Website, string[] Activities, double? Latitude, double? Longitude);

    private static Candidate ReadCandidate(JsonElement row)
    {
        if (!row.TryGetProperty("tags", out var tags) || tags.ValueKind != JsonValueKind.Object ||
            !row.TryGetProperty("id", out var identifier) || !identifier.TryGetInt64(out var id)) return null;
        var type = Text(row, "type");
        var name = Text(tags, "name");
        if (type is not ("node" or "way" or "relation") || string.IsNullOrWhiteSpace(name)) return null;
        var point = row.TryGetProperty("center", out var group) ? group : row;
        return new Candidate($"osm:{type}:{id}", "OpenStreetMap contributors (ODbL)", name,
            string.Join(" ", new[] { Text(tags, "addr:housenumber"), Text(tags, "addr:street") }.Where(value => value?.Length > 0)),
            Text(tags, "addr:city"), Text(tags, "addr:state"), Text(tags, "addr:postcode"),
            Text(tags, "website") ?? Text(tags, "contact:website"),
            Text(tags, "sport")?.Replace('_', ' ').Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [],
            Number(point, "lat"), Number(point, "lon"));
    }

    private static string Text(JsonElement value, string key) =>
        value.TryGetProperty(key, out var property) && property.ValueKind == JsonValueKind.String ? property.GetString() : null;

    private static double? Number(JsonElement value, string key) =>
        value.TryGetProperty(key, out var property) && property.ValueKind == JsonValueKind.Number && property.TryGetDouble(out var number) ? number : null;

    public record ReviewedFacility(string Name, string AlternateName, string Address, string City, string Region,
        string PostalCode, string Country, string TimeZone, string Website, string Activities, string Source,
        string SourceKey, double? Latitude, double? Longitude, bool ApproximateCoordinates, bool Reviewed,
        bool DistinctReviewed = false);

    [Authorize(Roles = "Admin"), SameOrigin, HttpPost("reviewed"), HttpPut("reviewed/{id:int}")]
    public Task<IActionResult> SaveReviewed(ReviewedFacility input, int? id = null) => SaveFacility(input, id, false);

    [Authorize(Roles = "Admin"), SameOrigin, HttpPost("reviewed/{id:int}/fill-missing")]
    public Task<IActionResult> FillMissing(ReviewedFacility input, int id) => SaveFacility(input, id, true);

    private async Task<IActionResult> SaveFacility(ReviewedFacility input, int? id, bool fillMissing)
    {
        bool Invalid(string value, int limit, bool required = false) =>
            (required && string.IsNullOrWhiteSpace(value)) || value?.Length > limit;
        var sourceKey = FacilityIdentity.ProviderKey(input.SourceKey);
        if (!input.Reviewed || Invalid(input.Name, 100, true) || Invalid(input.Address, 140) ||
            Invalid(input.City, 80, true) || Invalid(input.Region, 50, true) || Invalid(input.PostalCode, 16) ||
            Invalid(input.Country, 50, true) || Invalid(input.AlternateName, 150) || Invalid(input.Activities, 250) ||
            Invalid(input.TimeZone, 80, true) || !TimeZoneInfo.TryFindSystemTimeZoneById(input.TimeZone, out _) ||
            Invalid(input.Source, 500, true) || Invalid(sourceKey, 150) || Invalid(input.Website, 500) ||
            (!string.IsNullOrWhiteSpace(input.Website) && (!Uri.TryCreate(input.Website, UriKind.Absolute, out var link) ||
                link.Scheme is not ("http" or "https") || link.UserInfo.Length != 0)) ||
            ((input.Latitude != null || input.Longitude != null) && !PickupLocations.ValidPoint(input.Latitude, input.Longitude)))
            return BadRequest(new { message = "Review the source and provide valid facility details, website, and time zone." });
        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        await FacilityIdentity.Lock(db);
        PickupVenue venue = null;
        if (id is int target)
        {
            venue = await db.PickupVenues.FindAsync(target);
            if (venue == null) return NotFound();
        }
        var candidate = new FacilityIdentity.Candidate(input.Name, input.Address, input.City, input.Region, input.PostalCode,
            input.Country, input.AlternateName, input.Website, sourceKey, input.Latitude, input.Longitude, input.ApproximateCoordinates);
        if (fillMissing && !(await FacilityIdentity.Find(db, candidate)).Any(match => match.Venue.Id == id))
            return BadRequest(new { message = "Select a matching facility before adding reviewed details." });
        var matches = await FacilityIdentity.Find(db, candidate, id);
        if (matches.Count != 0 && (!input.DistinctReviewed || matches.Any(match => match.Definitive)))
            return Conflict(await FacilityIdentity.Describe(db, matches, true, null, false));
        if (venue == null)
        {
            venue = new PickupVenue();
            db.PickupVenues.Add(venue);
        }
        string Update(string existing, string incoming) => fillMissing && !string.IsNullOrWhiteSpace(existing)
            ? existing : incoming?.Trim();
        venue.Name = Update(venue.Name, input.Name);
        venue.Address = Update(venue.Address, input.Address) ?? "";
        venue.City = Update(venue.City, input.City);
        venue.Region = Update(venue.Region, input.Region);
        venue.PostalCode = Update(venue.PostalCode, input.PostalCode) ?? "";
        venue.Country = Update(venue.Country, input.Country);
        venue.TimeZone = Update(venue.TimeZone, input.TimeZone);
        var replacePoint = !fillMissing || !PickupLocations.ValidPoint(venue.Latitude, venue.Longitude);
        if (replacePoint)
        {
            venue.Latitude = input.Latitude;
            venue.Longitude = input.Longitude;
        }
        venue.IdentityKey = FacilityIdentity.Key(FacilityIdentity.Candidate.From(venue));
        var profile = venue.Id > 0 ? await db.FacilityProfiles.FindAsync(venue.Id) : null;
        if (profile == null)
        {
            profile = new FacilityProfile { Venue = venue };
            db.FacilityProfiles.Add(profile);
        }
        profile.AlternateName = Update(profile.AlternateName,
            input.AlternateName ?? (fillMissing && venue.Name != input.Name.Trim() ? input.Name : null));
        profile.Website = Update(profile.Website, input.Website);
        profile.Activities = Update(profile.Activities, input.Activities);
        profile.Source = Update(profile.Source, input.Source);
        profile.SourceKey ??= sourceKey;
        if (replacePoint) profile.ApproximateCoordinates = input.ApproximateCoordinates;
        profile.VerifiedUtc = DateTimeOffset.UtcNow;
        try
        {
            await db.SaveChangesAsync();
            if (sourceKey != null && !await db.FacilityProviderIdentities.AnyAsync(row => row.SourceKey == sourceKey))
            {
                db.FacilityProviderIdentities.Add(new FacilityProviderIdentity { SourceKey = sourceKey, VenueId = venue.Id });
                await db.SaveChangesAsync();
            }
            await transaction.CommitAsync();
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync();
            await using var read = new DataContext();
            var currentMatches = await FacilityIdentity.Find(read, FacilityIdentity.Candidate.From(venue, profile), id);
            if (currentMatches.Count > 0)
                return Conflict(await FacilityIdentity.Describe(read, currentMatches, true, null, false));
            return Conflict(new { message = "The facility changed during review. Reload and check for an existing record." });
        }
        return Ok(new { venue.Id });
    }

}

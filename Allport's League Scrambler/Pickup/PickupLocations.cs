using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.RegularExpressions;

namespace Allport_s_League_Scrambler.Pickup;

internal static class PickupLocations
{
    internal record Point(double Latitude, double Longitude);
    internal record Locality(string City, string State);
    private record PostalRow(string Zip, Locality Locality, string CityName, string StateName, Point Point);
    internal record Search(string Text, IReadOnlySet<Locality> Localities, IReadOnlyList<Point> Centers, string[] Choices,
        bool Known, string State);
    internal record Match(double? Miles, bool Approximate, bool MissingState);

    private static readonly Lazy<PostalRow[]> Rows = new(Load);
    private static readonly Lazy<ILookup<string, PostalRow>> Zip = new(() => Rows.Value.ToLookup(r => r.Zip));
    private static readonly Lazy<ILookup<string, PostalRow>> Cities = new(() => Rows.Value.ToLookup(r => r.Locality.City));
    private static readonly Lazy<Dictionary<string, string>> States = new(() =>
        Rows.Value.GroupBy(r => Normalize(r.StateName)).ToDictionary(g => g.Key, g => g.First().Locality.State));

    private static PostalRow[] Load()
    {
        using var resource = typeof(PickupLocations).Assembly.GetManifestResourceStream("Pickup.us-postal-localities")
            ?? throw new InvalidOperationException("The Pickup US postal locality index is missing.");
        using var gzip = new GZipStream(resource, CompressionMode.Decompress);
        using var reader = new StreamReader(gzip);
        var rows = new List<PostalRow>();
        while (reader.ReadLine() is { } line)
        {
            var fields = line.Split('\t');
            rows.Add(new PostalRow(fields[0], new Locality(Normalize(fields[1]), Normalize(fields[3])), fields[1], fields[2],
                new Point(double.Parse(fields[4], CultureInfo.InvariantCulture), double.Parse(fields[5], CultureInfo.InvariantCulture))));
        }
        return rows.ToArray();
    }

    internal static Search Resolve(string raw, Point device)
    {
        var parts = (raw ?? "").Split(',', 2, StringSplitOptions.TrimEntries);
        var text = Normalize(parts[0]);
        if (device != null)
        {
            var nearest = Rows.Value.MinBy(row => Distance(device, row.Point));
            var localities = nearest != null && Distance(device, nearest.Point) <= 25
                ? Zip.Value[nearest.Zip].Select(r => r.Locality).ToHashSet() : new HashSet<Locality>();
            return new Search("", localities, [device], [], true, "");
        }
        if (text.Length == 0) return new Search("", new HashSet<Locality>(), [], [], true, "");
        var state = parts.Length == 2 ? StateCode(parts[1]) : "";
        var postal = PostalCode(text);
        var rows = postal.Length == 5 ? Zip.Value[postal] : Cities.Value[text];
        var matches = rows.Where(row => state.Length == 0 || row.Locality.State == state).ToArray();
        var locations = matches.Select(row => row.Locality).ToHashSet();
        var ambiguous = postal.Length != 5 && locations.Select(location => location.State).Distinct().Count() > 1;
        var center = ambiguous ? null : ReferencePoint(matches);
        Point[] centers = center == null ? [] : [center];
        var choices = ambiguous ? locations.Select(location => parts[0] + ", " + location.State).Order().ToArray() : [];
        return new Search(text, locations, centers, choices, locations.Count != 0, state);
    }

    internal static Match Find(Search search, string city, string region, string postalCode, string country,
        string facility, double? latitude, double? longitude, int radius)
    {
        var cityName = Normalize(city);
        var state = StateCode(region);
        var us = Normalize(country) is "" or "US" or "USA" or "UNITED STATES";
        var venueLocality = new Locality(cityName, state);
        var zip = PostalCode(postalCode);
        var postalRows = us && zip.Length == 5 ? Zip.Value[zip].ToArray() : [];
        var zipLocalities = postalRows.Select(row => row.Locality).ToArray();
        var exactPostal = us && zip.Length == 5 && zip == PostalCode(search.Text);
        var matchingLocality = us && (search.Localities.Contains(venueLocality) ||
            zipLocalities.Any(place => (state.Length == 0 || place.State == state) && search.Localities.Contains(place)));
        var qualifiedCity = search.State.Length != 0;
        var possibleLegacy = us && state.Length == 0 && zipLocalities.Length == 0 && cityName.Length != 0 &&
            search.Localities.Any(place => place.City == cityName);
        var localTextMatch = search.Text.Length != 0 && !search.Known && cityName == search.Text &&
            (!qualifiedCity || search.State == state);
        var facilityMatch = search.Text.Length != 0 && !qualifiedCity && !search.Known &&
            Normalize(facility).Contains(search.Text, StringComparison.Ordinal);
        if (search.Text.Length == 0 && search.Centers.Count == 0) return new Match(null, false, false);
        var facilityPoint = ValidPoint(latitude, longitude);
        if (search.Centers.Count != 0)
        {
            var point = facilityPoint ? new Point(latitude.Value, longitude.Value)
                : ReferencePoint(postalRows.Where(row => state.Length == 0 || row.Locality.State == state));
            if (point == null && us && state.Length != 0 && cityName.Length != 0)
                point = ReferencePoint(Cities.Value[cityName].Where(row => row.Locality == venueLocality));
            if (point != null)
            {
                var miles = search.Centers.Min(center => Distance(center, point));
                return miles <= radius ? new Match(Math.Round(miles, 1), !facilityPoint, false) : null;
            }
        }
        if (exactPostal || matchingLocality || possibleLegacy || localTextMatch || facilityMatch)
            return new Match(null, !ValidPoint(latitude, longitude), possibleLegacy);
        return null;
    }

    private static Point ReferencePoint(IEnumerable<PostalRow> rows)
    {
        var points = rows.Select(row => row.Point).Where(point => ValidPoint(point.Latitude, point.Longitude)).Distinct().ToArray();
        return points.Length == 0 ? null : new Point(points.Average(p => p.Latitude), points.Average(p => p.Longitude));
    }

    internal static (string City, string Region) Display(string city, string region, string postalCode, string country)
    {
        var zip = PostalCode(postalCode);
        if (zip.Length != 5 || Normalize(country) is not ("" or "US" or "USA" or "UNITED STATES"))
            return (city, region);
        var state = StateCode(region);
        var savedCity = Normalize(city);
        var matches = Zip.Value[zip].Where(row => (state.Length == 0 || row.Locality.State == state) &&
            (savedCity.Length == 0 || row.Locality.City == savedCity)).DistinctBy(row => row.Locality).Take(2).ToArray();
        if (matches.Length != 1) return (city, region);
        return (savedCity.Length == 0 ? matches[0].CityName : city, state.Length == 0 ? matches[0].Locality.State : region);
    }

    internal static bool ValidPoint(double? lat, double? lon) =>
        lat is >= -90 and <= 90 && lon is >= -180 and <= 180;

    internal static double Distance(Point a, Point b)
    {
        const double radians = Math.PI / 180;
        var lat = Math.Sin((b.Latitude - a.Latitude) * radians / 2);
        var lon = Math.Sin((b.Longitude - a.Longitude) * radians / 2);
        var h = lat * lat + Math.Cos(a.Latitude * radians) * Math.Cos(b.Latitude * radians) * lon * lon;
        return 3958.76 * 2 * Math.Asin(Math.Sqrt(Math.Clamp(h, 0, 1)));
    }

    private static string Normalize(string value) => Regex.Replace((value ?? "").Trim().ToUpperInvariant(), @"\s+", " ");
    internal static string StateCode(string value)
    {
        var normalized = Normalize(value);
        return normalized.Length > 2 ? States.Value.GetValueOrDefault(normalized, normalized) : normalized;
    }

    private static string PostalCode(string value)
    {
        var input = (value ?? "").Trim();
        return Regex.IsMatch(input, @"^\d{5}(?:-\d{4})?$") ? input[..5] : "";
    }
}

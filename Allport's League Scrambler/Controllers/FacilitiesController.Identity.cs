using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Allport_s_League_Scrambler.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers;

public sealed partial class FacilitiesController
{
    [Authorize, HttpGet("matches")]
    public async Task<IActionResult> Matches(string name, string address, string city, string region, string postalCode,
        string country, string alternateName, string website, string sourceKey, int? excludeId,
        double? latitude, double? longitude, bool approximate = true)
    {
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        if (name?.Length > 100 || address?.Length > 140 || city?.Length > 80 || region?.Length > 50 ||
            postalCode?.Length > 16 || country?.Length > 50 || alternateName?.Length > 150 ||
            website?.Length > 500 || sourceKey?.Length > 150) return BadRequest();
        var admin = User.IsInRole("Admin");
        var candidate = new FacilityIdentity.Candidate(name, address, city, region, postalCode, country,
            alternateName, website, admin ? sourceKey : null, admin ? latitude : null, admin ? longitude : null, approximate);
        await using var db = new DataContext();
        var matches = await FacilityIdentity.Find(db, candidate, admin ? excludeId : null, true);
        return Ok(await FacilityIdentity.Describe(db, matches, admin, account, true));
    }

    [Authorize(Roles = "Admin"), HttpGet("duplicate-audit")]
    public async Task<IActionResult> Audit()
    {
        await using var db = new DataContext();
        var venues = await db.PickupVenues.AsNoTracking().OrderBy(v => v.Id).ToListAsync();
        var profiles = await db.FacilityProfiles.AsNoTracking().ToDictionaryAsync(p => p.VenueId);
        var identities = venues.Select(v => FacilityIdentity.Candidate.From(v, profiles.GetValueOrDefault(v.Id))).ToArray();
        var pickups = (await db.PickupSessions.AsNoTracking()
            .Select(s => new { s.VenueId, s.Id, s.Name, s.State, s.Visibility }).ToListAsync()).ToLookup(s => s.VenueId);
        var events = (await db.EventFacilities.AsNoTracking().Select(e => new {
            e.VenueId, e.LeagueId, name = e.League.LeagueName, e.League.EventTypeId, e.PublicListing
        }).ToListAsync()).ToLookup(e => e.VenueId);
        var groups = new List<object>();
        object PresentVenue(Pickup.PickupVenue v) => new {
            v.Id, v.Name, v.Address, v.City, v.Region, v.PostalCode, v.Country,
            pickup = pickups[v.Id], events = events[v.Id]
        };
        for (var a = 0; a < venues.Count; a++)
        {
            for (var b = a + 1; b < venues.Count; b++)
            {
                var match = FacilityIdentity.Compare(identities[a], identities[b], includeWeakNames: true);
                if (match.HasValue)
                    groups.Add(new { match.Value.Reason, match.Value.Definitive,
                        facilities = new[] { PresentVenue(venues[a]), PresentVenue(venues[b]) } });
            }
        }
        return Ok(groups);
    }

    public record MergeInput(int SourceVenueId, int TargetVenueId, string Confirmation);

    [Authorize(Roles = "Admin"), SameOrigin, HttpPost("merge")]
    public async Task<IActionResult> Merge(MergeInput input)
    {
        if (!LeagueAccess.TryGetAccountId(User, out var admin)) return Unauthorized();
        if (input.SourceVenueId <= 0 || input.TargetVenueId <= 0 || input.SourceVenueId == input.TargetVenueId ||
            input.Confirmation != $"Merge {input.SourceVenueId} into {input.TargetVenueId}")
            return BadRequest(new { message = "Choose two different facilities and type the exact confirmation." });
        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        await FacilityIdentity.Lock(db);
        var source = await db.PickupVenues.FindAsync(input.SourceVenueId);
        var destination = await db.PickupVenues.FindAsync(input.TargetVenueId);
        if (source == null || destination == null) return NotFound();
        var sourceProfile = await db.FacilityProfiles.FindAsync(source.Id);
        var targetProfile = await db.FacilityProfiles.FindAsync(destination.Id);
        var pickupIds = await db.PickupSessions.Where(s => s.VenueId == source.Id).Select(s => s.Id).ToArrayAsync();
        var eventIds = await db.EventFacilities.Where(e => e.VenueId == source.Id).Select(e => e.LeagueId).ToArrayAsync();
        var providers = await db.FacilityProviderIdentities.Where(p => p.VenueId == source.Id).Select(p => p.SourceKey).ToArrayAsync();
        db.FacilityMerges.Add(new FacilityMerge {
            SourceVenueId = source.Id, TargetVenueId = destination.Id, AdminId = admin,
            SourceName = source.Name, SourceAlternateName = sourceProfile?.AlternateName,
            Snapshot = JsonSerializer.Serialize(new { facility = source, profile = sourceProfile, pickupIds, eventIds, providers }),
            MergedUtc = DateTimeOffset.UtcNow
        });
        if (sourceProfile != null)
        {
            if (targetProfile == null)
            {
                targetProfile = new FacilityProfile { VenueId = destination.Id, VerifiedUtc = sourceProfile.VerifiedUtc,
                    ApproximateCoordinates = true };
                db.FacilityProfiles.Add(targetProfile);
            }
            targetProfile.AlternateName ??= source.Name == destination.Name ? sourceProfile.AlternateName : source.Name;
            targetProfile.Website ??= sourceProfile.Website;
            targetProfile.Activities ??= sourceProfile.Activities;
            targetProfile.Source ??= sourceProfile.Source;
        }
        await db.PickupSessions.Where(s => s.VenueId == source.Id)
            .ExecuteUpdateAsync(rows => rows.SetProperty(s => s.VenueId, destination.Id));
        await db.EventFacilities.Where(e => e.VenueId == source.Id)
            .ExecuteUpdateAsync(rows => rows.SetProperty(e => e.VenueId, destination.Id));
        await db.FacilityProviderIdentities.Where(p => p.VenueId == source.Id)
            .ExecuteUpdateAsync(rows => rows.SetProperty(p => p.VenueId, destination.Id));
        await db.FacilityMerges.Where(m => m.TargetVenueId == source.Id)
            .ExecuteUpdateAsync(rows => rows.SetProperty(m => m.TargetVenueId, destination.Id));
        db.PickupVenues.Remove(source);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { id = destination.Id, pickupSessionsMoved = pickupIds.Length, eventsMoved = eventIds.Length });
    }
}

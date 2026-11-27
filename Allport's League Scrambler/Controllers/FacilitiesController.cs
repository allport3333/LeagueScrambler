using System;
using System.Linq;
using System.Net.Mail;
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

namespace Allport_s_League_Scrambler.Controllers;

[ApiController, Route("api/facilities")]
public sealed partial class FacilitiesController(TransactionalMail mail) : ControllerBase
{
    private static IQueryable<PickupSession> PublicPickup(DataContext db, DateTimeOffset now) =>
        db.PickupSessions.Where(s => s.Visibility == SessionVisibility.Public &&
            (s.State == SessionState.Published || s.State == SessionState.InProgress) && s.EndsUtc > now);

    internal static IQueryable<PickupVenue> Directory(DataContext db)
    {
        var pickup = PublicPickup(db, DateTimeOffset.UtcNow);
        return db.PickupVenues.Where(v => db.FacilityProfiles.Any(p => p.VenueId == v.Id) ||
            pickup.Any(s => s.VenueId == v.Id) || db.EventFacilities.Any(e => e.VenueId == v.Id && e.PublicListing && e.League.IsActive &&
                (e.League.EventTypeId == 1 || e.League.EventTypeId == 2)));
    }

    [AllowAnonymous, HttpGet]
    public async Task<IActionResult> Browse(string q, string location, int radius = 25, string sport = null,
        int? eventType = null, DateOnly? from = null, DateOnly? to = null, int page = 0)
    {
        if (radius is not (5 or 10 or 25 or 50) || page is < 0 or > 99 || q?.Length > 150 ||
            location?.Length > 100 || sport?.Length > 40 || eventType is not (null or 1 or 2 or 3) || from > to)
            return BadRequest(new { message = "Check the location, radius, and date filters." });
        await using var db = new DataContext();
        var nearby = PickupLocations.Resolve(location, null);
        if (!string.IsNullOrWhiteSpace(location) && !nearby.Known)
            return BadRequest(new { message = "Location not recognized. Enter a city and state or a ZIP code." });
        q = q?.Trim();
        var query = from venue in Directory(db).AsNoTracking()
                    join profile in db.FacilityProfiles.AsNoTracking() on venue.Id equals profile.VenueId into profiles
                    from profile in profiles.DefaultIfEmpty()
                    where string.IsNullOrEmpty(q) || venue.Name.Contains(q) || profile.AlternateName.Contains(q) ||
                        db.FacilityMerges.Any(m => m.TargetVenueId == venue.Id &&
                            (m.SourceName.Contains(q) || m.SourceAlternateName.Contains(q)))
                    select new { venue, profile };
        var rows = await query.ToListAsync();
        var activities = PublicEvents(db);
        var pickup = PublicPickup(db, DateTimeOffset.UtcNow);
        if (eventType != null || from != null || to != null || !string.IsNullOrWhiteSpace(sport))
        {
            var eventVenues = await activities.Where(e => (eventType == null || e.EventType == eventType) &&
                (sport == null || e.Sport == sport) &&
                (from == null || e.Date >= from) && (to == null || e.Date <= to))
                .Select(e => e.VenueId).Distinct().ToListAsync();
            if (eventType is null or 3)
                eventVenues.AddRange(await pickup.Where(s => (sport == null || s.Sport == sport) &&
                    (from == null || s.LocalDate >= from) && (to == null || s.LocalDate <= to))
                    .Select(s => s.VenueId).Distinct().ToListAsync());
            var matchingVenues = eventVenues.ToHashSet();
            rows = rows.Where(r => matchingVenues.Contains(r.venue.Id) ||
                (eventType == null && from == null && to == null &&
                Activities(r.profile).Contains(sport, StringComparer.OrdinalIgnoreCase))).ToList();
        }
        var matches = rows.Select(r => new {
                r.venue, r.profile, match = PickupLocations.Find(nearby, r.venue.City, r.venue.Region,
                    r.venue.PostalCode, r.venue.Country, r.venue.Name, r.venue.Latitude, r.venue.Longitude, radius)
            }).Where(row => row.match != null).OrderBy(row => row.match.Miles ?? double.MaxValue)
            .ThenBy(row => row.venue.Name).ThenBy(row => row.venue.Id).Skip(page * 24).Take(25).ToArray();
        return Ok(new {
            facilities = matches.Take(24).Select(row => Present(row.venue, row.profile, row.match)),
            hasMore = matches.Length > 24, locationChoices = nearby.Choices
        });
    }

    [AllowAnonymous, HttpGet("count")]
    public async Task<IActionResult> Count()
    {
        await using var db = new DataContext();
        return Ok(new { count = await Directory(db).CountAsync() });
    }

    [AllowAnonymous, HttpGet("{id:int}")]
    public async Task<IActionResult> Details(int id, int? eventId, string location)
    {
        if (location?.Length > 100) return BadRequest();
        await using var db = new DataContext();
        var venues = User.IsInRole("Admin") ? db.PickupVenues.AsQueryable() : Directory(db);
        var venue = await venues.AsNoTracking().SingleOrDefaultAsync(v => v.Id == id);
        if (venue == null) return NotFound();
        var profile = await db.FacilityProfiles.AsNoTracking().SingleOrDefaultAsync(p => p.VenueId == id);
        var events = await PublicEvents(db).Where(e => e.VenueId == id && (eventId == null || e.LeagueId == eventId)).OrderBy(e => e.Date)
            .ThenBy(e => e.Name).Take(100).ToListAsync();
        if (eventId.HasValue && events.Count == 0) return NotFound();
        var now = DateTimeOffset.UtcNow;
        var pickup = await PublicPickup(db, now).Where(s => s.VenueId == id && s.StartsUtc < now.AddDays(14))
            .OrderBy(s => s.StartsUtc).Take(24).Select(s => new { s.Id, s.Name, s.Sport, s.StartsUtc, s.EndsUtc }).ToListAsync();
        var search = PickupLocations.Resolve(location, null);
        var distance = search.Centers.Count == 1 ? PickupLocations.Find(search, venue.City, venue.Region,
            venue.PostalCode, venue.Country, venue.Name, venue.Latitude, venue.Longitude, 50) : null;
        var openStreetMap = await db.FacilityProviderIdentities.AnyAsync(row => row.VenueId == id && row.SourceKey.StartsWith("osm:"));
        return Ok(new { facility = Present(venue, profile, distance, openStreetMap), events, pickup });
    }

    [AllowAnonymous, HttpGet("event/{leagueId:int}")]
    public async Task<IActionResult> Event(int leagueId)
    {
        await using var db = new DataContext();
        var listing = await db.EventFacilities.AsNoTracking().Include(e => e.Venue)
            .SingleOrDefaultAsync(e => e.LeagueId == leagueId);
        var league = await db.Leagues.AsNoTracking().SingleOrDefaultAsync(e =>
            e.ID == leagueId && (e.EventTypeId == 1 || e.EventTypeId == 2));
        if (league == null) return NotFound();
        var manager = LeagueAccess.CanManage(User, db, leagueId);
        if ((listing == null || !listing.PublicListing || !league.IsActive) && !manager)
        {
            if (!LeagueAccess.TryGetAccountId(User, out var account)) return NotFound();
            var member = await (from player in db.UsersPlayer
                                join roster in db.PlayersLeagues on player.PlayerId equals roster.PlayerID
                                where player.UserId == account && roster.LeagueID == leagueId
                                select player).AnyAsync();
            if (!member) return NotFound();
        }
        if (listing == null && league.IsActive && !manager) return NotFound();
        return Ok(new { league.IsActive, league.EventTypeId, venueId = listing?.VenueId, name = listing?.Venue?.Name,
            publicListing = listing?.PublicListing ?? false, sport = listing?.Sport, season = listing?.Season,
            description = listing?.Description, leadAdminId = User.IsInRole("Admin") ? listing?.LeadAdminId : null,
            directoryVisible = listing != null && await Directory(db).AnyAsync(v => v.Id == listing.VenueId) });
    }

    [Authorize(Roles = "Admin"), HttpGet("lead-admins")]
    public async Task<IActionResult> LeadAdmins()
    {
        await using var db = new DataContext();
        return Ok(await db.Users.Where(u => u.UserRoleId == 1).OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new { Id = u.UserId, Name = u.FirstName + " " + u.LastName }).ToArrayAsync());
    }

    public sealed class Assignment
    {
        private int? venueId;
        internal bool HasVenueId { get; private set; }
        public int? VenueId { get => venueId; init { venueId = value; HasVenueId = true; } }
        public bool PublicListing { get; init; }
        public string Sport { get; init; }
        public string Season { get; init; }
        public string Description { get; init; }
        public int? LeadAdminId { get; init; }
        public bool? IsActive { get; init; }
    }

    [Authorize, SameOrigin, HttpPut("event/{leagueId:int}")]
    public async Task<IActionResult> Assign(int leagueId, Assignment input)
    {
        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        await FacilityIdentity.Lock(db);
        if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
        var league = await db.Leagues.SingleOrDefaultAsync(e => e.ID == leagueId && (e.EventTypeId == 1 || e.EventTypeId == 2));
        if (league == null) return NotFound();
        if (input.IsActive.HasValue) league.IsActive = input.IsActive.Value;
        if (input.Sport?.Length > 40 || input.Season?.Length > 80 || input.Description?.Length > 500)
            return BadRequest(new { message = "The sport, season, or description is too long." });
        var existing = input.HasVenueId ? await db.EventFacilities.FindAsync(leagueId) : null;
        if (input.HasVenueId && input.VenueId == null)
        {
            if (existing != null) db.EventFacilities.Remove(existing);
        }
        else if (input.HasVenueId)
        {
            if (existing?.VenueId != input.VenueId && !await Directory(db).AnyAsync(v => v.Id == input.VenueId)) return NotFound();
            if (input.LeadAdminId != null && (!User.IsInRole("Admin") ||
                !await db.Users.AnyAsync(u => u.UserId == input.LeadAdminId && u.UserRoleId == 1)))
                return BadRequest(new { message = "An administrator must choose an eligible lead administrator." });
            if (existing == null)
            {
                existing = new EventFacility { LeagueId = leagueId };
                db.EventFacilities.Add(existing);
            }
            existing.VenueId = input.VenueId.Value;
            existing.PublicListing = input.PublicListing;
            existing.Sport = input.Sport?.Trim();
            existing.Season = input.Season?.Trim();
            existing.Description = input.Description?.Trim();
            if (User.IsInRole("Admin")) existing.LeadAdminId = input.LeadAdminId;
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    public record Inquiry(string Name, string Email, string Subject, string Message);

    [Authorize, HttpGet("contact-profile")]
    public async Task<IActionResult> ContactProfile()
    {
        if (!LeagueAccess.TryGetAccountId(User, out var id)) return Unauthorized();
        await using var db = new DataContext();
        var profile = await db.Users.AsNoTracking().Where(user => user.UserId == id)
            .Select(user => new { Name = (user.FirstName + " " + user.LastName).Trim(), user.Email })
            .SingleOrDefaultAsync();
        return profile == null ? NotFound() : Ok(profile);
    }

    [AllowAnonymous, SameOrigin, EnableRateLimiting("facility-inquiry"), HttpPost("event/{leagueId:int}/contact")]
    public async Task<IActionResult> Contact(int leagueId, Inquiry input)
    {
        var sender = input.Email?.Trim();
        if (input.Name?.Trim().Length is not (>= 1 and <= 80) ||
            input.Subject?.Trim().Length is not (>= 1 and <= 100) || input.Message?.Trim().Length is not (>= 1 and <= 2000) ||
            sender?.Length is not (>= 1 and <= 254) || !MailAddress.TryCreate(sender, out var reply) || reply.Address != sender ||
            (input.Name + input.Subject + sender).Any(char.IsControl))
            return BadRequest(new { message = "Enter a name, reply email, subject, and message." });
        await using var db = new DataContext();
        var listing = await db.EventFacilities.AsNoTracking().Include(e => e.Venue).Include(e => e.League)
            .SingleOrDefaultAsync(e => e.LeagueId == leagueId && e.PublicListing && e.League.IsActive && e.League.EventTypeId == 1);
        if (listing == null) return NotFound();
        var assigned = await (from link in db.UserLeagues
                              join user in db.Users on link.UserId equals user.UserId
                              where link.LeagueTypeId == leagueId && (user.UserRoleId == 1 || user.UserRoleId == 2)
                              orderby user.UserRoleId descending, user.UserId
                              select user.Email).ToListAsync();
        var lead = await db.Users.Where(u => u.UserId == listing.LeadAdminId && u.UserRoleId == 1).Select(u => u.Email)
            .SingleOrDefaultAsync();
        var recipient = assigned.Append(lead).FirstOrDefault(value => MailAddress.TryCreate(value, out var address) &&
            address.Address == value);
        if (recipient == null) return Conflict(new { message = "Organizer contact is unavailable for this league." });
        using var message = new MailMessage { Subject = "League Hub organizer inquiry",
            Body = $"League: {listing.League.LeagueName}\nFacility: {listing.Venue.Name}\nSender: {input.Name.Trim()}\nSubject: {input.Subject.Trim()}\n\n{input.Message.Trim()}" };
        message.To.Add(recipient);
        message.ReplyToList.Add(reply);
        try { await mail.Send(message, "league-organizer-inquiry", Guid.NewGuid().ToString("N")); }
        catch (Exception error) when (error is SmtpException or InvalidOperationException or FormatException or OperationCanceledException)
        { return StatusCode(503, new { message = "Organizer email delivery is currently unavailable." }); }
        return Accepted();
    }

    private sealed class PublicEvent
    {
        public int LeagueId { get; init; }
        public int VenueId { get; init; }
        public int EventType { get; init; }
        public string Name { get; init; }
        public string Sport { get; init; }
        public string Season { get; init; }
        public string Description { get; init; }
        public DateOnly? Date { get; init; }
        public bool ContactAvailable { get; init; }
    }

    private static IQueryable<PublicEvent> PublicEvents(DataContext db) =>
        from listing in db.EventFacilities.AsNoTracking()
        join tournament in db.TournamentConfigurations on listing.LeagueId equals tournament.LeagueId into tournaments
        from tournament in tournaments.DefaultIfEmpty()
        where listing.PublicListing && listing.League.IsActive && (listing.League.EventTypeId == 1 || listing.League.EventTypeId == 2)
        select new PublicEvent {
            LeagueId = listing.LeagueId, VenueId = listing.VenueId, EventType = listing.League.EventTypeId,
            Name = listing.League.LeagueName, Sport = listing.Sport, Season = listing.Season,
            Description = listing.Description, Date = (DateOnly?)tournament.EventDate,
            ContactAvailable = listing.League.EventTypeId == 1 && (
                db.UserLeagues.Any(link => link.LeagueTypeId == listing.LeagueId && link.User.Email != null &&
                    link.User.Email != "" && (link.User.UserRoleId == 1 || link.User.UserRoleId == 2)) ||
                db.Users.Any(user => user.UserId == listing.LeadAdminId && user.UserRoleId == 1 &&
                    user.Email != null && user.Email != ""))
        };

    private static string[] Activities(FacilityProfile profile) =>
        profile?.Activities?.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];

    private static object Present(PickupVenue venue, FacilityProfile profile, PickupLocations.Match match = null, bool openStreetMap = false) =>
        new { venue.Id, venue.Name, venue.Address, venue.City, venue.Region, venue.PostalCode, venue.Country, venue.TimeZone,
            venue.Latitude, venue.Longitude, approximateCoordinates = profile?.ApproximateCoordinates == true,
            profile?.AlternateName, profile?.Website, profile?.Source, profile?.VerifiedUtc,
            openStreetMap = openStreetMap || profile?.SourceKey?.StartsWith("osm:", StringComparison.Ordinal) == true,
            activities = Activities(profile), distanceMiles = match?.Miles,
            approximate = profile?.ApproximateCoordinates == true || match?.Approximate == true };
}

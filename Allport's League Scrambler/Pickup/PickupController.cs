using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Allport_s_League_Scrambler.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace Allport_s_League_Scrambler.Pickup;

[ApiController, Route("api/pickup"), RequestSizeLimit(8192)]
public sealed partial class PickupController(TransactionalMail mail) : ControllerBase
{
    private static readonly string[] Sports = ["Wallyball", "Volleyball", "Basketball", "Pickleball", "Soccer", "Other"];

    [HttpGet("catalog")]
    public IActionResult Catalog()
    {
        if (!PickupEnvironment.Enabled) return NotFound();
        if (PickupEnvironment.DisposableTest) Response.Headers["X-Pickup-Test-Database"] = "LeagueScramblerPickupTest";
        return Ok(Sports);
    }

    [Authorize, HttpGet("venues")]
    public async Task<IActionResult> Venues(string q, bool directory)
    {
        if (!PickupEnvironment.Enabled) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        if (q?.Length > 140) return BadRequest();
        await using var db = new DataContext();
        var venues = directory ? Controllers.FacilitiesController.Directory(db) : AvailableVenues(db, account);
        var term = q?.Trim();
        if (!string.IsNullOrEmpty(term))
            venues = venues.Where(v => v.Name.Contains(term) || v.City.Contains(term) || v.PostalCode.StartsWith(term) ||
                db.FacilityProfiles.Any(p => p.VenueId == v.Id && p.AlternateName.Contains(term)) ||
                db.FacilityMerges.Any(m => m.TargetVenueId == v.Id &&
                    (m.SourceName.Contains(term) || m.SourceAlternateName.Contains(term))));
        var result = await venues.AsNoTracking().OrderByDescending(v => db.PickupSessions
            .Where(s => s.VenueId == v.Id && s.OrganizerId == account).Max(s => (DateTimeOffset?)s.StartsUtc))
            .ThenBy(v => v.Name).ThenBy(v => v.Id).Take(12).ToListAsync();
        return Ok(result.Select(PresentVenue));
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> Discover(string sport, string location, DateOnly? date, bool available, string skill,
        int page = 0, int radius = 25, int days = 14, bool playing = false, double? latitude = null, double? longitude = null)
    {
        if (!PickupEnvironment.Enabled) return NotFound();
        if (page is < 0 or > 200 || radius is not (5 or 10 or 25 or 50) || days is not (14 or 30 or 60) ||
            location?.Length > 120 || skill?.Length > 40 || sport?.Length > 40 ||
            ((latitude.HasValue || longitude.HasValue) && !PickupLocations.ValidPoint(latitude, longitude))) return BadRequest();
        await using var db = new DataContext();
        var now = DateTimeOffset.UtcNow;
        var through = now.AddDays(days);
        var sessions = db.PickupSessions.AsNoTracking()
            .Where(s => s.Visibility == SessionVisibility.Public &&
                (s.State == SessionState.Published || s.State == SessionState.InProgress) && s.EndsUtc > now && s.StartsUtc < through);
        var publicSessions = sessions;
        if (!string.IsNullOrWhiteSpace(sport)) sessions = sessions.Where(s => s.Sport == sport);
        if (!string.IsNullOrWhiteSpace(skill)) sessions = sessions.Where(s => s.Skill == skill);
        if (playing) sessions = sessions.Where(s => s.State == SessionState.InProgress || s.StartsUtc <= now);
        if (date is { } day) sessions = sessions.Where(s => s.LocalDate <= day);
        var candidates = await sessions.Select(s => new {
            s.Id, s.Name, s.Sport, s.Skill, s.StartsUtc, s.EndsUtc, s.DeadlineUtc, s.State, s.Capacity, s.VenueId,
            venue = s.Venue.Name, s.Venue.City, s.Venue.Region, s.Venue.PostalCode, s.Venue.Country, s.Venue.TimeZone,
            s.Venue.Latitude, s.Venue.Longitude,
            approximateCoordinates = db.FacilityProfiles.Any(p => p.VenueId == s.VenueId && p.ApproximateCoordinates),
            confirmed = db.PickupRegistrations.Count(r => r.SessionId == s.Id && r.State == RegistrationState.Confirmed)
        }).ToListAsync();
        var near = PickupLocations.Resolve(location, latitude.HasValue ? new PickupLocations.Point(latitude.Value, longitude.Value) : null);
        if (!near.Known && near.State.Length == 0 && !string.IsNullOrWhiteSpace(location))
        {
            var exact = location.Trim();
            var points = await publicSessions.Where(s => s.Venue.Name == exact && s.Venue.Latitude != null && s.Venue.Longitude != null)
                .Select(s => new { s.Venue.Latitude, s.Venue.Longitude, s.Venue.City, s.Venue.Region, s.Venue.PostalCode })
                .Distinct().Take(2).ToArrayAsync();
            if (points.Length == 1 && PickupLocations.ValidPoint(points[0].Latitude, points[0].Longitude))
            {
                var point = points[0];
                var place = PickupLocations.Resolve(string.IsNullOrWhiteSpace(point.PostalCode) ? point.City + ", " + point.Region : point.PostalCode, null);
                near = near with { Centers = [new PickupLocations.Point(point.Latitude.Value, point.Longitude.Value)], Localities = place.Localities };
            }
        }
        var catalogMatch = near.Known || near.Centers.Count != 0 || string.IsNullOrWhiteSpace(location);
        var matches = candidates.Select(s => new {
            row = s, match = PickupLocations.Find(near, s.City, s.Region, s.PostalCode, s.Country, s.venue,
                s.Latitude, s.Longitude, radius)
        }).Where(entry => entry.match != null).ToArray();
        if (!catalogMatch && matches.Length == 0)
        {
            // Recognize stored public facilities even if today's optional filters excluded their sessions.
            var publicVenues = await publicSessions
                .Select(s => new { s.Venue.Name, s.Venue.City, s.Venue.Region, s.Venue.PostalCode, s.Venue.Country })
                .Distinct().ToListAsync();
            if (!publicVenues.Any(v => PickupLocations.Find(near, v.City, v.Region, v.PostalCode, v.Country, v.Name,
                null, null, radius) != null))
                return BadRequest(new { field = "location", message = "Location not recognized. Try a city and state, ZIP code, or facility name." });
        }
        var result = matches.Where(entry => !date.HasValue || IncludesLocalDate(entry.row.StartsUtc, entry.row.EndsUtc, entry.row.TimeZone, date.Value))
            .Select(entry => new {
                s = entry.row, entry.match,
                rank = entry.row.State == SessionState.InProgress || entry.row.StartsUtc <= now ? 0
                    : entry.row.StartsUtc <= now.AddHours(2) ? 1 : 2,
                open = (entry.row.DeadlineUtc ?? entry.row.StartsUtc) > now
            })
            .Where(entry => !available || (entry.open && (entry.s.Capacity == null || entry.s.confirmed < entry.s.Capacity)))
            .OrderBy(entry => entry.rank).ThenBy(entry => entry.match.MissingState)
            .ThenBy(entry => entry.rank == 0 ? entry.match.Miles ?? double.MaxValue : 0)
            .ThenBy(entry => entry.s.StartsUtc)
            .ThenBy(entry => entry.match.Miles ?? double.MaxValue).ThenBy(entry => entry.s.Id)
            .Skip(page * 12).Take(13).ToArray();
        return Ok(new {
            sessions = result.Take(12).Select(entry => {
                var label = PickupLocations.Display(entry.s.City, entry.s.Region, entry.s.PostalCode, entry.s.Country);
                return new {
                    entry.s.Id, entry.s.Name, entry.s.Sport, entry.s.Skill, entry.s.venue, entry.s.VenueId, entry.s.City, entry.s.Region,
                    entry.s.PostalCode, entry.s.TimeZone, entry.s.StartsUtc, entry.s.EndsUtc, entry.s.State, entry.s.Capacity,
                    entry.s.confirmed, registrationOpen = entry.open, timing = entry.rank, distanceMiles = entry.match.Miles,
                    approximateLocation = entry.match.Approximate || entry.s.approximateCoordinates, locationUnconfirmed = entry.match.MissingState,
                    displayCity = label.City, displayRegion = label.Region
                };
            }),
            hasMore = result.Length > 12,
            locationChoices = near.Choices
        });
    }

    private static object PresentVenue(PickupVenue venue)
    {
        var label = PickupLocations.Display(venue.City, venue.Region, venue.PostalCode, venue.Country);
        return new { venue.Id, venue.Name, venue.Address, venue.City, venue.Region, venue.PostalCode,
            venue.Country, venue.TimeZone, venue.Latitude, venue.Longitude, displayCity = label.City, displayRegion = label.Region };
    }

    private static bool IncludesLocalDate(DateTimeOffset start, DateTimeOffset end, string zoneId, DateOnly date)
    {
        if (!TryZone(zoneId, out var zone, out _)) return false;
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(start, zone).DateTime) <= date &&
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(end.AddTicks(-1), zone).DateTime) >= date;
    }

    [Authorize, HttpGet("mine")]
    public async Task<IActionResult> Mine()
    {
        if (!PickupEnvironment.Enabled) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        await using var db = new DataContext();
        return Ok(await Cards(db, db.PickupSessions.AsNoTracking().Include(s => s.Venue)
            .Where(s => s.OrganizerId == account || db.PickupRegistrations.Any(r => r.SessionId == s.Id && r.AccountId == account))
            .OrderByDescending(s => s.StartsUtc).Take(100)));
    }

    [HttpGet("sessions/{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        if (!PickupEnvironment.Enabled) return NotFound();
        await using var db = new DataContext();
        var session = await db.PickupSessions.AsNoTracking().Include(s => s.Venue).SingleOrDefaultAsync(s => s.Id == id);
        var mine = await FindRegistration(db, id);
        if (session == null || (!CanRead(session, mine) && !CanDelete(session))) return NotFound();
        var owner = IsOwner(session);
        var registrations = owner ? await db.PickupRegistrations.AsNoTracking().Where(r => r.SessionId == id &&
            (r.State == RegistrationState.Confirmed || r.State == RegistrationState.PendingApproval || r.State == RegistrationState.Waitlisted))
            .Select(r => new { r.Id, r.Name, r.State }).ToListAsync() : null;
        var organizer = await db.Users.Where(u => u.UserId == session.OrganizerId)
            .Select(u => u.FirstName + " " + u.LastName).SingleAsync();
        return Ok(new {
            session.Id, session.Name, session.Sport, Venue = PresentVenue(session.Venue), session.StartsUtc, session.EndsUtc, session.DeadlineUtc,
            directoryVisible = await db.FacilityProfiles.AnyAsync(p => p.VenueId == session.VenueId) ||
                await db.PickupSessions.AnyAsync(s => s.VenueId == session.VenueId && s.Visibility == SessionVisibility.Public &&
                    (s.State == SessionState.Published || s.State == SessionState.InProgress) && s.EndsUtc > DateTimeOffset.UtcNow),
            session.LocalDate, session.Description, session.Skill, session.Capacity, session.Visibility, session.State,
            session.ApprovalRequired, organizer, owner, canReopen = CanReopen(session), canDelete = CanDelete(session),
            organizerNotes = owner ? session.OrganizerNotes : null,
            confirmed = await Confirmed(db, id),
            registrationOpen = RegistrationOpen(session),
            hasLinkedPlayer = LeagueAccess.TryGetAccountId(User, out var accountId)
                ? (bool?)await db.UsersPlayer.AnyAsync(link => link.UserId == accountId) : null,
            registration = mine?.State,
            registrations
        });
    }

    [Authorize, SameOrigin, HttpPost("sessions")]
    public async Task<IActionResult> Create(SessionInput input)
    {
        if (!PickupEnvironment.Enabled) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        var conflict = await CheckActiveSlot(db, account);
        if (conflict != null) return conflict;
        var session = new PickupSession { Id = Guid.NewGuid(), OrganizerId = account, State = SessionState.Published };
        var error = await Apply(db, session, input);
        if (error != null) return Invalid(error);
        db.PickupSessions.Add(session);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return CreatedAtAction(nameof(Get), new { id = session.Id }, new { session.Id });
    }

    [Authorize, SameOrigin, HttpPut("sessions/{id:guid}")]
    public Task<IActionResult> Edit(Guid id, SessionInput input) => WithSession(id, async (db, session) =>
    {
        if (!IsOwner(session)) return NotFound();
        if (session.State is not (SessionState.Published or SessionState.InProgress)) return ConflictMessage("This session can no longer be edited.");
        var confirmed = await Confirmed(db, id);
        if (input.Capacity is { } limit && limit < confirmed)
            return Invalid(new InputError("capacity", "The limit cannot be lower than the confirmed registrations."));
        var error = await Apply(db, session, input);
        if (error != null) return Invalid(error);
        await PromoteWaitlist(db, session, confirmed);
        return NoContent();
    });

    [Authorize, SameOrigin, HttpPost("sessions/{id:guid}/cancel")]
    public Task<IActionResult> CancelSession(Guid id) => WithSession(id, (db, session) =>
    {
        if (!IsOwner(session)) return Task.FromResult<IActionResult>(NotFound());
        if (session.State == SessionState.Completed) return Task.FromResult<IActionResult>(ConflictMessage("Completed sessions are retained."));
        session.State = SessionState.Cancelled;
        return Task.FromResult<IActionResult>(NoContent());
    });

    [Authorize, SameOrigin, HttpPost("sessions/{id:guid}/join")]
    public Task<IActionResult> Join(Guid id, bool waitlist = false) => WithSession(id, async (db, session) =>
    {
        if (!CanRead(session)) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        var user = await db.Users.SingleOrDefaultAsync(u => u.UserId == account);
        if (user == null || string.IsNullOrWhiteSpace(user.Email)) return Unauthorized();
        var key = EmailKey(user.Email);
        var row = await db.PickupRegistrations.SingleOrDefaultAsync(r => r.SessionId == id && r.AccountId == account);
        row ??= await db.PickupRegistrations.SingleOrDefaultAsync(r => r.SessionId == id && r.EmailKey == key);
        if (row != null && row.AccountId != account)
            return ConflictMessage("This session already has a guest request for this email. Use the guest verification link to manage it.");
        var player = await db.UsersPlayer.Where(p => p.UserId == account).OrderBy(p => p.UsersPlayerId)
            .Select(p => (int?)p.PlayerId).FirstOrDefaultAsync();
        if (row == null && player.HasValue)
        {
            var direct = await db.PickupRegistrations.Where(r => r.SessionId == id && r.PlayerId == player).ToListAsync();
            if (direct.Count != 0)
            {
                if (direct.Count != 1 || direct[0].AccountId.HasValue) return ConflictMessage("This player already has a registration.");
                row = direct[0];
                row.AccountId = account;
                row.EmailKey = key;
            }
        }
        if (row?.State is RegistrationState.Confirmed or RegistrationState.PendingApproval or RegistrationState.Waitlisted) return Ok(new { registration = row.State });
        if (row?.State == RegistrationState.Declined) return ConflictMessage("This registration was declined.");
        if (await CannotJoin(db, session, waitlist) is { } blocked) return blocked;
        if (row == null)
        {
            row = new PickupRegistration { Id = Guid.NewGuid(), SessionId = id, AccountId = account, PlayerId = player,
                EmailKey = key, Name = (user.FirstName + " " + user.LastName).Trim(), CreatedUtc = DateTimeOffset.UtcNow };
            db.PickupRegistrations.Add(row);
        }
        row.State = await JoiningState(db, session);
        return Ok(new { registration = row.State });
    });

    [SameOrigin, EnableRateLimiting("pickup-guest"), HttpPost("sessions/{id:guid}/guest")]
    public async Task<IActionResult> Guest(Guid id, GuestInput input, bool waitlist = false)
    {
        if (User.Identity?.IsAuthenticated == true) return Invalid("Use Join Session while signed in.");
        var addressText = input.Email.Trim();
        if (!MailAddress.TryCreate(addressText, out var address) || address.Address != addressText ||
            string.IsNullOrWhiteSpace(input.Name)) return Invalid("Enter your name and a valid email address.");
        string token = null;
        var result = await WithSession(id, async (db, session) =>
        {
            if (!CanRead(session)) return NotFound();
            var key = EmailKey(address.Address);
            var row = await db.PickupRegistrations.SingleOrDefaultAsync(r => r.SessionId == id && r.EmailKey == key);
            if (row?.AccountId != null) return Accepted();
            if (row == null)
            {
                var normalized = address.Address.ToUpperInvariant();
                if (await db.Users.AnyAsync(user => user.Email != null && user.Email.Trim().ToUpper() == normalized))
                    return Accepted();
            }
            if (row?.VerifiedUtc == null && await CannotJoin(db, session, waitlist) is { } blocked) return blocked;
            var now = DateTimeOffset.UtcNow;
            if (row?.VerificationExpiresUtc > now.AddMinutes(19)) return Accepted();
            if (row == null)
            {
                row = new PickupRegistration { Id = Guid.NewGuid(), SessionId = id, EmailKey = key,
                    Name = input.Name.Trim(), State = RegistrationState.PendingVerification, CreatedUtc = now };
                db.PickupRegistrations.Add(row);
            }
            token = NewToken();
            row.VerificationHash = Hash(token);
            row.VerificationExpiresUtc = now.AddMinutes(20);
            return Accepted();
        });
        if (token == null) return result;
        using var message = new MailMessage { Subject = "Verify your Pickup Games registration",
            Body = "Open this link within 20 minutes to verify your request:\r\n" + PickupEnvironment.Origin +
                   "/pickup/" + id + "#verify=" + token + (waitlist ? "&waitlist=1" : "") };
        message.To.Add(address);
        try { await mail.Send(message, "pickup-verification", id.ToString()); }
        catch (Exception error) when (error is SmtpException or InvalidOperationException or OperationCanceledException)
        { return StatusCode(503, new { message = "Verification email could not be prepared. Try again shortly." }); }
        return result;
    }

    [SameOrigin, EnableRateLimiting("pickup-guest"), HttpPost("sessions/{id:guid}/verify")]
    public async Task<IActionResult> Verify(Guid id, TokenInput input)
    {
        if (!ValidToken(input.Token)) return Invalid("This verification link is invalid or has expired.");
        string access = null;
        var result = await WithSession(id, async (db, session) =>
        {
            if (!CanRead(session)) return NotFound();
            var hash = Hash(input.Token);
            var now = DateTimeOffset.UtcNow;
            var row = await db.PickupRegistrations.SingleOrDefaultAsync(r => r.SessionId == id &&
                r.AccountId == null && r.VerificationHash == hash && r.VerificationExpiresUtc > now);
            if (row == null) return Invalid("This verification link expired or was already used. Request a new link if needed.");
            if (row.State is RegistrationState.PendingVerification or RegistrationState.Cancelled)
            {
                if (await CannotJoin(db, session, input.Waitlist) is { } blocked) return blocked;
                row.State = await JoiningState(db, session);
            }
            row.VerifiedUtc ??= now;
            row.VerificationHash = null;
            row.VerificationExpiresUtc = null;
            access = NewToken();
            row.AccessHash = Hash(access);
            row.AccessExpiresUtc = now.AddDays(30);
            return Ok(new { registration = row.State });
        });
        if (access != null) Response.Cookies.Append(CookieName(id), access, new CookieOptions
        {
            HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict, MaxAge = TimeSpan.FromDays(30),
            Path = "/api/pickup/sessions/" + id
        });
        return result;
    }

    [SameOrigin, HttpPost("sessions/{id:guid}/leave")]
    public Task<IActionResult> Leave(Guid id) => WithSession(id, async (db, session) =>
    {
        var row = await FindRegistration(db, id);
        if (!CanRead(session, row)) return NotFound();
        if (row == null) return NotFound();
        if (session.EndsUtc <= DateTimeOffset.UtcNow || session.State == SessionState.Completed)
            return ConflictMessage("Past registrations are preserved.");
        var confirmed = row.State == RegistrationState.Confirmed;
        if (row.State is RegistrationState.Confirmed or RegistrationState.PendingApproval or RegistrationState.Waitlisted)
            row.State = RegistrationState.Cancelled;
        if (confirmed) await PromoteWaitlist(db, session, await Confirmed(db, id) - 1);
        return NoContent();
    });

    [Authorize, SameOrigin, HttpPost("sessions/{id:guid}/registrations/{registration:guid}")]
    public Task<IActionResult> Decide(Guid id, Guid registration, DecisionInput input) => WithSession(id, async (db, session) =>
    {
        if (!IsOwner(session)) return NotFound();
        var row = await db.PickupRegistrations.SingleOrDefaultAsync(r => r.SessionId == id && r.Id == registration);
        if (row?.State != RegistrationState.PendingApproval) return NotFound();
        if (input.Approve && await CannotJoin(db, session) is { } blocked) return blocked;
        row.State = input.Approve ? RegistrationState.Confirmed : RegistrationState.Declined;
        if (!input.Approve) await PromoteWaitlist(db, session, await Confirmed(db, id));
        return NoContent();
    });

    private async Task<IActionResult> WithSession(Guid id, Func<DataContext, PickupSession, Task<IActionResult>> work)
    {
        if (!PickupEnvironment.Enabled) return NotFound();
        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        if (!await AcquirePickupLock(db, "pickup-session:" + id))
            return ConflictMessage("The session is busy. Try again.");
        var session = await db.PickupSessions.SingleOrDefaultAsync(s => s.Id == id);
        if (session == null) return NotFound();
        var result = await work(db, session);
        if (result is StatusCodeResult { StatusCode: >= 400 } or ObjectResult { StatusCode: >= 400 }) return result;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return result;
    }

    private static async Task<bool> AcquirePickupLock(DataContext db, string resource)
    {
        try
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @result int;
            EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=5000;
            IF @result < 0 THROW 51020, 'Pickup session lock unavailable', 1;
            """);
        }
        catch (SqlException error) when (error.Number is 51020 or 1205)
        { return false; }
        return true;
    }

    private async Task<IActionResult> CheckActiveSlot(DataContext db, int organizer)
    {
        // Serialize publishing across all sessions owned by this account.
        if (!await AcquirePickupLock(db, "pickup-organizer:" + organizer))
            return ConflictMessage("Pickup sessions are busy. Try again.");
        var activeSessionId = await db.PickupSessions
            .Where(s => s.OrganizerId == organizer && (s.State == SessionState.Published || s.State == SessionState.InProgress))
            .OrderByDescending(s => s.State == SessionState.InProgress).ThenBy(s => s.StartsUtc).ThenBy(s => s.Id)
            .Select(s => (Guid?)s.Id).FirstOrDefaultAsync();
        return activeSessionId == null ? null : Conflict(new {
            message = "You already have an active pickup session. Complete, cancel, or delete it before starting another.",
            activeSessionId
        });
    }

    private bool CanDelete(PickupSession session) => IsOwner(session) || User.IsInRole("Admin");

    public sealed record DeleteSessionInput(string Name);

    [Authorize, SameOrigin, HttpDelete("sessions/{id:guid}")]
    public async Task<IActionResult> DeleteSession(Guid id, [FromBody] DeleteSessionInput input)
    {
        try
        {
            return await WithSession(id, async (db, session) =>
            {
                if (!CanDelete(session)) return NotFound();
                if (!string.Equals(input.Name, session.Name, StringComparison.Ordinal))
                    return ConflictMessage("The session name does not match. Reopen the confirmation and try again.");

                await db.PickupGameSets.Where(s => s.SessionId == id).ExecuteDeleteAsync();
                await db.PickupRegistrations.Where(r => r.SessionId == id).ExecuteDeleteAsync();
                db.PickupSessions.Remove(session);
                return NoContent();
            });
        }
        catch (DbUpdateException error) when (error.InnerException is SqlException { Number: 547 })
        {
            return ConflictMessage("This pickup session has related records that prevent safe deletion.");
        }
        catch (SqlException error) when (error.Number == 547)
        {
            return ConflictMessage("This pickup session has related records that prevent safe deletion.");
        }
    }

    private bool IsOwner(PickupSession s) => LeagueAccess.TryGetAccountId(User, out var account) && account == s.OrganizerId;
    private bool CanRead(PickupSession s) => s != null && (IsOwner(s) || CanReopen(s) ||
        (s.Visibility != SessionVisibility.Private && s.State != SessionState.Draft));

    private static async Task<List<object>> Cards(DataContext db, IQueryable<PickupSession> sessions) =>
        await sessions.Select(s => (object)new { s.Id, s.Name, s.Sport, s.StartsUtc, s.EndsUtc, s.Skill,
            venue = s.Venue.Name, s.Venue.City, s.Venue.Region, s.Venue.TimeZone, s.Capacity, s.State,
            confirmed = db.PickupRegistrations.Count(r => r.SessionId == s.Id && r.State == RegistrationState.Confirmed)
        }).ToListAsync();

    private async Task<PickupRegistration> FindRegistration(DataContext db, Guid id)
    {
        if (LeagueAccess.TryGetAccountId(User, out var account))
            return await db.PickupRegistrations.SingleOrDefaultAsync(r => r.SessionId == id && r.AccountId == account);
        if (!Request.Cookies.TryGetValue(CookieName(id), out var token) || !ValidToken(token)) return null;
        var hash = Hash(token);
        var now = DateTimeOffset.UtcNow;
        return await db.PickupRegistrations.SingleOrDefaultAsync(r => r.SessionId == id && r.AccountId == null &&
            r.AccessHash == hash && r.AccessExpiresUtc > now);
    }

    private static Task<int> Confirmed(DataContext db, Guid id) => db.PickupRegistrations.CountAsync(r =>
        r.SessionId == id && r.State == RegistrationState.Confirmed);
    private static bool RegistrationOpen(PickupSession s) => (s.State is SessionState.Published or SessionState.InProgress) &&
        s.EndsUtc > DateTimeOffset.UtcNow && (s.DeadlineUtc ?? s.StartsUtc) > DateTimeOffset.UtcNow;
    private async Task<IActionResult> CannotJoin(DataContext db, PickupSession s, bool allowWaitlist = false) =>
        !RegistrationOpen(s) ? ConflictMessage("Registration is closed for this session.") :
        !allowWaitlist && await IsFull(db, s) ? ConflictMessage("This session is full.") : null;

    private static async Task<bool> IsFull(DataContext db, PickupSession session) =>
        session.Capacity is { } limit && await Confirmed(db, session.Id) >= limit;

    private static async Task<RegistrationState> JoiningState(DataContext db, PickupSession session) =>
        await IsFull(db, session) ? RegistrationState.Waitlisted : ActiveRegistration(session);

    private static RegistrationState ActiveRegistration(PickupSession session) =>
        session.ApprovalRequired ? RegistrationState.PendingApproval : RegistrationState.Confirmed;

    private static async Task PromoteWaitlist(DataContext db, PickupSession session, int confirmed)
    {
        if (!RegistrationOpen(session)) return;
        var vacancies = session.Capacity is { } limit ? Math.Max(0, limit - confirmed) : int.MaxValue;
        if (vacancies == 0) return;
        var waiting = await db.PickupRegistrations.Where(row => row.SessionId == session.Id && row.State == RegistrationState.Waitlisted)
            .OrderBy(row => row.CreatedUtc).ThenBy(row => row.Id).Take(vacancies).ToListAsync();
        foreach (var row in waiting) row.State = ActiveRegistration(session);
    }
    private static string CookieName(Guid id) => "pickup-guest-" + id.ToString("N");
    private static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private static bool ValidToken(string token) => token?.Length == 64 && token.All(Uri.IsHexDigit);
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static string EmailKey(string value) => Hash(value.Trim().ToUpperInvariant());
    private IActionResult Invalid(string message) => BadRequest(new { message });
    private IActionResult ConflictMessage(string message) => Conflict(new { message });

    private sealed record InputError(string Field, string Message, FacilityIdentity.Conflict Match = null);

    private IActionResult Invalid(InputError error) =>
        error.Match == null ? BadRequest(new { error.Field, error.Message }) : Conflict(error.Match);

    private async Task<InputError> Apply(DataContext db, PickupSession s, SessionInput input)
    {
        if (!Sports.Contains(input.Sport)) return new("sport", "Choose a sport.");
        if (input.Capacity is < 2 || (input.Capacity is > 80 && input.Capacity != s.Capacity)) return new("capacity", "Maximum players must be between 2 and 80.");
        if (!Enum.IsDefined(input.Visibility)) return new("visibility", "Choose a visibility option.");

        PickupVenue venue;
        await FacilityIdentity.Lock(db);
        if (input.VenueId is { } venueId)
        {
            venue = await AvailableVenues(db, s.OrganizerId).SingleOrDefaultAsync(v => v.Id == venueId);
            if (venue == null) return new("venue", "That facility is unavailable. Select another facility.");
        }
        else
        {
            var name = input.Venue?.Trim();
            var city = input.City?.Trim() ?? "";
            var postalCode = input.PostalCode?.Trim() ?? "";
            if (string.IsNullOrEmpty(name)) return new("venue", "Select a facility or add a new one.");
            if (city.Length == 0 && postalCode.Length == 0) return new("location", "Enter a city or ZIP code.");
            if (!TryZone(input.TimeZone, out _, out var zoneId)) return new("timeZone", "Choose a valid time zone.");
            var address = input.Address?.Trim() ?? "";
            var region = input.Region?.Trim() ?? "";
            if (zoneId == "America/New_York" && (region.Equals("MI", StringComparison.OrdinalIgnoreCase) ||
                region.Equals("Michigan", StringComparison.OrdinalIgnoreCase))) zoneId = "America/Detroit";
            var country = string.IsNullOrWhiteSpace(input.Country) ? "US" : input.Country.Trim();
            var candidate = new FacilityIdentity.Candidate(name, address, city, region, postalCode, country);
            var matches = await FacilityIdentity.Find(db, candidate);
            venue = null;
            if (matches.Count != 0)
            {
                var options = await FacilityIdentity.Describe(db, matches, false, s.OrganizerId, false);
                // Existing API clients may submit identical facility details again. Only reuse a single visible
                // record when every supplied field matches. No identifying detail is changed.
                var exact = matches.Count == 1 ? matches[0].Venue : null;
                if (exact != null && exact.Name == name && exact.Address == address && exact.City == city &&
                    exact.Region == region && exact.PostalCode == postalCode && exact.Country == country &&
                    exact.TimeZone == zoneId && options.Matches.Any(option => option.Id == exact.Id))
                    venue = await db.PickupVenues.FindAsync(exact.Id);
                if (venue == null) return new("venue", options.Message, options);
            }
            venue ??= new PickupVenue { Name = name, Address = address, City = city, Region = region,
                PostalCode = postalCode, Country = country, TimeZone = zoneId, IdentityKey = FacilityIdentity.Key(candidate) };
        }

        if (!TryZone(venue.TimeZone, out var zone, out _)) return new("timeZone", "This facility needs a valid time zone.");
        var now = DateTimeOffset.UtcNow;
        DateTimeOffset start;
        if (input.StartNow && s.StartsUtc == default) start = now;
        else if (s.StartsUtc != default && TimeZoneInfo.ConvertTime(s.StartsUtc, zone).ToString("yyyy-MM-dd'T'HH:mm",
            CultureInfo.InvariantCulture) == input.Start) start = s.StartsUtc;
        else if (!TryLocalTime(input.Start, zone, out start) || start <= now)
            return new("start", "Choose an unambiguous future start time, or use Start Now.");

        DateTimeOffset end;
        if (input.DurationMinutes is null && !string.IsNullOrWhiteSpace(input.End))
        {
            if (!TryLocalTime(input.End, zone, out end) || end <= start)
                return new("duration", "End time must be after the start time.");
        }
        else
        {
            var minutes = input.DurationMinutes ?? 120;
            if (minutes < 1 || minutes > (DateTimeOffset.MaxValue - start).TotalMinutes)
                return new("duration", "Enter a positive duration that fits on the calendar.");
            end = start.AddMinutes(minutes);
        }
        if (end <= now) return new("duration", "End time must be in the future.");

        var deadline = (input.LateJoinUntilEnd ?? (s.StartsUtc == default || input.StartNow)) ? end : start;
        if (!string.IsNullOrWhiteSpace(input.Deadline) &&
            (!TryLocalTime(input.Deadline, zone, out deadline) || deadline > start))
            return new("deadline", "Choose a registration deadline no later than the start, or allow late joining.");

        s.Venue = venue;
        s.Name = string.IsNullOrWhiteSpace(input.Name) ? input.Sport + " Pickup" : input.Name.Trim();
        s.Sport = input.Sport;
        s.Description = input.Description?.Trim();
        s.Skill = input.Skill?.Trim();
        s.OrganizerNotes = input.OrganizerNotes?.Trim();
        s.StartsUtc = start;
        s.EndsUtc = end;
        s.DeadlineUtc = deadline;
        s.LocalDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(start, zone).DateTime);
        s.Capacity = input.Capacity;
        s.Visibility = input.Visibility;
        s.ApprovalRequired = input.ApprovalRequired;
        return null;
    }

    private static IQueryable<PickupVenue> AvailableVenues(DataContext db, int account) =>
        db.PickupVenues.Where(v => db.FacilityProfiles.Any(p => p.VenueId == v.Id) ||
            db.EventFacilities.Any(e => e.VenueId == v.Id && e.PublicListing) || db.PickupSessions.Any(s => s.VenueId == v.Id &&
            (s.OrganizerId == account || (s.Visibility == SessionVisibility.Public &&
                s.State != SessionState.Draft && s.State != SessionState.Cancelled))));

    private static bool TryZone(string value, out TimeZoneInfo zone, out string zoneId)
    {
        zoneId = TimeZoneInfo.TryConvertWindowsIdToIanaId(value, out var iana) ? iana : value;
        return TimeZoneInfo.TryFindSystemTimeZoneById(zoneId ?? "", out zone);
    }

    private static bool TryLocalTime(string value, TimeZoneInfo zone, out DateTimeOffset instant)
    {
        instant = default;
        if (!DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local) ||
            zone.IsInvalidTime(local) || zone.IsAmbiguousTime(local)) return false;
        instant = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, zone));
        return true;
    }

    public sealed record TokenInput([Required, StringLength(64)] string Token, bool Waitlist = false);
    public sealed record GuestInput([Required, StringLength(100)] string Name, [Required, EmailAddress, StringLength(254)] string Email);
    public sealed record DecisionInput(bool Approve);
    public sealed record SessionInput(
        [StringLength(100)] string Name, [Required, StringLength(40)] string Sport,
        [StringLength(100)] string Venue, [StringLength(140)] string Address,
        [StringLength(80)] string City, [StringLength(50)] string Region,
        [StringLength(16)] string PostalCode, [StringLength(50)] string Country,
        [StringLength(80)] string TimeZone, [StringLength(16)] string Start,
        [StringLength(16)] string End, [StringLength(16)] string Deadline,
        [StringLength(1200)] string Description, [StringLength(40)] string Skill,
        [StringLength(700)] string OrganizerNotes, int? Capacity, SessionVisibility Visibility, bool ApprovalRequired,
        int? VenueId = null, int? DurationMinutes = null, bool StartNow = false, bool? LateJoinUntilEnd = null);
}

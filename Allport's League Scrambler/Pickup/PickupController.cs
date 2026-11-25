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
public sealed class PickupController(TransactionalMail mail) : ControllerBase
{
    private static readonly string[] Sports = ["Wallyball", "Volleyball", "Basketball", "Pickleball", "Soccer", "Other"];

    [HttpGet("catalog")]
    public IActionResult Catalog()
    {
        if (!PickupEnvironment.Requested) return NotFound();
        if (PickupEnvironment.DisposableTest) Response.Headers["X-Pickup-Test-Database"] = "LeagueScramblerPickupTest";
        return Ok(Sports);
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> Discover(string sport, string location, DateOnly? date, bool available, string skill, int page = 0)
    {
        if (!PickupEnvironment.Requested) return NotFound();
        if (page is < 0 or > 200 || location?.Length > 80 || skill?.Length > 40 || sport?.Length > 40) return BadRequest();
        await using var db = new DataContext();
        var now = DateTimeOffset.UtcNow;
        var sessions = db.PickupSessions.AsNoTracking().Include(s => s.Venue)
            .Where(s => s.Visibility == SessionVisibility.Public && s.State == SessionState.Published && s.StartsUtc > now);
        if (!string.IsNullOrWhiteSpace(location))
        {
            var value = location.Trim();
            sessions = sessions.Where(s => s.Venue.City.Contains(value) || s.Venue.PostalCode.StartsWith(value));
        }
        if (!string.IsNullOrWhiteSpace(sport)) sessions = sessions.Where(s => s.Sport == sport);
        if (!string.IsNullOrWhiteSpace(skill)) sessions = sessions.Where(s => s.Skill == skill);
        if (date is { } day) sessions = sessions.Where(s => s.LocalDate == day);
        if (available) sessions = sessions.Where(s => (s.DeadlineUtc == null || s.DeadlineUtc > now) &&
            db.PickupRegistrations.Count(r => r.SessionId == s.Id && r.State == RegistrationState.Confirmed) < s.Capacity);
        var result = await Cards(db, sessions.OrderBy(s => s.StartsUtc).ThenBy(s => s.Id).Skip(page * 12).Take(13));
        return Ok(new { sessions = result.Take(12), hasMore = result.Count > 12 });
    }

    [Authorize, HttpGet("mine")]
    public async Task<IActionResult> Mine()
    {
        if (!PickupEnvironment.Requested) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        await using var db = new DataContext();
        return Ok(await Cards(db, db.PickupSessions.AsNoTracking().Include(s => s.Venue)
            .Where(s => s.OrganizerId == account || db.PickupRegistrations.Any(r => r.SessionId == s.Id && r.AccountId == account))
            .OrderByDescending(s => s.StartsUtc).Take(100)));
    }

    [HttpGet("sessions/{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        if (!PickupEnvironment.Requested) return NotFound();
        await using var db = new DataContext();
        var session = await db.PickupSessions.AsNoTracking().Include(s => s.Venue).SingleOrDefaultAsync(s => s.Id == id);
        if (!CanRead(session)) return NotFound();
        var owner = IsOwner(session);
        var registrations = owner ? await db.PickupRegistrations.AsNoTracking().Where(r => r.SessionId == id &&
            (r.State == RegistrationState.Confirmed || r.State == RegistrationState.PendingApproval))
            .Select(r => new { r.Id, r.Name, r.State }).ToListAsync() : null;
        var mine = await FindRegistration(db, id);
        var organizer = await db.Users.Where(u => u.UserId == session.OrganizerId)
            .Select(u => u.FirstName + " " + u.LastName).SingleAsync();
        return Ok(new {
            session.Id, session.Name, session.Sport, session.Venue, session.StartsUtc, session.EndsUtc, session.DeadlineUtc,
            session.LocalDate, session.Description, session.Skill, session.Capacity, session.Visibility, session.State,
            session.ApprovalRequired, organizer, owner,
            organizerNotes = owner ? session.OrganizerNotes : null,
            confirmed = await Confirmed(db, id),
            registrationOpen = RegistrationOpen(session),
            registration = mine?.State,
            registrations
        });
    }

    [Authorize, SameOrigin, HttpPost("sessions")]
    public async Task<IActionResult> Create(SessionInput input)
    {
        if (!PickupEnvironment.Requested) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        await using var db = new DataContext();
        var session = new PickupSession { Id = Guid.NewGuid(), OrganizerId = account, State = SessionState.Published };
        var error = await Apply(db, session, input);
        if (error != null) return Invalid(error);
        db.PickupSessions.Add(session);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = session.Id }, new { session.Id });
    }

    [Authorize, SameOrigin, HttpPut("sessions/{id:guid}")]
    public Task<IActionResult> Edit(Guid id, SessionInput input) => WithSession(id, async (db, session) =>
    {
        if (!IsOwner(session)) return NotFound();
        if (session.State != SessionState.Published) return ConflictMessage("This session can no longer be edited.");
        if (input.Capacity < await Confirmed(db, id)) return ConflictMessage("Capacity cannot be lower than the confirmed registrations.");
        var error = await Apply(db, session, input);
        return error == null ? NoContent() : Invalid(error);
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
    public Task<IActionResult> Join(Guid id) => WithSession(id, async (db, session) =>
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
        if (row?.State is RegistrationState.Confirmed or RegistrationState.PendingApproval) return Ok(new { registration = row.State });
        if (row?.State == RegistrationState.Declined) return ConflictMessage("This registration was declined.");
        if (await CannotJoin(db, session) is { } blocked) return blocked;
        if (row == null)
        {
            var player = await db.UsersPlayer.Where(p => p.UserId == account).OrderBy(p => p.UsersPlayerId)
                .Select(p => (int?)p.PlayerId).FirstOrDefaultAsync();
            row = new PickupRegistration { Id = Guid.NewGuid(), SessionId = id, AccountId = account, PlayerId = player,
                EmailKey = key, Name = (user.FirstName + " " + user.LastName).Trim(), CreatedUtc = DateTimeOffset.UtcNow };
            db.PickupRegistrations.Add(row);
        }
        row.State = JoiningState(session);
        return Ok(new { registration = row.State });
    });

    [SameOrigin, EnableRateLimiting("pickup-guest"), HttpPost("sessions/{id:guid}/guest")]
    public async Task<IActionResult> Guest(Guid id, GuestInput input)
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
            if (row?.VerifiedUtc == null && await CannotJoin(db, session) is { } blocked) return blocked;
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
                   "/pickup/" + id + "#verify=" + token };
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
                if (await CannotJoin(db, session) is { } blocked) return blocked;
                row.State = JoiningState(session);
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
        if (!CanRead(session)) return NotFound();
        var row = await FindRegistration(db, id);
        if (row == null) return NotFound();
        if (session.EndsUtc <= DateTimeOffset.UtcNow || session.State == SessionState.Completed)
            return ConflictMessage("Past registrations are preserved.");
        if (row.State is RegistrationState.Confirmed or RegistrationState.PendingApproval) row.State = RegistrationState.Cancelled;
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
        return NoContent();
    });

    private async Task<IActionResult> WithSession(Guid id, Func<DataContext, PickupSession, Task<IActionResult>> work)
    {
        if (!PickupEnvironment.Requested) return NotFound();
        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        var resource = "pickup-session:" + id;
        try
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @result int;
            EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=5000;
            IF @result < 0 THROW 51020, 'Pickup session lock unavailable', 1;
            """);
        }
        catch (SqlException error) when (error.Number is 51020 or 1205)
        { return ConflictMessage("The session is busy. Try again."); }
        var session = await db.PickupSessions.SingleOrDefaultAsync(s => s.Id == id);
        if (session == null) return NotFound();
        var result = await work(db, session);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return result;
    }

    private bool IsOwner(PickupSession s) => LeagueAccess.TryGetAccountId(User, out var account) && account == s.OrganizerId;
    private bool CanRead(PickupSession s) => s != null && (IsOwner(s) ||
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

    private static int MaximumRosterSize => 100;
    private static Task<int> Confirmed(DataContext db, Guid id) => db.PickupRegistrations.CountAsync(r =>
        r.SessionId == id && r.State == RegistrationState.Confirmed);
    private static bool RegistrationOpen(PickupSession s) => s.State == SessionState.Published &&
        s.StartsUtc > DateTimeOffset.UtcNow && (s.DeadlineUtc == null || s.DeadlineUtc > DateTimeOffset.UtcNow);
    private async Task<IActionResult> CannotJoin(DataContext db, PickupSession s) =>
        !RegistrationOpen(s) ? ConflictMessage("Registration is closed for this session.") :
        await Confirmed(db, s.Id) >= s.Capacity ? ConflictMessage("This session is full.") : null;
    private static RegistrationState JoiningState(PickupSession s) =>
        s.ApprovalRequired ? RegistrationState.PendingApproval : RegistrationState.Confirmed;
    private static string CookieName(Guid id) => "pickup-guest-" + id.ToString("N");
    private static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private static bool ValidToken(string token) => token?.Length == 64 && token.All(Uri.IsHexDigit);
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static string EmailKey(string value) => Hash(value.Trim().ToUpperInvariant());
    private IActionResult Invalid(string message) => BadRequest(new { message });
    private IActionResult ConflictMessage(string message) => Conflict(new { message });

    private static async Task<string> Apply(DataContext db, PickupSession s, SessionInput input)
    {
        if (!Sports.Contains(input.Sport) || input.Capacity < 2 || input.Capacity > MaximumRosterSize ||
            !Enum.IsDefined(input.Visibility) || string.IsNullOrWhiteSpace(input.Name) ||
            !new[] { input.Venue, input.Address, input.City, input.Region, input.PostalCode, input.Country }.All(value => !string.IsNullOrWhiteSpace(value)))
            return "Enter a session name, sport, facility address, visibility, and a capacity of 2 to 100.";
        try
        {
            var zoneId = TimeZoneInfo.TryConvertWindowsIdToIanaId(input.TimeZone, out var iana) ? iana : input.TimeZone;
            var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
            var start = LocalTime(input.Start, zone);
            var end = LocalTime(input.End, zone);
            var deadline = string.IsNullOrWhiteSpace(input.Deadline) ? (DateTimeOffset?)null : LocalTime(input.Deadline, zone);
            if (start <= DateTimeOffset.UtcNow || end <= start || deadline > start)
                return "Choose a future start, an end after the start, and a deadline no later than the start.";
            var venue = await db.PickupVenues.FirstOrDefaultAsync(v => v.Name == input.Venue && v.Address == input.Address &&
                v.City == input.City && v.Region == input.Region && v.PostalCode == input.PostalCode &&
                v.Country == input.Country && v.TimeZone == zoneId);
            s.Venue = venue ?? new PickupVenue { Name = input.Venue, Address = input.Address, City = input.City,
                Region = input.Region, PostalCode = input.PostalCode, Country = input.Country, TimeZone = zoneId };
            s.Name = input.Name.Trim(); s.Sport = input.Sport; s.Description = input.Description?.Trim();
            s.Skill = input.Skill?.Trim(); s.OrganizerNotes = input.OrganizerNotes?.Trim();
            s.StartsUtc = start; s.EndsUtc = end; s.DeadlineUtc = deadline;
            s.LocalDate = DateOnly.ParseExact(input.Start[..10], "yyyy-MM-dd", CultureInfo.InvariantCulture);
            s.Capacity = input.Capacity; s.Visibility = input.Visibility; s.ApprovalRequired = input.ApprovalRequired;
            return null;
        }
        catch (Exception error) when (error is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException or FormatException)
        { return "Use a valid venue time zone and an unambiguous local start, end and deadline."; }
    }

    private static DateTimeOffset LocalTime(string value, TimeZoneInfo zone)
    {
        if (!DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local) ||
            zone.IsInvalidTime(local) || zone.IsAmbiguousTime(local)) throw new FormatException();
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, zone));
    }

    public sealed record TokenInput([Required, StringLength(64)] string Token);
    public sealed record GuestInput([Required, StringLength(100)] string Name, [Required, EmailAddress, StringLength(254)] string Email);
    public sealed record DecisionInput(bool Approve);
    public sealed record SessionInput(
        [Required, StringLength(100)] string Name, [Required, StringLength(40)] string Sport,
        [Required, StringLength(100)] string Venue, [Required, StringLength(140)] string Address,
        [Required, StringLength(80)] string City, [Required, StringLength(50)] string Region,
        [Required, StringLength(16)] string PostalCode, [Required, StringLength(50)] string Country,
        [Required, StringLength(80)] string TimeZone, [Required, StringLength(16)] string Start,
        [Required, StringLength(16)] string End, [StringLength(16)] string Deadline,
        [StringLength(1200)] string Description, [StringLength(40)] string Skill,
        [StringLength(700)] string OrganizerNotes, int Capacity, SessionVisibility Visibility, bool ApprovalRequired);
}

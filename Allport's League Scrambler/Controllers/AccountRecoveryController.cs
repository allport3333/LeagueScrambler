using System;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Allport_s_League_Scrambler.Controllers;

[ApiController]
[Route("api/account-recovery")]
public sealed class AccountRecoveryController(Services.TransactionalMail transport, IMemoryCache cache, ILogger<AccountRecoveryController> logger) : ControllerBase
{
    private static readonly object RateLock = new();

    public sealed record Submission(string Email, string Password, int? PlayerId, string Information);
    public sealed record Verification(Guid Id, string Code);
    public sealed record Decision(bool Approve, string DecisionNotes, bool IndependentlyVerified, string IndependentProof = null);

    [Authorize]
    [SameOrigin]
    [HttpPost("email-change")]
    public async Task<IActionResult> BeginEmailChange(Submission input)
    {
        if (!LeagueAccess.TryGetAccountId(User, out var userId)) return Unauthorized();
        if (!Allow("email-change", 5)) return StatusCode(429);
        var email = NormalizeEmail(input.Email);
        if (email == null || string.IsNullOrEmpty(input.Password) || input.Password.Length > 1024)
            return BadRequest("Enter a valid contact email and your current password.");
        using var context = new DataContext();
        var user = await context.Users.SingleOrDefaultAsync(u => u.UserId == userId);
        if (!CurrentSession(user) || user.PasswordHash == null || user.PasswordSalt == null || user.PasswordSalt.Length < 8 ||
            !CryptographicOperations.FixedTimeEquals(user.PasswordHash,
                Rfc2898DeriveBytes.Pbkdf2(input.Password, user.PasswordSalt, 10000, HashAlgorithmName.SHA1, 32)))
            return BadRequest("The current password could not be verified.");
        return await Issue(user.UserId, user.SessionVersion, email, null, null);
    }

    [AllowAnonymous]
    [HttpGet("profiles")]
    public async Task<IActionResult> FindProfiles([FromQuery] string search, [FromQuery] int page = 0)
    {
        if (!Allow("profile-search", 60)) return StatusCode(429);
        var term = search?.Trim() ?? "";
        if (term.Length > 200 || term.Count(char.IsLetterOrDigit) < 2 || page is < 0 or > 19) return BadRequest();
        var aborted = HttpContext.RequestAborted;
        using var context = new DataContext();
        try
        {
            var eligible = Services.RecoveryEligibility.Accounts(context);
            var matches = Services.ProfileSearch.Match(context, term)
                .Where(player => eligible.Any(link => link.PlayerId == player.Id));
            var players = await Services.ProfileSearch.Results(context, matches)
                .Skip(page * 30).Take(31).ToListAsync(aborted);
            return Ok(new { players = players.Take(30), hasMore = page < 19 && players.Count > 30 });
        }
        catch (OperationCanceledException) when (aborted.IsCancellationRequested)
        {
            return new EmptyResult();
        }
        catch (SqlException error)
        {
            logger.LogWarning("Recovery profile search failed (SQL error {Number}).", error.Number);
            return Problem(statusCode: 503, title: "Player search is temporarily unavailable.");
        }
    }

    [SameOrigin]
    [HttpPost("request")]
    public async Task<IActionResult> RequestRecovery(Submission input)
    {
        if (!Allow("request", 5)) return StatusCode(429);
        var email = NormalizeEmail(input.Email);
        var information = input.Information?.Trim();
        if (email == null || input.PlayerId is null or <= 0 || information == null || information.Length is 0 or > 1000)
            return BadRequest("Select your player profile and enter a contact email and information for the reviewer.");
        if (Services.RecoveryCode.Key() == null) return StatusCode(503, "Email verification is temporarily unavailable.");
        using var context = new DataContext();
        if (!await context.Players.AnyAsync(player => player.Id == input.PlayerId, HttpContext.RequestAborted))
            return NotFound("That player profile is no longer available. Choose another profile.");
        var matches = await (from link in Services.RecoveryEligibility.Accounts(context)
                             join user in context.Users on link.UserId equals user.UserId
                             where link.PlayerId == input.PlayerId
                             select new { user.UserId, user.SessionVersion }).SingleOrDefaultAsync(HttpContext.RequestAborted);
        if (matches == null) return Accepted(new { id = Guid.NewGuid() });
        return await Issue(matches.UserId, matches.SessionVersion, email, input.PlayerId, information);
    }

    private async Task<IActionResult> Issue(int userId, int version, string email, int? playerId, string information)
    {
        var id = Guid.NewGuid();
        var key = Services.RecoveryCode.Key();
        if (key == null) return StatusCode(503, "Email verification is temporarily unavailable.");
        var (code, hash) = Services.RecoveryCode.Create(id, key);
        var now = DateTime.UtcNow;
        try
        {
            using var context = new DataContext();
            using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            if (playerId.HasValue && !await Services.RecoveryEligibility.Accounts(context)
                .AnyAsync(link => link.PlayerId == playerId && link.UserId == userId &&
                    link.User.SessionVersion == version, HttpContext.RequestAborted))
                return Accepted(new { id });
            var since = now.AddHours(-1);
            var purgeBefore = now.AddDays(-30);
            await context.AccountRecoveryRequests.Where(r => r.UserId == userId && r.ExpiresUtc < purgeBefore && r.DecidedUtc == null)
                .ExecuteUpdateAsync(update => update.SetProperty(r => r.ReviewInformation, (string)null).SetProperty(r => r.TokenHash, (string)null));
            if (await context.AccountRecoveryRequests.CountAsync(r => r.CreatedUtc >= since &&
                (r.UserId == userId || r.ContactEmail == email)) >= 3)
                return Accepted(new { id });
            context.AccountRecoveryRequests.Add(new AccountRecoveryRequest
            {
                Id = id, UserId = userId, PlayerId = playerId, AccountVersion = version, ContactEmail = email,
                ReviewInformation = information, TokenHash = hash, CreatedUtc = now, ExpiresUtc = now.AddHours(1)
            });
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception error) when (IsConflict(error))
        {
            return Accepted(new { id });
        }
        if (!await SendCode(email, playerId.HasValue, code))
        {
            try
            {
                using var context = new DataContext();
                await context.AccountRecoveryRequests.Where(r => r.Id == id && r.TokenHash == hash && r.VerifiedUtc == null)
                    .ExecuteDeleteAsync();
            }
            catch (Exception error) when (error is SqlException or DbUpdateException)
            {
                logger.LogWarning("Could not clear an undelivered verification request ({CorrelationId}).", HttpContext.TraceIdentifier);
            }
            if (!playerId.HasValue) return StatusCode(503, "Could not send the verification code. Try again later.");
        }
        return Accepted(new { id });
    }

    public sealed record ResendRequest(Guid Id);

    [SameOrigin]
    [HttpPost("resend")]
    public async Task<IActionResult> Resend(ResendRequest input)
    {
        if (input.Id == Guid.Empty) return BadRequest();
        if (!Allow("resend", 5) || !Allow("resend-" + input.Id, 3)) return StatusCode(429);
        var key = Services.RecoveryCode.Key();
        if (key == null) return StatusCode(503, "Email verification is temporarily unavailable.");
        using var context = new DataContext();
        var request = await context.AccountRecoveryRequests.AsNoTracking().SingleOrDefaultAsync(r => r.Id == input.Id);
        var now = DateTime.UtcNow;
        if (request?.TokenHash == null || request.VerifiedUtc.HasValue || request.DecidedUtc.HasValue ||
            request.CreatedUtc < now.AddDays(-1)) return Accepted(new { id = input.Id });

        var user = await context.Users.FindAsync(request.UserId);
        if (user == null || user.SessionVersion != request.AccountVersion) return Accepted(new { id = input.Id });
        if (!request.PlayerId.HasValue && !CurrentSession(user)) return Unauthorized();
        if (request.PlayerId.HasValue && !await Services.RecoveryEligibility.Accounts(context)
            .AnyAsync(link => link.PlayerId == request.PlayerId && link.UserId == request.UserId))
            return Accepted(new { id = input.Id });
        if (request.ExpiresUtc > now.AddMinutes(59)) return Accepted(new { id = input.Id });

        var (code, hash) = Services.RecoveryCode.Create(input.Id, key, request.TokenHash);
        var pending = context.AccountRecoveryRequests.Where(r => r.Id == input.Id && r.VerifiedUtc == null && r.DecidedUtc == null);
        var changed = await pending.Where(r => r.TokenHash == request.TokenHash).ExecuteUpdateAsync(update =>
            update.SetProperty(r => r.TokenHash, hash).SetProperty(r => r.ExpiresUtc, now.AddHours(1)));
        if (changed == 1 && !await SendCode(request.ContactEmail, request.PlayerId.HasValue, code))
        {
            try
            {
                await pending.Where(r => r.TokenHash == hash).ExecuteUpdateAsync(update =>
                    update.SetProperty(r => r.TokenHash, request.TokenHash).SetProperty(r => r.ExpiresUtc, request.ExpiresUtc));
            }
            catch (Exception error) when (error is SqlException or DbUpdateException)
            {
                logger.LogWarning("Could not restore the prior verification request ({CorrelationId}).", HttpContext.TraceIdentifier);
            }
            if (!request.PlayerId.HasValue) return StatusCode(503, "Could not resend the verification code. Try again later.");
        }
        return Accepted(new { id = input.Id });
    }

    private Task<bool> SendCode(string email, bool recovering, string code) =>
        Send(Services.AccountEmail.Verification(email, recovering, code));

    [SameOrigin]
    [HttpPost("verify")]
    public async Task<IActionResult> Verify(Verification input)
    {
        if (!Allow("verify", 20)) return StatusCode(429);
        var code = input.Code?.Trim().Replace(" ", "");
        if (code?.Length is not (8 or 64)) return BadRequest("The verification code is invalid or expired.");
        string previousEmail = null;
        bool emailChanged;
        try
        {
            using var context = new DataContext();
            using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var request = await context.AccountRecoveryRequests.FindAsync(input.Id);
            var now = DateTime.UtcNow;
            if (request?.TokenHash == null || request.ExpiresUtc <= now || request.DecidedUtc != null)
                return BadRequest("The verification code is invalid or expired.");
            var user = await context.Users.FindAsync(request.UserId);
            if (user == null || user.SessionVersion != request.AccountVersion) return Conflict("The account has changed.");
            emailChanged = request.PlayerId == null;
            if (!emailChanged && !await Services.RecoveryEligibility.Accounts(context)
                .AnyAsync(link => link.PlayerId == request.PlayerId && link.UserId == request.UserId))
                return Conflict("The account association has changed.");
            if (emailChanged && !CurrentSession(user)) return Unauthorized();
            if (!Services.RecoveryCode.Verify(request.Id, request.TokenHash, code, out var failedHash))
            {
                if (failedHash != request.TokenHash)
                {
                    request.TokenHash = failedHash;
                    await context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                return BadRequest("The verification code is invalid or expired. Request a new code if needed.");
            }
            if (emailChanged)
            {
                if (await EmailUnavailable(context, user, request.ContactEmail)) return Conflict("That contact email cannot be used.");
                previousEmail = ApplyEmail(user, request.ContactEmail);
                request.Approved = true;
                request.DecidedUtc = now;
            }
            else request.ExpiresUtc = now.AddDays(7);
            request.VerifiedUtc = now;
            request.TokenHash = null;
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception error) when (IsConflict(error)) { return Conflict("The request changed. Try again."); }

        if (previousEmail != null)
            await Send(previousEmail, "League Hub email changed", "The email for your League Hub account was changed.");
        return Ok(new { emailChanged });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("review")]
    public async Task<IActionResult> Review([FromQuery] int page = 0, [FromQuery] string status = "pending")
    {
        Response.Headers.CacheControl = "no-store";
        if (page is < 0 or > 10000) return BadRequest();
        using var context = new DataContext();
        var now = DateTime.UtcNow;
        var query = context.AccountRecoveryRequests.AsNoTracking().Where(r => r.PlayerId != null && r.VerifiedUtc != null);
        query = status switch
        {
            "pending" => query.Where(r => r.DecidedUtc == null && r.ExpiresUtc > now),
            "approved" => query.Where(r => r.DecidedUtc != null && r.Approved),
            "rejected" => query.Where(r => r.DecidedUtc != null && !r.Approved),
            "expired" => query.Where(r => r.DecidedUtc == null && r.ExpiresUtc <= now),
            _ => null
        };
        if (query == null) return BadRequest();
        var rows = await query.OrderByDescending(r => r.CreatedUtc).ThenByDescending(r => r.Id)
            .Skip(page * 30).Take(31)
            .Select(r => new { r.Id, r.UserId, r.PlayerId, r.ContactEmail, r.VerifiedUtc,
                r.CreatedUtc, r.ReviewInformation, r.ExpiresUtc, r.DecidedUtc, r.ReviewerId, r.ReviewDecision, r.Approved,
                independentlyVerified = r.Approved && r.ReviewerId.HasValue,
                playerName = context.Players.Where(p => p.Id == r.PlayerId)
                    .Select(p => p.FirstName + " " + p.LastName).FirstOrDefault() })
            .ToListAsync(HttpContext.RequestAborted);
        return Ok(new { requests = rows.Take(30), hasMore = rows.Count > 30 });
    }
    [Authorize(Roles = "Admin")]
    [SameOrigin]
    [HttpPost("review/{id:guid}")]
    public async Task<IActionResult> Decide(Guid id, Decision input)
    {
        if (!Allow("decide", 30)) return StatusCode(429);
        if (!LeagueAccess.TryGetAccountId(User, out var reviewerId)) return Unauthorized();
        var notes = (input.DecisionNotes ?? input.IndependentProof)?.Trim();
        if (notes?.Length > 1000) return BadRequest("Decision notes must be 1,000 characters or fewer.");
        if (input.Approve && !input.IndependentlyVerified)
            return BadRequest("Confirm independent ownership verification before approving recovery.");
        string previousEmail = null;
        string newEmail;
        try
        {
            using var context = new DataContext();
            using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var reviewer = await context.Users.FindAsync(reviewerId);
            if (!CurrentSession(reviewer) || reviewer.UserRoleId != 1) return Forbid();
            var request = await context.AccountRecoveryRequests.FindAsync(id);
            var now = DateTime.UtcNow;
            if (request?.PlayerId == null || request.VerifiedUtc == null || request.DecidedUtc != null ||
                request.ExpiresUtc <= now || request.UserId == reviewerId) return Conflict("This request cannot be reviewed.");
            if (input.Approve)
            {
                var user = await context.Users.FindAsync(request.UserId);
                if (user == null || user.SessionVersion != request.AccountVersion ||
                    !await Services.RecoveryEligibility.Accounts(context).AnyAsync(link => link.PlayerId == request.PlayerId && link.UserId == user.UserId))
                    return Conflict("The account association has changed.");
                if (await EmailUnavailable(context, user, request.ContactEmail)) return Conflict("That contact email cannot be used.");
                previousEmail = ApplyEmail(user, request.ContactEmail);
                var inaccessiblePassword = new RegistrationModel { Password = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)) }.ToUser();
                user.PasswordHash = inaccessiblePassword.PasswordHash;
                user.PasswordSalt = inaccessiblePassword.PasswordSalt;
            }
            newEmail = request.ContactEmail;
            request.Approved = input.Approve;
            request.ReviewerId = reviewerId;
            request.ReviewDecision = string.IsNullOrEmpty(notes) ? null : notes;
            request.DecidedUtc = now;
            request.ReviewInformation = null;
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception error) when (IsConflict(error)) { return Conflict("The request changed. Try again."); }

        logger.LogInformation("Recovery decision recorded: request {RequestId}, reviewer {ReviewerId}, approved {Approved}, independent ownership attested {Attested}.",
            id, reviewerId, input.Approve, input.Approve && input.IndependentlyVerified);
        if (previousEmail != null)
        {
            await Send(previousEmail, "League Hub account recovery", "An administrator approved an email change for your account.");
            await Send(newEmail, "League Hub recovery approved", "Use Forgot Password with this email to set a new password.");
        }
        else
        {
            await Send(newEmail, "League Hub recovery decision", "Your recovery request was declined. No changes were made.");
        }
        return Ok();
    }

    private bool CurrentSession(User user) => user != null &&
        LeagueAccess.TryGetAccountId(User, out var userId) && user.UserId == userId &&
        (User.FindFirstValue("SessionVersion") ?? "0") == user.SessionVersion.ToString(CultureInfo.InvariantCulture);

    private static Task<bool> EmailUnavailable(DataContext context, User user, string email) =>
        string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase) ? Task.FromResult(true) :
        context.Users.AnyAsync(account => account.Email.ToUpper() == email.ToUpper());

    private static string ApplyEmail(User user, string email)
    {
        var previousEmail = user.Email;
        user.Email = email;
        user.SessionVersion = checked(user.SessionVersion + 1);
        user.ResetToken = null;
        return previousEmail;
    }

    private bool Allow(string action, int maximum)
    {
        var key = ("account-recovery", action, HttpContext.Connection.RemoteIpAddress?.ToString());
        lock (RateLock)
        {
            var counter = cache.Get<int[]>(key);
            if (counter == null)
            {
                counter = new int[1];
                cache.Set(key, counter, TimeSpan.FromMinutes(10));
            }
            if (counter[0] >= maximum) return false;
            counter[0]++;
            return true;
        }
    }

    private static bool IsConflict(Exception error) =>
        (error as SqlException ?? error.InnerException as SqlException)?.Number is 1205 or 2601 or 2627;


    private static string NormalizeEmail(string email)
    {
        email = email?.Trim();
        return email?.Length <= 254 && MailAddress.TryCreate(email, out var parsed) && parsed.Address == email ? email : null;
    }

    private Task<bool> Send(string address, string subject, string message) =>
        Send(Services.AccountEmail.Create(address, subject, subject, message, "",
            "If you did not expect this notice, contact League Hub support."));

    private async Task<bool> Send(MailMessage mail)
    {
        using (mail)
        {
            try
            {
                await transport.Send(mail, mail.Subject, HttpContext.TraceIdentifier);
                return true;
            }
            catch (Exception error) when (error is SmtpException or InvalidOperationException or FormatException or OperationCanceledException)
            {
                return false;
            }
        }
    }
}

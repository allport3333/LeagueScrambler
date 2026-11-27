using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Net.Mail;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Text;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Allport_s_League_Scrambler.Controllers
{
    public class ForgotPasswordRequest
    {
        public string Email { get; set; }
    }

    public class ResetPasswordRequest
    {
        public string Password { get; set; }
        public string Token { get; set; }
    }
    [Route("api/[controller]")]
    public class LoginController : Controller
    {
        private readonly IConfiguration _config;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly TransactionalMail _mail;
        private readonly IMemoryCache _requestCache;
        private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _environment;

        public LoginController(IConfiguration config, IHttpContextAccessor httpContextAccessor, TransactionalMail mail, IMemoryCache requestCache, Microsoft.AspNetCore.Hosting.IWebHostEnvironment environment = null)
        {
            _config = config;
            _httpContextAccessor = httpContextAccessor;
            _mail = mail;
            _requestCache = requestCache;
            _environment = environment;
        }

        // Simple in-process limits for this legacy single-server application.
        // They expire automatically, require no schema change, and do not trust
        // user-supplied forwarding headers for client identity.
        private static readonly object RateCacheCreationLock = new object();

        private class RequestCounter
        {
            public int Count { get; set; }
        }

        private class RecoveryCooldown
        {
            public DateTimeOffset LastRequest { get; set; }
        }

        private const string RecoveryAcceptedMessage =
            "If an account exists for that email, a password reset link may arrive shortly.";

        private RequestCounter GetRateCounter(string scope)
        {
            var remoteAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            // MemoryCache.GetOrCreate is not an atomic factory under
            // concurrency. Serialize first use so all requests for one key
            // increment the same counter object.
            lock (RateCacheCreationLock)
            {
                return _requestCache.GetOrCreate("rate:" + scope + ":" + remoteAddress, entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);
                    return new RequestCounter();
                });
            }
        }

        private static bool TryUseRateSlot(RequestCounter counter, int maxRequests)
        {
            lock (counter)
            {
                if (counter.Count >= maxRequests)
                {
                    return false;
                }
                counter.Count++;
                return true;
            }
        }

        // Login attempts reserve a slot before password validation, then
        // release it on success. Previously a check and later increment were
        // separate operations, letting parallel requests bypass the limit.
        private static void ReleaseRateSlot(RequestCounter counter)
        {
            lock (counter)
            {
                if (counter.Count > 0)
                {
                    counter.Count--;
                }
            }
        }

        private RecoveryCooldown GetRecoveryCooldown(string email)
        {
            // Hash normalized email so address values are not kept in cache keys.
            string key;
            using (var sha = SHA256.Create())
            {
                var normalized = email.Trim().ToUpperInvariant();
                key = Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(normalized)));
            }
            lock (RateCacheCreationLock)
            {
                return _requestCache.GetOrCreate("recovery-address:" + key, entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
                    return new RecoveryCooldown();
                });
            }
        }

        [HttpPost("register")]
        [SameOrigin]
        public async Task<IActionResult> Register([FromBody] RegistrationModel registrationModel)
        {
            if (ModelState.IsValid)
            {
                await using var context = new DataContext();
                registrationModel.UserRoleId = 3;
                var user = registrationModel.ToUser();

                try
                {
                    await using var transaction = await context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
                    if (await context.Users.AnyAsync(existing => existing.Email == registrationModel.Email))
                        return BadRequest(new { message = "Email already in use." });

                    context.Users.Add(user);
                    await context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch (Microsoft.Data.SqlClient.SqlException error) when (error.Number == 1205)
                {
                    return Conflict(new { message = "Registration could not be completed. Please try again." });
                }
                catch (DbUpdateException error) when (error.InnerException is Microsoft.Data.SqlClient.SqlException sql &&
                    (sql.Number == 1205 || sql.Number == 2601 || sql.Number == 2627))
                {
                    return Conflict(new { message = "Registration could not be completed. Please try again." });
                }

                // The registration page immediately offers to claim or create a player.
                // Give this newly registered user an authenticated Player session so
                // those actions no longer need unsafe anonymous write permissions.
                var registrationClaims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, "Player"),
                    new Claim("FirstName", user.FirstName ?? ""),
                    new Claim("LastName", user.LastName ?? "")
                };
                var registrationIdentity = new ClaimsIdentity(
                    registrationClaims, CookieAuthenticationDefaults.AuthenticationScheme);
                await HttpContext.SignInAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme,
                    new ClaimsPrincipal(registrationIdentity),
                    new AuthenticationProperties { IsPersistent = false });

                return Ok(new { message = "Registration successful.", userId = user.UserId });
            }

            return BadRequest(new { message = "Invalid registration data." });
        }

        [HttpGet("GetLockSignInStatus/{leagueId}")]
        public async Task<IActionResult> GetLockSignInStatus(int leagueId)
        {
            using var context = new DataContext();
            var state = await LeagueAttendanceAvailability.Read(context, leagueId, AttendanceRules.EasternNow(DateTime.UtcNow));
            return Ok(state.Locked);
        }

        [HttpGet("LeagueAttendanceAvailability/{leagueId:int}")]
        public async Task<IActionResult> GetLeagueAttendanceAvailability(int leagueId)
        {
            using var context = new DataContext();
            if (!await context.Leagues.AnyAsync(league => league.ID == leagueId && league.EventTypeId != 2))
                return NotFound();
            return Ok(await LeagueAttendanceAvailability.Read(context, leagueId, AttendanceRules.EasternNow(DateTime.UtcNow)));
        }

        public class LockSignInRequest
        {
            public int LeagueId { get; set; }
            public bool? Locked { get; set; }
            public string Mode { get; set; }
        }

        [HttpPost("SetLockSignInStatus")]
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public async Task<IActionResult> SetLockSignInStatus([FromBody] LockSignInRequest request)
        {
            if (request == null || request.LeagueId <= 0)
                return BadRequest("Invalid league.");

            var mode = request.Mode ?? (request.Locked switch { true => "locked", false => "open", _ => null });
            if (mode is not ("automatic" or "open" or "locked"))
                return BadRequest("Invalid sign-in mode.");

            using var context = new DataContext();
            if (!LeagueAccess.CanManage(User, context, request.LeagueId))
                return Forbid();
            if (!await context.Leagues.AnyAsync(league => league.ID == request.LeagueId && league.EventTypeId != 2))
                return NotFound("League not found.");

            using var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable);
            var now = AttendanceRules.EasternNow(DateTime.UtcNow);
            await AttendanceSerialization.Acquire(context, request.LeagueId, now.Date);
            var current = await LeagueAttendanceAvailability.Read(context, request.LeagueId, now);
            var setting = await context.LeagueSettings.FirstOrDefaultAsync(s =>
                s.LeagueId == request.LeagueId && s.SettingName == LeagueAttendanceAvailability.SettingName);
            if (setting == null)
            {
                setting = new LeagueSettings { LeagueId = request.LeagueId, SettingName = LeagueAttendanceAvailability.SettingName };
                context.LeagueSettings.Add(setting);
            }
            setting.SettingValue = mode == "automatic" ? mode : current.Period + ":" + mode;
            await context.SaveChangesAsync();
            var updated = await LeagueAttendanceAvailability.Read(context, request.LeagueId, now);
            transaction.Commit();
            return request.Mode == null ? Ok(updated.Mode == "locked") : Ok(updated);
        }

        [HttpGet("isauthenticated")]
        public IActionResult IsAuthenticated()
        {
            // Check if the user is authenticated (based on the authentication cookie)
            if (User.Identity.IsAuthenticated)
            {
                return Ok(true); // Return true if authenticated
            }
            else
            {
                return Ok(false); // Return false if not authenticated
            }
        }

        [HttpGet("GetUsersRole")]
        public IActionResult GetUsersRole()
        {
            // Check if the user is authenticated
            if (User.Identity != null && User.Identity.IsAuthenticated)
            {
                // Retrieve the user's role from the claims
                var roleClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role);

                if (roleClaim != null)
                {
                    return Ok(new { isAuthenticated = true, role = roleClaim.Value }); // Return the role
                }
                else
                {
                    return Ok(new { isAuthenticated = true, role = "Unknown" }); // Default if no role claim exists
                }
            }
            else
            {
                return Unauthorized(new { isAuthenticated = false, role = "None" }); // Not authenticated
            }
        }

        public sealed class LeagueManagerRequest
        {
            public string Email { get; set; }
            public bool? Assigned { get; set; }
        }

        [HttpPut("LeagueManager/{leagueId:int}")]
        [Authorize(Roles = "Admin")]
        [SameOrigin]
        public async Task<IActionResult> SetLeagueManager(int leagueId, [FromBody] LeagueManagerRequest request)
        {
            var email = request?.Email?.Trim();
            if (leagueId <= 0 || string.IsNullOrWhiteSpace(email) || email.Length > 254 || request.Assigned == null)
                return BadRequest(new { message = "Select a league, an existing manager account, and an action." });

            await using var context = new DataContext();
            await using var transaction = await context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            if (!await context.Leagues.AnyAsync(league => league.ID == leagueId))
                return NotFound(new { message = "League not found." });

            var managerIds = await context.Users.Where(user => user.Email == email && user.UserRoleId == 2)
                .Select(user => user.UserId).Take(2).ToListAsync();
            if (managerIds.Count != 1)
                return NotFound(new { message = "Select an existing League Manager account." });

            var managerId = managerIds[0];
            var links = await context.UserLeagues.Where(link => link.UserId == managerId && link.LeagueTypeId == leagueId).ToListAsync();
            if (request.Assigned.Value && links.Count == 0)
                context.UserLeagues.Add(new UserLeague { UserId = managerId, LeagueTypeId = leagueId });
            if (!request.Assigned.Value)
                context.UserLeagues.RemoveRange(links);

            await context.SaveChangesAsync();
            await transaction.CommitAsync();
            return NoContent();
        }


        [HttpGet("GetUsersPlayer")]
        public IActionResult GetUsersPlayer()
        {
            try
            {
                // Get the current user's ID from the claims
                var userId = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { message = "User not authenticated." });
                }

                // Convert userId to integer
                if (!int.TryParse(userId, out int parsedUserId))
                {
                    return BadRequest(new { message = "Invalid user ID." });
                }

                using (var _context = new DataContext())
                {
                    // Fetch the UsersPlayer entry for the logged-in user
                    var usersPlayer = _context.UsersPlayer
                                              .Where(up => up.UserId == parsedUserId)
                                              .Select(up => new
                                              {
                                                  up.UsersPlayerId,
                                                  up.UserId,
                                                  up.PlayerId
                                              })
                                              .FirstOrDefault();

                    if (usersPlayer == null)
                    {
                        return NotFound(new { message = "No UsersPlayer record found for the user." });
                    }

                    // Return the found UsersPlayer record
                    return Ok(usersPlayer);
                }
            }
            catch (Exception ex)
            {
                // Log the exception and return an error response
                return StatusCode(500, new { message = "An error occurred.", error = ex.Message });
            }
        }

        [HttpGet("GetPlayerByPlayerId")]
        public IActionResult GetPlayerByPlayerId()
        {
            var _context = new DataContext();
            // Retrieve the User ID from claims
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;

            if (userIdClaim == null)
            {
                return Unauthorized("User is not logged in.");
            }

            int userId = int.Parse(userIdClaim);

            // Find the PlayerId linked to this User
            var userPlayer = _context.UsersPlayer.FirstOrDefault(up => up.UserId == userId);

            if (userPlayer == null)
            {
                return NotFound("No Player linked to this user.");
            }

            // Get the full Player details
            var player = _context.Players
                .Where(p => p.Id == userPlayer.PlayerId)
                .Select(p => new
                {
                    p.Id,
                    p.FirstName,
                    p.LastName,
                    p.IsMale,
                    p.Gender,
                    p.IsSub
                })
                .FirstOrDefault();

            if (player == null)
            {
                return NotFound("Player not found.");
            }

            return Ok(player);
        }

        [HttpGet("GetPlayerByPlayerIdVariable/{playerId}")]
        public IActionResult GetPlayerByPlayerIdVariable(int playerId)
        {
            var _context = new DataContext();

            // Get the full Player details
            var player = _context.Players
                .Where(p => p.Id == playerId)
                .Select(p => new
                {
                    p.Id,
                    p.FirstName,
                    p.LastName,
                    p.IsMale,
                    p.Gender,
                    p.IsSub
                })
                .FirstOrDefault();

            if (player == null)
            {
                return NotFound("Player not found.");
            }

            return Ok(player);
        }

        [HttpPost("login")]
        [SameOrigin]
        public async Task<IActionResult> Login([FromBody] LoginModel loginModel)
        {
            if (loginModel == null || !ModelState.IsValid ||
                string.IsNullOrWhiteSpace(loginModel.Email) ||
                string.IsNullOrEmpty(loginModel.Password))
            {
                return BadRequest(new { message = "Invalid login data" });
            }

            var loginAttempts = GetRateCounter("login");
            if (!TryUseRateSlot(loginAttempts, 12))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    new { message = "Too many login attempts. Try again later." });
            }

                var _context = new DataContext();
                var userInfo = await _context.Users.FirstOrDefaultAsync(u => u.Email == loginModel.Email);

                // The same message for unknown email and wrong password also
                // avoids revealing which email addresses have accounts.
                if (userInfo == null ||
                    !ValidatePassword(loginModel.Password, userInfo.PasswordHash, userInfo.PasswordSalt))
                {
                    // Keep the reserved slot for each failed login.
                    return BadRequest(new { message = "Invalid email or password." });
                }

                userInfo.LastLogin = DateTime.Now;
                await _context.SaveChangesAsync();
                await LeagueAccountCookie.SignIn(HttpContext, userInfo, loginModel.RememberMe);

                // Return only this successful request's reserved slot. Do not
                // erase failed guesses from other requests sharing the IP.
                ReleaseRateSlot(loginAttempts);

                // Return a success response
                return Ok(new { message = "Login successful" });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            if (User.Identity.IsAuthenticated)
            {
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            }

            // Logging out must also clear temporary administration privileges.
            Response.Cookies.Delete("access_token");
            return Ok(new { message = "Logout successful" });
        }

        // Function to validate password
        private bool ValidatePassword(string enteredPassword, byte[] storedPasswordHash, byte[] storedPasswordSalt)
        {
            if (enteredPassword == null || storedPasswordHash == null || storedPasswordHash.Length != 32 ||
                storedPasswordSalt == null || storedPasswordSalt.Length < 8) return false;
            // Preserve the existing UTF-8/PBKDF2-SHA1 account format exactly.
            byte[] enteredPasswordHash = Rfc2898DeriveBytes.Pbkdf2(
                enteredPassword, storedPasswordSalt, 10000, HashAlgorithmName.SHA1, 32);
            return CryptographicOperations.FixedTimeEquals(enteredPasswordHash, storedPasswordHash);
        }

        [HttpGet("getuserinfo")]
        public async Task<IActionResult> GetUserInfo()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value; // Get the email from the claims

            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized(new { message = "Email claim not found." });
            }

            var _context = new DataContext(); // Use 'using' to properly dispose of the context

            // Fetch user-related data using email
            var userData = await _context.Users
                .Where(u => u.Email == email)
                .Select(u => new
                {
                    u.UserId,
                    u.Email,
                    // Include other user-related properties
                })
                .FirstOrDefaultAsync();

            if (userData == null)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(userData);
        }


        [HttpGet("getuserleagues")]
        public async Task<IActionResult> GetUserLeagues()
        {
            if (!LeagueAccess.TryGetAccountId(User, out var userId))
                return Unauthorized();

            await using var _context = new DataContext();

            // Fetch user-related data including linked leagues
            var userData = await _context.Users
                .Where(u => u.UserId == userId)
                .Select(u => new
                {
                    u.UserId,
                    u.UserRoleId
                })
                .FirstOrDefaultAsync();
            if (userData == null)
                return Unauthorized();
            var leagues = _context.Leagues.AsNoTracking();
            switch (userData.UserRoleId)
            {
                case 1:
                    break;
                case 2:
                    leagues = leagues.Where(league => (league.EventTypeId == 2 &&
                        _context.TournamentConfigurations.Any(config => config.LeagueId == league.ID && config.OwnerUserId == userId)) ||
                        _context.UserLeagues.Any(
                        link => link.UserId == userId && link.LeagueTypeId == league.ID));
                    break;
                case 3:
                    // Registration and claiming are separate. An unlinked account has
                    // no league memberships until an authorized profile link exists.
                    leagues = leagues.Where(league => (league.EventTypeId == 2 &&
                        _context.TournamentConfigurations.Any(config => config.LeagueId == league.ID && config.OwnerUserId == userId)) ||
                        _context.UsersPlayer.Any(link =>
                        link.UserId == userId && _context.Players.Any(player => player.Id == link.PlayerId) &&
                        _context.PlayersLeagues.Any(membership =>
                            membership.PlayerID == link.PlayerId && membership.LeagueID == league.ID)));
                    break;
                default:
                    leagues = leagues.Where(league => league.EventTypeId == 2 &&
                        _context.TournamentConfigurations.Any(config => config.LeagueId == league.ID && config.OwnerUserId == userId));
                    break;
            }

            var userLeagues = await leagues.OrderByDescending(league => league.ID).Select(league => new
            {
                league.ID, league.LeagueName, league.EventTypeId,
                CanViewTournamentRounds = league.EventTypeId == 2 &&
                    _context.UsersPlayer.Any(link => link.UserId == userId && _context.PlayersLeagues.Any(member =>
                        member.LeagueID == league.ID && member.PlayerID == link.PlayerId)),
                CanManageTournament = league.EventTypeId == 2 && (userData.UserRoleId == 1 ||
                    _context.TournamentConfigurations.Any(config => config.LeagueId == league.ID && config.OwnerUserId == userId))
            }).ToListAsync();
            return Ok(userLeagues);
        }

        // The existing ResetToken text column stores both the issue time and
        // 256 bits of cryptographically random material. No schema change is needed.
        // Older untimed reset links are deliberately rejected.
        private static readonly TimeSpan ResetTokenLifetime = TimeSpan.FromHours(1);

        private static bool IsCurrentResetToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 128)
            {
                return false;
            }

            var parts = token.Split('.');
            if (parts.Length != 3 || parts[0] != "v2" ||
                parts[1].Length != 10 || parts[2].Length != 64 ||
                !parts[1].All(c => c >= '0' && c <= '9') ||
                !parts[2].All(c => (c >= '0' && c <= '9') ||
                                   (c >= 'a' && c <= 'f')) ||
                !long.TryParse(parts[1], out var issuedAtSeconds))
            {
                return false;
            }

            DateTimeOffset issuedAt;
            try
            {
                issuedAt = DateTimeOffset.FromUnixTimeSeconds(issuedAtSeconds);
            }
            catch (ArgumentOutOfRangeException)
            {
                return false;
            }

            var elapsed = DateTimeOffset.UtcNow - issuedAt;
            return elapsed >= TimeSpan.Zero && elapsed <= ResetTokenLifetime;
        }

        [Route("resetpassword")]
        [HttpPost]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            // Count all reset submissions, even invalid tokens, without a
            // database lookup or a separate database-backed rate-limit table.
            if (!TryUseRateSlot(GetRateCounter("reset-submit"), 20))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    "Too many password reset attempts. Try again later.");
            }

            // Reject missing, malformed, expired or legacy untimed tokens
            // before querying the database. A null token must never match
            // an account whose ResetToken column is null.
            if (request == null || string.IsNullOrWhiteSpace(request.Password) ||
                request.Password.Length < 6 || !IsCurrentResetToken(request.Token))
            {
                return BadRequest("Password reset failed: the link is invalid or expired.");
            }

            try
            {
                var _context = new DataContext();
                var userData = await _context.Users
                    .Where(u => u.ResetToken != null && u.ResetToken == request.Token)
                    .FirstOrDefaultAsync();
                if (userData == null)
                {
                    return BadRequest("Password reset failed, token already used or invalid");
                }
                var userModel = new RegistrationModel()
                {
                    Email = userData.Email,
                    FirstName = userData.FirstName,
                    LastName = userData.LastName,
                    Password = request.Password,
                    UserRoleId = 3
                };
                var user = userModel.ToUser();
                // Consume only the token that was read. Concurrent submissions or
                // a newly issued recovery link must not overwrite one another.
                var consumed = await _context.Database.ExecuteSqlRawAsync(
                    "UPDATE [dbo].[User] SET [PasswordHash] = @hash, [PasswordSalt] = @salt, [ResetToken] = NULL, [SessionVersion] = [SessionVersion] + 1 " +
                    "WHERE [UserId] = @userId AND [ResetToken] = @token",
                    new Microsoft.Data.SqlClient.SqlParameter("@hash", System.Data.SqlDbType.VarBinary, -1) { Value = user.PasswordHash },
                    new Microsoft.Data.SqlClient.SqlParameter("@salt", System.Data.SqlDbType.VarBinary, -1) { Value = user.PasswordSalt },
                    new Microsoft.Data.SqlClient.SqlParameter("@userId", System.Data.SqlDbType.Int) { Value = userData.UserId },
                    new Microsoft.Data.SqlClient.SqlParameter("@token", System.Data.SqlDbType.NVarChar, -1) { Value = request.Token });
                if (consumed != 1)
                    return BadRequest("Password reset failed, token already used or invalid");
                return Ok(new { message = "Password reset successful" });
            }
            catch (Exception ex)
            {
                return BadRequest("Password reset failed");
            }
        }

        [HttpPost("updatesetting")]
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public async Task<IActionResult> UpdateSettingAsync([FromBody] UpdateSettingRequest request)
        {
            var context = new DataContext();

            if (request == null || string.IsNullOrWhiteSpace(request.SettingName))
            {
                return Ok(false);
            }

            if (!LeagueAccess.CanManage(User, context, request.LeagueId))
                return Forbid();

            if (string.Equals(request.SettingName.Trim(), LeagueAttendanceAvailability.SettingName, StringComparison.OrdinalIgnoreCase))
                return BadRequest("Use the league sign-in controls to change attendance availability.");

            // Check if the setting exists
            var setting = await context.LeagueSettings
                .FirstOrDefaultAsync(s => s.SettingName == request.SettingName && s.LeagueId == request.LeagueId);

            if (setting == null)
            {
                // Create a new setting if none exists
                setting = new LeagueSettings
                {
                    SettingName = request.SettingName,
                    SettingValue = request.SettingValue,
                    LeagueId = request.LeagueId
                };

                await context.LeagueSettings.AddAsync(setting);
            }
            else
            {
                // Update the existing setting
                setting.SettingValue = request.SettingValue;
                context.LeagueSettings.Update(setting);
            }

            // Save changes to the database
            await context.SaveChangesAsync();

            return Ok(true);
        }


        private static string GetDefaultSettingValue(string settingName)
        {
            switch (settingName)
            {
                case "numberOfSubsAllowed":
                    return "100"; // Default for number of subs allowed
                case "dropLowest":
                    return "0";   // Default for drop lowest
                case "subScorePercent":
                    return "100"; // Default for sub score percent
                case "standingsType":
                    return "round"; // Default for sub score percent
                default:
                    return null;  // No default for unrecognized settings
            }
        }

        [HttpGet("GetSettingValue")]
        public async Task<IActionResult> GetSettingValue(string settingName, int leagueId)
        {
            var context = new DataContext();
            if (string.IsNullOrWhiteSpace(settingName))
            {
                return BadRequest("SettingName is required.");
            }

            // Attempt to find the setting in the database
            var setting = await context.LeagueSettings
                .FirstOrDefaultAsync(s => s.SettingName == settingName && s.LeagueId == leagueId);

            if (setting == null)
            {
                var defaultValue = GetDefaultSettingValue(settingName);
                if (defaultValue == null)
                {
                    return NotFound($"Setting with name '{settingName}' not found, and no default value is defined.");
                }

                Console.WriteLine($"Returning default value: {defaultValue}");
                return Ok(new { SettingValue = defaultValue.ToString() }); // Ensure it's a string
            }

            Console.WriteLine($"Returning database value: {setting.SettingValue}");
            return Ok(new { SettingValue = setting.SettingValue.ToString() }); // Ensure it's a string
        }

        [HttpPost("forgotpassword")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            var email = request?.Email?.Trim();
            if (string.IsNullOrWhiteSpace(email) || email.Length > 320 ||
                !MailAddress.TryCreate(email, out var mailbox) || mailbox.Address != email)
            {
                return BadRequest("Enter a valid email address.");
            }

            // Count every request, not only ones for registered accounts.
            if (!TryUseRateSlot(GetRateCounter("forgot-password"), 8))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    "Too many password reset requests. Try again later.");
            }

            // Limit email flooding to an address without revealing whether
            // that address exists. The response is identical in both cases.
            var cooldown = GetRecoveryCooldown(email);
            var requestedAt = DateTimeOffset.UtcNow;
            lock (cooldown)
            {
                if (requestedAt - cooldown.LastRequest < TimeSpan.FromMinutes(2))
                {
                    return Ok(new { message = RecoveryAcceptedMessage });
                }
                cooldown.LastRequest = requestedAt;
            }

            try
            {
                var userExists = await CheckEmailExistsAsync(email);
                if (userExists != null)
                {
                    string resetToken = await GenerateResetTokenAsync(email);
                    string previousResetToken = userExists.ResetToken;

                    // A user must never receive a link before it is stored.
                    using (var context = new DataContext())
                    {
                        var issued = await context.Users.Where(user => user.UserId == userExists.UserId &&
                            user.SessionVersion == userExists.SessionVersion && user.ResetToken == previousResetToken)
                            .ExecuteUpdateAsync(update => update.SetProperty(user => user.ResetToken, resetToken));
                        if (issued == 0) return Ok(new { message = RecoveryAcceptedMessage });
                    }

                    try
                    {
                        await SendPasswordResetEmailAsync(userExists.Email, resetToken);
                    }
                    catch (Exception)
                    {
                        // Avoid leaking account existence through delivery
                        // errors, and restore an earlier link if delivery failed.
                        try
                        {
                            using (var rollbackContext = new DataContext())
                            {
                                await rollbackContext.Database.ExecuteSqlRawAsync(
                                    "UPDATE [dbo].[User] SET [ResetToken] = @previous " +
                                    "WHERE [UserId] = @userId AND [ResetToken] = @issued",
                                    new Microsoft.Data.SqlClient.SqlParameter("@previous", System.Data.SqlDbType.NVarChar, -1) { Value = (object)previousResetToken ?? DBNull.Value },
                                    new Microsoft.Data.SqlClient.SqlParameter("@userId", System.Data.SqlDbType.Int) { Value = userExists.UserId },
                                    new Microsoft.Data.SqlClient.SqlParameter("@issued", System.Data.SqlDbType.NVarChar, -1) { Value = resetToken });
                            }
                        }
                        catch (Exception rollbackError)
                        {
                            LogRecoveryFailure("rollback", rollbackError);
                        }

                        lock (cooldown)
                        {
                            if (cooldown.LastRequest == requestedAt)
                            {
                                cooldown.LastRequest = DateTimeOffset.MinValue;
                            }
                        }
                    }
                }

                return Ok(new { message = RecoveryAcceptedMessage });
            }
            catch (Exception ex)
            {
                // A database-write or delivery failure for an existing account
                // must not return a distinguishable status from an unknown
                // email address. Log the failure for diagnostics instead.
                LogRecoveryFailure("request", ex);
                lock (cooldown)
                {
                    if (cooldown.LastRequest == requestedAt)
                    {
                        cooldown.LastRequest = DateTimeOffset.MinValue;
                    }
                }
                return Ok(new { message = RecoveryAcceptedMessage });
            }
        }

        private async Task<User> CheckEmailExistsAsync(string email)
        {
            var _context = new DataContext(); // Create a new instance of DataContext

            var userData = await _context.Users
               .Where(u => u.Email == email)
               .FirstOrDefaultAsync();

            // For simplicity, assume email exists (replace with your actual implementation)
            return await Task.FromResult(userData);
        }

        private async Task<string> GenerateResetTokenAsync(string email)
        {
            // Create a byte array to store the token
            byte[] tokenBytes = new byte[32]; // 32 bytes for a 256-bit token

            // Use a secure random number generator to fill the array with random bytes
            System.Security.Cryptography.RandomNumberGenerator.Fill(tokenBytes);

            // Embed the issue time in the same token stored in User.ResetToken.
            // The random value is still required to match the database exactly.
            string randomPart = BitConverter.ToString(tokenBytes).Replace("-", "").ToLowerInvariant();
            string token = "v2." + DateTimeOffset.UtcNow.ToUnixTimeSeconds() + "." + randomPart;

            return await Task.FromResult(token);
        }

        private static void LogRecoveryFailure(string stage, Exception error)
        {
            var smtp = error as SmtpException;
            Console.Error.WriteLine("Password recovery " + stage + " failed [" + error.GetType().Name +
                (smtp == null ? "" : "; SMTP status " + smtp.StatusCode) + "].");
        }

        private async Task SendPasswordResetEmailAsync(string email, string resetToken)
        {
            using (var mail = PasswordResetEmail.Create(email, resetToken,
                Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_PUBLIC_BASE_URL"),
                _environment?.EnvironmentName ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production", ResetTokenLifetime))
            {
                await _mail.Send(mail, "password-reset", _httpContextAccessor.HttpContext?.TraceIdentifier);
            }
        }
    }
}

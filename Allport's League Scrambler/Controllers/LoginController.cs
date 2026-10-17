using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IdentityModel.Tokens.Jwt;
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
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using static Microsoft.AspNetCore.Hosting.Internal.HostingApplication;

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
        private readonly SmtpClient _smtpClient;
        private readonly IMemoryCache _adminPasswordAttempts;

        public LoginController(IConfiguration config, IHttpContextAccessor httpContextAccessor, SmtpClient smtpClient, IMemoryCache adminPasswordAttempts)
        {
            _config = config;
            _httpContextAccessor = httpContextAccessor;
            _smtpClient = smtpClient; // Injected SMTP Client
            _adminPasswordAttempts = adminPasswordAttempts;
        }

        // Compatibility bridge for the administration password used by the old Angular UI.
        // Authentication is validated on the server; the stored password is never sent to clients.
        public class AdminPasswordRequest
        {
            public string Password { get; set; }
        }

        private class AdminPasswordAttempt
        {
            public int Failures { get; set; }
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
                return _adminPasswordAttempts.GetOrCreate("rate:" + scope + ":" + remoteAddress, entry =>
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
                return _adminPasswordAttempts.GetOrCreate("recovery-address:" + key, entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
                    return new RecoveryCooldown();
                });
            }
        }

        [HttpPost("VerifyAdminPassword")]
        public async Task<IActionResult> VerifyAdminPassword([FromBody] AdminPasswordRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.Password) || request.Password.Length > 256)
            {
                return BadRequest(new { message = "Enter the administration password." });
            }

            // A basic per-address throttle for the legacy password, until a stronger
            // account-specific authentication system replaces this compatibility flow.
            var remoteAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var cacheKey = "legacy-admin:" + remoteAddress;
            var attempt = _adminPasswordAttempts.GetOrCreate(cacheKey, entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);
                return new AdminPasswordAttempt();
            });

            bool blocked;
            lock (attempt)
            {
                blocked = attempt.Failures >= 8;
            }
            if (blocked)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    new { message = "Too many attempts. Try again later." });
            }

            string savedPassword;
            using (var context = new DataContext())
            {
                savedPassword = await context.Passwords
                    .Select(p => p.password)
                    .FirstOrDefaultAsync();
            }

            // Hash both values for a fixed-length comparison, avoiding early-exit
            // character-by-character password comparison. Migration of the stored
            // plaintext password to an adaptive password hash remains required.
            bool valid = false;
            using (var sha256 = SHA256.Create())
            {
                var provided = sha256.ComputeHash(Encoding.UTF8.GetBytes(request.Password));
                var expected = sha256.ComputeHash(Encoding.UTF8.GetBytes(savedPassword ?? ""));
                int diff = 0;
                for (int i = 0; i < provided.Length; i++)
                {
                    diff |= provided[i] ^ expected[i];
                }
                valid = !string.IsNullOrEmpty(savedPassword) && diff == 0;
            }

            if (!valid)
            {
                lock (attempt)
                {
                    attempt.Failures++;
                }
                return Unauthorized(new { message = "Incorrect administration password." });
            }

            lock (attempt)
            {
                attempt.Failures = 0;
            }

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, "legacy-admin"),
                new Claim(ClaimTypes.Role, "LegacyAdmin")
            };
            var principal = new ClaimsPrincipal(new ClaimsIdentity(
                claims, "LeagueAdminPassword"));

            // Let CookieAuthenticationOptions.ExpireTimeSpan (six hours) control
            // expiration so SlidingExpiration can renew an active league session.
            await HttpContext.SignInAsync("LeagueAdminPassword", principal,
                new AuthenticationProperties { IsPersistent = false });

            return Ok(new { authorized = true });
        }

        [HttpGet("IsAdminPasswordAuthorized")]
        public async Task<IActionResult> IsAdminPasswordAuthorized()
        {
            var result = await HttpContext.AuthenticateAsync("LeagueAdminPassword");
            return Ok(result.Succeeded && result.Principal.IsInRole("LegacyAdmin"));
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegistrationModel registrationModel)
        {
            if (ModelState.IsValid)
            {
                var _context = new DataContext();

                // Check if the username or email is already taken
                if (await _context.Users.AnyAsync(u => u.Email == registrationModel.Email))
                {
                    return BadRequest(new { message = "Email already in use." });
                }
                registrationModel.UserRoleId = 3;
                var user = registrationModel.ToUser(); // Convert RegistrationModel to User
                _context.Users.Add(user);
                await _context.SaveChangesAsync(); // Save changes to generate the UserId

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
        public IActionResult GetLockSignInStatus(int leagueId)
        {
            var _context = new DataContext();

            // Try to find an existing LeagueSignInLocked record
            var leagueSignInLocked = _context.LeagueSignInLocked
                .FirstOrDefault(s => s.LeagueId == leagueId);

            // A status read must not create a database record. A league with
            // no lock record has historically been treated as unlocked; the
            // authenticated SetLockSignInStatus endpoint creates it as needed.
            return Ok(leagueSignInLocked?.SignInLocked ?? false);
        }

        public class LockSignInRequest
        {
            public int LeagueId { get; set; }
            public bool Locked { get; set; }
        }

        [HttpPost("SetLockSignInStatus")]
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult SetLockSignInStatus([FromBody] LockSignInRequest request)
        {
            if (request == null || request.LeagueId <= 0)
                return BadRequest("Invalid league.");

            var _context = new DataContext();
            if (!LeagueAccess.CanManage(User, _context, request.LeagueId))
                return Forbid();

            // Get the latest sign-in date for the specified league
            var latestDate = _context.PlayerSignIn
                .Where(s => s.LeagueId == request.LeagueId)
                .OrderByDescending(s => s.DateTime)
                .Select(s => s.DateTime)
                .FirstOrDefault();

            //if (latestDate != default)
            //{
            //    // Get all sign-in records for that date and league
            //    var signInsToUpdate = _context.PlayerSignIn
            //        .Where(s => s.LeagueId == request.LeagueId && s.DateTime == latestDate)
            //        .ToList();

            //    if (signInsToUpdate.Any())
            //    {
            //        // Update LockedSignIn for all relevant records
            //        foreach (var signIn in signInsToUpdate)
            //        {
            //            signIn.LockedSignIn = request.Locked;
            //        }

            //        _context.SaveChanges();                    
            //    }
            //}
            //else
            //{
            var leagueSignInLocked = _context.LeagueSignInLocked
                     .Where(s => s.LeagueId == request.LeagueId)
                     .FirstOrDefault();

            if (leagueSignInLocked != null)
            {
                leagueSignInLocked.SignInLocked = request.Locked;
            }
            else
            {
                var newLeagueSignInLocked = new LeagueSignInLocked
                {
                    LeagueId = request.LeagueId,
                    SignInLocked = request.Locked
                };
                _context.LeagueSignInLocked.Add(newLeagueSignInLocked);
            }
            _context.SaveChanges();

            //}
            return Ok(request.Locked);

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

                string roleName;

                switch (userInfo.UserRoleId)
                {
                    case 1:
                        roleName = "Admin";
                        break;
                    case 2:
                        roleName = "Manager";
                        break;
                    case 3:
                        roleName = "Player";
                        break;
                    default:
                        roleName = "Unknown";
                        break;
                }


                userInfo.LastLogin = DateTime.Now;
                _context.Users.Update(userInfo);
                await _context.SaveChangesAsync();

                var claims = new List<Claim>
                 {
                     new Claim(ClaimTypes.NameIdentifier, userInfo.UserId.ToString()), // Unique user identifier
                     new Claim(ClaimTypes.Email, userInfo.Email), // User's email address
                     new Claim("FirstName", userInfo.FirstName), // User's first name
                     new Claim("LastName", userInfo.LastName), // User's last name
                     new Claim(ClaimTypes.Role, roleName), // User's role based on UserRoleId
                     new Claim("CreatedAt", userInfo.CreatedAt.ToString()), // User account creation date
                     new Claim("LastLogin", userInfo.LastLogin.ToString()) // Date of the user's last login
                 };

                var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

                var principal = new ClaimsPrincipal(identity);
                var authProperties = new AuthenticationProperties
                {
                    IsPersistent = loginModel.RememberMe // Set IsPersistent based on whether "Remember Me" is checked
                };

                await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, authProperties);

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
            await HttpContext.SignOutAsync("LeagueAdminPassword");
            Response.Cookies.Delete("access_token");
            return Ok(new { message = "Logout successful" });
        }

        // Function to validate password
        private bool ValidatePassword(string enteredPassword, byte[] storedPasswordHash, byte[] storedPasswordSalt)
        {
            using (var deriveBytes = new Rfc2898DeriveBytes(enteredPassword, storedPasswordSalt, 10000))
            {
                byte[] enteredPasswordHash = deriveBytes.GetBytes(32); // 32 bytes hash size (adjust as needed)

                // Compare the entered password hash with the stored password hash
                for (int i = 0; i < enteredPasswordHash.Length; i++)
                {
                    if (enteredPasswordHash[i] != storedPasswordHash[i])
                    {
                        return false; // Passwords don't match
                    }
                }

                return true; // Passwords match
            }
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
            var email = User.FindFirst(ClaimTypes.Email)?.Value; // Get the email from the claims

            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized(new { message = "Email claim not found." });
            }

            var _context = new DataContext(); // Ensure proper disposal of DataContext

            // Fetch user-related data including linked leagues
            var userData = await _context.Users
                .Where(u => u.Email == email)
                .Select(u => new
                {
                    u.UserId,
                    u.Email,
                    u.IsAdmin,
                    u.UserRoleId
                })
                .FirstOrDefaultAsync();
            var userLeagues = new List<LeagueType>();
            if (userData.UserRoleId == 1)
            {
                userLeagues = _context.Leagues.ToList();
            }
            else if (userData.UserRoleId == 3)
            {
                var player = await _context.UsersPlayer
                    .Where(x => x.UserId == userData.UserId)
                    .FirstOrDefaultAsync();

                if (player == null)
                {
                    throw new Exception("Player not found for the given UserId.");
                }

                var playerLeagues = await _context.PlayersLeagues
                    .Where(u => u.PlayerID == player.PlayerId)
                    .ToListAsync();


                foreach (var playerLeague in playerLeagues)
                {
                    var league = await _context.Leagues
                        .FirstOrDefaultAsync(l => l.ID == playerLeague.LeagueID);

                    if (league != null)
                    {
                        userLeagues.Add(league);
                    }
                }
            }
            else if (userData.UserRoleId == 2)
            {
                userLeagues = await _context.UserLeagues
                .Where(u => u.UserId == userData.UserId)
                .Select(u => u.LeagueType)
                .ToListAsync();
            }
            else
            {
                return NotFound(new { message = "No linked leagues found for this user." });
            }

            if (userLeagues == null || !userLeagues.Any())
            {
                return NotFound(new { message = "No linked leagues found for this user." });
            }

            userLeagues = userLeagues.OrderByDescending(x => x.ID).ToList();

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
                userData.PasswordHash = user.PasswordHash;
                userData.PasswordSalt = user.PasswordSalt;
                userData.ResetToken = null;
                _context.Users.Update(userData);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Password reset successful" });
            }
            catch (Exception ex)
            {
                return BadRequest("Password reset failed");
            }
        }

        [HttpPost("updatesetting")]
        [Authorize(Policy = "LeagueManagement")]
        public async Task<IActionResult> UpdateSettingAsync([FromBody] UpdateSettingRequest request)
        {
            var context = new DataContext();

            if (request == null || string.IsNullOrWhiteSpace(request.SettingName))
            {
                return Ok(false);
            }

            if (!LeagueAccess.CanManage(User, context, request.LeagueId))
                return Forbid();

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
            if (request == null || string.IsNullOrWhiteSpace(request.Email) ||
                request.Email.Length > 320)
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
            var cooldown = GetRecoveryCooldown(request.Email);
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
                var userExists = await CheckEmailExistsAsync(request.Email.Trim());
                if (userExists != null)
                {
                    string resetToken = await GenerateResetTokenAsync(request.Email);
                    string previousResetToken = userExists.ResetToken;
                    userExists.ResetToken = resetToken;

                    // A user must never receive a link before it is stored.
                    using (var context = new DataContext())
                    {
                        context.Users.Update(userExists);
                        await context.SaveChangesAsync();
                    }

                    try
                    {
                        await SendPasswordResetEmailAsync(userExists.Email, resetToken);
                    }
                    catch (Exception sendError)
                    {
                        // Avoid leaking account existence through delivery
                        // errors, and restore an earlier link if delivery failed.
                        Console.Error.WriteLine("Password reset delivery failed: " + sendError.Message);
                        try
                        {
                            using (var rollbackContext = new DataContext())
                            {
                                await rollbackContext.Database.ExecuteSqlCommandAsync(
                                    "UPDATE [dbo].[User] SET [ResetToken] = {0} " +
                                    "WHERE [UserId] = {1} AND [ResetToken] = {2}",
                                    (object)previousResetToken ?? DBNull.Value,
                                    userExists.UserId, resetToken);
                            }
                        }
                        catch (Exception rollbackError)
                        {
                            Console.Error.WriteLine("Password reset rollback failed: " + rollbackError.Message);
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
                Console.Error.WriteLine("Password recovery request failed: " + ex.Message);
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
            using (var rng = new System.Security.Cryptography.RNGCryptoServiceProvider())
            {
                rng.GetBytes(tokenBytes);
            }

            // Embed the issue time in the same token stored in User.ResetToken.
            // The random value is still required to match the database exactly.
            string randomPart = BitConverter.ToString(tokenBytes).Replace("-", "").ToLowerInvariant();
            string token = "v2." + DateTimeOffset.UtcNow.ToUnixTimeSeconds() + "." + randomPart;

            return await Task.FromResult(token);
        }

        private async Task SendPasswordResetEmailAsync(string email, string resetToken)
        {
            var publicBaseUrl = Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_PUBLIC_BASE_URL");
            if (string.IsNullOrWhiteSpace(publicBaseUrl))
            {
                publicBaseUrl = "https://leaguescrambler.hopto.org";
            }

            if (!Uri.TryCreate(publicBaseUrl, UriKind.Absolute, out var publicUri) ||
                publicUri.Scheme != Uri.UriSchemeHttps)
            {
                throw new InvalidOperationException(
                    "LEAGUESCRAMBLER_PUBLIC_BASE_URL must be a valid HTTPS URL.");
            }

            var resetUrl = publicBaseUrl.TrimEnd('/') + "/resetpassword?token=" +
                Uri.EscapeDataString(resetToken);
            var mail = new MailMessage
            {
                From = new MailAddress("LeagueScrambler@gmail.com"),
                Subject = "Password Reset For League Scrambler",
                Body = $"Click the following link to reset your LeagueScrambler password: {resetUrl}\nThis link expires in one hour and can only be used once.",
                IsBodyHtml = false
            };

            mail.To.Add(email);

            try
            {
                // Send the email asynchronously using the injected SmtpClient
                await _smtpClient.SendMailAsync(mail);
                Console.WriteLine("Password reset email sent successfully.");
            }
            catch (Exception ex)
            {
                // Handle exceptions (e.g., logging)
                Console.WriteLine("Error sending email: " + ex.Message);
                throw; // Rethrow the exception for proper error handling
            }
        }

    }
}

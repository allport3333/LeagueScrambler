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
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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

        public LoginController(IConfiguration config, IHttpContextAccessor httpContextAccessor, SmtpClient smtpClient)
        {
            _config = config;
            _httpContextAccessor = httpContextAccessor;
            _smtpClient = smtpClient; // Injected SMTP Client
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegistrationModel registrationModel)
        {
            if (ModelState.IsValid)
            {
                var _context = new DataContext();

                // Check if the username or email is already taken
                if (await _context.Users.AnyAsync(u => u.LoginName == registrationModel.LoginName || u.Email == registrationModel.Email))
                {
                    return BadRequest(new { message = "Username or email already in use." });
                }
                registrationModel.UserRoleId = 3;
                var user = registrationModel.ToUser(); // Convert RegistrationModel to User
                _context.Users.Add(user);
                await _context.SaveChangesAsync(); // Save changes to generate the UserId

                // Return a success response with the generated UserId
                return Ok(new { message = "Registration successful.", userId = user.UserId });
            }

            return BadRequest(new { message = "Invalid registration data." });
        }

        [HttpGet("GetLockSignInStatus/{leagueId}")]
        public IActionResult GetLockSignInStatus(int leagueId)
        {
            var _context = new DataContext();
            var today = DateTime.Today;

            // Check if any sign-in for today's date and league is locked
            bool isLocked = _context.PlayerSignIn
                .Any(s => s.LeagueId == leagueId && s.DateTime.Date == today && s.LockedSignIn);

            return Ok(isLocked);
        }       

        public class LockSignInRequest
        {
            public int LeagueId { get; set; }
            public bool Locked { get; set; }
        }

        [HttpPost("SetLockSignInStatus")]
        public IActionResult SetLockSignInStatus([FromBody] LockSignInRequest request)
        {
            var _context = new DataContext();

            // Get the latest sign-in date for the specified league
            var latestDate = _context.PlayerSignIn
                .Where(s => s.LeagueId == request.LeagueId)
                .OrderByDescending(s => s.DateTime)
                .Select(s => s.DateTime)
                .FirstOrDefault();

            if (latestDate != default)
            {
                // Get all sign-in records for that date and league
                var signInsToUpdate = _context.PlayerSignIn
                    .Where(s => s.LeagueId == request.LeagueId && s.DateTime == latestDate)
                    .ToList();

                if (signInsToUpdate.Any())
                {
                    // Update LockedSignIn for all relevant records
                    foreach (var signIn in signInsToUpdate)
                    {
                        signIn.LockedSignIn = request.Locked;
                    }

                    _context.SaveChanges();
                    return Ok(request.Locked);  // Return the updated lock status
                }
            }

            return NotFound("No sign-in records found for this league to update.");
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

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginModel loginModel)
        {
            if (ModelState.IsValid)
            {
                var _context = new DataContext();
                var userInfo = await _context.Users.FirstOrDefaultAsync(u => u.LoginName == loginModel.Username);

                if (userInfo == null)
                {
                    return BadRequest(new { message = "User not found." });
                }

                if (!ValidatePassword(loginModel.Password, userInfo.PasswordHash, userInfo.PasswordSalt))
                {
                    return BadRequest(new { message = "Invalid password." });
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
                     new Claim(ClaimTypes.Name, userInfo.LoginName), // User's login name or username
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

                // Return a success response
                return Ok(new { message = "Login successful" });
            }

            return BadRequest(new { message = "Invalid login data" });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            // Check if the user is authenticated
            if (User.Identity.IsAuthenticated)
            {
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); // Sign out the user
                Response.Cookies.Delete("access_token"); // Delete the authentication cookie
                return Ok(new { message = "Logout successful" });
            }

            // If the user is not authenticated, return an error
            return BadRequest(new { message = "User is not authenticated." });
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
            var te = _httpContextAccessor.HttpContext.User.Identity.Name;
            var username = User.Identity.Name; // Assuming the username is in the claim

            var _context = new DataContext(); // Create a new instance of DataContext

            // Fetch user-related data (e.g., linked leagues) from the database
            var userData = await _context.Users
                .Where(u => u.LoginName == username)
                .Select(u => new
                {
                    u.UserId,
                    u.LoginName,
                    // Include other user-related properties
                    // You can also include linked leagues data in this projection
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
            var te = _httpContextAccessor.HttpContext.User.Identity.Name;
            var username = User.Identity.Name; // Assuming the username is in the claim

            var _context = new DataContext(); // Create a new instance of DataContext

            // Fetch user-related data (e.g., linked leagues) from the database
            var userData = await _context.Users
                .Where(u => u.LoginName == username)
                .Select(u => new
                {
                    u.UserId,
                    u.LoginName,
                    u.IsAdmin,
                    u.UserRoleId
                    // Include other user-related properties
                    // You can also include linked leagues data in this projection
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

            return Ok(userLeagues);
        }

        [Route("resetpassword")]
        [HttpPost]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            try
            {
                var _context = new DataContext(); // Create a new instance of DataContext
                // Validate the request
                if (request == null || string.IsNullOrWhiteSpace(request.Password))
                {
                    return BadRequest("Invalid request.");
                }

                var userData = await _context.Users
                                .Where(u => u.ResetToken == request.Token)
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
                    LoginName = userData.LoginName,
                    Password = request.Password,
                    UserRoleId = 3
                };
                var user = userModel.ToUser();
                userData.PasswordHash = user.PasswordHash;
                userData.PasswordSalt = user.PasswordSalt;
                userData.ResetToken= null;
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
        public async Task<bool> UpdateSettingAsync([FromBody] UpdateSettingRequest request)
        {
            var context = new DataContext();

            if (request == null || string.IsNullOrWhiteSpace(request.SettingName))
            {
                return false;
            }

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

            return true;
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
            try
            {
                var _context = new DataContext();
                // Validate the request
                if (request == null || string.IsNullOrWhiteSpace(request.Email))
                {
                    return BadRequest("Invalid request.");
                }

                // Check if the email exists in your database asynchronously
                var userExists = await CheckEmailExistsAsync(request.Email);

                if (userExists != null)
                {
                    // Generate a password reset token asynchronously
                    string resetToken = await GenerateResetTokenAsync(request.Email);
                    userExists.ResetToken = resetToken;

                    // Send the password reset email asynchronously
                    await SendPasswordResetEmailAsync(request.Email, resetToken);
                    _context.Users.Update(userExists);
                    await _context.SaveChangesAsync();
                    return Ok(new { message = "Password reset successfully emailed." });
                }
                else
                {
                    return BadRequest("Email not found.");
                }
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, ex.Message);
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

            // Convert the byte array to a hexadecimal string
            string token = BitConverter.ToString(tokenBytes).Replace("-", "").ToLower();

            return await Task.FromResult(token);
        }

        private async Task SendPasswordResetEmailAsync(string email, string resetToken)
        {
            var mail = new MailMessage
            {
                From = new MailAddress("LeagueScrambler@gmail.com"), // Replace with the sender's email
                Subject = "Password Reset For League Scrambler",
                Body = $"Click the following link to reset your password for your login to LeagueScrambler: http://leaguescrambler.hopto.org/resetpassword?token={resetToken}",
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

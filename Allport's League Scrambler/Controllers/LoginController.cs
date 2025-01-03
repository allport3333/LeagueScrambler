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

                var user = registrationModel.ToUser(); // Convert RegistrationModel to User
                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Registration successful." });
            }

            return BadRequest(new { message = "Invalid registration data." });
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
                     new Claim(ClaimTypes.Role, userInfo.IsAdmin ? "Admin" : "User"), // User's role (admin or user)
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
                    u.IsAdmin
                    // Include other user-related properties
                    // You can also include linked leagues data in this projection
                })
                .FirstOrDefaultAsync();
            var userLeagues = new List<LeagueType>();
            if (userData.IsAdmin)
            {
                userLeagues = _context.Leagues.ToList();
            }
            else
            {
                userLeagues = await _context.UserLeagues
                .Where(u => u.UserId == userData.UserId)
                .Select(u => u.LeagueType)
                .ToListAsync();
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
                    Password = request.Password
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

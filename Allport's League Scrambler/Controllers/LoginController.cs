using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
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

namespace Allport_s_League_Scrambler.Controllers
{
    [Route("api/[controller]")]
    public class LoginController : Controller
    {
        private IConfiguration _config;
        private IHttpContextAccessor _httpContextAccessor;
        public LoginController(IConfiguration config, IHttpContextAccessor httpContextAccessor)
        {
            _config = config;
            _httpContextAccessor = httpContextAccessor;
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
    }
}

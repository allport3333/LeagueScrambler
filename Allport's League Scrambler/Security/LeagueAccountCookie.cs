using System.Globalization;
using System.Security.Claims;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;

namespace Allport_s_League_Scrambler.Security;

internal static class LeagueAccountCookie
{
    internal static Task SignIn(HttpContext context, User user, bool persistent = false) =>
        context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(
            new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString(CultureInfo.InvariantCulture)),
                new Claim("SessionVersion", user.SessionVersion.ToString(CultureInfo.InvariantCulture)),
                new Claim(ClaimTypes.Email, user.Email ?? ""),
                new Claim("FirstName", user.FirstName ?? ""),
                new Claim("LastName", user.LastName ?? ""),
                new Claim(ClaimTypes.Role, LeagueAccess.AccountRole(user.UserRoleId)),
                new Claim("CreatedAt", user.CreatedAt.ToString()),
                new Claim("LastLogin", user.LastLogin.ToString())
            }, CookieAuthenticationDefaults.AuthenticationScheme)),
            new AuthenticationProperties { IsPersistent = persistent });
}

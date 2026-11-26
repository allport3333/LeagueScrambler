using System.Data;
using System.Security.Claims;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers;

[Route("api/auth/google")]
public sealed class GoogleAuthenticationController(IAuthenticationSchemeProvider schemes) : ControllerBase
{
    private async Task<bool> Enabled() => await schemes.GetSchemeAsync(GoogleDefaults.AuthenticationScheme) != null;

    [AllowAnonymous, HttpGet("available")]
    public async Task<IActionResult> Available() => Ok(new { enabled = await Enabled() });

    [AllowAnonymous, SameOrigin, HttpPost("start")]
    public async Task<IActionResult> Start([FromForm] string returnTo)
    {
        if (!await Enabled()) return NotFound();
        var destination = GoogleSignIn.PickupDestination(returnTo);
        if (!string.IsNullOrEmpty(returnTo) && returnTo != "/" && destination == null)
            return BadRequest(new { message = "Invalid sign-in destination." });
        if (User.Identity?.IsAuthenticated == true) return LocalRedirect(destination ?? "/");

        var properties = new AuthenticationProperties { RedirectUri = destination ?? "/" };
        properties.Items[GoogleSignIn.DestinationKey] = destination ?? "/";
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [Authorize, HttpGet("connection")]
    public async Task<IActionResult> Connection()
    {
        if (!LeagueAccess.TryGetAccountId(User, out var id)) return Unauthorized();
        var enabled = await Enabled();
        if (!enabled) return Ok(new { enabled, connected = false, canDisconnect = false });
        await using var db = new DataContext();
        var user = await db.Users.FindAsync(id);
        if (user == null) return Unauthorized();
        var connected = await db.GoogleAccounts.AnyAsync(link => link.UserId == id);
        return Ok(new { enabled, connected, canDisconnect = connected && HasPassword(user) });
    }

    [Authorize, SameOrigin, HttpPost("connect")]
    public async Task<IActionResult> Connect()
    {
        if (!await Enabled()) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var id)) return Unauthorized();
        await using var db = new DataContext();
        var user = await db.Users.FindAsync(id);
        if (user == null) return Unauthorized();
        var properties = new AuthenticationProperties { RedirectUri = GoogleSignIn.AccountPage };
        properties.Items[GoogleSignIn.LinkAccountKey] = id.ToString();
        properties.Items[GoogleSignIn.LinkVersionKey] = user.SessionVersion.ToString();
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [Authorize, SameOrigin, HttpPost("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        if (!await Enabled()) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var id)) return Unauthorized();
        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var user = await db.Users.FindAsync(id);
        if (user == null || User.FindFirstValue("SessionVersion") != user.SessionVersion.ToString()) return Unauthorized();
        var link = await db.GoogleAccounts.SingleOrDefaultAsync(row => row.UserId == id);
        if (link == null) return NoContent();
        if (!HasPassword(user))
            return Conflict(new { message = "Set a League Hub password before disconnecting Google." });
        db.GoogleAccounts.Remove(link);
        user.SessionVersion++;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await LeagueAccountCookie.SignIn(HttpContext, user);
        return NoContent();
    }

    private static bool HasPassword(Models.User user) =>
        user.PasswordHash?.Length == 32 && user.PasswordSalt?.Length >= 8;
}

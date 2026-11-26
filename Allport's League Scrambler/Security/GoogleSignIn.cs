using System;
using System.Data;
using System.Linq;
using System.Net.Mail;
using System.Security.Claims;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Allport_s_League_Scrambler.Security;

internal static class GoogleSignIn
{
    private const string VerifiedEmail = "google:verified-email";
    internal const string DestinationKey = "league-hub-destination";
    internal const string LinkAccountKey = "league-hub-link-account";
    internal const string LinkVersionKey = "league-hub-link-version";
    internal const string CallbackPath = "/signin-google";
    internal const string AccountPage = "/connected-accounts";
    private const string ClientIdKey = "Authentication:Google:ClientId";
    private const string ClientSecretKey = "Authentication:Google:ClientSecret";

    internal static string[] MissingConfigurationKeys(IConfiguration configuration) =>
        new[] { ClientIdKey, ClientSecretKey }.Where(key => string.IsNullOrWhiteSpace(configuration[key])).ToArray();

    internal static void Configure(AuthenticationBuilder authentication, IConfiguration configuration)
    {
        var clientId = configuration[ClientIdKey];
        var secret = configuration[ClientSecretKey];
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(secret)) return;

        authentication.AddGoogle(options =>
        {
            options.ClientId = clientId;
            options.ClientSecret = secret;
            options.CallbackPath = CallbackPath;
            options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.UsePkce = true;
            options.SaveTokens = false;
            options.Scope.Clear();
            foreach (var scope in new[] { "openid", "email", "profile" }) options.Scope.Add(scope);
            options.ClaimActions.MapJsonKey(VerifiedEmail, "verified_email");
            options.ClaimActions.MapJsonKey(VerifiedEmail, "email_verified");
            options.Events.OnTicketReceived = Complete;
            options.AccessDeniedPath = "/";
            options.Events.OnAccessDenied = context =>
            {
                context.HandleResponse();
                context.Response.Redirect(QueryHelpers.AddQueryString(Destination(context.Properties), "google", "cancelled"));
                return Task.CompletedTask;
            };
            options.Events.OnRemoteFailure = context =>
            {
                context.HandleResponse();
                var destination = Destination(context.Properties);
                context.Response.Redirect(QueryHelpers.AddQueryString(destination, "google", "cancelled"));
                return Task.CompletedTask;
            };
        });
    }

    internal static string PickupDestination(string value)
    {
        const string prefix = "/pickup/";
        return value != null && value.StartsWith(prefix, StringComparison.Ordinal) &&
            Guid.TryParseExact(value[prefix.Length..], "D", out var id) ? prefix + id.ToString("D") : null;
    }

    private static string Destination(AuthenticationProperties properties)
    {
        var pickup = PickupDestination(properties?.GetString(DestinationKey));
        if (properties?.Items.ContainsKey(LinkAccountKey) == true)
            return pickup == null ? AccountPage : QueryHelpers.AddQueryString(AccountPage, "returnTo", pickup);
        return pickup ?? "/";
    }

    private static async Task Complete(TicketReceivedContext context)
    {
        // Only the validated Google ticket is consumed here. Issue our existing account cookie ourselves.
        context.HandleResponse();
        var destination = Destination(context.Properties);
        var linking = context.Properties.Items.ContainsKey(LinkAccountKey);
        string status;
        try
        {
            status = await ResolveAccount(context, linking);
        }
        catch (SqlException)
        {
            status = "unavailable";
        }
        catch (DbUpdateException)
        {
            status = "unavailable";
        }
        if (!linking && status == "existing-account")
            destination = destination == "/" ? "/" : QueryHelpers.AddQueryString("/", "returnTo", destination);
        context.Response.Redirect(status == null ? destination : QueryHelpers.AddQueryString(destination, "google", status));
    }

    private static async Task<string> ResolveAccount(TicketReceivedContext context, bool linking)
    {
        var external = context.Principal;
        var subject = external.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = external.FindFirstValue(ClaimTypes.Email)?.Trim();
        if (string.IsNullOrEmpty(subject) || subject.Length > 255 || email is not { Length: > 0 and <= 254 } ||
            !MailAddress.TryCreate(email, out var address) || address.Address != email ||
            !external.FindAll(VerifiedEmail).Any(claim => string.Equals(claim.Value, "true", StringComparison.OrdinalIgnoreCase)))
            return "profile";

        var authenticated = await context.HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (linking != LeagueAccess.TryGetAccountId(authenticated.Principal, out var currentId))
            return "session";

        await using var db = new DataContext();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var link = await db.GoogleAccounts.SingleOrDefaultAsync(row => row.Subject == subject);
        User user;
        if (linking)
        {
            user = await db.Users.FindAsync(currentId);
            if (user == null || context.Properties.Items[LinkAccountKey] != currentId.ToString() ||
                context.Properties.GetString(LinkVersionKey) != user.SessionVersion.ToString())
                return "session";
            if (link != null) return link.UserId == currentId ? "connected" : "linked-elsewhere";
            if (await db.GoogleAccounts.AnyAsync(row => row.UserId == currentId)) return "already-connected";
            db.GoogleAccounts.Add(new GoogleAccount { Subject = subject, UserId = currentId });
        }
        else
        {
            user = link == null ? null : await db.Users.FindAsync(link.UserId);
            if (link == null)
            {
                var normalized = email.ToUpperInvariant();
                if (await db.Users.AnyAsync(row => row.Email != null && row.Email.Trim().ToUpper() == normalized))
                    return "existing-account";

                var first = external.FindFirstValue(ClaimTypes.GivenName)?.Trim();
                var last = external.FindFirstValue(ClaimTypes.Surname)?.Trim();
                if (first is not { Length: > 0 and <= 100 } || last is not { Length: > 0 and <= 100 })
                    return "profile";

                user = new User { FirstName = first, LastName = last, Email = email, UserRoleId = 3, CreatedAt = DateTime.Now };
                db.Users.Add(user);
                await db.SaveChangesAsync();
                db.GoogleAccounts.Add(new GoogleAccount { Subject = subject, UserId = user.UserId });
            }
            if (user == null) return "unavailable";
            user.LastLogin = DateTime.Now;
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        if (!linking) await LeagueAccountCookie.SignIn(context.HttpContext, user);
        return linking ? "connected" : null;
    }
}

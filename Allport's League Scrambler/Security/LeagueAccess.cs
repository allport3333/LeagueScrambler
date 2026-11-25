using System;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Allport_s_League_Scrambler.Security
{
    public static class LeagueAccess
    {
        public static string AccountRole(int? roleId) => roleId switch
        {
            1 => "Admin",
            2 => "Manager",
            3 => "Player",
            _ => "Unknown"
        };

        public static bool TryGetAccountId(ClaimsPrincipal principal, out int userId)
        {
            userId = 0;
            return principal?.Identity?.IsAuthenticated == true &&
                int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out userId) && userId > 0;
        }

        public static async Task RefreshAccountRole(CookieValidatePrincipalContext validation)
        {
            var aborted = validation.HttpContext.RequestAborted;
            if (aborted.IsCancellationRequested || !TryGetAccountId(validation.Principal, out var userId))
            {
                validation.RejectPrincipal();
                return;
            }

            AccountSession account;
            try
            {
                var lookup = validation.HttpContext.RequestServices.GetRequiredService<AccountRoleLookup>();
                account = await lookup(userId, aborted);
            }
            catch (OperationCanceledException) when (aborted.IsCancellationRequested)
            {
                // The client left. Do not accept the ticket or invalidate the browser's session.
                validation.RejectPrincipal();
                return;
            }

            if (aborted.IsCancellationRequested || account == null ||
                (validation.Principal.FindFirst("SessionVersion")?.Value ?? "0") != account.Version.ToString(System.Globalization.CultureInfo.InvariantCulture))
            {
                validation.RejectPrincipal();
                return;
            }

            var identity = (ClaimsIdentity)validation.Principal.Identity;
            var roles = identity.FindAll(identity.RoleClaimType).ToArray();
            if (roles.Length == 1 && roles[0].Value == account.Role)
                return;

            var refreshed = identity.Clone();
            foreach (var oldRole in refreshed.FindAll(refreshed.RoleClaimType).ToArray())
                refreshed.RemoveClaim(oldRole);
            refreshed.AddClaim(new Claim(refreshed.RoleClaimType, account.Role));
            validation.ReplacePrincipal(new ClaimsPrincipal(refreshed));
        }

        internal static async Task<AccountSession> ReadAccountRole(int userId, CancellationToken cancellation)
        {
            await using var context = new DataContext();
            var account = await context.Users.AsNoTracking().Where(user => user.UserId == userId)
                .Select(user => new { user.UserRoleId, user.SessionVersion }).SingleOrDefaultAsync(cancellation);
            return account == null ? null : new AccountSession(AccountRole(account.UserRoleId), account.SessionVersion);
        }

        public static bool CanManage(ClaimsPrincipal principal, DataContext context, int leagueId)
        {
            if (leagueId <= 0 || !TryGetAccountId(principal, out var userId))
            {
                return false;
            }

            if (principal.IsInRole("Admin"))
            {
                return true;
            }

            if (context.Leagues.Any(league => league.ID == leagueId && league.EventTypeId == 2))
                return context.TournamentConfigurations.Any(tournament =>
                    tournament.LeagueId == leagueId && tournament.OwnerUserId == userId);

            return principal.IsInRole("Manager") && context.UserLeagues.Any(link =>
                link.UserId == userId && link.LeagueTypeId == leagueId);
        }
    }

    public sealed record AccountSession(string Role, int Version);
    public delegate Task<AccountSession> AccountRoleLookup(int userId, CancellationToken cancellation);
}

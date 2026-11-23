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

            string role;
            try
            {
                var lookup = validation.HttpContext.RequestServices.GetRequiredService<AccountRoleLookup>();
                role = await lookup(userId, aborted);
            }
            catch (OperationCanceledException) when (aborted.IsCancellationRequested)
            {
                // The client left. Do not accept the ticket or invalidate the browser's session.
                validation.RejectPrincipal();
                return;
            }

            if (aborted.IsCancellationRequested || role == null)
            {
                validation.RejectPrincipal();
                return;
            }

            var identity = (ClaimsIdentity)validation.Principal.Identity;
            var roles = identity.FindAll(identity.RoleClaimType).ToArray();
            if (roles.Length == 1 && roles[0].Value == role)
                return;

            var refreshed = identity.Clone();
            foreach (var oldRole in refreshed.FindAll(refreshed.RoleClaimType).ToArray())
                refreshed.RemoveClaim(oldRole);
            refreshed.AddClaim(new Claim(refreshed.RoleClaimType, role));
            validation.ReplacePrincipal(new ClaimsPrincipal(refreshed));
        }

        internal static async Task<string> ReadAccountRole(int userId, CancellationToken cancellation)
        {
            await using var context = new DataContext();
            var account = await context.Users.AsNoTracking().Where(user => user.UserId == userId)
                .Select(user => new { user.UserRoleId }).SingleOrDefaultAsync(cancellation);
            return account == null ? null : AccountRole(account.UserRoleId);
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

            if (!principal.IsInRole("Manager"))
            {
                return false;
            }

            return context.UserLeagues.Any(link =>
                link.UserId == userId && link.LeagueTypeId == leagueId);
        }
    }

    public delegate Task<string> AccountRoleLookup(int userId, CancellationToken cancellation);
}

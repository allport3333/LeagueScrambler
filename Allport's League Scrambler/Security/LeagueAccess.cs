using System.Linq;
using System.Security.Claims;
using Allport_s_League_Scrambler.Data;

namespace Allport_s_League_Scrambler.Security
{
    // Shared check for writes to an existing league. A legacy admin password
    // remains global (as before), Admin accounts remain global, and Manager
    // accounts can modify only their assigned UserLeagues.
    public static class LeagueAccess
    {
        public static bool CanManage(ClaimsPrincipal principal, DataContext context, int leagueId)
        {
            if (principal == null || leagueId <= 0)
            {
                return false;
            }

            if (principal.IsInRole("Admin") || principal.IsInRole("LegacyAdmin"))
            {
                return true;
            }

            if (!principal.IsInRole("Manager"))
            {
                return false;
            }

            var userIdText = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdText, out var userId))
            {
                return false;
            }

            return context.UserLeagues.Any(link =>
                link.UserId == userId && link.LeagueTypeId == leagueId);
        }
    }
}

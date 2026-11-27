using System;
using System.Linq;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Allport_s_League_Scrambler.Hubs
{
    public sealed class LeagueAttendanceHub : Hub
    {
        internal static string Group(int leagueId, DateTime date) => FormattableString.Invariant($"league-{leagueId}-{date:yyyy-MM-dd}");

        // The league kiosk and its current attendance are already publicly readable.
        // A connection can follow one league and only its current Eastern attendance date.
        public async Task<string> Follow(int leagueId)
        {
            await using var context = new DataContext();
            if (!await context.Leagues.AnyAsync(league => league.ID == leagueId && league.EventTypeId != 2))
                throw new HubException("League attendance is unavailable.");
            var date = AttendanceRules.EasternNow(DateTime.UtcNow).Date;
            var group = Group(leagueId, date);
            if (Context.Items.TryGetValue("attendanceGroup", out var previous) && previous is string oldGroup && oldGroup != group)
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, oldGroup);
            await Groups.AddToGroupAsync(Context.ConnectionId, group);
            Context.Items["attendanceGroup"] = group;
            return FormattableString.Invariant($"{date:yyyy-MM-dd}");
        }
    }

    public sealed class LeagueAttendanceNotifications(
        IHubContext<LeagueAttendanceHub> hub, ILogger<LeagueAttendanceNotifications> logger)
    {
        public async Task Changed(int leagueId, DateTime date)
        {
            try
            {
                await hub.Clients.Group(LeagueAttendanceHub.Group(leagueId, date)).SendAsync("AttendanceChanged");
            }
            catch (Exception error)
            {
                logger.LogWarning(error, "Could not publish a committed attendance change for league {LeagueId}", leagueId);
            }
        }
    }
}

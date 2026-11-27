using System;
using System.Linq;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Security
{
    public record LeagueAttendanceAvailability(string Mode, string Reason, string Period, string AttendanceDate)
    {
        public const string SettingName = "attendanceOverride";
        public bool Locked => Reason != null;

        public static async Task<LeagueAttendanceAvailability> Read(DataContext context, int leagueId, DateTime now)
        {
            var settings = await context.LeagueSettings.Where(s => s.LeagueId == leagueId &&
                (s.SettingName == "dayOfLeague" || s.SettingName == SettingName))
                .OrderBy(s => s.LeagueSettingsId).ToListAsync();
            var day = settings.FirstOrDefault(s => s.SettingName == "dayOfLeague")?.SettingValue;
            var saved = settings.FirstOrDefault(s => s.SettingName == SettingName)?.SettingValue;
            // Historical locks have no period. Preserve them until an administrator changes the mode.
            var legacyLock = saved == null && await context.LeagueSignInLocked
                .AnyAsync(s => s.LeagueId == leagueId && s.SignInLocked);
            return Resolve(day, saved, legacyLock, now);
        }

        public static LeagueAttendanceAvailability Resolve(string configuredDay, string saved, bool legacyLock, DateTime now)
        {
            // Scope a manual decision through the next league day, including that day.
            // Without a configured weekday, use the Sunday boundary and keep Automatic closed.
            var weekday = Enum.GetNames<DayOfWeek>().FirstOrDefault(day =>
                string.Equals(day, configuredDay, StringComparison.OrdinalIgnoreCase));
            var leagueDay = weekday == null ? DayOfWeek.Sunday : Enum.Parse<DayOfWeek>(weekday);
            var offset = ((int)leagueDay - (int)now.DayOfWeek + 7) % 7;
            var period = now.Date.AddDays(offset).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
            var date = now.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
            if (saved == period + ":open")
                return new("open", null, period, date);
            if (saved == period + ":locked" || (saved == null && legacyLock))
                return new("locked", AttendanceRules.UnavailableReason(true, true, configuredDay, now), period, date);
            return new("automatic", AttendanceRules.UnavailableReason(true, false, configuredDay, now), period, date);
        }
    }
}

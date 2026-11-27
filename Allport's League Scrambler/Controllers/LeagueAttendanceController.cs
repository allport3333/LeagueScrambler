using System;
using System.Data;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Allport_s_League_Scrambler.Controllers
{
    [ApiController]
    [Route("api/LeagueAttendance/{leagueId:int}/bulk")]
    [Authorize(Policy = "LeagueManagement")]
    public class LeagueAttendanceController(ILogger<LeagueAttendanceController> logger) : ControllerBase
    {
        public record Confirmation(string Operation, string Version, string Text);
        public record Preview(string LeagueName, string Date, int SignedIn, int Additional,
            int Records, string LockedReason, string Version);

        [HttpGet]
        public Task<IActionResult> ReadPreview(int leagueId) => Run(leagueId, null);

        [HttpPost]
        [SameOrigin]
        public async Task<IActionResult> Apply(int leagueId, Confirmation confirmation)
        {
            if (confirmation.Operation is not ("sign-in" or "remove") ||
                string.IsNullOrEmpty(confirmation.Version) ||
                (confirmation.Operation == "remove" && confirmation.Text != "REMOVE ALL"))
                return BadRequest(new { message = "A valid bulk attendance confirmation is required." });
            return await Run(leagueId, confirmation);
        }

        private async Task<IActionResult> Run(int leagueId, Confirmation confirmation)
        {
            await using var context = new DataContext();
            if (!LeagueAccess.CanManage(User, context, leagueId)) return Forbid();
            var league = await context.Leagues.Where(l => l.ID == leagueId && l.EventTypeId != 2)
                .Select(l => l.LeagueName).SingleOrDefaultAsync();
            if (league == null) return NotFound();

            await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var now = AttendanceRules.EasternNow(DateTime.UtcNow);
            await AttendanceSerialization.Acquire(context, leagueId, now.Date);
            if (AttendanceRules.EasternNow(DateTime.UtcNow).Date != now.Date)
                return Conflict(new { message = "The attendance date changed. Try again for the new date." });
            var availability = await LeagueAttendanceAvailability.Read(context, leagueId, now);
            var start = now.Date;
            var end = start.AddDays(1);
            var rows = await context.PlayerSignIn.Where(r => r.LeagueId == leagueId && r.DateTime >= start && r.DateTime < end)
                .OrderBy(r => r.PlayerSignInId).ToListAsync();
            var eligible = await context.PlayersLeagues.Where(p => p.LeagueID == leagueId)
                .Select(p => p.PlayerID).Distinct().OrderBy(id => id).ToListAsync();
            var signedIn = rows.Select(r => r.PlayerId).ToHashSet();
            var unsigned = eligible.Where(id => !signedIn.Contains(id)).ToList();
            var snapshot = $"{leagueId}|{availability.AttendanceDate}|{availability.Period}|{availability.Mode}|{availability.Locked}|" +
                string.Join(",", rows.Select(r => r.PlayerSignInId)) + "|" + string.Join(",", eligible);
            var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(snapshot)));
            if (confirmation == null)
                return Ok(new Preview(league, availability.AttendanceDate, signedIn.Count, unsigned.Count,
                    rows.Count, availability.Reason, version));

            if (confirmation.Version != version)
                return Conflict(new { message = "Attendance or availability changed. Open the action again to review the current counts." });
            if (confirmation.Operation == "sign-in" && availability.Locked)
                return StatusCode(423, new { message = availability.Reason });

            var removing = confirmation.Operation == "remove";
            if (removing) context.PlayerSignIn.RemoveRange(rows);
            else context.PlayerSignIn.AddRange(unsigned.Select(id => new PlayerSignIn {
                LeagueId = leagueId, PlayerId = id, DateTime = now, LockedSignIn = false
            }));
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
            var affected = removing ? rows.Count : unsigned.Count;
            logger.LogInformation("Attendance bulk operation {Operation} by account {AccountId} for league {LeagueId} on {AttendanceDate} changed {Affected} records",
                confirmation.Operation, User.FindFirstValue(ClaimTypes.NameIdentifier), leagueId, availability.AttendanceDate, affected);
            return Ok(new { affected });
        }
    }
}

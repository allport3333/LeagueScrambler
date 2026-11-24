using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers
{
    public partial class TournamentsController
    {
        public sealed record RemoveRoundsInput(Guid Version, int[] RoundNumbers, bool VoidScored = false);

        [Authorize(Policy = "LeagueManagement")]
        [HttpPost("rounds/remove")]
        [SameOrigin]
        public async Task<IActionResult> RemoveRounds(int leagueId, [FromBody] RemoveRoundsInput input)
        {
            if (!ModelState.IsValid || input?.RoundNumbers == null || input.RoundNumbers.Length is < 1 or > 30 ||
                input.RoundNumbers.Distinct().Count() != input.RoundNumbers.Length ||
                (input.VoidScored && input.RoundNumbers.Length != 1))
                return BadRequest(new { message = "Select unplayed rounds to delete or one scored round to void." });

            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await LockTournamentWrites(db, leagueId);
            if (!LeagueAccess.CanManage(User, db, leagueId) || !LeagueAccess.TryGetAccountId(User, out var account))
                return Forbid();
            var details = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details == null) return NotFound();
            if (details.Version != input.Version)
                return Conflict(new { message = "Tournament state changed. Reload before removing rounds." });

            var allRounds = await db.TournamentRounds.Where(round => round.LeagueId == leagueId).ToListAsync();
            var active = allRounds.Where(round => round.VoidedAtUtc == null).ToArray();
            var selected = active.Where(round => input.RoundNumbers.Contains(round.RoundNumber)).ToArray();
            if (selected.Length != input.RoundNumbers.Length)
                return Conflict(new { message = "One or more selected rounds are no longer active." });
            var scrambles = selected.Select(round => round.ScrambleNumber).ToArray();
            var teams = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId && scrambles.Contains(team.ScrambleNumber))
                .Include(team => team.KingQueenPlayers).Include(team => team.KingQueenRoundScores).AsSplitQuery().ToListAsync();
            var scored = teams.Any(team => team.KingQueenRoundScores.Count > 0);
            if (input.VoidScored)
            {
                if (!User.IsInRole("Admin")) return Forbid();
                if (!scored) return Conflict(new { message = "Only a round with saved scores can be voided." });
                selected[0].VoidedAtUtc = DateTime.UtcNow;
                selected[0].VoidedByUserId = account;
            }
            else
            {
                if (scored) return Conflict(new { message = "Scored rounds cannot be deleted. An administrator can void them." });
                await RemoveAssignments(db, leagueId, scrambles, teams);
                db.TournamentRounds.RemoveRange(selected);
            }

            var settings = DecodeSettings(details);
            var resetting = !input.VoidScored && allRounds.Count == selected.Length;
            details.RoundSettingsJson = JsonSerializer.Serialize(settings with
            {
                NumberOfRounds = resetting ? 1 : active.Length - selected.Length,
                LastScrambleNumber = Math.Max(settings.LastScrambleNumber, allRounds.Max(round => round.ScrambleNumber)),
                ManualByes = settings.ManualByes.Where(bye => !input.RoundNumbers.Contains(bye.RoundNumber)).ToArray(),
                HistoricalScrambleNumbers = input.VoidScored ? settings.HistoricalScrambleNumbers :
                    settings.HistoricalScrambleNumbers.Except(scrambles).ToArray()
            });
            if (resetting) details.WorkflowStep = 6;
            details.Version = Guid.NewGuid();
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { details.Version });
        }

        private static async Task RemoveAssignments(DataContext db, int leagueId, int[] scrambles, IReadOnlyCollection<KingQueenTeam> teams)
        {
            if (scrambles.Length == 0) return;
            var byes = await db.ByeRounds.Where(row => row.LeagueID == leagueId && scrambles.Contains(row.ScrambleNumber))
                .Include(row => row.ByePlayers).ToListAsync();
            db.ByePlayer.RemoveRange(byes.SelectMany(row => row.ByePlayers));
            db.ByeRounds.RemoveRange(byes);
            db.KingQueenPlayer.RemoveRange(teams.SelectMany(row => row.KingQueenPlayers));
            db.KingQueenTeam.RemoveRange(teams);
        }
    }
}

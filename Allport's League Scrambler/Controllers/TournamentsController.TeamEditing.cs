using System;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers
{
    public partial class TournamentsController
    {
        public sealed record TeamAssignment(int TeamId, int[] PlayerIds);
        public sealed record TeamEditingInput(Guid Version, TeamAssignment[] Teams);

        [HttpPut("rounds/{roundNumber:int}/teams")]
        [SameOrigin]
        public async Task<IActionResult> EditRoundTeams(int leagueId, int roundNumber, [FromBody] TeamEditingInput input)
        {
            if (!ModelState.IsValid || input?.Teams == null || input.Teams.Length is < 2 or > 128 ||
                input.Teams.Any(team => team?.PlayerIds == null || team.PlayerIds.Length is < 1 or > 256))
                return BadRequest(new { message = "Each team must have at least one player." });

            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await LockTournamentWrites(db, leagueId);
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var details = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            var round = await db.TournamentRounds.FindAsync(leagueId, roundNumber);
            if (details == null || round == null) return NotFound();
            if (details.Version != input.Version || round.VoidedAtUtc != null)
                return Conflict(new { message = "The round changed or was voided. Reload before editing teams." });

            var teams = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId && team.ScrambleNumber == round.ScrambleNumber)
                .Include(team => team.KingQueenPlayers).Include(team => team.KingQueenRoundScores).AsSplitQuery().ToListAsync();
            var assignments = teams.SelectMany(team => team.KingQueenPlayers).ToArray();
            var assignmentIds = assignments.Select(row => row.Id).ToArray();
            if (teams.Any(team => team.KingQueenRoundScores.Count != 0) ||
                await db.PlayerScore.AnyAsync(score => score.KingQueenPlayerId.HasValue && assignmentIds.Contains(score.KingQueenPlayerId.Value)))
                return Conflict(new { message = "Teams cannot be edited once the round has scores." });

            var expectedTeams = teams.Select(team => team.Id).ToHashSet();
            var expectedPlayers = assignments.Select(row => row.PlayerId).ToHashSet();
            var suppliedPlayers = input.Teams.SelectMany(team => team.PlayerIds).ToArray();
            var byes = await db.ByePlayer.Where(player => db.ByeRounds.Any(bye => bye.Id == player.ByeRoundId &&
                bye.LeagueID == leagueId && bye.ScrambleNumber == round.ScrambleNumber)).Select(player => player.PlayerId).ToArrayAsync();
            if (input.Teams.Length != expectedTeams.Count || !expectedTeams.SetEquals(input.Teams.Select(team => team.TeamId)) ||
                assignments.Length != expectedPlayers.Count || suppliedPlayers.Length != expectedPlayers.Count ||
                !expectedPlayers.SetEquals(suppliedPlayers) || suppliedPlayers.Intersect(byes).Any())
                return BadRequest(new { message = "Keep the same round teams, with each assigned player appearing exactly once and byes unchanged." });

            var destinations = input.Teams.SelectMany(team => team.PlayerIds.Select(player => (player, team.TeamId)))
                .ToDictionary(pair => pair.player, pair => pair.TeamId);
            if (assignments.All(assignment => assignment.KingQueenTeamId == destinations[assignment.PlayerId]))
                return Ok(new { details.Version });

            var savedSettings = SavedGenerationSettings(round);
            if (savedSettings?.HistoricalScrambleNumbers.Length > 0)
            {
                using var snapshot = JsonDocument.Parse(round.GenerationJson);
                var allowFallback = snapshot.RootElement.TryGetProperty("AllowHistoricalFallback", out var flag) && flag.ValueKind == JsonValueKind.True;
                if (!allowFallback)
                {
                    var history = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId &&
                        savedSettings.HistoricalScrambleNumbers.Contains(team.ScrambleNumber))
                        .Select(team => team.KingQueenPlayers.Select(player => player.PlayerId).ToArray()).ToListAsync();
                    var prohibited = history.SelectMany(TeamPairs).ToHashSet();
                    if (input.Teams.SelectMany(team => TeamPairs(team.PlayerIds)).Any(prohibited.Contains))
                        return BadRequest(new { message = "The edit would create a strictly excluded historical teammate pairing." });
                }
            }

            foreach (var assignment in assignments)
                assignment.KingQueenTeamId = destinations[assignment.PlayerId];
            details.Version = Guid.NewGuid();
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { details.Version });
        }
    }
}

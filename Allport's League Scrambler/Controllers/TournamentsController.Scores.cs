using System;
using System.Data;
using System.Linq;
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
        public sealed record MatchScore(int TeamId, int OpponentId, int Game, int Points, int OpponentPoints);
        public sealed record SaveScoresInput(Guid Version, MatchScore[] Scores);

        [Authorize(Policy = "LeagueManagement")]
        [HttpPut("rounds/{roundNumber:int}/scores")]
        [SameOrigin]
        public async Task<IActionResult> SaveScores(int leagueId, int roundNumber, [FromBody] SaveScoresInput input)
        {
            if (!ModelState.IsValid || input?.Scores == null || input.Scores.Length is < 1 or > 576 ||
                input.Scores.Any(score => score == null || score.Points < 0 || score.OpponentPoints < 0) ||
                input.Scores.Select(score => (score.TeamId, score.Game)).Distinct().Count() != input.Scores.Length)
                return BadRequest(new { message = "Enter a nonnegative whole-number score for both teams in each game." });

            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await LockTournamentWrites(db, leagueId);
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var details = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details == null) return NotFound();
            if (details.Version != input.Version)
                return Conflict(new { message = "Results changed. Reload the round before saving." });
            var round = await db.Set<TournamentRound>().FindAsync(leagueId, roundNumber);
            if (round == null) return NotFound();
            var teams = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId && team.ScrambleNumber == round.ScrambleNumber)
                .OrderBy(team => team.Id).Include(team => team.KingQueenRoundScores).ToListAsync();
            var matches = teams.Chunk(2).Where(pair => pair.Length == 2).ToDictionary(pair => pair[0].Id);
            foreach (var score in input.Scores)
            {
                if (!matches.TryGetValue(score.TeamId, out var pair) || pair[1].Id != score.OpponentId ||
                    score.Game < 1 || score.Game > round.GamesPerMatchup)
                    return BadRequest(new { message = "A score references a matchup or game outside this round." });
                if (pair.Any(team => team.KingQueenRoundScores.Count(saved => saved.RoundId == score.Game) > 1))
                    return Conflict(new { message = "A game has duplicate score records. Existing scores were preserved." });
                ApplyScore(pair[0], score.Game, score.Points, score.OpponentPoints);
                ApplyScore(pair[1], score.Game, score.OpponentPoints, score.Points);
            }
            details.Version = Guid.NewGuid();
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { details.Version });
        }

        private static void ApplyScore(KingQueenTeam team, int game, int points, int opponentPoints)
        {
            var score = team.KingQueenRoundScores.SingleOrDefault(row => row.RoundId == game);
            if (score == null)
            {
                score = new KingQueenRoundScores { KingQueenTeamId = team.Id, RoundId = game };
                team.KingQueenRoundScores.Add(score);
            }
            score.RoundScore = points;
            score.RoundWon = points > opponentPoints;
        }
    }
}

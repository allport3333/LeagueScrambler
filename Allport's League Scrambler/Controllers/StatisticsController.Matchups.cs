using System;
using System.Data;
using System.Globalization;
using System.Linq;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers
{
    public partial class StatisticsController
    {
        [HttpGet("GetMatchupScores/{leagueId}")]
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult GetMatchupScores(int leagueId, string date)
        {
            DateTime day;
            if (!TryScoreDate(date, out day)) return BadRequest("Select a valid date (yyyy-MM-dd).");
            using (var context = new DataContext())
            {
                if (!LeagueAccess.CanManage(User, context, leagueId)) return Forbid();
                var end = day.AddDays(1);
                // Both ends of a score must belong to the selected league.
                var scores = context.LeagueTeamScore.AsNoTracking()
                    .Where(s => s.LeagueTeam.LeagueID == leagueId && s.OpponentsTeam.LeagueID == leagueId
                        && s.Date >= day && s.Date < end)
                    .OrderBy(s => s.Id)
                    .Select(s => new { s.Id, TeamId = s.LeagueTeamId, OpponentsTeamId = s.OpponentsLeagueTeamId,
                        s.TeamScore, s.WonGame }).ToList();
                return Ok(scores);
            }
        }

        [HttpPost("RecordMatchupScores")]
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public IActionResult RecordMatchupScores([FromBody] MatchupScoresDto dto)
        {
            DateTime day;
            if (!ModelState.IsValid || dto == null || dto.LeagueId <= 0 || dto.Team1Id <= 0 || dto.Team2Id <= 0
                || dto.Team1Id == dto.Team2Id || !TryScoreDate(dto.Date, out day)
                || dto.Games == null || dto.Games.Count < 1 || dto.Games.Count > 10
                || dto.Games.Any(g => g == null || !g.Team1Score.HasValue || !g.Team2Score.HasValue
                    || g.Team1Score < 0 || g.Team2Score < 0))
                return BadRequest("Choose two different league teams, a valid date, and complete scores for every game (1–10 games).");

            using (var context = new DataContext())
            {
                if (!LeagueAccess.CanManage(User, context, dto.LeagueId)) return Forbid();
                using (var transaction = context.Database.BeginTransaction(IsolationLevel.Serializable))
                {
                    // Serialize this screen's saves within a league, including standings recalculation.
                    // Transaction-owned SQL application lock requires no schema or persistent objects.
                    var resource = "LeagueScrambler:MatchupScores:" + dto.LeagueId;
                    context.Database.ExecuteSqlRaw(
                        "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={0}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000, 'Another score save is in progress. Retry after refreshing.', 1;", resource);
                    var teams = context.LeagueTeam.Where(t => t.LeagueID == dto.LeagueId
                        && (t.Id == dto.Team1Id || t.Id == dto.Team2Id)).ToList();
                    if (teams.Count != 2) return BadRequest("Both teams must belong to the selected league.");
                    var end = day.AddDays(1);
                    if (dto.ScheduleId.HasValue && !context.LeagueSchedule.Any(s => s.Id == dto.ScheduleId.Value
                        && s.LeagueId == dto.LeagueId && s.Date >= day && s.Date < end
                        && s.Team1Id == dto.Team1Id && s.Team2Id == dto.Team2Id))
                        return BadRequest("The scheduled matchup has changed. Reload the selected date.");

                    // A historical partial result also blocks insertion; never attempt to fill or replace it.
                    if (context.LeagueTeamScore.Any(s => s.Date >= day && s.Date < end
                        && ((s.LeagueTeamId == dto.Team1Id && s.OpponentsLeagueTeamId == dto.Team2Id)
                         || (s.LeagueTeamId == dto.Team2Id && s.OpponentsLeagueTeamId == dto.Team1Id))))
                        return Conflict(new { message = "Scores already exist for these teams on this date. Reload to inspect the saved records; nothing was replaced." });

                    foreach (var game in dto.Games)
                    {
                        context.LeagueTeamScore.Add(new LeagueTeamScore { LeagueTeamId = dto.Team1Id,
                            OpponentsLeagueTeamId = dto.Team2Id, Date = day, TeamScore = game.Team1Score.Value,
                            WonGame = game.Team1Score > game.Team2Score });
                        context.LeagueTeamScore.Add(new LeagueTeamScore { LeagueTeamId = dto.Team2Id,
                            OpponentsLeagueTeamId = dto.Team1Id, Date = day, TeamScore = game.Team2Score.Value,
                            WonGame = game.Team2Score > game.Team1Score });
                    }
                    context.SaveChanges();
                    // Keep existing semantics: ties count as a loss for each team.
                    foreach (var team in teams)
                    {
                        team.TotalWins = context.LeagueTeamScore.Count(s => s.LeagueTeamId == team.Id && s.WonGame);
                        team.TotalLosses = context.LeagueTeamScore.Count(s => s.LeagueTeamId == team.Id && !s.WonGame);
                    }
                    context.SaveChanges();
                    transaction.Commit();
                    return Ok(new { message = "Scores saved and standings updated.", gamesSaved = dto.Games.Count });
                }
            }
        }

        private static bool TryScoreDate(string value, out DateTime day)
        {
            return DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out day) && day.Year >= 1753 && day.Year < 9999;
        }
    }
}

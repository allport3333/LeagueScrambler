using System;
using System.Collections.Generic;
using Allport_s_League_Scrambler.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers
{
    // Same public read-only visibility as GetKingQueenTeamsByScrambleNumbers.
    // Returns aggregate IDs/counts only, not player profiles, scores, byes or pending previews.
    [Route("api/ScrambleData")]
    public class ScramblerHistoryController : Controller
    {
        [HttpGet("TeammateHistory/{leagueId:int}")]
        [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
        public IActionResult TeammateHistory(int leagueId)
        {
            if (leagueId <= 0) return BadRequest("A valid league is required.");
            try
            {
                using (var context = new DataContext())
                {
                    if (!System.Linq.Queryable.Any(context.Leagues, l => l.ID == leagueId)) return NotFound("League unavailable.");
                    context.Database.OpenConnection();
                    using (var command = context.Database.GetDbConnection().CreateCommand())
                    {
                        command.CommandText = @"
WITH Members AS (
 SELECT DISTINCT m.KingQueenTeamId, m.PlayerId
 FROM dbo.KingQueenPlayer m
 INNER JOIN dbo.KingQueenTeam t ON t.Id = m.KingQueenTeamId
 INNER JOIN dbo.Player p ON p.Id = m.PlayerId
 WHERE t.LeagueID = @leagueId AND t.ScrambleWithScoresToBeSaved = 1 AND p.Id > 0
)
SELECT a.PlayerId, b.PlayerId, COUNT(DISTINCT a.KingQueenTeamId)
FROM Members a INNER JOIN Members b ON a.KingQueenTeamId = b.KingQueenTeamId AND a.PlayerId < b.PlayerId
GROUP BY a.PlayerId, b.PlayerId";
                        var parameter = command.CreateParameter(); parameter.ParameterName = "@leagueId"; parameter.Value = leagueId; command.Parameters.Add(parameter);
                        var pairs = new List<TeammateFrequency>();
                        using (var reader = command.ExecuteReader())
                            while (reader.Read()) pairs.Add(new TeammateFrequency { Player1Id = reader.GetInt32(0), Player2Id = reader.GetInt32(1), Count = reader.GetInt32(2) });
                        return Ok(new { leagueId, pairs });
                    }
                }
            }
            catch (Exception)
            {
                // An unavailable query is not an empty history. Keep database diagnostics out of public responses.
                return StatusCode(503, "League teammate history is unavailable. Please retry.");
            }
        }
        public sealed class TeammateFrequency { public int Player1Id { get; set; } public int Player2Id { get; set; } public int Count { get; set; } }
    }
}

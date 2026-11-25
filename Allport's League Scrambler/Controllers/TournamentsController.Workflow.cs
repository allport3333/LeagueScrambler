using System;
using System.Data;
using System.Collections.Generic;
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
        public sealed record WorkflowInput(int Step);
        public const int OwnedTournamentLimit = 3;

        [HttpGet("~/api/tournaments")]
        [HttpGet("~/api/tournaments/managed")]
        public async Task<IActionResult> ListManaged()
        {
            if (!LeagueAccess.TryGetAccountId(User, out var account)) return Forbid();
            await using var db = new DataContext();
            var isAdmin = User.IsInRole("Admin");
            var events = await db.Leagues.Where(row => row.EventTypeId == 2 &&
                (isAdmin || db.TournamentConfigurations.Any(config => config.LeagueId == row.ID && config.OwnerUserId == account)))
                .OrderBy(row => row.LeagueName).ToListAsync();
            var ids = events.Select(row => row.ID).ToArray();
            if (!isAdmin) Response.Headers["X-Owned-Tournament-Count"] = events.Count.ToString(System.Globalization.CultureInfo.InvariantCulture);
            Response.Headers["X-Tournaments-Exist"] =
                (events.Count != 0 || await db.Leagues.AnyAsync(row => row.EventTypeId == 2)) ? "true" : "false";
            var settings = await db.TournamentConfigurations.AsNoTracking().Where(row => ids.Contains(row.LeagueId))
                .ToDictionaryAsync(row => row.LeagueId);
            var rosterSizes = await db.PlayersLeagues.Where(row => ids.Contains(row.LeagueID))
                .GroupBy(row => row.LeagueID).Select(group => new { id = group.Key, count = group.Select(row => row.PlayerID).Distinct().Count() })
                .ToDictionaryAsync(row => row.id, row => row.count);
            var rounds = (await db.TournamentRounds.AsNoTracking().Where(row => ids.Contains(row.LeagueId) && row.VoidedAtUtc == null).ToListAsync())
                .ToLookup(row => row.LeagueId);
            var legacyScrambles = await db.KingQueenTeam.Where(team => ids.Contains(team.LeagueID) && team.ScrambleWithScoresToBeSaved &&
                !db.TournamentRounds.Any(round => round.LeagueId == team.LeagueID && round.ScrambleNumber == team.ScrambleNumber))
                .GroupBy(team => team.LeagueID).Select(group => new { id = group.Key, count = group.Select(team => team.ScrambleNumber).Distinct().Count() })
                .ToDictionaryAsync(row => row.id, row => row.count);
            var teams = (await db.KingQueenTeam.AsNoTracking().Where(team => ids.Contains(team.LeagueID) &&
                db.TournamentRounds.Any(round => round.LeagueId == team.LeagueID && round.ScrambleNumber == team.ScrambleNumber))
                .Include(team => team.KingQueenRoundScores).ToListAsync()).ToLookup(team => (team.LeagueID, team.ScrambleNumber));
            return Ok(events.Select(row =>
            {
                var config = settings.GetValueOrDefault(row.ID);
                var total = config?.RoundSettingsJson != null ? DecodeSettings(config).NumberOfRounds : 0;
                var generated = rounds[row.ID].Count();
                var completed = rounds[row.ID].Count(round => Services.TournamentMatchupResults.IsComplete(
                    teams[(row.ID, round.ScrambleNumber)], round.GamesPerMatchup));
                var status = Services.TournamentMatchupResults.TournamentStatus(total, generated, completed, config?.WorkflowStep ?? 1);
                return new { row.ID, row.LeagueName, row.EventTypeId, eventDate = config?.EventDate.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                    participants = rosterSizes.GetValueOrDefault(row.ID), total, generated, completed, status,
                    workflowStep = config?.WorkflowStep ?? 1, legacyScrambles = legacyScrambles.GetValueOrDefault(row.ID) };
            }));
        }

        [HttpPut("workflow")]
        [SameOrigin]
        public async Task<IActionResult> Advance(int leagueId, [FromBody] WorkflowInput input)
        {
            if (!ModelState.IsValid || input == null || input.Step is < 1 or > 5) return BadRequest();
            await using var db = new DataContext();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await LockTournamentWrites(db, leagueId);
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var config = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (config == null) return NotFound();
            if (input.Step > config.WorkflowStep) return Conflict(new { message = "Complete the previous setup steps first." });
            if (input.Step == 1 && config.EventDate == default)
                return BadRequest(new { message = "Save tournament details before continuing." });
            if (input.Step == 2 && await Roster(db, leagueId).CountAsync() < 2)
                return BadRequest(new { message = "Add at least two participants before continuing." });
            if (input.Step is 3 or 4 && config.RoundSettingsJson == null)
                return BadRequest(new { message = "Save the round settings before continuing." });
            if (input.Step == 5)
            {
                var date = config.EventDate.ToDateTime(TimeOnly.MinValue);
                var unavailable = DecodeSettings(config).UnavailablePlayerIds;
                var eligibility = Roster(db, leagueId).Where(player => !unavailable.Contains(player.Id));
                if (config.CheckInMode is TournamentCheckInMode.NotConfigured)
                    return BadRequest(new { message = "Choose who can play before continuing." });
                if (config.CheckInMode != TournamentCheckInMode.Skipped)
                    eligibility = eligibility.Where(player => db.PlayerSignIn.Any(row =>
                        row.LeagueId == leagueId && row.PlayerId == player.Id && row.DateTime.Date == date));
                if (await eligibility.CountAsync() < 2)
                    return BadRequest(new { message = "Two eligible players are required to generate rounds. You can resume this step on tournament day." });
            }
            config.WorkflowStep = Math.Max(config.WorkflowStep, input.Step + 1);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(new { step = config.WorkflowStep });
        }
        [HttpDelete("participants/{playerId:int}")]
        [SameOrigin]
        public async Task<IActionResult> RemoveParticipant(int leagueId, int playerId)
        {
            await using var db = new DataContext();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await LockTournamentWrites(db, leagueId);
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var config = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (config == null) return NotFound();
            var membership = await db.PlayersLeagues
                .Where(row => row.LeagueID == leagueId && row.PlayerID == playerId).ToListAsync();
            db.PlayersLeagues.RemoveRange(membership);
            if (config.RoundSettingsJson != null)
            {
                var settings = DecodeSettings(config);
                config.RoundSettingsJson = System.Text.Json.JsonSerializer.Serialize(settings with
                {
                    TopPlayerIds = settings.TopPlayerIds.Where(id => id != playerId).ToArray(),
                    LowPlayerIds = settings.LowPlayerIds.Where(id => id != playerId).ToArray(),
                    ManualByes = settings.ManualByes.Where(bye => bye.PlayerId != playerId).ToArray()
                });
            }
            config.Version = Guid.NewGuid();
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return NoContent();
        }
    }
}

using System;
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
    [Route("api/tournaments/{leagueId:int}")]
    [Authorize]
    public partial class TournamentsController : ControllerBase
    {
        public record DetailsInput(string Name, DateOnly EventDate, string Description, string Location, Guid? Version);

        [Authorize(Policy = "LeagueManagement")]
        [HttpGet]
        public async Task<IActionResult> Read(int leagueId)
        {
            await using var db = new DataContext();
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var name = await db.Leagues.Where(league => league.ID == leagueId && league.EventTypeId == 2)
                .Select(league => league.LeagueName).SingleOrDefaultAsync();
            if (name == null) return NotFound();
            var details = await db.TournamentConfigurations.AsNoTracking().SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            var participants = await db.PlayersLeagues.Where(row => row.LeagueID == leagueId)
                .Select(row => row.PlayerID).Distinct().CountAsync();
            var rounds = await db.TournamentRounds.AsNoTracking().Where(round => round.LeagueId == leagueId).ToListAsync();
            var active = rounds.Where(round => round.VoidedAtUtc == null).ToArray();
            var numbers = active.Select(round => round.ScrambleNumber).ToArray();
            var teams = (await db.KingQueenTeam.AsNoTracking().Where(team => team.LeagueID == leagueId && numbers.Contains(team.ScrambleNumber))
                .Include(team => team.KingQueenRoundScores).ToListAsync()).ToLookup(team => team.ScrambleNumber);
            var completed = active.Count(round => Services.TournamentMatchupResults.IsComplete(
                teams[round.ScrambleNumber], round.GamesPerMatchup));
            var total = details?.RoundSettingsJson != null ? DecodeSettings(details).NumberOfRounds : 0;
            var status = Services.TournamentMatchupResults.TournamentStatus(total, active.Length, completed, details?.WorkflowStep ?? 1);
            var hasRounds = rounds.Count != 0;
            return Ok(new { name, details, participants, hasRounds, status });
        }

        [Authorize(Policy = "LeagueManagement")]
        [HttpPut("details")]
        [SameOrigin]
        public async Task<IActionResult> SaveDetails(int leagueId, [FromBody] DetailsInput input)
        {
            var name = input?.Name?.Trim();
            if (input == null || !ModelState.IsValid || string.IsNullOrEmpty(name) || name.Length > 50 || input.EventDate == default ||
                input.Description?.Length > 500 || input.Location?.Length > 120)
                return BadRequest(new { message = "Enter a valid date, description, and location." });

            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var league = await db.Leagues.SingleOrDefaultAsync(row => row.ID == leagueId && row.EventTypeId == 2);
            if (league == null) return NotFound();
            if (await db.Leagues.AnyAsync(row => row.ID != leagueId && row.LeagueName == name))
                return Conflict(new { message = "An event with that name already exists." });
            var details = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details?.Version != input.Version)
                return Conflict(new { message = "These details changed. Reload the tournament before saving." });
            if (details != null && details.EventDate != input.EventDate &&
                (details.CheckInMode != TournamentCheckInMode.NotConfigured || await db.PlayerSignIn.AnyAsync(
                    row => row.LeagueId == leagueId && row.DateTime.Date == details.EventDate.ToDateTime(TimeOnly.MinValue))))
                return Conflict(new { message = "The tournament date cannot change after check-in is configured or attendance is recorded." });
            if (details == null)
            {
                details = new TournamentConfiguration { LeagueId = leagueId };
                db.TournamentConfigurations.Add(details);
            }
            details.EventDate = input.EventDate;
            details.Description = input.Description?.Trim();
            details.Location = input.Location?.Trim();
            details.Version = Guid.NewGuid();
            league.LeagueName = name;
            try
            {
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "These details changed. Reload the tournament before saving." });
            }
            return Ok(new { name, details });
        }
    }
}

using System;
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
        public sealed record RoundSettingsInput(Guid Version, TournamentRoundSettings Settings);

        [Authorize(Policy = "LeagueManagement")]
        [HttpGet("round-settings")]
        public async Task<IActionResult> ReadRoundSettings(int leagueId)
        {
            await using var db = new DataContext();
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var details = await db.TournamentConfigurations.AsNoTracking()
                .SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details == null) return NotFound();
            var roster = await Roster(db, leagueId).OrderBy(row => row.LastName).ThenBy(row => row.FirstName)
                .Select(row => new { row.Id, row.FirstName, row.LastName, row.IsMale }).ToListAsync();
            var date = details.EventDate.ToDateTime(TimeOnly.MinValue);
            var presentIds = await db.PlayerSignIn.Where(row => row.LeagueId == leagueId && row.DateTime.Date == date)
                .Select(row => row.PlayerId).Distinct().ToListAsync();
            var history = await db.KingQueenTeam.AsNoTracking()
                .Where(row => row.LeagueID == leagueId && row.KingQueenPlayers.Any())
                .Select(row => new
                {
                    teamId = row.Id, row.ScrambleNumber, row.DateOfTeam,
                    playerIds = row.KingQueenPlayers.Select(player => player.PlayerId).Distinct().ToArray()
                }).ToListAsync();
            return Ok(new
            {
                details.Version, mode = (int)details.CheckInMode, roster, presentIds, history,
                settings = DecodeSettings(details)
            });
        }

        [Authorize(Policy = "LeagueManagement")]
        [HttpPut("round-settings")]
        [SameOrigin]
        public async Task<IActionResult> SaveRoundSettings(int leagueId, [FromBody] RoundSettingsInput input)
        {
            if (input?.Settings == null || !ModelState.IsValid) return BadRequest();
            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await LockTournamentWrites(db, leagueId);
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var details = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details == null) return NotFound();
            if (details.Version != input.Version)
                return Conflict(new { message = "Tournament settings changed. Reload before saving." });
            var roster = (await Roster(db, leagueId).Select(row => row.Id).ToListAsync()).ToHashSet();
            var saved = (await db.KingQueenTeam.Where(row => row.LeagueID == leagueId && row.KingQueenPlayers.Any())
                .Select(row => row.ScrambleNumber).Distinct().ToListAsync()).ToHashSet();
            var error = input.Settings.Validate(roster, saved);
            if (error != null) return BadRequest(new { message = error });
            if (await db.Set<TournamentRound>().AnyAsync(round => round.LeagueId == leagueId && round.RoundNumber > input.Settings.NumberOfRounds))
                return Conflict(new { message = "The round count cannot be reduced below already saved rounds." });
            details.RoundSettingsJson = JsonSerializer.Serialize(input.Settings);
            details.Version = Guid.NewGuid();
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { details.Version, settings = input.Settings });
        }

        private static TournamentRoundSettings DecodeSettings(TournamentConfiguration details) =>
            details.RoundSettingsJson == null ? new TournamentRoundSettings() :
                JsonSerializer.Deserialize<TournamentRoundSettings>(details.RoundSettingsJson);

        private static IQueryable<Player> Roster(DataContext db, int leagueId) =>
            db.Players.Where(player => db.PlayersLeagues.Any(row => row.LeagueID == leagueId && row.PlayerID == player.Id));
    }
}

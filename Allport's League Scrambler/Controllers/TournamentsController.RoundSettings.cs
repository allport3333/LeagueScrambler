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
            var latest = await db.Set<TournamentRound>().AsNoTracking().Where(round => round.LeagueId == leagueId)
                .OrderByDescending(round => round.RoundNumber).FirstOrDefaultAsync();
            return Ok(new
            {
                details.Version, mode = (int)details.CheckInMode, roster, presentIds, history,
                settings = DecodeSettings(details), additionalDefaults = latest == null ? null : SavedGenerationSettings(latest)
            });
        }

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
            var highest = await db.TournamentRounds.Where(round => round.LeagueId == leagueId)
                .MaxAsync(round => (int?)round.RoundNumber);
            var error = input.Settings.Validate(roster, saved, highest);
            if (error != null) return BadRequest(new { message = error });
            if (highest.HasValue)
            {
                var current = DecodeSettings(details);
                if (input.Settings.NumberOfRounds != current.NumberOfRounds || input.Settings.GamesPerMatchup != current.GamesPerMatchup)
                    return Conflict(new { message = "The saved format is fixed. Use Add Additional Rounds to extend the tournament." });
            }
            else if (input.Settings.NumberOfRounds < 1)
                return BadRequest(new { message = "Choose at least one initial round." });
            var original = DecodeSettings(details);
            details.RoundSettingsJson = JsonSerializer.Serialize(input.Settings with
                { UnavailablePlayerIds = original.UnavailablePlayerIds, LastScrambleNumber = original.LastScrambleNumber });
            details.Version = Guid.NewGuid();
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { details.Version, settings = input.Settings });
        }

        internal static TournamentRoundSettings DecodeSettings(TournamentConfiguration details) =>
            details.RoundSettingsJson == null ? new TournamentRoundSettings() :
                JsonSerializer.Deserialize<TournamentRoundSettings>(details.RoundSettingsJson);

        private static IQueryable<Player> Roster(DataContext db, int leagueId) =>
            db.Players.Where(player => db.PlayersLeagues.Any(row => row.LeagueID == leagueId && row.PlayerID == player.Id));
    }
}

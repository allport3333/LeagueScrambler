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
    [Authorize]
    [Route("api/tournament-attendance/{leagueId:int}")]
    public class TournamentAttendanceController : ControllerBase
    {
        public record ModeInput(TournamentCheckInMode Mode, Guid Version);
        public record AttendanceInput(bool Present);

        [HttpGet]
        public async Task<IActionResult> Read(int leagueId)
        {
            if (!LeagueAccess.TryGetAccountId(User, out var userId)) return Unauthorized();
            await using var db = new DataContext();
            var organizers = LeagueAccess.CanManage(User, db, leagueId);
            var eligible = db.PlayersLeagues.Where(row => row.LeagueID == leagueId).Select(row => row.PlayerID);
            var owned = await db.UsersPlayer.Where(row => row.UserId == userId && eligible.Contains(row.PlayerId))
                .Select(row => row.PlayerId).Distinct().Take(2).ToArrayAsync();
            if (!organizers && owned.Length != 1) return Forbid();
            var details = await Load(db, leagueId);
            if (details == null) return NotFound();
            var start = details.EventDate.ToDateTime(TimeOnly.MinValue);
            var end = start.AddDays(1);
            var attended = db.PlayerSignIn.Where(row => row.LeagueId == leagueId && row.DateTime >= start && row.DateTime < end);
            var ownPlayerId = owned.Length == 1 ? (int?)owned[0] : null;
            var players = db.Players.Where(player => eligible.Contains(player.Id));
            if (!organizers) players = players.Where(player => player.Id == ownPlayerId);
            var roster = await players.OrderBy(player => player.LastName).ThenBy(player => player.FirstName).ThenBy(player => player.Id)
                .Select(player => new { player.Id, player.FirstName, player.LastName,
                    Present = attended.Any(row => row.PlayerId == player.Id) }).ToListAsync();
            var name = await db.Leagues.Where(row => row.ID == leagueId).Select(row => row.LeagueName).SingleAsync();
            return Ok(new { name, details.EventDate, mode = (int)details.CheckInMode, details.Version, organizers, ownPlayerId, roster });
        }

        [HttpPut("mode")]
        [SameOrigin]
        public async Task<IActionResult> SaveMode(int leagueId, [FromBody] ModeInput input)
        {
            if (input == null || !ModelState.IsValid || !Enum.IsDefined(input.Mode)) return BadRequest();
            await using var db = new DataContext();
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var details = await Load(db, leagueId);
            if (details == null) return NotFound();
            if (details.Version != input.Version) return Conflict(new { message = "Tournament settings changed. Reload and try again." });
            details.CheckInMode = input.Mode;
            details.Version = Guid.NewGuid();
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Tournament settings changed. Reload and try again." }); }
            return NoContent();
        }

        [HttpPut("players/{playerId:int}")]
        [SameOrigin]
        public async Task<IActionResult> SavePresence(int leagueId, int playerId, [FromBody] AttendanceInput input)
        {
            if (input == null || !ModelState.IsValid || playerId <= 0) return BadRequest();
            if (!LeagueAccess.TryGetAccountId(User, out var userId)) return Unauthorized();
            await using var db = new DataContext();
            var organizers = LeagueAccess.CanManage(User, db, leagueId);
            if (!organizers && !await db.UsersPlayer.AnyAsync(row => row.UserId == userId && row.PlayerId == playerId))
                return Forbid();
            var snapshot = await Load(db, leagueId);
            if (snapshot == null) return NotFound();
            db.ChangeTracker.Clear();
            var start = snapshot.EventDate.ToDateTime(TimeOnly.MinValue);
            var end = start.AddDays(1);
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await AttendanceSerialization.Acquire(db, leagueId, start);
            var details = await Load(db, leagueId);
            if (details == null || details.EventDate != snapshot.EventDate)
                return Conflict(new { message = "Tournament details changed. Reload check-in." });
            organizers = LeagueAccess.CanManage(User, db, leagueId);
            if (!await db.PlayersLeagues.AnyAsync(row => row.LeagueID == leagueId && row.PlayerID == playerId) ||
                (!organizers && !await db.UsersPlayer.AnyAsync(
                    row => row.UserId == userId && row.PlayerId == playerId))) return Forbid();
            var rows = await db.PlayerSignIn.Where(row => row.LeagueId == leagueId && row.PlayerId == playerId &&
                row.DateTime >= start && row.DateTime < end).Take(2).ToListAsync();
            if (rows.Count > 1) return Conflict(new { message = "This player has duplicate attendance records. Review them before editing." });
            if (input.Present && rows.Count == 0)
                db.PlayerSignIn.Add(new PlayerSignIn { LeagueId = leagueId, PlayerId = playerId, DateTime = start });
            if (!input.Present && rows.Count == 1)
                db.PlayerSignIn.Remove(rows[0]);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return NoContent();
        }

        private static Task<TournamentConfiguration> Load(DataContext db, int leagueId) =>
            db.TournamentConfigurations.SingleOrDefaultAsync(details => details.LeagueId == leagueId &&
                db.Leagues.Any(league => league.ID == leagueId && league.EventTypeId == 2));
    }
}

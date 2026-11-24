using System;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Allport_s_League_Scrambler.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers
{
    public partial class TournamentsController
    {
        public sealed record RegistrationInput(string FirstName, string LastName, string Gender, int[] ReviewedMatches, bool ConfirmExact);

        [HttpGet("participant-matches")]
        [Authorize(Policy = "LeagueManagement")]
        public async Task<IActionResult> FindParticipantMatches(int leagueId, string firstName, string lastName)
        {
            if (!ValidNames(firstName, lastName)) return BadRequest();
            await using var db = new DataContext();
            if (!await OwnsSetup(db, leagueId)) return Forbid();
            return Ok(await FindMatches(db, firstName, lastName));
        }

        [HttpPost("participants/register")]
        [SameOrigin]
        [Authorize(Policy = "LeagueManagement")]
        public async Task<IActionResult> RegisterParticipant(int leagueId, [FromBody] RegistrationInput input)
        {
            if (!ModelState.IsValid || input == null || !ValidNames(input.FirstName, input.LastName) ||
                input.Gender is not ("Male" or "Female")) return BadRequest(new { message = "Enter valid names and choose a gender." });
            await using var db = new DataContext();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await db.Database.ExecuteSqlRawAsync(
                "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='LeagueHub:PlayerRegistration', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000, 'Registration is busy. Please retry.', 1;");
            if (!await OwnsSetup(db, leagueId)) return Forbid();
            var matches = await FindMatches(db, input.FirstName, input.LastName);
            if ((matches.Any(match => match.Exact) && !input.ConfirmExact) ||
                !matches.Select(match => match.Id).ToHashSet().SetEquals(input.ReviewedMatches ?? Array.Empty<int>()))
                return Conflict(new { message = "Review the current matches before registering.", matches });
            var player = new Player { FirstName = PlayerNameMatches.Clean(input.FirstName), LastName = PlayerNameMatches.Clean(input.LastName),
                Gender = input.Gender, IsMale = input.Gender == "Male" };
            db.Players.Add(player);
            await db.SaveChangesAsync();
            db.PlayersLeagues.Add(new PlayersLeague { LeagueID = leagueId, PlayerID = player.Id });
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(player);
        }

        private async Task<bool> OwnsSetup(DataContext db, int leagueId) =>
            LeagueAccess.CanManage(User, db, leagueId) && await db.TournamentConfigurations.AnyAsync(row => row.LeagueId == leagueId);

        private static bool ValidNames(string first, string last) =>
            first?.Length <= 100 && last?.Length <= 100 && !string.IsNullOrWhiteSpace(first) && !string.IsNullOrWhiteSpace(last);

        private static async Task<PlayerNameMatches.Match[]> FindMatches(DataContext db, string first, string last) =>
            PlayerNameMatches.Find(first, last, await db.Players.AsNoTracking()
                .Select(row => new Player { Id = row.Id, FirstName = row.FirstName, LastName = row.LastName, IsMale = row.IsMale }).ToListAsync());
    }
}

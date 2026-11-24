using System;
using System.Collections.Generic;
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
        public sealed record Allocation(int RoundNumber, int[][] Teams, int[] Byes);
        public sealed record SaveRoundsInput(Guid Version, bool AllowHistoricalFallback, Allocation[] Rounds);

        [HttpGet("rounds")]
        public async Task<IActionResult> ReadRounds(int leagueId)
        {
            await using var db = new DataContext();
            if (!LeagueAccess.CanManage(User, db, leagueId) &&
                (!LeagueAccess.TryGetAccountId(User, out var accountId) ||
                 !await db.UsersPlayer.AnyAsync(link => link.UserId == accountId &&
                    db.PlayersLeagues.Any(member => member.LeagueID == leagueId && member.PlayerID == link.PlayerId))))
                return Forbid();
            var details = await db.TournamentConfigurations.AsNoTracking().SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details == null) return NotFound();
            var rounds = await db.Set<TournamentRound>().AsNoTracking().Where(row => row.LeagueId == leagueId)
                .OrderBy(row => row.RoundNumber).ToListAsync();
            var numbers = rounds.Select(row => row.ScrambleNumber).ToArray();
            var teams = await db.KingQueenTeam.AsNoTracking()
                .Where(team => team.LeagueID == leagueId && numbers.Contains(team.ScrambleNumber))
                .Include(team => team.KingQueenPlayers).ThenInclude(player => player.Player)
                .Include(team => team.KingQueenRoundScores).AsSplitQuery().OrderBy(team => team.Id).ToListAsync();
            var byes = await db.ByeRounds.AsNoTracking()
                .Where(row => row.LeagueID == leagueId && numbers.Contains(row.ScrambleNumber))
                .Include(row => row.ByePlayers).ThenInclude(player => player.Player).ToListAsync();
            return Ok(new
            {
                details.Version,
                name = await db.Leagues.Where(row => row.ID == leagueId).Select(row => row.LeagueName).SingleAsync(),
                settingsSaved = details.RoundSettingsJson != null,
                rounds = rounds.Select(round =>
                {
                    var roundTeams = teams.Where(team => team.ScrambleNumber == round.ScrambleNumber).ToArray();
                    var scored = roundTeams.Sum(team => team.KingQueenRoundScores.Count);
                    return new
                    {
                        round.RoundNumber, round.ScrambleNumber, round.GamesPerMatchup,
                        status = scored == 0 ? "unplayed" : scored == roundTeams.Length * round.GamesPerMatchup ? "completed" : "partial",
                        teams = roundTeams.Select(team => new
                        {
                            team.Id,
                            players = team.KingQueenPlayers.OrderBy(player => player.Id)
                                .Select(player => new { player.Player.Id, player.Player.FirstName, player.Player.LastName }),
                            scores = team.KingQueenRoundScores.OrderBy(score => score.RoundId)
                                .Select(score => new { game = score.RoundId, points = score.RoundScore })
                        }),
                        byes = byes.Where(row => row.ScrambleNumber == round.ScrambleNumber)
                            .SelectMany(row => row.ByePlayers)
                            .Select(player => new { player.Player.Id, player.Player.FirstName, player.Player.LastName })
                    };
                })
            });
        }

        [Authorize(Policy = "LeagueManagement")]
        [HttpPut("rounds")]
        [SameOrigin]
        [RequestSizeLimit(262144)]
        public async Task<IActionResult> SaveRounds(int leagueId, [FromBody] SaveRoundsInput input)
        {
            if (!ModelState.IsValid || input?.Rounds == null || input.Rounds.Length is < 1 or > 30 ||
                input.Rounds.Any(round => round == null) ||
                input.Rounds.Select(round => round.RoundNumber).Distinct().Count() != input.Rounds.Length)
                return BadRequest(new { message = "Provide one allocation per tournament round." });

            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await LockTournamentWrites(db, leagueId);
            if (!LeagueAccess.CanManage(User, db, leagueId)) return Forbid();
            var details = await db.TournamentConfigurations.SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details == null) return NotFound();
            if (details.Version != input.Version || details.RoundSettingsJson == null)
                return Conflict(new { message = "Save the tournament settings and reload before generating." });
            if (details.CheckInMode == TournamentCheckInMode.NotConfigured)
                return Conflict(new { message = "Configure check-in or choose Skip Check In before generating." });

            var settings = DecodeSettings(details);
            var roster = (await Roster(db, leagueId).Select(row => row.Id).ToListAsync()).ToHashSet();
            var date = details.EventDate.ToDateTime(TimeOnly.MinValue);
            var eligible = details.CheckInMode == TournamentCheckInMode.Skipped ? roster :
                (await db.PlayerSignIn.Where(row => row.LeagueId == leagueId && row.DateTime.Date == date)
                    .Select(row => row.PlayerId).Distinct().ToListAsync()).Where(roster.Contains).ToHashSet();
            if (eligible.Count is < 2 or > 256)
                return BadRequest(new { message = "Generation requires 2 to 256 eligible participants." });

            var roundSet = db.Set<TournamentRound>();
            var current = await roundSet.Where(row => row.LeagueId == leagueId).ToDictionaryAsync(row => row.RoundNumber);
            var requested = input.Rounds.Select(row => row.RoundNumber).ToHashSet();
            if (requested.Any(number => number < 1 || number > settings.NumberOfRounds) ||
                (current.Count == 0 && requested.Count != settings.NumberOfRounds))
                return BadRequest(new { message = "First generation must include every configured round." });

            var replacements = current.Values.Where(round => requested.Contains(round.RoundNumber)).ToArray();
            var replacedNumbers = replacements.Select(round => round.ScrambleNumber).ToArray();
            if (settings.HistoricalScrambleNumbers.Intersect(replacedNumbers).Any())
                return Conflict(new { message = "Remove the round you are replacing from strict historical exclusions first." });

            var existingTeams = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId &&
                replacedNumbers.Contains(team.ScrambleNumber)).Include(team => team.KingQueenPlayers)
                .Include(team => team.KingQueenRoundScores).AsSplitQuery().ToListAsync();
            if (existingTeams.Any(team => team.KingQueenRoundScores.Count != 0))
                return Conflict(new { message = "Scored rounds cannot be replaced." });
            var historical = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId &&
                settings.HistoricalScrambleNumbers.Contains(team.ScrambleNumber) && team.KingQueenPlayers.Any())
                .Select(team => new { team.ScrambleNumber, players = team.KingQueenPlayers.Select(p => p.PlayerId).ToArray() })
                .ToListAsync();
            var error = settings.Validate(roster, historical.Select(team => team.ScrambleNumber).ToHashSet());
            if (error != null) return BadRequest(new { message = error });
            var prohibited = historical.SelectMany(team => TeamPairs(team.players)).ToHashSet();
            foreach (var round in input.Rounds)
            {
                error = ValidateAllocation(round, settings, eligible, prohibited, input.AllowHistoricalFallback);
                if (error != null) return BadRequest(new { message = $"Round {round.RoundNumber}: {error}" });
            }

            var oldByes = await db.ByeRounds.Where(row => row.LeagueID == leagueId && replacedNumbers.Contains(row.ScrambleNumber))
                .Include(row => row.ByePlayers).ToListAsync();
            db.ByePlayer.RemoveRange(oldByes.SelectMany(row => row.ByePlayers));
            db.ByeRounds.RemoveRange(oldByes);
            db.KingQueenPlayer.RemoveRange(existingTeams.SelectMany(row => row.KingQueenPlayers));
            db.KingQueenTeam.RemoveRange(existingTeams);
            var maxNumber = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId)
                .Select(team => (int?)team.ScrambleNumber).MaxAsync() ?? 0;
            foreach (var round in input.Rounds.OrderBy(row => row.RoundNumber))
            {
                if (!current.TryGetValue(round.RoundNumber, out var stored))
                {
                    stored = new TournamentRound { LeagueId = leagueId, RoundNumber = round.RoundNumber };
                    roundSet.Add(stored);
                }
                stored.ScrambleNumber = ++maxNumber;
                stored.GamesPerMatchup = settings.GamesPerMatchup;
                stored.GenerationJson = JsonSerializer.Serialize(new { settings, eligible = eligible.Order(), input.AllowHistoricalFallback });
                foreach (var team in round.Teams)
                    db.KingQueenTeam.Add(new KingQueenTeam
                    {
                        LeagueID = leagueId, ScrambleNumber = stored.ScrambleNumber, DateOfTeam = date,
                        ScrambleWithScoresToBeSaved = true,
                        KingQueenPlayers = team.Select(id => new KingQueenPlayer { PlayerId = id }).ToList()
                    });
                if (round.Byes.Length != 0)
                    db.ByeRounds.Add(new ByeRounds
                    {
                        LeagueID = leagueId, ScrambleNumber = stored.ScrambleNumber, DateOfRound = date,
                        ByePlayers = round.Byes.Select(id => new ByePlayer { PlayerId = id }).ToList()
                    });
            }
            details.WorkflowStep = 7;
            details.Version = Guid.NewGuid();
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { details.Version });
        }

        private static Task LockTournamentWrites(DataContext db, int leagueId) =>
            db.Database.ExecuteSqlRawAsync(
                "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={0}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000, 'Tournament is busy. Please retry.', 1;",
                "LeagueHub:Tournament:" + leagueId);

        private static string ValidateAllocation(Allocation round, TournamentRoundSettings settings, HashSet<int> eligible,
            HashSet<(int, int)> prohibited, bool allowFallback)
        {
            if (round.Teams == null || round.Teams.Length is < 2 or > 128 || round.Teams.Any(team => team == null || team.Length == 0) ||
                round.Byes == null)
                return "Every matchup needs two nonempty teams.";
            var active = round.Teams.SelectMany(team => team).ToArray();
            var assigned = active.Concat(round.Byes).ToArray();
            if (assigned.Length != eligible.Count || assigned.Distinct().Count() != eligible.Count || !eligible.SetEquals(assigned))
                return "The eligible roster changed, or an eligible player was missing or assigned more than once.";
            var manual = settings.ManualByes.Where(bye => bye.RoundNumber == round.RoundNumber).Select(bye => bye.PlayerId).ToHashSet();
            var capacity = (settings.ActiveTeamLimit ?? 128) * (settings.MaximumTeamSize ?? 256);
            var expectedByes = manual.Count + Math.Max(0, eligible.Count - manual.Count - capacity);
            if (round.Byes.Length != expectedByes || !manual.IsSubsetOf(round.Byes) ||
                (!settings.AutomaticByes && expectedByes != manual.Count))
                return "Bye assignments do not match the manual selections and active team capacity.";
            var count = settings.NumberOfTeams ?? 2 * (int)Math.Ceiling(active.Length / (2.0 * settings.MaximumTeamSize.Value));
            if (count != round.Teams.Length || round.Teams.Max(team => team.Length) - round.Teams.Min(team => team.Length) > 1)
                return "Team sizes or count do not match the saved settings.";
            if (settings.BalancePriorities)
            {
                var retained = settings.TopPlayerIds.Where(active.Contains).Take(count).ToHashSet();
                if (round.Teams.Any(team => team.Count(retained.Contains) > 1))
                    return "Retained top players must be on separate teams.";
            }
            if (!allowFallback && round.Teams.SelectMany(TeamPairs).Any(prohibited.Contains))
                return "An assignment contains a strict historical teammate pairing.";
            return null;
        }

        private static IEnumerable<(int, int)> TeamPairs(int[] players)
        {
            for (var i = 0; i < players.Length; i++)
                for (var j = i + 1; j < players.Length; j++)
                    yield return (Math.Min(players[i], players[j]), Math.Max(players[i], players[j]));
        }
    }
}

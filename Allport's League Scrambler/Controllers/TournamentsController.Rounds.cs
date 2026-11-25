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
        public sealed record SaveRoundsInput(Guid Version, bool AllowHistoricalFallback, Allocation[] Rounds,
            TournamentRoundSettings AdditionalSettings = null,
            bool PreserveSavedByes = false, bool ManuallyEdited = false);

        [HttpGet("rounds")]
        public async Task<IActionResult> ReadRounds(int leagueId)
        {
            await using var db = new DataContext();
            var name = await db.Leagues.Where(row => row.ID == leagueId && row.EventTypeId == 2)
                .Select(row => row.LeagueName).SingleOrDefaultAsync();
            if (name == null)
                return NotFound(new { message = "Tournament not found. It may have been deleted." });
            if (!LeagueAccess.CanManage(User, db, leagueId) &&
                (!LeagueAccess.TryGetAccountId(User, out var accountId) ||
                 !await db.UsersPlayer.AnyAsync(link => link.UserId == accountId &&
                    db.PlayersLeagues.Any(member => member.LeagueID == leagueId && member.PlayerID == link.PlayerId))))
                return Forbid();
            var details = await db.TournamentConfigurations.AsNoTracking().SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            if (details == null) return NotFound();
            var manage = LeagueAccess.CanManage(User, db, leagueId);
            var rounds = await db.Set<TournamentRound>().AsNoTracking().Where(row => row.LeagueId == leagueId && (manage || row.VoidedAtUtc == null))
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
                name,
                settingsSaved = details.RoundSettingsJson != null,
                canVoid = manage && User.IsInRole("Admin"),
                rounds = rounds.Select(round =>
                {
                    var roundTeams = teams.Where(team => team.ScrambleNumber == round.ScrambleNumber).ToArray();
                    return new
                    {
                        round.RoundNumber, round.ScrambleNumber, round.GamesPerMatchup,
                        manualByeIds = SavedManualByeIds(round),
                        round.VoidedAtUtc, round.VoidedByUserId,
                        status = round.VoidedAtUtc != null ? "voided" : Services.TournamentMatchupResults.RoundStatus(roundTeams, round.GamesPerMatchup),
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

        private static TournamentRoundSettings SavedGenerationSettings(TournamentRound round)
        {
            if (string.IsNullOrEmpty(round.GenerationJson)) return null;
            using var generation = JsonDocument.Parse(round.GenerationJson);
            if (generation.RootElement.ValueKind != JsonValueKind.Object ||
                !generation.RootElement.TryGetProperty("settings", out var settings) || settings.ValueKind != JsonValueKind.Object) return null;
            return settings.Deserialize<TournamentRoundSettings>();
        }

        private static int[] SavedManualByeIds(TournamentRound round) =>
            SavedGenerationSettings(round)?.ManualByes?.Where(bye => bye.RoundNumber == round.RoundNumber).Select(bye => bye.PlayerId).ToArray();

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
                return Conflict(new { message = "Choose who can play before generating rounds." });

            var originalSettings = DecodeSettings(details);
            var roster = (await Roster(db, leagueId).Select(row => row.Id).ToListAsync()).ToHashSet();
            var date = details.EventDate.ToDateTime(TimeOnly.MinValue);
            var eligible = details.CheckInMode == TournamentCheckInMode.Skipped ? roster :
                (await db.PlayerSignIn.Where(row => row.LeagueId == leagueId && row.DateTime.Date == date)
                    .Select(row => row.PlayerId).Distinct().ToListAsync()).Where(roster.Contains).ToHashSet();
            var additional = input.AdditionalSettings;
            if (eligible.Count is < 2 or > 256)
                return BadRequest(new { message = "Generation requires 2 to 256 eligible participants." });

            var roundSet = db.Set<TournamentRound>();
            var current = await roundSet.Where(row => row.LeagueId == leagueId).ToDictionaryAsync(row => row.RoundNumber);
            var requested = input.Rounds.Select(row => row.RoundNumber).ToHashSet();
            var lastRound = current.Keys.DefaultIfEmpty(0).Max();
            var settings = originalSettings;
            if (additional != null)
            {
                if (lastRound == 0 || additional.NumberOfRounds is < 1 or > 30 ||
                    lastRound + additional.NumberOfRounds > 30 ||
                    !requested.SetEquals(Enumerable.Range(lastRound + 1, additional.NumberOfRounds)))
                    return BadRequest(new { message = "Additional rounds must continue after the last saved round, up to 30 total rounds." });
                if (additional.ManualByes == null || additional.ManualByes.Any(bye => bye == null || !requested.Contains(bye.RoundNumber)))
                    return BadRequest(new { message = "Manual byes for an extension must apply only to the additional rounds." });
                settings = additional with { NumberOfRounds = current.Values.Count(round => round.VoidedAtUtc == null) + additional.NumberOfRounds };
            }
            else if (current.Count == 0
                ? !requested.SetEquals(Enumerable.Range(1, settings.NumberOfRounds))
                : requested.Any(number => !current.ContainsKey(number)))
                return BadRequest(new { message = "Generate all initial rounds together. Use Add Additional Rounds to extend a saved tournament." });

            var replacements = current.Values.Where(round => requested.Contains(round.RoundNumber)).ToArray();
            if (input.ManuallyEdited && (additional != null || replacements.Length != 1 || input.Rounds.Length != 1))
                return BadRequest(new { message = "Edit proposed teams for one redrawn round at a time." });
            if (replacements.Any(round => round.VoidedAtUtc != null))
                return Conflict(new { message = "Voided rounds cannot be replaced." });
            if (input.PreserveSavedByes && additional == null)
                settings = settings with { ManualByes = settings.ManualByes.Where(bye => requested.Contains(bye.RoundNumber))
                    .Concat(replacements.SelectMany(round => (SavedManualByeIds(round) ?? Array.Empty<int>())
                        .Select(id => new TournamentBye(round.RoundNumber, id))))
                    .Where(bye => eligible.Contains(bye.PlayerId)).Distinct().ToArray() };
            settings = settings with { ManualByes = settings.ManualByes.Where(bye => eligible.Contains(bye.PlayerId)).ToArray() };
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
            var error = settings.Validate(roster, historical.Select(team => team.ScrambleNumber).ToHashSet(), Math.Max(lastRound, requested.DefaultIfEmpty(0).Max()));
            if (error != null) return BadRequest(new { message = error });
            var prohibited = historical.SelectMany(team => TeamPairs(team.players)).ToHashSet();
            foreach (var round in input.Rounds)
            {
                error = ValidateAllocation(round, settings, eligible, prohibited, input.AllowHistoricalFallback, input.ManuallyEdited);
                if (error != null) return BadRequest(new { message = $"Round {round.RoundNumber}: {error}" });
            }

            await RemoveAssignments(db, leagueId, replacedNumbers, existingTeams);
            var maxNumber = await db.KingQueenTeam.Where(team => team.LeagueID == leagueId)
                .Select(team => (int?)team.ScrambleNumber).MaxAsync() ?? 0;
            maxNumber = Math.Max(maxNumber, originalSettings.LastScrambleNumber);
            foreach (var round in input.Rounds.OrderBy(row => row.RoundNumber))
            {
                if (!current.TryGetValue(round.RoundNumber, out var stored))
                {
                    stored = new TournamentRound { LeagueId = leagueId, RoundNumber = round.RoundNumber };
                    roundSet.Add(stored);
                }
                var roundSettings = replacements.Contains(stored)
                    ? settings with { GamesPerMatchup = stored.GamesPerMatchup } : settings;
                stored.ScrambleNumber = ++maxNumber;
                stored.GamesPerMatchup = roundSettings.GamesPerMatchup;
                stored.GenerationJson = JsonSerializer.Serialize(new { settings = roundSettings, eligible = eligible.Order(), input.AllowHistoricalFallback });
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
            details.RoundSettingsJson = JsonSerializer.Serialize(originalSettings with
                { NumberOfRounds = settings.NumberOfRounds, LastScrambleNumber = maxNumber });
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
            HashSet<(int, int)> prohibited, bool allowFallback, bool manuallyEdited = false)
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
            if (count != round.Teams.Length || (!manuallyEdited && round.Teams.Max(team => team.Length) - round.Teams.Min(team => team.Length) > 1))
                return "Team sizes or count do not match the saved settings.";
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

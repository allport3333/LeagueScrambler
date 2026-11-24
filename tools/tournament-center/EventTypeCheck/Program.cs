using System.Collections.Generic;
using Allport_s_League_Scrambler.Services;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using System;
using System.Linq;
using System.Security.Claims;
using Allport_s_League_Scrambler.Controllers;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION",
    "Server=lpc:localhost;Database=LeagueScramblerDev;Integrated Security=True;Encrypt=Optional;TrustServerCertificate=False");
await using var db = new DataContext();
Assert(await db.Database.SqlQueryRaw<string>("SELECT DB_NAME() AS [Value]").SingleAsync() == "LeagueScramblerDev", "Development database");
var ownerId = await db.Users.Where(user => user.UserRoleId == 1).Select(user => user.UserId).FirstAsync();
var prefix = "EventCheck-" + Guid.NewGuid().ToString("N");
var date = new DateOnly(2026, 12, 12);
try
{
    var names = new[]
    {
        new Player { Id = 1, FirstName = "William", LastName = "Smythe" },
        new Player { Id = 2, FirstName = " william ", LastName = "Smythe" },
        new Player { Id = 3, FirstName = "Bill", LastName = "Smythe" },
        new Player { Id = 4, FirstName = "Willam", LastName = "Smythe" },
        new Player { Id = 5, FirstName = "Different", LastName = "Elsewhere" }
    };
    var matches = PlayerNameMatches.Find("  WILLIAM ", "smythe ", names);
    Assert(matches.Select(match => match.Id).Order().SequenceEqual(new[] { 1, 2, 3, 4 }) &&
        matches.Count(match => match.Exact) == 2, "Exact names, case, spaces, nickname, spelling, and distinct same-name identities");
    var pairedRound = new TournamentRound { ScrambleNumber = 1, GamesPerMatchup = 2 };
    var identityA = new KingQueenTeam { Id = 1, ScrambleNumber = 1,
        KingQueenPlayers = [new KingQueenPlayer { PlayerId = 10 }], KingQueenRoundScores = [] };
    var identityB = new KingQueenTeam { Id = 2, ScrambleNumber = 1,
        KingQueenPlayers = [new KingQueenPlayer { PlayerId = 20 }], KingQueenRoundScores = [] };
    identityA.KingQueenRoundScores.Add(new KingQueenRoundScores { RoundId = 1, RoundScore = 12 });
    identityB.KingQueenRoundScores.Add(new KingQueenRoundScores { RoundId = 1, RoundScore = 15 });
    Assert(TournamentMatchupResults.WinsByPlayer([pairedRound], [identityA, identityB]).Count == 0, "Incomplete matchup awards no win");
    identityA.KingQueenRoundScores.Add(new KingQueenRoundScores { RoundId = 2, RoundScore = 11 });
    identityB.KingQueenRoundScores.Add(new KingQueenRoundScores { RoundId = 2, RoundScore = 13 });
    Assert(TournamentMatchupResults.WinsByPlayer([pairedRound], [identityA, identityB]).GetValueOrDefault(20) == 1, "Two games award one matchup win");
    identityA.KingQueenRoundScores[1].RoundScore = 16;
    Assert(TournamentMatchupResults.WinsByPlayer([pairedRound], [identityA, identityB]).Count == 0, "Tied aggregate awards no win");
    identityA.KingQueenRoundScores[1].RoundScore = 17;
    Assert(TournamentMatchupResults.WinsByPlayer([pairedRound], [identityA, identityB]).GetValueOrDefault(10) == 1, "Correcting a score changes the winner");
    var creation = new ScrambleDataController { ControllerContext = Identity(ownerId, "Admin") };
    var league = Created(await creation.AddNewLeague(prefix + "-L"));
    var tournament = Created(await creation.AddNewLeague(prefix + "-T", 2, date));
    var pickup = Created(await creation.AddNewLeague(prefix + "-P", 3));
    Assert(league.EventTypeId == 1 && tournament.EventTypeId == 2 && pickup.EventTypeId == 3, "Creation type");
    Assert(await creation.AddNewLeague(prefix + "-X", 2) is BadRequestObjectResult, "Missing tournament date rejected");
    var original = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(original.EventDate == date, "Tournament date persisted at creation");
    var center = new TournamentsController { ControllerContext = Identity(ownerId, "Manager") };
    Assert(await center.Read(tournament.ID) is OkObjectResult, "Owner can load tournament");
    center.ControllerContext = Identity(ownerId, "Admin");
    Assert(await center.Read(31) is OkObjectResult && await center.Read(32) is OkObjectResult,
        "Administrator can manage the unassigned historical tournaments");
    center.ControllerContext = Identity(ownerId, "Manager");
    var edit = new TournamentsController.DetailsInput(prefix + "-T2", date.AddDays(1), "Fixture description", "Fixture court", original.Version);
    Assert(await center.SaveDetails(tournament.ID, edit) is OkObjectResult, "Linked manager can save tournament");
    Assert(await center.SaveDetails(tournament.ID, edit) is ConflictObjectResult, "Stale update rejected");
    var reopened = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(reopened.EventDate == date.AddDays(1) && reopened.Location == "Fixture court", "Updated details persisted");
    center.ControllerContext = Identity(int.MaxValue, "Manager");
    Assert(await center.Read(tournament.ID) is ForbidResult, "Unlinked manager denied");
    center.ControllerContext = Identity(ownerId, "Player");
    Assert(await center.Read(tournament.ID) is ForbidResult, "Player denied");
    var participant = await db.UsersPlayer.Where(link => db.Players.Any(player => player.Id == link.PlayerId))
        .OrderBy(link => link.UserId).Select(link => new { link.UserId, link.PlayerId }).FirstAsync();
    db.PlayersLeagues.Add(new PlayersLeague { LeagueID = tournament.ID, PlayerID = participant.PlayerId });
    await db.SaveChangesAsync();
    var attendance = new TournamentAttendanceController { ControllerContext = Identity(ownerId, "Manager") };
    var present = new TournamentAttendanceController.AttendanceInput(true);
    attendance.ControllerContext = Identity(participant.UserId, "Player");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is NoContentResult, "Self check-in before eligibility is set");
    attendance.ControllerContext = Identity(ownerId, "Manager");
    Assert(await attendance.SaveMode(tournament.ID, new(TournamentCheckInMode.Manual, reopened.Version)) is NoContentResult, "Manual mode saved");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is NoContentResult, "Manual check-in");
    attendance.ControllerContext = Identity(participant.UserId, "Player");
    Assert(await attendance.Read(tournament.ID) is OkObjectResult, "Participant sees check-in");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is NoContentResult, "Legacy checked-in mode permits self check-in");
    Assert(await attendance.SavePresence(tournament.ID, int.MaxValue, present) is ForbidResult, "Cannot edit another player");
    attendance.ControllerContext = Identity(ownerId, "Manager");
    var manual = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(await attendance.SaveMode(tournament.ID, new(TournamentCheckInMode.Open, manual.Version)) is NoContentResult, "Open mode saved");
    attendance.ControllerContext = Identity(participant.UserId, "Player");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, new(false)) is NoContentResult, "Undo self check-in");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is NoContentResult, "Self check-in");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is NoContentResult, "Repeated check-in handled");
    Assert(await db.PlayerSignIn.CountAsync(row => row.LeagueId == tournament.ID && row.PlayerId == participant.PlayerId) == 1,
        "Only one attendance record");
    attendance.ControllerContext = Identity(ownerId, "Manager");
    var open = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(await attendance.SaveMode(tournament.ID, new(TournamentCheckInMode.Skipped, open.Version)) is NoContentResult, "Skipped mode saved");
    Assert(await db.PlayerSignIn.CountAsync(row => row.LeagueId == tournament.ID) == 1, "Skipping preserves attendance");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, new(false)) is NoContentResult,
        "Director can undo attendance while all registered players are eligible");
    attendance.ControllerContext = Identity(participant.UserId, "Player");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is NoContentResult,
        "Player can check in while all registered players are eligible");
    Assert(await attendance.SavePresence(tournament.ID, int.MaxValue, present) is ForbidResult,
        "All-registered mode still protects other players");
    attendance.ControllerContext = Identity(ownerId, "Manager");
    var fixturePlayers = await db.Players.Where(row => row.Id != participant.PlayerId)
        .OrderBy(row => row.Id).Take(23).ToListAsync();
    fixturePlayers.Add(await db.Players.SingleAsync(row => row.Id == participant.PlayerId));
    Assert(fixturePlayers.Count == 24, "24 roster participants");
    db.PlayersLeagues.AddRange(fixturePlayers.Where(row => row.Id != participant.PlayerId)
        .Select(row => new PlayersLeague { LeagueID = tournament.ID, PlayerID = row.Id }));
    await db.SaveChangesAsync();

    attendance.ControllerContext = Identity(participant.UserId, "Player");
    Assert(await attendance.SavePresence(tournament.ID, fixturePlayers[0].Id, present) is ForbidResult,
        "A participant cannot check in another registered player.");
    attendance.ControllerContext = Identity(ownerId, "Manager");
    var current = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(await attendance.SaveMode(tournament.ID, new(TournamentCheckInMode.Manual, current.Version)) is NoContentResult, "Resume manual check-in");
    var eligible = fixturePlayers.Take(19).Append(fixturePlayers.Last()).ToArray();
    foreach (var player in eligible)
        Assert(await attendance.SavePresence(tournament.ID, player.Id, present) is NoContentResult, "Record eligible participant");
    Assert(await db.PlayerSignIn.CountAsync(row => row.LeagueId == tournament.ID) == 20, "20 checked in");

    center.ControllerContext = Identity(ownerId, "Manager");
    var settings = new TournamentRoundSettings
    {
        BalancePriorities = true, TopPlayerIds = eligible.Take(3).Select(row => row.Id).ToArray(),
        LowPlayerIds = eligible.Skip(3).Take(3).Select(row => row.Id).ToArray()
    };
    current = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(await center.SaveRoundSettings(tournament.ID, new(current.Version, settings)) is OkObjectResult, "Round settings save");
    current = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    var rounds = await Generate(settings, eligible, Enumerable.Range(1, 5).ToArray(), []);
    Assert(rounds.Length == 5 && rounds.All(row => row.Teams.Length == 6 && row.Byes.Length == 0), "Five complete feasible rounds");
    var generation = new TournamentsController.SaveRoundsInput(current.Version, false, rounds);
    Assert(await center.SaveRounds(tournament.ID, generation) is OkObjectResult, "Generated rounds persist");
    Assert(await center.SaveRounds(tournament.ID, generation) is ConflictObjectResult, "Duplicate generation request denied");
    var reopenedCenter = new TournamentsController { ControllerContext = Identity(ownerId, "Manager") };
    Assert(await reopenedCenter.ReadRounds(tournament.ID) is OkObjectResult, "Reopened tournament loads rounds");
    var persisted = await db.Set<TournamentRound>().AsNoTracking().Where(row => row.LeagueId == tournament.ID)
        .OrderBy(row => row.RoundNumber).ToListAsync();
    Assert(persisted.Count == 5, "Five rounds present on reopening");

    async Task ScoreRound(int number, bool partial = false)
    {
        var loaded = await db.Set<TournamentRound>().AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID && row.RoundNumber == number);
        var teamIds = await db.KingQueenTeam.Where(row => row.LeagueID == tournament.ID && row.ScrambleNumber == loaded.ScrambleNumber)
            .OrderBy(row => row.Id).Select(row => row.Id).ToArrayAsync();
        var scores = teamIds.Chunk(2).Select((pair, i) => new TournamentsController.MatchScore(pair[0], pair[1], 1, 12, 15 + i));
        var latest = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
        Assert(await reopenedCenter.SaveScores(tournament.ID, number, new(latest.Version, (partial ? scores.Take(1) : scores).ToArray()))
            is OkObjectResult, "Score save");
    }

    await ScoreRound(1, true);
    await HttpResumeCheck.Run(prefix, tournament.ID);
    var standings = await creation.GetStandingsByLeague(prefix + "-T2");
    Assert(standings is OkObjectResult before && JsonSerializer.SerializeToElement(before.Value).GetProperty("playerScores").GetArrayLength() > 0,
        "Authoritative standings available after partial scoring");
    current = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(await reopenedCenter.SaveRounds(tournament.ID, new(current.Version, false, [rounds[0]])) is ConflictObjectResult,
        "Partially scored round protected");
    var replacement = await Generate(settings, eligible, [2], rounds.Where(row => row.RoundNumber != 2).ToArray());
    Assert(await reopenedCenter.SaveRounds(tournament.ID, new(current.Version, false, replacement)) is OkObjectResult,
        "Unplayed round replaced");
    await ScoreRound(1);
    for (var number = 2; number <= 5; number++) await ScoreRound(number);
    Assert(await db.KingQueenRoundScores.CountAsync(score =>
        db.KingQueenTeam.Any(team => team.Id == score.KingQueenTeamId && team.LeagueID == tournament.ID)) == 30,
        "All five rounds scored exactly once");
    Assert(await creation.GetStandingsByLeague(prefix + "-T2") is OkObjectResult final &&
        JsonSerializer.SerializeToElement(final.Value).GetProperty("playerScores").GetArrayLength() == 20, "Final rankings for 20 participants");

    var randomSettings = settings with
    {
        BalanceGenders = false, BalancePriorities = false, ActiveTeamLimit = 4, AutomaticByes = true,
        ManualByes = [new(1, eligible[0].Id)]
    };
    var randomRounds = await Generate(randomSettings, eligible.Take(19).ToArray(), Enumerable.Range(1, 5).ToArray(), []);
    Assert(randomRounds.All(round => round.Teams.Length == 4 && round.Byes.Length == 3), "Uneven attendance uses actual capacity");
    Assert(randomRounds[0].Byes.Contains(eligible[0].Id) &&
        randomRounds.SelectMany(round => round.Byes).Distinct().Count() == 15, "Manual bye retained and automatic byes rotate");
    Assert(randomRounds.All(round => round.Teams.SelectMany(team => team).Concat(round.Byes).Distinct().Count() == 19),
        "Random generation with repeat minimization accounts for each eligible player");
    var randomTournament = Created(await creation.AddNewLeague(prefix + "-R", 2, date));
    db.PlayersLeagues.AddRange(eligible.Take(19).Select(row => new PlayersLeague { LeagueID = randomTournament.ID, PlayerID = row.Id }));
    await db.SaveChangesAsync();
    var randomConfig = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == randomTournament.ID);
    Assert(await attendance.SaveMode(randomTournament.ID, new(TournamentCheckInMode.Skipped, randomConfig.Version)) is NoContentResult,
        "Skipped check-in uses the eligible roster");
    randomConfig = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == randomTournament.ID);
    Assert(await center.SaveRoundSettings(randomTournament.ID, new(randomConfig.Version, randomSettings)) is OkObjectResult, "Random settings saved");
    randomConfig = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == randomTournament.ID);
    Assert(await center.SaveRounds(randomTournament.ID, new(randomConfig.Version, false, randomRounds)) is OkObjectResult,
        "Random rounds with manual and automatic byes persist");
    Assert(await db.ByePlayer.CountAsync(bye => db.ByeRounds.Any(round => round.Id == bye.ByeRoundId &&
        round.LeagueID == randomTournament.ID)) == 15, "All fair byes persisted on existing bye records");
    var generatedAttendance = (OkObjectResult)await center.ReadRounds(randomTournament.ID);
    var savedByeDetails = JsonSerializer.SerializeToElement(generatedAttendance.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web))
        .GetProperty("rounds")[0];
    Assert(savedByeDetails.GetProperty("manualByeIds")[0].GetInt32() == eligible[0].Id &&
        savedByeDetails.GetProperty("manualByeIds").GetArrayLength() == 1 &&
        savedByeDetails.GetProperty("byes").GetArrayLength() == 3, "Saved round distinguishes one manual bye and two automatic byes");
    // Exercise management against the isolated, persisted fixture with its completed scores.
    async Task<TournamentConfiguration> Configuration() => await db.TournamentConfigurations.AsNoTracking()
        .SingleAsync(row => row.LeagueId == tournament.ID);
    async Task<TournamentRound[]> SavedRounds() => await db.TournamentRounds.AsNoTracking().Where(row => row.LeagueId == tournament.ID)
        .OrderBy(row => row.RoundNumber).ToArrayAsync();
    var scoredRounds = await SavedRounds();
    var scoredIds = scoredRounds.Select(round => round.ScrambleNumber).ToArray();
    var beforeScoreIds = await db.KingQueenRoundScores.Where(score => db.KingQueenTeam.Any(team =>
        team.Id == score.KingQueenTeamId && team.LeagueID == tournament.ID && scoredIds.Contains(team.ScrambleNumber)))
        .OrderBy(score => score.Id).Select(score => score.Id).ToArrayAsync();
    var latestManaged = await Configuration();
    Assert(await reopenedCenter.RemoveRounds(tournament.ID, new(latestManaged.Version, [1])) is ConflictObjectResult,
        "Deletion protects scored rounds");
    Assert(await reopenedCenter.RemoveRounds(tournament.ID, new(latestManaged.Version, [1], true)) is ForbidResult,
        "Only administrators can void historical scores");
    var extraSettings = settings with { NumberOfRounds = 3, GamesPerMatchup = 2, BalanceGenders = false };
    var extra = await Generate(extraSettings, eligible, [6, 7, 8], rounds);
    var extension = new TournamentsController.SaveRoundsInput(latestManaged.Version, false, extra, extraSettings);
    Assert(await reopenedCenter.SaveRounds(tournament.ID, extension) is OkObjectResult, "Completed tournament extended");
    Assert(await reopenedCenter.SaveRounds(tournament.ID, extension) is ConflictObjectResult, "Stale append rejected");
    var extended = await SavedRounds();
    Assert(extended.Length == 8 && extended.Take(5).Zip(scoredRounds).All(pair =>
        pair.First.ScrambleNumber == pair.Second.ScrambleNumber && pair.First.GenerationJson == pair.Second.GenerationJson) &&
        extended.Skip(5).All(round => round.GamesPerMatchup == 2), "Append preserves historical snapshots and scoring formats");
    latestManaged = await Configuration();
    var remaining = eligible.Skip(1).ToArray();
    var upcoming = await Generate(settings, remaining, [6, 7, 8], rounds);
    Assert(await reopenedCenter.SaveRounds(tournament.ID, new(latestManaged.Version, false, upcoming,
        UnavailablePlayerIds: [eligible[0].Id])) is OkObjectResult, "Future roster and replacements applied together");
    var absent = await SavedRounds();
    var changed = absent.Skip(5).Select(round => round.ScrambleNumber).ToArray();
    Assert(!await db.KingQueenPlayer.AnyAsync(player => player.PlayerId == eligible[0].Id &&
        db.KingQueenTeam.Any(team => team.Id == player.KingQueenTeamId && team.LeagueID == tournament.ID && changed.Contains(team.ScrambleNumber))),
        "Unavailable player removed from future assignments only");
    latestManaged = await Configuration();
    Assert(await reopenedCenter.RemoveRounds(tournament.ID, new(latestManaged.Version, [6, 8])) is OkObjectResult,
        "Delete multiple unplayed rounds without renumbering");
    var retained = await SavedRounds();
    var deletedScrambles = absent.Where(round => round.RoundNumber is 6 or 8).Select(round => round.ScrambleNumber).ToArray();
    Assert(retained.Select(round => round.RoundNumber).SequenceEqual(new[] { 1, 2, 3, 4, 5, 7 }) &&
        !await db.KingQueenTeam.AnyAsync(team => team.LeagueID == tournament.ID && deletedScrambles.Contains(team.ScrambleNumber)) &&
        !await db.ByeRounds.AnyAsync(round => round.LeagueID == tournament.ID && deletedScrambles.Contains(round.ScrambleNumber)),
        "Deleted rounds have no remaining team or bye assignments");
    latestManaged = await Configuration();
    Assert(await reopenedCenter.SaveRounds(tournament.ID, new(latestManaged.Version, false, [], UnavailablePlayerIds: []))
        is OkObjectResult, "Participant can rejoin without rewriting existing teams");
    latestManaged = await Configuration();
    var latestAddition = await Generate(extraSettings, eligible, [8, 9], rounds.Concat(upcoming.Where(round => round.RoundNumber == 7)).ToArray());
    Assert(await reopenedCenter.SaveRounds(tournament.ID, new(latestManaged.Version, false, latestAddition,
        extraSettings with { NumberOfRounds = 2 })) is OkObjectResult, "Rejoined roster can play in newly appended rounds");
    Assert((await SavedRounds()).Select(round => round.RoundNumber).SequenceEqual(new[] { 1, 2, 3, 4, 5, 7, 8, 9 }),
        "Adding after a middle deletion keeps retained labels");
    latestManaged = await Configuration();
    reopenedCenter.ControllerContext = Identity(ownerId, "Admin");
    Assert(await reopenedCenter.RemoveRounds(tournament.ID, new(latestManaged.Version, [1], true)) is OkObjectResult,
        "Administrator can void a scored round");
    var voided = (await SavedRounds())[0];
    var retainedScoreIds = await db.KingQueenRoundScores.Where(score => beforeScoreIds.Contains(score.Id))
        .OrderBy(score => score.Id).Select(score => score.Id).ToArrayAsync();
    Assert(voided.VoidedAtUtc != null && voided.VoidedByUserId == ownerId && voided.ScrambleNumber == scoredIds[0] &&
        beforeScoreIds.SequenceEqual(retainedScoreIds), "Void retains audit, scores, and historical identities");
    var recalculated = (OkObjectResult)await creation.GetStandingsByLeague(prefix + "-T2");
    var progress = JsonSerializer.SerializeToElement(recalculated.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web))
        .GetProperty("tournamentProgress");
    Assert(progress.GetProperty("completed").GetInt32() == 4 && progress.GetProperty("total").GetInt32() == 7,
        "Standings exclude voided round and reflect added and removed rounds");
    Console.WriteLine("Round management passed against LeagueScramblerDev.");
    reopenedCenter.ControllerContext = Identity(participant.UserId, "Player");
    Assert(await reopenedCenter.ReadRounds(tournament.ID) is OkObjectResult, "Linked participant can view saved rounds");
    reopenedCenter.ControllerContext = Identity(int.MaxValue, "Player");
    Assert(await reopenedCenter.ReadRounds(tournament.ID) is ForbidResult, "Nonparticipant cannot view saved rounds");
    var registration = new TournamentsController.RegistrationInput("WizardRace", prefix, "Female", [], false);
    var otherRegistration = new TournamentsController { ControllerContext = Identity(ownerId, "Admin") };
    var concurrent = await Task.WhenAll(center.RegisterParticipant(tournament.ID, registration),
        otherRegistration.RegisterParticipant(randomTournament.ID, registration));
    Assert(concurrent.Count(result => result is OkObjectResult) == 1 &&
        concurrent.Count(result => result is ConflictObjectResult) == 1, "Concurrent duplicate registration requires review");
    Console.WriteLine("Tournament engine, 24 registered, 20 checked in, five SQL-backed rounds, regeneration guard, partial scores and final standings passed.");
    Console.WriteLine("Event types, tournament details, access, and manual, self-service and skipped check-in passed against LeagueScramblerDev.");
}
finally
{
    var fixtureIds = await db.Leagues.Where(league => league.LeagueName.StartsWith(prefix)).Select(league => league.ID).ToListAsync();
    await using var transaction = await db.Database.BeginTransactionAsync();
    var fixtureTeams = db.KingQueenTeam.Where(row => fixtureIds.Contains(row.LeagueID));
    var fixtureByes = db.ByeRounds.Where(row => fixtureIds.Contains(row.LeagueID));
    await db.KingQueenRoundScores.Where(row => fixtureTeams.Any(team => team.Id == row.KingQueenTeamId)).ExecuteDeleteAsync();
    await db.KingQueenPlayer.Where(row => fixtureTeams.Any(team => team.Id == row.KingQueenTeamId)).ExecuteDeleteAsync();
    await fixtureTeams.ExecuteDeleteAsync();
    await db.ByePlayer.Where(row => fixtureByes.Any(bye => bye.Id == row.ByeRoundId)).ExecuteDeleteAsync();
    await fixtureByes.ExecuteDeleteAsync();
    await db.Set<TournamentRound>().Where(row => fixtureIds.Contains(row.LeagueId)).ExecuteDeleteAsync();
    await db.PlayerSignIn.Where(row => fixtureIds.Contains(row.LeagueId)).ExecuteDeleteAsync();
    await db.PlayersLeagues.Where(row => fixtureIds.Contains(row.LeagueID)).ExecuteDeleteAsync();
    await db.TournamentConfigurations.Where(row => fixtureIds.Contains(row.LeagueId)).ExecuteDeleteAsync();
    await db.UserLeagues.Where(row => fixtureIds.Contains(row.LeagueTypeId) && row.UserId == ownerId).ExecuteDeleteAsync();
    await db.LeagueSettings.Where(row => fixtureIds.Contains(row.LeagueId)).ExecuteDeleteAsync();
    await db.Players.Where(row => row.LastName == prefix && (row.FirstName == "WizardOne" || row.FirstName == "WizardTwo" || row.FirstName == "WizardRace")).ExecuteDeleteAsync();
    await db.Leagues.Where(row => fixtureIds.Contains(row.ID) && row.LeagueName.StartsWith(prefix)).ExecuteDeleteAsync();
    await transaction.CommitAsync();
}

static async Task<TournamentsController.Allocation[]> Generate(TournamentRoundSettings settings, Player[] players,
    int[] pending, TournamentsController.Allocation[] preserved)
{
    using var process = Process.Start(new ProcessStartInfo("node", "tools/tournament-center/generate-fixture.cjs")
    {
        RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false
    });
    var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
    await process.StandardInput.WriteAsync(JsonSerializer.Serialize(new { settings, players, pending, preserved }, json));
    process.StandardInput.Close();
    var output = process.StandardOutput.ReadToEndAsync();
    var errors = process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    if (process.ExitCode != 0) throw new InvalidOperationException(await errors);
    return JsonSerializer.Deserialize<TournamentsController.Allocation[]>(
        JsonDocument.Parse(await output).RootElement.GetProperty("rounds"), json);
}

static LeagueType Created(IActionResult result) => (result as OkObjectResult)?.Value as LeagueType
    ?? throw new InvalidOperationException("Event creation did not succeed.");

static void Assert(bool condition, string check)
{
    if (!condition) throw new InvalidOperationException("Failed: " + check);
}

static ControllerContext Identity(int userId, string role) => new()
{
    HttpContext = new DefaultHttpContext
    {
        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        }, "DevelopmentFixture"))
    }
};

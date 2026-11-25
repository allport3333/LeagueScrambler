using System;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Controllers;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

internal static class RoundOperationsCheck
{
    public static async Task Run()
    {
        await using var db = new DataContext();
        Require(await db.Database.SqlQueryRaw<string>("SELECT DB_NAME() AS [Value]").SingleAsync() == "LeagueScramblerDev", "Development database");
        var user = await db.Users.Where(row => row.UserRoleId == 1).Select(row => row.UserId).FirstAsync();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] {
            new Claim(ClaimTypes.NameIdentifier, user.ToString()), new Claim(ClaimTypes.Role, "Admin") }, "Fixture"));
        var context = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } };
        var center = new TournamentsController { ControllerContext = context };
        var attendance = new TournamentAttendanceController { ControllerContext = context };
        var players = await db.Players.OrderBy(row => row.Id).Take(4).Select(row => row.Id).ToArrayAsync();
        var fixture = new LeagueType { LeagueName = "RoundOps-" + Guid.NewGuid().ToString("N"), EventTypeId = 2 };
        db.Leagues.Add(fixture);
        await db.SaveChangesAsync();
        var id = fixture.ID;
        var options = new TournamentRoundSettings { NumberOfTeams = null, MaximumTeamSize = 2, NumberOfRounds = 1, GamesPerMatchup = 1 };
        try
        {
            db.TournamentConfigurations.Add(new TournamentConfiguration { LeagueId = id, OwnerUserId = user, Version = Guid.NewGuid(),
                EventDate = new DateOnly(2027, 2, 10), CheckInMode = TournamentCheckInMode.Skipped, WorkflowStep = 6,
                RoundSettingsJson = JsonSerializer.Serialize(options).Insert(1, "\"UnavailablePlayerIds\":[" + players[0] + "],\"ManagedUnavailablePlayerIds\":[" + players[0] + "],") });
            db.PlayersLeagues.AddRange(players.Select(player => new PlayersLeague { LeagueID = id, PlayerID = player }));
            await db.SaveChangesAsync();
            Require(await Save(1, [[players[0], players[1]], [players[2], players[3]]]) is OkObjectResult, "All Registered ignores legacy flags during initial generation");
            var firstTeams = await Teams(1);
            var firstAssignments = await db.KingQueenPlayer.Where(row => firstTeams.Contains(row.KingQueenTeamId)).Select(row => row.Id).Order().ToArrayAsync();
            Require(await Edit(1, firstTeams, [[players[0]], [players[1], players[2], players[3]]]) is OkObjectResult, "Move persisted");
            Require(await Edit(1, firstTeams, [[players[3]], [players[0], players[1], players[2]]]) is OkObjectResult, "Swap persisted");
            Require((await Teams(1)).SequenceEqual(firstTeams), "Stable team IDs");
            Require((await db.KingQueenPlayer.Where(row => firstTeams.Contains(row.KingQueenTeamId)).Select(row => row.Id).Order().ToArrayAsync())
                .SequenceEqual(firstAssignments), "Stable assignment IDs");
            Require(await Edit(1, firstTeams, [[players[3]], [players[0], players[3], players[2]]]) is BadRequestObjectResult, "Duplicates rejected");

            var extension = options;
            Require(await Save(2, [[players[0], players[1]], [players[2], players[3]]], extension) is OkObjectResult,
                "All registered includes an unverified legacy exclusion in additional rounds");
            var secondTeams = await Teams(2);
            Require(await Edit(2, secondTeams, [[players[0]], [players[1], players[2], players[3]]]) is OkObjectResult,
                "A move beyond the generation maximum persists");
            var unchanged = await Version();
            Require(await Edit(2, secondTeams, [[players[0]], [players[1], players[2], players[3]]]) is OkObjectResult &&
                unchanged == await Version(), "An unchanged assignment keeps the version");
            Require(await center.SaveScores(id, 2, new(await Version(), [new(secondTeams[0], secondTeams[1], 1, 21, 18)])) is OkObjectResult,
                "Score fixture written");
            Require(await Edit(2, secondTeams, [[players[0], players[2]], [players[1], players[3]]]) is ConflictObjectResult,
                "Scored round protected");

            Require(await attendance.SaveMode(id, new(TournamentCheckInMode.Manual, await Version())) is NoContentResult, "Checked-in mode selected");
            foreach (var player in players.Take(3))
                Require(await attendance.SavePresence(id, player, new(true)) is NoContentResult, "Director checked player in");
            Require(await Save(3, [[players[0]], [players[1]]], extension) is BadRequestObjectResult, "Newly checked-in player is required");
            Require(await Save(3, [[players[0]], [players[1], players[2]]], extension) is OkObjectResult, "Only checked-in players included");
            var savedThird = await Teams(3);
            Require(await attendance.SavePresence(id, players[2], new(false)) is NoContentResult, "Player checked out");
            Require((await Teams(3)).SequenceEqual(savedThird) && await db.KingQueenPlayer.AnyAsync(row =>
                savedThird.Contains(row.KingQueenTeamId) && row.PlayerId == players[2]), "Check-out alone preserves unplayed assignments");
            Require(await Save(3, [[players[0]], [players[1], players[2]]]) is BadRequestObjectResult, "Redraw rejects stale eligibility");
            Require(await Save(3, [[players[0]], [players[1]]]) is OkObjectResult, "Redraw uses current attendance");
            Require(await Save(4, [[players[0]], [players[1]]], extension) is OkObjectResult, "Additional round excludes a checked-out player");
            Require(await attendance.SavePresence(id, players[2], new(true)) is NoContentResult, "Player checked back in");
            Require(await center.RemoveParticipant(id, players[3]) is NoContentResult, "Remove a registration without changing historic teams");
            Require(await Save(5, [[players[0]], [players[1], players[2]]], extension) is OkObjectResult, "Rejoined player is eligible for additional rounds");
            Require(await db.KingQueenPlayer.AnyAsync(row => secondTeams.Contains(row.KingQueenTeamId) && row.PlayerId == players[3]) &&
                await db.KingQueenRoundScores.CountAsync(row => secondTeams.Contains(row.KingQueenTeamId)) == 2 &&
                await db.PlayerSignIn.CountAsync(row => row.LeagueId == id) == 3, "Historic scores, assignments and attendance survive");
            Require(await attendance.SaveMode(id, new(TournamentCheckInMode.Skipped, await Version())) is NoContentResult,
                "Use the registered roster for the four-team fixture");
            var added = await db.Players.OrderBy(row => row.Id).Skip(4).Take(4).Select(row => row.Id).ToArrayAsync();
            db.PlayersLeagues.AddRange(added.Append(players[3]).Select(player => new PlayersLeague { LeagueID = id, PlayerID = player }));
            await db.SaveChangesAsync();
            Require(await Save(6, [[players[0], players[1]], [players[2], players[3]], [added[0], added[1]], [added[2], added[3]]], extension)
                is OkObjectResult, "Four-team round saved");
            var fourTeams = await Teams(6);
            var changed = new int[][] { [players[0], players[1]], [players[2], players[3], added[0]], [added[1]], [added[2], added[3]] };
            Require(await Edit(6, fourTeams, changed) is OkObjectResult, "Independent move creates uneven teams in a four-team round");
            for (var i = 0; i < fourTeams.Length; i++)
            {
                var teamId = fourTeams[i];
                var actual = await db.KingQueenPlayer.Where(row => row.KingQueenTeamId == teamId).Select(row => row.PlayerId).ToArrayAsync();
                Require(actual.Order().SequenceEqual(changed[i].Order()), "Each team retains its ID and the intended assignments");
            }
            Require(await db.KingQueenRoundScores.CountAsync(row => secondTeams.Contains(row.KingQueenTeamId)) == 2,
                "Four-team edit preserves existing scores");
            Console.WriteLine("Development generation, attendance changes, round editing, and historical protection passed.");
        }
        finally
        {
            var teams = db.KingQueenTeam.Where(row => row.LeagueID == id);
            await db.KingQueenRoundScores.Where(row => teams.Any(team => team.Id == row.KingQueenTeamId)).ExecuteDeleteAsync();
            await db.KingQueenPlayer.Where(row => teams.Any(team => team.Id == row.KingQueenTeamId)).ExecuteDeleteAsync();
            await teams.ExecuteDeleteAsync();
            await db.TournamentRounds.Where(row => row.LeagueId == id).ExecuteDeleteAsync();
            await db.PlayerSignIn.Where(row => row.LeagueId == id).ExecuteDeleteAsync();
            await db.PlayersLeagues.Where(row => row.LeagueID == id).ExecuteDeleteAsync();
            await db.TournamentConfigurations.Where(row => row.LeagueId == id).ExecuteDeleteAsync();
            await db.Leagues.Where(row => row.ID == id && row.LeagueName == fixture.LeagueName).ExecuteDeleteAsync();
        }

        Task<Guid> Version() => db.TournamentConfigurations.Where(row => row.LeagueId == id).Select(row => row.Version).SingleAsync();
        Task<int[]> Teams(int number) => db.KingQueenTeam.Where(team => team.LeagueID == id &&
            db.TournamentRounds.Any(round => round.LeagueId == id && round.RoundNumber == number && round.ScrambleNumber == team.ScrambleNumber))
            .OrderBy(team => team.Id).Select(team => team.Id).ToArrayAsync();
        async Task<IActionResult> Save(int number, int[][] teams, TournamentRoundSettings extension = null) =>
            await center.SaveRounds(id, new(await Version(), false, [new(number, teams, [])], extension));
        async Task<IActionResult> Edit(int number, int[] ids, int[][] members) =>
            await center.EditRoundTeams(id, number, new(await Version(), ids.Zip(members,
                (team, players) => new TournamentsController.TeamAssignment(team, players)).ToArray()));
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}

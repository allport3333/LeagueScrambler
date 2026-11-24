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
    var creation = new ScrambleDataController { ControllerContext = Identity(ownerId, "Admin") };
    var league = Created(await creation.AddNewLeague(prefix + "-L"));
    var tournament = Created(await creation.AddNewLeague(prefix + "-T", 2, date));
    var pickup = Created(await creation.AddNewLeague(prefix + "-P", 3));
    Assert(league.EventTypeId == 1 && tournament.EventTypeId == 2 && pickup.EventTypeId == 3, "Creation type");
    Assert(await creation.AddNewLeague(prefix + "-X", 2) is BadRequestObjectResult, "Missing tournament date rejected");
    var original = await db.TournamentConfigurations.AsNoTracking().SingleAsync(row => row.LeagueId == tournament.ID);
    Assert(original.EventDate == date, "Tournament date persisted at creation");
    var center = new TournamentsController { ControllerContext = Identity(ownerId, "Manager") };
    Assert(await center.Read(tournament.ID) is OkObjectResult, "Linked manager can load tournament");
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
    Assert(await attendance.SaveMode(tournament.ID, new(TournamentCheckInMode.Manual, reopened.Version)) is NoContentResult, "Manual mode saved");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is NoContentResult, "Manual check-in");
    attendance.ControllerContext = Identity(participant.UserId, "Player");
    Assert(await attendance.Read(tournament.ID) is OkObjectResult, "Participant sees check-in");
    Assert(await attendance.SavePresence(tournament.ID, participant.PlayerId, present) is ObjectResult { StatusCode: 423 }, "Manual mode blocks self check-in");
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
    Console.WriteLine("Event types, tournament details, access, and manual, self-service and skipped check-in passed against LeagueScramblerDev.");
}
finally
{
    var fixtureIds = await db.Leagues.Where(league => league.LeagueName.StartsWith(prefix)).Select(league => league.ID).ToListAsync();
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.PlayerSignIn.Where(row => fixtureIds.Contains(row.LeagueId)).ExecuteDeleteAsync();
    await db.PlayersLeagues.Where(row => fixtureIds.Contains(row.LeagueID)).ExecuteDeleteAsync();
    await db.TournamentConfigurations.Where(row => fixtureIds.Contains(row.LeagueId)).ExecuteDeleteAsync();
    await db.UserLeagues.Where(row => fixtureIds.Contains(row.LeagueTypeId) && row.UserId == ownerId).ExecuteDeleteAsync();
    await db.LeagueSettings.Where(row => fixtureIds.Contains(row.LeagueId)).ExecuteDeleteAsync();
    await db.Leagues.Where(row => fixtureIds.Contains(row.ID) && row.LeagueName.StartsWith(prefix)).ExecuteDeleteAsync();
    await transaction.CommitAsync();
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

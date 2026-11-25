using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Pickup;

public sealed partial class PickupController
{
    private const int ScrambleLimit = 80;

    [Authorize, HttpGet("selector")]
    public async Task<IActionResult> Selector()
    {
        if (!PickupEnvironment.Requested) return NotFound();
        if (!LeagueAccess.TryGetAccountId(User, out var account)) return Unauthorized();
        await using var db = new DataContext();
        var now = DateTimeOffset.UtcNow;
        return Ok(await db.PickupSessions.Where(s => (s.State == SessionState.Published || s.State == SessionState.InProgress)
            && (s.EndsUtc > now || s.State == SessionState.InProgress)
            && (s.OrganizerId == account || db.PickupRegistrations.Any(r => r.SessionId == s.Id && r.AccountId == account
                && (r.State == RegistrationState.Confirmed || r.State == RegistrationState.PendingApproval || r.State == RegistrationState.Waitlisted))))
            .OrderByDescending(s => s.State == SessionState.InProgress).ThenBy(s => s.StartsUtc).ThenBy(s => s.Id)
            .Take(100).Select(s => new { s.Id, s.Name }).ToListAsync());
    }

    [HttpGet("sessions/{id:guid}/workspace")]
    public async Task<IActionResult> Workspace(Guid id)
    {
        if (!PickupEnvironment.Requested) return NotFound();
        await using var db = new DataContext();
        var session = await db.PickupSessions.AsNoTracking().SingleOrDefaultAsync(s => s.Id == id);
        var mine = await FindRegistration(db, id);
        if (!CanRead(session, mine)) return NotFound();
        var owner = IsOwner(session);
        var players = await Roster(db, id);
        var sets = await db.PickupGameSets.AsNoTracking().Where(s => s.SessionId == id).OrderBy(s => s.Number).ToListAsync();
        return Ok(new {
            players = owner ? players : null,
            session.CheckedInOnly,
            playing = players.Count(r => Eligible(session, r)),
            gameSets = sets.Count,
            gamesPlayed = sets.Sum(s => Scores(s).Length),
            myRegistrationId = mine?.Id,
            sets = owner || mine?.State == RegistrationState.Confirmed
                ? sets.Select(s => new { s.Id, s.Number, s.CreatedUtc, s.Version, board = Board(s), scores = Scores(s) }) : null
        });
    }

    [Authorize, HttpGet("sessions/{id:guid}/player-options")]
    public async Task<IActionResult> PlayerOptions(Guid id, string q, int page = 0)
    {
        if (!PickupEnvironment.Requested) return NotFound();
        if (q?.Length > 100 || page is < 0 or > 1000) return BadRequest();
        await using var db = new DataContext();
        var session = await db.PickupSessions.FindAsync(id);
        if (session == null || !IsOwner(session)) return NotFound();
        var options = db.Players.AsNoTracking().Where(p => !db.PickupRegistrations.Any(r =>
            r.SessionId == id && (r.PlayerId == p.Id || db.UsersPlayer.Any(u => u.PlayerId == p.Id && u.UserId == r.AccountId))));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            options = options.Where(p => (p.FirstName + " " + p.LastName).Contains(term));
        }
        var rows = await options.OrderBy(p => p.LastName).ThenBy(p => p.FirstName).ThenBy(p => p.Id).Skip(page * 40).Take(41)
            .Select(p => new { p.Id, name = p.FirstName + " " + p.LastName }).ToListAsync();
        return Ok(new { players = rows.Take(40), hasMore = rows.Count > 40 });
    }

    [Authorize, SameOrigin, HttpPost("sessions/{id:guid}/players")]
    public Task<IActionResult> AddPlayers(Guid id, PlayerInput input) => Operate(id, async (db, session) =>
    {
        var ids = input.PlayerIds ?? [];
        var guestName = input.GuestName?.Trim();
        if (ids.Length > 80 || ids.Distinct().Count() != ids.Length || (ids.Length == 0 && string.IsNullOrEmpty(guestName)))
            return Invalid("Choose players or enter a walk-in guest name.");
        var known = await db.Players.Where(p => ids.Contains(p.Id)).ToListAsync();
        if (known.Count != ids.Length) return Invalid("One or more players no longer exist.");
        var existing = await db.PickupRegistrations.Where(r => r.SessionId == id).ToListAsync();
        var accounts = await db.UsersPlayer.Where(u => ids.Contains(u.PlayerId)).Join(db.Users, u => u.UserId, a => a.UserId,
            (u, a) => new { u.PlayerId, u.UserId, a.Email }).ToListAsync();
        var additions = new List<PickupRegistration>();
        foreach (var player in known)
        {
            var linked = accounts.Where(a => a.PlayerId == player.Id).ToArray();
            if (linked.Any(a => existing.Any(r => r.AccountId == a.UserId)) || existing.Any(r => r.PlayerId == player.Id))
                return ConflictMessage("A selected player already has a registration. Refresh the player list.");
            var account = linked.Length == 1 ? linked[0] : null;
            var key = string.IsNullOrWhiteSpace(account?.Email) ? Hash(Guid.NewGuid().ToString()) : EmailKey(account.Email);
            if (existing.Any(r => r.EmailKey == key) || additions.Any(r => r.EmailKey == key || account != null && r.AccountId == account.UserId))
                return ConflictMessage("A selected player's account already has a registration.");
            additions.Add(NewPlayer(id, (player.FirstName + " " + player.LastName).Trim(), key, player.Id, account?.UserId));
        }
        if (!string.IsNullOrEmpty(guestName)) additions.Add(NewPlayer(id, guestName, Hash(Guid.NewGuid().ToString()), null, null));
        if (session.Capacity is { } limit && existing.Count(r => r.State == RegistrationState.Confirmed) + additions.Count > limit)
            return ConflictMessage("There are not enough available spots.");
        db.PickupRegistrations.AddRange(additions);
        return NoContent();
    });

    [Authorize, SameOrigin, HttpPut("sessions/{id:guid}/attendance")]
    public Task<IActionResult> Attendance(Guid id, AttendanceInput input) => Operate(id, async (db, session) =>
    {
        if (input.CheckedInOnly.HasValue) session.CheckedInOnly = input.CheckedInOnly.Value;
        if (input.All || input.PlayerId.HasValue)
        {
            var players = await db.PickupRegistrations.Where(r => r.SessionId == id && r.State == RegistrationState.Confirmed &&
                (input.All || r.Id == input.PlayerId)).ToListAsync();
            if (!input.All && players.Count == 0) return NotFound();
            foreach (var player in players) player.Playing = input.Playing;
        }
        return NoContent();
    });

    [Authorize, SameOrigin, HttpPost("sessions/{id:guid}/lifecycle")]
    public Task<IActionResult> Lifecycle(Guid id, LifecycleInput input) => Operate(id, (db, session) =>
    {
        if (input.Complete) session.State = SessionState.Completed;
        else if (session.State == SessionState.Published) session.State = SessionState.InProgress;
        else return Task.FromResult(ConflictMessage("This session is already in progress."));
        return Task.FromResult<IActionResult>(NoContent());
    });

    [Authorize, SameOrigin, RequestSizeLimit(32768), HttpPost("sessions/{id:guid}/sets")]
    public Task<IActionResult> SaveSet(Guid id, SetInput input) => Operate(id, async (db, session) =>
    {
        if (!ValidBoard(input.Teams, input.Byes) || input.GamesPerMatchup is < 1 or > 20 || input.Options == null)
            return Invalid("Check the teams and games per matchup.");
        var roster = (await Roster(db, id)).Where(p => Eligible(session, p)).ToDictionary(p => p.Id);
        if (roster.Count > ScrambleLimit) return ConflictMessage("Select at most 80 playing participants before saving teams.");
        var ids = input.Teams.SelectMany(t => t).Concat(input.Byes).ToHashSet();
        if (!ids.SetEquals(roster.Keys)) return ConflictMessage("The playing roster changed. Generate teams again.");
        var option = input.Options;
        if (option.TeamCount is < 0 or > 80 || option.MaxTeamSize is < 1 or > 80 || option.History is not ("none" or "minimize" or "strict")
            || (option.TeamCount > 0 && option.TeamCount != input.Teams.Length) || input.Teams.Any(team => team.Length > option.MaxTeamSize)
            || option.Top == null || option.Low == null || !ids.IsSupersetOf(option.Top.Concat(option.Low))
            || option.Top.Intersect(option.Low).Any() || option.Top.Distinct().Count() != option.Top.Length
            || option.Low.Distinct().Count() != option.Low.Length)
            return Invalid("The scramble configuration does not match the selected players or teams.");
        Participant[] Map(Guid[] keys) => keys.Select(key =>
        {
            var row = roster[key];
            return new Participant(row.Id, row.PlayerId, row.Name, row.Gender);
        }).ToArray();
        var board = new GameBoard(input.Teams.Select(Map).ToArray(), Map(input.Byes), input.GamesPerMatchup, option);
        var prior = await db.PickupGameSets.Where(s => s.SessionId == id).MaxAsync(s => (int?)s.Number) ?? 0;
        var set = new PickupGameSet { Id = Guid.NewGuid(), SessionId = id, Number = prior + 1,
            CreatedUtc = DateTimeOffset.UtcNow, Version = 1, BoardJson = JsonSerializer.Serialize(board), ScoresJson = "[]" };
        db.PickupGameSets.Add(set);
        return Ok(new { set.Id, set.Number });
    });

    [Authorize, SameOrigin, RequestSizeLimit(32768), HttpPut("sessions/{id:guid}/sets/{setId:guid}/scores")]
    public Task<IActionResult> SaveScores(Guid id, Guid setId, ScoreInput input) => Operate(id, async (db, session) =>
    {
        var set = await db.PickupGameSets.SingleOrDefaultAsync(s => s.Id == setId && s.SessionId == id);
        if (set == null) return NotFound();
        if (set.Version != input.Version) return ConflictMessage("This game set changed. Reload it before saving.");
        var board = Board(set);
        if (input.Scores == null || input.Scores.Length > board.Teams.Length / 2 * board.GamesPerMatchup ||
            input.Scores.Any(s => s == null || s.Matchup < 1 || s.Matchup > board.Teams.Length / 2 ||
                s.Game < 1 || s.Game > board.GamesPerMatchup || s.First < 0 || s.Second < 0) ||
            input.Scores.Select(s => (s.Matchup, s.Game)).Distinct().Count() != input.Scores.Length)
            return Invalid("Enter both non-negative whole-number scores for each recorded game.");
        var requested = input.Scores.Select(s => (s.Matchup, s.Game)).ToHashSet();
        if (Scores(set).Any(s => !requested.Contains((s.Matchup, s.Game))))
            return Invalid("Previously recorded games need both scores when correcting results.");
        set.ScoresJson = JsonSerializer.Serialize(input.Scores);
        set.Version++;
        return NoContent();
    });

    [Authorize, SameOrigin, RequestSizeLimit(32768), HttpPut("sessions/{id:guid}/sets/{setId:guid}/teams")]
    public Task<IActionResult> EditSet(Guid id, Guid setId, TeamInput input) => Operate(id, async (db, session) =>
    {
        var set = await db.PickupGameSets.SingleOrDefaultAsync(s => s.Id == setId && s.SessionId == id);
        if (set == null) return NotFound();
        if (set.Version != input.Version) return ConflictMessage("This game set changed. Reload it before saving.");
        if (Scores(set).Length > 0) return ConflictMessage("Teams cannot be changed after scores have been recorded.");
        var board = Board(set);
        var players = board.Teams.SelectMany(t => t).ToDictionary(p => p.Id);
        if (!ValidBoard(input.Teams, []) || input.Teams.Length != board.Teams.Length ||
            !input.Teams.SelectMany(t => t).ToHashSet().SetEquals(players.Keys))
            return Invalid("Keep each original player on one team, with at least one player per team.");
        set.BoardJson = JsonSerializer.Serialize(board with { Teams = input.Teams.Select(t => t.Select(key => players[key]).ToArray()).ToArray() });
        set.Version++;
        return NoContent();
    });

    private Task<IActionResult> Operate(Guid id, Func<DataContext, PickupSession, Task<IActionResult>> action) =>
        WithSession(id, (db, session) => !IsOwner(session) ? Task.FromResult<IActionResult>(NotFound())
            : session.State is not (SessionState.Published or SessionState.InProgress)
                ? Task.FromResult(ConflictMessage("This session is read only.")) : action(db, session));

    private static Task<List<RosterPlayer>> Roster(DataContext db, Guid id) =>
        db.PickupRegistrations.AsNoTracking().Where(r => r.SessionId == id).OrderBy(r => r.Name).ThenBy(r => r.Id)
            .Select(r => new RosterPlayer(r.Id, r.PlayerId, r.Name, r.State, r.Playing,
                db.Players.Where(p => p.Id == r.PlayerId).Select(p => p.Gender).FirstOrDefault())).ToListAsync();

    private static bool Eligible(PickupSession session, RosterPlayer row) =>
        row.State == RegistrationState.Confirmed && (row.Playing ?? !session.CheckedInOnly);

    private bool CanRead(PickupSession session, PickupRegistration mine) =>
        CanRead(session) || (session?.State != SessionState.Draft && mine?.State == RegistrationState.Confirmed);

    private static PickupRegistration NewPlayer(Guid session, string name, string key, int? playerId, int? accountId) =>
        new() { Id = Guid.NewGuid(), SessionId = session, Name = name, EmailKey = key, PlayerId = playerId, AccountId = accountId,
            State = RegistrationState.Confirmed, CreatedUtc = DateTimeOffset.UtcNow };

    private static bool ValidBoard(Guid[][] teams, Guid[] byes)
    {
        if (teams == null || byes == null || teams.Length is < 2 or > ScrambleLimit || teams.Length % 2 != 0 ||
            teams.Any(t => t == null || t.Length == 0 || t.Length > ScrambleLimit) || byes.Length > ScrambleLimit) return false;
        var ids = teams.SelectMany(t => t).Concat(byes).ToArray();
        return ids.Length <= ScrambleLimit && ids.Distinct().Count() == ids.Length;
    }

    private static GameBoard Board(PickupGameSet set) => JsonSerializer.Deserialize<GameBoard>(set.BoardJson);
    private static GameScore[] Scores(PickupGameSet set) => JsonSerializer.Deserialize<GameScore[]>(set.ScoresJson);

    public sealed record PlayerInput(int[] PlayerIds, [StringLength(100)] string GuestName);
    public sealed record AttendanceInput(Guid? PlayerId, bool All, bool Playing, bool? CheckedInOnly);
    public sealed record LifecycleInput(bool Complete);
    public sealed record GameOptions(int TeamCount, int MaxTeamSize, bool Balanced, string History, Guid[] Top, Guid[] Low, bool AllowMinimumRepeats);
    public sealed record SetInput(Guid[][] Teams, Guid[] Byes, int GamesPerMatchup, GameOptions Options);
    public sealed record TeamInput(int Version, Guid[][] Teams);
    public sealed record ScoreInput(int Version, GameScore[] Scores);
    public sealed record GameScore(int Matchup, int Game, int First, int Second);
    public sealed record Participant(Guid Id, int? PlayerId, string Name, string Gender);
    public sealed record RosterPlayer(Guid Id, int? PlayerId, string Name, RegistrationState State, bool? Playing, string Gender);
    public sealed record GameBoard(Participant[][] Teams, Participant[] Byes, int GamesPerMatchup, GameOptions Options);
}

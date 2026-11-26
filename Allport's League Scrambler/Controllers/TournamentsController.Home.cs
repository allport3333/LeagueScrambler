using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Allport_s_League_Scrambler.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers;

public partial class TournamentsController
{
    private async Task<bool> CanViewTournamentRounds(DataContext db, int leagueId) =>
        LeagueAccess.CanManage(User, db, leagueId) ||
        (LeagueAccess.TryGetAccountId(User, out var accountId) &&
            await db.UsersPlayer.AnyAsync(link => link.UserId == accountId &&
                db.PlayersLeagues.Any(member => member.LeagueID == leagueId && member.PlayerID == link.PlayerId)));

    [HttpGet("home")]
    public async Task<IActionResult> HomeSummary(int leagueId)
    {
        await using var db = new DataContext();
        var name = await db.Leagues.Where(row => row.ID == leagueId && row.EventTypeId == 2)
            .Select(row => row.LeagueName).SingleOrDefaultAsync();
        if (name == null) return NotFound();
        if (!await CanViewTournamentRounds(db, leagueId)) return Forbid();

        var canManage = LeagueAccess.CanManage(User, db, leagueId);
        var details = await db.TournamentConfigurations.AsNoTracking().SingleOrDefaultAsync(row => row.LeagueId == leagueId);
        var participantIds = db.PlayersLeagues.Where(row => row.LeagueID == leagueId).Select(row => row.PlayerID);
        var participants = await participantIds.Distinct().CountAsync();
        int? checkedIn = null;
        if (details is { EventDate: var date } && date != default && details.CheckInMode != TournamentCheckInMode.Skipped)
        {
            var start = date.ToDateTime(TimeOnly.MinValue);
            var end = start.AddDays(1);
            checkedIn = await db.PlayerSignIn.Where(row => row.LeagueId == leagueId &&
                row.DateTime >= start && row.DateTime < end && participantIds.Contains(row.PlayerId))
                .Select(row => row.PlayerId).Distinct().CountAsync();
        }

        var rounds = await db.TournamentRounds.AsNoTracking()
            .Where(row => row.LeagueId == leagueId && row.VoidedAtUtc == null).OrderBy(row => row.RoundNumber).ToListAsync();
        var numbers = rounds.Select(row => row.ScrambleNumber).ToArray();
        var teams = await db.KingQueenTeam.AsNoTracking()
            .Where(row => row.LeagueID == leagueId && numbers.Contains(row.ScrambleNumber))
            .Include(row => row.KingQueenPlayers).ThenInclude(row => row.Player)
            .Include(row => row.KingQueenRoundScores).AsSplitQuery().OrderBy(row => row.Id).ToListAsync();
        var teamsByRound = teams.ToLookup(t => t.ScrambleNumber);
        var progress = rounds.Select(row => new {
            row.RoundNumber,
            Status = TournamentMatchupResults.RoundStatus(teamsByRound[row.ScrambleNumber].ToArray(), row.GamesPerMatchup)
        }).ToArray();
        var completed = progress.Count(round => round.Status == "completed");
        var total = details?.RoundSettingsJson != null ? DecodeSettings(details).NumberOfRounds : (int?)null;
        var status = details == null && rounds.Count == 0 ? null :
            TournamentMatchupResults.TournamentStatus(total ?? rounds.Count, rounds.Count, completed, details?.WorkflowStep ?? 1);
        var wins = TournamentMatchupResults.WinsByPlayer(rounds, teams);
        var standings = teams.Where(t => t.KingQueenRoundScores.Count > 0)
            .SelectMany(t => t.KingQueenPlayers.Select(p => p.Player)).DistinctBy(p => p.Id)
            .Select(p => new { Name = p.FirstName + " " + p.LastName, Wins = wins.GetValueOrDefault(p.Id) })
            .OrderByDescending(p => p.Wins).ThenBy(p => p.Name).Take(5).ToArray();
        var recent = rounds.OrderByDescending(round => round.RoundNumber).SelectMany(round =>
        {
            var roundTeams = teamsByRound[round.ScrambleNumber].ToArray();
            // Guided rounds pair consecutive teams in saved ID order, as the round workspace does.
            if (roundTeams.Length % 2 != 0) return Enumerable.Empty<object>();
            return roundTeams.Chunk(2).Select((pair, index) => new {
                round.RoundNumber,
                Matchup = index + 1,
                Teams = pair.Select(team => team.KingQueenPlayers.OrderBy(player => player.Id)
                    .Select(player => player.Player.FirstName + " " + player.Player.LastName)),
                Scores = pair[0].KingQueenRoundScores.OrderBy(score => score.RoundId)
                    .Where(score => score.RoundId >= 1 && score.RoundId <= round.GamesPerMatchup &&
                        pair[0].KingQueenRoundScores.Count(s => s.RoundId == score.RoundId) == 1 &&
                        pair[1].KingQueenRoundScores.Count(s => s.RoundId == score.RoundId) == 1)
                    .Select(score => new { Game = score.RoundId, First = score.RoundScore,
                        Second = pair[1].KingQueenRoundScores.Single(s => s.RoundId == score.RoundId).RoundScore })
                    .ToArray()
            }).Where(match => match.Scores.Length > 0).Cast<object>();
        }).Take(3).ToArray();
        var hasResults = teams.Any(t => t.KingQueenRoundScores.Count > 0) || (rounds.Count == 0 &&
            await db.KingQueenTeam.AnyAsync(t => t.LeagueID == leagueId && t.ScrambleWithScoresToBeSaved &&
                t.KingQueenRoundScores.Any()));
        return Ok(new {
            name, date = details?.EventDate == default(DateOnly) ? null : details?.EventDate, location = details?.Location,
            status, canManage, participants, checkedIn, generated = rounds.Count, completed, total, hasResults,
            nextRound = progress.FirstOrDefault(round => round.Status != "completed"),
            standings, recent
        });
    }
}

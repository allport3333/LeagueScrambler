using System;
using System.Collections.Generic;
using System.Linq;

namespace Allport_s_League_Scrambler.Models
{
    // Pure read-model calculations: one saved score ID is one game/round.
    // Kept independent of EF so duplicate joins and league boundaries can be tested without SQL.
    public static class PlayerProfileStatistics
    {
        public static object Combined(int playerId, int leagueId, IEnumerable<LeagueTeam> allTeams,
            IEnumerable<LeagueTeamPlayer> memberships, IEnumerable<LeagueTeamScore> savedScores, IEnumerable<Player> players)
        {
            var teams = allTeams.Where(t => t.LeagueID == leagueId).ToDictionary(t => t.Id);
            var links = memberships.Where(m => teams.ContainsKey(m.LeagueTeamId)).ToList();
            var ownTeams = new HashSet<int>(links.Where(m => m.PlayerId == playerId).Select(m => m.LeagueTeamId));
            // Persisted scores have non-nullable points/WonGame. Existing rules count ties as nonwins/losses.
            // Reject unsaved or structurally invalid rows without changing any stored records.
            var games = savedScores.Where(s => s.Id > 0 && s.TeamScore >= 0 && s.Date != default(DateTime)
                && ownTeams.Contains(s.LeagueTeamId) && teams.ContainsKey(s.OpponentsLeagueTeamId)
                && s.LeagueTeamId != s.OpponentsLeagueTeamId).GroupBy(s => s.Id)
                .Select(g => g.First()).OrderBy(s => s.Date).ThenBy(s => s.Id).ToList();
            var names = players.GroupBy(p => p.Id).ToDictionary(g => g.Key, g => g.First().FirstName + " " + g.First().LastName);
            int winning = 0, losing = 0, longestWin = 0, longestLoss = 0;
            foreach (var game in games)
            {
                if (game.WonGame) { winning++; losing = 0; longestWin = Math.Max(longestWin, winning); }
                else { losing++; winning = 0; longestLoss = Math.Max(longestLoss, losing); }
            }
            var teammates = links.Where(m => ownTeams.Contains(m.LeagueTeamId) && m.PlayerId != playerId)
                .GroupBy(m => m.PlayerId).Select(group =>
                {
                    var sharedTeams = new HashSet<int>(group.Select(m => m.LeagueTeamId));
                    var sharedGames = games.Where(g => sharedTeams.Contains(g.LeagueTeamId)).ToList();
                    return new { PlayerId = group.Key, PlayerName = names.ContainsKey(group.Key) ? names[group.Key] : "Unavailable player",
                        TimesPlayedTogether = sharedGames.Count, WinsTogether = sharedGames.Count(g => g.WonGame) };
                }).OrderByDescending(t => t.TimesPlayedTogether).ThenBy(t => t.PlayerName).ThenBy(t => t.PlayerId).ToList();
            var opponents = games.GroupBy(g => g.OpponentsLeagueTeamId).Select(group => new
            {
                OpponentTeamId = group.Key, OpponentTeamName = teams.ContainsKey(group.Key) ? teams[group.Key].TeamName : "Unavailable team",
                GamesPlayed = group.Count(), Wins = group.Count(g => g.WonGame),
                WinPercentage = 100.0 * group.Count(g => g.WonGame) / group.Count(),
                TotalPointsScored = group.Sum(g => g.TeamScore), AveragePointsPerGame = group.Average(g => g.TeamScore)
            }).ToList();
            return new
            {
                TotalScores = games.Sum(g => g.TeamScore), TotalWins = games.Count(g => g.WonGame),
                TotalLosses = games.Count(g => !g.WonGame), TotalGames = games.Count,
                WinPercentage = games.Count == 0 ? 0 : 100.0 * games.Count(g => g.WonGame) / games.Count,
                AverageScore = games.Count == 0 ? 0 : games.Average(g => g.TeamScore),
                HighestScore = games.Count == 0 ? 0 : games.Max(g => g.TeamScore), LowestScore = games.Count == 0 ? 0 : games.Min(g => g.TeamScore),
                LongestWinStreak = longestWin, LongestLossStreak = longestLoss, TotalOpponents = opponents.Count,
                OpponentStats = opponents,
                // Historical API name retained: LeagueName has always contained the team name.
                LeagueStats = games.GroupBy(g => g.LeagueTeamId).Select(group => new {
                    LeagueTeamId = group.Key, LeagueName = teams[group.Key].TeamName, GamesPlayed = group.Count(),
                    Wins = group.Count(g => g.WonGame), WinPercentage = 100.0 * group.Count(g => g.WonGame) / group.Count()
                }).ToList(),
                TeammateStats = teammates
            };
        }

        public static object KingQueen(int playerId, IEnumerable<ProfileRound> savedRounds, IEnumerable<ProfileMember> teamMembers)
        {
            var rounds = savedRounds.GroupBy(r => r.ScoreId).Select(g => g.First()).OrderBy(r => r.DateOfTeam)
                .ThenBy(r => r.ScrambleNumber).ThenBy(r => r.RoundNumber).ThenBy(r => r.ScoreId).ToList();
            var teamIds = new HashSet<int>(rounds.Select(r => r.Id));
            var members = teamMembers.Where(m => m.PlayerId != playerId && teamIds.Contains(m.Id))
                .GroupBy(m => new { m.Id, m.PlayerId }).Select(g => g.First()).ToList();
            return new {
                IndividualRounds = rounds, TotalScores = rounds.Sum(r => r.RoundScore), TotalWins = rounds.Count(r => r.RoundWon == true),
                TeamMembers = members,
                ScrambleTotals = rounds.GroupBy(r => r.ScrambleNumber).Select(group => new {
                    ScrambleNumber = group.Key, DateOfTeam = group.Min(r => r.DateOfTeam), TotalScore = group.Sum(r => r.RoundScore),
                    Wins = group.Count(r => r.RoundWon == true),
                    Team = members.Where(m => group.Any(r => r.Id == m.Id)).GroupBy(m => m.PlayerId)
                        .Select(g => new { PlayerId = g.Key, PlayerName = g.First().PlayerName, IsMale = g.First().IsMale }).ToList()
                }).ToList(),
                TeammateCounts = members.GroupBy(m => m.PlayerId).Select(group => new {
                    PlayerId = group.Key, PlayerName = group.First().PlayerName,
                    Count = group.Select(m => m.ScrambleNumber).Distinct().Count(),
                    WinsTogether = rounds.Count(r => r.RoundWon == true && group.Any(m => m.Id == r.Id))
                }).OrderByDescending(t => t.Count).ThenBy(t => t.PlayerId).ToList()
            };
        }
    }
    public class ProfileRound
    {
        public int ScoreId { get; set; }
        public int Id { get; set; } // Existing response contract: the saved KingQueenTeam ID.
        public int RoundNumber { get; set; }
        public int RoundScore { get; set; }
        public bool? RoundWon { get; set; }
        public int ScrambleNumber { get; set; }
        public DateTime DateOfTeam { get; set; }
    }
    public class ProfileMember
    {
        public int Id { get; set; }
        public int PlayerId { get; set; }
        public string PlayerName { get; set; }
        public bool IsMale { get; set; }
        public int ScrambleNumber { get; set; }
    }
}

using System.Collections.Generic;
using System.Linq;
using Allport_s_League_Scrambler.Models;

namespace Allport_s_League_Scrambler.Services
{
    public static class TournamentMatchupResults
    {
        public static Dictionary<int, int> WinsByPlayer(IEnumerable<TournamentRound> rounds, IEnumerable<KingQueenTeam> teams)
        {
            var wins = new Dictionary<int, int>();
            var byScramble = teams.ToLookup(team => team.ScrambleNumber);
            foreach (var round in rounds)
            {
                foreach (var pair in byScramble[round.ScrambleNumber].OrderBy(team => team.Id).Chunk(2))
                {
                    if (pair.Length != 2 || pair.Any(team => !HasAllGames(team, round.GamesPerMatchup))) continue;
                    var first = pair[0].KingQueenRoundScores.Sum(score => (long)score.RoundScore);
                    var second = pair[1].KingQueenRoundScores.Sum(score => (long)score.RoundScore);
                    if (first == second) continue;
                    foreach (var player in pair[first > second ? 0 : 1].KingQueenPlayers.Select(row => row.PlayerId).Distinct())
                        wins[player] = wins.GetValueOrDefault(player) + 1;
                }
            }
            return wins;
        }

        public static bool IsComplete(IEnumerable<KingQueenTeam> teams, int games)
        {
            var list = teams.ToArray();
            return list.Length >= 2 && list.Length % 2 == 0 && list.All(team => HasAllGames(team, games));
        }

        public static string RoundStatus(IReadOnlyList<KingQueenTeam> teams, int games) =>
            IsComplete(teams, games) ? "completed" :
                teams.Any(team => team.KingQueenRoundScores.Count > 0) ? "partial" : "unplayed";

        public static string TournamentStatus(int total, int generated, int completed, int step) =>
            total > 0 && completed == total ? "Completed" :
                generated > 0 ? "In Progress" : step >= 6 ? "Ready" : "Setup In Progress";

        private static bool HasAllGames(KingQueenTeam team, int games) =>
            team.KingQueenRoundScores.Count == games &&
            team.KingQueenRoundScores.Select(score => score.RoundId).ToHashSet().SetEquals(Enumerable.Range(1, games));
    }
}

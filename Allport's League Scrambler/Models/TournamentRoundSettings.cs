using System;
using System.Collections.Generic;
using System.Linq;

namespace Allport_s_League_Scrambler.Models
{
    public sealed record TournamentBye(int RoundNumber, int PlayerId);

    public sealed record TournamentRoundSettings
    {
        public int? MaximumTeamSize { get; init; } = 4;
        public int? NumberOfTeams { get; init; }
        public int NumberOfRounds { get; init; } = 5;
        public int GamesPerMatchup { get; init; } = 1;
        public bool BalanceGenders { get; init; } = true;
        public bool MinimizeRepeats { get; init; } = true;
        public bool AutomaticByes { get; init; }
        public int? ActiveTeamLimit { get; init; }
        public int[] TopPlayerIds { get; init; } = Array.Empty<int>();
        public int[] LowPlayerIds { get; init; } = Array.Empty<int>();
        public int[] HistoricalScrambleNumbers { get; init; } = Array.Empty<int>();
        public int LastScrambleNumber { get; init; }
        public TournamentBye[] ManualByes { get; init; } = Array.Empty<TournamentBye>();

        public string Validate(HashSet<int> roster, HashSet<int> savedScrambles, int? maximumRoundNumber = null)
        {
            if (MaximumTeamSize.HasValue == NumberOfTeams.HasValue ||
                MaximumTeamSize is < 2 or > 5 ||
                (NumberOfTeams is int teams && (teams < 2 || teams > 128 || teams % 2 != 0)))
                return "Choose a maximum team size from 2 to 5 or an even number of teams from 2 to 128.";
            if (NumberOfRounds is < 0 or > 30 || GamesPerMatchup is < 1 or > 9)
                return "Choose 1 to 30 rounds and 1 to 9 games per matchup.";
            if (ActiveTeamLimit is int limit &&
                (MaximumTeamSize == null || limit < 2 || limit > 128 || limit % 2 != 0))
                return "An active team limit requires Maximum Team Size and an even limit from 2 to 128.";
            if (!UniqueMembers(TopPlayerIds, roster) || !UniqueMembers(LowPlayerIds, roster) ||
                TopPlayerIds.Intersect(LowPlayerIds).Any())
                return "Top and low priorities must reference distinct tournament participants.";
            if (!UniqueMembers(HistoricalScrambleNumbers, savedScrambles))
                return "Select distinct saved scrambles from this tournament for strict avoidance.";
            if (ManualByes == null || ManualByes.Any(bye => bye == null || bye.RoundNumber < 1 ||
                bye.RoundNumber > (maximumRoundNumber ?? NumberOfRounds) || !roster.Contains(bye.PlayerId)) ||
                ManualByes.Distinct().Count() != ManualByes.Length)
                return "Each manual bye must identify a tournament participant and a configured round once.";
            return null;
        }

        private static bool UniqueMembers(int[] ids, HashSet<int> allowed) =>
            ids != null && ids.Length <= allowed.Count && ids.Distinct().Count() == ids.Length && ids.All(allowed.Contains);
    }
}

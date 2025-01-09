using System.Collections.Generic;

namespace Allport_s_League_Scrambler.Models
{
    public class TeamScoreDto
    {
        public int KingQueenTeamId { get; set; }
        public int LeagueId { get; set; }
        public string Date { get; set; }
        public int ScrambleNumber { get; set; }
        public List<PlayerDto> Players { get; set; }
        public List<RoundScoreDto> RoundScores { get; set; }
    }

    public class PlayerDto
    {
        public int PlayerId { get; set; }
        public bool? isSubScore { get; set; }
    }

    public class RoundScoreDto
    {
        public int RoundId { get; set; }
        public int RoundScore { get; set; }
        public bool RoundWon { get; set; }
    }

    public class PlayerDto2
    {
        public int Id { get; set; } // Standardize to "Id" for all player objects
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsMale { get; set; }
    }

    public class TeamWithPlayersDto
    {
        public int Id { get; set; }
        public string TeamName { get; set; }
        public int TotalWins { get; set; }
        public int TotalLosses { get; set; }

        public List<PlayerDtoFullName> Players { get; set; }
    }

    public class PlayerDtoFullName
    {
        public int Id { get; set; }
        public string FullName { get; set; }
        public bool IsMale { get; set; }
    }

}

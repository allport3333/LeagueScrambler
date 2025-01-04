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

}

using System;
using System.Collections.Generic;

namespace Allport_s_League_Scrambler.Models
{
    public class KingQueenTeam
    {
        public int Id { get; set; }
        public int LeagueID { get; set; }
        public DateTime DateOfTeam { get; set; }
        public List<KingQueenPlayer> KingQueenPlayers { get; set; }
        public int ScrambleNumber { get; set; }
        public List<KingQueenRoundScores> KingQueenRoundScores { get; set; }
    }

}

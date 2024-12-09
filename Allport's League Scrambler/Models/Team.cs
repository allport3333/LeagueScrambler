using System;
using System.Collections.Generic;

namespace Allport_s_League_Scrambler.Models
{
    public class Team
    {
        public int MaleCount { get; set; }
        public int FemaleCount { get; set; }
        public List<Player> Players { get; set; }
        public List<KingQueenRoundScores> KingQueenRoundScores { get; set; }
        public int KingQueenTeamId { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class KingQueenRoundScores
    {
        public int Id { get; set; }
        public int RoundId { get; set; }
        public int KingQueenTeamId { get; set; }
        public int RoundScore { get; set; }
        public bool? RoundWon { get; set; }


    }
}

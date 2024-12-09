using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class KingQueenRoundScoresRequest
    {
        public List<KingQueenRoundScores> RoundScores { get; set; }
    }
}

using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class KingQueenRoundScoresResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public List<KingQueenRoundScores> SavedScores { get; set; }
    }
}

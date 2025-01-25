using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class KingQueenTopPlayer
    {
        public int Id { get; set; }

        public int PlayerId { get; set; }
        public Player Player { get; set; }
        public int LeagueId { get; set; }
        public LeagueType League { get; set; }
        public int Rank { get; set; }   

    }
}

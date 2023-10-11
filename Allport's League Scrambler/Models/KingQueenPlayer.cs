using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class KingQueenPlayer
    {
        public int Id { get; set; }

        [ForeignKey("KingQueenTeam")]
        public int KingQueenTeamId { get; set; }
        public KingQueenTeam KingQueenTeam { get; set; }


        public int PlayerId { get; set; }
        public Player Player { get; set; }


    }
}

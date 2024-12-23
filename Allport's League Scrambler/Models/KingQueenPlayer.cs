using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class KingQueenPlayer
    {
        public int Id { get; set; }

        public int KingQueenTeamId { get; set; }
        public bool? isSubScore { get; set; }

        public int PlayerId { get; set; }
        public Player Player { get; set; }


    }
}

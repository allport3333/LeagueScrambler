using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueTeamPlayer
    {
        public int Id { get; set; }

        public int LeagueTeamId { get; set; }

        // The actual player
        public int PlayerId { get; set; }
        public Player Player { get; set; }
        public LeagueTeam LeagueTeam { get; set; }
    }

}

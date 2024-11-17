using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class SaveKingQueenTeamsResponse
    {
        public List<KingQueenTeamWithPlayers> KingQueenTeams { get; set; }
        public List<Player> ByePlayers { get; set; }
    }
}

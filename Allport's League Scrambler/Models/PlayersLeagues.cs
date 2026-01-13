using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class PlayersLeague
    {
        public int Id { get; set; }
        public int LeagueID { get; set; }
        public int PlayerID { get; set; }
        public bool? IsSub { get; set; }

        public int? LeagueDivisionId { get; set; }
        public LeagueDivision LeagueDivision { get; set; }

        public LeagueType LeagueType { get; set; }
        public Player Player { get; set; }
    }

}

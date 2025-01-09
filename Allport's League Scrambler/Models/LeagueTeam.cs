using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueTeam
    {
        public int Id { get; set; }
        public string TeamName { get; set; }
        public int TotalWins { get; set; }
        public int TotalLosses { get; set; }
        public int LeagueID { get; set; }
        public string Division { get; set; } 
    }
}

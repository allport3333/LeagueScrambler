using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueTeamScoreDto
    {
        public int Id { get; set; }
        public int TeamId { get; set; }
        public int OpponentsTeamId { get; set; }
        public int TeamScore { get; set; }
        public bool WonGame { get; set; }
        public DateTime Date { get; set; }
        public string TeamName { get; set; }
        public string OpponentsTeamName { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    using System.ComponentModel.DataAnnotations.Schema;

    public class LeagueTeamScore
    {
        public int Id { get; set; }

        public int LeagueTeamId { get; set; }

        [ForeignKey(nameof(LeagueTeamId))]
        public LeagueTeam LeagueTeam { get; set; }

        public int OpponentsLeagueTeamId { get; set; }

        [ForeignKey(nameof(OpponentsLeagueTeamId))]
        public LeagueTeam OpponentsTeam { get; set; }

        public int TeamScore { get; set; }
        public bool WonGame { get; set; }
        public DateTime Date { get; set; }
    }


}

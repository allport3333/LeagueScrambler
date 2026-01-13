using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueDivision
    {
        public int Id { get; set; }
        public int LeagueID { get; set; }

        public string Code { get; set; }   // "A", "B", "C", "D"
        public string Name { get; set; }   // optional
        public int SortOrder { get; set; }

        public LeagueType LeagueType { get; set; }
        public ICollection<PlayersLeague> PlayersLeagues { get; set; }
    }

}

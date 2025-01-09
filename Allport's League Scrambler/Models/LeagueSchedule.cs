using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueSchedule
    {
        public int Id { get; set; } // Primary Key

        // Foreign Key to League
        public int LeagueId { get; set; }
        public LeagueType League { get; set; } // Navigation Property

        public int WeekNumber { get; set; } // Week of the schedule
        public DateTime Date { get; set; } // Date of the match
        // Foreign Key to Team 1
        public int Team1Id { get; set; }
        public LeagueTeam Team1 { get; set; } // Navigation Property

        // Foreign Key to Team 2
        public int Team2Id { get; set; }
        public LeagueTeam Team2 { get; set; } // Navigation Property

        public string MatchDescription { get; set; } // Description of the match
    }


}

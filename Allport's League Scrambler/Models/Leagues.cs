using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueType
    {
        public int ID { get; set; }
        public string LeagueName { get; set; }
        public int EventTypeId { get; set; } = 1;

    }

    public class EventType
    {
        public int ID { get; set; }
        public string Name { get; set; }
    }

    public class TournamentConfiguration
    {
        public int LeagueId { get; set; }
        public DateOnly EventDate { get; set; }
        public string Description { get; set; }
        public string Location { get; set; }
        public Guid Version { get; set; }
        public TournamentCheckInMode CheckInMode { get; set; }
        public int WorkflowStep { get; set; } = 2;
        [Newtonsoft.Json.JsonIgnore]
        public int? OwnerUserId { get; set; }
        [System.Text.Json.Serialization.JsonIgnore, Newtonsoft.Json.JsonIgnore]
        public string RoundSettingsJson { get; set; }
    }

    public enum TournamentCheckInMode { NotConfigured, Open, Manual, Skipped }
}

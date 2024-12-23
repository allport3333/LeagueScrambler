using Allport_s_League_Scrambler.Models;
using System;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueSettings
    {
        public int LeagueSettingsId { get; set; }

        public int LeagueId { get; set; }
        public LeagueType League { get; set; }

        public string SettingName { get; set; }
        public string SettingValue { get; set; }
    }
}

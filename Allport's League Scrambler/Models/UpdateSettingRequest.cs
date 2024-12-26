using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class UpdateSettingRequest
    {
        public string SettingName { get; set; }
        public string SettingValue { get; set; }
        public int LeagueId { get; set; }
    }
}

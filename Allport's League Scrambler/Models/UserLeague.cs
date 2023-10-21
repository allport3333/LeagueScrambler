using Allport_s_League_Scrambler.Models;
using System;

namespace Allport_s_League_Scrambler.Models
{
    public class UserLeague
    {
        public int UserLeagueId { get; set; }

        public int UserId { get; set; }
        public User User { get; set; }

        public int LeagueTypeId { get; set; }
        public LeagueType LeagueType { get; set; }
    }
}

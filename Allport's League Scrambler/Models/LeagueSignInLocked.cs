using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class LeagueSignInLocked
    {
        public int Id { get; set; }
        public int LeagueId { get; set; }
        public bool SignInLocked { get; set; }
        public LeagueType LeagueType { get; set; }
    }
}

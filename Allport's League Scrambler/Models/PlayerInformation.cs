using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class PlayerInformation
    {
        public int Id { get; set; }
        public int PlayerID { get; set; }
        public List<PlayerScore> AllPlayerScores { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }

    }
}

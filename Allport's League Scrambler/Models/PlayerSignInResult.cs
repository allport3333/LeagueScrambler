using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    public class PlayerSignInResult
    {
        public int PlayerSignInId { get; set; }
        public DateTime DateTime { get; set; }
        public int LeagueId { get; set; }
        public int PlayerId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Gender { get; set; }
    }

}

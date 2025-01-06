using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    [Table("PlayerSignIn", Schema = "dbo")]
    public class PlayerSignIn
    {
        [Key]
        public int PlayerSignInId { get; set; }
        public DateTime DateTime { get; set; }
        public int LeagueId { get; set; }
        public int PlayerId { get; set; }
        public bool LockedSignIn { get; set; }

        // Foreign keys
        [ForeignKey("LeagueId")]
        public virtual LeagueType League { get; set; }

        [ForeignKey("PlayerId")]
        public virtual Player Player { get; set; }
    }
}

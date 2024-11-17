using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    [Table("ByeRounds", Schema = "dbo")]
    public class ByeRounds
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int LeagueID { get; set; }

        [Required]
        public DateTime DateOfRound { get; set; }

        [Required]
        public int ScrambleNumber { get; set; }

        // Navigation property to link with LeagueType
        [ForeignKey("LeagueID")]
        public virtual LeagueType LeagueType { get; set; }

        // Navigation property for related ByePlayers
        public virtual ICollection<ByePlayer> ByePlayers { get; set; }
    }
}

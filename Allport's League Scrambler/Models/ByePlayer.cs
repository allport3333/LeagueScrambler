using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    [Table("ByePlayer", Schema = "dbo")]
    public class ByePlayer
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public int ByeRoundId { get; set; }
        public int PlayerId { get; set; }

        // Foreign keys
        [ForeignKey("ByeRoundId")]
        public virtual ByeRounds ByeRound { get; set; }

        [ForeignKey("PlayerId")]
        public virtual Player Player { get; set; }
    }
}

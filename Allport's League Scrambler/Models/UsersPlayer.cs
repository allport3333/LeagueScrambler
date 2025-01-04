using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models
{
    [Table("UsersPlayer", Schema = "dbo")]
    public class UsersPlayer
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int UsersPlayerId { get; set; }

        public int UserId { get; set; }
        public int PlayerId { get; set; }

        // Foreign keys
        [ForeignKey("UserId")]
        public virtual User User { get; set; }

        [ForeignKey("PlayerId")]
        public virtual Player Player { get; set; }
    }
}

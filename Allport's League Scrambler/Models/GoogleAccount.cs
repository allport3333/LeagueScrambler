using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Models;

[Table("GoogleAccount", Schema = "dbo")]
[Index(nameof(UserId), IsUnique = true)]
public sealed class GoogleAccount
{
    [Key, MaxLength(255)]
    public string Subject { get; set; }
    public int UserId { get; set; }
}

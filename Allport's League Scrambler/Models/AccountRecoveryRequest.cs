using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Allport_s_League_Scrambler.Models;

[Table("AccountRecoveryRequest", Schema = "dbo")]
public sealed class AccountRecoveryRequest
{
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public int? PlayerId { get; set; }
    public int AccountVersion { get; set; }
    [MaxLength(254)] public string ContactEmail { get; set; }
    [MaxLength(1000)] public string ReviewInformation { get; set; }
    [MaxLength(64)] public string TokenHash { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? VerifiedUtc { get; set; }
    public DateTime? DecidedUtc { get; set; }
    public int? ReviewerId { get; set; }
    [MaxLength(1000)] public string ReviewDecision { get; set; }
    public bool Approved { get; set; }
}

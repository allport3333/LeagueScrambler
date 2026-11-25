using System;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Pickup;

public enum SessionState { Draft, Published, InProgress, Completed, Cancelled }
public enum SessionVisibility { Public, Unlisted, Private }
public enum RegistrationState { PendingVerification, PendingApproval, Confirmed, Cancelled, Declined, Waitlisted, Offered }

[Index(nameof(Name), nameof(Address), nameof(PostalCode))]
public sealed class PickupVenue
{
    public int Id { get; set; }
    [Required, MaxLength(100)] public string Name { get; set; }
    [Required, MaxLength(140)] public string Address { get; set; }
    [Required, MaxLength(80)] public string City { get; set; }
    [Required, MaxLength(50)] public string Region { get; set; }
    [Required, MaxLength(16)] public string PostalCode { get; set; }
    [Required, MaxLength(50)] public string Country { get; set; }
    [Required, MaxLength(80)] public string TimeZone { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

[Index(nameof(Visibility), nameof(State), nameof(StartsUtc))]
public sealed class PickupSession
{
    public Guid Id { get; set; }
    public int OrganizerId { get; set; }
    public int VenueId { get; set; }
    public PickupVenue Venue { get; set; }
    [Required, MaxLength(100)] public string Name { get; set; }
    [Required, MaxLength(40)] public string Sport { get; set; }
    [MaxLength(1200)] public string Description { get; set; }
    [MaxLength(40)] public string Skill { get; set; }
    [MaxLength(700)] public string OrganizerNotes { get; set; }
    public DateOnly LocalDate { get; set; }
    public DateTimeOffset StartsUtc { get; set; }
    public DateTimeOffset EndsUtc { get; set; }
    public DateTimeOffset? DeadlineUtc { get; set; }
    public int? Capacity { get; set; }
    public bool ApprovalRequired { get; set; }
    public SessionVisibility Visibility { get; set; }
    public SessionState State { get; set; }
}

[Index(nameof(SessionId), nameof(AccountId), IsUnique = true)]
[Index(nameof(SessionId), nameof(EmailKey), IsUnique = true)]
[Index(nameof(SessionId), nameof(State))]
[Index(nameof(SessionId), nameof(VerificationHash))]
[Index(nameof(SessionId), nameof(AccessHash))]
public sealed class PickupRegistration
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public int? AccountId { get; set; }
    public int? PlayerId { get; set; }
    [Required, MaxLength(64)] public string EmailKey { get; set; }
    [Required, MaxLength(100)] public string Name { get; set; }
    public RegistrationState State { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset? VerifiedUtc { get; set; }
    [MaxLength(64)] public string VerificationHash { get; set; }
    public DateTimeOffset? VerificationExpiresUtc { get; set; }
    [MaxLength(64)] public string AccessHash { get; set; }
    public DateTimeOffset? AccessExpiresUtc { get; set; }
}

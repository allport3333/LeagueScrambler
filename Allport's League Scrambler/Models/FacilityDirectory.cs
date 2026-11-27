using System;
using System.ComponentModel.DataAnnotations;
using Allport_s_League_Scrambler.Pickup;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Models;

[Index(nameof(SourceKey), IsUnique = true)]
public sealed class FacilityProfile
{
    [Key] public int VenueId { get; set; }
    public PickupVenue Venue { get; set; }
    [MaxLength(150)] public string AlternateName { get; set; }
    [MaxLength(500)] public string Website { get; set; }
    [MaxLength(250)] public string Activities { get; set; }
    [MaxLength(500)] public string Source { get; set; }
    [MaxLength(150)] public string SourceKey { get; set; }
    public DateTimeOffset VerifiedUtc { get; set; }
    public bool ApproximateCoordinates { get; set; }
}

[Index(nameof(VenueId), nameof(PublicListing))]
public sealed class EventFacility
{
    [Key] public int LeagueId { get; set; }
    public LeagueType League { get; set; }
    public int VenueId { get; set; }
    public PickupVenue Venue { get; set; }
    public bool PublicListing { get; set; }
    [MaxLength(40)] public string Sport { get; set; }
    [MaxLength(80)] public string Season { get; set; }
    [MaxLength(500)] public string Description { get; set; }
    public int? LeadAdminId { get; set; }
}

public sealed class FacilityProviderIdentity
{
    [Key, MaxLength(150)] public string SourceKey { get; set; }
    public int VenueId { get; set; }
}

public sealed class FacilityMerge
{
    public int Id { get; set; }
    public int SourceVenueId { get; set; }
    public int TargetVenueId { get; set; }
    public int AdminId { get; set; }
    [MaxLength(100)] public string SourceName { get; set; }
    [MaxLength(150)] public string SourceAlternateName { get; set; }
    public string Snapshot { get; set; }
    public DateTimeOffset MergedUtc { get; set; }
}

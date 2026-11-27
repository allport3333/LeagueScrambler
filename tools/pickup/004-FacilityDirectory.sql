SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.FacilityProfile', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FacilityProfile (
        VenueId int NOT NULL CONSTRAINT PK_FacilityProfile PRIMARY KEY,
        AlternateName nvarchar(150) NULL,
        Website nvarchar(500) NULL,
        Activities nvarchar(250) NULL,
        Source nvarchar(500) NULL,
        SourceKey nvarchar(150) NULL,
        VerifiedUtc datetimeoffset NOT NULL,
        ApproximateCoordinates bit NOT NULL,
        CONSTRAINT FK_FacilityProfile_PickupVenue FOREIGN KEY (VenueId) REFERENCES dbo.PickupVenue(Id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IX_FacilityProfile_SourceKey ON dbo.FacilityProfile(SourceKey) WHERE SourceKey IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.EventFacility', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventFacility (
        LeagueId int NOT NULL CONSTRAINT PK_EventFacility PRIMARY KEY,
        VenueId int NOT NULL,
        PublicListing bit NOT NULL,
        Sport nvarchar(40) NULL,
        Season nvarchar(80) NULL,
        Description nvarchar(500) NULL,
        LeadAdminId int NULL,
        CONSTRAINT FK_EventFacility_LeagueType FOREIGN KEY (LeagueId) REFERENCES dbo.LeagueType(ID) ON DELETE CASCADE,
        CONSTRAINT FK_EventFacility_PickupVenue FOREIGN KEY (VenueId) REFERENCES dbo.PickupVenue(Id),
        CONSTRAINT FK_EventFacility_LeadAdmin FOREIGN KEY (LeadAdminId) REFERENCES dbo.[User](UserId) ON DELETE SET NULL
    );
    CREATE INDEX IX_EventFacility_VenueId_PublicListing ON dbo.EventFacility(VenueId, PublicListing);
END;
COMMIT TRANSACTION;

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.PickupVenue', N'IdentityKey') IS NULL
    ALTER TABLE dbo.PickupVenue ADD IdentityKey nvarchar(64) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.PickupVenue') AND name = N'IX_PickupVenue_IdentityKey')
    EXEC(N'CREATE UNIQUE INDEX IX_PickupVenue_IdentityKey ON dbo.PickupVenue(IdentityKey) WHERE IdentityKey IS NOT NULL');
IF OBJECT_ID(N'dbo.FacilityProviderIdentity', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FacilityProviderIdentity (
        SourceKey nvarchar(150) NOT NULL CONSTRAINT PK_FacilityProviderIdentity PRIMARY KEY,
        VenueId int NOT NULL CONSTRAINT FK_FacilityProviderIdentity_PickupVenue REFERENCES dbo.PickupVenue(Id)
    );
    CREATE INDEX IX_FacilityProviderIdentity_VenueId ON dbo.FacilityProviderIdentity(VenueId);
    INSERT dbo.FacilityProviderIdentity (SourceKey, VenueId)
        SELECT LOWER(TRIM(SourceKey)), VenueId FROM dbo.FacilityProfile WHERE NULLIF(TRIM(SourceKey), '') IS NOT NULL;
END;
IF OBJECT_ID(N'dbo.FacilityMerge', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FacilityMerge (
        Id int IDENTITY NOT NULL CONSTRAINT PK_FacilityMerge PRIMARY KEY,
        SourceVenueId int NOT NULL,
        TargetVenueId int NOT NULL,
        AdminId int NOT NULL,
        SourceName nvarchar(100) NOT NULL,
        SourceAlternateName nvarchar(150) NULL,
        Snapshot nvarchar(max) NOT NULL,
        MergedUtc datetimeoffset NOT NULL
    );
    CREATE INDEX IX_FacilityMerge_TargetVenueId ON dbo.FacilityMerge(TargetVenueId);
END;
COMMIT TRANSACTION;

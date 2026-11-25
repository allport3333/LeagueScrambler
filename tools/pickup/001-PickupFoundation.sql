-- Additive Pickup schema for shared Development or an explicitly named disposable test database.
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
SET NOCOUNT ON;
IF DB_NAME() NOT IN (N'LeagueScramblerDev', N'LeagueScramblerPickupTest')
   AND NOT (DB_NAME() = N'LeagueScrambler' AND CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) = N'DESKTOP-UN67OEK'
        AND ISNULL(TRY_CONVERT(int, SESSION_CONTEXT(N'PickupProductionRelease')), 0) = 1 AND @@TRANCOUNT > 0)
    THROW 51000, 'Pickup migration requires the shared Development database or disposable test database.', 1;
IF OBJECT_ID(N'dbo.[User]', N'U') IS NULL OR OBJECT_ID(N'dbo.Player', N'U') IS NULL
   OR COL_LENGTH(N'dbo.[User]', N'UserId') <> 4 OR COL_LENGTH(N'dbo.Player', N'Id') <> 4
    THROW 51002, 'Existing account and player keys are required.', 1;

BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.PickupRegistration', N'U') IS NULL
BEGIN
    IF OBJECT_ID(N'dbo.PickupSession', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.PickupVenue', N'U') IS NOT NULL
        THROW 51001, 'Partial Pickup schema requires review.', 1;
    CREATE TABLE dbo.PickupVenue (
        Id int IDENTITY PRIMARY KEY, Name nvarchar(100) NOT NULL, Address nvarchar(140) NOT NULL,
        City nvarchar(80) NOT NULL, Region nvarchar(50) NOT NULL, PostalCode nvarchar(16) NOT NULL,
        Country nvarchar(50) NOT NULL, TimeZone nvarchar(80) NOT NULL, Latitude float NULL, Longitude float NULL
    );
    CREATE INDEX IX_PickupVenue_Name_Address_PostalCode ON dbo.PickupVenue(Name, Address, PostalCode);
    CREATE TABLE dbo.PickupSession (
        Id uniqueidentifier PRIMARY KEY, OrganizerId int NOT NULL REFERENCES dbo.[User](UserId),
        VenueId int NOT NULL REFERENCES dbo.PickupVenue(Id),
        Name nvarchar(100) NOT NULL, Sport nvarchar(40) NOT NULL, Description nvarchar(1200) NULL,
        Skill nvarchar(40) NULL, OrganizerNotes nvarchar(700) NULL, LocalDate date NOT NULL,
        StartsUtc datetimeoffset NOT NULL, EndsUtc datetimeoffset NOT NULL, DeadlineUtc datetimeoffset NULL,
        Capacity int NOT NULL, ApprovalRequired bit NOT NULL, Visibility int NOT NULL, State int NOT NULL
    );
    CREATE INDEX IX_PickupSession_OrganizerId ON dbo.PickupSession(OrganizerId);
    CREATE INDEX IX_PickupSession_VenueId ON dbo.PickupSession(VenueId);
    CREATE INDEX IX_PickupSession_Visibility_State_StartsUtc ON dbo.PickupSession(Visibility, State, StartsUtc);
    CREATE TABLE dbo.PickupRegistration (
        Id uniqueidentifier PRIMARY KEY, SessionId uniqueidentifier NOT NULL REFERENCES dbo.PickupSession(Id),
        AccountId int NULL REFERENCES dbo.[User](UserId), PlayerId int NULL REFERENCES dbo.Player(Id),
        EmailKey nvarchar(64) NOT NULL, Name nvarchar(100) NOT NULL, State int NOT NULL,
        CreatedUtc datetimeoffset NOT NULL, VerifiedUtc datetimeoffset NULL, VerificationHash nvarchar(64) NULL,
        VerificationExpiresUtc datetimeoffset NULL, AccessHash nvarchar(64) NULL, AccessExpiresUtc datetimeoffset NULL
    );
    CREATE UNIQUE INDEX IX_PickupRegistration_SessionId_AccountId
        ON dbo.PickupRegistration(SessionId, AccountId) WHERE AccountId IS NOT NULL;
    CREATE UNIQUE INDEX IX_PickupRegistration_SessionId_EmailKey ON dbo.PickupRegistration(SessionId, EmailKey);
    CREATE INDEX IX_PickupRegistration_SessionId_State ON dbo.PickupRegistration(SessionId, State);
    CREATE INDEX IX_PickupRegistration_SessionId_VerificationHash ON dbo.PickupRegistration(SessionId, VerificationHash);
    CREATE INDEX IX_PickupRegistration_SessionId_AccessHash ON dbo.PickupRegistration(SessionId, AccessHash);
    CREATE INDEX IX_PickupRegistration_AccountId ON dbo.PickupRegistration(AccountId);
    CREATE INDEX IX_PickupRegistration_PlayerId ON dbo.PickupRegistration(PlayerId);
END
ELSE IF OBJECT_ID(N'dbo.PickupSession', N'U') IS NULL OR OBJECT_ID(N'dbo.PickupVenue', N'U') IS NULL
    THROW 51001, 'Partial Pickup schema requires review.', 1;
-- These object checks are the migration marker, as in existing additive SQL upgrades.
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.PickupVenue')) <> 10
 OR (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.PickupSession')) <> 16 + CASE WHEN COL_LENGTH(N'dbo.PickupSession', N'CheckedInOnly') IS NULL THEN 0 ELSE 1 END
 OR (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.PickupRegistration')) <> 13 + CASE WHEN COL_LENGTH(N'dbo.PickupRegistration', N'Playing') IS NULL THEN 0 ELSE 1 END
 OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id IN (OBJECT_ID(N'dbo.PickupSession'), OBJECT_ID(N'dbo.PickupRegistration'))
     AND delete_referential_action = 0 AND is_disabled = 0 AND is_not_trusted = 0) <> 5
 OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PickupRegistration')
     AND name=N'IX_PickupRegistration_SessionId_AccountId' AND is_unique=1 AND has_filter=1 AND is_disabled=0)
 OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PickupRegistration')
     AND name=N'IX_PickupRegistration_SessionId_EmailKey' AND is_unique=1 AND is_disabled=0)
    THROW 51003, 'Pickup foundation schema verification failed.', 1;
COMMIT;
SELECT DB_NAME() AS DatabaseName, '001-PickupFoundation verified' AS MigrationState;

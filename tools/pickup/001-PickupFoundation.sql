-- Additive upgrade for a Pickup Development database with the baseline League Hub schema.
-- A fresh Pickup database is initialized from the current EF model with --initialize-pickup.
SET XACT_ABORT ON;
SET NOCOUNT ON;
IF DB_NAME() <> N'LeagueScramblerPickupDev' THROW 51000, 'Pickup migration requires LeagueScramblerPickupDev.', 1;
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
COMMIT;

-- Set these from the independently approved target inventory in a working copy.
-- Run on a restored production clone first. Execute with SQL errors treated as fatal.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @ExpectedServer sysname = NULL;
DECLARE @ExpectedDatabase sysname = NULL;

IF @ExpectedServer IS NULL OR @ExpectedDatabase IS NULL
   OR COALESCE(CONVERT(sysname, SERVERPROPERTY('ServerName')), N'') <> @ExpectedServer
   OR DB_NAME() <> @ExpectedDatabase
    THROW 51000, 'Target identity does not match the approved release inventory.', 1;

IF OBJECT_ID(N'dbo.User', N'U') IS NULL OR COL_LENGTH(N'dbo.User', N'UserId') IS NULL
    THROW 51001, 'The application account table is missing or incompatible.', 1;

BEGIN TRANSACTION;
DECLARE @Lock int;
EXEC @Lock = sys.sp_getapplock
    @Resource = N'LeagueHub:Schema:AccountRecovery:v1', @LockMode = N'Exclusive',
    @LockOwner = N'Transaction', @LockTimeout = 10000;
IF @Lock < 0
    THROW 51002, 'Could not acquire the migration lock.', 1;

DECLARE @HasVersion bit = CASE WHEN COL_LENGTH(N'dbo.User', N'SessionVersion') IS NULL THEN 0 ELSE 1 END;
DECLARE @HasRecovery bit = CASE WHEN OBJECT_ID(N'dbo.AccountRecoveryRequest', N'U') IS NULL THEN 0 ELSE 1 END;
IF @HasVersion <> @HasRecovery
    THROW 51003, 'Partial recovery schema found. Review before continuing.', 1;

IF @HasVersion = 0
BEGIN
    ALTER TABLE dbo.[User] ADD SessionVersion int NOT NULL CONSTRAINT DF_User_SessionVersion DEFAULT (0);
    CREATE TABLE dbo.AccountRecoveryRequest (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_AccountRecoveryRequest PRIMARY KEY,
        UserId int NOT NULL,
        PlayerId int NULL,
        AccountVersion int NOT NULL,
        ContactEmail nvarchar(254) NULL,
        ReviewInformation nvarchar(1000) NULL,
        TokenHash nvarchar(64) NULL,
        CreatedUtc datetime2 NOT NULL,
        ExpiresUtc datetime2 NOT NULL,
        VerifiedUtc datetime2 NULL,
        DecidedUtc datetime2 NULL,
        ReviewerId int NULL,
        ReviewDecision nvarchar(1000) NULL,
        Approved bit NOT NULL
    );
    CREATE INDEX IX_AccountRecoveryRequest_User_Created ON dbo.AccountRecoveryRequest(UserId, CreatedUtc);
    CREATE INDEX IX_AccountRecoveryRequest_Contact_Created ON dbo.AccountRecoveryRequest(ContactEmail, CreatedUtc);
END
ELSE
BEGIN
    THROW 51004, 'Recovery schema already exists. No writes made. Compare its column, default, key and index definitions with this script.', 1;
END;

COMMIT;
SELECT CONVERT(sysname, SERVERPROPERTY('ServerName')) AS ServerName, DB_NAME() AS DatabaseName;
EXEC sys.sp_help N'dbo.AccountRecoveryRequest';

SET XACT_ABORT ON;
IF DB_NAME() <> N'LeagueScramblerDev' OR COALESCE(CONVERT(nvarchar(40), CONNECTIONPROPERTY('net_transport')), N'') <> N'Shared memory'
    THROW 51000, 'Use the Development database directly.', 1;
IF COL_LENGTH(N'dbo.User', N'SessionVersion') IS NOT NULL OR OBJECT_ID(N'dbo.AccountRecoveryRequest', N'U') IS NOT NULL
    THROW 51000, 'Recovery schema already exists. Check the checkpoint before retrying.', 1;
BEGIN TRANSACTION;
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
COMMIT;

-- Additive Pickup workspace schema. Legacy applications ignore these objects.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() NOT IN (N'LeagueScramblerDev', N'LeagueScramblerPickupTest')
    THROW 51000, 'Pickup workspace requires a Development database.', 1;
IF OBJECT_ID(N'dbo.PickupSession', N'U') IS NULL OR OBJECT_ID(N'dbo.PickupRegistration', N'U') IS NULL
    THROW 51001, 'Apply Pickup Foundation first.', 1;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.PickupSession', N'CheckedInOnly') IS NULL
    ALTER TABLE dbo.PickupSession ADD CheckedInOnly bit NOT NULL CONSTRAINT DF_PickupSession_CheckedInOnly DEFAULT (0);
IF COL_LENGTH(N'dbo.PickupRegistration', N'Playing') IS NULL
    ALTER TABLE dbo.PickupRegistration ADD Playing bit NULL;
IF OBJECT_ID(N'dbo.PickupGameSet', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PickupGameSet (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_PickupGameSet PRIMARY KEY,
        SessionId uniqueidentifier NOT NULL CONSTRAINT FK_PickupGameSet_Session REFERENCES dbo.PickupSession(Id),
        Number int NOT NULL,
        CreatedUtc datetimeoffset NOT NULL,
        Version int NOT NULL,
        BoardJson nvarchar(max) NOT NULL,
        ScoresJson nvarchar(max) NOT NULL,
        CONSTRAINT CK_PickupGameSet_NumberVersion CHECK (Number > 0 AND Version > 0),
        CONSTRAINT CK_PickupGameSet_JSON CHECK (ISJSON(BoardJson) = 1 AND ISJSON(ScoresJson) = 1)
    );
    CREATE UNIQUE INDEX IX_PickupGameSet_SessionId_Number ON dbo.PickupGameSet(SessionId, Number);
END;
COMMIT;
SELECT DB_NAME() AS DatabaseName, '003-PickupWorkspace verified' AS MigrationState;

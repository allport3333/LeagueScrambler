SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.EventType', N'U') IS NULL
    CREATE TABLE dbo.EventType (
        ID int NOT NULL CONSTRAINT PK_EventType PRIMARY KEY,
        Name nvarchar(32) NOT NULL CONSTRAINT UQ_EventType_Name UNIQUE
    );

INSERT dbo.EventType (ID, Name)
SELECT v.ID, v.Name FROM (VALUES (1,N'League'),(2,N'Tournament'),(3,N'Pickup')) v(ID,Name)
WHERE NOT EXISTS (SELECT 1 FROM dbo.EventType t WHERE t.ID=v.ID);
IF (SELECT COUNT(*) FROM dbo.EventType
    WHERE (ID=1 AND Name=N'League') OR (ID=2 AND Name=N'Tournament') OR (ID=3 AND Name=N'Pickup')) <> 3
    THROW 51000, 'Event type lookup has unexpected identities.', 1;

IF COL_LENGTH(N'dbo.LeagueType', N'EventTypeId') IS NULL
    ALTER TABLE dbo.LeagueType ADD EventTypeId int NOT NULL CONSTRAINT DF_LeagueType_EventTypeId DEFAULT (1);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_LeagueType_EventType' AND parent_object_id=OBJECT_ID(N'dbo.LeagueType'))
    ALTER TABLE dbo.LeagueType WITH CHECK ADD CONSTRAINT FK_LeagueType_EventType FOREIGN KEY (EventTypeId) REFERENCES dbo.EventType(ID);
IF OBJECT_ID(N'dbo.TournamentConfiguration', N'U') IS NULL
    CREATE TABLE dbo.TournamentConfiguration (
        LeagueId int NOT NULL CONSTRAINT PK_TournamentConfiguration PRIMARY KEY
            CONSTRAINT FK_TournamentConfiguration_LeagueType REFERENCES dbo.LeagueType(ID),
        EventDate date NOT NULL,
        Description nvarchar(500) NULL,
        Location nvarchar(120) NULL,
        Version uniqueidentifier NOT NULL
    );
COMMIT TRANSACTION;

SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.TournamentConfiguration', N'CheckInMode') IS NULL
    ALTER TABLE dbo.TournamentConfiguration ADD CheckInMode int NOT NULL
        CONSTRAINT DF_TournamentConfiguration_CheckInMode DEFAULT (0)
        CONSTRAINT CK_TournamentConfiguration_CheckInMode CHECK (CheckInMode BETWEEN 0 AND 3);
COMMIT TRANSACTION;

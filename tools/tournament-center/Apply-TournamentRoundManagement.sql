SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.TournamentRound', N'U') IS NULL
    THROW 51000, 'Apply the TournamentRound migration first.', 1;
IF COL_LENGTH(N'dbo.TournamentRound', N'VoidedAtUtc') IS NULL
    ALTER TABLE dbo.TournamentRound ADD VoidedAtUtc datetime2 NULL;
IF COL_LENGTH(N'dbo.TournamentRound', N'VoidedByUserId') IS NULL
    ALTER TABLE dbo.TournamentRound ADD VoidedByUserId int NULL;
COMMIT TRANSACTION;

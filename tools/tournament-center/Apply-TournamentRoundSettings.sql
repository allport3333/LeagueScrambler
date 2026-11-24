SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.TournamentConfiguration', N'RoundSettingsJson') IS NULL
    ALTER TABLE dbo.TournamentConfiguration ADD RoundSettingsJson nvarchar(max) NULL
        CONSTRAINT CK_TournamentConfiguration_RoundSettingsJson CHECK (ISJSON(RoundSettingsJson) = 1);
COMMIT TRANSACTION;

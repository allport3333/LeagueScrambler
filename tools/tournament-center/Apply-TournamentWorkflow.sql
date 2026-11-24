SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.TournamentConfiguration', N'OwnerUserId') IS NULL
    ALTER TABLE dbo.TournamentConfiguration ADD OwnerUserId int NULL
        CONSTRAINT FK_TournamentConfiguration_Owner REFERENCES dbo.[User](UserId);
IF COL_LENGTH(N'dbo.TournamentConfiguration', N'WorkflowStep') IS NULL
    ALTER TABLE dbo.TournamentConfiguration ADD WorkflowStep int NOT NULL
        CONSTRAINT DF_TournamentConfiguration_WorkflowStep DEFAULT (2)
        CONSTRAINT CK_TournamentConfiguration_WorkflowStep CHECK (WorkflowStep BETWEEN 1 AND 7);
COMMIT TRANSACTION;

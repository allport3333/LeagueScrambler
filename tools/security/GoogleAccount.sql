SET XACT_ABORT ON;
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.[User]', N'U') IS NULL
    THROW 51000, 'League Hub account schema is missing.', 1;

BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.GoogleAccount', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.GoogleAccount (
        Subject nvarchar(255) NOT NULL,
        UserId int NOT NULL,
        CONSTRAINT PK_GoogleAccount PRIMARY KEY (Subject),
        CONSTRAINT FK_GoogleAccount_User FOREIGN KEY (UserId) REFERENCES dbo.[User](UserId)
    );
    CREATE UNIQUE INDEX IX_GoogleAccount_UserId ON dbo.GoogleAccount(UserId);
END;
COMMIT TRANSACTION;

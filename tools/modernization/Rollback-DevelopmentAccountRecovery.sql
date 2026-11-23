SET XACT_ABORT ON;
IF DB_NAME() <> N'LeagueScramblerDev' OR COALESCE(CONVERT(nvarchar(40), CONNECTIONPROPERTY('net_transport')), N'') <> N'Shared memory'
    THROW 51000, 'Use the Development database directly.', 1;
IF EXISTS (SELECT 1 FROM dbo.[User] WHERE SessionVersion <> 0)
    THROW 51000, 'Recovery changed session versions. Preserve the audit data and retire outstanding cookies before rollback.', 1;
BEGIN TRANSACTION;
DROP TABLE dbo.AccountRecoveryRequest;
ALTER TABLE dbo.[User] DROP CONSTRAINT DF_User_SessionVersion;
ALTER TABLE dbo.[User] DROP COLUMN SessionVersion;
COMMIT;

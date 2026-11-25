-- Run from the repository root with sqlcmd -b against the verified production catalog.
:on error exit
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'LeagueScrambler'
   OR ISNULL(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'') <> N'DESKTOP-UN67OEK'
    THROW 51100, 'This release requires the established production instance and catalog.', 1;

IF NOT EXISTS (SELECT 1 FROM msdb.dbo.backupset
    WHERE database_name = DB_NAME() AND type = 'D' AND has_backup_checksums = 1 AND is_copy_only = 1
      AND backup_finish_date >= DATEADD(hour, -4, GETDATE()))
    THROW 51101, 'A recent checksum-protected copy-only full production backup is required.', 1;

IF (SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo') AND
    name IN (N'PickupVenue', N'PickupSession', N'PickupRegistration', N'PickupGameSet')) NOT IN (0, 4)
    THROW 51102, 'Unexpected partial production Pickup schema. Review before continuing.', 1;

BEGIN TRANSACTION;
EXEC sys.sp_set_session_context @key=N'PickupProductionRelease', @value=1, @read_only=1;
GO
:r tools/pickup/001-PickupFoundation.sql
GO
:r tools/pickup/002-PickupUnlimitedCapacity.sql
GO
:r tools/pickup/003-PickupWorkspace.sql
GO
IF ISNULL(COLUMNPROPERTY(OBJECT_ID(N'dbo.PickupSession'), N'Capacity', 'AllowsNull'), 0) <> 1
   OR ISNULL(COLUMNPROPERTY(OBJECT_ID(N'dbo.PickupSession'), N'CheckedInOnly', 'AllowsNull'), 1) <> 0
   OR ISNULL(COLUMNPROPERTY(OBJECT_ID(N'dbo.PickupRegistration'), N'Playing', 'AllowsNull'), 0) <> 1
   OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.PickupGameSet')
       AND referenced_object_id = OBJECT_ID(N'dbo.PickupSession') AND delete_referential_action = 0
       AND is_disabled = 0 AND is_not_trusted = 0)
   OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.PickupGameSet')
       AND name = N'IX_PickupGameSet_SessionId_Number' AND is_unique = 1 AND is_disabled = 0)
   OR (SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.PickupGameSet')
       AND name IN (N'CK_PickupGameSet_NumberVersion', N'CK_PickupGameSet_JSON') AND is_disabled = 0 AND is_not_trusted = 0) <> 2
    THROW 51103, 'Pickup workspace schema verification failed.', 1;
COMMIT;
SELECT N'Production Pickup schema verified' AS Result;

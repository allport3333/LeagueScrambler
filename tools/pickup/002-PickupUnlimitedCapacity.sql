-- Preserve all explicit limits and allow an actual NULL for open registration.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() NOT IN (N'LeagueScramblerDev', N'LeagueScramblerPickupTest')
    THROW 51000, 'Pickup capacity migration requires shared Development or the disposable test database.', 1;
BEGIN TRANSACTION;
IF ISNULL(COL_LENGTH(N'dbo.PickupSession', N'Capacity'), 0) <> 4
    THROW 51001, 'Expected the Pickup foundation and its integer capacity column.', 1;
IF COLUMNPROPERTY(OBJECT_ID(N'dbo.PickupSession'), N'Capacity', 'AllowsNull') = 0
    ALTER TABLE dbo.PickupSession ALTER COLUMN Capacity int NULL;
IF ISNULL(COLUMNPROPERTY(OBJECT_ID(N'dbo.PickupSession'), N'Capacity', 'AllowsNull'), 0) <> 1
    THROW 51002, 'Nullable Pickup capacity could not be verified.', 1;
COMMIT;
SELECT DB_NAME() AS DatabaseName, '002-PickupUnlimitedCapacity verified' AS MigrationState;

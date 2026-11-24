SET XACT_ABORT ON;
IF DB_NAME() <> N'LeagueScramblerDev'
    THROW 51001, 'Development database required for example classification.', 1;
BEGIN TRANSACTION;
IF (SELECT COUNT(*) FROM dbo.LeagueType WITH (UPDLOCK, HOLDLOCK)
    WHERE (ID=31 AND LeagueName=N'Wallyball Unicorn Tournament' AND EventTypeId IN (1,2))
       OR (ID=32 AND LeagueName=N'419 Tournament' AND EventTypeId IN (1,2))
       OR (ID=37 AND LeagueName=N'WW Winter 2026' AND EventTypeId=1)) <> 3
    THROW 51002, 'The expected Development examples do not match.', 1;
UPDATE dbo.LeagueType SET EventTypeId=2
WHERE EventTypeId=1 AND ((ID=31 AND LeagueName=N'Wallyball Unicorn Tournament')
                     OR (ID=32 AND LeagueName=N'419 Tournament'));
COMMIT TRANSACTION;

-- Execution requires separate owner approval. The default is read-only.
-- sqlcmd -S lpc:localhost -E -d LeagueScrambler -b -i Classify-ProductionHistoricalTournaments.sql
-- For an approved write, explicitly set Action to Apply. Use Rollback only
-- to undo this approved migration while its three events are still unconfigured.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Action nvarchar(12) = N'Preview';

IF @Action NOT IN (N'Preview', N'Apply', N'Rollback')
    THROW 51001, 'Choose Preview, Apply, or Rollback.', 1;
IF DB_NAME() <> N'LeagueScrambler'
    OR ISNULL(CONVERT(nvarchar(128), SERVERPROPERTY('ServerName')), N'') <> N'DESKTOP-UN67OEK'
    OR ISNULL(CONVERT(nvarchar(40), CONNECTIONPROPERTY('net_transport')), N'') <> N'Shared memory'
    OR NOT EXISTS (SELECT 1 FROM sys.database_recovery_status WHERE database_id = DB_ID()
        AND family_guid = 'E7F22704-7FCB-463A-9FF8-C3FF723172D7')
    THROW 51002, 'The verified local production database is required.', 1;

IF OBJECT_ID(N'dbo.EventType', N'U') IS NULL
    OR COL_LENGTH(N'dbo.LeagueType', N'EventTypeId') IS NULL
    OR COL_LENGTH(N'dbo.TournamentConfiguration', N'OwnerUserId') IS NULL
    OR COL_LENGTH(N'dbo.TournamentConfiguration', N'EventDate') IS NULL
    OR COL_LENGTH(N'dbo.TournamentConfiguration', N'WorkflowStep') IS NULL
    OR COL_LENGTH(N'dbo.TournamentConfiguration', N'CheckInMode') IS NULL
    OR COL_LENGTH(N'dbo.TournamentConfiguration', N'RoundSettingsJson') IS NULL
    OR COL_LENGTH(N'dbo.TournamentRound', N'GenerationJson') IS NULL
    OR COL_LENGTH(N'dbo.TournamentRound', N'VoidedAtUtc') IS NULL
    OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.LeagueType')
          AND referenced_object_id = OBJECT_ID(N'dbo.EventType')
          AND is_disabled = 0 AND is_not_trusted = 0)
    THROW 51003, 'The reviewed production tournament schema is required.', 1;

DECLARE @Targets table (Id int PRIMARY KEY, Name nvarchar(100) NOT NULL);
INSERT @Targets VALUES
    (30, N'Advanced 3s Tourney Jan 2025'),
    (31, N'Wallyball Unicorn Tournament'),
    (32, N'419 Tournament');

DECLARE @Snapshot table (
    Phase varchar(6), Id int, Name nvarchar(100), EventTypeId int,
    Memberships bigint, Teams bigint, SavedScrambles bigint, Assignments bigint,
    TeamGameScores bigint, LegacyPlayerScores bigint, Attendance bigint,
    ByeRounds bigint, Byes bigint, ManagerLinks bigint, GuidedRounds bigint
);

BEGIN TRY
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;

    IF (SELECT COUNT(*) FROM dbo.EventType
        WHERE (ID = 1 AND Name = N'League') OR (ID = 2 AND Name = N'Tournament')
            OR (ID = 3 AND Name = N'Pickup')) <> 3
        THROW 51004, 'Event type mappings changed.', 1;
    IF EXISTS (SELECT 1 FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.LeagueType') AND is_disabled = 0)
        THROW 51005, 'An enabled event-table trigger could have unreviewed effects.', 1;

    IF EXISTS (
        SELECT 1 FROM @Targets t
        WHERE (SELECT COUNT(*) FROM dbo.LeagueType l WITH (UPDLOCK, HOLDLOCK)
               WHERE l.LeagueName = t.Name) <> 1
           OR NOT EXISTS (
               SELECT 1 FROM dbo.LeagueType l WITH (UPDLOCK, HOLDLOCK)
               WHERE l.ID = t.Id AND l.LeagueName COLLATE Latin1_General_100_BIN2 = t.Name
                 AND DATALENGTH(CONVERT(nvarchar(max), l.LeagueName)) = DATALENGTH(t.Name)
                 AND l.EventTypeId IN (1, 2))
    ) THROW 51006, 'A target ID, exact name, or classification changed.', 1;

    IF EXISTS (SELECT 1 FROM dbo.TournamentConfiguration c JOIN @Targets t ON t.Id = c.LeagueId)
        OR EXISTS (SELECT 1 FROM dbo.TournamentRound r JOIN @Targets t ON t.Id = r.LeagueId)
        THROW 51007, 'A target acquired tournament configuration or guided rounds. Review before proceeding.', 1;
    IF EXISTS (
        SELECT 1 FROM @Targets t WHERE NOT EXISTS (
            SELECT 1 FROM dbo.UserLeague ul JOIN dbo.[User] u ON u.UserId = ul.UserId
            WHERE ul.LeagueTypeId = t.Id AND ul.UserId = 1 AND u.UserRoleId = 1)
    ) OR EXISTS (
        SELECT 1 FROM dbo.UserLeague ul JOIN @Targets t ON t.Id = ul.LeagueTypeId WHERE ul.UserId <> 1
    ) THROW 51008, 'Reviewed administrator-only management associations changed.', 1;
    IF (SELECT COUNT(DISTINCT l.EventTypeId) FROM dbo.LeagueType l JOIN @Targets t ON t.Id = l.ID) <> 1
        THROW 51009, 'Mixed target classifications require review before proceeding.', 1;

    DECLARE @Phase varchar(6) = 'Before';
    WHILE @Phase IS NOT NULL
    BEGIN
        INSERT @Snapshot
        SELECT @Phase,l.ID,l.LeagueName,l.EventTypeId,
            (SELECT COUNT_BIG(*) FROM dbo.PlayersLeague p WHERE p.LeagueID=l.ID),
            (SELECT COUNT_BIG(*) FROM dbo.KingQueenTeam k WHERE k.LeagueID=l.ID),
            (SELECT COUNT_BIG(DISTINCT k.ScrambleNumber) FROM dbo.KingQueenTeam k
               WHERE k.LeagueID=l.ID AND k.ScrambleWithScoresToBeSaved=1),
            (SELECT COUNT_BIG(*) FROM dbo.KingQueenPlayer p JOIN dbo.KingQueenTeam k ON k.Id=p.KingQueenTeamId WHERE k.LeagueID=l.ID),
            (SELECT COUNT_BIG(*) FROM dbo.KingQueenRoundScores s JOIN dbo.KingQueenTeam k ON k.Id=s.KingQueenTeamId WHERE k.LeagueID=l.ID),
            (SELECT COUNT_BIG(*) FROM dbo.PlayerScore s WHERE EXISTS
                (SELECT 1 FROM dbo.PlayersLeague p WHERE p.Id=s.PlayersLeagueID AND p.LeagueID=l.ID)
                OR EXISTS (SELECT 1 FROM dbo.KingQueenPlayer p JOIN dbo.KingQueenTeam k ON k.Id=p.KingQueenTeamId
                           WHERE p.Id=s.KingQueenPlayerId AND k.LeagueID=l.ID)),
            (SELECT COUNT_BIG(*) FROM dbo.PlayerSignIn p WHERE p.LeagueId=l.ID),
            (SELECT COUNT_BIG(*) FROM dbo.ByeRounds b WHERE b.LeagueID=l.ID),
            (SELECT COUNT_BIG(*) FROM dbo.ByePlayer p JOIN dbo.ByeRounds b ON b.Id=p.ByeRoundId WHERE b.LeagueID=l.ID),
            (SELECT COUNT_BIG(*) FROM dbo.UserLeague u WHERE u.LeagueTypeId=l.ID),
            (SELECT COUNT_BIG(*) FROM dbo.TournamentRound r WHERE r.LeagueId=l.ID)
        FROM dbo.LeagueType l JOIN @Targets t ON t.Id=l.ID;

        IF @Phase = 'After' BREAK;
        IF @Action IN (N'Apply', N'Rollback')
        BEGIN
            DECLARE @TargetType int = CASE WHEN @Action = N'Apply' THEN 2 ELSE 1 END;
            UPDATE l SET EventTypeId = @TargetType
            FROM dbo.LeagueType l JOIN @Targets t ON t.Id = l.ID
            WHERE l.EventTypeId <> @TargetType;
            IF @@ROWCOUNT NOT IN (0, 3)
                THROW 51010, 'Unexpected classification update count.', 1;
        END;
        SET @Phase = 'After';
    END;

    IF EXISTS (
        SELECT Id, Name, Memberships, Teams, SavedScrambles, Assignments, TeamGameScores,
            LegacyPlayerScores, Attendance, ByeRounds, Byes, ManagerLinks, GuidedRounds FROM @Snapshot WHERE Phase='Before'
        EXCEPT
        SELECT Id, Name, Memberships, Teams, SavedScrambles, Assignments, TeamGameScores,
            LegacyPlayerScores, Attendance, ByeRounds, Byes, ManagerLinks, GuidedRounds FROM @Snapshot WHERE Phase='After'
    ) THROW 51011, 'Historical record counts or event identities changed.', 1;
    IF @Action <> N'Preview' AND EXISTS (
        SELECT 1 FROM @Snapshot WHERE Phase = 'After' AND EventTypeId <> @TargetType
    ) THROW 51012, 'A target did not reach the approved classification.', 1;

    IF @Action = N'Preview' ROLLBACK TRANSACTION;
    ELSE COMMIT TRANSACTION;
    SELECT @Action AS Action, *
    FROM @Snapshot ORDER BY Id, CASE WHEN Phase = 'Before' THEN 0 ELSE 1 END;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

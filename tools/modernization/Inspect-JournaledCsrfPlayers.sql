IF DB_NAME() <> N'LeagueScramblerDev' OR COALESCE(CONVERT(nvarchar(40), CONNECTIONPROPERTY('net_transport')), N'') <> N'Shared memory'
    THROW 51000, 'Use the local Development database directly.', 1;
SELECT journal.PlayerId, journal.ExpectedFirstName,
       CASE WHEN p.Id IS NULL THEN 'Absent'
            WHEN p.FirstName = journal.ExpectedFirstName AND p.LastName = N'Test_csrfplayer' THEN 'Journal match'
            ELSE 'ID exists with different identity' END AS FixtureState,
       (SELECT COUNT(*) FROM dbo.UsersPlayer AS l WHERE l.PlayerId = journal.PlayerId) AS AccountLinks,
       (SELECT COUNT(*) FROM dbo.PlayersLeague AS l WHERE l.PlayerID = journal.PlayerId) AS LeagueLinks,
       (SELECT COUNT(*) FROM dbo.LeagueTeamPlayer AS l WHERE l.PlayerId = journal.PlayerId) AS LeagueTeamLinks,
       (SELECT COUNT(*) FROM dbo.KingQueenPlayer AS l WHERE l.PlayerId = journal.PlayerId) AS HistoricalScramblerLinks
FROM (VALUES
    (7358, N'LSAuto_64ce89c8350cd1feb53d6f81'),
    (7360, N'LSAuto_89e1c841a4ac251d85b7a11c'),
    (7388, N'LSAuto_7fc133c4bbe71d9c14e49d7b')
) AS journal(PlayerId, ExpectedFirstName)
LEFT JOIN dbo.Player AS p ON p.Id = journal.PlayerId;

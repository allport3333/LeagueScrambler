-- Read only. Use the UserId observed in the local debugger.
SET NOCOUNT ON;
IF DB_NAME() <> N'LeagueScramblerDev'
    THROW 50000, 'Connect to LeagueScramblerDev before running this diagnostic.', 1;

DECLARE @UserId int = NULL; -- Replace NULL with the authenticated numeric UserId.
IF @UserId IS NULL OR @UserId <= 0
    THROW 50001, 'Set @UserId to the authenticated UserId first.', 1;

SELECT u.UserId, u.UserRoleId, r.RoleName, up.UsersPlayerId, up.PlayerId,
       CASE
           WHEN up.UsersPlayerId IS NULL THEN 'Unlinked'
           WHEN p.Id IS NULL THEN 'Linked player missing'
           ELSE 'Linked'
       END AS ProfileState
FROM dbo.[User] AS u
LEFT JOIN dbo.UserRoles AS r ON r.UserRoleId = u.UserRoleId
LEFT JOIN dbo.UsersPlayer AS up ON up.UserId = u.UserId
LEFT JOIN dbo.Player AS p ON p.Id = up.PlayerId
WHERE u.UserId = @UserId;

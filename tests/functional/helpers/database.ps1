param()
$ErrorActionPreference = 'Stop'
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $connection = New-Object System.Data.SqlClient.SqlConnection
    # No caller-supplied connection string, database, SQL, or server is accepted.
    $connection.ConnectionString = 'Server=localhost;Database=LeagueScramblerDev;Integrated Security=True;Application Name=LeagueScramblerFunctionalChecks;Connect Timeout=10;'
    $connection.Open()
    function Query([string]$sql, [hashtable]$parameters = @{}) {
        $command = $connection.CreateCommand()
        if ($transaction) { $command.Transaction=$transaction }
        $command.CommandTimeout = 15
        $command.CommandText = $sql
        foreach ($key in $parameters.Keys) { [void]$command.Parameters.AddWithValue($key,$parameters[$key]) }
        $reader = $command.ExecuteReader()
        try {
            $rows = @()
            while ($reader.Read()) {
                $row = [ordered]@{}
                for ($i=0; $i -lt $reader.FieldCount; $i++) {
                    $value=$reader.GetValue($i)
                    if ($value -is [DBNull]) { $value=$null }
                    $row[$reader.GetName($i)]=$value
                }
                $rows += [pscustomobject]$row
            }
            return ,$rows
        } finally { $reader.Dispose(); $command.Dispose() }
    }
    $target = Query 'SELECT DB_NAME() AS DatabaseName, CONVERT(nvarchar(128),SERVERPROPERTY(''MachineName'')) AS MachineName;'
    if ($target[0].DatabaseName -cne 'LeagueScramblerDev' -or $target[0].MachineName -ine $env:COMPUTERNAME) {
        throw 'Database identity guard rejected this connection.'
    }
    switch ($request.operation) {
        'target' { $result = $target }
        'cleanupOrphanUser' {
            $id=$request.identity
            if ($id.email -notmatch '^lsauto_[a-f0-9]{24}_[a-z0-9]+@example\.invalid$' -or $id.firstName -notmatch '^LSAuto_[a-f0-9]{24}$' -or $id.lastName -notmatch '^Test_[a-z0-9]+$' -or [int]$request.userId -le 0) { throw 'Exact synthetic orphan identity required.' }
            $transaction=$connection.BeginTransaction([Data.IsolationLevel]::Serializable)
            try {
                $p=@{'@id'=[int]$request.userId;'@email'=[string]$id.email;'@first'=[string]$id.firstName;'@last'=[string]$id.lastName}
                $owned=Query 'SELECT UserId FROM dbo.[User] WITH(UPDLOCK,HOLDLOCK) WHERE UserId=@id AND Email=@email AND FirstName=@first AND LastName=@last AND UserRoleId=3;' $p
                if ($owned.Count -ne 1) { throw 'Exact recorded synthetic Player account did not match.' }
                $triggers=Query 'SELECT COUNT(*) AS N FROM sys.triggers WHERE parent_id=OBJECT_ID(''dbo.User'') AND is_disabled=0;'
                if ($triggers[0].N -ne 0) { throw 'User delete triggers require separate safety review.' }
                $foreignKeys=Query 'SELECT s.name AS SchemaName,t.name AS TableName,c.name AS ColumnName FROM sys.foreign_key_columns f JOIN sys.tables t ON t.object_id=f.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=f.parent_column_id WHERE f.referenced_object_id=OBJECT_ID(''dbo.User'');'
                foreach ($fk in $foreignKeys) {
                    $schema='['+$fk.SchemaName.Replace(']',']]')+']';$table='['+$fk.TableName.Replace(']',']]')+']';$column='['+$fk.ColumnName.Replace(']',']]')+']'
                    $count=Query "SELECT COUNT(*) AS N FROM $schema.$table WITH(UPDLOCK,HOLDLOCK) WHERE $column=@id;" @{'@id'=[int]$request.userId}
                    if ($count[0].N -ne 0) { throw 'Synthetic user has references; cleanup refused.' }
                }
                $deleted=Query 'DELETE FROM dbo.[User] WHERE UserId=@id AND Email=@email AND FirstName=@first AND LastName=@last AND UserRoleId=3; SELECT @@ROWCOUNT AS DeletedCount;' $p
                if ($deleted[0].DeletedCount -ne 1) { throw 'Cleanup row-count guard failed.' }
                $transaction.Commit()
                $result=@{deletedUserId=[int]$request.userId;database='LeagueScramblerDev';referencesVerifiedAbsent=$true}
            } catch { $transaction.Rollback(); throw } finally { $transaction.Dispose();$transaction=$null }
        }
        'provisionRole' {
            $id=$request.identity
            if ($id.email -notmatch '^lsauto_[a-f0-9]{24}_[a-z0-9]+@example\.invalid$' -or $id.firstName -notmatch '^LSAuto_[a-f0-9]{24}$' -or $id.lastName -notmatch '^Test_[a-z0-9]+$' -or [int]$request.roleId -notin @(1,2)) { throw 'Synthetic role fixture rejected.' }
            $result=Query 'SET XACT_ABORT ON; BEGIN TRANSACTION; UPDATE dbo.[User] SET UserRoleId=@role WHERE UserId=@id AND Email=@email AND FirstName=@first AND LastName=@last AND UserRoleId=3; IF @@ROWCOUNT<>1 BEGIN ROLLBACK; THROW 51000,''Synthetic user identity or initial role did not match'',1; END; COMMIT; SELECT UserId,UserRoleId FROM dbo.[User] WHERE UserId=@id;' @{ '@id'=[int]$request.userId; '@role'=[int]$request.roleId; '@email'=[string]$id.email; '@first'=[string]$id.firstName; '@last'=[string]$id.lastName }
        }
        'leagueSnapshot' {
            $name=[string]$request.leagueName
            if ($name -notmatch '^LSAuto_[a-f0-9]{24}_L[a-z0-9]+$') { throw 'Only run-owned synthetic league names may be inspected.' }
            $p=@{'@name'=$name}
            $league=Query 'SELECT ID,LeagueName FROM dbo.LeagueType WHERE LeagueName=@name ORDER BY ID;' $p
            if ($league.Count -eq 0) { $result=@{league=@()}; break }
            if ($league.Count -ne 1) { throw 'Ambiguous synthetic league identity.' }
            $p=@{'@league'=[int]$league[0].ID}
            $result=@{
                league=@($league)
                owners=(Query 'SELECT UserLeagueId,UserId,LeagueTypeId FROM dbo.UserLeague WHERE LeagueTypeId=@league ORDER BY UserLeagueId;' $p)
                settings=(Query 'SELECT LeagueSettingsId,SettingName,SettingValue FROM dbo.LeagueSettings WHERE LeagueId=@league ORDER BY LeagueSettingsId;' $p)
                divisions=(Query 'SELECT Id,LeagueID,Code,Name,SortOrder FROM dbo.LeagueDivision WHERE LeagueID=@league ORDER BY Id;' $p)
                memberships=(Query 'SELECT ID,PlayerID,LeagueDivisionId,IsSub FROM dbo.PlayersLeague WHERE LeagueID=@league ORDER BY ID;' $p)
                signIns=(Query 'SELECT PlayerSignInId,PlayerId,DateTime,LockedSignIn FROM dbo.PlayerSignIn WHERE LeagueId=@league ORDER BY PlayerSignInId;' $p)
                locks=(Query 'SELECT Id,SignInLocked FROM dbo.LeagueSignInLocked WHERE LeagueId=@league ORDER BY Id;' $p)
                teams=(Query 'SELECT ID,TeamName,TotalWins,TotalLosses,Division FROM dbo.LeagueTeam WHERE LeagueID=@league ORDER BY ID;' $p)
                teamPlayers=(Query 'SELECT p.Id,p.LeagueTeamId,p.PlayerId FROM dbo.LeagueTeamPlayer p JOIN dbo.LeagueTeam t ON t.ID=p.LeagueTeamId WHERE t.LeagueID=@league ORDER BY p.Id;' $p)
                scores=(Query 'SELECT s.Id,s.LeagueTeamId,s.OpponentsLeagueTeamId,s.TeamScore,s.WonGame FROM dbo.LeagueTeamScore s JOIN dbo.LeagueTeam t ON t.ID=s.LeagueTeamId WHERE t.LeagueID=@league ORDER BY s.Id;' $p)
                kqTeams=(Query 'SELECT Id,ScrambleNumber,ScrambleWithScoresToBeSaved FROM dbo.KingQueenTeam WHERE LeagueID=@league ORDER BY Id;' $p)
                kqPlayers=(Query 'SELECT p.Id,p.KingQueenTeamId,p.PlayerId,p.isSubScore FROM dbo.KingQueenPlayer p JOIN dbo.KingQueenTeam t ON t.Id=p.KingQueenTeamId WHERE t.LeagueID=@league ORDER BY p.Id;' $p)
                kqScores=(Query 'SELECT s.Id,s.KingQueenTeamId,s.RoundId,s.RoundScore,s.RoundWon FROM dbo.KingQueenRoundScores s JOIN dbo.KingQueenTeam t ON t.Id=s.KingQueenTeamId WHERE t.LeagueID=@league ORDER BY s.Id;' $p)
                byes=(Query 'SELECT Id,ScrambleNumber FROM dbo.ByeRounds WHERE LeagueID=@league ORDER BY Id;' $p)
            }
        }
        'snapshot' {
            $id=$request.identity
            if ($id.email -notmatch '^lsauto_[a-f0-9]{24}_[a-z0-9]+@example\.invalid$' -or
                $id.firstName -notmatch '^LSAuto_[a-f0-9]{24}$' -or $id.lastName -notmatch '^Test_[a-z0-9]+$') {
                throw 'Only suite-generated synthetic identities may be inspected.'
            }
            $parameters=@{ '@email'=[string]$id.email; '@first'=[string]$id.firstName; '@last'=[string]$id.lastName }
            $users=Query 'SELECT UserId,UserRoleId FROM dbo.[User] WHERE Email=@email;' $parameters
            $players=Query 'SELECT Id FROM dbo.Player WHERE FirstName=@first AND LastName=@last;' $parameters
            $links=Query 'SELECT up.UsersPlayerId,up.UserId,up.PlayerId FROM dbo.UsersPlayer up JOIN dbo.[User] u ON u.UserId=up.UserId WHERE u.Email=@email;' $parameters
            $result=@{users=@($users);players=@($players);links=@($links)}
        }
        'cleanupReferences' {
            $id=$request.identity
            if ($id.email -notmatch '^lsauto_[a-f0-9]{24}_[a-z0-9]+@example\.invalid$' -or
                $id.firstName -notmatch '^LSAuto_[a-f0-9]{24}$' -or $id.lastName -notmatch '^Test_[a-z0-9]+$') {
                throw 'Only synthetic cleanup candidates may be inspected.'
            }
            $parameters=@{ '@email'=[string]$id.email; '@first'=[string]$id.firstName; '@last'=[string]$id.lastName }
            $targets=@(
                @{table='User'; column='UserId'; rows=(Query 'SELECT UserId AS Id FROM dbo.[User] WHERE Email=@email;' $parameters)},
                @{table='Player'; column='Id'; rows=(Query 'SELECT Id FROM dbo.Player WHERE FirstName=@first AND LastName=@last;' $parameters)},
                @{table='UsersPlayer'; column='UsersPlayerId'; rows=(Query 'SELECT up.UsersPlayerId AS Id FROM dbo.UsersPlayer up JOIN dbo.[User] u ON u.UserId=up.UserId WHERE u.Email=@email;' $parameters)}
            )
            $references=@()
            foreach ($targetItem in $targets) {
                $foreignKeys=Query 'SELECT s.name AS SchemaName,t.name AS TableName,c.name AS ColumnName FROM sys.foreign_key_columns f JOIN sys.tables t ON t.object_id=f.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=f.parent_column_id JOIN sys.tables rt ON rt.object_id=f.referenced_object_id JOIN sys.schemas rs ON rs.schema_id=rt.schema_id JOIN sys.columns rc ON rc.object_id=rt.object_id AND rc.column_id=f.referenced_column_id WHERE rs.name=''dbo'' AND rt.name=@table AND rc.name=@column;' @{ '@table'=$targetItem.table; '@column'=$targetItem.column }
                foreach ($row in $targetItem.rows) {
                    foreach ($foreignKey in $foreignKeys) {
                        # Identifiers originate only from dev database metadata, never caller SQL.
                        $schema='['+$foreignKey.SchemaName.Replace(']',']]')+']'
                        $table='['+$foreignKey.TableName.Replace(']',']]')+']'
                        $column='['+$foreignKey.ColumnName.Replace(']',']]')+']'
                        $count=Query "SELECT COUNT(*) AS ReferenceCount FROM $schema.$table WHERE $column=@id;" @{ '@id'=[int]$row.Id }
                        $references+=@{targetTable=$targetItem.table;targetId=$row.Id;referencingTable=$foreignKey.SchemaName+'.'+$foreignKey.TableName;referencingColumn=$foreignKey.ColumnName;count=$count[0].ReferenceCount}
                    }
                }
            }
            $result=@{references=@($references)}
        }
        default { throw 'Operation is not on the read-only database allowlist.' }
    }
    $result | ConvertTo-Json -Depth 8 -Compress
} catch {
    [Console]::Error.WriteLine('Development database check failed (' + $_.Exception.GetType().Name + '). No SQL or credentials logged.')
    exit 1
} finally { if ($connection) { $connection.Dispose() } }

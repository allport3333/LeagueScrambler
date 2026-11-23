#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [switch] $Apply,
    [ValidateRange(1024, 65535)]
    [int] $HttpsPort = 8086,
    [switch] $TrustLoopbackSqlCertificate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$siteName = 'LeagueHub Staging'
$poolName = 'LeagueHubStagingPool'
$principal = 'IIS APPPOOL\LeagueHubStagingPool'
$path = 'C:\inetpub\wwwroot\LeagueHubStaging'
$httpBinding = '127.0.0.1:8085:'
$httpsBinding = "127.0.0.1:${HttpsPort}:"
$certificateName = 'LeagueHub Staging only - localhost'
$database = 'LeagueScramblerDev'

function New-DatabaseConnection {
    param([string] $Server = 'localhost', [bool] $Trust = $false, [bool] $Encrypt = $true)
    $settings = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $settings['Data Source'] = $Server
    $settings['Initial Catalog'] = $database
    $settings['Integrated Security'] = $true
    $settings['Encrypt'] = $Encrypt
    $settings['TrustServerCertificate'] = $Trust
    $settings['Connect Timeout'] = 5
    return New-Object System.Data.SqlClient.SqlConnection $settings.get_ConnectionString()
}

function Test-DatabaseConnection {
    param([string] $Label, [System.Data.SqlClient.SqlConnection] $Connection)
    try {
        $Connection.Open()
        Write-Host "$Label succeeded."
        return $true
    }
    catch {
        # The exception contains no supplied credentials. Keep it off the transcript anyway.
        $message = $_.Exception.GetBaseException().Message
        $category = switch -Regex ($message) {
            'SSPI|target principal|security package|login failed|untrusted domain' { 'Windows authentication or security context'; break }
            'certificate|SSL|TLS|encrypt' { 'TLS or certificate validation'; break }
            default { 'connection, database access, or provider error' }
        }
        Write-Host "$Label failed ($category)."
        return $false
    }
    finally { $Connection.Dispose() }
}

function Read-SqlRows {
    param([string] $Sql, [int] $ResultSet = 0)
    $command = $sqlConnection.CreateCommand()
    $command.CommandText = $Sql
    try {
        $reader = $command.ExecuteReader()
        try {
            for ($set = 0; $set -lt $ResultSet; $set++) {
                if (-not $reader.NextResult()) { throw 'The expected SQL security metadata result was missing.' }
            }
            while ($reader.Read()) {
                $row = [ordered]@{}
                for ($column = 0; $column -lt $reader.FieldCount; $column++) {
                    $row[$reader.GetName($column)] = $reader.GetValue($column)
                }
                [pscustomobject] $row
            }
        }
        finally { $reader.Dispose() }
    }
    finally { $command.Dispose() }
}

function Assert-StagingSqlIdentity {
    param($Identity, [string[]] $DatabaseRoles, [string[]] $MappedDatabases)
    if ($Identity.LoginType -ne [DBNull]::Value -and
        ($Identity.LoginType -ne 'U' -or $Identity.Disabled -or $Identity.DefaultDatabase -ne $database)) {
        throw 'The staging SQL login must be an enabled Windows login with LeagueScramblerDev as its default database.'
    }
    if ($Identity.UserType -ne [DBNull]::Value -and ($Identity.UserType -ne 'U' -or $Identity.SidMatches -ne 1)) {
        throw 'The Development database user does not match the staging Windows login SID.'
    }
    if ($Identity.ServerRoles -or $Identity.ServerOverrides -or $Identity.OwnedDatabases) {
        throw 'The staging SQL login has unexpected server roles, explicit server permissions, or database ownership.'
    }
    if ($MappedDatabases | Where-Object { $_ -ne $database }) {
        throw 'The staging SQL login is mapped outside LeagueScramblerDev.'
    }
    if ($DatabaseRoles | Where-Object { $_ -notin @('public', 'db_datareader', 'db_datawriter') }) {
        throw 'The staging database user has a role outside public, db_datareader and db_datawriter.'
    }
}

function Get-MissingStagingGrants {
    param($TablePermissions, $ExistingGrants, [string[]] $DatabaseRoles)
    foreach ($table in $TablePermissions.Keys) {
        foreach ($permission in $TablePermissions[$table] -split ',') {
            if (($permission -eq 'SELECT' -and 'db_datareader' -in $DatabaseRoles) -or
                ($permission -in @('INSERT', 'UPDATE', 'DELETE') -and 'db_datawriter' -in $DatabaseRoles)) {
                continue
            }
            if (-not ($ExistingGrants | Where-Object { $_.TableName -eq $table -and $_.PermissionName -eq $permission })) {
                [pscustomobject] @{ Table = $table; Permission = $permission }
            }
        }
    }
}

function Save-Journal {
    $temporary = "$journalPath.tmp"
    $journal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporary -Encoding UTF8
    if ([IO.File]::Exists($journalPath)) { [IO.File]::Replace($temporary, $journalPath, [NullString]::Value) }
    else { [IO.File]::Move($temporary, $journalPath) }
}

if (-not [Environment]::Is64BitProcess -or $PSVersionTable.PSEdition -ne 'Desktop') {
    throw 'Use 64-bit Windows PowerShell 5.1.'
}
if ($HttpsPort -eq 8085) { throw 'HTTPS requires a different port from staging HTTP.' }
Add-Type -Path "$env:windir\System32\inetsrv\Microsoft.Web.Administration.dll"
$iis = New-Object Microsoft.Web.Administration.ServerManager
try {
    $site = $iis.Sites[$siteName]
    $pool = $iis.ApplicationPools[$poolName]
    if (-not $site -or -not $pool -or $site.Applications.Count -ne 1) {
        throw 'Expected the existing staging site, dedicated pool and a single root application.'
    }
    $app = $site.Applications['/']
    if (-not $app -or $app.ApplicationPoolName -ne $poolName -or $app.VirtualDirectories.Count -ne 1 -or
        [Environment]::ExpandEnvironmentVariables($app.VirtualDirectories['/'].PhysicalPath).TrimEnd('\') -ne $path) {
        throw 'Staging root path, virtual directories or application pool are outside the expected configuration.'
    }
    foreach ($other in $iis.Sites) {
        if ($other.Id -eq $site.Id) { continue }
        foreach ($otherApp in $other.Applications) {
            if ($otherApp.ApplicationPoolName -eq $poolName) { throw 'Another IIS site uses the staging pool.' }
            foreach ($directory in $otherApp.VirtualDirectories) {
                $otherPath = [Environment]::ExpandEnvironmentVariables($directory.PhysicalPath).TrimEnd('\')
                if ($otherPath -eq $path -or $otherPath.StartsWith("$path\", [StringComparison]::OrdinalIgnoreCase)) {
                    throw 'Another IIS site uses the staging tree.'
                }
            }
        }
        foreach ($binding in $other.Bindings) {
            if ($binding.BindingInformation -match ":(8085|${HttpsPort}):[^:]*$") {
                throw 'Another IIS site has a binding on a selected staging port.'
            }
        }
    }

    $http = @($site.Bindings | Where-Object Protocol -eq 'http')
    $https = @($site.Bindings | Where-Object Protocol -eq 'https')
    if ($http.Count -ne 1 -or $http[0].BindingInformation -notin @($httpBinding, '*:8085:', '0.0.0.0:8085:') -or
        $https.Count -gt 1 -or $site.Bindings.Count -ne ($http.Count + $https.Count)) {
        throw 'Unexpected staging bindings. Review them before running setup.'
    }
    if ($https.Count -and ($https[0].BindingInformation -ne $httpsBinding -or
        [int] $https[0].SslFlags -ne 0 -or $https[0].CertificateStoreName -ne 'My')) {
        throw 'Existing staging HTTPS differs from the dedicated loopback binding requested.'
    }
    if (-not $https.Count) {
        $listeners = @(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq $HttpsPort)
        if ($listeners.Count) { throw 'The requested HTTPS port already has a TCP listener.' }
        foreach ($address in '127.0.0.1', '0.0.0.0', '[::]') {
            $ssl = & netsh.exe http show sslcert "ipport=${address}:$HttpsPort" 2>&1 | Out-String
            if ($ssl -match '\b[0-9a-fA-F]{40}\b') { throw 'An HTTP.sys certificate reservation already uses the requested port.' }
        }
    }
    if ($pool.ProcessModel.IdentityType -eq 'SpecificUser') {
        throw 'Staging currently uses a custom account. Its credentials require a separate rollback plan.'
    }

    $content = Get-Item -LiteralPath $path
    for ($directory = $content; $null -ne $directory; $directory = $directory.Parent) {
        if (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            (Test-Path -LiteralPath (Join-Path $directory.FullName '.env'))) {
            throw 'A staging directory is redirected or has a conflicting .env file.'
        }
    }
    $iisWorkingDirectory = Join-Path $env:windir 'System32\inetsrv'
    if (Test-Path -LiteralPath (Join-Path $iisWorkingDirectory '.env')) { throw 'IIS working directory has a conflicting .env file.' }
    $runtimeFile = Join-Path $path 'ASP.NET Core 2.2 with Angular 7.runtimeconfig.json'
    if ((Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json).runtimeOptions.tfm -ne 'net10.0') {
        throw 'The staging application runtimeconfig must target net10.0.'
    }
    $runtimes = & "$env:ProgramFiles\dotnet\dotnet.exe" --list-runtimes
    foreach ($runtime in 'Microsoft.NETCore.App', 'Microsoft.AspNetCore.App') {
        if (-not ($runtimes -match ('^' + [regex]::Escape($runtime) + ' 10\.0\.\d+ \['))) {
            throw "Missing installed x64 .NET 10 shared runtime $runtime."
        }
    }
    $web = $iis.GetWebConfiguration($siteName)
    $ancm = $web.GetSection('system.webServer/aspNetCore')
    if ($ancm['hostingModel'] -ne 'inprocess' -or
        -not ($web.GetSection('system.webServer/handlers').GetCollection() | Where-Object { $_['modules'] -eq 'AspNetCoreModuleV2' })) {
        throw 'Expected an in-process ASP.NET Core Module V2 handler.'
    }
    $environment = $pool.GetCollection('environmentVariables')
    $desired = [ordered]@{
        ASPNETCORE_ENVIRONMENT = 'Staging'
        DOTNET_ENVIRONMENT = 'Staging'
        ASPNETCORE_HTTPS_PORT = [string] $HttpsPort
        LEAGUESCRAMBLER_DB_CONNECTION = ''
    }
    foreach ($entry in $ancm.GetCollection('environmentVariables')) {
        if ($entry['name'] -in $desired.Keys -or $entry['name'] -in @('ASPNETCORE_HTTPS_PORTS', 'HTTPS_PORT')) {
            throw 'Effective ANCM environment overrides a staging setting. Review the staging configuration.'
        }
    }
    $oldEnvironment = [ordered]@{}
    foreach ($entry in $environment) {
        $name = [string] $entry['name']
        if ($name -in @('ASPNETCORE_HTTPS_PORTS', 'HTTPS_PORT')) { throw 'Pool has a conflicting HTTPS port setting.' }
        if ($name -notin $desired.Keys) { continue }
        $value = [string] $entry['value']
        if ($name -eq 'LEAGUESCRAMBLER_DB_CONNECTION') {
            # Only journal the exact, credential-free strings this script can generate.
            $safeValues = foreach ($trust in $false, $true) {
                $candidate = New-DatabaseConnection -Trust $trust
                try { $candidate.ConnectionString } finally { $candidate.Dispose() }
            }
            if ($value -cnotin $safeValues) { throw 'An unmanaged pool SQL connection exists. Review it privately before applying setup.' }
        }
        elseif ($value -notmatch '^(Staging|Development|Production|[0-9]{1,5})$') {
            throw 'An unmanaged pool environment value requires review before setup.'
        }
        $oldEnvironment[$name] = $value
    }

    $certificate = $null
    if ($https.Count) {
        $hash = [BitConverter]::ToString($https[0].CertificateHash).Replace('-', '')
        $certificate = Get-Item -LiteralPath "Cert:\LocalMachine\My\$hash"
        if ($certificate.FriendlyName -ne $certificateName -or -not $certificate.HasPrivateKey -or
            $certificate.NotAfter -lt (Get-Date).AddDays(7) -or $certificate.NotBefore -gt (Get-Date) -or
            $certificate.Subject -ne 'CN=localhost') {
            throw 'Existing staging binding does not use a valid dedicated staging certificate.'
        }
        foreach ($other in $iis.Sites) {
            if ($other.Id -eq $site.Id) { continue }
            foreach ($binding in $other.Bindings) {
                if ($binding.Protocol -eq 'https' -and $binding.CertificateHash -and
                    [BitConverter]::ToString($binding.CertificateHash).Replace('-', '') -eq $hash) {
                    throw 'Another site uses the existing staging certificate.'
                }
            }
        }
    }
    $trusted = $certificate -and (Test-Path -LiteralPath "Cert:\CurrentUser\Root\$($certificate.Thumbprint)")

    Write-Host "IIS staging site ID $($site.Id), site state $($site.State), pool state $($pool.State)."
    Write-Host "Current pool identity $($pool.ProcessModel.IdentityType), CLR '$($pool.ManagedRuntimeVersion)', profile $($pool.ProcessModel.LoadUserProfile), 32-bit $($pool.Enable32BitAppOnWin64)."
    Write-Host "Current HTTP binding $($http[0].BindingInformation). HTTPS configured $([bool] $https.Count). Managed pool variables present: $($oldEnvironment.Keys -join ', ')."
    Write-Host "Plan: x64 No Managed Code / ApplicationPoolIdentity / load profile. Staging environment at http://localhost:8085/ and https://localhost:$HttpsPort/."
    Write-Host 'HTTPS: use a dedicated staging certificate and trust it for the invoking Windows account.'
    Write-Host "SQL plan: verify Windows-integrated access to local $database before planning the login and individual table grants."

    # Comparison isolates certificate validation when the trusted-certificate probe alone
    # fails. Shared memory is a separate Windows authentication diagnostic, never app configuration.
    $strictTls = Test-DatabaseConnection 'Encrypted SQL with certificate validation' (New-DatabaseConnection)
    $trustedLoopback = Test-DatabaseConnection 'Encrypted SQL with loopback certificate validation bypass' (New-DatabaseConnection -Trust $true)
    $null = Test-DatabaseConnection 'Windows integrated SQL over local shared memory' (New-DatabaseConnection -Server 'lpc:localhost' -Trust $true -Encrypt $false)
    if (-not $strictTls -and -not ($TrustLoopbackSqlCertificate -and $trustedLoopback)) {
        throw 'SQL preflight blocked. Resolve Windows authentication or certificate validation before applying. Loopback certificate trust bypass requires explicit opt-in and a successful encrypted probe.'
    }
    $sqlConnection = New-DatabaseConnection -Trust (-not $strictTls)
    try {
        $sqlConnection.Open()
        $desired.LEAGUESCRAMBLER_DB_CONNECTION = $sqlConnection.ConnectionString
        $target = Read-SqlRows @'
SELECT DB_NAME() AS DatabaseName, CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) AS Machine,
       CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) AS InstanceName,
       CONVERT(nvarchar(32), CONNECTIONPROPERTY('auth_scheme')) AS AuthScheme,
       HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY LOGIN') AS CanManageLogin,
       HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CONTROL') AS CanInspectDatabase,
       (SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()) AS Compatibility;
'@
        if ($target.DatabaseName -ne $database -or $target.Machine -ne $env:COMPUTERNAME -or
            $target.InstanceName -ne [DBNull]::Value -or $target.AuthScheme -notin @('NTLM', 'KERBEROS', 'NEGOTIATE') -or
            $target.Compatibility -ne 130) {
            throw 'SQL connection is outside the expected local default Development database.'
        }
        if ($target.CanManageLogin -ne 1 -or $target.CanInspectDatabase -ne 1) {
            throw 'The invoking Windows account needs SQL login-management and Development database administration rights.'
        }
        Write-Host "Verified local default SQL instance, $database, Windows authentication ($($target.AuthScheme)), compatibility 130."

        # Permissions are scoped to the application's tables and operations.
        $tablePermissions = [ordered]@{
            ByePlayer = 'SELECT,INSERT'; ByeRounds = 'SELECT,INSERT'
            KingQueenPlayer = 'SELECT,INSERT,UPDATE'; KingQueenRoundScores = 'SELECT,INSERT,UPDATE'
            KingQueenTeam = 'SELECT,INSERT,UPDATE'; KingQueenTopPlayer = 'SELECT'
            LeagueDivision = 'SELECT,INSERT,UPDATE'; LeagueSchedule = 'SELECT,INSERT,UPDATE,DELETE'
            LeagueScheduleEvent = 'SELECT,INSERT,UPDATE,DELETE'; LeagueSettings = 'SELECT,INSERT,UPDATE'
            LeagueSignInLocked = 'SELECT,INSERT,UPDATE'; LeagueTeam = 'SELECT,INSERT,UPDATE'
            LeagueTeamPlayer = 'SELECT,INSERT'; LeagueTeamScore = 'SELECT,INSERT'
            LeagueType = 'SELECT,INSERT'; Password = 'SELECT'
            Player = 'SELECT,INSERT,UPDATE'; PlayerScore = 'SELECT'
            PlayerSignIn = 'SELECT,INSERT,UPDATE,DELETE'; PlayersLeague = 'SELECT,INSERT,UPDATE,DELETE'
            User = 'SELECT,INSERT,UPDATE'; UserLeague = 'SELECT,INSERT'
            UserRoles = 'SELECT'; UsersPlayer = 'SELECT,INSERT'
        }
        $tables = @(Read-SqlRows "SELECT name AS Name FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo');")
        foreach ($table in $tablePermissions.Keys) {
            if ($table -cnotin $tables.Name) { throw "Missing expected Development table dbo.$table." }
        }
        $identity = Read-SqlRows @'
SELECT p.type AS LoginType, u.type AS UserType, p.is_disabled AS Disabled, p.default_database_name AS DefaultDatabase,
       CASE WHEN p.sid = u.sid THEN 1 ELSE 0 END AS SidMatches,
       (SELECT COUNT(*) FROM sys.databases WHERE owner_sid = p.sid) AS OwnedDatabases,
       (SELECT COUNT(*) FROM sys.server_role_members WHERE member_principal_id = p.principal_id) AS ServerRoles,
       (SELECT COUNT(*) FROM sys.server_permissions WHERE grantee_principal_id = p.principal_id
        AND NOT (permission_name = 'CONNECT SQL' AND state = 'G')) AS ServerOverrides
FROM (SELECT 1 AS Anchor) AS a
LEFT JOIN sys.server_principals AS p ON p.name = N'IIS APPPOOL\LeagueHubStagingPool'
LEFT JOIN sys.database_principals AS u ON u.name = N'IIS APPPOOL\LeagueHubStagingPool';
'@
        $createLogin = $identity.LoginType -eq [DBNull]::Value
        $createUser = $identity.UserType -eq [DBNull]::Value
        $databaseRoles = @(
            Read-SqlRows @'
SELECT r.name AS RoleName
FROM sys.database_role_members AS m
JOIN sys.database_principals AS r ON r.principal_id = m.role_principal_id
WHERE m.member_principal_id = DATABASE_PRINCIPAL_ID(N'IIS APPPOOL\LeagueHubStagingPool');
'@ | ForEach-Object RoleName
        )
        Assert-StagingSqlIdentity $identity $databaseRoles

        if (-not $createLogin) {
            # The login audit reads SQL security metadata only. SQL Server can emit a
            # low-severity message when it omits a database from that audit.
            $messages = New-Object 'System.Collections.Generic.List[int]'
            $collectMessages = [System.Data.SqlClient.SqlInfoMessageEventHandler] {
                param($sender, $eventArgs)
                foreach ($errorRecord in $eventArgs.Errors) { $messages.Add($errorRecord.Number) }
            }
            $sqlConnection.add_InfoMessage($collectMessages)
            try {
                $mappedDatabases = @(
                    Read-SqlRows -ResultSet 1 -Sql "EXEC master.sys.sp_helplogins @LoginNamePattern = N'IIS APPPOOL\LeagueHubStagingPool';" |
                        Where-Object { ([string] $_.UserOrAlias).Trim() -eq 'User' } |
                        ForEach-Object DBName
                )
            }
            finally { $sqlConnection.remove_InfoMessage($collectMessages) }
            if ($messages.Count -or (-not $createUser -and $database -notin $mappedDatabases)) {
                throw 'SQL Server could not confirm a complete staging login mapping audit. Review database metadata visibility before apply.'
            }
            Assert-StagingSqlIdentity $identity $databaseRoles $mappedDatabases
        }
        $existingGrants = @(Read-SqlRows @'
SELECT OBJECT_SCHEMA_NAME(p.major_id) AS SchemaName, OBJECT_NAME(p.major_id) AS TableName,
       p.permission_name AS PermissionName, p.state AS State, p.class AS Class, p.minor_id AS ColumnId
FROM sys.database_permissions AS p
WHERE p.grantee_principal_id = DATABASE_PRINCIPAL_ID(N'IIS APPPOOL\LeagueHubStagingPool');
'@)
        foreach ($grant in $existingGrants) {
            if ($grant.Class -eq 0 -and $grant.PermissionName -eq 'CONNECT' -and $grant.State -eq 'G') { continue }
            if ($grant.Class -ne 1 -or $grant.ColumnId -ne 0 -or $grant.SchemaName -ne 'dbo' -or
                $grant.State -ne 'G' -or -not $tablePermissions.Contains([string] $grant.TableName) -or
                $grant.PermissionName -notin ($tablePermissions[[string] $grant.TableName] -split ',')) {
                throw 'The existing staging database user has unmanaged grants or denials. Review them before apply.'
            }
        }
        $grants = @(Get-MissingStagingGrants $tablePermissions $existingGrants $databaseRoles)
        Write-Host "Existing Development roles preserved: $((@('public') + $databaseRoles | Select-Object -Unique) -join ', ')."
        Write-Host "SQL plan for $principal in $database. Create login: $createLogin. Create user: $createUser. Missing object grants: $($grants.Count)."
        foreach ($grant in $grants) { Write-Host "  GRANT $($grant.Permission) ON dbo.[$($grant.Table)]" }

        $environmentChanged = @($desired.Keys | Where-Object { $oldEnvironment[$_] -cne $desired[$_] }).Count -gt 0
        $iisChanged = $environmentChanged -or $http[0].BindingInformation -ne $httpBinding -or -not $https.Count -or
            $pool.ManagedRuntimeVersion -ne '' -or $pool.Enable32BitAppOnWin64 -or
            $pool.ProcessModel.IdentityType -ne 'ApplicationPoolIdentity' -or -not $pool.ProcessModel.LoadUserProfile
        $sqlChanged = $createLogin -or $createUser -or $grants.Count
        if (-not $Apply) { Write-Host 'Read-only preflight complete. Use -Apply to make the reported changes.'; return }
        if (-not ($iisChanged -or $sqlChanged -or -not $trusted)) {
            Write-Host 'Staging already matches the setup. No changes made.'
            return
        }

        $artifacts = Join-Path $PSScriptRoot '..\..\tests\functional\artifacts\modernization'
        $run = [IO.Path]::GetFullPath((Join-Path $artifacts ('iis-staging-admin-' + [guid]::NewGuid().ToString('N'))))
        New-Item -ItemType Directory -Path $run | Out-Null
        $journalPath = Join-Path $run 'rollback.json'
        $journal = [ordered]@{
            SiteId = $site.Id; SiteState = [string] $site.State; PoolState = [string] $pool.State
            Http = $http[0].BindingInformation; AddedHttps = if ($https.Count) { $null } else { $httpsBinding }
            ManagedRuntimeVersion = $pool.ManagedRuntimeVersion; Enable32Bit = $pool.Enable32BitAppOnWin64
            IdentityType = [string] $pool.ProcessModel.IdentityType; LoadUserProfile = $pool.ProcessModel.LoadUserProfile
            PoolEnvironment = $oldEnvironment; CreatedSqlLogin = $createLogin; CreatedDatabaseUser = $createUser
            AddedGrants = $grants; SqlCommitted = $false; IisCommitted = $false
            CertificateThumbprint = if ($certificate) { $certificate.Thumbprint } else { $null }
            CreatedCertificate = $false; AddedUserTrust = $false
            WindowsTrustAccount = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        }
        Save-Journal
        Write-Host "Rollback journal: $journalPath"

        if ($sqlChanged) {
            $transaction = $sqlConnection.BeginTransaction()
            try {
                $command = $sqlConnection.CreateCommand()
                $command.Transaction = $transaction
                $statements = @(
                    "IF DB_NAME() <> N'$database' THROW 51000, 'Unexpected database', 1;"
                    if ($createLogin) { "CREATE LOGIN [$principal] FROM WINDOWS WITH DEFAULT_DATABASE = [$database];" }
                    if ($createUser) { "CREATE USER [$principal] FOR LOGIN [$principal];" }
                    foreach ($grant in $grants) { "GRANT $($grant.Permission) ON OBJECT::[dbo].[$($grant.Table)] TO [$principal];" }
                )
                try { $command.CommandText = $statements -join [Environment]::NewLine; $null = $command.ExecuteNonQuery() }
                finally { $command.Dispose() }
                $transaction.Commit()
            }
            finally { $transaction.Dispose() }
            $journal.SqlCommitted = $true
            Save-Journal
        }

        if (-not $certificate) {
            $certificate = New-SelfSignedCertificate -Type SSLServerAuthentication -Subject 'CN=localhost' `
                -FriendlyName $certificateName -CertStoreLocation 'Cert:\LocalMachine\My' `
                -TextExtension @('2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1') `
                -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(1)
            $journal.CertificateThumbprint = $certificate.Thumbprint
            $journal.CreatedCertificate = $true
            Save-Journal
        }
        if (-not $trusted) {
            $journal.AddedUserTrust = $true
            Save-Journal
            $root = New-Object Security.Cryptography.X509Certificates.X509Store 'Root', 'CurrentUser'
            $publicCertificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2 (,$certificate.RawData)
            try {
                $root.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
                $root.Add($publicCertificate)
            }
            finally { $root.Dispose(); $publicCertificate.Dispose() }
        }

        if ($iisChanged) {
            $pool.ManagedRuntimeVersion = ''
            $pool.Enable32BitAppOnWin64 = $false
            $pool.ProcessModel.IdentityType = 'ApplicationPoolIdentity'
            $pool.ProcessModel.LoadUserProfile = $true
            $http[0].BindingInformation = $httpBinding
            if (-not $https.Count) { $null = $site.Bindings.Add($httpsBinding, $certificate.GetCertHash(), 'My') }
            foreach ($name in $desired.Keys) {
                $entry = $environment | Where-Object { $_['name'] -eq $name } | Select-Object -First 1
                if ($null -eq $entry) {
                    $entry = $environment.CreateElement('add')
                    $entry['name'] = $name
                    $entry['value'] = $desired[$name]
                    $environment.Add($entry)
                }
                else { $entry['value'] = $desired[$name] }
            }
            $iis.CommitChanges()
            $journal.IisCommitted = $true
            Save-Journal
        }
        # Honor a deliberately stopped site/pool. Recycle only the dedicated running pool
        # when IIS or SQL changed.
        if (($iisChanged -or $sqlChanged) -and $journal.PoolState -eq 'Started') { $null = $pool.Recycle() }
        Write-Host "Setup applied. Verify the redirect, HTTPS trust and a database-backed request at https://localhost:$HttpsPort/."
    }
    finally { $sqlConnection.Dispose() }
}
finally { $iis.Dispose() }

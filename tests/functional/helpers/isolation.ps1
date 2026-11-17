param()
$ErrorActionPreference='Stop'
try {
    $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 5001 })
    if ($listeners.Count -eq 0) { throw 'No application is listening on localhost port 5001. Start the existing project profile in Visual Studio.' }
    $pids=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($pids.Count -ne 1) { throw 'Expected one localhost application process.' }
    $appPid=[int]$pids[0]
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$appPid"
    if ($process.Name -ne 'dotnet.exe' -or $process.CommandLine -notlike '*ASP.NET Core 2.2 with Angular 7*') { throw 'Listener is not the expected application.' }
    $connection=New-Object System.Data.SqlClient.SqlConnection('Server=localhost;Database=LeagueScramblerDev;Integrated Security=True;Application Name=LeagueScramblerIsolationCheck;Connect Timeout=10;')
    $connection.Open()
    $command=$connection.CreateCommand()
    $command.CommandText="SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=DB_ID('LeagueScramblerDev') AND host_process_id=@pid AND host_name=@host;"
    [void]$command.Parameters.AddWithValue('@pid',$appPid)
    [void]$command.Parameters.AddWithValue('@host',$env:COMPUTERNAME)
    $count=[int]$command.ExecuteScalar()
    if ($count -lt 1) { throw 'No development SQL session could be correlated with the running application.' }
    @{verified=$true;pid=$appPid;database='LeagueScramblerDev';server='localhost';checkedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
} catch {
    [Console]::Error.WriteLine('Isolation not confirmed: ' + $_.Exception.Message)
    exit 1
} finally { if ($connection) { $connection.Dispose() } }

param()
$ErrorActionPreference='Stop'
try {
    $repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
    $projectRoot=Join-Path $repoRoot "Allport's League Scrambler"
    $expectedDll=Join-Path $projectRoot 'bin/Debug/netcoreapp2.2/ASP.NET Core 2.2 with Angular 7.dll'
    $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 5001 })
    if ($listeners.Count -eq 0) { throw 'No application is listening on localhost port 5001.' }
    if (@($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1','::1') }).Count -gt 0) { throw 'Application must listen on loopback addresses only.' }
    $pids=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($pids.Count -ne 1) { throw 'Expected exactly one localhost listener process.' }
    $appProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($pids[0])"
    if ($appProcess.Name -ne 'dotnet.exe' -or $appProcess.CommandLine.IndexOf($expectedDll,[StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw 'Listener does not use this repository Debug DLL.'
    }
    $parents=@(); $current=$appProcess
    for ($i=0;$i -lt 8 -and $null -ne $current;$i++) {
        $parents+=$current.Name
        if ($current.ParentProcessId -le 0) { break }
        $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($current.ParentProcessId)" -ErrorAction SilentlyContinue
    }
    if ($parents -notcontains 'devenv.exe' -or $parents -notcontains 'VsDebugConsole.exe') { throw 'Visual Studio debug ancestry is absent.' }
    $profile=Get-Content -LiteralPath (Join-Path $projectRoot 'Properties/launchSettings.json') -Raw | ConvertFrom-Json
    if ($profile.profiles.Allport_s_League_Scrambler.commandName -ne 'Project' -or
        $profile.profiles.Allport_s_League_Scrambler.environmentVariables.ASPNETCORE_ENVIRONMENT -ne 'Development') { throw 'Expected Development project profile is absent.' }
    # Check the same first-match ancestor probing used by dotenv.net.
    $directory=[IO.DirectoryInfo](Split-Path -Parent $expectedDll); $selected=$null
    for ($i=0;$i -lt 6 -and $null -ne $directory;$i++) {
        $candidate=Join-Path $directory.FullName '.env'
        if (Test-Path -LiteralPath $candidate) { $selected=[IO.Path]::GetFullPath($candidate); break }
        $directory=$directory.Parent
    }
    $expectedEnv=[IO.Path]::GetFullPath((Join-Path $projectRoot '.env'))
    if ($selected -ine $expectedEnv) { throw 'A different .env would be selected by output-directory probing.' }
    @{
        pid=[int]$appProcess.ProcessId
        processStartUtc=$appProcess.CreationDate.ToUniversalTime().ToString('o')
        projectDll=[IO.Path]::GetFullPath($expectedDll)
        dllSha256=(Get-FileHash -LiteralPath $expectedDll -Algorithm SHA256).Hash
        envSha256=(Get-FileHash -LiteralPath $expectedEnv -Algorithm SHA256).Hash
        launchProfileSha256=(Get-FileHash -LiteralPath (Join-Path $projectRoot 'Properties/launchSettings.json') -Algorithm SHA256).Hash
        visualStudioDebug=$true
        loopbackOnly=$true
    } | ConvertTo-Json -Compress
} catch {
    [Console]::Error.WriteLine('Process identity rejected: '+$_.Exception.Message)
    exit 1
}

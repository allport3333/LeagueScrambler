param([switch]$ApprovedDevelopmentDatabase)
$ErrorActionPreference='Stop'
if(-not $ApprovedDevelopmentDatabase){throw 'Current explicit user authorization for development database writes is required.'}
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$output=Join-Path $repoRoot 'tests/functional/artifacts/schedule-management/database-bin'
$log=Join-Path $repoRoot 'tests/functional/artifacts/schedule-management/database-build.log'
$project=Join-Path $repoRoot 'tools/schedule-management/ScheduleCheck.csproj'
$msbuild='C:/Program Files/Microsoft Visual Studio/2022/Community/MSBuild/Current/Bin/MSBuild.exe'
$backend=Join-Path $repoRoot "Allport's League Scrambler/Allport's League Scrambler.csproj"
$backendLog=Join-Path $repoRoot 'tests/functional/artifacts/schedule-management/backend-build.log'
# Build current source separately; never overwrite the running Visual Studio DLL.
& $msbuild $backend /t:Build /p:Configuration=Debug /p:BuildProjectReferences=false /p:OutputPath=../tests/functional/artifacts/schedule-management/backend/ /p:UseSharedCompilation=false /verbosity:minimal *> $backendLog
if($LASTEXITCODE -ne 0){Get-Content -LiteralPath $backendLog -Tail 10;throw 'Current backend build failed; no writes attempted.'}
& $msbuild $project /restore /t:Build /p:Configuration=Debug /p:OutputPath=../../tests/functional/artifacts/schedule-management/database-bin/ /p:UseSharedCompilation=false /verbosity:minimal *> $log
if($LASTEXITCODE -ne 0){Get-Content -LiteralPath $log -Tail 12;throw 'Database test build failed; no writes attempted.'}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '../helpers/runtime-verification.ps1') -ReadOnly
if($LASTEXITCODE -ne 0){throw 'Running Development database could not be verified; no writes attempted.'}
$inspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../.local/runtime-process-inspection.json') -Raw | ConvertFrom-Json
if(-not $inspection.effectiveRuntimeEnvironmentVerified -or $inspection.server -cne 'localhost' -or $inspection.database -cne 'LeagueScramblerDev'){throw 'Unexpected runtime identity.'}
$approvalPath=Join-Path $PSScriptRoot '../.local/schedule-management-development-approval.json'
# Separate, narrowly scoped receipt for the user's renewed authorization. The
# older milestone/process approvals are deliberately left unchanged.
$approval=@{userAuthorized=$true;userInstruction='you have approval for database development';scope='schedule-management-development';server='localhost';database='LeagueScramblerDev';environment='Development';identity=$inspection.identity;approvedAt=[DateTime]::UtcNow.ToString('o');expiresAt=[DateTime]::UtcNow.AddHours(1).ToString('o')}
[IO.File]::WriteAllText([IO.Path]::GetFullPath($approvalPath),($approval|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
$current=(& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot '../helpers/process-identity.ps1') | ConvertFrom-Json)
foreach($field in 'pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256'){if($current.$field -cne $inspection.identity.$field){throw 'Process changed after approval; no writes attempted.'}}
$environmentPath=Join-Path $repoRoot "Allport's League Scrambler/.env"
$report=Join-Path $repoRoot 'tests/functional/artifacts/schedule-management/database-results.json'
& dotnet (Join-Path $output 'ScheduleCheck.dll') $approvalPath $environmentPath (Join-Path $repoRoot 'tools/schedule-management/001-schedule-events.sql') (Join-Path $repoRoot 'tests/functional/artifacts/schedule-management/persistence-fixture.json') $report
exit $LASTEXITCODE

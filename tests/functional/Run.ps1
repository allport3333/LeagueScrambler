param(
    [ValidateSet('readonly','all','mutating','verify','dbcheck','report','final-report','isolation','approve-manual','verify-runtime','inventory','cleanup-plan','cleanup-orphans')]
    [string]$Mode = 'readonly',
    [string]$Manifest,
    [string]$TestFilter,
    [ValidatePattern('^[a-z0-9-]+$')][string]$ReportLabel,
    [switch]$ExecuteCleanup,
    [switch]$ConfirmManualDevDatabase
)
$ErrorActionPreference = 'Stop'
$runtime = Get-Content -LiteralPath (Join-Path $PSScriptRoot '.tools/runtime.json') -Raw | ConvertFrom-Json
$nodeExe = Join-Path $PSScriptRoot ('.tools/' + $runtime.directory + '/node.exe')
$priorBrowserPath = $env:PLAYWRIGHT_BROWSERS_PATH
$priorNodeOptions = $env:NODE_OPTIONS
$priorReportLabel=$env:LS_TEST_REPORT_LABEL
if($ReportLabel){$env:LS_TEST_REPORT_LABEL=$ReportLabel}
# Respect the localhost certificate already trusted in Windows; never disable TLS validation.
$env:NODE_OPTIONS = (($priorNodeOptions + ' --use-system-ca').Trim())
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot '.tools/browsers'
Push-Location $PSScriptRoot
$filterArgs=@()
if ($TestFilter) { $filterArgs=@('--grep',$TestFilter) }
try {
    if ($Mode -in @('readonly','mutating','all')) {
        $reportRoot=Join-Path $PSScriptRoot 'artifacts'
        if($ReportLabel){$reportRoot=Join-Path $reportRoot ('runs/'+$ReportLabel)}
        if(Test-Path -LiteralPath (Join-Path $reportRoot 'results.json')){
            $label='main';if($ReportLabel){$label=$ReportLabel}
            $archive=Join-Path $PSScriptRoot ('artifacts/archive/'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')+'-'+$label)
            New-Item -ItemType Directory -Path $archive -Force | Out-Null
            foreach($entry in @('results.json','summary.md','html','results')){
                $source=Join-Path $reportRoot $entry
                if(Test-Path -LiteralPath $source){Copy-Item -LiteralPath $source -Destination $archive -Recurse}
            }
        }
    }
    switch ($Mode) {
        'verify' { & $nodeExe 'scripts/verify.cjs' }
        'dbcheck' { & $nodeExe 'scripts/verify-db.cjs' }
        'isolation' { & $nodeExe 'scripts/isolation.cjs' }
        'verify-runtime' { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'helpers/runtime-verification.ps1' }
        'inventory' { & $nodeExe 'scripts/inventory.cjs' }
        'final-report' { & $nodeExe 'scripts/final-report.cjs' }
        'cleanup-orphans' {
            $cleanupArgs=@();if($ExecuteCleanup){$cleanupArgs=@('--execute')}
            & $nodeExe 'scripts/cleanup-orphans.cjs' @cleanupArgs
        }
        'approve-manual' {
            if (-not $ConfirmManualDevDatabase) { throw 'Explicit -ConfirmManualDevDatabase is required.' }
            & $nodeExe 'scripts/approve-manual.cjs' --confirm-manual-dev-database
        }
        'cleanup-plan' { & $nodeExe 'scripts/cleanup-plan.cjs' $Manifest }
        'report' { & $nodeExe 'node_modules/@playwright/test/cli.js' show-report 'artifacts/html' --host localhost }
        'readonly' { & $nodeExe 'node_modules/@playwright/test/cli.js' test --project=readonly @filterArgs }
        'mutating' { & $nodeExe 'node_modules/@playwright/test/cli.js' test --project=mutating @filterArgs }
        'all' { & $nodeExe 'node_modules/@playwright/test/cli.js' test @filterArgs }
    }
    $result = $LASTEXITCODE
} finally { Pop-Location; $env:PLAYWRIGHT_BROWSERS_PATH = $priorBrowserPath; $env:NODE_OPTIONS = $priorNodeOptions; $env:LS_TEST_REPORT_LABEL=$priorReportLabel }
exit $result

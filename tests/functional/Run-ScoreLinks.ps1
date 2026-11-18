param([switch]$LeagueChangeOnly,[switch]$ApiReadOnly)
$ErrorActionPreference='Stop'
$runtime=Get-Content -LiteralPath (Join-Path $PSScriptRoot '.tools/runtime.json') -Raw | ConvertFrom-Json
$taskNode=Join-Path $PSScriptRoot ('.tools/'+$runtime.directory+'/node.exe')
$priorBrowsers=$env:PLAYWRIGHT_BROWSERS_PATH;$priorOptions=$env:NODE_OPTIONS
try {
    $env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $PSScriptRoot '.tools/browsers'
    $env:NODE_OPTIONS=($priorOptions+' --use-system-ca').Trim()
    if($ApiReadOnly){
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'helpers/runtime-verification.ps1') -ReadOnly
        if($LASTEXITCODE -ne 0){throw 'Independent development runtime verification failed.'}
        & $taskNode (Join-Path $PSScriptRoot 'scripts/score-links-api-readonly.cjs')
    }else{
        $testArgs=@();if($LeagueChangeOnly){$testArgs=@('--league-change')}
        & $taskNode (Join-Path $PSScriptRoot 'scripts/score-links.cjs') @testArgs
    }
    $testExit=$LASTEXITCODE
}finally{$env:PLAYWRIGHT_BROWSERS_PATH=$priorBrowsers;$env:NODE_OPTIONS=$priorOptions}
exit $testExit

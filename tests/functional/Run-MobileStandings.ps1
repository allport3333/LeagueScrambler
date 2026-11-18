$ErrorActionPreference='Stop'
$runtime=Get-Content -LiteralPath (Join-Path $PSScriptRoot '.tools/runtime.json') -Raw | ConvertFrom-Json
$taskNode=Join-Path $PSScriptRoot ('.tools/'+$runtime.directory+'/node.exe')
$priorBrowsers=$env:PLAYWRIGHT_BROWSERS_PATH
$priorOptions=$env:NODE_OPTIONS
try {
    $env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $PSScriptRoot '.tools/browsers'
    $env:NODE_OPTIONS=($priorOptions+' --use-system-ca').Trim()
    & $taskNode (Join-Path $PSScriptRoot 'scripts/mobile-standings.cjs')
    $testExit=$LASTEXITCODE
} finally {
    $env:PLAYWRIGHT_BROWSERS_PATH=$priorBrowsers
    $env:NODE_OPTIONS=$priorOptions
}
exit $testExit

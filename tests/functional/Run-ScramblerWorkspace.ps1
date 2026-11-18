param([ValidateSet('all','stage1','setup','final','followup')][string]$Mode='all')
$ErrorActionPreference='Stop'
$runtime=Get-Content -LiteralPath (Join-Path $PSScriptRoot '.tools/runtime.json') -Raw | ConvertFrom-Json
$node=Join-Path $PSScriptRoot ('.tools/'+$runtime.directory+'/node.exe')
$priorBrowserPath=$env:PLAYWRIGHT_BROWSERS_PATH
try {
    $env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $PSScriptRoot '.tools/browsers'
    $modes=@($Mode);if($Mode -eq 'all'){$modes=@('stage1','setup','final','followup')}
    foreach($phase in $modes){
        & $node (Join-Path $PSScriptRoot 'scripts/scrambler-workspace.cjs') $phase
        if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
        Write-Output "Scrambler workspace $phase passed (API fixtures only; no SQL)."
    }
} finally {$env:PLAYWRIGHT_BROWSERS_PATH=$priorBrowserPath}

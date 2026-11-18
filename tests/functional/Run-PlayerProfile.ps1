param([ValidateSet('all','calculations','browser','capture')][string]$Mode='all')
$ErrorActionPreference='Stop'
if($Mode -in @('all','calculations')){
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'scripts/test-player-profile-calculations.ps1')
    if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
}
if($Mode -eq 'calculations'){exit 0}
$runtime=Get-Content -LiteralPath (Join-Path $PSScriptRoot '.tools/runtime.json') -Raw | ConvertFrom-Json
$prior=$env:PLAYWRIGHT_BROWSERS_PATH
try{
    $env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $PSScriptRoot '.tools/browsers'
    $argsForProfile=@();if($Mode -eq 'capture'){$argsForProfile=@('--capture-only')}
    & (Join-Path $PSScriptRoot ('.tools/'+$runtime.directory+'/node.exe')) (Join-Path $PSScriptRoot 'scripts/player-profile-ui.cjs') @argsForProfile
    $result=$LASTEXITCODE
}finally{$env:PLAYWRIGHT_BROWSERS_PATH=$prior}
exit $result

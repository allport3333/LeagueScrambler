param([ValidateSet('inspect','create','reset','remove','verify','selftest')][string]$Mode='inspect',[switch]$Authorize,[switch]$PrepareTestPlayer,[string]$ReferenceDate)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$node=Join-Path $repo 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe'
if(-not(Test-Path -LiteralPath $node)){throw 'Existing functional-test Node22 runtime is required; no packages are installed by this utility.'}
$seedArgs=@((Join-Path $PSScriptRoot 'run.cjs'),$Mode)
if($Authorize){$seedArgs+='--authorize'}
if($PrepareTestPlayer){$seedArgs+='--prepare-test-player'}
if($ReferenceDate){$seedArgs+=@('--date',$ReferenceDate)}
& $node @seedArgs
exit $LASTEXITCODE

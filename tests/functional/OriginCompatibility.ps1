param([string]$AppBin, [string]$DotnetPath)
$ErrorActionPreference='Stop'
# Compile one console entry point using already installed SDK/runtime assemblies.
# No project/restore/package install/app launch or SQL operation is performed.
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $AppBin) { $AppBin=Join-Path $repo "Allport's League Scrambler/bin/Release/net10.0" }
if (-not $DotnetPath) {
    $portable=Join-Path $PSScriptRoot '.tools/dotnet10/dotnet.exe'
    $DotnetPath=if (Test-Path -LiteralPath $portable) { $portable } else { (Get-Command dotnet -ErrorAction Stop).Source }
}
$appName='ASP.NET Core 2.2 with Angular 7'
$appDll=Join-Path $AppBin ($appName+'.dll')
$dotnetRoot=Split-Path -Parent (Resolve-Path -LiteralPath $DotnetPath).Path
$sdkVersion=(& $DotnetPath --version).Trim()
$compiler=Join-Path $dotnetRoot ('sdk/'+$sdkVersion+'/Roslyn/bincore/csc.dll')
$runtime=Join-Path $AppBin ($appName+'.runtimeconfig.json')
function Get-Net10References([string]$Pack) {
    $installed=Get-ChildItem (Join-Path $dotnetRoot ('packs/'+$Pack)) -Directory |
        Where-Object Name -match '^10\.0\.\d+$' | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if (!$installed) { throw 'A .NET 10 reference pack is required.' }
    Join-Path $installed.FullName 'ref/net10.0'
}
$core=Get-Net10References 'Microsoft.NETCore.App.Ref'
$asp=Get-Net10References 'Microsoft.AspNetCore.App.Ref'
foreach($required in @($appDll,$compiler,$runtime,$core,$asp)){if(-not(Test-Path -LiteralPath $required)){throw 'Required existing build/SDK/runtime is unavailable; no software is installed automatically.'}}
$source=Join-Path $PSScriptRoot 'unit/OriginCompatibility.cs'
$filterSource=Join-Path $repo "Allport's League Scrambler/Security/SameOriginAttribute.cs"
if((Get-Item -LiteralPath $filterSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $appDll).LastWriteTimeUtc){throw 'Filter source is newer than the compiled app; rebuild under valid safeguards first.'}
$output=Join-Path $PSScriptRoot 'artifacts/origin-compatibility'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$references=@(Get-ChildItem -LiteralPath $core -Filter '*.dll';Get-ChildItem -LiteralPath $asp -Filter '*.dll') | Where-Object {($_.Name -match '^(System\.|Microsoft\.|mscorlib\.|netstandard\.)') -and $_.Name -notmatch '\.Native\.'} | Group-Object Name | ForEach-Object {$_.Group[0].FullName}
$argsList=@('/nologo','/nostdlib+','/target:exe',('/out:'+(Join-Path $output 'OriginCompatibility.dll')),('/reference:'+$appDll))
$argsList+=@($references | ForEach-Object {'/reference:'+$_})
$argsList+=$source
$responseFile=Join-Path $output 'compiler.rsp'
$argsList | ForEach-Object {'"'+$_+'"'} | Set-Content -LiteralPath $responseFile -Encoding UTF8
$compileOutput=& $DotnetPath $compiler /noconfig ('@'+$responseFile) 2>&1
$compileExit=$LASTEXITCODE
$compileOutput | Set-Content -LiteralPath (Join-Path $output 'compile.log') -Encoding UTF8
$compileOutput | Write-Output
if($compileExit -ne 0){throw 'Origin compatibility test compilation failed.'}
Copy-Item -LiteralPath $appDll -Destination (Join-Path $output ($appName+'.dll')) -Force
$result=& $DotnetPath exec --runtimeconfig $runtime (Join-Path $output 'OriginCompatibility.dll')
$testExit=$LASTEXITCODE
$result | Set-Content -LiteralPath (Join-Path $output 'results.txt') -Encoding UTF8
$result | Write-Output
@{appDllSha256=(Get-FileHash -LiteralPath $appDll -Algorithm SHA256).Hash;filterSourceSha256=(Get-FileHash -LiteralPath $filterSource -Algorithm SHA256).Hash;executedAt=[DateTime]::UtcNow.ToString('o');scope='compiled-filter-only; no network/SQL';exitCode=$testExit} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'evidence.json') -Encoding UTF8
exit $testExit

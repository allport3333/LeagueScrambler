param()
$ErrorActionPreference = 'Stop'
$suiteRoot = $PSScriptRoot
$toolsPath = Join-Path $suiteRoot '.tools'
New-Item -ItemType Directory -Path $toolsPath -Force | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$installed = Join-Path $toolsPath 'runtime.json'
if (Test-Path -LiteralPath $installed) {
    $runtime = Get-Content -LiteralPath $installed -Raw | ConvertFrom-Json
    $nodeHome = Join-Path $toolsPath $runtime.directory
} else {
    $index = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $version = ($index | Where-Object { $_.version -match '^v22\.' } | Select-Object -First 1).version
    if ($version -notmatch '^v22\.\d+\.\d+$') { throw 'Cannot identify an official Node 22 release.' }
    $directory = "node-$version-win-x64"
    $archiveName = "$directory.zip"
    $archive = Join-Path $toolsPath $archiveName
    $checksums = (Invoke-WebRequest "https://nodejs.org/dist/$version/SHASUMS256.txt" -UseBasicParsing).Content
    $checksumLine = @($checksums -split "`n" | Where-Object { $_.Trim().EndsWith(" $archiveName") })
    if ($checksumLine.Count -ne 1) { throw 'Official archive checksum not found.' }
    $expected = ($checksumLine[0].Trim() -split '\s+')[0]
    Invoke-WebRequest "https://nodejs.org/dist/$version/$archiveName" -OutFile $archive -UseBasicParsing
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ine $expected) { throw 'Node archive checksum mismatch.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsPath -Force
    $nodeHome = Join-Path $toolsPath $directory
    @{ version=$version; directory=$directory; sha256=$expected } | ConvertTo-Json | Set-Content -LiteralPath $installed -Encoding UTF8
}
$priorPath = $env:PATH
$priorBrowserPath = $env:PLAYWRIGHT_BROWSERS_PATH
try {
    # Changed only inside this setup process, never globally or in Visual Studio.
    $env:PATH = "$nodeHome;$priorPath"
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $toolsPath 'browsers'
    Push-Location $suiteRoot
    try {
        if (Test-Path -LiteralPath 'package-lock.json') { & "$nodeHome/npm.cmd" ci --ignore-scripts --no-audit --no-fund }
        else { & "$nodeHome/npm.cmd" install --ignore-scripts --no-audit --no-fund }
        if ($LASTEXITCODE -ne 0) { throw 'Test-only dependency installation failed.' }
        & "$nodeHome/node.exe" 'node_modules/@playwright/test/cli.js' install chromium
        if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }
        & "$nodeHome/node.exe" 'scripts/verify.cjs'
        if ($LASTEXITCODE -ne 0) { throw 'Installation verification failed.' }
    } finally { Pop-Location }
} finally {
    $env:PATH = $priorPath
    $env:PLAYWRIGHT_BROWSERS_PATH = $priorBrowserPath
}

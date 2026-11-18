param()
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$auditRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$zipPath=Join-Path $auditRoot 'LeagueScrambler_UX_Audit_2026-11-17.zip'
if(Test-Path -LiteralPath $zipPath){throw 'Review ZIP already exists; refusing an unintended overwrite.'}
$relativeFiles=@('UX_AUDIT_REPORT.md','UX_EXECUTIVE_SUMMARY.md','UX_IMPLEMENTATION_ROADMAP.md','SCREENSHOT_INDEX.md','SCREENSHOT_GALLERY.html','CONTACT_SHEET.html','CONTACT_SHEET.png','README.md','mockups/CONCEPTS.html','mockups/CONCEPTS.png','evidence/accessibility-summary.json','evidence/VIEWPORT_MEASUREMENTS.csv','evidence/findings.json','evidence/PROVENANCE.md','evidence/interaction-observations.json')
$relativeFiles+=@(Get-ChildItem -LiteralPath (Join-Path $auditRoot 'screenshots') -File -Filter '*.png' | ForEach-Object {'screenshots/'+$_.Name})
$archive=[IO.Compression.ZipFile]::Open($zipPath,[IO.Compression.ZipArchiveMode]::Create)
try {
 foreach($relative in $relativeFiles){
  $file=[IO.Path]::GetFullPath((Join-Path $auditRoot $relative))
  if(-not $file.StartsWith($auditRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or -not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'Archive path/existence check failed.'}
  [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file,$relative,[IO.Compression.CompressionLevel]::Optimal)
 }
} finally {$archive.Dispose()}
$read=[IO.Compression.ZipFile]::OpenRead($zipPath)
try {
 if($read.Entries.Count -ne $relativeFiles.Count){throw 'Archive entry count mismatch'}
 foreach($entry in $read.Entries){if($entry.FullName -match '(^|/)(\.local|\.env|node_modules|\.tools|production-recovery)(/|$)' -or $entry.FullName -match '\.(har|trace|dll|exe)$'){throw 'Excluded content appeared in archive'};$stream=$entry.Open();try{$stream.CopyTo([IO.Stream]::Null)}finally{$stream.Dispose()}}
}finally{$read.Dispose()}
$info=Get-Item -LiteralPath $zipPath
$hash=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
@('Review bundle: '+$info.Name,'Entries: '+$relativeFiles.Count,'Bytes: '+$info.Length,'SHA256: '+$hash,'No application source changes or implementation included.','Raw capture HTML/text, browser profiles, tokens/cookies, traces, network events, binaries and production recovery data excluded.','') + $relativeFiles | Set-Content -LiteralPath (Join-Path $auditRoot 'PACKAGE_MANIFEST.txt') -Encoding UTF8
[pscustomobject]@{Archive=$zipPath;Entries=$relativeFiles.Count;Screenshots=@($relativeFiles | Where-Object {$_ -like 'screenshots/*'}).Count;SizeMB=[Math]::Round($info.Length/1MB,2);Sha256=$hash;AllEntriesReadSuccessfully=$true}|ConvertTo-Json

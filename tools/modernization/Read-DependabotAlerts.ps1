param([string]$OutputFile)
$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if((git -C $workspace branch --show-current) -ne 'feature/framework-modernization'){throw 'Use the modernization worktree.'}
$artifactRoot=[IO.Path]::GetFullPath((Join-Path $workspace 'tests/functional/artifacts/modernization'))
if(!$OutputFile){$OutputFile=Join-Path $artifactRoot 'github-alerts-current.json'}
$OutputFile=[IO.Path]::GetFullPath($OutputFile)
if(!$OutputFile.StartsWith($artifactRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Output must remain in modernization artifacts.'}
$previousPrompt=$env:GIT_TERMINAL_PROMPT
$previousInteractive=$env:GCM_INTERACTIVE
$credentialData=@{};$headers=@{}
try{
 $env:GIT_TERMINAL_PROMPT='0';$env:GCM_INTERACTIVE='never'
 $lines="protocol=https`nhost=github.com`n`n" | git -C $workspace -c credential.interactive=false credential fill 2>$null
 if($LASTEXITCODE -ne 0){throw 'Existing GitHub authentication is unavailable; no interactive login was attempted.'}
 foreach($line in $lines){$split=$line.IndexOf('=');if($split -gt 0){$credentialData[$line.Substring(0,$split)]=$line.Substring($split+1)}}
 if(!$credentialData.password){throw 'Existing GitHub authentication did not provide a credential.'}
 $headers=@{Authorization='Bearer '+$credentialData.password;Accept='application/vnd.github+json';'User-Agent'='LeagueHub-modernization-readonly';'X-GitHub-Api-Version'='2022-11-28'}
 $records=@();$failures=0
 foreach($number in @(316,319,318,325,324,296,313,303,295,294,293)){
  try{
   $alert=Invoke-RestMethod -Uri "https://api.github.com/repos/allport3333/LeagueScrambler/dependabot/alerts/$number" -Headers $headers -MaximumRedirection 0
   $records+=@{number=$number;state=$alert.state;fixedAt=$alert.fixed_at;package=$alert.dependency.package.name;ecosystem=$alert.dependency.package.ecosystem;manifest=$alert.dependency.manifest_path;scope=$alert.dependency.scope;ghsa=$alert.security_advisory.ghsa_id;cve=$alert.security_advisory.cve_id;severity=$alert.security_advisory.severity;summary=$alert.security_advisory.summary;vulnerableRange=$alert.security_vulnerability.vulnerable_version_range;firstPatchedVersion=$alert.security_vulnerability.first_patched_version.identifier}
  }catch{
   $failures++;$status=$null;if($_.Exception.Response){$status=[int]$_.Exception.Response.StatusCode}
   $records+=@{number=$number;metadataUnavailable=$true;httpStatus=$status}
  }
 }
 $report=@{retrievedUtc=[DateTime]::UtcNow.ToString('O');repository='allport3333/LeagueScrambler';readOnly=$true;failures=$failures;alerts=$records}
 [IO.File]::WriteAllText($OutputFile,($report|ConvertTo-Json -Depth 9),[Text.UTF8Encoding]::new($false))
 Write-Output "Dependabot metadata: $($records.Count) records; $failures unavailable. No remote changes."
 if($failures){exit 1}
}finally{
 $headers.Clear();$credentialData.Clear();$lines=$null
 $env:GIT_TERMINAL_PROMPT=$previousPrompt;$env:GCM_INTERACTIVE=$previousInteractive
}

$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Add-Type -Path (Join-Path $repo "Allport's League Scrambler/Security/AttendanceRules.cs")
function Check($condition,$name){if(!$condition){throw $name}}
$now=[datetime]'2026-11-18T20:00:00'
Check ([Allport_s_League_Scrambler.Security.AttendanceRules]::UnavailableReason($true,$false,'Wednesday',$now) -eq $null) 'Configured league day allowed'
Check ([Allport_s_League_Scrambler.Security.AttendanceRules]::UnavailableReason($true,$true,'Wednesday',$now) -like '*locked*') 'Lock blocks self mutations'
Check ([Allport_s_League_Scrambler.Security.AttendanceRules]::UnavailableReason($false,$false,'Wednesday',$now) -like '*does not belong*') 'Nonmember denied'
Check ([Allport_s_League_Scrambler.Security.AttendanceRules]::UnavailableReason($true,$false,'Monday',$now) -like '*Monday only*') 'Wrong day denied'
foreach($day in @('', 'not-a-day', '3')){Check ([Allport_s_League_Scrambler.Security.AttendanceRules]::UnavailableReason($true,$false,$day,$now) -like '*not been configured*') 'Missing/invalid day denied'}
foreach($entry in @(@('2026-03-08T04:30:00','2026-03-07'),@('2026-03-08T07:30:00','2026-03-08'),@('2026-11-01T05:30:00','2026-11-01'),@('2026-11-01T06:30:00','2026-11-01'))){$actual=[Allport_s_League_Scrambler.Security.AttendanceRules]::EasternNow([datetime]$entry[0]);Check ($actual.ToString('yyyy-MM-dd') -eq $entry[1]) 'Eastern DST date'}
$controller=Get-Content -LiteralPath (Join-Path $repo "Allport's League Scrambler/Controllers/PlayerAttendanceController.cs") -Raw
Check ($controller.Contains('[Authorize(AuthenticationSchemes=CookieAuthenticationDefaults.AuthenticationScheme)]')) 'Cookie auth is required'
Check (([regex]::Matches($controller,'\[SameOrigin\]')).Count -eq 2) 'Both mutations have origin guard'
Check ($controller.Contains('link.UserId==userId') -and $controller.Contains('linked.Contains(playerId)') -and $controller.Contains('if(!state.IsOwnProfile)return Forbid();')) 'Ownership source and mutation guard'
Check ($controller.Contains('state.Reason!=null') -and $controller.Contains('IsolationLevel.Serializable') -and $controller.Contains('AttendanceSerialization.Acquire')) 'Eligibility and atomic duplicate boundary'
$old=Get-Content -LiteralPath (Join-Path $repo "Allport's League Scrambler/Controllers/ScrambleDataController.cs") -Raw
Check ($old.Contains('AttendanceSerialization.Acquire(context, playerSignIn.LeagueId')) 'Kiosk uses same serialization helper'
Check ($old.Contains('if (!isLeagueManager)') -and $old.Contains('AttendanceRules.UnavailableReason(true, locked, day')) 'Older ordinary-player delete path respects lock and day without changing manager bypass'
$out=Join-Path $repo 'tests/functional/player-profile-evidence/attendance-policy-results.json'
@{policyGroupsPassed=6;sourceGuardChecksPassed=6;failed=0;databaseAccess=$false;limitation='Pure production policy and source guard assertions; no live controller/SQL execution'}|ConvertTo-Json|Set-Content $out
'6 production policy groups and 6 structural guard checks passed; no SQL.'

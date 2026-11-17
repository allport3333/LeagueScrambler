# State-changing endpoint review — 2026-11-17

Source audit of all four Controllers on security/initial-hardening-oct-2026. There are 27 POST/DELETE actions: 26 change SQL, authentication/session state or email-related state; one POST is retrieval only. No PUT/PATCH actions found. No automatic SQL migrations/seeding found in C# startup source. No production API requests or SQL queries were made for this audit.

`M` = LeagueManagement policy (ordinary Admin/Manager OR legacy scheme with LegacyAdmin), followed by league-access checks. Global Admin/LegacyAdmin access is intentional; Manager requires assignment. `U` = ordinary cookie authentication; `D` = ordinary or legacy cookie, own sign-in OR league-manager check. These are source observations, supplemented by the previous 34-passing regression baseline, not new authenticated executions in this audit.

| Controller / route (under /api/) | Method | Access / effect | Explicit CSRF check |
|---|---|---|---|
| Login/VerifyAdminPassword | POST | Public password validation; separate legacy cookie | None; FROZEN |
| Login/register | POST | Public; new Player account/cookie | SameOrigin |
| Login/login | POST | Public; account credential validation/cookie | SameOrigin |
| Login/logout | POST | Clears ordinary/legacy sessions | None; FROZEN workflow |
| Login/SetLockSignInStatus | POST | M; league lock row | None |
| Login/updatesetting | POST | M; league settings | None |
| Login/resetpassword | POST | Reset-token validation; account password/reset state | None; token is capability, not cookie authorization |
| Login/forgotpassword | POST | Public; throttled reset state/email | None; no email tests allowed |
| ScrambleData/claimPlayer | POST | U; posted user ID must equal authenticated ID; uniqueness checks | SameOrigin |
| ScrambleData/AddPlayer/{leagueName} | POST | M; roster/profile/division | None |
| ScrambleData/AddPlayerWithoutLeague | POST | U; first profile or Admin/Manager | SameOrigin |
| ScrambleData/DeletePlayer/{leagueName} | POST | M; roster membership removal | None |
| ScrambleData/AddNewLeague/{leagueName} | POST | M; league/settings/owner links | SameOrigin; Admin/Manager browser and SQL checks passed |
| ScrambleData/GenerateScramble/{leagueName} | POST | M; persisted scramble graph | None |
| ScrambleData/SaveKingQueenTeams/{leagueName} | POST | M; persisted teams | None |
| ScrambleData/SaveKingQueenRoundScores/{leagueName} | POST | M; scores; league ownership checks | None |
| ScrambleData/UpdateKingQueenPlayerSubStatus | POST | M; substitute status on referenced team | None |
| ScrambleData/SaveCreatedTeamScores | POST | M; team/player/round scores; league checks | None |
| ScrambleData/SignInPlayer | POST | Public by design; roster/duplicate/lock checks | SameOrigin |
| ScrambleData/SignInPlayer/{playerSignInId} | DELETE | D; deletes own or managed entry | None; DELETE normally requires browser preflight |
| LeagueDivision/Add | POST | M; new division | None |
| Statistics/RecordLeagueTeamScore | POST | M; same-league teams; inserts score | None |
| Statistics/UpdateTeamScores/{leagueName} | POST | M; recalculates stored totals, no body required | SameOrigin; Admin/Manager browser and SQL checks passed |
| Statistics/AddPlayerToLeagueTeam | POST | M; team ownership and player league membership | SameOrigin; Admin/Manager browser and SQL checks passed |
| Statistics/AddTeam | POST | M; new team | None |
| Statistics/SetTeamDivision | POST | M; division update | SameOrigin; Admin/Manager browser and SQL checks passed |
| ScrambleData/GetKingQueenTeamsByScrambleNumbers/{leagueName} | POST | Public saved-scramble retrieval only; no SaveChanges | Not a mutation |

## Confirmed gaps versus exploit claims

- Nine actions now carry SameOrigin after the focused four-action remediation. No global antiforgery-token validation or CORS allowance was found. Missing checks elsewhere are confirmed; this is not proof that every JSON endpoint is exploitable from a foreign browser origin. JSON content-type/preflight, authorization and SameSite provide different, partial protections.
- AddNewLeague, UpdateTeamScores, AddPlayerToLeagueTeam and SetTeamDivision previously accepted route/scalar inputs without an explicit CSRF check; their SameOrigin attributes close that source gap. Final Admin/Manager tests passed: actual-browser same-origin success, API foreign/null/missing/spoofed-origin rejection and unchanged exact SQL snapshots. This is not an attacker-host browser exploit reproduction. Unknown production proxy configuration still requires compatibility validation before deployment. Final complete suite: 36 passed/0 failed/2 accepted blocked; all previous 34 passes re-established.
- Shared logout accepts an empty POST, but its workflow is frozen. Document logout CSRF/session-disruption risk; do not silently change it.
- Failed Origin validation must never be repaired by trusting arbitrary X-Forwarded-Host/Proto, allowing all four aliases cross-origin, disabling checks on authenticated users or accepting missing/null Origin and Referer.
- State-changing GETs in both ScrambleData/GetPlayers routes were removed in the prior cycle. GET source review found no additional direct SaveChanges operation. Full transitive side-effect freedom is not established for every library/middleware action.
- Existing ownership checks were found on management mutations. The earlier suite verified assigned/unassigned Manager denial and before/after SQL integrity. No new critical authorization bypass was confirmed in this bounded audit. First-claim real-world identity proof remains unresolved by design; global legacy permissions and shared attribution remain frozen risks.

## Next safe work

First establish the real proxy scheme/host behavior in an authorized staging/development setup and renew valid process-bound testing authority. Then design per-action origin/antiforgery protection for nonfrozen management actions with positive administrator compatibility and rejected-write tests. Anything changing frozen legacy authentication/session/logout behavior needs separate user direction. Never run these probes on production or send recovery emails.

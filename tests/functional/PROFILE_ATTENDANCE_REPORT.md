# Profile League Night Sign In — November 18, 2026

## Feature and shared records
A compact League Night Sign In component sits below Next Game and above the existing profile statistics tabs. Eligible players see a green Sign In for Tonight button; confirmed attendance shows a green Signed In for Tonight indicator and an eligible secondary Remove Sign In action. Removal requires confirmation. Loading, errors, locked/wrong-day, absent league membership, missing linked player and expired-session states cannot expose an enabled sign-in action. Other players' profiles have no attendance controls after ownership resolution. Next Game and attendance are independent: a K/Q player without scheduled fixed teams can still sign in.

New authenticated GET/POST/DELETE routes are `/api/PlayerAttendance/{leagueId}/{playerId}`. These read/write the existing dbo.PlayerSignIn rows, not another attendance store. Existing GetSignedInPlayers, GetSignedInPlayersAsPlayers, Sign In Sheet and Scrambler continue reading those rows. There is no new schema, migration, status column or independent lock.

## Server identity and eligibility
- Cookie authentication is required; the legacy password cookie alone does not grant self-service access. Existing cookie settings and authentication implementation were not changed.
- The server reads the NameIdentifier claim, queries UsersPlayer for that actual user and verifies ownership of the viewed PlayerId. Client PlayerId is only a requested profile; it is never proof of ownership. No role bypass lets an administrator use these self routes to modify another player.
- PlayersLeagues verifies membership in the requested league.
- Existing LeagueSignInLocked and LeagueSettings.dayOfLeague provide lock/day eligibility. Missing or invalid day configuration fails closed. No new defaults/settings are persisted.
- Current date/day are computed server-side in America/New_York/Eastern Standard Time, including DST. Clients cannot choose the attendance date, record identity or lock flags. Today's existing records are queried by an Eastern calendar-date range.
- POST and DELETE have the existing SameOrigin protection. Session expiration is handled as unavailable, not as a successful sign-in or false Not Signed In.

Status is re-read after successful mutation and HTTP409. A 423 response also refreshes eligibility. Buttons are disabled while pending, and canceled subscriptions/version checks discard stale profile/league responses. No localStorage attendance state is introduced. Server status is authoritative across refresh and administrator-created records.

## Atomic duplicates and older routes
Both insert paths now use the same transaction-owned SQL application lock keyed by league/date and a serializable transaction. The existing public SignInPlayer endpoint retains its validation, date conversion, lock check, public kiosk access and response; only serialization and commit handling were added. Duplicate detection and insertion therefore share a boundary across kiosk and profile requests. No unique index or data migration is required. SQL lock timeouts surface as failed operations, never assumed success.

The existing DeleteSignInPlayer ownership/LeagueAccess checks remain. Its ordinary-player branch now also applies the same day/lock checks, preventing a player from bypassing profile restrictions through the old route. Admin/Manager/LegacyAdmin manager removal behavior remains unchanged. Existing duplicate historical attendance rows are not deleted automatically: the new self route reports administrator review when more than one matching record exists.

The public kiosk route's pre-existing frontend league-day restriction is intentionally retained rather than imposing the new self-service day rule on administrator/kiosk requests. This feature does not claim to redesign or secure every legacy public attendance operation. Administrator unlock/password storage/validation, roles, cookies, login/logout, Sign In Sheet UI and Scrambler source were not changed.

## Verification actually executed

| Check | Result |
|---|---|
| Production C# day/lock/membership/timezone policy | 6 groups passed, including invalid configuration and Eastern DST boundaries |
| Source guard assertions | 6 passed: cookie requirement, both origin guards, claim-based identity, ownership before mutations, transaction/shared serialization, and old ordinary-delete lock/day guard |
| Browser attendance workflows | 6 grouped checks passed; no page errors or real write requests |
| Existing Next Game focused browser workflows | 5 groups passed again |
| Angular development build | Passed; existing outdated Browserslist warning |
| Backend no-restore Debug compile | Passed, 0 errors / 12 warnings, including existing framework/package and running DLL/PDB lock warnings |

Browser coverage: initial status once per context, first sign-in, disabled repeated click, status refresh and direct reload, shared fixture record appearing on the existing administrator Sign In Sheet after selecting the league/refreshing, Scrambler signed-player API contract returning that record, pre-existing attendance, confirmation cancellation/own removal, 409 refresh, locked/wrong-day/nonmember/unlinked/other-profile states, simulated forged removal refusal with unchanged owner record, expired session, service failure/retry, separate league records, loading-state suppression and delayed/rapid league switching. Layouts: 1366/1920 desktop and 375/390 mobile.

All HTTP attendance mutations in the browser test are explicitly intercepted and update only an in-memory fixture. The real-write blocker remains in place for every other write. No actual API mutation reached ASP.NET, SQL or production. A forged-removal 403 fixture is a UI/transport assertion, not proof that live server authorization executed. The administrator screen used its existing league-selection handler to select the fixture league before refresh; no administrator page source was changed.

**Not executed / still requiring development integration:** actual controller authorization with real cookies and SQL records; simultaneous SQL writes across kiosk/self routes; live lock-update/removal races; real administrator sign-in/lock writes; actual Scrambler Fetch button interaction (its shared GET API contract was checked); production or live database record reconciliation. Fresh LeagueScramblerDev isolation/process authorization was not renewed or bypassed. Automated SQL session correlation is not claimed successful. Full regression suite not run.

## Required runtime checkpoint
The existing Visual Studio process locked its backend DLL/PDB. Backend compilation deliberately suppressed output copying, so the running application has not been replaced or restarted. Stop Debugging, build the existing solution normally and restart its established development profile after confirming its LeagueScramblerDev configuration. New self-service routes require that updated backend. Renew established isolation authorization before any automated mutating SQL integration tests. No synthetic database records were created or retained by this work.

## Screenshots
- [Desktop before sign-in](player-profile-evidence/attendance-before-1366.png)
- [Large desktop](player-profile-evidence/attendance-before-1920.png)
- [Mobile before sign-in, 375](player-profile-evidence/attendance-before-375.png)
- [Mobile before sign-in, 390](player-profile-evidence/attendance-before-390.png)
- [Signed in](player-profile-evidence/attendance-signed-in-mobile.png)
- [Administrator locked](player-profile-evidence/attendance-locked-mobile.png)

Screenshots contain synthetic data. Evidence: attendance-policy-results.json, profile-attendance-browser-results.json and next-game-browser-results.json in player-profile-evidence/. Build logs: artifacts/profile-attendance-angular-build.log and profile-attendance-backend-build.log.

## Files changed in this pass
- New Controllers/PlayerAttendanceController.cs: authenticated self status/add/remove.
- New Security/AttendanceRules.cs: existing day/lock rules and Eastern clock.
- New Data/AttendanceSerialization.cs: shared SQL lock helper.
- Controllers/ScrambleDataController.cs: serialized existing insert; ordinary-owner delete day/lock enforcement, manager behavior preserved.
- New ClientApp/src/app/player-attendance/player-attendance.component.ts/.html/.css.
- ClientApp/src/app/services/player.service.ts: self-service HTTP methods.
- ClientApp/src/app/app.module.ts: component declaration.
- ClientApp/src/app/player-stats-tabs/player-stats-tabs.component.html: placement below Next Game.
- tests/functional/scripts/test-attendance-policy.ps1 and extended scripts/player-profile-ui.cjs; synthetic screenshots/results, this report and WORK_LOG.md.

All prior pending work was preserved. No packages installed, SQL accessed, production/IIS/Cloudflare/deployment configuration changed, publish, deploy, commit, push or merge.

## Repeat focused checks
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/functional/scripts/test-attendance-policy.ps1
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --profile-attendance
```
The browser fixture run needs the existing local development Angular bundle and performs no database writes.
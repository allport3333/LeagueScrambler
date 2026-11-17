# Focused management CSRF remediation — 2026-11-17

**Completed final verification supersedes the blocked status below:** focused Admin/Manager tests 2 passed; one complete suite 36 passed/0 failed/2 accepted blocked; all original 34 passes re-established by exact comparison. See FINAL_VERIFICATION_REPORT.md and artifacts/runs/final-security-full. No regression/application fix was needed. Remaining historical sections preserve the implementation and earlier blocker context; do not treat them as the current execution status.

## Implemented scope and compatibility

The four prioritized actions now use the existing SameOrigin action filter, in addition to their unchanged LeagueManagement policy and existing per-league authorization checks. No password validation/storage/value, legacy unlock, cookie, role assignment, shared session behavior or logout change was made. No CORS or forwarded-header trust was added.

| Endpoint | Actual Angular service pattern | New check |
|---|---|---|
| POST /api/ScrambleData/AddNewLeague/{leagueName} | PlayerService.AddNewLeague: same-base HttpClient POST with [] | SameOrigin |
| POST /api/Statistics/UpdateTeamScores/{leagueName} | StatisticsService.UpdateTeamScores: same-base POST with {} | SameOrigin |
| POST /api/Statistics/AddPlayerToLeagueTeam?leagueTeamId=…&playerId=… | Same-base POST with {} and scalar query parameters | SameOrigin |
| POST /api/Statistics/SetTeamDivision?leagueTeamId=…&division=… | Same-base POST with {} and scalar query parameters | SameOrigin |

The base comes from the current document's base href. Modern HTTPS browsers supply Origin for these writes; Referer is accepted only when Origin is absent. Missing/null/malformed/foreign source fails closed. Normal authorized legacy-cookie requests follow the same origin rule as Admin/Manager requests; authentication is not replaced and no extra password is requested. Player permissions are not expanded: the unchanged LeagueManagement policy still excludes Player-only sessions. No Angular source/dependency change was needed.

Production scheme/Host reconstruction remains an independent compatibility gate. An HTTPS page whose effective backend scheme/host is rewritten will fail; do not whitelist aliases or trust arbitrary forwarding to avoid that. Actual production topology is not verified by the filter tests.

## Executed verification

- Existing-project backend build: `dotnet build ".\Allport's League Scrambler\Allport's League Scrambler.csproj" --no-restore --configuration Debug -p:BuildServerSideRenderer=true`: **passed, 0 errors, 10 existing warnings**. No install/restore/publish/migration was run. Existing unsupported framework/package advisories and MVC1001/MVC1004 warnings remain.
- Isolated OriginCompatibility.ps1: **90 passed, 0 failed**. Includes prior 52 host-policy checks plus attached-filter/policy checks on the four real compiled controller methods, same-origin/foreign-origin behavior with synthetic Admin/Manager/Player/LegacyAdmin principals, principal preservation, and absence of a new origin-filter attachment on frozen VerifyAdminPassword/Logout. This invokes filters only, not authorization middleware or controller/database actions. One existing CS1702 MVC patch-assembly unification warning is recorded in its compile.log.
- Focused isolation guard tests: **2 passed** (artifacts/runs/management-csrf-guards). JavaScript syntax and git diff --check passed.
- New Admin and Manager API/browser/database tests: **2 BLOCKED, 0 bodies executed**, artifacts/runs/management-csrf. Recorded immediate cause: no application listening on localhost:5001 after the required build stop. Independently, original process authorization expired at 2026-11-17T05:38:08.375Z before this pass; restarting alone will not authorize writes. No proof was renewed, edited, deleted, or bypassed. Automated SQL session correlation did NOT pass.
- Preserved previous complete baseline: **34 passed, 0 failed, 2 blocked**. This is historical evidence, NOT a post-change full-suite pass. Original test bodies/expectations remain present. Full functional rerun is NOT EXECUTED under invalid authority; original successful legacy-unlock and server-expiry blockers remain.

The existing verified Visual Studio Debug session was stopped to replace its loaded DLL during the normal backend build. It is intentionally left stopped. No application launch, SQL query/mutation, email, cleanup, production change or deployment was performed in this pass.

## Added regression coverage (implemented, not yet executed)

Two parameterized synthetic-role cases (Admin and Manager) reserve unique synthetic leagues/accounts/players through the existing fixtures. They exercise foreign, null, missing, and forwarded-header-spoofed Origin on all four actions and assert unchanged exact synthetic league snapshots after each rejection. Creation denial additionally proves the reserved target league is absent.

Positive operations use actual browser fetch with browser-generated Origin, matching current Angular URL/body conventions, and only that test's synthetic cookie. After valid league creation, the tests add a synthetic team member, update a division and recalculate a deliberately nonzero score; SQL assertions check the resulting link, division and totals. Negative assertions are meaningful because their payloads would change those records if erroneously accepted. No destructive cleanup is enabled. Missing authority blocks fixture setup before any SQL.

These tests do not claim an attacker-origin browser exploit reproduction: credential-bearing foreign-Origin rejection is modeled with API requests, and valid requests run in the actual browser. Their request/SQL assertions are not yet verified at runtime. Successful legacy-password behavior still requires a safe authorized credential or private owner-operated manual verification; never retrieve or log the shared password.

## Remaining scope

Nine routes now have scoped protection; this is not global antiforgery remediation. Other JSON management mutations (division creation, roster changes, settings/locks, score entry and scramble saves), sign-in DELETE and recovery actions still need separate review. There is no technical need to rewrite legacy password authentication to protect ordinary management actions, as this change illustrates. The explicitly frozen VerifyAdminPassword and shared Logout endpoints are left unchanged because protecting those flows would change frozen request acceptance; do not silently broaden this pass. No claim is made that every unprotected JSON action is a demonstrated browser exploit.

Deployment remains **NO-GO** pending fresh runtime/database verification and affected/full regression testing, three-administrator legacy verification, proxy/domain compatibility, session-key continuity and remaining-risk review. No claim is made that the new controls have preserved all administrator workflows at runtime until the blocked tests/manual matrix execute.

## Corrected publishing workflow

Independently inspected, with profiles untouched:

- **FolderProfile.pubxml**: Release/FileSystem → **C:\Users\Allport\Desktop\LeagueScrambler**. DeleteExistingFiles=true deletes staging output only. This is the user's normal workflow; preserve it.
- **Direct Publish.pubxml**: Release/FileSystem → C:\inetpub\wwwroot\NewLeagueScrambler. It is a distinct direct-to-IIS profile, not the normal workflow.
- **FolderProfile1.pubxml**: Release/FileSystem → C:\inetpub\wwwroot\LeagueScrambler, also distinct.

Only after explicit authorization, publish Release with FolderProfile to the existing Desktop staging directory. Inspect output and existing npm-install publish target. Before a separately approved manual production copy, back up IIS and retain a verified rollback copy; preserve production configuration/database settings, Data Protection keys and identity. Manually copy reviewed files only after that separate approval, then verify all supported domains and the three administrators' workflows. Do not use either direct-target profile as a shortcut. No Publish, profile modification, IIS copy or production operation occurred.

## Resume

1. Establish fresh development isolation authority through the existing approved mechanism; never manually extend expired JSON. Restart the existing Allport_s_League_Scrambler VS project profile and independently verify its effective localhost/LeagueScramblerDev connection and current PID/start/hash/configuration under that authority. Restarting invalidates the previous identity. Do not label SQL correlation successful unless actually proven.
2. Focused run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode mutating -TestFilter 'management CSRF' -ReportLabel management-csrf`.
3. Run existing affected league/authorization tests, then full suite when valid: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode all -ReportLabel management-csrf-full`. The suite now contains 38 tests; future expected outcomes must not be recorded as actual results.
4. Diagnose failures rather than bypass guards or weaken CSRF. Keep frozen authentication and the Desktop staging/manual-copy workflow unchanged. No commit/push/merge/deployment is authorized by this checkpoint.

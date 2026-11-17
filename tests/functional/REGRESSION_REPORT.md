# LeagueScrambler development regression report

**Historical report:** the subsequent usage-limited CSRF follow-up completed with **34 passed, 0 failed and 2 blocked**. See WORK_LOG.md for the current changes, limitations and resume instructions, and artifacts/runs/csrf-full for actual post-change results. The inventory and security findings below describe the earlier cycle; both player-list GET writes have since been removed and five ordinary account/player routes now have scoped same-origin protection. This does not remediate CSRF globally or change the frozen legacy administration system.

Generated 2026-11-17T04:47:33.633Z. Target: https://localhost:5001 and localhost SQL Server LeagueScramblerDev, Windows Authentication. No production database access, IIS/certificate/deployment change, framework upgrade, real recovery email, commit, push, merge or deployment was performed.

## Final execution results

32 distinct executed/blocked tests: **30 passed, 0 failed, 2 blocked, 0 skipped, 0 not executed**. The main full run is in artifacts/results.json; supplementary client-math checks and focused browser-claim reruns are under artifacts/runs. The newest result per test is counted once across those reports, not cumulative repetitions. Prior failing reproductions and reruns remain in artifacts/history.jsonl and WORK_LOG.md.

| Test | Status | Failure/blocker |
|---|---|---|
| manual approval is limited to process identity, local configuration and expiry | PASSED |  |
| independent runtime proof preserves restart, configuration, database and deadline guards | PASSED |  |
| local configuration and URL guards reject production and recovery | PASSED |  |
| installed Chromium launches without application access | PASSED |  |
| anonymous authentication status is false without SQL access | PASSED |  |
| anonymous home page displays registration and login | PASSED |  |
| division assignment rejects a division owned by another synthetic league | PASSED |  |
| new Create Teams batch shares one scramble number across its teams | PASSED |  |
| King/Queen standings expose distinct division code and display name | PASSED |  |
| Admin and Manager authenticate; league ownership and default settings persist | PASSED |  |
| divisions, player assignment, duplicate division rejection and roster removal | PASSED |  |
| public sign-ins enforce membership, duplicate prevention and lock/unlock | PASSED |  |
| team creation, membership, score entry, standings and recalculation | PASSED |  |
| authorized scrambles persist, King/Queen scores update and standings reflect rounds | PASSED |  |
| Create Teams saves new teams and updates existing King/Queen round scores | PASSED |  |
| Manager assignment controls settings, divisions, locks, teams and scrambles | PASSED |  |
| anonymous and Player changes are rejected with unchanged league database snapshots | PASSED |  |
| legacy password disclosure is disabled and a wrong unlock does not authenticate | PASSED |  |
| legacy administration unlock coexists with Player login and logout clears both | BLOCKED | Approved legacy test credential unavailable. The shared stored password is not read or overwritten. |
| server-side session ticket expiration and six-hour sliding renewal | BLOCKED | Server-side ticket expiry/renewal requires a controlled server clock or extended-duration run; browser cookie deletion is tested separately and is not claimed as server expiry. |
| browser registration, player creation, automatic claim, login and logout | PASSED |  |
| API registration, player creation and claiming persist exact associations | PASSED |  |
| duplicate and cross-account player claims return 409 without changing associations | PASSED |  |
| anonymous player creation is rejected with no new database records | PASSED |  |
| registration cannot overpost an Admin role or administrator flag | PASSED |  |
| invalid login issues no authenticated session or database records | PASSED |  |
| browser registration claims an existing synthetic player through matching-player confirmation | PASSED |  |
| session cookie flags, browser cookie expiry and logout remove client authorization | PASSED |  |
| public browser scramble preview runs client algorithm without SQL persistence | PASSED |  |
| standings math applies substitute limits and drops after reduction without compounding | PASSED |  |
| standings math sorts equal final scores by original totals then player name | PASSED |  |
| standings math top-player selection uses score first and Gold priority for equal scores | PASSED |  |

## Bugs discovered and fixed

1. Browser test assumed matching-player selection was always displayed. It now supports both matching and general pickers and dismisses the ordinary error snackbar using Close before Save. The complete real browser registration/create/claim/logout/login/logout workflow passed.
2. SQL assertion helper nested result arrays. Corrected test-only serialization.
3. AddPlayer accepted a LeagueDivisionId belonging to another league and returned 200. The controller now rejects the foreign/nonexistent division before writes with HTTP 400. Synthetic before/after database snapshots prove rejection is nonmutating.
4. New Create Teams batch incremented ScrambleNumber per team, splitting one round across multiple scrambles. The controller now allocates a single new number per league per batch. Multi-team grouping and resulting standings round count are tested.
5. Both King/Queen standings projections returned LeagueDivisionName as LeagueDivisionCode. Both now preserve the actual code separately from its display name; tests exercise both routes.
6. Test-only Node initially did not use Windows certificate trust. Scoped system-CA support corrected HTTPS verification without disabling TLS validation or changing certificates.

All application fixes are in Allport's League Scrambler/Controllers/ScrambleDataController.cs. They were built and tested after restarting only the existing Visual Studio project debug session.

## Functional coverage and limits

- Browser and API registration, new-player creation, claiming, login and logout; existing synthetic-player claim confirmation; duplicate/forged claims, role overposting and invalid login rejection.
- Real synthetic Admin/Manager authentication; league creation/default settings, ownership, assigned vs unassigned Manager permissions, and global Admin access.
- Divisions, player assignment/membership removal, cross-league division rejection, public sign-in, forged posted ID/lock-field handling, duplicate and outsider rejection, locks/unlocks, read-only lock status, own sign-out and denial of another player's sign-out.
- Teams, team membership, duplicate team-member rejection, team division, score entry, wins/losses/points standings and recalculation; cross-league score rejection with database checks.
- Saved scrambles, new-team batching, King/Queen round entry/update, substitution flags, standings and division labels; cross-league King/Queen score rejection.
- Public scramble preview executes the actual Angular client algorithm/button with synthetic selection state and verifies zero persistence requests and unchanged SQL snapshots. Complete league-picker UI and global real-player listing are intentionally not exercised.
- Cookie Secure/HttpOnly/SameSite flags, browser cookie expiry and logout tested. Browser cookie expiry is not server-ticket expiry. Successful legacy unlock and server ticket expiry/renewal remain blocked as documented in test results.
- Supplementary browser checks execute actual Development client standings code with in-memory synthetic values for substitute reductions/drop-lowest recalculation, tie-breaking and Gold top-player prioritization. They do not write SQL.

## Isolation and production protections

The initial user-manual confirmation and failed SQL session correlation are separately recorded. Stale authorization was observed to reject the application restart. The rebuilt application's effective Development/localhost/LeagueScramblerDev/integrated-auth environment was then independently read through Windows read-only process APIs. This is separate evidence, **not a successful automated SQL session correlation**. It retains the original authorization deadline and binds PID/start time, Debug DLL/hash, .env hash, launch profile and Visual Studio ancestry. Normal test runs cannot refresh proofs. Changed identity/configuration or expiry blocks writes.

All SQL helper targets are fixed to LeagueScramblerDev. Real-player gender-normalizing GETs are intercepted. External browser requests and recovery routes are blocked. Synthetic email/name namespaces and random run manifests avoid real-account use; exact SQL snapshots validate rejected writes. Test traces may contain synthetic secrets: keep all ignored artifacts local.

## Builds and compatibility

- Backend Debug build with --no-restore: passed, 0 errors and 10 existing warnings (unsupported netcoreapp2.2, vulnerable packages, MVC1001 Error.cshtml.cs:17, MVC1004 GetSignedInPlayers date binding).
- Angular development build: passed; Angular production/AOT/optimization build: passed. Existing outdated Browserslist data warning remains.
- Angular 7/.NET Core 2.2 and system Node 10.16.3 were preserved. Portable Node 22.23.5 and Playwright 1.51.1/Chromium are confined to the test harness. The pinned older browser is only for restricted localhost testing.

## Synthetic data inventory and cleanup

Live inventory: **48 synthetic accounts, 48 synthetic players, 9 user-player links and 44 synthetic leagues** retained across all recorded runs. Exact identities, IDs and related league snapshots are in ignored artifacts/inventory.json and artifacts/manifests. No real player/league was modified.

Safely deleted orphan synthetic User IDs: 1129, 1132, 1133, 1173, 1174. Only exact manifest-owned Player-role accounts with zero incoming references and no delete triggers are eligible, inside a serializable transaction. Linked accounts, role fixtures, players and league graphs are retained. No broad prefix deletion, truncation, migrations or restoration occurred. Cleanup receipts are in artifacts/cleanup-history.jsonl and artifacts/cleanup-orphans.json.

## Outstanding security and deployment blockers

- Cookie-authenticated mutation endpoints still need anti-CSRF protection.
- Shared legacy administration password remains plaintext in SQL; no credential rotation was attempted. Old repository secrets require independent rotation/recovery work.
- Unsupported ASP.NET Core 2.2/Angular 7/Node 10 and package vulnerability warnings remain. Upgrades require separate authorization and compatibility planning.
- First-time claiming still lacks independent proof that the registrant owns the real-world player identity. Basic in-process throttles are not distributed; legacy unlock concurrency and sign-in/claim database race protection need dedicated concurrency tests.
- Some GET handlers still write historical gender normalization. Public sign-in scheduling/date policy remains partly client-side. Password reset/session revocation and six-hour server expiry/renewal are not established by this suite.
- Existing OAuth/Zone.js peer mismatches and stale Karma/Protractor scaffolding remain outside these focused application fixes. Passing builds do not validate every feature using those dependencies.
- Production hosting configuration, migration compatibility, credentials, SMTP delivery and production behavior were not tested. **This application is not declared production-ready.**

## Files changed

Tracked application source:
- Allport's League Scrambler/Controllers/ScrambleDataController.cs

Repository-local test infrastructure (new/uncommitted):
- tests/functional/.gitignore
- tests/functional/helpers/database.cjs
- tests/functional/helpers/database.ps1
- tests/functional/helpers/fixtures.cjs
- tests/functional/helpers/isolation.cjs
- tests/functional/helpers/isolation.ps1
- tests/functional/helpers/process-identity.ps1
- tests/functional/helpers/registration.cjs
- tests/functional/helpers/regression.cjs
- tests/functional/helpers/runtime-verification.ps1
- tests/functional/helpers/safety.cjs
- tests/functional/helpers/summary-reporter.cjs
- tests/functional/package-lock.json
- tests/functional/package.json
- tests/functional/playwright.config.cjs
- tests/functional/README.md
- tests/functional/Run.ps1
- tests/functional/scripts/approve-manual.cjs
- tests/functional/scripts/cleanup-orphans.cjs
- tests/functional/scripts/cleanup-plan.cjs
- tests/functional/scripts/final-report.cjs
- tests/functional/scripts/inventory.cjs
- tests/functional/scripts/isolation.cjs
- tests/functional/scripts/verify-db.cjs
- tests/functional/scripts/verify.cjs
- tests/functional/Setup.ps1
- tests/functional/specs/integrity-regression.spec.cjs
- tests/functional/specs/league-regression.spec.cjs
- tests/functional/specs/legacy-session.spec.cjs
- tests/functional/specs/manual-guard.spec.cjs
- tests/functional/specs/readonly.spec.cjs
- tests/functional/specs/registration.spec.cjs
- tests/functional/specs/session-preview.spec.cjs
- tests/functional/specs/standings-math.spec.cjs
- tests/functional/WORK_LOG.md
- tests/functional/REGRESSION_REPORT.md (this report)

## Reuse and priorities

From the existing repository root: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode all

Use -TestFilter for focused checks and -ReportLabel for a separate local report directory. View the main HTML report with Run.ps1 -Mode report. After a restart or expiry, do not remove/disable the failed guard: independently verify the effective runtime target under valid authority. Safe orphan cleanup is opt-in; league-graph cleanup remains conservative.

Next priorities: provide an approved local legacy test credential, arrange controlled server-expiry testing, add concurrency/CSRF and identity-verification coverage, review remaining write-in-GET routes, then separately plan framework/dependency migration and production hardening. Keep all changes local until reviewed; do not publish test artifacts or credentials.

# LeagueScrambler local functional tests

This harness attaches to the existing Visual Studio application at exactly `https://localhost:5001`. It never launches, builds, or publishes the application. Portable Node 22 and Playwright 1.55.1/Chromium are test-only tools. Playwright is pinned to the first patched release for GHSA-7mvr-c777-76hp; its bundled browser must only be used for these local tests. Angular keeps its separate Node 10 build environment; see the dependency security report for targeted frontend dependency pins.

## Setup and commands

From the repository root in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Setup.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode verify
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode dbcheck
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode readonly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode isolation
```

Setup downloads an official Node 22 Windows x64 ZIP, verifies its SHA-256 against Node's published checksum, and installs only this directory's packages and Chromium. Later setup uses the recorded Node version and npm lockfile. PATH changes are scoped to the setup process. Do not run this harness with the system Node 10/npm.

## First mutating-run gate

The initial installation does NOT enable database-mutating tests. A missing approval file causes all mutating tests to be reported BLOCKED, even if all read-only tests pass.

Before granting approval:

1. Start the existing `Allport_s_League_Scrambler` profile in Visual Studio, using the project `.env` configured for localhost/LeagueScramblerDev with Windows Authentication.
2. Run `-Mode isolation`. It checks local configuration and correlates the process listening on 5001 with an existing SQL session whose current database is exactly LeagueScramblerDev. It does not query production. If no session exists or metadata permissions are unavailable, STOP. Do not bypass the guard; debugger confirmation and an alternate independent verification method need review.
3. Review the planned test writes and cleanup policy. Milestone one creates uniquely named synthetic Users, Players and UsersPlayer associations, and updates LastLogin only on its own accounts. Expanded regression fixtures also create synthetic leagues, divisions, memberships, teams, rounds, scores and sign-ins. No actual player/account is used. A home-page request is guarded against GET handlers known to write during nonmutating tests.
4. Obtain explicit user confirmation for the first mutating run. Only after that confirmation, create `.local/mutation-approval.json` containing the following (never committed):

```json
{"approved":true,"baseURL":"https://localhost:5001","database":"LeagueScramblerDev"}
```

5. The complete suite command is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode all
```

Each mutating test rechecks its live process binding. Do not change the app configuration, restart with another profile, or browse the app manually during a test run. No tests may point at production domains, another port, another SQL database, or an arbitrary base URL. SQL helpers have no caller-configurable target or arbitrary-SQL interface. Read queries are allowlisted; the only fixture writes are exact newly registered synthetic role assignment and separately invoked orphan-account cleanup in LeagueScramblerDev.

### Explicit manual verification for the current process

When the user independently confirms the RUNNING app's development database but automated SQL session correlation fails, a separately approved manual mode is available. It is never enabled by a normal test command. After explicit user approval, record the manual confirmation and milestone authorization in `.local`, then run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode approve-manual -ConfirmManualDevDatabase
```

This binds a two-hour approval to the current PID, process start time, exact repository Debug DLL/hash, project `.env` hash and launch-profile hash. It requires loopback-only listening, Visual Studio debug ancestry and the approved localhost/LeagueScramblerDev Windows-authentication settings. It rejects a different `.env` selected by output-directory probing. Restarting the app, rebuilding its DLL, or changing configuration invalidates approval. An invalid binding fails closed and cannot fall back silently. Rebinding after restart requires a new user confirmation of the running target; do not run the approval command automatically.

Reports explicitly say `MANUALLY VERIFIED; automated SQL session correlation did NOT pass`. The separate automated verifier result is not promoted to success. Process/configuration binding is checked before every mutating API/browser request as well as before each test. The launcher uses Node's system CA support to honor the existing Windows-trusted development certificate without disabling HTTPS validation. There is no production override, new SQL target, email exception, or cleanup permission in manual mode.

### Independent effective-runtime verification

`Run.ps1 -Mode verify-runtime` explicitly reads the two named configuration fields from the verified 64-bit localhost process's effective Windows environment using read-only process APIs. It never writes process memory, injects code, dumps environment contents, opens SQL, or logs a connection string. It requires Development mode, localhost, LeagueScramblerDev and integrated authentication; verifies identity/hashes before and after the read; and records a separately labelled runtime-environment proof bound to that process. The original authority deadline is preserved, never extended. The stale manual binding is not reused after a restart. Normal tests cannot create/refresh this proof, and any changed PID/start/hash/expiry blocks them until new independent verification succeeds. Reports state that effective runtime configuration was verified and that SQL session correlation did NOT pass.

On a platform where this read-only 64-bit process inspection is unavailable, verification fails closed; do not change targets or disable guards to proceed. The Visual Studio expression evaluator was evaluated as an alternative but did not provide usable managed expressions in the current frame; no positive debugger proof is claimed.

## Milestone one

- Browser registration -> new player -> automatic claim -> logout -> login -> logout.
- API registration, profile creation/claiming, Player role and login/logout.
- Duplicate same-account and other-account claims: 409 and unchanged associations.
- Forged claim user ID: 403 and unchanged associations.
- Anonymous profile creation: 401 and unchanged synthetic-record snapshot.
- Nonmutating configuration/URL guard verification, browser launch, anonymous auth status, home-page controls.

The player-picker `ScrambleData/GetPlayers` response is intercepted with an empty array in browser tests. Both versions of that legacy GET normalize Gender values and save existing players, which would violate the prohibition on touching actual players. All registration, creation, claim, login and logout calls are real. The matching-player claim test uses a real lookup of its own synthetic player, but the complete real player-directory listing is NOT covered end-to-end. Milestone-one mutation requests are allowlisted to five endpoints; separately authorized regression fixtures have an explicit additional endpoint allowlist restricted to synthetic league-name paths.

Expanded regression coverage: synthetic Admin/Manager authentication and league ownership, settings, divisions, player membership, public sign-in/duplicate/lock rules, team scores and recalculation, saved scrambles and King/Queen rounds, assigned/unassigned Manager authorization, anonymous/Player write rejection with database snapshots, cookie flags and browser-side cookie expiry, plus public scramble preview. The preview test supplies synthetic selection state via Angular's Development debug API and clicks the real preview button; it does not claim to cover the league-selection UI. Server-side cookie expiration and successful legacy unlock remain explicitly BLOCKED without a test credential and controlled clock/extended run.

Synthetic Admin/Manager role fixtures update ONLY the exact new User ID + random email + first/last names, initially at Player role. They do not edit existing real users or create administrator credentials in source control. Expanded tests require `development-regression` authorization on the already valid process binding; expanding scope never extends its expiry or changes its PID/start time.

Optional successful legacy-unlock coverage reads `.local/legacy-test-credential.json` only if the user supplies an approved test credential. That file is ignored, and tracing is disabled for this test so the shared secret is not captured in network traces. Without it the test reports BLOCKED; it never reads the stored password from SQL or replaces it. Server ticket expiry/renewal is a separate BLOCKED test, distinct from the executed browser-cookie-expiry test.

## Diagnostics and reports

`artifacts/html/index.html`, `artifacts/results.json`, and `artifacts/summary.md` report executed results and blocked reasons. Failure screenshots and traces are in `artifacts/results`. Browser page errors include stack traces; HTTP diagnostics record method/path/status without request bodies or cookies. Expected negative HTTP statuses are checked by their tests and are not automatically failures. Playwright traces can contain SYNTHETIC passwords/cookies and page content: keep all artifacts local, do not upload them, and never use real credentials.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode report
```

Reports/tools/browser cache/manifests/local approvals are gitignored. Single worker, no retries, and run-unique identities avoid collisions and uncontrolled repeated writes. Failed tests remain failed; no application code is patched by the runner.

The launcher archives the preceding JSON/Markdown/HTML report and results directory before a new run replaces them. `-ReportLabel standings-math` writes a separate report under `artifacts/runs/standings-math`, keeping supplemental checks apart from the main run. `artifacts/history.jsonl` records historical results. After `Run.ps1 -Mode inventory`, use `Run.ps1 -Mode final-report` to regenerate REGRESSION_REPORT.md and the machine-readable final summary. The report generator counts the newest result per test once across main and supplementary reports.

## Cleanup: exact orphan accounts only

Each mutating test records its reserved synthetic identity before writes and records exact database IDs after successful calls and in teardown. Passwords are not saved in the manifest. Failed partial runs can leave records; DO NOT delete by prefix, reset tables, or restore a database automatically.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\Run.ps1 -Mode cleanup-plan -Manifest .\tests\functional\artifacts\manifests\EXACT_RUN_ID.json
```

`cleanup-plan` previews exact identities/IDs and refuses mismatches. It NEVER deletes. Players, linked accounts, Admin/Manager fixtures and all league graphs are retained. Existing unclaimed profiles must not be adopted by the suite. Unique names and pre-insert absence checks prevent reuse.

A narrowly scoped orphan-account cleanup is implemented under the user's standing authorization. Preview with `Run.ps1 -Mode cleanup-orphans`; execute with `Run.ps1 -Mode cleanup-orphans -ExecuteCleanup`. It requires valid process isolation, reads only manifest-recorded identities/IDs, excludes every manifest containing leagues, and accepts only Player-role accounts with no profiles or associations. The database independently verifies exact ID/email/names/role, rejects active User delete triggers, locks and checks EVERY incoming foreign key, and deletes one exact row in a serializable transaction only when all reference counts are zero. Any uncertainty aborts. It never deletes players, league records, role fixtures or related graphs. Results are recorded in ignored `artifacts/cleanup-orphans.json`.

To inventory retained synthetic records without deleting anything, run `Run.ps1 -Mode inventory`. It reads only identities in local run manifests and writes `artifacts/inventory.json`.

## Limits

Read-only runtime inspection is independent of mutation permission: `Run.ps1 -Mode verify-runtime` invokes the existing process-memory reader with `-ReadOnly`. It checks the current VS Debug identity/configuration before and after reading only the named runtime settings, and records sanitized `.local/runtime-process-inspection.json`. This inspection has no authorization scopes/expiry, explicitly grants no mutations, and cannot refresh or replace `.local/runtime-process-verification.json` or the mutation approval. Existing mutation guards still require separately valid, process-bound authorization. Do not describe independent runtime evidence as a new personal/manual database confirmation or successful SQL session correlation.

Administrator/deployment audit: see [ADMIN_COMPATIBILITY_AUDIT.md](ADMIN_COMPATIBILITY_AUDIT.md), [STATE_CHANGING_ENDPOINTS.md](STATE_CHANGING_ENDPOINTS.md) and [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md). These distinguish public HEAD observations, source inference and actual test execution. No deployment is recommended yet; shared legacy authentication/session/logout behavior remains frozen.

To exercise the existing compiled origin filter without launching a web host or connecting to SQL, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\functional\OriginCompatibility.ps1` from the repository root. This compiles a single isolated console entry point against the already installed .NET 2.2.7 shared runtime and existing Debug app DLL, not a new project. No packages are restored/installed. All production hostnames are in-memory test strings only. The 90 policy/attachment/principal checks do not verify IIS/Cloudflare middleware, actual production origins or administrator authentication. Evidence/hashes/results and compiler logs are in ignored artifacts/origin-compatibility. One CS1702 MVC assembly-reference unification warning is expected with the installed shared-runtime patch; execution succeeded. The script refuses missing runtime/build or newer filter source. This audit's initial test-runner compile attempts hit command-length/native-reference issues; the runner now uses a response file and managed assembly references, and its final run passes.

### Scoped same-origin protection (2026-11-17)

Ordinary register/login, ClaimPlayer, AddPlayerWithoutLeague, public SignInPlayer, AddNewLeague, UpdateTeamScores, AddPlayerToLeagueTeam and SetTeamDivision now require a same-origin Origin header, or a same-origin Referer if Origin is absent. Missing/null/malformed/foreign origins are rejected with 403. Origin comparison includes scheme, host and port; Origin takes precedence over Referer. Nonbrowser API clients must supply these headers. The API fixture supplies the exact localhost Origin; negative CSRF tests explicitly vary it under the same isolation guard. Browser tests use real browser-generated headers.

This is intentionally scoped, not a global CSRF fix. Frozen legacy password verification, its cookie, shared logout and management authorization policies are untouched. Four management methods gained only the origin filter. Their final Admin/Manager browser/SQL tests passed, followed by one complete suite with 36 passed/0 failed/2 accepted blocked and all original 34 passes re-established; see FINAL_VERIFICATION_REPORT.md. Existing browser JSON/preflight protections are not a substitute for reviewing every endpoint. Both public GetPlayers routes now normalize Gender only in their response, without SaveChanges. The global directory stays intercepted in browser tests to avoid exposing real data; SQL persistence checks use synthetic league fixtures only.

The approach follows [OWASP origin verification guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#verifying-the-origin-with-standard-headers). No CORS expansion is permitted without revisiting this protection. Focused results: artifacts/runs/csrf-focused; complete follow-up results: artifacts/runs/csrf-full. See WORK_LOG.md for the current checkpoint and resume restrictions.

Live SQL correlation proves the observed application's development session, not every possible connection made by arbitrary modified code. Configuration checks plus source inspection and strict test-only SQL targets supplement that evidence. Manual verification is always labelled separately and does not claim successful SQL correlation. No schema migration, database creation, production read/write or email delivery is part of this harness. SQL metadata checks may require additional read-only permissions. A stopped server is BLOCKED, never a passing app test. App API getters not on the nonmutating allowlist are blocked in read-only browser runs because legacy GET handlers can write data. Safe orphan-account deletion is the only enabled cleanup operation.

# Modernization worktree: build, test and resume

Use `C:/Users/Allport/source/repos/LeagueHub-modernization`, branch `feature/framework-modernization`. Read STATUS.md first for the authorized IIS staging recovery and current blockers. Preserve master, all source changes, ignored recovery archives and portable runtimes. Production deployment and Git publication are outside the staging authorization.

## PowerShell toolchain

Run from the worktree root. The installed system Node/.NET tools are legacy; use the portable versions explicitly. Use npm.cmd to avoid machine PowerShell script-signing policy affecting npm.ps1.

```powershell
$env:PATH = (Join-Path (Get-Location) 'tests/functional/.tools/node-v22.23.5-win-x64') + ';' + $env:PATH
$migrationDotnet = Join-Path (Get-Location) 'tests/functional/.tools/dotnet10/dotnet.exe'
& $migrationDotnet --version
node.exe --version
```

Expected SDK 10.0.404 and Node 22.23.5. The frontend uses Angular/Material 22.3.0, TypeScript 6.0.3, RxJS 7.8.2 and Zone 0.16.3. All framework migrations are complete.

## Builds

```powershell
Push-Location "Allport's League Scrambler/ClientApp"
npm.cmd ci
npm.cmd run build                         # plain development build; no named development configuration
npm.cmd run build -- --configuration=production
npm.cmd test -- --watch=false
Pop-Location
& $migrationDotnet build "Allport's League Scrambler/Allport's League Scrambler.csproj" -c Release
```

Do not unnecessarily rerun these accepted checkpoints. Save new logs under a distinct modernization artifact name. Final Angular unit suite has 24 tests; limited unit coverage does not replace the browser/business suites. `npm.cmd run lint` currently fails with 314 existing errors and 6 warnings; do not call it passing or mass-format unrelated source.

## Local running

For Visual Studio 2026 Insiders, use the `Allport_s_League_Scrambler` project profile at `https://localhost:5001`. Put the following line in the ignored `Allport's League Scrambler/.env` next to `Startup.cs`. Restart the debug session after editing it. Startup loads this file into the application process.

```dotenv
LEAGUESCRAMBLER_DB_CONNECTION=Server=localhost;Database=LeagueScramblerDev;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;
```

This connection uses Windows authentication and trusts the SQL certificate for local loopback development only. Start a fresh Insiders instance from a PowerShell session prepared with the Node 22 PATH above if Visual Studio inherited the system Node 10 PATH. From that session, run:

```powershell
$insiders = 'C:/Program Files/Microsoft Visual Studio/18/Insiders/Common7/IDE/devenv.exe'
& $insiders (Resolve-Path "Allport's League Scrambler.sln").Path
```

After F5, the home page should load through Angular CLI and `GET /api/ScrambleData/GetLeagues` should return HTTP 200. The Development host was verified on an isolated loopback port with those checks and no database writes.

The normal backend still uses Startup and serves the SPA on the same origin. Set safe Development configuration externally before starting; never copy production secrets or print a connection string. `LEAGUESCRAMBLER_DB_CONNECTION` must identify the verified local Development database for migration tests. SMTP must use local pickup for test sends. Never start mutation tests without the fresh scoped approval in INTEGRATION-APPROVAL.md.

The Development SPA source path is resolved from the application's content root, rather than the caller's current directory. `npm.cmd start` runs `ClientApp/tools/start-angular.cjs`, which forwards options to the installed Angular CLI, checks that the requested port is free and announces the old SpaServices readiness marker only after a real HEAD response succeeds. The existing .NET 10 SpaServices package still expects that old marker; Angular 22 does not emit it itself. No production runtime or generation behavior is changed. A small parent-lifetime check plus private IPC handles Windows npm/cmd intermediaries exiting without forwarding signals. The forced-parent-exit fixture and final actual Development startup/shutdown pass: both tracked processes exited automatically. Earlier failed stdin/IPC-only attempts are preserved in logs; their code is superseded. Never kill unrelated Node processes.

The isolated verified read integration runner starts the real Startup/Kestrel on **https://localhost:5443**, with guarded local SQL, artifact-only synthetic cookies/key ring, local SMTP pickup and a tool-only write filter. Run it from the repository root using a **new** artifact directory:

```powershell
& $migrationDotnet build tools/modernization/IntegrationCheck/IntegrationCheck.csproj -c Release -o tests/functional/artifacts/modernization/net10-integration-bin
# The env path is the already verified existing Development file; never print its contents.
& $migrationDotnet tests/functional/artifacts/modernization/net10-integration-bin/IntegrationCheck.dll '<verified Development .env path>' tests/functional/artifacts/modernization/http-next --serve
```

`--serve` tests the production browser bundle and holds the host up for at most 15 minutes. `--development` tests the actual CLI proxy instead. A `stop-request` file inside that specific run directory requests graceful shutdown. Do not terminate unrelated processes. In another terminal, set PLAYWRIGHT_BROWSERS_PATH to the existing browser cache and run `node.exe tools/modernization/real-browser.cjs <run-directory>`. This runner does not intercept APIs. Without a database-backed synthetic account it deliberately tests only public browser routes; its offline synthetic cookie API checks do not establish real login/persistence. The existing guard correctly rejects a non-account browser identity.

## Read-only parity and fixture modes

Build UiEmailCheck from current source, then run `--query-snapshot <verified-env> <new-output-json> <legacy-query-results.json>` against the preserved 29-query baseline. Set LEAGUE_QUERY_SEARCH_ONLY=1 only for the separate four-search legacy baseline; remove it afterwards. Snapshot output cannot overwrite earlier evidence and contains hashes/statuses, not payloads or secrets. `HistoryCheck` independently checks 1,966 teammate pairs against saved memberships. PlayerImportCheck's `--fixtures <new-output>` performs four no-SQL JSON/controller groups. Its normal mode and ScheduleCheck's normal mode are mutation runners and retain fresh approval gates.

UiEmailCheck's default mode takes a new output directory and the preserved legacy synthetic-cookie-fixtures.json path. It verifies actual SMTP pickup HTML/plain MIME, reset expiry/origin, Unicode PBKDF2, cookie compatibility and declared API inventory. It does not itself consume persisted reset tokens or send to real users; the authorized HTTP suite tests actual consumption on synthetic accounts. Legacy tool binaries/runtime artifacts are preserved for old-framework comparisons; do not attempt to load an EF 2 backend into a net10/EF 10 tool merely by changing BackendAssemblyPath. That override is for compatible isolated assemblies.

## Authorized account-backed testing and recovery

The user granted Development read/write authority on 2026-11-22. DEVELOPMENT-AUTHORIZATION.md is the persistent grant; do not request it again. Actual account-backed HTTP/browser/persistence/reset tests have passed. Run them again only for a relevant change, with a new run name:

```powershell
& $migrationDotnet build tools/modernization/IntegrationCheck/IntegrationCheck.csproj -c Release -o tests/functional/artifacts/modernization/net10-integration-bin
node.exe tools/modernization/run-authorized.cjs authorized-next-check
# Only after an interrupted run, recover its exact ID journal:
node.exe tools/modernization/run-authorized.cjs authorized-next-check --cleanup
```

The wrapper binds the verified existing Development env path, uses the portable .NET executable and writes native stdout/stderr directly to a new artifact log. This avoids PowerShell Stop-on-NativeCommandError aborting finally-cleanup during intentionally failed SMTP tests. It does not weaken actual API authentication. `--authorized-development` runs the real Startup/Kestrel with guarded Development SQL, real synthetic accounts, separate Data Protection keys and local pickup; no API interception. Secrets/cookies go to Playwright via stdin, not command arguments/files. `--cleanup-authorized` rechecks the grant/target/ownership and cleans only saved fixture IDs. See DATABASE-CHANGES.md for the recovered interruption and final table fingerprints.

PlayerImportCheck and ScheduleCheck retain their old approval modes and additionally recognize `--modernization-authorized` as the first argument, invoking the shared persistent-grant/target check. They are actual SQL/controller suites, complementary to the real HTTP browser suite. The legacy WW seeder was built but not run because it intentionally changes the established test league. No table-creation migration was executed.

## Next gate

Local framework and regression acceptance is complete at `checkpoints/net10-authenticated-accepted`. The dedicated IIS staging site serves that accepted package over HTTPS. Follow STAGING-AND-ROLLBACK.md to verify the worker's SQL identity and complete account-backed acceptance. Preserve the accepted ZIP and recovery artifacts when packaging the visual restoration.

## Run the focused Development SQL authorization checks

Run this in the Windows PowerShell session that connected successfully. The executable uses the existing guarded Development configuration and authorization. It verifies the actual database and local machine over shared memory before taking fingerprints or seeding fixtures. The private Kestrel host uses loopback port 5443 and an ephemeral TLS certificate.

    dotnet run --project 'C:\Users\Allport\source\repos\LeagueHub-modernization\tools\modernization\IntegrationCheck\IntegrationCheck.csproj' -c Release -- --verify-team-development

Expect a PASS, one HTTP 200 and one HTTP 409 for competing assignments, and identical before and after database fingerprints. The console prints the evidence directory under tests/functional/artifacts/modernization/authorized-team-*/. HTTP results and cleanup are in http/authorized-results.json. The run summary is integration-summary.json. Avoid unrelated Development writes while the fingerprints are being taken. Identity counters can advance normally as fixtures use generated IDs.

An explicit Development .env path may follow --verify-team-development. To recover an interrupted run, pass that path followed by the exact authorized-team-* run name. Recovery rechecks the target, consults the original journal and baseline, and cleans up the owned fixtures. Headless browser fixture evidence is recorded separately.

# Framework modernization checkpoint

## Team Management and dark themes

Team Management now uses a division and team selector, a linked roster, a compact New Team dialog, and the shared player browser for immediate assignment of enrolled league members. The existing membership endpoint verifies league enrollment, team ownership and same-team membership before inserting. The team membership model permits assignment to more than one roster. There is no team-only removal endpoint, and no schema change was needed.

The Dark Navy and Charcoal pass updated shared action and table tokens and corrected local surfaces in team cards, standings, matchups, attendance, player links, schedule administration, install instructions and other routed screens. Classic Light component colors remain the styling fallback. See DARK-THEME-AUDIT.md and RESULTS.md for evidence and verification limits.


## Division schedules, loading, appearance and league creation

Weekly matchups are grouped by the division reported by the schedule API. The week selector, adjacent arrows, Current Week and Full Schedule controls share a compact responsive toolbar.

The shared page loading component coordinates initial reads across league views, player views, the Scrambler, score entry, management and attendance. Read failures show an error where the page previously could remain loading or show an empty table. Schedule, team data and dashboard refreshes retain settled content where supported.

Account > Appearance offers Classic Light, Dark Navy and Charcoal. The browser saves one appearance for the site, including guest sessions and the installed PWA shell. The saved appearance is applied at startup. Account profiles have no existing preference storage, so this checkpoint does not add cross-device account synchronization or a database schema change.

Create League is a dedicated Admin and Manager tab. Successful creation refreshes the league list, selects the returned league and opens its League Setup. The management service retains the active league for the browser tab when the current user still has access. League Setup contains Add Division and the Admin-only manager assignment form.

The Development SQL read-only probe failed while connecting with Windows Integrated authentication. Local build, browser and service-worker evidence is documented in RESULTS.md. This checkpoint made no database writes or deployment.

## Automatic PWA updates, homepage, and League Setup

The previous PWA checked on reconnection and at six-hour intervals, and a downloaded version still required explicit refresh. Its worker already excluded API data. The current source checks after registration, on foreground entry and reconnect, and every 15 minutes while visible. It reloads a complete version at the current URL after any drafts clear. Visible league data refreshes on resume and reconnect. API responses use `no-store`; fingerprinted bundles retain efficient caching.

The homepage now uses a four-column score table and a two-line matchup grid. League Setup has compact upper forms and full-width manager access with centered controls. Both were exercised with synthetic fixtures. See RESULTS.md for verification and the local evidence paths.

## Role-based administration and focused UI cleanup

The modernization source uses the normal account session for league administration. `Users.UserRoleId` refers to `UserRoles.UserRoleId` and identifies Admin (1), Manager (2), and Player (3). `UserLeagues` maps a Manager's `UserId` to each managed `LeagueTypeId`. `UsersPlayer` remains the account-to-player-profile link. The historical `IsAdmin` database column remains for compatibility. Effective access comes from the role relationship and current league assignment.

The separate administration password and cookie have been retired. An Admin can manage every league and grant or revoke league access for an existing Manager. A Manager can manage assigned leagues and create a league. League creation, default settings, and the creator's assignment commit together. Players keep their existing viewing and account workflows. The database schema is unchanged.

The current build contains the Scrambler roster disclosure and mobile action menu, guided Team Configuration, and compact Team Scores controls. See RESULTS.md and VISUAL-REGRESSION.md for evidence. Account-backed integration remains pending because both shared-memory and TCP connections to local Development SQL failed during Windows authentication with an SSPI error. This checkpoint made zero SQL writes and no IIS deployment.

## Visual restoration and staging authentication investigation — 2026-11-22

Source changes cover compact shared Material controls and notifications, inline login feedback, Team Scores sizing, Scrambler roster layout, scrollable management and dashboard tabs, standings filters, and profile history spacing. The master comparison, existing evidence and new before captures are indexed in VISUAL-REGRESSION.md. The changes leave scoring and scramble generation logic intact.

IIS now responds at `https://127.0.0.1:8086/` with certificate validation using the machine trust store. Read-only probes separated request validation from credential rejection. Empty JSON produced `Invalid login data` and a populated synthetic unknown-account request produced `Invalid email or password.` The league collection returned HTTP 200, demonstrating a database-backed read through IIS. The staging administrator journal records a successful IIS commit. The worker's exact SQL identity and selected database still require confirmation before any fixture writes. The previously reported account's response body and a successful account-backed IIS session remain unverified.

Development and production builds passed using a temporary drive path to the same worktree, which avoided esbuild's need to enumerate a restricted parent directory. The drive was removed afterward. All 24 unit cases passed with a single Vitest worker. The verified 92-file release ZIP is in `tests/functional/artifacts/modernization/visual-restoration/handoff-release/`. IIS continues to serve the previously accepted build. Deployment needs elevated staging write access. Positive login, cookie, role and recycle verification also need the worker identity check and a run-owned Development account. See RESULTS.md and STAGING-AND-ROLLBACK.md.

## Administrator setup prepared — 2026-11-22

`Set-LeagueHubStaging.ps1` provides read-only preflight and explicit `-Apply` for dedicated IIS and Development SQL configuration. The PowerShell parser, IIS API signatures, 24-table allowlist comparison and rollback journal replacement passed local checks. The local PowerShell policy is `AllSigned`, which rejected invocation of the unsigned script. Use an approved code-signing certificate before running it under that policy. Administrative preflight and Apply remain pending. See STAGING-AND-ROLLBACK.md for commands and rollback.

## IIS staging recovery — 2026-11-22

**Staging serves HTTP and is blocked on administrative access for HTTPS and authenticated acceptance.** The user explicitly authorized work on `LeagueHub Staging`, `LeagueHubStagingPool`, and local `LeagueScramblerDev`. The earlier local acceptance below remains valid.

- Before this continuation, the staging directory already held the accepted 92-file package, and the ASP.NET Core Module application event recorded successful startup there at 11:32:35 a.m. Eastern. The checkout already had edits to README.md and STAGING-AND-ROLLBACK.md. The exact operator and timing of individual IIS changes could not be established from accessible evidence.
- This continuation verified the ZIP SHA-256 and all 92 manifest entries after a fresh extraction. The loose package still has a different `web.config`. The live staging tree matched every manifest entry, with zero extra files. A separate hash-verified backup of all 92 live files, the root ACL listing and verification report are under `tests/functional/artifacts/modernization/iis-staging-resume-f4dc3339/`. No replacement copy was needed.
- Actual IIS requests at `http://127.0.0.1:8085/` returned 200 for the Angular shell, main bundle, web app manifest, worker script and worker metadata. A same-origin empty JSON login returned the expected application-generated HTTP 400, `Invalid login data`. This confirmed routing and validation. The prior login failure with populated fields remains undiagnosed. Full browser workflows, cookie issuance and persistence, and PWA lifecycle remain pending on IIS.
- HTTPS at `https://localhost:8086/` refused the connection. The TCP listener appeared as `0.0.0.0:8085`; administrative inspection of the actual IIS bindings is required to establish loopback-only access. Installed shared runtimes include .NET/ASP.NET Core 10.0.15 and ANCM V2 is installed. The staging pool identity has read/execute on the directory. The dedicated pool's state, identity settings, profile loading, effective environment and IIS access logs could not be read in this session.
- The deployed `web.config` contains no environment overrides, and no `.env` was found in the deployment tree or checked ancestor paths. The staging worker's effective SQL target was not verified. Direct integrated read-only probes to `localhost / LeagueScramblerDev` from the current session failed before query execution with TLS/SSPI errors. No SQL writes, fixtures, production operations, or external email were performed in this continuation.

Resume from STAGING-AND-ROLLBACK.md with a session that can administer the dedicated staging site and validate Windows-integrated Development SQL access. The current managed session has a non-elevated token, cannot read IIS configuration, and has workspace-only write access. Staging authenticated and functional acceptance is still pending.

## Accepted local modernization checkpoint — authenticated Development integration, 2026-11-22

**Current phase:** framework implementation and local acceptance are complete; the package is prepared for **controlled staging verification**, conditional on server prerequisites and a separate deployment authorization. **Production deployment is not recommended before staging acceptance.** No commit, push, merge, deployment, production access/configuration change or IIS operation occurred. All source remains uncommitted on `feature/framework-modernization`, HEAD `85cf8a3bcfe827ea59a785f05f9fc9aa77c2b420`. Original master tracked files remain unchanged at `0d30bc9`; its existing untracked `.angular/` cache was left untouched.

### Exact versions

Angular Core/CLI/build/Material/CDK/Service Worker **22.3.0**; TypeScript **6.0.3**; Node **22.23.5**; RxJS **7.8.2**; Zone **0.16.3**. Main backend and active verification projects target **net10.0**, SDK **10.0.404**, ASP.NET Core / EF SQL Server / MVC Newtonsoft integration **10.0.15**, Newtonsoft.Json **13.0.4**. NgModules, Zone/eager change detection, XHR/DI interceptors, existing routes and custom cookie accounts remain. No IdentityServer or replacement account database was introduced.

### Authorization and database outcome

Development read/write authorization is **granted and persists for this project**, including synthetic accounts, tokens, leagues, players, memberships, games, scores, scrambles and cleanup. See DEVELOPMENT-AUTHORIZATION.md, grant `leaguehub-modernization-development-2026-11-22`. **Do not request it again.** Each runner verifies localhost/LeagueScramblerDev, Windows authentication, actual SQL machine identity and compatibility 130 before writes. No production/IIS/deployment permission is implied.

All owned fixtures were removed, including an interrupted run recovered from its saved ID journal. `accepted-final-data-integrity.json` confirms **24 tables, zero checked data/count/column differences, identical FK metadata** versus `authorized-development-before`, after the final current-source reruns. Sensitive credential values were not exported; account operations targeted only inserted fixture IDs. Identity sequences advanced normally and were not reseeded. No schema migration/table creation was performed. The detailed per-run ID/cleanup journal is `authorized-database-change-journal-final.json`: **22 run/report records, zero unresolved cleanup**. Final direct reports are accepted-player-results.json / accepted-schedule-results.json and also confirm cleanup.

### Actual integration and fixes

- PlayerImportCheck actual SQL/controller persistence **passed**: bulk/single membership addition, concurrent duplicates, divisions/No Division, global names, profile creation/duplicate detection, IDs/history/other-league preservation, invalid/stale/unauthorized rejection and owned cleanup.
- ScheduleCheck actual SQL/controller persistence **passed**: 80-game season, later-period additions using identical team IDs/week labels, real conflicts/duplicates, scored-game protection, division/date-scoped replacement, events, edits and cleanup. Only test assertions needed local ID lists materialized before their EF expressions; generator rules did not change.
- Final actual account-backed HTTP run: **59 recorded checks / 64 requests**, plus **113 browser API requests / 11 browser groups**, with no API interception. Real registration/login, elevated-role prevention, Admin/Manager/Player/anonymous boundaries, manager league scope, same-origin checks, secure cookies/logout, membership/profile edits, 80-game save, three Scrambler creation/finalization paths, saved membership/scores/modifications, created-team score updates, recovery MIME/send rollback, token consumption/replay and five concurrent reset pairs passed. The browser generated and saved **16 additional games** on later dates (80 → 96), immediately added a player to Silver, edited the name, explicitly confirmed removal, then TXT-imported the same player ID to Gold. Seven actual browser-modal widths: 375/430/768/1280/1920/2560/3440. Screenshot source: `authorized-atomic-reset-acceptance/browser/`.
- Fixed the **EF 10 UserRoles shadow FK** by mapping the existing UserRoleId relationship. SQL error 207 and before/after metadata were captured; the preserved EF 2 model has no shadow field. No column/schema change.
- Replaced unsupported `DefaultIfEmpty(0).Max()` with nullable SQL MAX/coalesce for empty/nonempty scramble-number allocation. Explicitly retained legacy client grouping for league-filtered saved-scramble lists. Final legacy comparisons: **29 queries + 2 retrieval lists**, zero differences; four autocomplete fingerprints also passed.
- Preserved legacy password hashing/IDs/cookies. Fixed nullable-token delivery rollback with typed SQL parameters. Concurrent testing reproduced two successful resets using one token; atomic token-checked UPDATE now gives **exactly one 200 and one 400 in each of five pairs**, updating only password hash/salt/token. Expiry, encoding, roles and account identity remain unchanged.
- Fixed long-league-name player-browser header shrinking/wrapping; button grid rules unchanged. Final production Angular rebuild, unit cases and actual responsive browser checks passed.
- Development CLI source-path/readiness/private-IPC/parent-lifetime compatibility fixes retain the normal startup workflow. Prior actual 40-check Development startup and automatic process shutdown passed; final plain development compilation also recorded separately. No unrelated processes were terminated.

### Final verification and artifacts

- Frontend production build: `angular22-authorized-build.log`, bundle `angular22-authorized-dist/browser`; plain development build: `authorized-final-development-build.log`. **24 tests / 18 files passed** (`authorized-final-unit.log`). Existing lint debt remains **314 errors / 6 warnings**, not passing; previous measured unit coverage **14.51% lines**. No current compiler/runtime regression remains in the executed acceptance suites.
- Business regression: **4,000 Scrambler cases**, **17 schedule groups / 1,000 simulations**, **72 K/Q combinations**, **35 TXT/CSV/XLSX/XLS/parser/security checks**. Business engine sources remain identical to 0d30bc9. Prior complete print parity and other focused UI evidence remain valid; no expensive 954,000-case rerun was needed for unchanged engines.
- Actual final production worker: **8 groups passed**, including network-only APIs, safe offline behavior, version update/input retention and print PDF. Native-device installation/printing still require device QA.
- Final email/crypto/API inventory: `authorized-atomic-final-email/`, **7 controllers / 86 actions**, hash **9A64274A3AB42F36C9D14D4DE77F92B743AA3A34829B910ED9F1AEFE8605AB81** unchanged. Legacy Unicode PBKDF2, old synthetic cookie formats, trusted origin/encoding/expiry and actual local pickup HTML/plain sender pass. No external email sent. Run-owned pickup messages containing actual synthetic tokens were removed.
- Full/prod frontend npm, functional tools, backend and active tool NuGet audits report **zero known vulnerable packages**; npm tree has no peer mismatches. Final read-only GitHub snapshot contains all 11 alerts: four remain remotely open until an authorized push/rescan; no alert dismissed/changed. See SECURITY.md.
- Latest local package: **`tests/functional/artifacts/modernization/staging-package-accepted/`**, **92 files**, net10.0 runtimeconfig/generated IIS web.config, no .env/node_modules/tests/tools/.git content. Tested DLL and final browser shell hashes match. Evidence: `authorized-accepted-package-verification.json`, `authorized-accepted-package-manifest.json`, `authorized-accepted-publish.log`. Never deploy older package folders by mistake.
- Review ZIP: `leaguehub-angular22-net10-staging-review.zip`; size/SHA256 and verified 92-file archive structure are in staging-review-archive.json / staging-review-archive-verification.json. Parser fixture startup now closes its preview server on browser-launch failure (bounded negative test passed); the K/Q parity helper creates its selected output directory. These are tooling cleanup fixes, not business changes.

### Remaining staging decisions / safe resume

1. Read RESULTS.md, DATABASE-CHANGES.md and STAGING-AND-ROLLBACK.md. No framework migration or accepted test run is currently pending. Do not restart Angular upgrades or recreate fixtures just to resume.
2. Before a separately authorized staging deployment, verify supported Windows/IIS, .NET 10 Hosting Bundle 10.0.15+ / ANCM, dedicated HTTPS hostname/app pool, external configuration, valid SQL TLS certificate, persisted Data Protection keys/discriminator, ACLs/logging and backup/rollback package. **No server/IIS inventory or deployment was performed.** No database schema migration is required by this checkpoint.
3. Run staging smoke tests with approved synthetic identities, including actual IIS cookie/session behavior, update/rollback cache transition, native install/printing and a designated SMTP test only if separately authorized. Legacy cookie format is compatible; real IIS key/discriminator/session carryover is not established, so plan for renewed login while preserving accounts/passwords.
4. Retain existing lint debt and legacy PBKDF2 strengthening as documented follow-up work; do not mass-format or silently change stored password formats. Vendor parser/OS/runtime advisories require ongoing review beyond package-manager audits.

Recovery: `checkpoints/net10-authenticated-accepted/` is the final named source recovery snapshot. Preserve all earlier checkpoints, baseline binaries, migration logs and test artifacts. The older sections below are historical and their pending-approval statements are superseded by this accepted checkpoint and the user's explicit grant.

## Authorized Development integration in progress — 2026-11-22

The user has now explicitly authorized local **LeagueScramblerDev** reads/writes, synthetic accounts/players/leagues/memberships/schedules/scores/scrambles/tokens and owned cleanup for modernization. See DEVELOPMENT-AUTHORIZATION.md, grant `leaguehub-modernization-development-2026-11-22`. **Approval is no longer pending; do not ask again.** Local DB_NAME/machine/Windows-auth/compatibility guards run before writes. Production/IIS/commit/push/merge/deployment remain unauthorized.

Completed this continuation: captured fresh 24-table baseline (`authorized-development-before`); modernized approval gates in PlayerImportCheck/ScheduleCheck; **player persistence runner passed with cleanup**; **schedule persistence runner passed with cleanup** (80 later-season games, conflicts/replacement/score protection/events). Schedule runner needed precomputed local ID collections instead of unsupported closure expressions in its assertions; application scheduling rules did not change.

Actual HTTP account tests now exercise real registration/login, admin/manager/player/anonymous permissions, manager league scope, secure cookies, same-origin rejection, membership/profile edits, 80-game schedule save, Scrambler allocation/finalization/retrieval/modification/scores and reset send/consume/replay/new-password login. Intermediate runs discovered and corrected: (1) EF 10 inferred nonexistent `UserRolesUserRoleId`; explicit FK mapping now matches the existing database's `UserRoleId`. A preserved EF 2 metadata check proves its old model had no shadow property. (2) DefaultIfEmpty(0).Max allocation queries need nullable SQL MAX/coalesce with identical empty/nonempty semantics. (3) reset delivery rollback needs a typed nullable SQL parameter; null/prior-token rollback checks now pass. (4) saved-scramble GroupBy/First query explicitly retains EF 2 client grouping after league filtering. (5) a long league title must shrink/wrap inside the player-browser header; grid rules are unchanged.

All completed intermediate fixture runs report cleanup true, including failures; no preexisting account/league was edited. The latest browser attempt identified the retrieval-query/header issues above; the corrected frontend production build is currently being prepared as `angular22-authorized-dist`. The expanded real browser suite will add an owned available player, edit/remove/reimport that same ID and append 16 generated games via the actual UI. No API interception. Credentials go to the browser only via stdin; no password/cookie/token logging or files. Actual SMTP pickup messages are removed after consuming synthetic tokens.

Resume next: finish the new production build, copy its browser assets into this worktree's ClientApp/dist/browser, rebuild IntegrationCheck, and run `--authorized-development` with a **new** artifact directory. Correct any actual failures and verify cleanup/data fingerprints. Then rerun final read parity/API/security/regression checks appropriate to these fixes, refresh the package/staging assessment and capture a new recovery checkpoint. Do not redo Angular migrations. Existing lint debt remains; no production changes.

## Current checkpoint — .NET 10 initial build and query parity, 2026-11-22

### Latest continuation: backend/read integration verified; mutation acceptance pending

**Actual versions:** Angular/Core/CLI/Material/CDK/SW **22.3.0**, TypeScript **6.0.3**, Node **22.23.5**, RxJS **7.8.2**, Zone **0.16.3**; backend **net10.0 / ASP.NET Core 10.0.15 / EF Core SQL Server 10.0.15 / Newtonsoft.Json 13.0.4**, portable SDK **10.0.404**. Both framework migrations are implemented. The modernization is **not complete** and production deployment is **not recommended** yet.

**Build/test results now completed:** backend Release and Debug builds; all five existing tools plus the isolated integration runner build; PlayerImportCheck's four no-SQL fixture groups; final **29/29 EF query fingerprints** (zero differences); **4/4 autocomplete fingerprints** after reproduced/fixed translation failures; **1,966** independent historical teammate pairs; modern email/crypto/cookie fixtures; unchanged **86-action** API contract hash; **43 actual Kestrel/Startup/SQL/production-SPA HTTP checks** and **40 actual Development CLI-proxy HTTP checks**. Public desktop/mobile browsers passed against both actual host modes with no API interception. An explicit Development HTML proof contains `/@vite/client`. All **24 mapped table counts/hashes and FK metadata remain identical**; the Development database has **zero table triggers**. No database writes or external email occurred.

**Development compatibility work:** absolute SPA source path and a tiny Node readiness bridge replace reliance on Angular's obsolete console format. A Windows child-process cleanup issue was reproduced; an attempted stdin fix broke startup and was reverted. Private IPC terminates the CLI when its wrapper disappears, and the wrapper detects an exited npm/cmd parent without killing discovered processes. The independent forced-parent-exit fixture passes. Final actual Development startup passed **40 checks** and **both tracked processes stopped automatically**, no manual termination required: `development-parent-lifecycle-shutdown.json`. Earlier IPC-only/failed stdin attempts and their logs remain historical diagnostics, not final acceptance. No unrelated process was terminated; prior orphaned test CLIs were stopped only after matching their exact run-owned identities.

**Security/package:** full and production-only frontend npm audits, separate functional-tool npm audit, main backend and all six tool transitive NuGet audits report zero known vulnerabilities. node-forge and webpack-dev-middleware paths are absent. GitHub states are preserved in the read-only snapshot; open alerts are not claimed closed before an authorized push/rescan. Final local package: `tests/functional/artifacts/modernization/staging-package-net10-final/`, **92 files**, no `.env/node_modules/tests/tools/.git`, net10.0 runtimeconfig, generated IIS web.config, tested DLL and Angular shell hashes match the package. It was not deployed. See SECURITY.md and STAGING-AND-ROLLBACK.md.

**Remaining / exact next steps:**

1. Fresh scoped Development fixture approval is pending via the question already presented to the user. Read **INTEGRATION-APPROVAL.md**; do not treat elapsed time or older generic approval as consent. Real account-backed login/manager scoping, authenticated browser screens, actual membership/profile edits, schedule/Scrambler saves, score protection and reset single-use persistence remain unverified. Existing guard rejection of an offline non-account browser fixture was expected; do not bypass it.
2. If approved, implement/run the documented run-owned synthetic fixture journal, process/config/expiry gates and cleanup. Reuse existing mutation runners without weakening their authorization gates; modernize their runtime proof/loopback certificate handling as needed. No real league/account mutation or schema creation is authorized by the plan. Compare preexisting data fingerprints after cleanup.
3. Complete actual authenticated responsive integration across requested widths, full relevant final business/print/PWA acceptance and staging readiness review. Do not rerun Angular 7–22 migrations or the 954,000-run suite without a specific need.
4. Server OS/IIS/Hosting Bundle 10.0.15+, SQL TLS, actual Data Protection/session carryover, real SMTP delivery and native-device installation remain deployment acceptance items. No server install/restart/deployment is authorized. Lint is still **314 errors / 6 warnings**, unit coverage **14.51% lines**; there is no current compiler failure. Earlier experimental lifecycle test failure is preserved and its stdin code is absent from source.

Recovery instructions: use README.md and the newest named `checkpoints/net10-readonly-integrated` snapshot; preserve older Angular/legacy archives. Original master is still at **0d30bc9**, tracked files unchanged; an existing untracked master `.angular/` cache was left untouched. Modernization HEAD remains **85cf8a3**, all current work uncommitted. No merge/push/deploy or account/role/password changes.

New evidence: `net10-query-final.json`, `net10-search-fixed.json`, `net10-history-read.log`, `net10-email-final/`, `net10-http-second/`, `net10-development-http-fixed/`, `net10-development-proxy-proof.json`, `net10-development-ipc/`, `angular-lifetime-check.json`, `database-after-net10-comparison-final.json`, `development-trigger-inventory.json`, `net10-tool-audit-summary.json`, `functional-tools-npm-audit-final.json`, and `staging-package-final-verification.json`. Failed/incorrect initial attempts remain for diagnosis; use the explicitly named final files.

This section supersedes the historical handoffs below. Work remains on `feature/framework-modernization`, HEAD `85cf8a3`; no commits, pushes, merges or deployments performed. Preserve every existing change and artifact.

- Frontend complete checkpoint: Angular/Core/CLI/Material/CDK/SW **22.3.0**, TypeScript **6.0.3**, Node **22.23.5**, RxJS **7.8.2**, Zone **0.16.3**. Final clean installation, dev/prod builds, 24 unit tests, focused browser/business suites and zero-vulnerability full/prod npm audits passed. Lint remains **314 errors / 6 warnings**, not passing. Do not rerun Angular migrations.
- Backend source now targets **net10.0**, SDK **10.0.404**, ASP.NET Core/EF SQL Server/Newtonsoft MVC integration **10.0.15**, Newtonsoft **13.0.4**. Initial Release build **passed, 0 errors**. Existing assembly filename is intentionally retained. Startup uses supported routing/authorization middleware and the new Angular `dist/browser` root; Newtonsoft contracts and both cookie schemes remain. No schema migration was generated or applied. SQL compatibility level stays **130**.
- Preserved legacy EF 2.2 fingerprints: **29 queries** across WW Test League (37) and WW Winter 2026 (133). First EF 10 comparison: **29 passed, zero differences**, ordered and unordered hashes retained without payloads. Development identity is strictly checked as local Windows-authenticated `LeagueScramblerDev`. No database writes.
- First modern UiEmailCheck passed: legacy Unicode PBKDF2 vectors, reset expiry/trusted origin, actual HTML/plain local SMTP pickup, both legacy synthetic cookie schemes, and unchanged **7 controllers / 86 actions**, contract hash `9A64274A3AB42F36C9D14D4DE77F92B743AA3A34829B910ED9F1AEFE8605AB81`. No real credentials, delivery or database mutation.
- Captured four additional legacy autocomplete fingerprints. All four initially failed under EF 10 because `OrdinalIgnoreCase` StartsWith is not SQL-translatable. The targeted fix projects public ID/name fields and explicitly evaluates the same comparison locally, preserving prior semantics. Reverification is next.
- Verification projects now target .NET 10 with modern framework references and current EF/Newtonsoft; default project references bind tests to current source rather than stale backend DLLs. Explicit `BackendAssemblyPath` remains available for isolated legacy comparisons. Build/run verification of the other tools is pending; do not run mutation modes without fresh scoped authorization.

Immediate next steps: (1) rerun the four search fingerprints and final 29-query comparison against the updated assembly; (2) build remaining verification tools and run only read-only/fixture modes, independently verify 1,966 history pairs; (3) run an isolated actual backend/frontend host with safe Development settings and real HTTP read/auth-boundary tests; (4) audit NuGet dependencies, refresh IIS/staging/rollback documentation and preserve a backend recovery snapshot. Actual mutation integration requires a freshly approved synthetic fixture scope. Production/IIS compatibility, real account login, password-reset single-use persistence and actual save operations are not established by the current tests.

Evidence: `tests/functional/artifacts/modernization/{net10-backend-build,net10-email-build,net10-query-read,net10-email-first,net10-search-before,legacy-search-build,legacy-search-read}.log`, `legacy-query-results.json`, `net10-query-results.json`, `legacy-search-results.json`, `net10-email-first/`. Initial autocomplete failure is intentionally preserved.

## Active continuation — Angular 22 verified; prepare .NET 10, 2026-11-21

**Current operation:** Angular 22 frontend checkpoint is verified. Clean npm ci, production/development builds, 24 unit tests with V8 coverage, 6 UI groups, 12 player/import groups, 7 matchup/print groups, 8 actual production-worker groups, 12 score-navigation groups, directory (601 players / 10 widths), schedule redesign and exact May 2027 calendar-conflict browser scenarios passed. Pure suites passed 4,000 Scrambler runs, 72 K/Q combinations, 17 schedule groups / 1,000 simulations, 18 component-state cases and 35 import/parser checks. Engines have no source differences from 0d30bc9. Full/prod npm audits report zero vulnerabilities and npm ls reports zero peer mismatches. Lint remains non-passing: 314 errors, 6 warnings, 0 fatal parser errors. Unit coverage is 14.51% lines; business/browser harnesses are separate. Next: preserve legacy query/JSON baselines using existing assemblies and verified read-only Development records, then migrate backend/verification utilities to portable .NET 10 / EF 10. No database writes or production changes are authorized. Do not rerun completed Angular schematics.

Latest final Angular production checkpoint: **2026-11-21T23:54:58.762Z**, assets `tests/functional/artifacts/modernization/angular22-dist/browser`. Angular/Core/CLI/Material/CDK/SW **22.3.0**, TypeScript **6.0.3**, Node **22.23.5**, RxJS **7.8.2**, Zone **0.16.3**, angular-eslint **22.8.0**, ESLint **10.15.0**, typescript-eslint **8.73.0**, Vitest/coverage **5.1.1**, jsdom **31.0.1**. Main backend still **ASP.NET Core 2.2 / EF 2.2.6 / Newtonsoft 12.0.2**; portable SDK **10.0.404** is installed but backend conversion has not begun. Recovery: `angular22-frontend-verified`, earlier `angular22-webpack-passed`, `angular22-application-passed`, and timestamped/latest `angular22-passed` snapshots. NgModules, Zone/eager checking and XHR/DI interceptors are retained.

The earlier handoff below is preserved as historical recovery evidence. Angular 18.2.14 now also passes the plain development build (no named development configuration), focused UI/email-preview checks (6 groups), player-browser/import checks (12 groups), matchup-dialog/print checks (7 groups), and production service-worker checks (8 groups). Actual mobile and desktop screenshots were inspected. HttpClient uses `provideHttpClient(withInterceptorsFromDi())`; fixture requests and authorization-related frontend behavior remain compatible. These are frontend fixtures, not real backend authentication/persistence proof. No database writes or email delivery occurred.

Evidence: `tests/functional/artifacts/modernization/angular18-{development-build,ui,player-browser,matchups,pwa}.log`, versioned player-browser/matchup/PWA artifact directories, and `artifacts/ui-email-improvements` screenshots/results. Angular 19 and 20 have since passed; do not rerun migrations through 20. Master remains unchanged; branch HEAD remains 85cf8a3.

## Resume handoff — 2026-11-21

**Read this section first. Work is unfinished. No migration/install/build remains running.** The user requested a safe checkpoint before reaching the usage limit. Do not restart completed migrations.

### Exact current state

| Component | Actually reached |
|---|---|
| Angular Core / Service Worker | **18.2.14** |
| Angular CLI / build-angular | **18.2.21** |
| Angular Material / CDK | **18.2.14**, MDC migration completed |
| TypeScript | **5.4.5** |
| RxJS / Zone.js | **6.6.7 / 0.14.10** |
| angular-eslint schematics | **18.4.3** |
| Node used at this checkpoint | **18.20.8**, portable |
| Main backend | **Still ASP.NET Core 2.2 / netcoreapp2.2; migration not started** |
| Main EF Core / Newtonsoft | **Still 2.2.6 / 12.0.2** |
| Modern SDK installation | **.NET SDK 10.0.404 installed portably; application not yet converted** |

Final targets remain Angular/Material 22.3.0, TypeScript 6.0.3 (not latest TS 7), RxJS 7.8.2, compatible Zone 0.16.3, Node 22.23.5, and .NET 10 LTS / EF 10.0.15. See target decision below. Verify current registry/support information when resuming after a substantial delay.

Last accepted checkpoint: **Angular 18.2.14**, official migrations complete, source-stable AOT production build **passed 2026-11-21 19:13:10 UTC**, 37.3 seconds including startup. `angular18-update-result.json` and `angular18-checkpoint-result.json` both record success. `running-angular-step.json` says `checkpoint-passed` for 18. Latest rendered browser evidence is **Angular 17**, not 18.

### Location and preservation

- Worktree: `C:/Users/Allport/source/repos/LeagueHub-modernization`, branch **feature/framework-modernization**.
- Original migration base: `0d30bc9683f2669805958cc575b1fda28ecfcc17`. During handoff, a concurrent commit appeared: **`85cf8a3bcfe827ea59a785f05f9fc9aa77c2b420`**, message **upgrade branch start**, dated 2026-11-21 14:19:44 -05:00. It contains the modernization work and is the current branch HEAD. The agent did not create that commit. It has been preserved. **STATUS.md is the remaining uncommitted handoff update.** Reinspect Git before resuming; do not reset, clean, discard or automatically commit anything.
- Original master: `C:/Users/Allport/source/repos/Allport's League Scrambler`. Rechecked **clean and unchanged** at that commit; remote master was also verified there.
- Final recovery copy for this handoff: `tests/functional/artifacts/modernization/checkpoints/resume18/`. Its base is the new HEAD above; its patch/files capture the uncommitted status update. An incremental `modernization-resume.bundle` preserves commit 85cf8a3 with prerequisite 0d30bc9. Existing `checkpoints/angular18-passed/` retains the earlier full uncommitted source recovery copy, and `baseline-source.zip` remains. Do not delete ignored artifacts: they contain recovery files, SDKs, dependencies and test evidence.
- The agent performed no commits, merges, pushes, deployments, production restarts/configuration changes, database writes, real account/password/role changes or external email delivery. The concurrent commit above was observed and preserved, not reset.

### Completed changes

1. Official sequential Core/CLI/Material upgrades **7 through 18**, with production checkpoints at every major. Failed schematics were recovered before proceeding; see DECISIONS.md rather than replaying them.
2. Preserved NgModules and existing application architecture. Removed unused legacy HTTP/OAuth, JS/tooling and native Sass dependencies; retained Bootstrap CSS. Replaced TSLint via the official ESLint converter. Final testing/lint modernization is still pending.
3. Completed the explicit all-component Material MDC migration at 15. Fixed generated import/template quoting defects, dialog surfaces, compact field density, old selectors, original colors/typography and missed Scrambler LESS styling.
4. Found and reproduced an actual MDC-only seven-pixel scroll shift versus the unchanged Angular 7 build. Matchup dialog focus now restores the actual opener with preventScroll and the captured scroll position. Team/scoring algorithms were not changed.
5. Preserved an old print snapshot that already fails against current Angular 7. Captured a fresh legacy baseline with build-file hashes. Modern print PNG hashes and PDF page counts match it exactly at 2/4/6 matchups per page.
6. Angular 17 fixes: canonical import casing for `KingQueenRoundScore.ts`; `SwUpdate.versionUpdates` filtered to `VERSION_READY`; NativeDateAdapter's current constructor signature. Date parsing/timezone logic is unchanged.
7. Angular 18 officially replaced HttpClientModule with `provideHttpClient(withInterceptorsFromDi())`. **Verify this rendered/API behavior next.** The build remains `@angular-devkit/build-angular:browser`, output `dist`, with only a named `production` configuration.
8. Added independent legacy PBKDF2/Unicode compatibility vectors, isolated synthetic cookie format/scheme tests, and an actual compiled API contract inventory to existing UiEmailCheck. No real credentials or sessions were used.
9. Read-only SQL inventory covers all 24 model tables and FK metadata. Actual legacy EF/history queries were independently verified.

Pure `scramble-engine.ts` and `schedule-engine.ts` have **no diff**. Do not rewrite business rules or repeat the entire 954,000-run suite without a demonstrated need.

### Current failures and limitations

- **No current Angular 18 production compiler failure.** Existing component stylesheet warnings remain: schedule 7.79 kB and Scrambler 45.12 kB versus the 6.14 kB warning budget. Budgets were not disabled.
- **Preexisting unit setup remains broken:** Karma references missing `src/styles.css`, and the Scrambler spec imports removed `counter.component`. Review generated specs/providers; preserve useful cases through maintained tooling.
- Converted lint reported **4,427 legacy source findings and zero fatal parser errors** at Angular 12. Summary: `angular12-lint-summary.json`. Later/final lint compatibility remains unverified. Do not mass-reformat unrelated source or call lint passing.
- Protractor/Jasmine/Karma and remaining legacy browser helpers need final migration. Some historical test modes still reference ng.probe, old Material classes or removed Hide Setup controls. Update tests to the actual current workflow; do not revert working UI to obsolete expectations.
- Main backend/EF/hosting migration, final clean unforced dependency restore/audit, actual modern frontend/backend authentication and persistence, complete responsive regression, and staging readiness are **unfinished**.
- Offline cookie decoding is not proof of production IIS key configuration or middleware session expiration. Token single-use database consumption, native-device PWA installation and real SMTP/inbox delivery remain unverified.

### Tests already completed

| Check | Actual result / latest checkpoint |
|---|---|
| Original Angular 7 dev/prod + backend Release | Passed; original-worktree `artifacts/framework-modernization-baseline/` |
| Angular 8 through 18 production builds | Passed; `angularN-build.log` and checkpoint JSON |
| Angular 12, 15, 17 development builds | Passed |
| Scrambler invariants | Passed baseline, Angular 11 and 16 |
| K/Q rankings | **72 combinations**, passed baseline, 11 and 16 |
| Schedule engine | **17 groups / 1,000 simulations**, passed baseline, 11 and 16; latest mean 1.171 ms / max 3 ms |
| Player management/browser/import UI | **12 groups**, passed 12 and after MDC at 15; intercepted APIs, not SQL writes |
| TXT/CSV/XLSX/XLS parser/security cases | **35 checks**, passed at 12 |
| Player directory | 601-player scenario / 10 widths, passed at 12 |
| Application/date/KQ/home/email previews | **Six groups**, passed 12, 15 and **17**, including Eastern calendar dates at 375/430/1280/1920 |
| Actual production service worker | **Eight groups**, passed 12 and **17**: offline shell, uncached APIs, login/logout fixtures, explicit two-version updates |
| Matchup workflow | **Seven groups**, passed 15 and **17**: generate/view/modify/save/retrieve/courts/focus/responsive/printing fixtures |
| Print parity | Exact PNG hashes and **4/2/1 PDF pages** against fresh Angular 7 output at 2/4/6 matchups per page |
| Actual legacy history query | Two reference leagues / **1,966 aggregate pairs**, independently matched; read only |
| Legacy auth/email/cookie utility | **Six groups** passed; synthetic PBKDF2, two cookie schemes/tampering, actual HTML/plain SMTP pickup sender, trusted origins and token-expiry fixtures |
| API metadata | **Seven controllers / 86 declared actions**, route/auth/binding snapshot; not actual modern route-registration proof |
| SQL inventory | **24 tables / zero missing**, counts/schema/hashes/FKs; no raw row payloads or credentials saved |

Do not repeat these checkpoints blindly. Most browser writes are intercepted synthetic requests; actual authenticated modern SQL integration is still required.

### Next specific steps

1. Inspect this worktree/status and `running-angular-step.json`; there is **no pending process** to resume. Preserve all dirty/untracked files.
2. Build an **Angular 18 development** bundle and run focused UI/PWA/matchup checks, particularly the HTTP provider migration. Current config has no named development configuration; use plain `ng build`, not `--configuration=development`.

   From `Allport's League Scrambler/ClientApp`:

   ```powershell
   $nodeDirectory=(Resolve-Path ../../tests/functional/.tools/node-v18.20.8-win-x64).Path
   $env:PATH=$nodeDirectory+';'+$env:PATH
   $env:NODE_OPTIONS='--max-old-space-size=4096'
   $env:NG_BUILD_MAX_WORKERS='2'
   node node_modules/@angular/cli/bin/ng build --progress=false --output-path=../../tests/functional/artifacts/modernization/angular18-development *> ../../tests/functional/artifacts/modernization/angular18-development-build.log
   ```

   Use portable Node 22 for browser scripts, with `LEAGUE_TEST_DIST` pointing to that absolute development output and `PLAYWRIGHT_BROWSERS_PATH` set below. Relevant scripts: `ui-email-improvements.cjs`, `existing-player-browser.cjs import`, `scrambler-workspace.cjs matchups-modal`. Set a unique `LEAGUE_TEST_OUT` where supported. Matchups require `LEAGUE_PRINT_BASELINE` pointing to `artifacts/modernization/angular7-matchups-baseline/print-compatibility-metadata.json`. Import prerequisites already exist in `artifacts/player-import/parser-fixtures/` and icon CSS/woff2 in `artifacts/schedule-redesign/`; copy into the chosen browser output as previous runs did.

   Production worker test, from root:

   ```powershell
   & .\tests\functional\.tools\node-v22.23.5-win-x64\node.exe tools/modernization/pwa-check.cjs tests/functional/artifacts/modernization/angular18-dist tests/functional/artifacts/modernization/angular18-pwa
   ```

3. Once satisfactory, continue **19 -> 20 -> 21 -> 22**, one major at a time:

   ```powershell
   node tools/modernization/angular-upgrade.cjs 19
   ```

   The helper validates the branch/previous passing checkpoint, selects Node 18 for 19 and Node 22 for 20-22, uses the **target CLI**, saves logs, checks reported errors even if exit code is zero, builds production and creates a recovery checkpoint. Wait for completion and fix failures before advancing. For partially completed schematics, inspect logs and run `angular-resume.cjs TARGET` with **only unfinished package names**. Do not rerun completed Core/CLI/Material migrations.

4. Finish RxJS 7.8.2, supported TypeScript/Zone, maintained testing/lint and removal/replacement of obsolete scaffolds. Check output/PWA paths if changing builders. Retain NgModules and Zone behavior. Official updater internally uses npm force; final acceptance requires **clean unforced restore**, peer checks and audit without force/legacy-peer overrides.
5. Start **.NET phase** only after frontend checkpoint. Portable SDK: `tests/functional/.tools/dotnet10/dotnet.exe`. Main app is still 2.2. Upgrade hosting/routing, EF/SQL client and verification projects to .NET/EF 10, patched Newtonsoft MVC integration, and preserve existing authentication/serialization/contracts. No active IdentityServer exists to replace. Do not auto-run DB migrations or alter SQL compatibility 130.
6. Reuse `legacy-email/api-contracts.json` for the 86-action contract comparison. Run modern UiEmailCheck with second argument `legacy-email/synthetic-cookie-fixtures.json` for real legacy-ticket decoding; the isolated synthetic key ring is deliberately separate from real applications. Preserve old binaries in `legacy-email-bin/` and `legacy-history-bin/`. Repeat modern EF HistoryCheck against the verified Development target and compare results, not compilation alone.
7. Finish actual authenticated integration, synthetic persistence/data-integrity tests, final security/responsive/business regressions and staging package/docs. **Fresh scoped DB-write approval is required by existing runners; never reuse expired approval.** Prepare concrete synthetic ownership/cleanup before requesting it. Do not invoke existing production publish profiles or install/restart production IIS.

### Runtime and evidence paths

- System Node is **10.16.3**. Use explicit isolated runtimes in `tests/functional/.tools/`: 14.21.3, 16.20.2, 18.20.8, 22.23.5. Modern browser scripts need Node 22, not system Node 10.
- Browser cache: `C:/Users/Allport/source/repos/Allport's League Scrambler/tests/functional/.tools/browsers` (reuse read-only). This worktree has Playwright 1.55.1 installed in `tests/functional/node_modules`.
- Verified Development DB: **localhost / LeagueScramblerDev**, Windows integrated auth; machine **DESKTOP-UN67OEK**, SQL **15.0.2000.5**, compatibility **130**. Reverify before future testing. Original project `.env` is local-only; never print/copy its secrets into source or reports.
- Logs/evidence: `tests/functional/artifacts/modernization/`, particularly `angular17-*`, `angular18-*`, `database-before-complete/`, `legacy-history-*`, `legacy-email/`, `legacy-print-provenance.json`, and `angular7-matchups-baseline/`. Angular 17 UI screenshots remain in `artifacts/ui-email-improvements`; separate 12/15 copies are preserved.
- Details: BASELINE.md, DECISIONS.md, DEPENDENCIES.md, STAGING-AND-ROLLBACK.md. The staging document is a draft, not deployment approval.
- Some PowerShell redirect logs are UTF-16LE with BOM; detect encoding when reading with Node. Helper-written build logs are UTF-8. Do not stream giant lint JSON lines; read the small lint summary.
- `tests/functional/mobile-league-home-evidence/calculation-results.json` is known runner-generated tracked output, not preexisting user edits. Preserve evidence when later tidying the diff.

**No production readiness claim: .NET, real modern integration, final audit and staging acceptance remain unfinished.** Historical decisions/checkpoints follow.

Worktree: `C:/Users/Allport/source/repos/LeagueHub-modernization`  
Branch: `feature/framework-modernization`  
Base: `0d30bc9683f2669805958cc575b1fda28ecfcc17` (master and origin/master at start).

## Safety

Master was clean: the prior security work was already committed as `0d30bc9`. No uncommitted work was omitted. Master remains in its original worktree. No commits, pushes, merges, production deployments, production configuration changes, or database writes are authorized by this checkpoint. Database mutation runners retain their fresh, scoped approval requirements. Do not copy original secrets into tracked files.

Recoverable baseline: `tests/functional/artifacts/modernization/baseline-source.zip`. Detailed logs and registry snapshots: `tests/functional/artifacts/modernization/`. Additional baseline build logs are in the original worktree's `tests/functional/artifacts/framework-modernization-baseline/`.

## Target decision

- Angular/Core/CLI/Material/CDK/service-worker **22.3.0**, verified stable registry tags.
- TypeScript **6.0.3**, within Angular 22's `>=6.0 <6.1` range; do not install latest TypeScript 7 independently.
- RxJS **7.8.2** (Angular permits ^6.5.3 or ^7.4); Zone.js **0.16.3**, preserving existing Zone-based change detection.
- Supported Node **22.23.5**, already available as a portable test tool and within the required ^22.22.3 range. Intermediate migrations use isolated Node 10/14/16/18 as required, never production runtimes.
- **.NET 10 LTS / ASP.NET Core 10.0.15 / EF Core 10.0.15**. Official .NET 10 SDK metadata selects SDK **10.0.404**. .NET 11 is newly released; 10 LTS has a mature servicing history and preserves a supported target without adopting the newest major immediately.
- IIS staging will require the matching supported .NET Hosting Bundle/ANCM and an independently configured application; no installer or restart is performed against production.

Sources: [Angular compatibility](https://angular.dev/reference/versions), [Angular support](https://angular.dev/reference/releases), [.NET support](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core), [IIS hosting](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/).

## Current phase

Phases 2–5 implemented and locally accepted: Angular 22.3.0 and .NET/EF 10.0.15, actual account-backed API/browser/persistence/reset integration, data parity and regression suites pass. Phase 6 package/procedure is prepared; Phase 7 assessment recommends controlled staging verification after server prerequisites and separate deployment authorization. Development permission is granted and persists. No actual staging/IIS/production deployment has been performed. See the accepted checkpoint at the top; do not restart completed migrations or request repeat Development permission.

## Authentication finding / decision

The current backend does not reference or register IdentityServer4. Active authentication is the application's existing Users/UserRoles/UserLeagues/UsersPlayer model and two ASP.NET cookie schemes. The unused frontend `angular-oauth2-oidc` dependency is not the current login flow. Preserve cookies, claims, roles, IDs, PBKDF2 legacy hash verification, reset tokens and player mappings; do not migrate accounts into new Identity tables or deploy an unnecessary identity server.

## Planned checkpoints

1. Finish dependency classification, existing test/build failures, before screenshots and read-only Development baseline.
2. Run official core/CLI and Material migration schematics one major at a time, with compatible Node/TypeScript at each step. Build and run focused invariant checks before advancing. Retain NgModule architecture.
3. Migrate backend hosting/middleware and EF/SQL queries while preserving API/serialization and authentication contracts. Do not automatically apply migrations.
4. Integrate modern frontend and backend on separate local ports, use real authenticated synthetic integration fixtures only with verified/scoped Development authorization.
5. Run algorithm/statistical, standings, schedule, management, auth/reset, PWA, printing and responsive regressions. Compare database results and visual baselines.
6. Produce isolated staging package, Hosting Bundle requirements, rollback procedure and evidence-based readiness report. No production deployment recommendation before integration/data checks pass.

## Principal risks

- Angular 7→22 requires sequential migration; root Material barrel imports, old private router import, ViewChild queries, RxJS types and template checks need attention.
- Material MDC changes can invalidate DOM-dependent CSS. Keep brand/layout and compare real screenshots; do not accept a visual redesign as a migration.
- Old Jasmine/Karma scaffolds and debug `ng.probe` browser helpers need supported equivalents; keep the useful scenarios rather than delete them.
- EF 2.2 allowed client query evaluation that modern EF rejects. Preserve query results, ordering, dates, rounding, transactional behavior and existing SQL schema.
- Preserve Newtonsoft JSON contracts initially through modern MVC Newtonsoft support. Do not allow implicit API-controller validation or reference-loop changes to alter responses.
- Preserve PBKDF2/SHA1 legacy verification by explicitly naming the old algorithm where modern constructors require it. Do not change real password hashes or silently force registration.
- Existing cookie sessions may require sign-in after deployment if data-protection keys/purpose change; staging must test key persistence and document this.
- No supported .NET 10 runtime/hosting bundle is installed globally; hash-verified portable SDK 10.0.404 is installed only inside the migration worktree. No IIS changes were made.

## Completion status

Not modernized yet. Not ready for staging or production. Update this document after each passing migration checkpoint and record any blocking issue before proceeding.

## Angular 8 checkpoint (passed)
Official Core 7?8, CLI 7?8 and Material 7?8 schematics completed. Legacy schematic interop adapter prevents CLI 8 from fetching today's CLI and supplies its expected CommonJS chalk default; application dependency/peer checks remain intact. Production build passed. Removed unused private router imports and repaired preexisting invalid historical schedule table grouping, preserving its data. Baseline core invariant suites passed. Development SQL identity verified (SQL Server 2019, compatibility 130); no writes. Recoverable checkpoint: checkpoints/angular8-passed. Angular 9 is next.


## Angular 9 checkpoint (passed)
Core 9.1.13, CLI 9.1.15, Material 9.2.4. Official target-CLI migrations completed. Explicit tslib 1.14.1 satisfies the missing Angular 9 peer; no forced peer bypass. Ivy production build passed. Existing oversized legacy Scrambler stylesheet budget warnings are recorded, not hidden. Source checkpoint: checkpoints/angular9-passed. Angular 10 migration is in progress.


## Angular 12 production checkpoint

Core 12.2.17, Node v14.21.3; official migration step completed, source-stable production build passed in 100 seconds. Detailed warnings and output: angular12-build.log. Completion: 2026-11-21T17:37:43.095Z.

## Angular 12 production checkpoint

Core 12.2.17, Node v14.21.3; official migration step completed, source-stable production build passed in 40 seconds. Detailed warnings and output: angular12-build.log. Completion: 2026-11-21T17:45:27.454Z.

## Angular 13 production checkpoint

Core 13.4.0, Node v14.21.3; official migration step completed, source-stable production build passed in 39 seconds. Detailed warnings and output: angular13-build.log. Completion: 2026-11-21T17:56:20.102Z.

## Angular 14 provisional build (not accepted before migration resume)

Core 14.3.0, Node v14.21.3; official migration step completed, source-stable production build passed in 78 seconds. Detailed warnings and output: angular14-build.log. Completion: 2026-11-21T18:02:22.450Z.

## Angular 14 production checkpoint

Core 14.3.0, Node v14.21.3; official migration step completed, source-stable production build passed in 36 seconds. Detailed warnings and output: angular14-build.log. Completion: 2026-11-21T18:05:11.786Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 32 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:17:01.419Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 28 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:19:13.804Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 34 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:32:34.066Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 29 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:43:50.627Z.

## Angular 16 production checkpoint

Core 16.2.12, Node v16.20.2; official migration step completed, source-stable production build passed in 42 seconds. Detailed warnings and output: angular16-build.log. Completion: 2026-11-21T18:50:07.427Z.

## Angular 17 production checkpoint

Core 17.3.12, Node v18.20.8; official migration step completed, source-stable production build passed in 29 seconds. Detailed warnings and output: angular17-build.log. Completion: 2026-11-21T19:01:36.889Z.

## Angular 18 production checkpoint

Core 18.2.14, Node v18.20.8; official migration step completed, source-stable production build passed in 37 seconds. Detailed warnings and output: angular18-build.log. Completion: 2026-11-21T19:13:10.069Z.

## Angular 19 production checkpoint

Core 19.2.25, Node v18.20.8; official migration step completed, source-stable production build passed in 30 seconds. Detailed warnings and output: angular19-build.log. Completion: 2026-11-21T22:46:10.504Z.

## Angular 20 production checkpoint

Core 20.3.35, Node v22.23.5; official migration step completed, source-stable production build passed in 44 seconds. Detailed warnings and output: angular20-build.log. Completion: 2026-11-21T22:53:55.479Z.

## Angular 21 production checkpoint

Core 21.2.26, Node v22.23.5; official migration step completed, source-stable production build passed in 37 seconds. Detailed warnings and output: angular21-build.log. Completion: 2026-11-21T23:06:04.212Z.

## Angular 21 production checkpoint

Core 21.2.26, Node v22.23.5; official migration step completed, source-stable production build passed in 24 seconds. Detailed warnings and output: angular21-build.log. Completion: 2026-11-21T23:06:04.212Z.

## Angular 21 production checkpoint

Core 21.2.26, Node v22.23.5; official migration step completed, source-stable production build passed in 28 seconds. Detailed warnings and output: angular21-build.log. Completion: 2026-11-21T23:15:54.802Z.

## Angular 22 production checkpoint

Core 22.3.0, Node v22.23.5; official migration step completed, source-stable production build passed in 30 seconds. Detailed warnings and output: angular22-build.log. Completion: 2026-11-21T23:25:22.217Z.

## Angular 22 production checkpoint

Core 22.3.0, Node v22.23.5; official migration step completed, source-stable production build passed in 14 seconds. Detailed warnings and output: angular22-build.log. Completion: 2026-11-21T23:27:46.061Z.

## Angular 22 production checkpoint

Core 22.3.0, Node v22.23.5; official migration step completed, source-stable production build passed in 22 seconds. Detailed warnings and output: angular22-build.log. Completion: 2026-11-21T23:45:41.981Z.

## Angular 22 production checkpoint

Core 22.3.0, Node v22.23.5; official migration step completed, source-stable production build passed in 11 seconds. Detailed warnings and output: angular22-build.log. Completion: 2026-11-21T23:54:58.762Z.

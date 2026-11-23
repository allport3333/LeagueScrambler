# Modernization results: authenticated local acceptance, 2026-11-22

## Team Management and dark theme verification

- Angular production build and all 24 unit cases passed. The .NET Release build passed for the team membership changes. Angular's browserslist and component style-budget warnings remain.
- Edge fixtures verified team creation and automatic selection, division and global league switching, league-only candidate filtering, search and gender filters, three consecutive assignments, a retry after a failed assignment, roster count and profile links, and dialog close. The workspace and player browser were rendered at 320, 375, 390, 430, 768, 1024, 1280, 1920, 2560 and 3440 px. The Team Scores and League Management browser regression passed.
- The existing assignment route accepts the optional scope ID for current clients. It enforces the existing role and league policy, validates enrollment, and checks same-team duplicates inside a serializable transaction. A conflict response covers concurrent SQL contention. No global player records, league memberships, schedule entries or score records are written by this operation.
- Isolated Kestrel checks verified both team write endpoints reject an anonymous request and a regular account. Direct Development SQL connection failed before a query with the Windows security-package credential error. Real authorized writes, cross-league Manager denial, SQL concurrency and historical readback remain unverified. No database writes were performed. Team-only removal remains unavailable because the application has no supported endpoint for it.
- The paired Edge theme runs measured 16 sampled dark foreground and background combinations. The old build had 12 below 4.5:1. The new build had zero below 4.5:1 and a minimum of 8.24:1. Sampled Classic Light screenshots of Install Locally, Dashboard Standings, K/Q Standings and K/Q Matchups matched the baseline byte for byte. The theme capture matrix used populated fixtures where applicable.
- The real Angular service-worker regression passed for browser control, network-only API responses, themed shell preference through an update, login draft protection, and Full Schedule printing. Native standalone testing and exhaustive dialog/state contrast verification remain open.
- Evidence is under tests/functional/artifacts/modernization/team-workspace/ and tests/functional/artifacts/modernization/dark-theme/. No deployment, production changes or Git history changes were made.


## Division schedules, loading, appearance and league creation

Evidence and logs are under tests/functional/artifacts/modernization/schedule-themes/.

| Area | Verification |
| --- | --- |
| Angular builds | Development and production builds passed. The production initial bundle was 2.69 MB raw and 437.66 kB estimated transfer. Browserslist and component style-budget warnings remain. |
| Angular unit suite | 24 of 24 tests passed across 18 files. |
| Schedule and loading | Edge verified separate sections for interleaved Gold and Silver input, four cards per division at 1920 px, previous/next and Current Week, empty week, Full Schedule, delayed initial loading, HTTP 500 and retry, and switching leagues before the previous response completes. The schedule layout passed checks at 320, 375, 390, 430, 768, 1024, 1280, 1600, 1920, 2560 and 3440 px. |
| Themes and navigation | Edge verified theme selection, persistence across reload and Account menus, the week selector and Full Schedule in each theme. Mobile and desktop captures cover Home, Scrambler, Team Scores, standings, matchups, players, profiles, League Setup, Sign In and password reset. Representative captures were inspected for contrast and alignment. A formal WCAG audit remains pending. |
| Creation and setup | UI fixtures passed Admin and Manager creation, selected-league handoff, Setup selection, reload of the valid selection, division form behavior, manager grant/revoke and role-dependent controls. Player and anonymous fixtures were denied the administrative route. The tests exercised the UI and existing API contracts with synthetic responses. Real ownership and server authorization were not reverified. |
| Regression and PWA | Edge score-entry, homepage/League Setup and visual restoration checks passed. The actual Angular service worker controlled the browser, kept API data network-only, preserved appearance through an update, protected a login draft and supported tested installation UI and Full Schedule printing. Native installed-device testing remains pending. |
| SQL and backend | The Windows Integrated read-only probe targeted localhost and LeagueScramblerDev. ODBC reported that no credentials were available in the security package and connection failed before any query. This blocked a real creation, ownership and authorization run. This checkpoint made no SQL fixture writes, backend source changes, schema changes, IIS changes or deployments. |

The loading review covered the Home account summary and next game, initial Scrambler roster, Team Scores and team management, Dashboard standings and league teams, schedule, K/Q standings and matchups, Players, profiles and statistics, League Management roster and add-player browser, import, schedule management, League Settings and Setup, Sign In, and Account Appearance. Lazy tabs and dialogs load their own initial data when opened. Background refresh retains settled content where applicable. Failure paths were exercised for schedule loading and switching, with broader initial-render and interaction coverage elsewhere.

Appearance uses browser local storage and the early application shell. Classic Light is the default. The browser's choice persists through login and logout. No existing account preference field was available, so cross-device account synchronization remains open. The selected league ID uses session storage and is restored only when it is in the user's current league list.

Key captures are in browser/ and role/. Compare baseline-schedule-1920.png with classic-schedule-1920.png, or open navy-schedule-390.png, charcoal-account-menu.png and role/created-league-setup-Manager-390.png. The home/after/ folder contains League Setup captures across the full width matrix.


## Final Scrambler and League Setup polish

- The Team Breakdown total is centered 4 px beneath the boxes, down from 8 px across the browser comparison. Its internal padding is balanced. The fixture confirmed that 24 selected players yield six four-player teams at the default setting.
- The Player List groups its 44 px selection buttons above Player Requirements and the icon legend. Selected totals appear in the Player Selection summary. The expanded estimates use the larger Top or Low group as the number of teams. One classified player gave totals of 2, 3 and 4 for the corresponding team sizes. Two Low players and one Top player gave 4, 6 and 8.
- League Setup uses compact outlined fields and a centered manager form. Division Abbreviation is the display label for the existing division code. The controller continues to require the code and enforce uniqueness within the league. The API submission still sends `code`.
- The Angular production build and 24 unit tests passed. Edge fixture suites passed with before and after captures at 320, 375, 390, 430, 768, 1024, 1280, 1600, 1920, 2560 and 3440 px. Coverage included selection, classification, keyboard and mobile interactions, configuration switching, team generation, form validation, and grant and revoke feedback. The production build still reports stylesheet budget warnings.

Evidence is in `tests/functional/artifacts/modernization/scrambler-setup-polish/`. The focused runners use synthetic APIs. No database writes or deployments occurred.

## Cookie role validation and canceled navigation

The previous EF query reproduced `TaskCanceledException` with an aborted request token. A separate real HTTP test disconnected during an in-flight role lookup. Cookie validation now checks for an existing abort, handles cancellation only when the request has been aborted, and rejects the principal for that request. It leaves the browser's session intact. The pipeline stops before dispatching an aborted request. Independent cancellation, timeouts and SQL connection failures went through the HTTP error path.

Authenticated MVC and Razor endpoints still validate the database role on each request, so role revocation takes effect on the next request. ASP.NET Core reuses the result within the same request. Static files and the unmatched Angular shell bypass the role lookup. The per-league membership checks remain unchanged.

The Release build and isolated Kestrel tests used the real cookie middleware with fixture principals. They verified the exclusion for a SPA deep link, Admin and Manager access, immediate demotion, missing-account rejection, aborted request handling, recovery on a subsequent request, logout, and genuine SQL connectivity failure against an intentionally unavailable loopback port. The guarded LeagueScramblerDev integration run separately failed at connection open with Windows Integrated authentication. A direct read-only connection probe reported “Cannot generate SSPI context” before any query. Database-backed login and league membership verification remain pending. No fixtures were written.

Run the isolated checks with the built IntegrationCheck executable and `--cookie-cancellation`. Logs are in `tests/functional/artifacts/modernization/cookie-cancellation/`.

## Automatic PWA updates, homepage, and League Setup

Evidence is in `tests/functional/artifacts/modernization/pwa-home-setup/`. The focused Edge runner is `tools/modernization/pwa-home-setup.cjs`.

| Area | Verification |
|---|---|
| Version updates | Two Angular production builds had different verified worker manifests. On a loopback origin in Edge, reconnect downloaded the complete release, reloaded the idle tab at the same route, and preserved an unfinished score entry in a second tab. Saving or explicitly discarding the score draft applied the update. |
| Older installations, interrupted releases and rollback | The browser upgraded a registered worker from the original Angular 7 build to Angular 22 at the same root scope without clearing storage. A corrupted shell was rejected, the complete replacement loaded, and the previous contents applied again when published with a fresh manifest identity. These checks used browser service workers and simulated standalone presentation. Native iOS, Android and desktop installation were outside the available test environment. |
| Fresh data and cache headers | Score data changed on reconnect without a full page reload when no new version was present. Offline API reads failed and browser Cache Storage contained no API responses. Local Kestrel returned `no-cache` for worker metadata, the web manifest and a deep-link shell, `immutable` for the fingerprinted script, and `no-store` for the API response. |
| Homepage | Before and after screenshots cover 320, 375, 390, 430, 768, 1024, 1280, 1600, 1920, 2560 and 3440 px. Tests checked all table headers, schedule row alignment, long opponent names and preserved schedule, standings and game-history links. Existing score data supplies the opponent but has no per-game format field. Rows use the category “League team play” when no format is supplied. |
| League Setup | The same widths were captured for Setup. Checks covered desktop span and mobile stacking, selected league, keyboard tab order, disabled states, league and division creation, grants, revokes and error feedback through synthetic API fixtures. |
| Build and suite | Angular production and .NET Release builds passed, along with 24 Angular unit tests. The existing PWA suite verified offline shell, install controls, role and login fixtures, and the Full Schedule print PDF. Style budget warnings remain. No staging or production deployment occurred. |

To repeat the release test, create two Angular production builds inside the artifact tree. For the second build, pass `--index` with a fixture copy of `src/index.html` named `index.html` containing `<meta name="release-fixture" content="version-b">`. Invoke `node tools/modernization/pwa-home-setup.cjs updates <build-a>/browser <build-b>/browser <evidence-folder>` from the worktree root. The same runner accepts `failure`, `legacy` and `visual`. The first argument after `legacy` points to the original prebuilt browser files copied into artifacts. The test host switches between complete, hash-verified releases and keeps old fingerprinted files available.

## Role-based administration and focused UI cleanup

| Area | Result |
|---|---|
| Angular and .NET | Angular production build and all 24 unit tests passed. The .NET Release build and IntegrationCheck build passed. The Angular style budget and existing backend compiler warnings remain. ESLint reported 311 errors, six warnings and zero fatal parser errors. |
| Scrambler | Edge screenshots cover the requested phone, tablet, desktop and ultrawide widths. Browser checks covered name wrapping and spacing, desktop actions, opening and dismissing the mobile menu, selecting and scrolling, disclosure state, both remembered Team Configuration values, invalid team count, rules, and generated team sizes. |
| Team Scores | Edge screenshots cover 320 through 3440 px at the ten requested sizes. Browser checks covered paired fields, team selection, duplicate-team and invalid-score handling, manual entry, saved-results confirmation, and scheduled matchup loading. These requests used browser-only fixtures. |
| League Management | Browser fixtures exercised Admin, assigned Manager, Manager with zero assignments, Player, and anonymous UI. The Admin grant and Manager creation requests were intercepted. Creation refreshed the league selection and enabled the newly assigned tabs in the fixture. |
| Real API and compiled filters | Isolated Kestrel returned 401 to unauthenticated protected schedule, membership, league creation, score and assignment requests. The same requests with an inert retired-cookie value also returned 401. The retired password disclosure endpoint returned 410. All 126 compiled origin and authorization-metadata assertions passed. |
| Account-backed SQL and IIS | Windows Integrated SQL failed before a Development query with `Cannot generate SSPI context` over shared memory and TCP. The real account, cross-league, assignment and creation regression fixtures remain pending. This checkpoint created no SQL records and performed no IIS deployment. |

Screenshots and HTTP results are in `tests/functional/artifacts/modernization/role-management-polish/`. Test sources are `visual-restoration.cjs`, `role-management-ui.cjs`, and the functional league/session specs.

## Visual restoration and HTTPS investigation — 2026-11-22

| Area | Result |
|---|---|
| Visual evidence | Edge opened the accepted and revised Angular 22 bundles with intercepted display fixtures. Both sweeps measured 16 views at 11 widths and captured 80 screenshots each. The revised sweep found no page overflow or uncaught errors. The populated Scrambler roster rendered 1, 2, 6 and 12 columns at 320, 390, 1920 and 3440 px. Existing Angular 7 score and matchup screenshots informed the comparison. |
| Build and unit tests | Production and development builds passed. Angular's initial esbuild filesystem error was resolved with a temporary drive path to the worktree. All 24 unit cases passed across 18 files with one Vitest worker. Existing Scrambler and schedule stylesheet budget warnings remain. |
| Focused browser workflows | Team Scores scheduled and manual layouts, Scrambler generation and matchup modification/retrieval, fixture-based roster/import/schedule operations, role boundaries, and print checks passed. Matchup HTML, pixels and page counts matched the accepted Angular 22 bundle under the same Edge runtime. These browser workflows used synthetic HTTP fixtures. |
| PWA | An isolated production-worker test passed page control, network-only API requests, update notification, input retention on cancel, and confirmed refresh. The full PWA suite stopped at the offline banner after a reload in Edge. The same check also failed on the accepted baseline in Edge. Native installation and the IIS update remain pending. |
| Lint | 314 errors and six warnings, the same counts as the accepted checkpoint. |
| IIS HTTPS | Trusted HTTPS 200 at `https://127.0.0.1:8086/`. Anonymous authentication status received 200 with false. A league-data request returned a JSON collection with HTTP 200. |
| IIS login | Same-origin empty body case returned 400 validation. A populated synthetic unknown-account case returned 400 credential rejection after the user lookup path. No authentication cookie was issued for either. The failing real attempt, successful login/logout and recycle persistence still require an account-backed run. |
| Database and deployment | This continuation ran no SQL mutations, created no fixtures, and changed no IIS settings or deployment files. No cleanup was needed for these probes. The replacement ZIP and 92-file manifest verified. The live IIS shell still references `main-DNB7XUUU.js`. The candidate references `main-IHY7SZHO.js`. |

Evidence and build logs are in `tests/functional/artifacts/modernization/visual-restoration/`. The fixture runner is `tools/modernization/visual-restoration.cjs`.

## IIS staging results — 2026-11-22

| Area | IIS result |
|---|---|
| Deployment | 92 of 92 live files matched the verified review ZIP and manifest. Fresh extraction and verified live-file backup saved. |
| HTTP and frontend | IIS returned 200 for the Angular shell, JavaScript bundle, web manifest and service-worker files at `http://127.0.0.1:8085/`. Browser execution and service-worker lifecycle are pending. |
| HTTPS and isolation | Port 8086 refused connections. HTTP.sys showed a wildcard TCP listener on 8085. Effective site bindings, redirect and browser certificate trust are unverified. |
| Runtime and pool | ANCM event recorded successful staging startup. Both shared runtimes are installed at 10.0.15. Dedicated pool status, profile and effective environment remain inaccessible to this session. |
| SQL and cleanup | Direct Windows-integrated probes to LeagueScramblerDev failed before executing a query. The IIS worker's target and permissions remain unverified. This continuation created no fixtures and made no Development SQL writes. |
| Authentication | Actual same-origin empty JSON reached the login action and returned the expected 400 validation response. The earlier populated-login failure, cookies, logout, role boundaries and pool-recycle persistence remain unverified. |
| Functional workflows | IIS-backed league, player, import, scheduling, Scrambler, matchup, scoring, K/Q, dashboard and print acceptance is pending. Local results below are historical evidence. |

Staging is blocked for manual acceptance until an elevated session with appropriate write access can finish dedicated IIS configuration and verify the effective Development SQL connection. See STATUS.md for the evidence and rollback artifact directory.

## Accepted local results

**Overall: framework implementation and local acceptance passed; ready for controlled staging verification after server prerequisites and separate deployment authorization. Production deployment is not recommended before staging acceptance.** Current branch is feature/framework-modernization in the separate LeagueHub-modernization worktree. Master tracked files and earlier commits remain intact. Authorized synthetic Development database writes were performed and cleaned up. No commits, pushes, merges, deployments, production/IIS changes, schema changes, real account/role/password changes or external email occurred.

|Area|Current result|
|---|---|
|Frontend|Angular/Core/CLI/Material/CDK/SW 22.3.0; TypeScript 6.0.3; Node 22.23.5; RxJS 7.8.2; Zone 0.16.3. NgModules and existing business rules retained.|
|Backend|net10.0, SDK 10.0.404, ASP.NET Core/EF SQL Server 10.0.15, Newtonsoft.Json 13.0.4. Debug and Release builds pass.|
|Backend source changes|Supported generic host, routing/authorization middleware, modern framework/package references, Newtonsoft MVC contracts, SQL compatibility 130, parameter-preserving raw SQL API replacement, explicit legacy password hash parameters, supported RNG and constant-time verification.|
|Authentication|Existing tables, user IDs, role/league policies and two cookie schemes retained. Actual synthetic account registration/login/logout, manager scoping and privilege rejection pass. Unicode legacy hashes and old cookie formats remain compatible. Reset expiry/origin/MIME, delivery rollback, token consumption/replay and five concurrent pairs pass; exactly one success per token. No IdentityServer introduced.|
|EF parity|29 real Development query fingerprints, four autocomplete cases and two saved-scramble lists match legacy output. Fixed a shadow role FK using the actual existing UserRoleId relationship, SQL MAX/coalesce allocation and legacy grouping boundaries. No schema change.|
|History|1,966 teammate pairs independently agree with saved memberships across WW Test League and WW Winter 2026.|
|HTTP integration|Final actual account-backed run passes 59 recorded checks / 64 HTTP requests, plus 113 browser API requests / 11 browser groups. No API interception. Prior 43 read/auth-fixture checks also pass. Actual membership/profile writes, schedules, Scrambler drafts/finalization/retrieval/modification/scoring/created-team updates and recovery run against guarded Development SQL.|
|Development hosting|40 actual HTTP checks, live Vite HTML proof, public mobile/desktop browser checks pass. Absolute source path and a development readiness/lifetime bridge accommodate changed Angular CLI output and Windows npm/cmd process behavior. Final forced-parent fixture and actual automatic shutdown pass with zero remaining owned processes.|
|Frontend tests already passed|24 unit cases / 18 files; UI 6; player/import 12; matchup/print 7; production-worker 8; score navigation 12; 601-player directory / 10 widths; schedule/calendar regression; 4,000 Scrambler runs; 72 K/Q combinations; 17 schedule groups / 1,000 simulations; 18 schedule component cases; 35 parser/security checks. Full migration history remains in STATUS.md; tests were not rerun unnecessarily.|
|Data integrity|After all writes/cleanup, all 24 mapped table counts/checked row hashes/column definitions and FK metadata match the before snapshot. No identity reseed. Interrupted fixture cleanup recovered by exact ID journal. Only newly inserted synthetic account/player/league records were mutated. See DATABASE-CHANGES.md.|
|API contracts|7 controllers / 86 declared actions retain the exact original inventory hash. Actual read wire contracts separately verified.|
|Security|Full/prod frontend npm audits, functional-tool audit, main backend and all six tool transitive NuGet audits report zero known vulnerabilities. All 11 earlier alerts classified in SECURITY.md; GitHub-open alerts are not claimed closed before a push/rescan.|
|Local package|staging-package-accepted: 92 files, generated IIS web.config/net10.0 runtimeconfig, tested assembly and final production shell hashes match; excludes .env, tests/tools/node_modules/.git. Review ZIP and SHA256/manifest prepared. No deployment.|
|Known debt|Lint remains failing with 314 errors / 6 warnings; unit line coverage 14.51%. Native-device PWA, actual SMTP delivery, IIS/runtime inventory and production session carryover unverified.|

## Integration corrections and remaining acceptance

The user explicitly granted Development read/write testing authority, recorded in DEVELOPMENT-AUTHORIZATION.md. It persists for this project; no further Development approval is pending. Runners recognize it while checking the actual SQL target. Each run journals inserted IDs and cleans up only verified owned fixtures. All completed and recovered runs are accounted for in authorized-database-change-journal-final.json.

Actual integration caught defects that compiler/read-only checks did not: EF's shadow role column, unsupported empty MAX and grouped representative queries, and a typed-null rollback parameter. A concurrent test additionally proved the existing reset read/save pattern could accept one token twice; the atomic compare-and-consume correction now passes five competing pairs. The small player-browser header fix keeps a long league title from pushing Close outside mobile view; its grid was preserved. No Scrambler/scheduler algorithm or balancing rule changed.

The actual browser saved 16 generated games on 2028 dates while preserving 80 earlier games, added an existing profile to Silver, edited its name, confirmed removal and TXT-imported the same player ID into Gold. Actual browser modal screenshots cover 375/430/768/1280/1920/2560/3440; populated roster, schedule, import, directory, Scrambler, K/Q and home screenshots are in authorized-atomic-reset-acceptance/browser. No fixture API interception was used in this suite. Earlier 601-player / 10-width and exact print-parity suites remain complementary evidence.

Remaining work is environment/device staging acceptance: supported Windows/IIS and Hosting Bundle inventory, separate site/configuration, SQL certificate trust, Data Protection/session carryover, native-device installation/printing, and any designated external SMTP test only under separate authorization. Legacy password-hash strengthening and lint debt are documented maintenance follow-ups. Local acceptance is not proof of production compatibility.

No current compiler failure remains. Failed intermediate tests and their corrected results are preserved; only the named accepted artifacts establish acceptance. See README.md for reproducible commands, STATUS.md for the accepted recovery checkpoint, DATABASE-CHANGES.md for writes/cleanup and STAGING-AND-ROLLBACK.md for hosting and rollback. No commit, push, merge or deployment is authorized by completing this checkpoint.

## Team eligibility follow-up

The authoritative fixed roster relationship is LeagueTeamPlayer joined to LeagueTeam by team ID and scoped to LeagueTeam.LeagueID. The application has no separate active flag on fixed teams. Saved Scrambler participation uses separate KingQueenPlayer records. The picker excludes enrolled people with any fixed team in the selected league. The backend checks the same rule inside the existing serializable transaction. The restriction applies to future assignments and requires no cleanup or schema change for existing memberships. A conflict refreshes the picker while retaining filters and does not report a successful assignment.

The Development probe to localhost / LeagueScramblerDev failed during Windows Integrated connection setup before any query. No fixtures were created. The isolated Kestrel authorization checks confirmed anonymous and regular-account denial at the real endpoint. Real enrolled assignment, authorized cross-league cases, concurrent-write enforcement and historical readback remain unverified.

The Angular production build, 24 unit tests, .NET Release integration runner and both focused Edge suites passed. At 390 and 1280 px, populated score and profile captures covered all three themes. FAQ keyboard expansion and collapse, a hovered answer link, teammate profile navigation, four distinct dark score surfaces, and player eligibility refresh after a fixture conflict were checked. Sampled FAQ question colors reached 8.37:1 in Navy and 8.87:1 in Charcoal. Both teammate badge links exceeded 9.7:1 in each dark theme.

## Focused real Development runner handoff

The user confirmed the read-only SQL probe returned LeagueScramblerDev in Windows PowerShell. The focused .NET launcher compiled. It can be started from PowerShell without changing the AllSigned execution policy. The real SQL-backed scenario is awaiting execution in that Windows session. Its HTTP statuses, concurrent assignment outcome, history assertions and cleanup fingerprints will be recorded under the named authorized-team-* run. The earlier browser fixture and isolated HTTP authorization checks are separate evidence.

# Legacy baseline at 0d30bc9

## Final authenticated acceptance and restored Development baseline — 2026-11-22

The user authorized Development mutations; final local acceptance now includes actual synthetic account login/roles/permissions, membership/profile/import writes, schedule saves/conflicts/protection, Scrambler/scoring persistence and password reset rollback/consumption/replay/concurrency. `authorized-atomic-reset-acceptance/` records 59 checks / 64 HTTP requests and the real 11-group / 113-request browser run. Five token races each permit exactly one request. No intercepted APIs in that suite.

Before and final-after snapshots are authorized-development-before and authorized-final-database-after. All 24 mapped table counts/checked data hashes/column metadata and FK metadata match. Identity sequences were not reseeded. No schema migration or real account change occurred. DATABASE-CHANGES.md and the consolidated journal include failed/recovered runs; a shell interruption was explicitly recovered from saved owned IDs. Credentials were never exported; actual synthetic-token messages were removed after use/cleanup.

Final original-query checks still match 29 core queries, two retrieval lists and four autocomplete cases. The old EF 2 user model has no role shadow property, proving the explicit UserRoleId mapping fixes a real EF 10 convention regression. API inventory remains 7 controllers / 86 actions with the original hash. Final Angular unit, business/printing/worker checks and actual responsive screens are recorded in STATUS.md. Earlier baseline checkpoints below remain historical evidence; pending-permission statements are superseded by the explicit grant and completed acceptance.

## Legacy-to-.NET 10 comparison — 2026-11-22

Legacy assemblies remain in ignored modernization artifacts and were not replaced. Before backend source changes, captured **29 read-only ordered/unordered query fingerprints** with EF 2.2.6 across league IDs 37 and 133. Final EF 10 comparison passed all 29 with zero differences. Four additional legacy autocomplete fingerprints exposed four modern translation failures; after the explicit local-comparison boundary, all four match. No row payloads/credentials are stored. The independent history verifier matches **1,966 aggregate teammate pairs** against saved team memberships on the actual Development database.

Both the initial and final modern email/security checks passed. Seven controllers / 86 declared API actions retain the exact legacy SHA256 **9A64274A3AB42F36C9D14D4DE77F92B743AA3A34829B910ED9F1AEFE8605AB81**. Legacy Unicode PBKDF2, token expiry/trusted origins, both cookie schemes/tampering and actual local SMTP pickup HTML/plain MIME pass. No external messages or account writes occurred.

Real Kestrel/Startup/SQL integration passed **43 HTTP checks**: Admin and LegacyAdmin success, ordinary/unassigned Manager rejection, anonymous/expired-cookie rejection, eight legacy wire-JSON comparisons across both leagues, logout clears both schemes, SPA deep links and production-worker metadata caching. Synthetic claims use no real identity. Actual public browser routes passed with the production Angular 22 bundle and modern backend, without API interception or runtime/server errors; desktop/mobile screenshots exist. Protected browser flows are explicitly deferred because the UI needs database-backed synthetic account records. An initial protected-browser fixture without such an account was rejected by the existing guard; do not weaken that guard or label it a framework failure.

After all read tests, **24 mapped tables have identical counts and selected-row hashes; all FK metadata is identical** to the before snapshot. Artifact: `database-after-net10-comparison-final.json`. The first snapshot invocation was blocked by PowerShell execution policy; its incomplete comparison is not valid evidence. The explicit per-process read-script invocation succeeded and produced the final comparison. No schema/migrations/writes were performed. Identity sequences were not reseeded.

Evidence lives in `tests/functional/artifacts/modernization/`: `legacy-query-results.json`, `net10-query-final.json`, `legacy-search-results.json`, `net10-search-{before,fixed}.json`, `net10-history-read.log`, `net10-email-final/`, `net10-http-second/http-results.json`, `net10-http-second/browser/`, and final database comparison. These are selected query/read/auth-fixture results, not complete persistence/IIS/real-user proof.

## Continuation through Angular 21

Angular 18 development and production PWA verification passed before advancing (6 UI, 12 player/import, 7 matchup/print, 8 PWA groups). Angular 19 and 20 production checkpoints passed; Angular 20's actual service-worker suite passed 8 groups. Angular 21 production/development builds passed, followed by the same 6 UI, 12 player/import and 7 matchup/print groups. The rendered K/Q regression introduced by automatic control-flow tracking was corrected and regression assertions were added; see DECISIONS.md. Additional actual Angular 21 fixture-browser score navigation passed 12 groups, and Team Scores desktop/mobile preview passed. No database writes or real account/email operations were used.

The supported lint transition performed a clean unforced dependency install and `npm ls --all` passed. Before tailoring the two architecture style preferences, recommended rules reported 451 errors, 6 warnings, 0 fatal parser errors over 143 files. These counts are **not directly comparable** to the old formatting-heavy 4,427 findings: the supported ruleset differs. The two rules preferring standalone components and `inject()` conflict with the explicit preservation scope and are disabled with comments. Remaining findings are still reported; lint is not claimed to pass. Detailed reports and dependency recovery are in the modernization artifacts.

Master/origin/master were clean and identical. A separate worktree was created; original master remains unchanged.

| Check | Result |
|---|---|
| Angular 7 development build | Passed; original-worktree framework-modernization-baseline/development-build.log |
| Angular 7 production build | Passed; original-worktree framework-modernization-baseline/production-build.log |
| Backend Release build | Passed; original-worktree framework-modernization-baseline/backend-build.log |
| Scrambler invariant suite | Passed; baseline-scrambler.log |
| K/Q ranking parity | 72 combinations passed; baseline-kq.log |
| Schedule generator | 17 groups, 1000 simulations passed; baseline-schedule.log |
| Legacy Karma/Jasmine setup | Existing failure: references missing src/styles.css and a removed counter.component; recorded before migration |
| Current-base browser/security fixtures | Prior completed security review at this same application source: PWA 8 groups, management/import 12, schedule UI 5, application UI 6, import parser 35; evidence copied/referenced rather than pretending newly repeated |
| Database connection | Read-only identity verified: localhost / LeagueScramblerDev, Windows auth, actual SQL machine matches local computer; SQL 2019 version 15.0.2000.5; compatibility 130 |
| Database mutations | Not performed. Existing integration runners require fresh scoped approval |
| Real account login/inbox/device installation | Not newly tested; preserve these limitations |
| Before screenshots | Copied from recent actual rendered tests; git comparison confirmed application src unchanged between 2a000c6 and baseline 0d30bc9 |

Artifacts: tests/functional/artifacts/modernization/. Before screenshots: before/. Baseline source archive: baseline-source.zip. Existing SQL count probe initially used DbSet names; model mappings use singular table names, so the incomplete count probe is not evidence of missing tables and is superseded by the mapped schema baseline.

The current active backend has no IdentityServer4 registration. Existing application login uses custom Users/roles/player/league mappings, PBKDF2 password verification and two secure cookie schemes. No new identity schema or user migration is justified merely by old unused imports/dependencies.

## Angular 12 rendered checkpoint

Angular 12.2.17 production and development builds passed on isolated Node 14.21.3. The existing application UI browser suite passed all six groups, including K/Q week selection, local-calendar date controls, Scrambler rules and landing-page results. Its email preview uses the unchanged verified baseline template with an invalid placeholder token; this is visual evidence, not a claim that the modernized backend sender has been tested.

Player management/import browser checks passed all 12 groups using intercepted synthetic API fixtures. The parser passed 35 checks (TXT/CSV/XLSX/XLS and malformed/security fixtures). The player directory passed its 601-player browser scenario, including profile links and 10 viewport widths. The adaptive administration grid retained 3 columns at 375/390/430px, 5 at 768px, 8 at 1280px, 12 at 1920px, 17 at 2560px and 23 at 3440px; exceptionally narrow 320px uses 2.

Initial browser attempts found missing local fixture prerequisites (email preview files and parser-fixtures), not application failures. Prepared the baseline email preview and generated parser fixtures, then reran the affected suites successfully. Screenshot output: modernization/angular12-ui, angular12-player-browser and angular12-directory. Mobile collapsed Scramble Rules and desktop dashboard images were visually inspected. Real authentication, SQL persistence and modern backend integration remain pending.

The Angular 12 production PWA suite also passed all eight groups against the real generated service worker, including offline shell, uncached APIs, fixture login/logout boundaries, installation guidance, print/PDF and explicit update activation. These tests do not establish native device installation or real account authentication.

The read-only database inventory was expanded to include the three convention-mapped entities (LeagueSchedule, LeagueTeamScore and LeagueDivision). `database-before-complete` contains all **24** model tables, **0** missing tables, their counts/schema/hashes and SQL foreign-key metadata. The original 21-table snapshot remains available. No row payloads or credentials were saved and no SQL writes were issued.

The official TSLint conversion runs successfully with compatible pinned plugins. Its inherited rules report **4,427** legacy source lint errors across 83 files, with **0 fatal parser errors**; the main groups are brace style, member ordering, type-annotation spacing, curly braces and line length. This is not a passing lint result. Initially both same-root project targets selected the same source files; the e2e target now selects only e2e files. Detailed converted diagnostics and summary are local artifacts. Do not reformat thousands of unrelated lines or hide this backlog as part of framework compatibility work.

## Actual legacy EF/history read baseline

Built and ran the existing HistoryCheck against the unchanged legacy backend and the reverified local Development SQL target. Both reference leagues passed: 200/248 finalized teams, 777/986 saved membership rows, and 815/1,151 unique teammate pairs respectively. All **1,966 aggregate pairs** exactly matched the independent saved-membership calculation. Invalid and missing league requests were also checked. This runner was inspected for mutations before execution; it performs reads only, with no account or league changes. Build and result logs: legacy-history-build.log and legacy-history-read.log. Repeat this comparison with modern EF before accepting backend parity.

## Angular 15 / MDC checkpoint

Official Core/CLI/Material migrations and the explicit all-component MDC schematic completed. Corrected two malformed generated imports and an inline template quote produced by the schematics, without changing their behavior. Updated actual MDC surfaces/subscript areas, compact supported field density, existing navy colors/typography and the missed Scrambler LESS selectors. The application UI suite passed six groups, and player management/import passed all 12 groups after updating obsolete test-only Material selectors. No algorithm engine source changed.

The full matchup fixture passed generation, viewing, modification, retryable saving, membership validation, courts, retrieval, responsive dialogs, keyboard/focus, score display and printing. This is intercepted API fixture evidence, not actual SQL persistence. A measured MDC focus regression moved the page by seven pixels after closing; the unchanged Angular 7 build restored exactly. Restoring the actual opener with preventScroll and the captured scroll position fixes it without changing team or score logic.

The old committed print snapshot already fails against the unchanged current Angular 7 application. Preserved that failure and snapshot. Captured a fresh legacy baseline with build-file SHA-256 provenance; modern print PNG hashes and PDF page counts match it **exactly** at 2/4/6 matchups per page (4/2/1 pages for the fixture). Raw DOM HTML hashes remain diagnostic because framework serialization differs; exact pixel and page assertions are retained. Artifacts: angular7-matchups-baseline, angular15-matchups and legacy-print-provenance.json. Final source-stable Angular 15.2.10 production build passed. Angular 16 is next.

## Angular 16 checkpoint and account compatibility baseline

Angular 16.2.12 production build passed on isolated Node 16.20.2. Scrambler invariants, 72 K/Q ranking comparisons and 1,000 schedule simulations passed with its TypeScript toolchain; schedule mean 1.171 ms / maximum 3 ms for this run. Existing stylesheet budget warnings remain recorded.

Extended the existing UiEmailCheck with an independent fixed synthetic PBKDF2/SHA-1 vector (UTF-8 Unicode password, 10,000 iterations, 32-byte hash). The actual unchanged legacy controller accepts that vector and rejects a wrong password/tampered hash. Legacy email/security utility build and all five groups passed using SMTP pickup only. HTML/plain alternatives, trusted origins, encoding and token expiry fixtures passed; actual token consumption/persistence is still unverified. Logs: legacy-email-build.log and legacy-email-test.log. No account lookup, real message or database mutation occurred.

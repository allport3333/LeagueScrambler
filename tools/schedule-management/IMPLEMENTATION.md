> The UI and conflict/replacement rules were subsequently refined. See [Schedule redesign and false-conflict repair](SCHEDULE-REDESIGN.md) for current behavior and validation.

# Manage Schedule implementation and verification

Implemented on existing master; no commits, merges, pushes, production changes or deployments.
Initial working tree was clean (e78c512). Existing player browser/import/edit features are preserved.

## Architecture and persistence

- Ordinary games remain in dbo.LeagueSchedule: league/week/DateTime/two team FKs/MatchDescription. The existing Statistics/GetLeagueSchedule/{leagueId} contract is retained with additive events and actual team-division fields.
- LeagueTeam.Division is a string. It is resolved only against this league's uniquely matching LeagueDivision code/name; unconfigured strings retain a distinct actual-team division key. No gender or player-membership inference. No fixed number/names of divisions.
- Existing scores link teams/opponent/date, not a persisted schedule ID. Reliable exact pairs are protected on their date. Incomplete legacy identity conservatively protects matching team/date. Scored games cannot be edited or removed, including notes/week changes.
- The schema decision was recorded in ARCHITECTURE.md before implementation. Standalone events require the additive dbo.LeagueScheduleEvent table because ordinary games require two non-null team FKs. No fake tournament teams, altered historical games or score migrations.
- 001-schedule-events.sql is idempotent and non-destructive. It was applied ONLY to verified localhost / LeagueScramblerDev. This empty support table intentionally remains; owned synthetic records were removed. Production requires separate migration review/execution before persisted events are enabled. Without the table, ordinary games/viewers remain usable and events show an explicit unavailable capability.
- No structured court/location field exists; existing matchup notes hold those details. Existing DateTime time-of-day survives edits. No new court model or score/standings calculations.

## Workflows

Five management tabs: Edit / Remove Players; Add Players; Manage Schedule; League Settings; League Setup.
Manage Schedule contains Import Schedule, Create Schedule and Edit Schedule in place.

Creation supports round robin, balanced opponent cycles and manual rows. Configure weeks, first date/weekday, games per team per week, included divisions, per-division overrides, excluded dates and explicit special dates. Special dates generate standalone Tournament/Playoffs/NoGames/Other entries and are excluded from ordinary game dates. Randomized circle rounds cover all opponents before repeating; complete cycles give equal pair frequency; odd divisions rotate one round bye. Ordinary generation is bounded to 128 included teams/1,000 records, 104 weeks and 10 games per week; small divisions cannot repeat a pair on the same date because scores could not distinguish those occurrences.

The unconstrained Balanced Opponents method uses the same fair circle cycles as Round Robin; it does not introduce a second arbitrary scheduler. The 14-team ten-week fixture creates 70 games; 8+8 creates 80; 8+6+7 creates 100 with odd-division byes. Different division calendars/counts are independent.

Crossings are off by default. Enabling them requires explicit allowed division pairs, every-N-weeks frequency beginning in week one, and crossing games per round. Automatic crossing currently requires aligned division calendars/weeks/games. Existing team-score calculations can count cross-division outcomes without changing team divisions. Crossed residual rounds use a randomized low-repeat/bye-aware heuristic; a global optimum is NOT claimed. A failed attempt is explicitly inconclusive and offers regeneration/reduced constraints, not false proof of infeasibility. Arbitrary blackout/opponent constraint optimization is not implemented.

All generated/imported rows are unsaved previews. Editable dates/weeks/opponents/division context/notes/events, per-row Review/Edit, ID-based team selection, source text, attention counts, all/individual division and week filters. Row division selection filters teams but never changes team assignments. Fuzzy suggestions only prioritize choices; only unique normalized exact team matches are automatic. Unknown/ambiguous teams and division mismatches require review.

Save requires explicit confirmation of additions/edits/removals. Atomic API operations support Add New Games, scoped Replace Future Unplayed Games and explicit Edit Schedule updates/deletes. Replacement retains past/scored games, untouched divisions and existing events. Swapping opponents can be done by editing multiple preview rows before the single save. A revision covers teams/divisions/schedules/protected results; stale previews return conflict. A serializable SQL transaction and the existing league score-save application lock coordinate saving. Duplicate pair/date, weekly appearance limits, self-match, foreign team/division and NoGames conflicts are checked server-side. Save ambiguity preserves the draft and requires reload, never an automatic retry. Unsaved drafts survive tab/league changes within the management instance; they are not permanently stored offline.

## Import/export and safety

Automatic local parsing: TXT, CSV, XLSX and binary XLS via existing pinned SheetJS CE 0.20.3 bounded worker. No added packages/framework upgrades. Worksheet choice, explicit column mapping/start row and ISO/MDY/DMY/Excel serial dates. CSV quoting/Unicode and workbook formula/cached-value protections remain inherited from the existing parser.

TXT examples:
    Week 1 | 2027-01-03
    Division: Your Division
    Existing Team A vs Existing Team B
    Week 6 | 2027-02-07
    Existing Team C v Existing Team D
    Tournament: Team Tournament

Structured tables use Week, Date, Team 1, Team 2; optional Division, Notes, Type and Event. Headerless/ambiguous tables require mapping. Unknown teams are never created. Metadata never overwrites team/player profiles. Date interpretation is explicit rather than guessing ambiguous dates.

PDF, PNG and JPG are REFERENCE-ONLY, with explicit week-by-week transcription. There is no installed/supported PDF text extraction or OCR service/toolchain and no automatic two-column image interpretation. This limitation is stated in the UI. Images display locally; PDF users read their PDF viewer and transcribe. The earlier reference image is not available as a local artifact in this session; the existing compact Full Schedule layout was preserved as the visual basis.

Structured files: 2 MB, 1,000 records (worker physical-row limit 1,024), 20 columns, 32 sheets; existing archive inflation/cell bounds and 12-second worker timeout. Reference files: 5 MB; format signatures and 20-million-pixel image bound. Content stays local, not uploaded for permanent storage. No macros/formulas/external resources are executed. Escaped Angular text and print HTML; CSV formula-prefix escaping; XLSX plain string cells. SameOrigin and existing LeagueManagement/LeagueAccess checks guard writes and league scope. No new permissions or identity changes.

CSV/XLSX export includes week/date/division/teams/notes/type/event; selected division or entire league. XLSX export successfully reimports to the preview; existing games are flagged as duplicates and cannot be saved again. Exports/printing use the whole selected division regardless of a temporary attention/week preview filter, preserving the complete-season intent.

Print uses the shared compact two-column weekly layout with one title, thin borders, division headings and standalone events, no application/roster controls. Entire league or individual division is available in management and existing Full Schedule; event-only divisions and No Division also remain selectable. Generated byes are shown in management preview/print metadata. Byes are NOT persisted independently: an absent team in a historical saved week cannot reliably be distinguished from an intentionally unscheduled team, and no invented bye records are created. Browser popup printing must be allowed.

## Actual verification

| Check | Result |
|---|---|
| Angular 7 development build | Passed |
| Angular production/AOT build | Passed |
| .NET Core 2.2 backend build, isolated output | Passed |
| Schedule engine | 17 checks + 1000 independently generated schedules passed |
| Ordinary generation timing | Mean 0.938 ms; max 4 ms in this fixture run; 1000/1,000 distinct sampled first-round arrangements (simulation evidence, not a uniformity claim) |
| Shared player-file parser/security regression | 35 checks passed; no external requests |
| Existing player browser/import/edit UI regression | Passed; 0 page errors |
| Manage Schedule / existing Schedule browser fixture | Passed; 0 page errors |
| Responsive schedule preview | 375, 430, 768, 1280, 1920, 2560, 3440 px; no section/page horizontal overflow |
| Existing player browser responsiveness | 320 through 3440 px; 3 phone columns, up to 23 ultrawide columns retained |
| Shared viewer derived filters | No Division, event-only division, both sides of a cross-division game, all-league restoration passed |
| Real SQL integration | Passed; cleanup confirmed |
| Generated PDF, entire league | 100 matchup rows; 2 pages |
| Generated PDF, Gold only | 40 matchup rows; 1 page |
| Diff whitespace check | Passed |

Browser tests render the real compiled Angular application with intercepted synthetic HTTP fixtures; they are not actual login testing. They exercise no-save-before-confirmation, invalid/unknown CSV rows and clickable attention filters, protected result controls, editing notes, manual standalone-event row, reference-only PDF behavior, CSV/XLSX download/reimport and duplicate blocking, retained tab drafts, existing Schedule/Full Schedule filtering/navigation and existing player add/edit/import/settings/setup workflows. Phone, desktop and ultrawide screenshots were captured and representative screenshots reviewed. The final viewer-only change also has targeted executable class tests; the compiled development/production builds include it.

Real persistence used Windows-authenticated Development SQL on localhost / LeagueScramblerDev after fresh runtime/config/machine verification and the user's existing development-write authorization. The guarded test created only run-prefixed synthetic leagues/teams/divisions, saved the TypeScript-generated 80-game 8+8 fixture, retrieved every exact team/week/date, tested stale/duplicate/foreign/crossing failures, edited an unplayed game retaining ID, wrote a 15?11 result through the existing score controller, protected the scored game, verified another unplayed opponent on the same date remains removable, stored tournament/NoGames events, blocked event conflicts, and replaced only future unplayed Gold games. 7 integration stages/check groups passed.

Cleanup checked run-owned IDs/names and foreign references, removed only fixture scores/schedules/events/teams/divisions/leagues, then verified a SHA-256 snapshot of all preexisting league/team/schedule/score/division/event rows matched. Shared players/accounts/credentials were not changed. The first fixture attempt hit the existing 50-character team-name limit; fixture names were shortened, cleanup verified, and subsequent full runs passed. The additive Development event table is intentionally retained empty. No production writes.

The running Visual Studio Development app was independently reverified at PID 7568 (localhost:5001), newer assembly than the controller source, localhost / LeagueScramblerDev. New schedule API returns 401 anonymously, nonexistent route returns 404, existing schedule read returns 200. No unrelated process was stopped. No claims of real user authentication, physical device or installed-PWA verification. Browser fixture role restrictions and direct controller authorization checks passed; full live authenticated manager/admin workflow remains for manual review. Existing Scrambler's large simulation suite was not rerun because its algorithm is untouched. Unrelated authentication, attendance and scoring UI tests were not rerun/claimed.

Build warnings are pre-existing outdated Browserslist data and legacy .NET/package vulnerability warnings; see build logs. No dependencies changed to hide them. No deployment performed.

## Files and evidence

Frontend: app.module.ts; DTOs.ts; scrambler parent tab/draft binding; new schedule-management/schedule-engine.ts and manage-schedule.component.ts/html/css; league-schedule component integration + shared schedule-print.ts; existing roster-worker.js adds only bounded schedule export.
Backend: new ScheduleManagementController.cs, Models/ManagedSchedule.cs, DataContext event DbSet, StatisticsController existing read delegation. Supporting migration/guarded test project here; test scripts under tests/functional/scripts.

Detailed JSON/logs/screenshots/PDF/CSV/XLSX artifacts: tests/functional/artifacts/schedule-management/.
Representative screenshots: manage-375.png, manage-1920.png, manage-3440.png.
Print evidence: season-all.pdf and season-gold.pdf; print-results.json.
Existing player regression: tests/functional/artifacts/player-import/results.json.

Reproduce non-writing checks:
    tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/schedule-engine.cjs
    tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/schedule-viewer.cjs
Set PLAYWRIGHT_BROWSERS_PATH to tests/functional/.tools/browsers before browser/parser scripts.
Run existing-player-browser.cjs schedule for full schedule + player browser fixture checks.
Run existing-player-browser.cjs import with LEAGUE_TEST_DIST pointing to the schedule development-dist for player-import regression.
Development build: from ClientApp, node node_modules/@angular/cli/bin/ng build --preserve-symlinks --progress=false --output-path=../../tests/functional/artifacts/schedule-management/development-dist
Production: same command with --prod and production-dist output.

Real SQL checks are not automatic: check-schedule-database.ps1 -ApprovedDevelopmentDatabase requires continuing explicit Development authorization and reruns fresh process/config/database verification. Do not repoint it to another target or reuse an expired/mismatched approval. It may add the event support table and intentionally retains that schema; fixture data is cleaned up with ownership checks. Production migration/deployment still requires separate authorization.

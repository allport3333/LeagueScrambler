# Manage Schedule redesign and false-conflict repair

Current master, uncommitted. All preexisting uncommitted work preserved. No branch/worktree creation, merge, push or deployment. The urgent date-conflict correction was incorporated into the ongoing workflow redesign.

## Exact cause and read-only reproduction

Verified Development runtime and local Windows-authenticated SQL: localhost / LeagueScramblerDev. Inspected league **133, WW Test League** using read-only application-model queries. No real league records were changed.

| Existing schedule | Proposed preview |
|---|---|
| 96 games, 16 teams (8 actual Gold, 8 actual Silver) | 80 games, same team IDs/divisions |
| October 8-December 24, 2026, Thursdays | May 23-July 25, 2027, Sundays |
| Week labels 1-12 | Week labels restart at 1-10 |
| 48 matchups have saved results | 40 Gold and 40 Silver games |
| 8 additional past games have no recorded results | 24 expected repeated opponent matchups |
| 40 future unplayed games as of November 20, 2026 | **Zero actual date overlaps** |

The original TypeScript validateSchedule counted combined saved/preview games using g.weekNumber === e.weekNumber, ignoring their dates. The backend independently repeated the same mistake in final.Count(g => g.WeekNumber == e.WeekNumber ...). Component existingForValidation supplied the entire league history, with maxGames = 1. Matching Week labels therefore falsely invalidated every new team appearance.

The old replacementIds/backend replacement query removed every future unscored game in selected divisions, without a preview date window. Removing the 40 games from saved Weeks 8-12 left 56 past games in Weeks 1-7. Those labels falsely blocked 56 proposed games. This independently reproduces the user's exact **80 conflicts - replace 40 - 56 conflicts** using the real Development records, not an inferred example.

Existing schedule details:

| Week label | Actual date | Games | With saved results | Old future replacement eligibility |
|---|---|---:|---:|---:|
| 1 | 2026-10-08 | 8 | 8 | 0 |
| 2 | 2026-10-15 | 8 | 8 | 0 |
| 3 | 2026-10-22 | 8 | 8 | 0 |
| 4 | 2026-10-29 | 8 | 8 | 0 |
| 5 | 2026-11-05 | 8 | 8 | 0 |
| 6 | 2026-11-12 | 8 | 8 | 0 |
| 7 | 2026-11-19 | 8 | 0 | 0 |
| 8 | 2026-11-26 | 8 | 0 | 8 |
| 9 | 2026-12-03 | 8 | 0 | 8 |
| 10 | 2026-12-10 | 8 | 0 | 8 |
| 11 | 2026-12-17 | 8 | 0 | 8 |
| 12 | 2026-12-24 | 8 | 0 | 8 |

Past dates without scores do not prove whether games physically occurred; they are still protected from automatic replacement. Exact team IDs, division keys, schedule IDs and per-game protection flags are in development-schedule-inspection.json; no personal account details, credentials or reset tokens are included.

## Validation changes

- Displayed Week labels are presentation metadata and may restart. They do not define a unique season or scheduling period.
- Both frontend and backend enforce the explicit games-per-team-per-week limit using **ISO calendar weeks, Monday through Sunday**, identified by the actual calendar start date. No arbitrary season boundaries, new season fields or database migrations were introduced. Date-only UTC arithmetic in the frontend and DateTime.Date in the backend agree across year/weekday boundaries.
- Same team/pair on the same date remains a duplicate. Different opponents in one actual calendar period exceed the limit unless the administrator explicitly permits multiple games. Opponents can meet again on a later nonconflicting date. Week-label differences alone do not make appearances incompatible.
- Cached period keys avoid repeatedly parsing every date during validation. Existing generation/randomization, division membership, fair repeats and bye rotation are unchanged.
- Replacement is constrained to selected divisions **and each division's earliest/latest actual preview game dates**, plus today-or-later and no saved results. Both teams of a cross-division game must be inside the selected scopes/windows. Unrelated earlier/later schedules, past games, scored games and other divisions are retained.
- For this real May preview, Add is valid and replacement targets **zero** existing records, rather than the old 40. The UI explicitly says replacement is unnecessary when no eligible records fall in the preview range.
- New structured conflict details name the affected team, preview date, saved game ID/date/opponents, calendar period and weekly limit, with a resolution. Concise counts appear above the preview; detailed messages are collapsed until requested, avoiding a repeated paragraph beneath every matchup.
- Expected repeat-opponent counts are explicitly separate from errors. Eight-team, ten-week divisions necessarily repeat some opponents; the 24 repeats do not block saving.

Actual read-only revalidation: **80 valid proposed games, 0 conflicts, 0 replacement candidates**. All 96 original games and 48 scored matchups remain intact. The real league was not saved, regenerated, replaced or otherwise modified.

## Simplified workflows and Save behavior

Create Schedule, Import Schedule and Manage Existing are distinct views with independent drafts. Empty leagues default to Create; existing schedules default to Manage Existing. Switching workflows or League Management tabs preserves configuration, matching state and unsaved previews. Save/loading callbacks remain scoped to their original league; changing leagues invalidates pending local work safely.

Basic Create shows only populated divisions, First Game Date, Number of Weeks, a short rule description and Generate Schedule Preview. Empty divisions are compactly noted, not large cards. Balanced Round Robin defaults to one game per team per week within its division. First actual date determines the default weekday; explicit conflicting weekdays and an excluded first playing date are explained instead of silently shifting the start date.

Advanced Scheduling Options is collapsed by default and retains method/manual mode, games per week, exclusions, individual-division calendars, special events and explicit cross-division rules. Collapsing does not reset values. Configuration changes after generation do not mutate the displayed preview or unexpectedly change its validated games-per-week limit; a notice asks the administrator to regenerate to apply them.

The preview uses compact weekly/division tables, two columns on desktop and one on mobile. It includes weeks, matchups, participating teams, division totals, expected repeats and inspectable bye/opponent summaries. Rendering uses Angular view lifecycle to scroll/focus the preview, without a fixed timeout.

Save is prominent in a sticky preview action area. Every disabled Save has a specific associated explanation, including permission, loading/file processing, no preview, invalid rows, unresolved operation, genuine conflicts, pending saves or ambiguous failures. Necessary authorization and validation are preserved.

An existing schedule requires an explicit Add New Games / Replace Future Unplayed Games choice. Safe nonoverlapping Add is enabled; replacement is never forced just because teams or week labels repeat. Confirmation names the league, operation and additions/edits/removals. Successful saves open the refreshed Manage Existing view. A rejected request retains the preview; transport/stale ambiguity requires reloading saved data before retrying. Reload retains the preview and rechecks conflicts instead of silently deleting it. Stale saved-game edit drafts are not automatically rebased over another administrator's changes.

Manage Existing contains saved schedules, filters, protected edit actions, printing, CSV/Excel export and reload. Creation controls are absent. The existing import parser, worksheet/column mapping, matching, source data and review remain. A bounded original workbook buffer is retained in memory so changing worksheets still works after switching views or reusing the export worker; no re-upload is required. It is not permanently stored or uploaded to a new server service.

## Verification performed

| Check | Result |
|---|---|
| Before-fix actual-record reproduction | Exact 80 / 40 / 56 reproduced; zero actual date overlaps |
| After-fix actual-record analysis | 80 valid, zero false conflicts, zero unrelated replacement candidates |
| Component/state regressions | 18 checks passed |
| New calendar/replacement tests | 10 checks passed |
| Schedule engine/invariants | 17 checks + 1,000 simulations passed; mean 1.169 ms, max 3 ms |
| Rendered workflow browser | 6 groups passed; 0 page errors |
| Rendered exact May scenario | Passed: Add saves 80 synthetic games; 96 original fixture games remain byte-for-byte unchanged |
| Genuine duplicate/period limits | Rejected, precise saved-game/date details shown |
| Division-scoped May replacement | Exactly 40 Gold games; all winter/scored/Silver fixture records retained |
| Responsive layout | 375, 430, 768, 1280, 1920, 2560 px; four workflow states captured; no page/section horizontal overflow |
| CSV/XLSX/worksheet regression | Upload/match/review/export/reimport and multi-sheet state after workflow/export changes passed |
| Existing player import/browser/edit regression | Passed on the redesigned build; existing player components/parser unchanged |
| Shared printing / Schedule / Full Schedule | 100 games / two-page PDF, Gold 40 / one-page PDF; existing division filtering/navigation passed |
| Frontend development build | Passed |
| Frontend production/AOT build | Passed |
| Current backend build | Passed |
| Real authorized Development SQL test | Passed; 8 stages/check groups; owned cleanup confirmed |
| Whitespace check | Passed |

SQL verification used the existing guarded utility, fresh runtime/config/database identity verification and the user's continuing explicit Development-write authorization. Only run-prefixed synthetic leagues/teams/divisions/games/results/events were written. It appended 80 May-July 2027 games with the same team IDs and restarted Week labels, preserved prior records, rejected actual same-period double bookings, verified scored-game protection and date-bounded Gold replacement, and proved an unrelated September replacement removes no earlier games. A SHA-256 snapshot of preexisting league/team/schedule/score/division/event data matched after owned cleanup. No real player accounts, passwords, memberships or real league schedules/scores were changed. The additive event table from the preceding task already existed; this correction requires no schema change.

The full browser fixture also verifies failure/retry behavior, disabled reasons, workflow draft separation, advanced-value retention, default weekday/date, actual exclusion handling, locked existing games, unplayed note editing, safe save confirmation, XLSX roundtrip, switching workbook sheets after export worker reuse and ordinary player-management regression. Browser HTTP is intercepted synthetic data, not a claim of real authenticated API usage.

The old Visual Studio backend would otherwise continue using the old rule despite a frontend rebuild. Only the verified original Development debug session was stopped, current source was built, and the same solution/debug configuration resumed. COM briefly exposed a null Solution during asynchronous debugger teardown; reacquiring DTE completed the build/restart. The app is running at localhost:5001, verified Development / localhost / LeagueScramblerDev, **PID 16940**. Anonymous management access remains 401; public league 133 schedule read remains 200 with its original 12 dates and 96 games. No unrelated process was terminated.

## Evidence and limitations

- Logs/JSON/PDF/screenshots: tests/functional/artifacts/schedule-redesign/.
- Real before/after: real-date-conflict-reproduction.json, real-date-conflict-verification.json; complete read-only records: development-schedule-inspection.json.
- SQL: database-results.json and database-run.log; workflow browser: workflow-browser-summary.json; exact scenario: calendar-browser-results.json.
- Print: season-all.pdf, season-gold.pdf, print-results.json.
- [Mobile basic creation](../../tests/functional/artifacts/schedule-redesign/create-375.png), [desktop basic creation](../../tests/functional/artifacts/schedule-redesign/create-1920.png).
- [Mobile advanced settings](../../tests/functional/artifacts/schedule-redesign/advanced-375.png), [desktop advanced settings](../../tests/functional/artifacts/schedule-redesign/advanced-1920.png).
- [Mobile preview](../../tests/functional/artifacts/schedule-redesign/preview-375.png), [desktop preview](../../tests/functional/artifacts/schedule-redesign/preview-1920.png).
- [Mobile saved schedule](../../tests/functional/artifacts/schedule-redesign/existing-375.png), [desktop saved schedule](../../tests/functional/artifacts/schedule-redesign/existing-1920.png).
- [May 80-game preview with Save enabled, mobile](../../tests/functional/artifacts/schedule-redesign/may-add-valid-375.png), [desktop](../../tests/functional/artifacts/schedule-redesign/may-add-valid-1920.png).
- [Actual conflict details fixture](../../tests/functional/artifacts/schedule-redesign/genuine-conflict-details.png).

No actual real-user login or production testing was performed. No real WW Test League schedule was saved; that final authenticated confirmation remains for the administrator. The same save controller has been exercised successfully against real Development SQL using owned synthetic data. PDF/image automatic extraction remains unavailable (reference/transcription only), and structured courts still use existing notes; those preceding limitations are unchanged. Existing legacy package/Browserslist build warnings remain; no dependency upgrades were introduced.

Main changes: schedule-management/manage-schedule.component.ts/html/css, schedule-engine.ts validation/replacement helpers, ScheduleManagementController.cs validation/replacement helpers, and targeted scripts/guarded test cases. The round-robin generation implementation, existing save contracts, scoring/standings calculations and authentication are preserved.

Reproduce the non-writing tests with tests/functional/.tools/node-v22.23.5-win-x64/node.exe:
- tests/functional/scripts/schedule-component.cjs
- tests/functional/scripts/schedule-calendar-conflicts.cjs
- tests/functional/scripts/schedule-engine.cjs
Browser tests: set PLAYWRIGHT_BROWSERS_PATH to tests/functional/.tools/browsers, LEAGUE_TEST_DIST to the compiled schedule-redesign/development-dist, LEAGUE_TEST_OUT to schedule-redesign artifacts, and SCHEDULE_UI_ONLY=1. Run existing-player-browser.cjs schedule with SCHEDULE_UI_MODULE=./manage-schedule-ui.cjs or ./schedule-calendar-ui.cjs.
Real SQL tests require verified Development and continuing explicit authorization; the guarded check-schedule-database.ps1 -ApprovedDevelopmentDatabase never targets production and verifies fresh process/configuration identity. Do not repoint it or bypass stale/mismatched approval checks.

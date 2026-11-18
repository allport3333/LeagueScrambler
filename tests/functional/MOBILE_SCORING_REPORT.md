> Superseded scoring interaction: [automatic winners](AUTOMATIC_WINNERS_REPORT.md) now replace manual Won checkboxes; unscored inputs start blank. Historical build/test results below belong to the preceding phase.

> Desktop layout descriptions below cover the initial mobile phase and are superseded by [the combined report](COMBINED_SCORING_REPORT.md). Mobile behavior remains current.

# Mobile King/Queen Manage Scores — November 18, 2026

## Completed interface
Inside the existing Scrambler Manage Scores tab, phones (767px and below) now edit one saved opposing matchup at a time. Previous / Match N of M / Next follows the existing adjacent team positions, with first/last boundaries disabled. Teams use their saved KingQueenTeamId values; team IDs need not be consecutive.

Following the requested refinement, **Player and Substitute Settings is above the score grid and opens by default**. Both team rosters and original player order are immediately available, with blue/pink rows, substitute indicators and individual switches. The section can be collapsed to concentrate on scoring. A newly retrieved scramble starts open again.

The comparative Round / Team N / Team N grid places opposing score inputs and independent Won checkboxes together. Inputs use numeric keyboards and comfortable touch sizes. Totals use the existing calculateTotalScore/calculateTotalWins methods. Save Round Scores remains at the bottom and saves all score records for the selected scramble, not only the visible pair. Bye players and an unmatched final team remain explicit; no opponent is fabricated.

Desktop retains the existing two-column scoring tables, rosters, score/win/sub controls, totals and save location. Mobile markup is separate and CSS hides only the inappropriate presentation. Both layouts call the same existing handlers and read the same kingQueenRoundScores objects. Desktop typing was verified to appear in mobile, and mobile typing in desktop. No second scoring model, automatic winner calculation, ranking or standings algorithm was introduced.

## Saved pairing and data handling
The current GetKingQueenTeamsByScrambleNumber API already returns saved teams in the ID order used by SaveKingQueenTeams. Existing desktop places adjacent retrieved positions in opposing odd/even columns. Mobile pairs those exact retrieved positions without re-sorting or inferring opponents from names/ID arithmetic. Tests use nonconsecutive IDs 211,218,225,232... and verify stable score associations.

Match navigation only changes the displayed pair index. It does not initialize, copy, clear or save scores. Unsaved scores and independent win flags remain in the shared array. Canceling a scramble or league change preserves them; confirming discards the old scoring context. Starting a new generated scramble also protects pending score edits. Busy saves/substitute requests block incompatible context changes. Stale retrieval responses are ignored/canceled.

## Confirmed entry/save problems addressed

1. Changing Number of Rounds previously called initializeScores again, rebuilding the array from retrieved records and losing unsaved input. For the active saved-scramble editor, displayed rounds now change without resetting entered values. Decreasing the display count hides rather than deletes historical/entered rounds; increasing it exposes the same retained values. A visible notice says hidden round scores are retained and included in Save. The existing API has no round-deletion operation.
2. Retrieval previously used only the first team's score-record count to set Number of Rounds. Incomplete first-team data could hide later recorded rounds, and a completely unscored scramble could produce zero editable rounds. Retrieval now uses the highest saved round ID across all teams, or the existing selected/default five rounds when none exist. Missing rounds in a partially scored team stay blank. Completely unscored teams retain the existing zero/false initialization behavior.
3. A Won click on a missing score previously had no row to update. It now stages the manual flag with an unentered score, requiring an explicit whole-number value before Save rather than silently inventing a zero. Legitimate zero and manual winning flags remain supported; no winner is inferred from opposing numeric scores.
4. The existing save response echoes request rows, so newly inserted score records can retain temporary ID0 in the response. Repeating that payload could insert duplicates. After confirmed Save, the editor re-reads saved teams and resolves IDs by unique team ID + round ID before permitting another Save. Missing/ambiguous IDs or read failure block unsafe resubmission and offer Refresh Saved Records without clearing entries or issuing another write.
5. Saving is guarded against repeat clicks. Failures retain input and show inline feedback. Success is shown only after confirmation and record-ID verification. The original ordinary success snackbar is retained; new errors use inline feedback rather than the site's oversized error overlay.

These are frontend state/persistence safeguards. Existing backend routes, request structures, integer score model, nullable historical win results, save authorization and score/standings calculations are unchanged.

## Substitute flags
The existing UpdateKingQueenPlayerSubStatus operation persists each switch immediately, independently of Save Round Scores. This behavior is preserved and explained above the roster controls. Switches use the original saved team/player IDs, disable while pending, update the shared player state and restore the last confirmed state on failure. Match navigation does not undo them. Discard confirmation explicitly states that already-saved substitute changes are not undone. Save Round Scores does not silently assume it is responsible for persisting those flags.

## Verification actually executed

- **Angular development build passed** after the final requested open-roster/placement change.
- **Angular production/AOT build passed** after that same final source state.
- Existing outdated Browserslist warning remains; no dependencies were changed.
- **10 grouped focused scoring workflow checks passed:** nine main workflow groups plus one unscored/empty-team group. An additional read-only capture check passed.
- Viewports: mobile375/390/430 and desktop1366/1920.
- Coverage: saved scramble selection; all12 saved teams/six pairs; original/missing score loading; shared desktop/mobile input; independent win flags and totals; next/previous boundaries; no navigation writes; player order/Sub immediate save/failure rollback; round count retention; all-team Save; failed Save/retry/double-click prevention; saved-ID refresh and safe read-failure recovery; repeated Save without duplicate fixture inserts; cancel/confirm scramble and league changes; canceled generation preserving scores; persisted fixture reload; unmatched team/bye; completely unscored defaults/all60 rows saved; empty returned teams disabling Save; rosters initially open above the grid and manually collapsible.
- Zero browser page errors. All write requests in these tests were intercepted and changed only deterministic in-memory fixture records. All other APIs were also intercepted; no SQL or real record mutations occurred. No expired mutation authorization was reused or isolation guard bypassed.

**Unverified:** live LeagueScramblerDev persistence, actual backend/database readback, SQL authorization/concurrency, existing real historical data anomalies and device-native keyboard behavior. The numeric keyboard hint is present, but no physical phone was used. No full regression suite was run. Backend source was not changed, so no backend build/migration was needed for this task.

The pre-change desktop screenshot fixture exposes the old first-team incomplete-round bug (one displayed round); the updated screenshot correctly displays all three recorded round IDs. These are not pixel-identical screenshots: the desktop table structure/styles are preserved, while that verified data-loading defect is corrected.

## Screenshots

| Requested view | Evidence |
|---|---|
| Desktop before1366 | [Before](mobile-scoring-evidence/desktop-before-1366.png) |
| Desktop after1366 | [After](mobile-scoring-evidence/desktop-after-1366.png) |
| Desktop before/after1920 | [Before](mobile-scoring-evidence/desktop-before-1920.png) / [After](mobile-scoring-evidence/desktop-after-1920.png) |
| Mobile complete editor / rosters initially open above scores | [390px](mobile-scoring-evidence/mobile-editor-390.png) |
| Other phone widths | [375px](mobile-scoring-evidence/mobile-editor-375.png) / [430px](mobile-scoring-evidence/mobile-editor-430.png) |
| Scramble controls / dropdown | [Selection](mobile-scoring-evidence/mobile-scramble-selection.png) / [Open dropdown](mobile-scoring-evidence/mobile-scramble-dropdown.png) |
| Comparative score grid | [Grid](mobile-scoring-evidence/mobile-comparative-grid.png) |
| Player/substitute controls | [Default open](mobile-scoring-evidence/mobile-rosters-default-open.png) / [Sub setting and failure rollback](mobile-scoring-evidence/mobile-player-sub-settings.png) |
| Collapsed roster for compact entry | [Collapsed](mobile-scoring-evidence/mobile-rosters-collapsed.png) |
| Match navigation | [Navigator](mobile-scoring-evidence/mobile-match-navigation.png) |
| Save area / confirmation | [Save](mobile-scoring-evidence/mobile-save-area.png) / [Saved](mobile-scoring-evidence/mobile-save-success.png) |
| Unsaved entries after return | [Retained](mobile-scoring-evidence/mobile-returned-unsaved.png) |
| Unmatched team | [No invented opponent](mobile-scoring-evidence/mobile-unmatched-team.png) |

All captures contain synthetic data. Browser result JSON files are in mobile-scoring-evidence/. Build logs: artifacts/mobile-scoring-development-build.log and mobile-scoring-production-build.log. Production output is local ClientApp/dist only; Publish was not run.

## Files and resuming
Changed application source only: ClientApp/src/app/scrambler/scrambler.component.ts, .html and .less. Focused test infrastructure extended tests/functional/scripts/scrambler-workspace.cjs; evidence, this report and WORK_LOG.md updated. All previously pending work was preserved.

The final build is production mode. Before rerunning the fixture harness, build the existing ClientApp in development mode, because inspection helpers use Angular development debugging facilities:

```powershell
# From the existing ClientApp directory, using its existing Angular Node environment:
npm run build -- --progress=false
# Then from repository root:
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/scrambler-workspace.cjs scoring-after
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/scrambler-workspace.cjs scoring-empty
```

Do not overwrite scoring-before evidence by rerunning its baseline mode against the changed application. Save existing work before manually refreshing a browser; full reload/closing a tab is not new persistent draft storage. Scores remain in memory until Save and cannot survive a full application reload unless persisted.

No backend, authentication, roles, shared legacy password, database schema, historical records, production/IIS/Cloudflare/deployment configuration changes. No packages installed, publish, deploy, commit, push or merge. Task complete.
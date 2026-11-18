# Scrambler results placement, mobile viewer and saving

November 18, 2026. Focused follow-up to MATCHUPS_MODAL_REPORT.md.

## Completed changes

- Moved the single existing Scramble Results section directly below the generate action, before Reset Players and the player/retrieval/score tabs. Its identifier, counts, viewer/editor actions and Print Settings are preserved.
- The same summary is used for newly generated and retrieved scrambles. Successful generation/retrieval expands it and scrolls smoothly only when it is outside the visible area. It does not steal focus, open the viewer or move the background while the viewer is open.
- Setup content can still be hidden without hiding results. Show/Hide Results and Show/Hide Player List retain their state and behavior.
- Restored Save Scramble in the summary, using the same saveKingQueenTeams operation as the modal. Shared saved tracking uses the current team array, selected league and assignment signature; there is no separate modal save state.
- Both Print buttons require a successful save or a saved-scramble retrieval. Editing assignments disables printing; successful Save enables it. Cancel restores a known saved state when no save request has failed. Failed requests invalidate the confirmed saved marker, retain edits and leave printing disabled until a successful retry or retrieval. Busy guards prevent repeated requests, and existing stable team IDs remain in the save payload.
- Added visible save confirmation and concise disabled-print help. Viewing and editing remain available before saving.
- Initial Print Settings are 6 Matchups and 5 Rounds. Existing options remain. Opening/closing the viewer does not reset manual selections. Retrieval still uses the existing saved-round-count behavior for score entry; this was intentionally preserved.

## Mobile overflow: measured causes and correction

Before correction, at 375px the dialog content had clientWidth375 but scrollWidth384. Bootstrap row margins of -15px pushed outer rows to left-7/right382 and inner rows to left-9/right384; some content was clipped by the dialog shell.

The viewer now removes those gutters locally, allows columns/cards to shrink, and corrects flex rows embedded in table layout. Mobile table groups use the available team-column width rather than anonymous table columns squeezing player names. The inherited 25-percent-wide Bye Players area and its negative heading offset are corrected on phones. No unrelated table or desktop form styles were changed.

The dialog uses dynamic viewport height with a vh fallback. Header/footer do not scroll. Only MAT-DIALOG-CONTENT is vertically scrollable. Opposing teams remain side by side; desktop still shows two matchup cards per row.

Final measurements at375x667,390x844,430x700 and390x550:
- content scrollWidth equals clientWidth;
- no measured cards/team columns/tables/cells/inputs/selects extend outside the content bounds;
- exactly one phone matchup card per row;
- one vertical scrolling element;
- header and footer remain inside the viewport.

Eight matchups, long names, substitute text and bye players were included. All matchups and the bottom bye section were reachable.

## Verification

Angular development build passed. Angular production build is recorded in artifacts/results-refinements-production-build.log; final result is appended below.

25 focused browser workflow groups passed, zero final failures:
- results-refinements:4 groups (placement/defaults/scroll, shared save state, responsive overflow/height, settings/printing/visibility).
- matchups-modal:7 groups (including staging, save failure, cancel, focus/closing and original print comparison).
- scoring-auto-winners:5 groups.
- scoring-after:9 groups.

Existing print output remained pixel-identical to its saved baseline at2/4/6 matchups per page, with unchanged PDF page counts. A manual4-matchup/7-round selection survived viewer use and appeared in the actual print HTML.

All API traffic was intercepted with deterministic browser fixtures. Tests checked one save request during repeated clicks, stable IDs in update payloads, failure/retry state and simulated retrieval. These are not live SQL persistence or duplicate-record assertions. No SQL reads/writes, real player changes, production access or database authorization overrides were performed. No full regression suite was run.

No backend code, API models, scoring algorithms, authorization, legacy password workflow, production configuration or deployment files were changed in this pass. Earlier pending work was preserved. Nothing published, deployed, committed, pushed or merged.

## Files changed in this pass

- Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.html
- Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.less
- Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.ts
- tests/functional/scripts/scrambler-workspace.cjs
- tests/functional/RESULTS_REFINEMENTS_REPORT.md
- tests/functional/MATCHUPS_MODAL_REPORT.md (superseding notice)
- tests/functional/WORK_LOG.md
- tests/functional/results-refinements-evidence/ (screenshots/results)

## Evidence

Screenshots in results-refinements-evidence/:
- desktop-results-unsaved.png
- mobile-results-unsaved.png
- mobile-results-saved.png
- mobile-view-375.png / mobile-view-390.png / mobile-view-430.png
- mobile-edit-375.png
- desktop-view-1366.png / desktop-view-1920.png
- mobile-before.png (before correction)

Measurements: before-overflow.json, after-layout.json. Executed checks/intercepted requests: results-refinements-results.json. failure.png is an intermediate debugging capture, not the final state.

Rerun from repository root using existing development Angular assets and localhost application:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/scrambler-workspace.cjs results-refinements
```

The harness uses Angular debug inspection, so rebuild development assets before rerunning after the production build. Live persistence verification still requires the established current-process/LeagueScramblerDev authorization safeguards; it was not attempted here.
Final build checkpoint: Angular production build passed (exit0), with the existing outdated Browserslist warning. Diff whitespace check passed. Task complete.

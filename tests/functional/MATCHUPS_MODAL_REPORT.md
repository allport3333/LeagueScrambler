> Latest follow-up: [results placement, mobile overflow and restored saving](RESULTS_REFINEMENTS_REPORT.md). Printing now requires a confirmed saved scramble; the earlier unsaved-print policy below is superseded.

# Scrambler results and shared matchup viewer

Completed November 18, 2026.

## Implemented

The main page now contains a compact Scramble Results summary: current scramble identifier, team/matchup counts, View Matchups, Modify Teams and Print Matchups. Matchup cards are no longer permanently rendered below the page. Generating/retrieving does not open the viewer automatically. Print Settings contains the existing Matchups Per Page and Number of Rounds controls.

One existing Angular Material dialog template handles both modes. View preserves the previous paired cards, team numbers, original ordering, player colors, substitute text, VS and court information. Standard desktop widths show two matchups per row; phones show one, with opposing teams side by side. Header and footer stay accessible while content scrolls independently. Material supplies background scroll blocking, focus containment and focus restoration.

Modify Teams uses the same listOfTeams/player objects, assignment dropdowns and switchPlayerTeam method. It snapshots current generated or retrieved assignments and local court notes, without creating a second editing model. Save validates and explicitly posts once; success returns to View. Failure retains edits. Cancel restores the snapshot. Close, Escape and backdrop actions require confirmation only when changes exist. Controls are disabled while saving.

Hide/Show Setup is by its section header, Hide/Show Player List is immediately above the roster, and Hide/Show Results is in the results heading. Opening/closing the viewer does not collapse any other section.

## Necessary save correction

The previous SaveKingQueenTeams implementation finalized the latest pending scramble rather than editing the selected retrieved scramble. The updated UI sends existing team IDs through the same request fields and endpoint. Generated IDs are retained from GenerateScramble.

An explicit-ID path in the existing endpoint now verifies management access, selected league, a complete single scramble, unique/valid player and team IDs, and unchanged player membership when editing finalized teams. It updates existing membership row foreign keys, retaining membership IDs and substitute-score flags. Round-score rows are not changed. Pending finalization creates assignments/byes once, in a transaction; repeat saves update the finalized assignments instead of inserting another scramble or bye round. The existing no-ID path remains available to other existing callers.

Combined multi-scramble retrieval can still be viewed and printed. Saving requires retrieving one scramble at a time and the viewer explains this restriction. Invalid or already duplicated saved membership data is rejected rather than silently repaired.

Court notes are local UI/print information, as before; no court database field exists in this workflow. They now survive closing/reopening the viewer and can be canceled with the other changes. Nonempty notes appear in the existing print templates. Retrieving another copy of the saved scramble does not restore local court notes from SQL.

## Printing

The existing hidden printSection2/4/6 templates remain outside the dialog. The actual printMatchups method works with the viewer closed or open and never copies modal controls. Newly generated teams can be printed without first finalizing them, as requested. Unconfirmed team/court edits must first be saved or canceled.

With identical synthetic input and empty court notes, rendered print screenshots matched the original baseline pixel-for-pixel at 2, 4 and 6 matchups per page. PDF page counts also matched (4, 2 and 1 respectively, including the existing bye section). No new print format or pagination algorithm was introduced. Physical printer/OS print-dialog behavior was not tested.

## Verification

- Angular development build: passed.
- Angular production build: passed; existing outdated Browserslist warning only. See artifacts/matchups-modal-production-build.log.
- Backend Release build, no restore: passed, 0 errors and 10 existing warnings (unsupported framework/package advisories and existing MVC warnings).
- Backend Debug build compiled but failed to copy its DLL because the running Visual Studio/.NET development process held it open (MSB3027/MSB3021). The application was not stopped or restarted. Release compilation verified the same controller source without replacing the running Debug binary.
- Focused browser checks: 21 workflow groups passed, zero final failures: matchup modal 7, automatic winners 5, mobile/shared scoring 9. No full regression suite run.
- Tested desktop 1366/1920 and phone 375/390/430. Checked real frontend generation, compact summary, pairs, view/edit, cancel, failed-save/retry, duplicate rejection, double-submit blocking, retrieval changes, focus/keyboard containment, scroll restoration, responsive layout, visibility controls, print output, automatic winners and score persistence UI.

All API requests were intercepted with deterministic browser fixtures, including generated IDs, saves, substitute updates and retrieval. No SQL sessions or real database mutations were performed; production hosts were blocked by existing harness protections. Fixture save/retrieve success is NOT evidence of live SQL persistence. Backend transaction behavior, SQL permissions, real saved-team editing and actual database row/substitute preservation remain unverified against LeagueScramblerDev. No expired database mutation authorization was bypassed.

Before real persistence testing, stop/rebuild/restart the existing Visual Studio Debug profile to load the controller change, then establish current process/database isolation authorization through the existing safeguards. Do not use production for this validation.

## Changed files in this task

Application:
- Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.html
- Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.less
- Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.ts
- Allport's League Scrambler/Controllers/ScrambleDataController.cs (existing SaveKingQueenTeams only)

Verification/documentation:
- tests/functional/scripts/scrambler-workspace.cjs
- tests/functional/MATCHUPS_MODAL_REPORT.md
- tests/functional/WORK_LOG.md
- tests/functional/matchups-modal-evidence/ (screenshots, PDFs and results)

Earlier pending work was preserved. No authentication, legacy password, role policies, scoring algorithms, schemas, production files, IIS, Cloudflare or publish profiles were changed. Nothing published, deployed, committed, pushed or merged.

## Screenshots and evidence

Under tests/functional/matchups-modal-evidence/:
- compact-results-desktop.png: main page summary.
- view-desktop-1366.png / view-desktop-1920.png: two matchup cards per row.
- view-mobile-375.png / view-mobile-390.png / view-mobile-430.png: phone viewer.
- edit-mobile-430.png: assignments and accessible save/cancel footer.
- print-2.png/.pdf, print-4.png/.pdf, print-6.png/.pdf: print output.
- print-2-compatibility.png/.pdf and corresponding 4/6 files: exact original-baseline comparison.
- original-print-comparison.json: pixel and page-count equality.
- matchups-modal-results.json: executed modal checks and intercepted requests.

Scoring checks: mobile-scoring-evidence/scoring-auto-winners-results.json and scoring-after-results.json.

Rerun from repository root with development Angular assets and the existing localhost application:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
$testNode = 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe'
& $testNode tests/functional/scripts/scrambler-workspace.cjs matchups-modal
& $testNode tests/functional/scripts/scrambler-workspace.cjs scoring-auto-winners
& $testNode tests/functional/scripts/scrambler-workspace.cjs scoring-after
```

These modes use intercepted APIs; they do not authorize real SQL writes. The production bundle is the last build output; rebuild development assets before running the debug-inspection fixture scripts. Older historical layout modes target superseded interfaces and are not a claim of current regression coverage.
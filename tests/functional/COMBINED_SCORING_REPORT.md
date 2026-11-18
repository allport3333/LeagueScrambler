> Superseded scoring interaction: [automatic winners](AUTOMATIC_WINNERS_REPORT.md) now replace manual Won checkboxes; unscored inputs start blank. Historical build/test results below belong to the preceding phase.

# Combined King/Queen Manage Scores verification

Completed November 18, 2026.

## Changes
Desktop shows all original matchup pairs in a responsive grid: two columns at 1366px (605px cards), three at 1920px (approximately 583px cards). Each card contains side-by-side rosters with adjacent substitute switches, original match/team numbers, horizontal round inputs with independent Won checkboxes, and existing totals. Ten rounds use two groups of five. One desktop Save Round Scores operation saves the entire scramble.

Mobile retains its single-match navigator. Player and Substitute Settings is ABOVE scoring and OPEN by default, with optional collapse. Mobile screenshots at 375, 390 and 430px were byte-identical before and after the desktop extension.

Both layouts use the same existing score/player objects and update/totals/save methods. Match navigation and resizing retain unsaved values. Stable Angular trackBy keys prevent input recreation and keyboard focus loss.

The preceding mobile work also preserves hidden rounds, confirms context changes with unsaved edits, handles incomplete scores, prevents repeated submissions, retains values after save failure and reads persisted IDs before repeat saves. Substitute switches retain their existing immediate-save behavior, including failure rollback; they are not staged until Save Round Scores. See MOBILE_SCORING_REPORT.md for preceding mobile details.

## Verification
- Angular development build: passed.
- Angular production build: completed successfully. Existing outdated Browserslist warning remains; no dependency changes.
- Desktop: 4 focused workflow groups passed.
- Mobile/shared state: 9 focused workflow groups passed.
- Unscored/empty scramble: 1 focused workflow group passed.
- Total: 14 workflow groups passed, zero final failures. No full regression suite rerun.

Checks covered original pairing, all players/Sub controls, ten-round containment, no page overflow, keyboard Tab order, cross-layout shared state, failure/retry behavior and whole-scramble payloads. All test APIs were intercepted using deterministic browser fixtures: no SQL or actual database mutations. Real persistence, live authorization and concurrent administrators remain unverified. Browser refresh does not preserve unsaved drafts; save before refreshing.

## Project files
- ClientApp/src/app/scrambler/scrambler.component.html
- ClientApp/src/app/scrambler/scrambler.component.less
- ClientApp/src/app/scrambler/scrambler.component.ts
- tests/functional/scripts/scrambler-workspace.cjs
- tests/functional/MOBILE_SCORING_REPORT.md
- tests/functional/COMBINED_SCORING_REPORT.md
- tests/functional/WORK_LOG.md
- tests/functional/mobile-scoring-evidence/ (screenshots/results)

No backend, scoring algorithms, schema, authentication, legacy administration, production, IIS, Cloudflare or deployment configuration changes. Nothing published, deployed, committed, pushed or merged.

## Screenshots
Under mobile-scoring-evidence/:
- desktop-before-1366.png / desktop-before-1920.png: original tables.
- desktop-grid-1366.png / desktop-grid-1920.png: responsive grid.
- desktop-grid-10-rounds-1366.png / desktop-grid-10-rounds-1920.png: ten-round examples.
- mobile-editor-375.png / mobile-editor-390.png / mobile-editor-430.png: mobile editor.
- mobile-rosters-collapsed.png: optional roster collapse.
- mobile-player-sub-settings.png: player switches and failure feedback.
- mobile-returned-unsaved.png: retained unsaved entries.
- mobile-save-success.png: fixture save confirmation.
- mobile-unmatched-team.png: unmatched-team state.

## Rerun
Use the existing localhost application and development Angular assets first; the completed production build is currently on disk. Fixture checks require Angular debug access. From the repository root in PowerShell:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
$testNode = 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe'
& $testNode tests/functional/scripts/scrambler-workspace.cjs scoring-desktop
& $testNode tests/functional/scripts/scrambler-workspace.cjs scoring-after
& $testNode tests/functional/scripts/scrambler-workspace.cjs scoring-empty
```

Results: scoring-desktop-results.json, scoring-after-results.json and scoring-empty-results.json in the evidence directory. Build logs: artifacts/combined-scoring-development-build.log and artifacts/combined-scoring-production-build.log.
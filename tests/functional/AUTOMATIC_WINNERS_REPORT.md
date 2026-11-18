# Automatic King/Queen round winners

Completed November 18, 2026. Focused Scrambler Manage Scores change.

## Behavior
- Removed manual Won checkboxes from both desktop and mobile score entry.
- Changing either team's score recalculates both existing roundWon flags for that saved-order matchup and round. Higher score wins; tied or incomplete rounds award neither team a win. The reviewed score model and save endpoint define no separate tie-break rule.
- Winner inputs have a subtle green background/border. Total Wins updates immediately through the existing calculation method.
- A blank input is null, not zero. Previously unscored teams now initialize blank. Saved zero scores remain legitimate entered values. Existing whole-number validation still prevents saving incomplete score records.
- Retrieval recalculates winners from saved numeric scores. Save recalculates again immediately before posting the existing whole-scramble payload, including hidden retained rounds. Loading alone does not write historical records.
- Existing roundWon fields and SaveKingQueenRoundScores API are reused; no backend/model/schema changes. Pairing uses the same saved-order pairs and stable team IDs as the existing editor. Unmatched teams get no invented win.
- Substitute switches, team assignments, roster order, navigation and shared desktop/mobile state are unchanged.

## Verification
Angular development build passed using existing dependencies. No production publish or package changes.

Focused browser fixture checks: 19 workflow groups passed, zero final failures:
- scoring-auto-winners: 5 groups (load/recalculate, higher/tied/blank/zero scores, mobile/shared state, ten-round whole-scramble save/reload, unmatched/unscored cases).
- scoring-desktop: 4 groups.
- scoring-after: 9 groups.
- scoring-empty: 1 group.

Existing test expectations were updated for removal of manual winner controls and blank initial inputs. Keyboard Tab now goes directly between score inputs. Desktop grid and mobile widths retain their layouts; no full functional suite was run.

All APIs were intercepted with deterministic browser fixtures. Save payloads and fixture reload verified all 120 winner fields across 12 teams at ten rounds. No SQL access or actual database mutation was performed. Real SQL persistence and live authentication remain unverified. No production, IIS, Cloudflare, credentials, scoring backend or deployment configuration changes.

## Files
Application changes are limited to scrambler.component.ts, scrambler.component.html and scrambler.component.less under ClientApp/src/app/scrambler. Supporting updates: scripts/scrambler-workspace.cjs, reports, WORK_LOG.md and mobile-scoring-evidence.

## Evidence
- mobile-scoring-evidence/automatic-winners-mobile-390.png
- mobile-scoring-evidence/automatic-winners-desktop-1366.png
- mobile-scoring-evidence/scoring-auto-winners-results.json
- mobile-scoring-evidence/scoring-desktop-results.json
- mobile-scoring-evidence/scoring-after-results.json
- mobile-scoring-evidence/scoring-empty-results.json
- artifacts/automatic-winners-development-build.log

Rerun the focused mode with existing localhost development assets and portable testing Node22:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/scrambler-workspace.cjs scoring-auto-winners
```

Nothing published, deployed, committed, pushed or merged. Task complete.
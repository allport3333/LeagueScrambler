# Focused Scrambler corrections

## Changes

- Player Selection stays in the same position. Fetch Signed In Players and Hide Player List stay side by side on desktop and phones, followed by centered selected/male/female counts and the existing, unchanged player-action help text.
- Large Scramble Players action is green when enabled, neutral gray when disabled. Its existing enabled/disabled binding is unchanged.
- Reset Players is centered beneath it and styled red. Every reset menu operation asks for confirmation. Cancel changes nothing. **Existing Reset All clears generated teams and Top/Low/Bye preferences, not checked roster players.** This behavior was deliberately preserved, with accurate confirmation: “Clear current Top/Low/Bye player selections and generated teams? Checked roster players will stay selected.” No checkbox-clearing behavior was introduced.
- Mobile roster rows show compact Top, Low, Bye and Gender swapped badges below the readable name. Multiple statuses wrap compactly. Gender status tracks the original value before this browser session's first temporary swap; swapping back removes the badge. Desktop icon controls and balancing behavior remain unchanged.
- Results are centered in four explicit rows: edit/save/cancel; prominent Print Matchups; pagination/rounds; visibility actions. Scramble number remains visible.
- Print eligibility now requires a successful Save Teams acknowledgement for the current league/team list or successful retrieval of already saved teams. Generated placeholder IDs alone never enable it. Changed membership/gender/bye lists invalidate eligibility; Cancel can restore the saved state. Failed saves do not authorize printing. The print method also guards the action. In-flight save acknowledgements cannot mark a different team list/league or changed payload as saved. No API/persistence behavior changed.
- Existing limitation retained: editing retrieved historical rosters is a local preview, not a new persisted roster-correction feature. An acknowledgement of that existing finalize-only path does not authorize printing unsaved historical edits; cancel or retrieve again instead.

## Executed verification

- Angular development build passed, installed Node 10 and existing packages; outdated Browserslist warning remains. Log: `artifacts/scrambler-corrections-build.log`.
- Four new grouped focused checks passed, with zero browser page errors: print guard/failed save/success/dirty/Cancel; saved retrieval; actual Select All/Deselect All plus 1920/1366/390/375 layout, green action, side-by-side buttons, count/help order, results-row order, no overflow and mobile statuses; reset cancellation/confirmation preserving exact existing semantics plus double gender toggle.
- Existing results workflow phase: eight grouped checks passed, including actual balanced scrambling, local assignment editing/Cancel, existing mocked save path and preferences. Original printed HTML/screenshot hashes and PDF pagination still match at 2/4/6 Matchups Per Page once fixture teams are explicitly marked saved. Print output itself was not redesigned.
- All application API requests were intercepted against the actual localhost Angular UI. The save failure was an intentional mocked HTTP 500. No SQL, real accounts, real saves, cleanup, emails, production requests or testing-authorization renewal. Existing external font/icon stylesheet/font GET assets were allowed for final screenshots only. This is browser behavior verification, not independent database persistence verification.
- No full regression suite or production/AOT build rerun in this pass. Existing historical full-suite results are not reported as newly executed.

## Screenshots

- Desktop selection: [1366](scrambler-corrections-evidence/selection-1366.png), [1920](scrambler-corrections-evidence/selection-1920.png).
- Desktop results: [saved/print enabled](scrambler-corrections-evidence/results-saved-1920.png), [print blocked after changes](scrambler-corrections-evidence/results-1366.png).
- Mobile selection: [390](scrambler-corrections-evidence/selection-390.png), [375](scrambler-corrections-evidence/selection-375.png).
- Mobile player indicators: [roster context](scrambler-corrections-evidence/mobile-player-indicators-390.png), [Top/Bye/Gender swapped](scrambler-corrections-evidence/mobile-top-bye-swapped-390.png), [Low](scrambler-corrections-evidence/mobile-low-390.png). Equivalent 375-pixel captures are included.
- Mobile results: [390](scrambler-corrections-evidence/results-390.png), [375](scrambler-corrections-evidence/results-375.png).
- Exact focused results: `scrambler-corrections-evidence/corrections-results.json`.

## Files touched in this pass

Only `scrambler.component.html`, `scrambler.component.less`, and `scrambler.component.ts` under the existing Angular Scrambler; focused runner `tests/functional/scripts/scrambler-workspace.cjs`; this report, `WORK_LOG.md`, and new screenshot/result artifacts. All earlier pending work was preserved. No backend, schema, authentication, legacy password, production/IIS, navigation, publish or deployment changes in this pass. Nothing committed, pushed or merged.

Rerun the focused checks with the existing development app running:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path tests/functional/.tools/browsers).Path
& tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/scrambler-workspace.cjs corrections
```

Stop after these corrections.

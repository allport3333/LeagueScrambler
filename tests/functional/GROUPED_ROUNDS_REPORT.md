# Grouped detailed rounds — November 18, 2026

The King/Queen View Detailed Round Table now has a date heading and compact won/completed summary for each saved scramble, followed by Round, Score and Result. Won/Lost badges reuse existing green/red styling. The outer disclosure remains closed by default; groups do not introduce nested disclosures.

Grouping uses the selected league's saved ScrambleNumber, not dates. Missing scramble identity falls back to saved team ID, then an isolated row rather than guessing relationships. Groups are chronological; rounds sort by round number, saved team ID and saved score ID. Same-date groups receive a matchup distinction. Raw records and metadata are retained. Unknown outcomes stay Not recorded and are excluded from the completed-round denominator.

Application files changed in this pass: detailed-player-stats.component.ts, detailed-player-stats.component.html, and new grouped-rounds.css. Previous uncommitted corrections were preserved. Existing matchup history/navigation, backend, authentication, calculations and database records were not changed.

Verification: Angular development build passed (existing Browserslist warning). Five focused browser check groups passed with no page errors or write requests: saved identity separation for two same-date scrambles; chronological groups/ascending rounds and all original values; variable round counts/unknown outcomes and completed-only summary; one collapsed-by-default disclosure with no nested disclosures; desktop 1366/1920 and mobile 375/390/430 without overflow. All HTTP APIs were intercepted with deterministic fixtures; no SQL or database mutations were performed. Full regression suite not run.

Command (from repository root, existing portable testing runtime):
```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --grouped-rounds
```

Screenshots: [Desktop](player-profile-evidence/grouped-rounds-1366.png), [Mobile 390](player-profile-evidence/grouped-rounds-390.png), [Mobile 375](player-profile-evidence/grouped-rounds-375.png). Additional 1920/430 captures and grouped-rounds-results.json are in the same directory. Build log: artifacts/grouped-rounds-build.log.

No production changes, publishing, deployment, commits, pushes or merges. This presentation-only task is complete.
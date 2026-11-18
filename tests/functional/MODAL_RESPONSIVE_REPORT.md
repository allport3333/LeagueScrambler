# Content-responsive matchup viewer

November 18, 2026. Targeted correction for intermediate widths.

## Implementation

Matchup cards now use wrapping flex sizing based on the modal content's available width. A card starts with a550px minimum and can require more space when actual unbroken first/last names and edit controls need it. Two cards appear only when both minimum widths and their gap fit. This uses established flex layout rather than requiring CSS container-query support in the Angular7 toolchain.

A coalesced ResizeObserver layout update measures the actual content width. Below600px of usable content it selects the existing compact initial/last-name presentation; otherwise it displays centered First Name/Last Name columns. This is independent of the existing isSmallScreen flag used by other Scrambler sections. Window-resize handling supplies a fallback, and the observer is disconnected when the dialog closes or the component is destroyed.

Names no longer use break-word/anywhere rules in the modal. Ordinary spaces and hyphens remain valid wrapping points. Actual longest words are measured at the displayed font size to establish sufficient card width without reducing name fonts. Name headings and cells retain consistent centered columns.

Each matchup reserves a44px Court column with gaps on both sides. Both teams remain side by side. Court, input and VS cannot be displaced by the player backgrounds. Player rows share a measured minimum height within the matchup, including native assignment controls and naturally wrapped whole words. Opposing team headings and player rows remain aligned.

The Bye Players section also avoids its inherited narrow column/negative heading offset. Header/footer and the single scrolling content area are preserved. Print templates, team assignments, score logic, APIs and save behavior were not changed.

## Measured layout

The longer-name fixture produced these results; shorter names can permit two cards sooner:

| Viewport | Usable modal content | Cards per row | Names |
| --- | --- | --- | --- |
|375|359|1|Compact|
|430|414|1|Compact|
|600|584|1|Compact|
|768|698|1|First / Last|
|850|776|1|First / Last|
|1024|941|1|First / Last|
|1280|1184|1|First / Last|
|1600|1488|2|First / Last|

The long-name fixture requires603px per card, so two need1218px including the gap. Ordinary shorter-name fixtures retain two cards at1366/1920. This intentionally favors readable names over forcing two cards into an1184px content area.

## Verification

- Angular development build passed.
- Production build result recorded below and in artifacts/modal-widths-production-build.log.
- All eight requested widths passed in both View and Modify Teams:16 layout combinations.
-13 focused workflow groups passed across modal-widths1, modal-polish1, matchups-modal7 and results-refinements4. Zero final failures; no full regression suite.
- Browser checks verified every tested name word stayed on one line within its cell, no horizontal content overflow, consistent opposing row heights/header alignment, reserved Court space, correct column count and compact/full formatting, and visible header/footer.
- Existing focused tests passed for team moves, save failure/retry, duplicate prevention, cancel/close/Escape/backdrop behavior, editable Court notes, shared print state and visibility controls.
- Printed output remained pixel-identical to the existing baseline at2/4/6 matchups per page with unchanged PDF page counts. Modal breakpoints do not enter the separate print templates.

One test selector was narrowed to the active backdrop because a closing backdrop can remain in the DOM during its fade animation. No application closing behavior was changed for that test correction.

All APIs were intercepted using deterministic synthetic fixtures. No real SQL queries/mutations or production requests were performed. Live database persistence was not retested. No authentication, legacy administration, API/model, scoring or deployment changes.

## Files changed in this task

- ClientApp/src/app/scrambler/scrambler.component.html: modal-specific compact flag.
- ClientApp/src/app/scrambler/scrambler.component.less: content-sized wrapping, whole-word names, Court reservation, equal rows and bye sizing.
- ClientApp/src/app/scrambler/scrambler.component.ts: display-only content/name/row measurements and observer lifecycle.
- tests/functional/scripts/scrambler-workspace.cjs
- tests/functional/MODAL_RESPONSIVE_REPORT.md
- tests/functional/WORK_LOG.md
- tests/functional/modal-widths-evidence/

## Screenshots and results

Under modal-widths-evidence/:
-375-view.png /375-edit.png
-430-view.png /430-edit.png
-600-view.png /600-edit.png
-768-view.png /768-edit.png
-850-view.png /850-edit.png
-1024-view.png /1024-edit.png
-1280-view.png /1280-edit.png
-1600-view.png /1600-edit.png
- layout-results.json: all16 measured combinations.
- modal-widths-results.json: executed checks/no API writes.

Additional print evidence: matchups-modal-evidence/original-print-comparison.json.

To repeat with existing localhost application and development Angular assets:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/scrambler-workspace.cjs modal-widths
```

No packages installed. Earlier pending work preserved. Nothing published, deployed, committed, pushed or merged.
Final checkpoint: production Angular build passed (exit0); existing Browserslist warning only. Whitespace diff check passed. Development assets must be rebuilt before rerunning debug-inspection fixture scripts after this production build.

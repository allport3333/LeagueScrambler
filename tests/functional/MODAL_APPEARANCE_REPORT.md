> Follow-up: Court is now editable in both View and Edit (disabled during save), and phone Name headings/player names are centered. Existing local note, print and Cancel behavior is preserved. Development build and8 focused fixture groups passed for this follow-up.

# Matchup modal appearance refinement

November 18, 2026. Presentation-only changes to the existing viewer/editor.

## Changes
- Desktop First Name/Last Name headings and cells use one consistent centered85% inner grid, with a little more room allocated to last names. Colored player rows span the complete team width. Edit mode reserves space for the existing assignment select using the same heading/cell alignment.
- Preserved separate name headings and mobile initial/last-name formatting. Long names wrap without clipping. Opposing team headings now align at the top when rosters have different heights.
- Kept card borders and one subtle match-title divider; removed redundant team-title borders and reduced heading padding/row gaps without reducing name font sizes.
- Refined Court input border, rounded corners, centered text and touch height. The existing read-only/editing rules, local court state and cancel behavior are unchanged.
- Scramble identifier is secondary text. Close is an accessible44px icon button retaining its existing aria-label and close method.
- Footer status sits left and Print Matchups sits right. View mode shows 'Scramble saved' when canPrintMatchups is true, otherwise 'Save this scramble before printing.' No new save state was introduced; the existing main/modal predicate still controls the button.

## Verification
- Angular development build passed with existing installed dependencies.
-12 focused browser workflow groups passed, zero final failures: modal-polish1, matchups-modal7, results-refinements4. No full regression suite.
- Desktop1366/1920: confirmed name/head cell centers align, inner width85%, full-width row backgrounds, centered text and two cards per row.
- Mobile375/390/430: abbreviated Name columns remain, no horizontal content overflow. Existing smaller-viewport header/footer checks also passed.
- Existing fixture tests verified editing, save failure/retry, cancellation, close/Escape/backdrop protection, Court values, shared saved-state printing and one content scroller.
- Actual print-method output matched original baseline pixels and PDF page counts at2/4/6 matchups per page. Print templates were not edited.

All API calls were intercepted with deterministic synthetic fixtures. No SQL access or actual database mutations were performed. Live persistence was not reverified. No scoring, assignment, authentication, API/model or court-persistence logic was changed.

## Files changed in this pass
- ClientApp/src/app/scrambler/scrambler.component.html
- ClientApp/src/app/scrambler/scrambler.component.less
- tests/functional/scripts/scrambler-workspace.cjs
- tests/functional/MODAL_APPEARANCE_REPORT.md
- tests/functional/WORK_LOG.md
- tests/functional/modal-polish-evidence/ (screenshots/results)

## Screenshots
Under tests/functional/modal-polish-evidence/:
- before-desktop-1366.png / before-desktop-1920.png
- after-desktop-1366.png / after-desktop-1920.png
- after-mobile-375.png / after-mobile-390.png / after-mobile-430.png
- before-metrics.json / after-metrics.json
- modal-polish-results.json

Supporting save/edit/print results remain in matchups-modal-evidence/ and results-refinements-evidence/. Build log: artifacts/modal-polish-development-build.log.

No production, IIS, deployment or database changes. Nothing published, deployed, committed, pushed or merged.
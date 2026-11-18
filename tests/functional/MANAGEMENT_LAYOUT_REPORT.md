# League Management desktop refinements

Implemented only management-page HTML classes and scoped desktop CSS (`min-width: 801px`). Existing mobile rules, Scrambler layout, callbacks, form bindings, permission checks and APIs were not changed.

- Five tabs centered beneath the existing heading, with mobile tab pagination retained.
- Settings card centered at a maximum 860px, white with subtle border/shadow. Two columns, consistent field widths/spacing, centered heading and Save Settings.
- Other four management cards centered at maximum 680px with matching visual treatment. Their existing field arrangements remain intact.

## Verification

Angular development build passed using existing packages; existing Browserslist warning only. Log: `artifacts/management-layout-build.log`.

Focused browser checks passed at 1366, 1920, 375 and 390: desktop tab/card centering and two-column settings, mobile stacked alignment and unchanged screenshot dimensions, no horizontal overflow, all five tabs selectable and selected settings retained. All five other-tab cards were checked at desktop width and captured. Save Settings produced the same five league-scoped setting requests with the expected selected values, intercepted by fixtures. No SQL queries/writes, real account use, production access or mutation authorization renewal.

Mobile before/after screenshots were visually compared and retain the same layout. Exact PNG hashes differed due to tab/ripple animation; pixel equality is not claimed. An initial desktop measurement also caught the tab body mid-animation; waiting for the animation to finish resolved the test without further application changes.

No full regression suite or production build was run. Real database persistence and player/league/division mutations were not executed.

## Screenshots

- Desktop settings: [1366](management-layout-evidence/after-settings-1366.png), [1920](management-layout-evidence/after-settings-1920.png).
- Mobile unchanged layout: [375](management-layout-evidence/after-settings-375.png), [390](management-layout-evidence/after-settings-390.png).
- Other desktop tabs: [Add Player](management-layout-evidence/after-add-player-1366.png), [Delete Player](management-layout-evidence/after-delete-player-1366.png), [Add League](management-layout-evidence/after-add-league-1366.png), [Add Division](management-layout-evidence/after-add-division-1366.png).
- Before screenshots and exact result JSON are alongside these in `management-layout-evidence/`.

Changed application files: `scrambler.component.html` (management classes only), `scrambler.component.less` (desktop rules under `.league-management-page`). Testing/docs: `scripts/scrambler-workspace.cjs`, new evidence folder, this report and WORK_LOG. Earlier pending role-guard work was preserved.

With the existing development application running, rerun the after checks using portable Node and `scripts/scrambler-workspace.cjs management-layout-after` (set `PLAYWRIGHT_BROWSERS_PATH` to `tests/functional/.tools/browsers`). Do not overwrite the before baseline. No publish, production changes, commits, pushes or deployment. Stop at this refinement.

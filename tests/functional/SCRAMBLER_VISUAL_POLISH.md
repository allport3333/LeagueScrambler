# Scrambler visual polish

Completed locally November 17, 2026. This pass refines the existing workspace; the prior organization, editing lifecycle and algorithms remain.

## Changes

- Centered **Scramble Players** is now blue, bold and 440 x 64 pixels on desktop; on phones it fills the available content width (315 pixels at 375, 330 at 390). Disabled styling has a neutral background and readable dark text. The existing enabled/disabled binding is unchanged.
- Team Configuration is centered with a 1060-pixel maximum width, white inset control sections, subtle borders and compact breakdown tiles. The roster and results retain their full available width. Phone dropdowns share a row, with the breakdown below. Existing toggles, counts and size/count behavior are retained.
- Consistent centered headings, section borders/radii, selected-count highlight and aligned selection/balancing actions. Desktop sections remain side by side; phone sections stack. Scramble Rules is compact with centered checkboxes. Secondary disabled buttons use readable gray text instead of white on gray.
- Results heading and scramble number are centered. Edit/save/cancel, print/pagination and visibility actions are grouped, without the vertical divider. Hide Results and Hide Setup use consistent outlined buttons. No matchup card, team color, print template or algorithm changes in this pass.
- Desktop navigation now uses an intentional league/account row and main-link row. At 1366 the main links use equal flexible slots, with long labels wrapping inside their slot instead of League Management becoming an orphan row. At 1920 labels fit on one line. Smaller desktop sizes retain wrapping; mobile collapse behavior, routes, permissions and links are unchanged.
- The parent application layout had an obsolete 85-pixel mobile spacer intended for fixed navigation, although navigation is in normal flow. A Scrambler-only route class removes that padding on phones; other routes and tablet/desktop spacing are unchanged.

## Verification actually executed

- Angular development build passed using installed Node 10/packages; existing outdated Browserslist warning only. No dependencies installed or changed. Production/AOT build was not repeated for this visual pass; the previous workspace pass's production build is historical evidence only.
- Four viewport visual checks passed: 1920 x 1080, 1366 x 768, 390 x 844 and 375 x 667. No horizontal page overflow; primary button sizing and enabled/disabled states verified; configuration bounded; four desktop roster columns retained; all visible main desktop links occupy the same navigation row.
- Existing results workflow phase: **8 grouped checks passed**, covering actual balanced scrambling, staged editing/Cancel, mocked Save request, preferences, access-disabled Save, responsive results and print comparisons. Existing navigation/state phase: **1 grouped check passed**, verifying navigation to management/back retains the same live component and selections/teams/settings.
- Actual print function still matches the original HTML, rendered PNG hashes and PDF pagination at 2/4/6 matchups per page. No physical-printer test or database persistence test was performed.
- Browser tests run the actual localhost Angular UI with synthetic intercepted API fixtures. No SQL access, database writes, actual shared-password unlock, production requests or mutation-authorization renewal. Final screenshots allow only the application's existing Google font/Material Icon and Font Awesome stylesheet/font GET assets in addition to localhost; API traffic remains intercepted and all other remote traffic is blocked.
- No full functional suite rerun. Historical regression counts are not claimed as a new execution.

Representative configured-panel heights changed from about 398/430 pixels at desktop 1920/1366 to 388 pixels. Phone configuration decreased from about 954 pixels to 664/708 at 390/375, with current fonts and fixture data. These are layout observations, not a pixel comparison: earlier before captures blocked external fonts, while final screenshots include the application's normal fonts/icons.

## Screenshots

| View | Before polish | Updated |
|---|---|---|
| Desktop setup, 1366 | [Before](scrambler-polish-evidence/before-setup-1366.png) | [Updated](scrambler-polish-evidence/after-setup-1366.png) |
| Selected players, 1366 | [Before](scrambler-polish-evidence/before-selected-1366.png) | [Updated](scrambler-polish-evidence/after-selected-1366.png) |
| Selected players, 1920 | [Before](scrambler-polish-evidence/before-selected-1920.png) | [Updated](scrambler-polish-evidence/after-selected-1920.png) |
| Primary action | [Before](scrambler-polish-evidence/before-primary-1366.png) | [Updated](scrambler-polish-evidence/after-primary-1366.png) |
| Results toolbar | [Before](scrambler-polish-evidence/before-results-1366.png) | [Updated](scrambler-polish-evidence/after-results-1366.png) |
| Navigation, 1366 | [Before](scrambler-polish-evidence/before-navigation-1366.png) | [Updated](scrambler-polish-evidence/after-navigation-1366.png) |
| Navigation, 1920 | [Before](scrambler-polish-evidence/before-navigation-1920.png) | [Updated](scrambler-polish-evidence/after-navigation-1920.png) |
| Phone setup, 390 | [Before](scrambler-polish-evidence/before-setup-390.png) | [Updated](scrambler-polish-evidence/after-setup-390.png) |
| Phone selection, 390 | [Before](scrambler-polish-evidence/before-selected-390.png) | [Updated](scrambler-polish-evidence/after-selected-390.png) |
| Phone selection, 375 | [Before](scrambler-polish-evidence/before-selected-375.png) | [Updated](scrambler-polish-evidence/after-selected-375.png) |

Additional compact captures: [phone configuration](scrambler-polish-evidence/after-configuration-390.png), [selection controls](scrambler-polish-evidence/after-selection-controls-390.png), [phone roster](scrambler-polish-evidence/after-roster-390.png), [mobile results toolbar](scrambler-polish-evidence/after-results-390.png). Equivalent 375-pixel images and all desktop captures are in `scrambler-polish-evidence/`.

## Files changed in this polish pass

Application paths relative to `Allport's League Scrambler/ClientApp/src/app/`:

- `scrambler/scrambler.component.less`: visual styles only.
- `scrambler/scrambler.component.html`: toolbar grouping wrappers and outlined visibility buttons only.
- `nav-menu/nav-menu.component.css`: responsive desktop navigation layout only.
- `app.component.ts`, `app.component.html`, `app.component.css`: route class for removal of the Scrambler-only phone spacer.

Test/docs: extended `tests/functional/scripts/scrambler-workspace.cjs` with `polish-before`/`polish` capture and responsive assertions; `scrambler-polish-evidence/`; this report and `WORK_LOG.md`. Build log: `artifacts/scrambler-polish-build.log`. Existing workspace source changes from the preceding assignment remain uncommitted and were preserved.

Rerun visual capture/checks from repository root with the existing development application running:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path tests/functional/.tools/browsers).Path
& tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/scrambler-workspace.cjs polish
```

Do not run `polish-before` now to overwrite pre-polish evidence. No backend, schema, authentication, legacy password, cookie, authorization, production/IIS, publish or deployment changes were made. Nothing committed, pushed, merged or deployed. Stop at this visual pass.

# Final mobile standings settings/alignment — 2026-11-17

Completed only the requested refinements.

- Admin/Manager users get a compact **Standings Settings** toggle with a settings symbol, expand indicator and accessible expanded/controls attributes at widths ≤767px. It starts collapsed. Player/anonymous users do not have the section or its controls rendered.
- Expanding uses the same existing three Material selects and bound values. Collapsing hides the controls with CSS without destroying them, resetting values or invoking calculations. On desktop, the toggle is hidden and the wrapper uses `display: contents`, preserving the original visible controls/layout.
- Expanded mobile score entries now use three equal flexible columns. Labels align left, numeric scores sit at the row's geometric center, and wrapped status indicators align right. Existing red dropped/reduced styling, purple substitute background, ascending order and score links remain intact. Links retain ≥44px touch height.

## Verification

**7 focused Chromium browser check groups passed, 0 failed:**

1. Desktop 1366×768 and 1920×1080 before/after PNGs are byte-identical; all three existing settings controls remain visible.
2. Mobile 375×667: collapsed default, expand/keyboard-collapse, unchanged selected values/processed scores, centered columns/right indicators, saved links, ascending order and no overflow.
3. Same checks at 390×844.
4. Same checks at 430×932.
5. Manager sees the collapsed section and can expand it.
6. Player has no settings section or controls in the DOM.
7. Anonymous visitor has no settings section or controls in the DOM.

The browser compares all 11 numeric score-column centers against each row's center and verifies no column overlap/clipping, dropped red, substitute purple and unchanged link destination IDs. A reduced substitute score displays 86 from raw 172 with the existing 50% setting; the dropped zero remains marked. Expanding/collapsing leaves the settings and full processed standings JSON identical.

Angular development and production/AOT builds passed with existing Node10/packages. Existing outdated Browserslist warning only. No dependencies, database/API/authentication/server authorization changes, no full regression suite and no production operations. Tests use the real local Angular UI with browser-only synthetic API fixtures: all API reads intercepted, writes/external requests blocked, zero page errors/API writes/database access. These are presentation checks, not production account authorization tests.

## Screenshots

- [Admin settings collapsed, 375px](standings-settings-evidence/admin-375-collapsed.png)
- [Admin settings expanded, 390px](standings-settings-evidence/admin-390-expanded-settings.png)
- [Centered details with dropped/reduced/substitute indicators, 375px](standings-settings-evidence/admin-375-score-details.png)
- [Centered details, 430px](standings-settings-evidence/admin-430-score-details.png)
- [Desktop 1366 after — identical](standings-settings-evidence/desktop-1366-after.png)
- [Desktop 1920 after — identical](standings-settings-evidence/desktop-1920-after.png)
- [Results/provenance](standings-settings-evidence/results.json)

All screenshots contain synthetic display data. Additional collapsed/expanded/detail images for all three widths and before-change desktop images are in `standings-settings-evidence`.

## Files changed in this pass

- `league-standings.component.ts`: one presentation-only `mobileSettingsOpen` boolean, default false.
- `league-standings.component.html`: role-gated section/toggle around the unchanged select controls.
- `league-standings.component.css`: desktop-neutral visibility/wrapper rules and mobile toggle/equal-column/right-alignment styles.
- `tests/functional/scripts/standings-settings.cjs`: focused no-write browser checks and screenshots.
- `tests/functional/scripts/mobile-standings.cjs`: previous focused check updated from a fixed 48px column expectation to geometric row-center alignment; not unnecessarily rerun in this pass.
- `MOBILE_STANDINGS_REFINEMENTS.md`: pointer distinguishing its historical fixed-column description from the current requested alignment.
- `tests/functional/standings-settings-evidence/`, this report and WORK_LOG.

No calculation methods, standings tables, APIs, schemas, authentication, navigation, unrelated screens or existing pending work were changed. Nothing published, deployed, committed, pushed or merged. Work stops at these refinements.

To rerun the browser checks, use the existing portable Node22/Playwright runtime with `--use-system-ca` and the existing `.tools/browsers` cache to execute `tests/functional/scripts/standings-settings.cjs` while the local development app is running. Do not overwrite the original baseline with `--before`.

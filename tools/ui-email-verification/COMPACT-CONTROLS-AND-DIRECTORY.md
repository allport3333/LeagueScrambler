# Compact controls and Player List directory

Completed on `master`, 2026-11-21. Existing uncommitted work was preserved. No commits, pushes, merges, deployments, production changes or database writes.

## Scramble Rules

The oversized area came from several rules combining: `.scramble-rules-toggle` had a 44px minimum height; `.scramble-rules` added 4px padding, 8px margin and a 1px divider; the disclosure was inside the padded Team Configuration card; the following workflow had its own margin. The collapsed disclosure alone measured 49px, with additional card space around it.

The disclosure now sits immediately after the Team Configuration card, outside its border and padding. Its own margin, border and padding are removed. Its centered chevron/title row measures **34px**, with **4px above and below**, at all eight tested widths. There is no separate surrounding card. The existing enabled-option count remains available, including when two optional rules are enabled.

Native disclosure keyboard operation, explicit expanded semantics, four options/descriptions, values, defaults and compact two-column desktop/one-column mobile expanded layout are preserved. Team Configuration, the algorithm and matchup logic are unchanged.

## Add Existing Players

The former layout stacked a search row and filter row, retained Material form-field wrapper space below search, and always reserved an empty success paragraph. Header margins added more height. These were layout reservations rather than player-grid sizing problems.

The header is compact, with title/league left and Close right. On wide screens the search, gender filters and division selector now form one centered toolbar. Search has a 520px maximum width. On mobile search occupies its own row and the other controls wrap naturally. Material wrapper bottom reservation is removed within this component only.

The selector is labeled **Add to Division**. Counts and unobtrusive success feedback share a compact metadata area; success now names the player and league. Click-time division capture and the existing membership API are unchanged. A confirmed successful addition produced no measured grid-position shift at 1280px.

| Viewport | Grid moved upward | Columns, unchanged |
|---:|---:|---:|
| 320 | 59px | 2 |
| 375 | 111px | 3 |
| 430 | 111px | 3 |
| 768 | 62px | 5 |
| 1280 | 119px | 8 |
| 1920 | 119px | 12 |
| 2560 | 119px | 17 |
| 3440 | 119px | 23 |

The existing grid/button CSS was preserved, including blue/pink colors, padding, minimum heights, mobile spacing and adaptive desktop columns. Before/after checks confirmed identical rendered button width and height at each viewport. Header/controls stay fixed while the player grid scrolls.

## Player List `/fetch-data`

The old layout capped the combined tables at 1000px and each card at 450px. It also used one table row per player, with separate first/last columns and mouse-only row navigation.

The new directory uses 94% of the available parent width on desktop. Male and Female sections appear side by side from 900px, with automatic name columns using `repeat(auto-fill,minmax(160px,1fr))`. Selecting one gender expands its section across the directory. Headings retain blue/pink styling and show matching counts; items use subtle separators rather than oversized cards.

Phones show two full-name columns with at least 44px touch targets. Names wrap naturally at spaces, without truncation or mid-word breaking. Exceptionally narrow widths below 300px use one column. The bounded search and gender toolbar is sticky at the top on phones; the main document remains the only scrolling region. The application's navigation is not fixed and scrolls out normally; its open menu retains its higher overlay layer.

All name items are semantic keyboard-accessible links with the original `/player-stats-tabs/{playerId}` destination. The existing league-scoped `GetPlayers/{leagueId}` endpoint and profile implementation are unchanged. The old first-name alphabetical convention, including `Open` last, is retained, with last-name/ID tie breakers for predictable order. CSS Grid displays that order left-to-right, then down, so visual and keyboard order agree at every width.

Search matches first/last/full names, ignores case and excess search whitespace, and filters locally. All/Men/Women defaults to All and preserves the search text. Other/unspecified classifications appear separately under All rather than being silently classified as women. Current API records retain their existing Male/Female mapping.

League changes cancel obsolete reads and retain local search/filter choices; equivalent league emissions avoid unnecessary reads. Loading, no-league, empty, no-match and retryable error states are explicit. Player services, backend models, routes, authorization and database behavior were not changed.

### Directory measurements

The fixture contained 300 male players, 300 female players and one explicitly unspecified player, including duplicate names with distinct IDs and compound/long names.

| Viewport | Name columns per visible section | Gender sections |
|---:|---:|---|
| 320 | 2 | Stacked |
| 375 | 2 | Stacked |
| 390 | 2 | Stacked |
| 430 | 2 | Stacked |
| 768 | 4 | Stacked |
| 1024 | 2 | Side by side |
| 1280 | 3 | Side by side |
| 1920 | 5 | Side by side |
| 2560 | 6 | Side by side |
| 3440 | 9 | Side by side |

At 375px the large fixture's page height fell from 30,203px to 14,831px, **50.9% lower**. At 1920px directory width increased from 1000px to 1777px; at 3440px it increased to 3205px. These fixture measurements demonstrate layout improvement; actual roster heights depend on attendance and name lengths.

## Verification

- Angular Development and production builds passed after each implementation stage. Existing Browserslist freshness notices remain; no dependency changes were made.
- Compact-controls suite passed at 320, 375, 430, 768, 1280, 1920, 2560 and 3440px. Verified 34px Rules row, 4px gaps, enabled count, keyboard expansion/collapse, preserved values, expanded columns, toolbar alignment, fixed controls, counts, success feedback and no horizontal overflow.
- Existing player-browser regression passed six groups and nine widths, including pending/duplicate submissions, click-time division changes, failure/retry, lost-response reconciliation, concurrent membership, close during pending write, league changes, loading/empty/error states, fixture permissions, keyboard focus, quick add and creation.
- Directory suite passed all ten requested widths. Independently verified all 601 link IDs/destinations, alphabetical DOM order, long names, counts, unknown classification, local combined search/filter behavior without new player requests, single-section expansion, sticky toolbar, loading, league changes, empty/error/retry, keyboard filter operation and actual profile-header navigation using fixture data.
- Final compact and directory suites also passed against assets served by the running Development application at `https://localhost:5001`, with service workers blocked. All API/authentication traffic remained intercepted synthetic fixtures. No stale cached asset assumption or successful real-login claim.
- Zero page errors or horizontal overflow in these browser suites. `git diff --check` passed.
- Backend build was not rerun: these changes are confined to frontend components and verification scripts, with no backend contract change.

### Scope of verification

Browser screenshots and responsive checks used Chromium emulation, not physical phones. Membership persistence and authorization responses were exercised with synthetic fixtures, not new database writes or real-account login. Full profile statistics calculations and the large Scrambler statistical suite were not repeated because their implementation was not changed.

## Screenshots and artifacts

- Rules: [collapsed mobile](../../tests/functional/artifacts/compact-controls/live/rules-collapsed-375.png), [collapsed desktop](../../tests/functional/artifacts/compact-controls/live/rules-collapsed-1920.png), [expanded mobile](../../tests/functional/artifacts/compact-controls/live/rules-expanded-375.png), [expanded desktop](../../tests/functional/artifacts/compact-controls/live/rules-expanded-1920.png).
- Add Existing Players: [mobile](../../tests/functional/artifacts/compact-controls/live/browser-375.png), [desktop](../../tests/functional/artifacts/compact-controls/live/browser-1920.png), [ultrawide](../../tests/functional/artifacts/compact-controls/live/browser-3440.png).
- Directory: [mobile](../../tests/functional/artifacts/player-directory/live/directory-375.png), [sticky mobile toolbar](../../tests/functional/artifacts/player-directory/live/directory-sticky-375.png), [desktop](../../tests/functional/artifacts/player-directory/live/directory-1920.png), [ultrawide](../../tests/functional/artifacts/player-directory/live/directory-3440.png), [single-gender desktop](../../tests/functional/artifacts/player-directory/live/directory-women-1920.png).
- Detailed before/after measurements, screenshots at every requested width, logs and results: `tests/functional/artifacts/compact-controls/` and `tests/functional/artifacts/player-directory/`.

## Files changed for these requests

- `ClientApp/src/app/scrambler/scrambler.component.html` and `.less`: disclosure placement and compact spacing only.
- `ClientApp/src/app/league-management/existing-player-browser.component.html`, `.css`, `.ts`: compact toolbar, metadata and feedback wording; existing membership logic preserved.
- `ClientApp/src/app/fetch-data/fetch-data.component.ts`, `.html`, `.less`: directory presentation, local filtering and scoped loading lifecycle.
- `tests/functional/scripts/compact-controls-ui.cjs`, `player-directory-ui.cjs`: targeted fixtures and measurement suites.
- Existing browser harness: optional live-asset mode; prior toolbar test updated for the new label/layout.

Implementation and requested browser verification are complete. No pending deployment or Git operation was performed.

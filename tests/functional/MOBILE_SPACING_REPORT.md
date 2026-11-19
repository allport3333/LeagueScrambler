# Shared Mobile Top Spacing Fix

## Root cause and changes

The application shell applied **85px of top padding** to `.body-content` on phones, even though the current navigation bar is already in normal document flow. The computed navigation position was `static`, so this reserved space was added below the actual navbar. Home, Scrambler, K/Q Standings and Profile had accumulated separate route-specific exceptions; most other pages still inherited the full spacer.

Replaced the old rule and exceptions with one shared **6px content-shell padding** at the existing responsive-navigation breakpoint, **1023px and below**. Individual pages keep their intentional container margins, card padding, titles, banners and logos. The shell padding combines with those existing margins; it is not a requirement that each visible glyph start exactly 6px from the navbar. Removed the obsolete route class bindings/getters, and synchronized the existing LESS/minified companion files so they cannot reintroduce the old 85px rule. No negative margins or positioning offsets were added.

Two additional spacing sources were confirmed and corrected:

- **Password reset:** its full-viewport-height centered wrapper put the form far below the navbar on phones/tablets. It now uses natural height with 16px of intentional top margin at narrow widths. Its existing card padding is retained; the card starts approximately22px below the navbar. Desktop keeps the original `height:100vh` centered layout, and form bindings/validation are unchanged.
- **Loading views:** Player List used a 100vh centered loading panel; Team Management and the two legacy score/schedule pages used fixed viewport-centered panels. Added one shared `.page-loading` mobile rule and applied that class to the existing four loading wrappers. Narrow screens use normal document flow, natural height and compact spacing. Original desktop loading styles remain unchanged. No loading conditions, requests or visibility logic changed.

No navigation, mobile drawer, league selector, routes, authentication, API, data, modal or form logic changed.

## Measured results

Browser-measured distance from navbar bottom to first visible text bounds at390px (not a pixel-perfect visible-glyph measurement):

| View | Before | After |
|---|---:|---:|
| Home |16px|16px|
| Scrambler |13px|19px|
| Team Management |109px|30px|
| League Dashboard / Schedule tab |102px|23px|
| K/Q Standings |22px|22px|
| K/Q Matchups |92px|13px|
| Player List |102px|23px|
| Sign In Sheet |106px|27px|
| League Management |101px|22px|
| FAQ |99px|20px|
| Profile / legacy profile redirect |23px|23px|
| Legacy schedule builder |83px|4px|
| Legacy player scores |99px|20px|
| Reset Password heading |375px|42px|
| Player List loading heading |441px|19px|

Password-reset heading spacing includes the existing20px padding *inside* its card, whose outer edge now starts22px below navigation. The legacy schedule builder begins with a compact control heading and has no extra title margin; it retains its existing header styling. Existing meaningful logos/banners and internal content spacing were preserved.

## Verification actually performed

- Angular development build **passed**: `artifacts/mobile-spacing-build.log`.
- Reviewed every route declaration: Home, Scrambler, Team Management, League Dashboard, its Schedule view, K/Q Standings, K/Q Matchups, Player List, Sign In Sheet, League Management, FAQ, Profile, legacy `/schedule`, legacy `/player-scores`, password reset and legacy profile redirect.
- **93 after-change route/viewport measurements passed**: the six representative views at320/375/390/430/600/768/1366px, and remaining views at320/390/600/768/1366px, plus the Player List loading state. Before measurements covered all views at390/768/1366px.
- All checked pages had no horizontal page overflow and no overlapping navigation/content. First meaningful content remained near the top. At1366px, first content positions matched the before measurements on every reviewed view.
- **16 separate loading-layout checks passed**: all four loaders at320/390/768/1366px. Narrow layouts use natural-height/static positioning; desktop retained the original viewport-height/fixed positioning and dimensions.
- Verified page scrolling, mobile drawer opening/closing without pushing content, league selection, Full Schedule dialog viewport bounds/closing, and FAQ expand/collapse.
- No browser page errors. See `mobile-spacing-evidence/after-results.json`, `after-metrics.json`, `before-metrics.json` and `loading-results.json`.

All application API traffic was intercepted with browser fixtures. No SQL/database writes, credential changes or real-account mutations occurred. No backend source changed, so no new backend build or database tests were required. No full regression suite was run. Desktop loading geometry and first-content positions were checked; this was not an automated pixel comparison of every page.

## Before / after screenshots

| View | Before | After |
|---|---|---|
| Player List |[Before](mobile-spacing-evidence/before-player-list-390.png)|[After](mobile-spacing-evidence/after-player-list-390.png)|
| Home |[Before](mobile-spacing-evidence/before-home-390.png)|[After](mobile-spacing-evidence/after-home-390.png)|
| Scrambler |[Before](mobile-spacing-evidence/before-scrambler-390.png)|[After](mobile-spacing-evidence/after-scrambler-390.png)|
| League Dashboard |[Before](mobile-spacing-evidence/before-dashboard-390.png)|[After](mobile-spacing-evidence/after-dashboard-390.png)|
| K/Q Standings |[Before](mobile-spacing-evidence/before-kq-standings-390.png)|[After](mobile-spacing-evidence/after-kq-standings-390.png)|
| Schedule |[Before](mobile-spacing-evidence/before-schedule-tab-390.png)|[After](mobile-spacing-evidence/after-schedule-tab-390.png)|
| Password reset |[Before](mobile-spacing-evidence/before-reset-password-390.png)|[After](mobile-spacing-evidence/after-reset-password-390.png)|

Matching desktop captures for the six representative views are also in `mobile-spacing-evidence`, named `before/after-<view>-1366.png`.

No publishing, deployment, commits, pushes, merges or production changes.

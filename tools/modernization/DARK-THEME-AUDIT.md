# Dark theme audit

## Scope

The Angular router and shared styles were reviewed alongside the Home account forms, Scrambler, Team Scores workspace, League Dashboard tabs, public schedule, K/Q pages, player directory and profile tabs, Sign In, League Management, password reset, Install Locally, and FAQ. Component inspection included add/import and edit-player dialogs, the schedule editor, the roster overlay and appearance/menu overlays. The routed legacy schedule and player-scores views were reviewed in source. The browser capture matrix and remaining visual gaps are described below.

## Contrast failures found

- League Teams painted Gold, Silver and Bronze cards through inline bindings. Those bindings retained light surfaces while Material switched foreground text to light.
- Dashboard standings had a fixed pale alternate row in desktop and mobile styles. Bootstrap's independent table striping and semantic score cells also needed their own dark treatment in K/Q standings.
- K/Q matchups and Sign In had separate legacy gender colors, independent of the dark player palette. Some score headers and empty-state surfaces also used pale local backgrounds.
- Player Directory, Install Locally and Manage Schedule had dark foreground or white panel rules outside the original theme tokens.
- Fixed colors also remained in player import, profile statistics, account forms, Scrambler results, alerts, and interactive hover states.
- Angular Material's M2 theme provides native overlay theming. Boolean status and action colors still needed semantic tokens for local CSS and button variants.

## Changes

The two dark themes now share tokens for alternate rows, warning and substitute score surfaces, focus, disabled text, and action colors. Dark Navy uses blue-toned rows and Charcoal uses gray rows. Material button and table overrides are scoped at the themed document root so overlays inherit them. Primary actions use muted blue, explicit positive actions use green, destructive and reset actions use red, and neutral filled actions use gray. Native Material interaction states remain available. Component styles use fallback values from Classic Light.

Gold and Silver surfaces and accents retain separate identities. Player classifications use consistent dark blue and burgundy surfaces with readable text. K/Q score highlights keep green totals, red drop/adjustment text and purple substitute surfaces. The Bootstrap stripe token uses a dark background on each alternate row without obscuring individual cell highlights. The install panel, administration preview and import panels now inherit surface and alert tokens.

The season print output keeps its print-specific white paper palette. Existing Classic Light colors are the fallback for the adjusted component rules. No score calculations, player ranking, scheduling, authentication, PWA update logic, database contracts or layout breakpoints were changed for the theme work.

## Browser evidence

The reproducible Edge runner is schedule-themes.cjs. It uses the production bundle and synthetic teams, members, standings and saved matchups. Evidence is stored in tests/functional/artifacts/modernization/dark-theme/. The schedule is captured from 320 to 3440 px, with representative populated pages at 390 and 1280 px in each theme. Desktop and mobile Account menus, the week dropdown and Full Schedule dialog are also captured. Team assignment and the reused player browser have their own responsive evidence in the team-workspace folder.

Computed contrast checks sample the displayed foreground and nearest painted background. They cover representative custom and Material surfaces and are supplementary to visual inspection. They are not an exhaustive WCAG audit. Native standalone devices, every dialog/validation permutation and printed colors on physical printers remain unverified.

## Recorded results

The paired Edge runs sampled 16 rendered dark-theme color combinations across the team cards, standings, player directory, K/Q matchups, Sign In, schedule administration and Install Locally. The baseline had 12 failures below 4.5:1. The restored build passed all 16 samples, with a minimum of 8.24:1. Compare before/ and browser/ in the dark-theme artifact folder. Among the Classic Light evidence, the 390 px Install Locally and 1280 px team standings, K/Q standings and K/Q matchup captures were byte-identical before and after.

The Angular production build and all 24 unit tests passed. The Edge fixture matrix and service-worker suite passed. The browser suite used synthetic data and did not exercise a native installed PWA.
## FAQ, nested score tables and profile follow-up

The FAQ accordion uses dedicated selectors and native buttons with aria-expanded. No other component reuses its question selector. Dark themes now provide the text, divider and state surfaces while Classic Light retains its original fallback colors. The separate profile history disclosure uses the semantic heading, muted text and focus colors.

Individual Team Scores now uses separate card, nested table, header and alternating row surfaces. The table palette also supplies standings stripes and schedule table headers. Matchup History uses foregrounds paired with the male and female badge surfaces. The computed checks and populated desktop and mobile captures are under tests/functional/artifacts/modernization/theme-eligibility/.

# Standings to player profile navigation — November 18, 2026

## Changes

All four existing detailed standings tables (Overall men/women and division men/women) now render player names as semantic Angular Router links to /player-stats-tabs/:playerId. Links use the existing transformed PlayerId and selected league, and select tab=kq. A restrained underline/hover treatment preserves cell typography, padding and row structure. Individual score links remain unchanged.

Compact mobile rows and their name/row expansion handlers are unchanged. Expanded details now include a compact blue View Profile link with a person icon and 44px touch target below the existing optional division information. It stops click propagation. Score links, chronological ordering, dropped/substitute/reduced-score formatting are unchanged.

Profile links include fromStandings, leagueId, standingsMode, divisionId, gender and mobileFullTable. PlayerStatsTabs shows Back to Standings only when explicitly reached from standings. Its existing query merge preserves this context through profile tab changes and refresh. Return navigation restores the existing standings mode/division/gender selection; a small initialization addition restores compact/full-table presentation. Normal direct profile URLs and ordinary Profile navigation retain their existing behavior. This does not restore expanded rows or prior scroll position, nor add a new navigation/history mechanism.

No identity is derived from names. Namesakes remain separate PlayerIds. No backend, API, schema, scoring, ranking, authorization, authentication or league-selection-service changes were needed.

## Verification

Angular development build passed using installed Angular 7 dependencies. Existing outdated Browserslist warning remains; log: artifacts/standings-profile-navigation-build.log.

Four focused browser workflow groups passed, with no page errors or write requests:

1. Desktop 1366/1920: clickable names, separate links for namesake IDs 3 and 4, correct player ID/league, active King/Queen Stats, refresh and Back to Standings.
2. Mobile 375/390: name expands without navigation, division and profile action visible, score links retained, profile action selects the intended player; selected Gold division, Women's standings, matchup mode and compact presentation restored after profile refresh/return. No horizontal page overflow.
3. Mobile Full Table: names remain links, namesake PlayerId4 opens its own profile, selected league2 retained and full-table presentation restored on return.
4. Existing individual score link actually clicked from standings and verified on the exact K/Q matchup with selected-round highlighting. Normal direct player profile has no unexpected Back to Standings action.

HTTP APIs were intercepted with deterministic synthetic fixtures on localhost; no SQL, real accounts, database reads/writes or mutation authorization involved. Live database-backed integration was not executed. The complete regression suite was not run. Tests exercise native links and buttons; a separate exhaustive keyboard/accessibility audit was not performed.

## Screenshots

- [Desktop names at 1366](player-profile-evidence/standings-player-links-1366.png)
- [Desktop names at 1920](player-profile-evidence/standings-player-links-1920.png)
- [Expanded mobile with View Profile, 375](player-profile-evidence/standings-mobile-view-profile-375.png)
- [Expanded mobile with View Profile, 390](player-profile-evidence/standings-mobile-view-profile-390.png)
- [Mobile Full Table links](player-profile-evidence/standings-mobile-full-profile-links.png)
- [Destination profile](player-profile-evidence/standings-destination-profile-390.png)

Results: player-profile-evidence/standings-profile-navigation-results.json. All screenshots contain synthetic data.

## Repeat focused checks

With the existing local application serving the development Angular bundle:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --standings-profiles
```

## Files changed in this pass

Application: league-standings/league-standings.component.ts, .html, .css; player-stats-tabs/player-stats-tabs.component.ts, .html, .css under ClientApp/src/app. Test assertions/fixtures: tests/functional/scripts/player-profile-ui.cjs; generated screenshots/results; this report and WORK_LOG.md. Earlier pending changes were preserved.

No publish, deploy, commit, push, merge, package installation, production access, IIS/Cloudflare or deployment configuration changes. Task complete.
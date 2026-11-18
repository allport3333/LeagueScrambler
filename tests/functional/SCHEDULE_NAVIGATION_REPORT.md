# League Dashboard schedule navigation — November 18, 2026

## Implemented
Replaced only LeagueScheduleComponent's inner week tabs with a centered Previous Week / scheduled-week dropdown / Next Week navigator. Dropdown options retain actual API week numbers, dates and order; arrows move by available schedule entry, not calendar-week arithmetic. First/last boundaries disable the corresponding arrow. Buttons have 44px touch targets and the selected week/date remain visible on desktop and phones.

The original setClosestWeekAsActiveTab method is unchanged: it compares absolute millisecond distance from new Date() and keeps the earliest encountered entry for equal differences. No date truncation, future-week preference or new scheduling rules were introduced.

Removed the duplicate ngOnInit load; input changes now load once through ngOnChanges. Same-league guards avoid redundant loads, cancellation/version checks reject stale responses, and changing leagues immediately clears old cards. Manual selection changes only activeTabIndex and survives normal dashboard tab switching without reloading. A new league or direct refresh selects the closest scheduled entry as before. Explicit Retry handles failed requests; no-schedule and selected-week-without-matchups states are distinct from errors/loading.

Main dashboard tabs are unchanged: Standings, Schedule, Individual Team Scores, League Teams. Existing matchup markup/order, team names, VS, division colors/labels, widths and hover behavior were retained. Only modest surrounding gaps/card bottom margin were reduced. No backend, API, schedule algorithm, saved record, authentication, schema or service changes.

## Verification
Angular development build passed with installed packages; the existing outdated Browserslist warning remains. Log: artifacts/schedule-week-navigation-build.log.

Four focused browser workflow groups passed, with no page errors or write requests:
1. Closest date initially selects Week6. Fixtures use actual available numbers 1/6/9 with large date gaps; arrows/dropdown navigate those entries, boundary buttons disable correctly, and manually selected Week1 remains after switching dashboard tabs. Exactly one initial schedule request and no request during that tab switch.
2. League change clears cards while loading, then selects the new league's closest week with one new schedule request.
3. One past week disables both arrows; no schedule, empty matchup week, request failure and retry states all behave correctly.
4. Direct dashboard refresh reselects the closest week; all four dashboard tabs remain present.

Layout checks/screenshots covered desktop 1366/1920 and mobile 375/390/430 without horizontal page overflow. Three colored matchup cards remain side by side at desktop widths and retain their mobile stacking. APIs were intercepted with synthetic fixtures on localhost; no SQL, real records, credentials, mutation authorization, production access or email involved. Live database-backed responses were not verified; no complete regression suite was run.

## Screenshots
- [Desktop](player-profile-evidence/schedule-navigator-1366.png)
- [Large desktop](player-profile-evidence/schedule-navigator-1920.png)
- [Mobile 375](player-profile-evidence/schedule-navigator-375.png)
- [Mobile 390](player-profile-evidence/schedule-navigator-390.png)
- [Mobile 430](player-profile-evidence/schedule-navigator-430.png)
- [Dropdown open](player-profile-evidence/schedule-dropdown-open.png)
- [First week / Previous disabled](player-profile-evidence/schedule-first-week.png)
- [Last week / Next disabled](player-profile-evidence/schedule-last-week.png)
- [Manual selection different from closest](player-profile-evidence/schedule-manual-selection.png)

Results: player-profile-evidence/schedule-navigation-results.json.

Repeat with the existing local development Angular application:
```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --schedule-navigation
```

Application files changed in this pass: league-schedule.component.ts, .html, .css under ClientApp/src/app/league-schedule. Focused tests/fixtures extended tests/functional/scripts/player-profile-ui.cjs; reports, screenshots/results and WORK_LOG.md updated. Earlier pending changes were preserved. No packages installed, publish, deploy, commit, push, merge, IIS/Cloudflare or deployment configuration changes. Task complete.
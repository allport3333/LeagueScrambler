# Adaptive profile attendance appearance — November 18, 2026

Presentation-only refinement to PlayerAttendanceComponent. Existing pending work was preserved.

- Available: original prominent League Night Sign In card and green action retained.
- Wrong day/unavailable: borderless compact status row; the server's “Sign in is available on [day] only.” reason is displayed as “League sign in opens [day]” with a calendar icon. Other server reasons remain unchanged.
- Explicit administrator lock: distinct lock icon and existing lock explanation. No disabled oversized button or empty card.
- Already signed in: compact green confirmation and secondary Remove Sign In action, retaining its 44px touch target, confirmation and server-driven availability. A restriction explanation still appears when relevant.
- Known non-owner/unlinked profiles do not render the self-service section. Loading/error/retry behavior is retained without enabling attendance actions before eligibility completes.

No attendance rules, day/date calculation, APIs, identity/lock checks, mutation handlers, database records, administrator page, Next Game component or statistics layout were modified. Two new TypeScript getters format existing server reason text/icons only.

## Verification
Angular development build passed; existing outdated Browserslist warning remains. Log: artifacts/attendance-appearance-build.log.

Six focused visual/state groups passed across 1366/1920 desktop and 375/390/430 mobile: available card; wrong-day row; administrator-lock row; compact signed confirmation/removal cancellation; other-profile hiding/error-retry; no overflow and compact-state heights below70px.

Six existing attendance browser workflow groups also passed again: sign-in/pending-click guard; status refresh/direct reload; existing Sign In Sheet shared fixture-list refresh and Scrambler GET contract; removal confirmation/cancel/success; HTTP409 refresh; locked/wrong-day/nonmember/unlinked/other-player states; simulated unauthorized removal/expired session/error retry; independent league attendance and delayed/rapid switching.

Browser HTTP was intercepted with synthetic fixtures; mutations updated only an in-memory fixture. Zero page errors or real write requests. No SQL or production access; real backend/database integration was not performed. No full regression suite or backend build was needed for this visual-only change.

## Screenshots
- [Unavailable mobile](player-profile-evidence/attendance-appearance-unavailable-390.png)
- [Available mobile](player-profile-evidence/attendance-appearance-available-390.png)
- [Signed in mobile](player-profile-evidence/attendance-appearance-signed-in-390.png)
- [Locked mobile](player-profile-evidence/attendance-appearance-locked-390.png)
- [Unavailable desktop](player-profile-evidence/attendance-appearance-unavailable-1366.png)
- [Available desktop](player-profile-evidence/attendance-appearance-available-1366.png)

Result JSON: player-profile-evidence/attendance-appearance-results.json and profile-attendance-browser-results.json. All screenshots contain synthetic data.

## Files and rerun
Changed source: ClientApp/src/app/player-attendance/player-attendance.component.ts, .html and .css. Updated focused fixture assertions in tests/functional/scripts/player-profile-ui.cjs; generated evidence, this report and WORK_LOG.md.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --attendance-appearance
```

No publish, deploy, commit, push, merge or production/IIS/Cloudflare changes. Task complete.
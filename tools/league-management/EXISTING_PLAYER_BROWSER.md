# Fast Add Existing Players browser

Implemented November 20, 2026 on the existing master working tree. All prior
uncommitted Scrambler work was preserved. No commit, merge, push, deployment,
database migration, or automated membership database write was performed.

## User workflow

League Management → Manage Players now includes **Browse Existing Players** next
to the existing Add Existing Player search. It opens an Angular Material dialog
titled **Add Existing Players**, with the captured selected league beneath it.

The browser has local name search, All/Men/Women filters, the league's actual
division options (including the existing No Division choice), an available-player
count, and centered player buttons using the existing blue/pink color convention.
There are no checkboxes, staged selections, or final Save button.

Clicking a player starts an immediate membership operation. Only that player's
button is disabled. The button remains until server confirmation, then disappears
and Current League Players updates by ID without reloading the full roster.
Search, filters and division stay selected, and the dialog remains open. Completed
additions survive closing. Pending requests finish against their captured league
and division; closing or changing leagues does not redirect them to a new target.

## Data and server behavior

- New `GET api/ScrambleData/AvailableLeaguePlayers/{leagueId}` returns only players
  without a membership in that league, plus its divisions. Other-league membership
  does not exclude a player. The projection contains IDs, names and existing gender
  classification, not contact/account data. It uses no-tracking queries.
- The dialog calls the existing `AddPlayer/{leagueName}` endpoint with
  `existingOnly=true`, `expectedLeagueId`, `leagueDivisionId`, and `{ id: playerId }`.
  Other callers retain the original request/response contract.
- This explicit existing-only mode validates a real player ID, verifies the route
  league against the captured league ID, validates division ownership, and never
  creates or modifies a player profile. It returns the actual confirmed membership
  division and an already-member indication.
- Already-existing memberships are retained without changing their division or
  substitute flag. Duplicate names never determine the browser's target identity.
- Serializable membership transactions protect the existence-check/insert sequence.
  The existing AddPlayer flow also uses a transaction so concurrent browser and
  legacy additions participate in the same protection. Its existing division/sub
  update and Create New Player behavior remain otherwise unchanged.
- Both new read behavior and writes reuse `LeagueManagement` authorization and
  `LeagueAccess.CanManage`; Manager access remains limited to assigned leagues.
  Authentication, roles and the shared legacy password implementation are unchanged.
- On a failed/lost response, a scoped membership lookup by ID confirms whether this
  or another administrator already completed the addition. It returns the actual
  division, preventing a stale selected division from overwriting another admin's
  assignment. Otherwise the button is restored with an understandable retry message.
- The shared PlayerService deduplicates in-flight requests per league/player, even
  across closing/reopening the dialog. Writes have a finite timeout. SQL serialization
  may reject one racing transaction; the UI reconciliation/retry path handles failures.

`memberPlayerId` on the read endpoint is used only for that single-membership
reconciliation, avoiding a full available-player reload after errors. Successful
clicks do not issue another availability or full-roster query.

## Responsive layout and accessibility

Desktop dialog width is approximately 94vw with no arbitrary desktop maximum.
The grid uses `repeat(auto-fill, minmax(130px, 1fr))`, so available content width
determines the number of columns. Ordinary phone widths use three columns;
exceptionally narrow widths use two. Player words use normal wrapping, names stay
centered, and grid rows use consistent heights. The selected gender filter uses
a distinct local class to avoid the site's global gray `button.active` rule.

Only the grid scrolls vertically. The title, Close action, search, gender filters,
division and count remain accessible. The dialog uses vh fallbacks and dvh sizing
for changing viewport height. Standard Material focus containment, Escape closing,
and focus restoration are retained. Additions/failures have live status/alert text;
buttons support keyboard activation and visible focus.

Measured in Chromium using 600 synthetic player profiles:

| Width | Player columns |
|---:|---:|
| 320 | 2 |
| 375 | 3 |
| 390 | 3 |
| 430 | 3 |
| 768 | 5 |
| 1280 | 8 |
| 1920 | 12 |
| 2560 | 17 |
| 3440 | 23 |

No horizontal overflow was observed in the modal, grid or player buttons. Phone
tests used 667/844px heights; a reduced 390×430 viewport also retained accessible
controls and a scrollable grid. This is viewport emulation, not a claim of native
Android/iOS keyboard verification. No pagination or virtual-scrolling dependency
was necessary for the tested 600-player dataset.

## Verification actually performed

The focused browser test intercepts all HTTP traffic and serves the real compiled
Angular application. Membership writes in these tests are in-memory fixtures.

Passed:

- Existing member excluded; other-league player available; duplicate-name players
  identified separately by ID.
- Loading state, local mixed-case full-name search, clearing search, gender filters,
  persistent search/division selections, and no per-keystroke network calls.
- Immediate request, disabled pending button, duplicate-click prevention, removal
  only after confirmation, and immediate Current League Players update.
- Gold selected at click time remains Gold when the selector changes to Silver
  during the pending request; No Division and subsequent Silver additions work.
- Failure/retry, lost-response reconciliation and another admin's existing Gold
  membership remaining Gold despite a stale Silver selection.
- Closing during a request preserves the completed membership; reopening excludes it.
- League change closes the browser and a pending old-league addition does not update
  the new league's roster.
- Distinct loading/error/retry, no matching search, and all-already-members states.
- Keyboard Enter activation, focus containment, Escape and accessible sticky controls.
- All nine viewport widths above, including 23 columns on an ultrawide desktop.
- Existing autocomplete Add Existing Player and Create New Player submissions through
  their unchanged API contracts; League Settings and League Setup tabs.
- Admin and authorized Manager browser use, unavailable Manager league handling,
  disabled management action, regular-player and anonymous route restrictions.
- No browser JavaScript errors.

Builds:

- Angular development build: exit 0, hash `f7ed9c0798df9a748970`.
- Angular production build: exit 0, hash `1abda5ab4d042b50874e`.
- ASP.NET backend build: exit 0, initially to an isolated local output directory;
  the final Visual Studio local build also completed with zero build errors.
- Existing Browserslist-data and legacy backend target/dependency/analyzer warnings
  remain. No packages were added or upgraded for this feature.
- Git whitespace validation passed.

The initially running local backend did not contain the new route (404). Only the
verified local Visual Studio application was stopped, rebuilt and restarted; no
unrelated process, IIS or production service was modified. After restart, both the
new GET and an anonymous invalid-ID POST were rejected with HTTP 401. Those requests
performed no membership operation. The running target was independently verified as
Development, localhost / LeagueScramblerDev / Windows authentication, PID 22320 at
verification time.

## Database verification limitation

**Actual membership persistence, SQL race behavior and cleanup were not executed.**
The previous mutation authorization expired at `2026-11-20T20:09:10.791Z` and was
bound to an older process. Read-only runtime inspection was not treated as renewed
write approval. No approval files were extended and no isolation safeguards were
bypassed. A newly authorized synthetic development-database test is still required
to verify actual insertion, division persistence and concurrent SQL behavior.

Role tests above use browser fixtures; real Manager/Admin login and authenticated
server scope tests were not claimed. The actual unauthenticated server checks only
confirm route registration and rejection of anonymous access.

No test records were created in the database, so no database cleanup was needed.

## Files changed for this task

- `Allport's League Scrambler/ClientApp/src/app/league-management/existing-player-browser.component.ts`
- `Allport's League Scrambler/ClientApp/src/app/league-management/existing-player-browser.component.html`
- `Allport's League Scrambler/ClientApp/src/app/league-management/existing-player-browser.component.css`
- `Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.ts`
- `Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.html`
- `Allport's League Scrambler/ClientApp/src/app/services/player.service.ts`
- `Allport's League Scrambler/ClientApp/src/app/app.module.ts`
- `Allport's League Scrambler/ClientApp/src/styles.scss`
- `Allport's League Scrambler/Controllers/ScrambleDataController.cs`
- `tests/functional/scripts/existing-player-browser.cjs`
- This report.

Prior Scrambler algorithm/report tests and documentation remain separate uncommitted
work and were not overwritten or rerun unnecessarily.

## Evidence and repeatable focused test

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path 'tests/functional/.tools/browsers').Path
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/existing-player-browser.cjs
```

Local artifacts:

- `tests/functional/artifacts/player-browser/results.json`
- `tests/functional/artifacts/player-browser/players-390.png`
- `tests/functional/artifacts/player-browser/players-1920.png`
- `tests/functional/artifacts/player-browser/players-3440.png`
- `tests/functional/artifacts/player-browser-development-build.log`
- `tests/functional/artifacts/player-browser-production-build.log`
- `tests/functional/artifacts/player-browser-backend-build.log`

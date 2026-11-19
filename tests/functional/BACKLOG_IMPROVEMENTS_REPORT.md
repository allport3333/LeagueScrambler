# League Hub backlog improvements — November 19, 2026

Implemented items 1, 2, 3, 4, 5 and 8 in the requested order. No Personal Leagues or Live Sessions work was added.

## Changes and architecture

1. **League Dashboard standings:** division tables now have a focusable, named horizontal scroll region and a swipe hint. Team names wrap; numeric columns retain their widths and alignment. Scrolling stays inside the table. Rankings, values and division grouping are unchanged.
2. **Scrambler:** removed the two redundant generation-success snackbars while retaining failure/validation messages. A successful generation displays `New scramble generated` inside Results for 4.5 seconds; subsequent generations restart its timer. The unsaved printing explanation is centered without enabling printing or changing save state.
3. **Saved scheduled scores:** replaced record IDs and diagnostic disclosures with Saved Matchup Results, opposing team headings, and each team's recorded score/result chips. Duplicate-insertion guards and persistence are unchanged.
4. **K/Q adjustments:** retained the original score as display metadata before the existing adjustment runs. A marker appears only when the existing substitute/reduction flags and original/adjusted values establish a reduction. Fifty percent uses `½`; other percentages show their actual percentage. Desktop tables and compact mobile details include the marker and a legend. Dropped-score colors and substitute backgrounds remain. Markers do not participate in sorting or calculations.
5. **Schedule:** added an actual-scheduled-date picker, Current Week and Full Schedule alongside existing previous/week/next controls. Only scheduled dates are selectable. The original closest-date comparison remains the normal default; explicit deep links still take precedence and ordinary tab changes preserve manual selection without another schedule request. Full Schedule displays all returned weeks in two columns on desktop and one on phones, with current-week highlighting, available descriptions/events, and an independent printable season view. The selected league is the current season boundary; the application has no separate season selector/entity to add here.
6. **Home/Profile separation:** authenticated `/` now hosts a small Home dashboard. Next Game and existing self-attendance are reused there, followed by up to three upcoming games, the player's own team standings, and three recent individual game scores. Attendance precedes the schedule preview on mobile. Stable player/team IDs determine membership and the standings snapshot; names are not identifiers. Quick links target existing Schedule, standings and player-profile routes. Player login now lands on Home; existing Admin/Manager Scrambler landing and management restrictions remain. Profile URLs, player header, three statistics tabs, return-to-standings context and account/claim dialogs are preserved; activity cards moved to Home.

The only backend change adds `TeamId` to the existing read-only league-standings response so Home can identify the player's team reliably. No calculations, schema, write endpoints, authorization or authentication mechanisms changed. Load subscriptions cancel superseded Home requests, and player/league identity checks reject stale next-game results.

## Data limitations preserved deliberately

- `LeagueTeamScore` has score-record IDs, team/opponent IDs, date, score and WonGame, but **no explicit game-series/game-number pairing keys**, including for newly saved records. Record order is not a reliable pairing contract. Saved results therefore use the requested team-grouped fallback: “Individual historical scores are shown because game pairings are unavailable.” No invented Game 1 pairings or overall winner are displayed.
- Schedule data supplies dates, weeks, teams, divisions and descriptions. It does not currently supply reliable start times, locations or saved scheduled-game court assignments. Home omits absent values; an optional court is rendered only if supplied. Browser fixtures include an optional Court 4 solely to exercise this presentation, not to claim current database availability.
- Existing league selection is reused; no independent personal-league or live-session data model was introduced.
- The player statistics profile has no existing general account-settings editor to relocate. Existing registration, player claim and account associations are retained rather than inventing new forms.

## Verification actually performed

All browser API traffic used deterministic intercepted fixtures. No SQL access, real attendance, schedule or score writes were performed. Scrambler mutation requests were intercepted and fulfilled locally by the existing harness.

- Angular **development build: passed** (`backlog-final-dev-build.log`).
- Angular **production build: passed** (`backlog-production-build.log`). Existing Browserslist warning remains.
- ASP.NET backend **Release build: passed**, zero errors (`backlog-backend-build.log`); existing legacy package/analyzer warnings remain.
- New backlog browser checks: **8 groups passed**, no page errors (`backlog-evidence/all-results.json`).
- Existing Next Game deterministic calculation tests: **11 groups passed**, no SQL.
- Existing Scrambler results-refinements browser regression: **4 groups passed**, no page errors (`backlog-evidence/scrambler-regression-results.json`). Covered generation, compact Results, failed/retried saves, duplicate-click protection, shared save-before-print state, edit/cancel, retrieval, mobile viewer and print settings.
- Standings checked at 375, 430, 600, 768 and 1366px: every numeric column reachable inside the scroll region; long names and numbers preserved. Phone/tablet page overflow and scoped standings overflow assertions passed.
- Schedule checked at 1366, 375, 390 and 430px: real date entry, gaps, previous/next boundaries, Current Week, retained manual week, no duplicate schedule request on tab switching, complete season rendering, description/event text, league switch clearing and print HTML/PDF.
- Home checked at 1366, 1920, 375, 390 and 430px: own-team ID filtering, upcoming/current game, compact unavailable attendance, recent score, profile identity/tab/league, direct profile refresh, Schedule shortcut and league-with-no-schedule state. Admin/Manager/Player fixture visibility and anonymous Login checks passed.
- Adjustment checks: 20 -> 10 at 50% shows half marker; 20 -> 16 at 80% shows 80%; 100% has no reduction marker. Original numeric results unchanged.

**Not verified against a database:** persisted score/attendance writes, real-account login/cookie transitions, real season contents, and the live read-only TeamId response after restarting the development backend. Compilation and browser response-contract fixtures were used; the running backend was not restarted. Existing scoring/attendance calculations and write contracts were left unchanged. No full regression suite was run.

## Screenshots and print artifact

All images contain synthetic fixture data:

- [Home desktop](backlog-evidence/home-1366.png), [1920px](backlog-evidence/home-1920.png), [Home mobile](backlog-evidence/home-390.png)
- [Profile retains statistics](backlog-evidence/profile-statistics-mobile.png)
- [Mobile standings after horizontal scrolling](backlog-evidence/league-standings-375.png), [tablet](backlog-evidence/league-standings-768.png)
- [Inline scramble notice](backlog-evidence/scrambler-inline-notice.png), [unsaved print footer](backlog-evidence/unsaved-print-message.png)
- [Saved historical results](backlog-evidence/saved-results-mobile.png)
- [Adjusted scores desktop](backlog-evidence/kq-adjusted-desktop.png), [mobile](backlog-evidence/kq-adjusted-mobile.png)
- [Full Schedule desktop](backlog-evidence/full-schedule-1366.png), [mobile](backlog-evidence/full-schedule-390.png), [print PDF](backlog-evidence/full-season-schedule.pdf)

No publishing, deployment, commits, pushes, merges, production changes or database mutations.

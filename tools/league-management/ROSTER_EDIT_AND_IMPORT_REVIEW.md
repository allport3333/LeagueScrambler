# League player editing and import review

Implemented on master, November 20, 2026. Existing uncommitted Scrambler,
Browse and file-import work was preserved. Nothing committed, merged, pushed or
deployed. This report supersedes the previous import report's description of
leaving the import to create a missing player.

## League player editing

Current League Players now uses a bordered Player Name / Division / Actions
table. Small screens use labeled stacked rows with both Edit and Remove visible.
Name search and Show All remain; a division filter uses the selected league's
configured IDs, including No Division. Membership metadata now comes directly
from the existing available-player context with `includeMembers=true&membersOnly=true`,
rather than inferring divisions from score records.

Edit opens a compact Material dialog with player, league, current division,
destination division, Save Changes and Cancel. It reads the current membership
before editing. Success refreshes the roster and gives brief feedback; failures
retain the selection. A changed division is rejected as stale instead of silently
overwriting another administrator's change.

New endpoint: `PUT api/ScrambleData/LeaguePlayerDivision/{leagueId}/{playerId}`,
body `{ divisionId, expectedDivisionId }`. It uses the existing LeagueManagement,
SameOrigin and LeagueAccess controls, verifies division ownership, and updates only
`PlayersLeague.LeagueDivisionId` in a serializable transaction. The membership's
primary key, player ID, IsSub and all other league memberships remain unchanged.

### Team and historical relationships

`PlayersLeague.LeagueDivisionId` and `LeagueTeam.Division` are independent fields.
Team membership is stored separately in `LeagueTeamPlayer`; the model has no
active/historical date range on these membership rows. Edit shows the existing
selected-league team names and their divisions and explains that teams are managed
separately. It never moves a player between teams or changes a team's division.

Player standings may subsequently group the player under the newly selected
division, as the existing standings code reads current membership. Scoring
calculations and historical records are not rewritten. Team standings retain their
existing team division.

## Import filters and attention states

Summary items are semantic buttons with visible active styling and aria-pressed.
They share the same filter state as Show Rows; search is applied alongside it.
Filtering does not change matches, divisions, uploaded data or confirmation state.

| Filter | Meaning |
|---|---|
| Parsed Rows / All rows | Every parsed preview row |
| Exact Matches | Resolved ID has an exact normalized name; invalid rows excluded |
| Ready to Add | Currently resolved, valid, eligible rows |
| Requiring Review | Ambiguous/unconfirmed matches, missing players, unknown divisions, duplicates or invalid rows |
| Already in League | Existing members excluded from addition |
| Not Found | Missing rows without a confirmed ID or suitable candidate |
| Duplicates | Repeated uploaded names or resolved IDs excluded from addition |
| Invalid | Invalid source/name cells |
| Added | Confirmed additions from the current preview |

These categories intentionally overlap: an exact match can also be Already in
League or Duplicate. Requiring Review is an aggregate attention filter and includes
Not Found, Duplicate and Invalid. Ordinary enrolled rows are not flagged.
Counts recalculate after matching, division changes, profile creation or import.
Zero-count filters remain usable and display the normal empty-filter result.

Attention rows have a light warning background, warning symbol and text status.
The review summary is also emphasized. The most recently reviewed row has a
visible outline. Title, selected league, filename, default division, search,
Show Rows and final import action remain accessible while the body scrolls.

## Matching navigation

Review remembers the original row and internal scroll position. Matching controls
render first inside the dialog body. Angular `AfterViewChecked` waits for their
view references, sets only the dialog body's scrollTop, and focuses the matching
search field with preventScroll. No fixed timeout or background-page scrolling.

Confirmation updates the original row by player ID, refreshes counts, preserves
filters/search and returns to that row when visible. If the row leaves the active
filter, the fixed status notice explicitly says it was matched and is hidden by
the current filters. Cancellation preserves the row and returns to the preview.

## Create a missing player inside import

A compact Material dialog opens above the retained import dialog. Material's
existing focus/overlay infrastructure is reused; the parent cannot accidentally
close via Escape while the child is open. Cancel closes only the child.

- Show the uploaded name, editable first/last names, required existing gender
  options, Create Player and Cancel.
- Separate mapped name fields are prefilled. A full-name-only value is retained
  unsplit in First Name with a clear instruction to review both fields. For example,
  `Lauren (Lack Of) Height` is never split at the last word automatically.
- Unique exact candidates may resolve normally in preview. Within creation, exact
  existing names block creation and offer explicit existing IDs. Similar names
  show candidate buttons and require acknowledgment before creating a separate
  profile. Choosing an existing candidate is explicit; fuzzy results never link
  automatically.
- Calls the existing `addPlayerWithoutLeague` service and endpoint, scoped with
  `?importLeagueId=...`. Registration and standalone Create retain their contracts.
- The import-specific endpoint path checks existing league permissions, names and
  gender, normalizes whitespace, and serializes exact-name lookup/insertion.
  A concurrent unique exact profile is returned rather than duplicated; multiple
  exact records require choosing the correct existing ID.
- Creating a profile inserts no league membership. On success, close only the
  child, resolve the original preview row to its returned ID, preserve its division
  and all other rows, then require the normal Add N Matched Players confirmation.
- A failed/uncertain response retains the form, shows an error and reloads possible
  existing matches. It does not mark the import row resolved without confirmation.

The old parent navigation/prefill handoff is removed. Browse immediate additions,
Quick Add and standalone Create remain separate workflows. No file parser, library,
dependency, schema, scoring or authentication change was needed.

## Tests actually performed

| Verification | Result |
|---|---|
| Parser/matching regression suite | 35 named checks passed, including TXT/CSV/XLSX/XLS |
| Rendered Angular fixture suite | 11 scenario groups, 34 layout measurements, zero page errors |
| Import/review widths | 375, 430, 768, 1280, 1920, 2560, 3440; no horizontal overflow |
| Nested Create widths | 375, 430, 768, 1920; controls within viewport, no horizontal overflow |
| Roster/Edit widths | 375, 768, 1920; name, division and actions accessible |
| Existing Browse regression | Nine widths, 320–3440; adaptive 2/3/5/8/12/17/23 columns as before |
| Frontend development build | Passed, hash `2db3b8096a283db708ce` |
| Frontend production build | Passed, hash `65eb8c6fd65a670a838a` |
| Backend and integration executable builds | Passed; existing framework/package warnings remain |
| Real Development database integration | Passed; cleanup verified |
| Live anonymous context/edit/profile requests | All 401 after local restart |
| Whitespace check | `git diff --check` passed |

Browser scenarios cover all summary filters, overlapping categories, zero results,
search/dropdown synchronization, retained selections, internal scrolling and focus,
correct row updates, hidden-row feedback, duplicate-name IDs, ambiguous full-name
prefill, fuzzy duplicate acknowledgment, nested Escape/cancel, failed profile
creation/retry, profile-only creation followed by explicit membership confirmation,
division retention, stale edits, save failure, roster refresh, Quick Add, standalone
Create, Browse, Settings and Setup.

Browser testing found and corrected an actual Angular Material boolean coercion
issue: an empty suggestion list made the disabled expression return numeric zero.
The binding now returns a boolean, allowing valid new-player forms to submit.
Fixture-only timing and Material checkbox targeting issues were also corrected.

### Real SQL verification and safety

Existing explicit user authorization for development database testing was honored.
Before writes, the running Visual Studio Development process and its effective
Windows-authenticated `localhost / LeagueScramblerDev` connection were verified;
the SQL machine name also matched this computer. A fresh, narrow process-bound
receipt was used. Expired milestone approvals were not reused or bypassed.

Test prefix: `LSImport_863056ed25604072a4ef7e3e0aad1c0e`.
Owned leagues 137 and 138, seven synthetic players 7462–7468, three divisions,
eight memberships, one team and one team-player relationship were created and
subsequently removed. No real account, password or existing league was changed.

Actual controller/EF operations verified:

1. Gold→Silver→Gold→No Division→Gold retains membership and player IDs.
2. Existing team membership and Gold team division remain unchanged.
3. Cross-league division IDs, stale edits and unauthorized players are rejected.
4. New profile creation alone creates no membership; normalized exact repeat
   returns the same ID. Invalid gender and unauthorized creation are rejected.
5. Separate import confirmation adds the created profile to the selected Silver
   division. Existing memberships and other league assignments remain untouched.
6. Existing bulk duplicate/concurrent-request tests still pass.
7. Exact owned cleanup succeeded. Before/after snapshots of players, leagues,
   divisions, memberships, team data, and historical K/Q team/player/round scores
   matched after cleanup.

These are real database writes through the current controller implementation with
synthetic claims. They are not a claim of real-account browser login testing.
The separate browser suite uses intercepted fixture APIs; authenticated upload-to-SQL
through a real administrator login remains a manual check.

Only the verified local Visual Studio application was restarted (PID 31220 →
15468) to load the new endpoints. The replacement remained Development against
the same local database. Anonymous requests to roster context, division editing
and scoped profile creation returned 401. No production changes or deployment.

## Files changed in this task

Under `Allport's League Scrambler/`:

- `ClientApp/src/app/league-management/player-management-dialogs.component.{ts,css}`
- `ClientApp/src/app/league-management/player-import.component.{ts,html,css}`
- `ClientApp/src/app/league-management/player-import.ts`
- `ClientApp/src/app/scrambler/scrambler.component.{ts,html,less}`
- `ClientApp/src/app/services/player.service.ts`, `ClientApp/src/app/app.module.ts`
- `Controllers/ScrambleDataController.cs`, `Models/LeaguePlayerImportRequest.cs`

Tests/documentation:

- `tests/functional/scripts/roster-review-ui.cjs`
- `tests/functional/scripts/{existing-player-browser,player-import-ui}.cjs`
- `tests/functional/scripts/check-player-import-database.ps1`
- `tools/league-management/Program.cs` and this report

## Local evidence

`tests/functional/artifacts/roster-review/` contains `browser-results.json`,
`database-results.json`, `http-authorization.json`, development/production/backend
logs, parser/browser logs and screenshots. The shared parser's detailed results
remain in `tests/functional/artifacts/player-import/parser-results.json`.

- [Mobile roster](../../tests/functional/artifacts/roster-review/roster-375.png)
- [Desktop roster](../../tests/functional/artifacts/roster-review/roster-1920.png)
- [Mobile Edit](../../tests/functional/artifacts/roster-review/edit-375.png)
- [Desktop Edit](../../tests/functional/artifacts/roster-review/edit-1920.png)
- [Mobile import review](../../tests/functional/artifacts/roster-review/import-review-375.png)
- [Desktop import review](../../tests/functional/artifacts/roster-review/import-review-1920.png)
- [Ultrawide import review](../../tests/functional/artifacts/roster-review/import-review-3440.png)
- [Mobile Create](../../tests/functional/artifacts/roster-review/create-375.png)
- [Desktop Create](../../tests/functional/artifacts/roster-review/create-1920.png)

Repeat browser checks after a development build using the existing command:
`node-v22.23.5-win-x64/node.exe tests/functional/scripts/existing-player-browser.cjs import`
with `PLAYWRIGHT_BROWSERS_PATH` set to the installed functional-test browsers.
The SQL wrapper requires current explicit authorization and a verified Development
instance; its report now goes to `roster-review/database-results.json`.

Remaining limits: no physical-device testing, real-account login, production test
or migration. Existing supported XLS/encoding/browser limitations from the earlier
file-import report still apply. No unrelated Scrambler simulation suite was rerun.

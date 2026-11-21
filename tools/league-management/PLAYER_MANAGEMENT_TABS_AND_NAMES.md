# Separate player workflows and global name editing

Implemented on **master**, November 20, 2026 (local time). Existing uncommitted
work was preserved. No commit, push, merge or production deployment.
This supersedes the previous management reports' side-by-side roster/Add layout
and division-only Edit dialog.

## Layout

Four tabs, in order:

1. Edit / Remove Players (initial/default tab).
2. Add Players.
3. League Settings.
4. League Setup.

Each tab uses one centered content area, capped at 1600px on large monitors.
The roster table is capped at 1200px, alphabetized by player name then ID, with
Player Name / Division / Actions. One compact Edit button replaces the stacked
Edit/Remove actions. Search, division filter and Show All remain available.
Narrow screens retain labeled name, division and action rows without clipping.

The entire existing Add Players workflow moved into its own tab: prominent Browse
and Import actions, then Quick Add and standalone Create. Fields retain reasonable
maximum widths. League Settings and League Setup keep their existing functionality.
Tab switches use Angular Material without a page reload. No permanent two-column
roster/Add arrangement remains.

## Edit Player

The compact dialog has distinct Player Profile and League Membership sections:

- First and last names, with a clear notice that name changes affect the global
  player profile in every league and retain the same player ID.
- Selected league and its actual configured divisions, including No Division.
- Existing team names/divisions and the explanation that these remain separately
  managed. Editing a membership never silently moves a player between teams.
- Save Changes, Cancel and a secondary Remove from League action.

Removal closes Edit and opens the existing confirmation template. Cancel makes
no membership request. Confirm removes only the selected league membership.
The existing removal endpoint now prefers the player ID; legacy name-only calls
are rejected if ambiguous. This prevents stale or duplicate names from identifying
the wrong player after a rename. Global profiles and history are not deleted.

## Server behavior and permissions

`PUT api/ScrambleData/LeaguePlayer/{leagueId}/{playerId}` is the general edit route.
The existing `LeaguePlayerDivision` route remains as a compatible alias. Requests
retain `divisionId`/`expectedDivisionId`; optional first/last names and their expected
previous values support safe combined edits.

Both name and division validation finish before the transaction commits:

- Require an existing membership in the selected, authorized league.
- Validate division ownership, positive identifiers and existing nullable division
  behavior. A changed expected division returns 409 instead of overwriting it.
- Require nonblank names, maximum 100 characters, and reject control characters.
  Trim accidental surrounding whitespace and normalize repeated whitespace while
  preserving punctuation, apostrophes, accents and compound names.
- Reject a stale expected name or another existing player using the requested
  first/last name. Never merge identities or create a player during editing.
- Update only `Player.FirstName`, `Player.LastName` and the selected membership's
  `LeagueDivisionId`. Player/membership IDs, other profile fields, other league
  memberships, teams and score records retain their identities.
- A bad division or profile field causes no partial name/division save. Errors
  retain the administrator's dialog entries and provide understandable feedback.

### Global versus league-scoped authority

Inspection found the existing LeagueManagement policy permits Admin, Manager and
LegacyAdmin; LeagueAccess scopes Managers to assigned UserLeagues. That policy
alone is not treated as global player-edit authority.

**Global name changes require the existing Admin role.** Authorized Managers and
password-only LegacyAdmin access retain division/membership management, but name
fields are read-only with an explanation. The server independently rejects a
non-Admin name change, including manipulated requests. No new role or permission
model was introduced. Existing authentication/account roles are unchanged.

The existing policy, league ownership checks and SameOrigin protections apply to
editing/removal. Admins cannot use a selected league's edit endpoint to rename a
player who is not a member of that league.

## History, names and caching

Player relationships in scrambles, scores, attendance, team rosters and memberships
use IDs. The reviewed endpoints build display names from the referenced Player
record; PlayerInformation and similar name fields are response models. There is
no historical name rewrite or schema migration.

Fresh league/roster/score/profile retrieval sees the updated name through the same
ID. Current management/player-selection objects are refreshed in place so their
selection flags and references survive. Team roster viewers fetch again when
opened; no persistent API caching was introduced. Other already-open pages/browser
tabs refresh on their normal next retrieval; no live cross-window push was added.

Authentication User first/last names are separate account fields and are not
silently synchronized or changed by player-profile editing. Passwords, roles,
account associations and other personal account settings remain untouched.

## Browse and import preservation

The browser and parser were not redesigned. Existing immediate additions,
adaptive grid, TXT/CSV/XLSX/supported XLS, worksheet/column mapping, interactive
summary filters, attention styling, review scrolling/focus, inline profile creation,
division correction, duplicate prevention and explicit import confirmation remain.
Creating a profile during import still does not create a league membership until
the separate import confirmation.

## Verification actually performed

| Check | Result |
|---|---|
| Frontend development build | Passed; `f8f2653e5f787186bc07` |
| Frontend production build | Passed; `9e69456051817b160d7e` |
| Backend and SQL check executable builds | Passed; existing warnings remain |
| Rendered Angular regression fixture suite | 12 scenario groups, 41 layout measurements, zero page errors |
| Parser/matching suite | 35 named checks passed; TXT/CSV/XLSX/XLS included |
| Authorized local SQL persistence tests | Passed; owned cleanup verified |
| Live anonymous lookup/edit/removal requests | All returned 401 after local restart |
| `git diff --check` | Passed |

New browser checks verify four tabs and their default, no roster in Add/no Add
controls in Edit, compact single-action rows, profile first/last changes, whitespace
and punctuation, same player ID, another league's retrieval showing the new name,
required fields, removal cancel/confirm, and name-edit restrictions for Managers.
An authorized Manager changes a division, sees read-only name fields, and a forged
name-update request returns 403 in the fixture test. Existing division, import,
Browse, Quick Add, standalone Create, Settings and Setup regressions passed.

Roster/Edit/Add views were checked at 375, 430, 768, 1280, 1920, 2560 and 3440px.
The roster stayed within its 1200px cap without horizontal page overflow and never
shared a permanent row with Add. Existing Browse checks also cover 320/390px and
three columns on typical phones; its wide-screen grid still grows automatically.

### Actual database tests

The user's existing explicit development-database authorization was used. The
runtime was freshly verified as Development on Windows-authenticated
`localhost / LeagueScramblerDev`, with matching local SQL machine identity.
A new scoped process-bound test receipt was used; expired milestone approvals
were not reused or bypassed.

Run prefix: `LSImport_72f9fbc2d3f84cfcb9554dcfb7dc1039`.
Owned leagues 139/140 and synthetic players 7469–7475 were created, tested, and
removed with their owned dependent records. The test also used one team/roster
link and one historical K/Q team/player/round-score fixture.

Actual current-controller/EF/SQL checks verified:

1. First/last rename retains the player and membership IDs and unrelated profile
   fields; the new compound surname is returned in another league's player query.
2. Other league membership/division, team assignment, scramble number, historical
   player link and round score 42 remain unchanged.
3. Blank/duplicate/stale names, a foreign division, a nonmember ID and unauthorized
   global editing are rejected. A rejected combined edit does not partially save.
4. LegacyAdmin can manage memberships but cannot rename a global player.
5. ID-based removal succeeds even with stale name text and keeps the global Player.
6. Existing profile-create/import/concurrent-membership tests continue passing.
7. Exact owned cleanup completed. Before/after snapshots of player, league,
   membership, division, team and historical K/Q data matched after cleanup.

These SQL tests invoke the current controller implementation using synthetic claims.
Browser tests intercept APIs. Neither constitutes a claim of authenticating a real
administrator/player account through the complete UI-to-SQL workflow.

Only the verified local Visual Studio application was rebuilt/restarted to load
the endpoints (PID 15468 → 23716). The replacement was verified as Development
against the same local database. No unrelated process was terminated.

## Changed files and artifacts

Application paths relative to `Allport's League Scrambler/`:

- `ClientApp/src/app/scrambler/scrambler.component.{ts,html,less}`
- `ClientApp/src/app/league-management/player-management-dialogs.component.{ts,css}`
- `ClientApp/src/app/services/player.service.ts`
- `Controllers/ScrambleDataController.cs`, `Models/LeaguePlayerImportRequest.cs`

Tests: `tests/functional/scripts/player-tabs-ui.cjs`, updated existing-player-browser,
roster-review and player-import UI helpers, the guarded SQL wrapper, and
`tools/league-management/Program.cs`.

Detailed logs/results are in `tests/functional/artifacts/player-tabs/`:
`browser-results.json`, `database-results.json`, `http-authorization.json`,
development/production/backend/parser/browser logs. Parser detail remains in
`player-import/parser-results.json`.

- [Mobile roster tab](../../tests/functional/artifacts/player-tabs/edit-tab-375.png)
- [Desktop roster tab](../../tests/functional/artifacts/player-tabs/edit-tab-1920.png)
- [Ultrawide roster tab](../../tests/functional/artifacts/player-tabs/edit-tab-3440.png)
- [Mobile Edit](../../tests/functional/artifacts/player-tabs/edit-profile-375.png)
- [Desktop Edit](../../tests/functional/artifacts/player-tabs/edit-profile-1920.png)
- [Mobile Add tab](../../tests/functional/artifacts/player-tabs/add-tab-375.png)
- [Desktop Add tab](../../tests/functional/artifacts/player-tabs/add-tab-1920.png)
- [Ultrawide Add tab](../../tests/functional/artifacts/player-tabs/add-tab-3440.png)

Remaining limits: real-account login/manual acceptance and physical-device testing
were not performed. Existing supported-XLS/browser limitations remain. No production
test or deployment; no unrelated large Scrambler simulation suite rerun.

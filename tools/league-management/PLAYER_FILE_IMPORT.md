# Manage Players layout and file import

Implemented on **master**, November 20, 2026. No commit, merge, push or deployment.
Prior Scrambler V2 and Browse Existing Players working changes were preserved.

## Interface

- Current League Players keeps the league context, search, Show All, names,
  divisions, and existing removal controls. Search and Show All share one toolbar.
- A centered Add Players section places Browse Existing Players and Import
  Players From File alongside each other above Quick Add and Create New Player.
- At 1280px and above, the roster and Add Players sections share the available
  page width. Text fields retain comfortable maximum widths. Narrow screens stack
  the sections and actions. Settings and Setup retain their existing layouts.
- Browse still adds immediately, stays open, and removes a player only after
  server confirmation. Its grid remains automatic, without a desktop column cap.
- Import uses a separate large Material dialog: select/drop file, inspect the
  preview, resolve names/divisions, then explicitly confirm Add N Matched Players.
  Header, filters, Close and confirmation stay accessible while the body scrolls.

## File handling

Supported: TXT, CSV, XLSX, and binary Excel XLS. Files stay in browser memory;
the server receives only resolved player IDs and destination division IDs.

SheetJS Community Edition 0.20.3 is vendored from its official distribution,
with Apache 2.0 license and SHA-256 provenance in
`ClientApp/src/assets/vendor/sheetjs-0.20.3/README.md`. A local worker loads it
on demand. No Angular upgrade, runtime CDN dependency, or package/lockfile change.
The current Angular 7 / TypeScript 3.2 toolchain builds successfully.

TXT preserves each original full name for review. Matching trims and normalizes
whitespace, Unicode compatibility forms, case and apostrophes; it never assumes
two words. CSV uses a quoted-field state machine, including escaped quotes,
embedded commas/newlines, semicolon and tab exports. Supported text encodings:
UTF-8/BOM, UTF-16 LE/BE BOM, and Windows-1252 fallback.

Workbooks expose their worksheet names; only the selected worksheet is analyzed.
Common name/division/gender headers are recognized, including short decorative
rows before the actual heading. Ambiguous columns require explicit mapping.
Administrators can choose full or separate names, optional columns, header row
and first data row. Unmapped columns are ignored.

### Safety limits and limitations

- 2 MB input, 1000 data records, 20 columns, 32 worksheets, 1024 physical rows
  including a short header. Very large formatted ranges must be exported smaller.
- ZIP workbooks: 2000 entries, 8 MB total expansion, 4 MB per entry, 200:1 maximum
  declared compression ratio; actual decompression is checked with bounded streams.
  Reject encrypted, split, ZIP64, overlapping and malformed archives and VBA parts.
- XLS: validate OLE signatures, sector/allocation/directory and stream limits;
  reject macro streams and complex/unsupported containers. HTML/XML renamed XLS
  is intentionally rejected; save a genuine XLS/XLSX or TXT/CSV copy instead.
- Worker budget: 12 seconds. Slow/malformed files cannot indefinitely block the UI.
- Cell output bounded to 512 characters; player names to 200. Numeric/error name
  cells and mapped formula cells without usable cached results cannot become a
  valid identity. Cached formula text may be read; formulas are never evaluated.
- No macros, scripts, HTML rendering, workbook modification or external resources.
  The worker disables fetch/XHR after loading the local parser. No export feature
  was added, so uploaded strings are never exported as spreadsheet formulas.
- Compressed XLSX needs browser `DecompressionStream('deflate-raw')`. Unsupported
  browsers receive a useful TXT/CSV/current-browser alternative. Real devices and
  every legacy Excel variation were not tested.
- Column headings can be corrected manually; arbitrary decorative rows within the
  data are flagged for review rather than silently treated as confirmed people.

## Matching and divisions

The import context reuses AvailableLeaguePlayers with `includeMembers=true`:
minimal existing player fields, selected-league member IDs and configured divisions.
No private contact/account data is exposed by the context.

Unique exact normalized names resolve to existing IDs. Fuzzy, abbreviation,
reversed-name and middle-initial candidates require explicit confirmation.
Duplicate existing names require choosing the correct ID; uploaded duplicates and
repeated chosen IDs are visibly excluded. The summary and table distinguish exact
matches, ready entries, review, already enrolled, missing, duplicates and invalid.
Search/status filtering happens locally. Uploaded gender never changes a profile.

Default division is captured from the existing selection. File values match actual
league division names/codes; unknown/ambiguous values require correction. No new
division is created. No Division follows the existing nullable assignment rule.
Each preview row permits an override; existing memberships/divisions are untouched.

Missing players are not created automatically. Create New Player opens the normal
validated form; a full-name-only source remains unsplit in First Name so the admin
must confirm the correct first/last fields and gender. The draft remains in memory;
Return to Import reloads the player context and reconciles newly created members.
Closing the dialog does not undo successful memberships. Reloading the page loses
the in-memory draft; no uploaded roster is stored persistently.

## Persistence and authorization

New endpoint: `POST api/ScrambleData/ImportLeaguePlayers/{leagueId}` with
`{ players: [{ playerId, divisionId }] }`.

- Existing LeagueManagement policy, SameOrigin and LeagueAccess checks.
- Validate league, 1..1000 unique existing IDs, division ownership and a 128 KB body.
- Serializable transaction, one SaveChanges, commit before returning `atomic:true`.
  A validation error or transaction failure does not partially insert the batch.
- Shared create-only membership helper with the immediate browser workflow.
  Pre-existing memberships return Already Member and retain their actual division.
- Pending confirmation cannot be submitted twice; Close/Escape are blocked while
  it is processing. A failed/lost response reloads current memberships without
  automatically retrying. Confirmed members leave the ready set; unconfirmed rows
  remain available for review and explicit retry. SQL contention may roll back a
  request safely; no automatic non-idempotent retry was introduced.
- Current League Players updates once per confirmed batch, scoped to its original
  league. No player profile, credentials, permissions or unrelated memberships change.

## Verification performed

| Check | Result |
|---|---|
| Real worker parser/matching suite | **35 named checks passed** |
| Rendered Angular browser fixture suite | **9 scenario groups passed**, zero page errors |
| Import and Manage Players widths | 375, 430, 768, 1280, 1920, 2560, 3440; no horizontal overflow |
| Browse regression widths | 320, 375, 390, 430, 768, 1280, 1920, 2560, 3440 |
| Browse columns at those widths | 2, 3, 3, 3, 5, 8, 12, 17, 23 with 600 fixture profiles |
| Development frontend build | Passed; hash `759c2c924f6cfba7de5d` |
| Production frontend build | Passed; hash `acb7ef0da8d8095dd44b` |
| Backend build and SQL test executable build | Passed |
| Real Development database integration | **Passed after renewed user authorization** |
| Live anonymous GET context / POST bulk endpoint | Both **401**, no database writes |
| Whitespace validation | `git diff --check` passed |

Browser fixtures cover explicit confirmation, fuzzy/name-ID resolution, duplicate
names/rows, already enrolled and missing entries, unknown division correction,
search, retained drafts, workbook sheet switching, creation via the existing form,
transaction failure/retry, lost-response reconciliation, duplicate submit guards,
pending Close/Escape, roster refresh and division preservation after a concurrent
addition. Existing Browse, Quick Add, Create, Settings and Setup were exercised.
Role fixtures cover Admin, authorized/unassigned Manager, Player and anonymous.
Fixture API responses are intercepted and do not constitute real login tests.

### Actual database verification

Renewed authorization: **“you have approval for database development”**.
Verified effective runtime: Development, SQL `localhost / LeagueScramblerDev`,
Windows authentication; SQL machine name also matched this computer. A fresh
test-specific, one-hour process-bound receipt was used. Expired milestone approval
files were not renewed, reused or bypassed.

The executable invokes the current compiled controller implementation with synthetic
claims and real EF/SQL operations. It does not impersonate or modify an existing
account, and does not claim authentication through a real browser login.

Run prefix: `LSImport_06cb0865d47c4f2a9ab17ac86f7dfaed`.
Created and removed leagues **135, 136**, synthetic players **7456–7461**,
three divisions and seven membership rows. Tested:

1. Player/unassigned Manager denied; invalid league/IDs/duplicate IDs/negative or
   foreign divisions/empty requests rejected. Mixed-invalid batch inserted nothing.
2. Real batch created two memberships, correctly assigned Silver and No Division,
   preserved an existing Gold membership and preserved the other league.
3. Repeating confirmation created no duplicates. Available-player and member-context
   queries reflected saved memberships.
4. Two simultaneous reversed batches both committed with exactly one membership
   per player. Browser single-add followed by bulk import retained its division.
5. Cleanup deleted only exact run-owned records. Complete player, league, division
   and membership snapshots before seeding and after cleanup were identical.

The local Visual Studio Development app was rebuilt/restarted so the new routes
are available. Only the verified solution's previous PID 22320 was stopped.
Replacement PID 31220 was verified as Development on the same local SQL target;
both new anonymous requests returned 401. No other processes were terminated.

### Remaining limits

No real-account login or production testing. SQL tests exercised controller-level
authorization plus actual persistence; live HTTP checked anonymous denial, not a
complete authenticated upload-to-database browser round trip. These are separate
from the fully intercepted UI scenarios. No further automated writes remain needed
for this implementation. Existing framework/package and Browserslist warnings
remain; no unrelated dependency updates were made.

## Files

Application paths below are relative to `Allport's League Scrambler/`:

- `ClientApp/src/app/league-management/player-import.component.{ts,html,css}`
- `ClientApp/src/app/league-management/player-import.ts`
- `ClientApp/src/assets/import/roster-worker.js`
- `ClientApp/src/assets/vendor/sheetjs-0.20.3/{xlsx.full.min.js,LICENSE,README.md}`
- `ClientApp/src/app/scrambler/scrambler.component.{ts,html,less}`
- `ClientApp/src/app/services/player.service.ts`
- `ClientApp/src/app/app.module.ts`, `ClientApp/src/styles.scss`
- `Controllers/ScrambleDataController.cs`, `Models/LeaguePlayerImportRequest.cs`

Verification:

- `tests/functional/scripts/player-import-parser.cjs`
- `tests/functional/scripts/existing-player-browser.cjs` (optional `import` mode)
- `tests/functional/scripts/player-import-ui.cjs`
- `tests/functional/scripts/check-player-import-database.ps1`
- `tools/league-management/{PlayerImportCheck.csproj,Program.cs}`

## Evidence and repeatable checks

Artifacts under `tests/functional/artifacts/player-import/`:
`parser-results.json`, `results.json`, `database-results.json`,
`http-authorization.json`, parser fixtures, development/production builds.
Build logs are alongside this folder as `player-import-*-build.log`;
browser output is `player-import-browser.log`.

Screenshots:

- [Mobile import](../../tests/functional/artifacts/player-import/import-375.png)
- [Desktop import](../../tests/functional/artifacts/player-import/import-1920.png)
- [Ultrawide import](../../tests/functional/artifacts/player-import/import-3440.png)
- [Mobile management](../../tests/functional/artifacts/player-import/management-375.png)
- [Desktop management](../../tests/functional/artifacts/player-import/management-1920.png)
- [Ultrawide management](../../tests/functional/artifacts/player-import/management-3440.png)

From the repository root, after the frontend development build:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path 'tests/functional/.tools/browsers').Path
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-import-parser.cjs
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/existing-player-browser.cjs import
```

Only with renewed development-write authorization, and the verified Visual Studio
Development instance running, the SQL check can be repeated:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/functional/scripts/check-player-import-database.ps1 -ApprovedDevelopmentDatabase
```

The wrapper rebuilds the current backend into an isolated artifact folder,
verifies the runtime and SQL target, creates its narrow receipt, then runs the
owned-fixture tests and cleanup. It never logs connection strings or passwords.

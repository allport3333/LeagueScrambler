# Pickup Games ? Phase 1

## Shared Development

Use the original worktree on `https://localhost:5001` and the `feature/pickup-sessions` worktree `LeagueScrambler-pickup` on `https://localhost:5002/pickup`. Both use the existing local SQL Server database `LeagueScramblerDev`.

In the Pickup worktree, open `Allport's League Scrambler.sln` and select **Pickup Development**. From the web project directory, build that worktree's Angular assets before launching or after frontend edits.

```powershell
npm.cmd --prefix ClientApp ci
npm.cmd --prefix ClientApp run build -- --configuration=production
dotnet run --launch-profile "Pickup Development"
```

Pickup uses Windows integrated authentication for local SQL Server. Its authentication cookie and Data Protection keys remain separate from port 5001, so sign into port 5002 using the same Development account. Pickup mail is written to `%LOCALAPPDATA%\LeagueHub\PickupSharedDev\mail`. The profile bypasses dotenv probing and does not use the original SMTP configuration. Trust the local ASP.NET development certificate if needed.

## Architecture

- Existing `LeagueType.EventTypeId` values include Pickup, but joining traditional league flows would add permanent `PlayersLeague` membership. Pickup does not use those flows or allocate `LeagueType` rows. It uses its own session UUID.
- `PickupVenue` stores a reusable facility address, IANA time zone and optional coordinates. Discovery filters stored city and postal code, sport, local date, skill and availability. Discovery uses an offline US ZIP-to-locality index and uses stored venue coordinates first, then ZIP and unambiguous city/state reference points for radius matches. Locality distances are estimates.
- `PickupSession` references its organizer's existing `User` and a venue. States are Draft, Published, In Progress, Completed and Cancelled. This phase creates Published sessions and supports cancellation. It stores UTC instants plus the venue-local calendar date. Invalid or ambiguous local times are rejected.
- `PickupRegistration` references a session, and optionally an existing `User` and `Player` through the existing `UsersPlayer` association. A guest is a session-scoped registration with a contact fingerprint, never a new global player. An independently verified account-linking flow can later attach a verified guest row without replacing its registration ID.
- Unique session/account and session/contact indexes prevent duplicate entries. SQL Server transaction-scoped application locks serialize joins, verification, approval, edits and cancellations for a session. Open registration uses a nullable capacity. For a capped session, only Confirmed rows consume capacity, and a waitlisted registration moves up when a spot opens. A verification link does not reserve a place. Declined, Cancelled and other historical rows are retained.
- Pickup discovery and accessible detail routes are anonymous. Public sessions are listed, Unlisted sessions are accessible by UUID, and Private sessions are owner-only in this phase. Private participant invitations and access grants are deferred. Only the organizer can change session details or see the registration list. Existing login cookies and user claims supply the account identity. All writes require the existing same-origin check.
- Guest registration uses name and email. A 20-minute single-use link uses a random token stored only as a hash. The token is delivered in the URL fragment so the opening GET never receives it. A POST verifies the link, then an expiring HttpOnly cookie scoped to that session's API grants access to view or cancel that registration. It cannot authenticate a user to League Hub. The guest endpoints have an IP limit and link issuance also has a per-contact cooldown. Existing account matching never assigns guest ownership to an account.
- The shared `TransactionalMail` service handles local mail. Password recovery and email change remain separate. The Angular route uses existing themes and global navigation. PWA API requests remain network-only.

## Playing a session

The selector lists the signed-in organizer's or participant's active and upcoming sessions. The Pickup URL holds the active Pickup context and the existing league selection is retained. Discover and My Sessions provide other entry points.

The Players workspace keeps attendance on registrations. Confirmed participants are playing by default, or organizers may switch to checked-in only. Add Players browses existing player records or adds a session-only walk-in. The regular Scrambler engine runs on the selected playing roster, with a limit of 80 per draw. Prior saved Pickup teams supply only session-local teammate history. Watch the Scramble and landscape team printing use the existing shared presentation and renderer.

Each saved Game Set has a stable ID and ordinal, a version, a timestamp, and a snapshot of team members, byes, generation options and matchup game count. With scores stored independently on the set, unplayed games have no entry. Team edits are locked once a score exists. Confirmed participants can view their assignments and saved results. A session can be completed without teams or scores. Pickup writes never use the league standings or tournament score stores.

## API

`GET /api/pickup/catalog` provides the sport catalog and enables Pickup navigation. Authenticated `GET /venues` searches reusable facilities. `GET /sessions` is paginated discovery, `GET /sessions/{id}` is detail, and authenticated `GET /mine` lists the current account's organized or joined sessions. The prefix on each is `/api/pickup`.

`GET /selector` returns upcoming or active account sessions. `GET /sessions/{id}/workspace` returns permission-scoped roster and game sets. Organizer writes under the session include `players`, `attendance`, `lifecycle`, `sets` and versioned set `scores` and `teams` edits.

`POST /sessions` creates a session, `PUT /sessions/{id}` updates it, and `POST /sessions/{id}/cancel` cancels it. Session-scoped POST actions are `join`, `guest`, `verify`, `leave`, and `registrations/{registrationId}` for an organizer decision. Public payloads include counts and the organizer's display name; the organizer's private notes and participant names are owner-only.

## Migration and recovery

Back up `LeagueScramblerDev` before schema changes. Use a full `COPY_ONLY` backup with `CHECKSUM` outside the repository and confirm it with `RESTORE VERIFYONLY ... WITH CHECKSUM`. Preserve the backup. If investigation or recovery is needed, restore it under a new database name first. Replacing shared Development requires separate authorization.

From the Pickup worktree root, apply the additive migration only after the backup verifies:

```powershell
sqlcmd -S lpc:localhost -d LeagueScramblerDev -E -C -b -i tools/pickup/001-PickupFoundation.sql
sqlcmd -S lpc:localhost -d LeagueScramblerDev -E -C -b -i tools/pickup/002-PickupUnlimitedCapacity.sql
sqlcmd -S lpc:localhost -d LeagueScramblerDev -E -C -b -i tools/pickup/003-PickupWorkspace.sql
```

Require exit code 0 and the corresponding verification receipt for each migration. The second migration permits NULL in PickupSession.Capacity and preserves existing numeric limits. The third adds Pickup-only attendance columns and a separate PickupGameSet table. For an older disposable database, apply the second and third migrations to LeagueScramblerPickupTest before running the test harness. Existing SQL add-ons use schema-object checks to record and detect application. This script verifies the three tables and key constraints on rerun and leaves the existing EF migration history untouched. Filtered indexes require the explicit SQL session settings included in the script.

Keep future changes backward compatible while both apps share the database. Avoid resetting shared Development. A genuinely breaking change must use a temporary restored copy until the schemas can be reconciled. The old `LeagueScramblerPickupDev` remains an unused fallback, and its synthetic fixtures should stay separate.

## Focused verification

Shared Development checks should read existing league, tournament, and player data and clean up any narrowly scoped Pickup write fixtures. Use the disposable port 5003 harness for guest and concurrency tests. It initializes only `LeagueScramblerPickupTest`, starts its own host, and stops that process when the test passes, fails, or is interrupted. It refuses to run if port 5003 already has a listener. Leave the Visual Studio development profiles running independently.

Build the Pickup web project in Release and build its Angular frontend, then run from the worktree root:

```powershell
npm.cmd --prefix tests/functional ci
node tests/functional/scripts/pickup.cjs
node tests/functional/scripts/pickup-workspace.cjs
```

## Roadmap

- [x] Phase 1 · Discovery, venue entry, session creation and management, one-click account join, guest verification, capacity and approval.
- [ ] Phase 2 · Waitlist offers, private invites, verified account linking, and registration management enhancements.
- [x] Phase 3: Lightweight attendance, confirmed playing roster and walk-in guests. QR check-in remains a follow-up.
- [x] Phase 4: Existing Scrambler and Watch the Scramble, with session-local history.
- [x] Phase 5: Saved game sets, optional score entry, team edits, and session history.
- [ ] Phase 6 · Notifications, moderation, retention, external mail verification and release security review.

## Postal-locality data

The embedded us-postal-localities.tsv.gz derives from the [GeoNames US postal code download](https://download.geonames.org/export/zip/US.zip), retrieved November 25, 2026. GeoNames distributes the data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The file retains source columns 2, 3, 4, 5, 10, and 11, in that order. Postal points supply search origins and approximate venue points when facility coordinates are absent. City and state can supply an approximate point when ZIP data is unavailable. No external lookup runs during search. The catalog describes postal localities and does not supply venue addresses or municipal boundaries.

## Production

Production Pickup runs on the existing League Hub site and database. The local Pickup profile retains its separate port, cookies, and file-based mail. Production uses the existing canonical HTTPS origin and authenticated SMTP settings for verification links.

After verifying a fresh checksum-protected production backup and rehearsing the schema change, run `tools/pickup/Apply-ProductionPickup.sql` from the repository root using `sqlcmd -b` for the approved production instance. The driver checks the server and database, applies all three Pickup migrations in a single transaction, and verifies the foreign keys and registration constraints. The application can be rolled back while leaving the additive schema in place.

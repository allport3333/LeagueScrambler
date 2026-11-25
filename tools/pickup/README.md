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
- `PickupVenue` stores a reusable facility address, IANA time zone and optional coordinates. Discovery filters stored city and postal code, sport, local date, skill and availability. There is no geocoding or radius estimate in Phase 1.
- `PickupSession` references its organizer's existing `User` and a venue. States are Draft, Published, In Progress, Completed and Cancelled. This phase creates Published sessions and supports cancellation. It stores UTC instants plus the venue-local calendar date. Invalid or ambiguous local times are rejected.
- `PickupRegistration` references a session, and optionally an existing `User` and `Player` through the existing `UsersPlayer` association. A guest is a session-scoped registration with a contact fingerprint, never a new global player. An independently verified account-linking flow can later attach a verified guest row without replacing its registration ID.
- Unique session/account and session/contact indexes prevent duplicate entries. SQL Server transaction-scoped application locks serialize joins, verification, approval, edits and cancellations for a session. Open registration uses a nullable capacity. For a capped session, only Confirmed rows consume capacity, and a waitlisted registration moves up when a spot opens. A verification link does not reserve a place. Declined, Cancelled and other historical rows are retained.
- Pickup discovery and accessible detail routes are anonymous. Public sessions are listed, Unlisted sessions are accessible by UUID, and Private sessions are owner-only in this phase. Private participant invitations and access grants are deferred. Only the organizer can change session details or see the registration list. Existing login cookies and user claims supply the account identity. All writes require the existing same-origin check.
- Guest registration uses name and email. A 20-minute single-use link uses a random token stored only as a hash. The token is delivered in the URL fragment so the opening GET never receives it. A POST verifies the link, then an expiring HttpOnly cookie scoped to that session's API grants access to view or cancel that registration. It cannot authenticate a user to League Hub. The guest endpoints have an IP limit and link issuance also has a per-contact cooldown. Existing account matching never assigns guest ownership to an account.
- The shared `TransactionalMail` service handles local mail. Password recovery and email change remain separate. The Angular route uses existing themes and global navigation. PWA API requests remain network-only.

## API

`GET /api/pickup/catalog` provides the sport catalog and enables Pickup navigation. Authenticated `GET /venues` searches reusable facilities. `GET /sessions` is paginated discovery, `GET /sessions/{id}` is detail, and authenticated `GET /mine` lists the current account's organized or joined sessions. The prefix on each is `/api/pickup`.

`POST /sessions` creates a session, `PUT /sessions/{id}` updates it, and `POST /sessions/{id}/cancel` cancels it. Session-scoped POST actions are `join`, `guest`, `verify`, `leave`, and `registrations/{registrationId}` for an organizer decision. Public payloads include counts and the organizer's display name; the organizer's private notes and participant names are owner-only.

## Migration and recovery

Back up `LeagueScramblerDev` before schema changes. Use a full `COPY_ONLY` backup with `CHECKSUM` outside the repository and confirm it with `RESTORE VERIFYONLY ... WITH CHECKSUM`. Preserve the backup. If investigation or recovery is needed, restore it under a new database name first. Replacing shared Development requires separate authorization.

From the Pickup worktree root, apply the additive migration only after the backup verifies:

```powershell
sqlcmd -S lpc:localhost -d LeagueScramblerDev -E -C -b -i tools/pickup/001-PickupFoundation.sql
sqlcmd -S lpc:localhost -d LeagueScramblerDev -E -C -b -i tools/pickup/002-PickupUnlimitedCapacity.sql
```

Require exit code 0 and the corresponding verification receipt for each migration. The second migration permits NULL in PickupSession.Capacity and preserves existing numeric limits. For an older disposable database, apply that same migration to LeagueScramblerPickupTest before running the test harness. Existing SQL add-ons use schema-object checks to record and detect application. This script verifies the three tables and key constraints on rerun and leaves the existing EF migration history untouched. Filtered indexes require the explicit SQL session settings included in the script.

Keep future changes backward compatible while both apps share the database. Avoid resetting shared Development. A genuinely breaking change must use a temporary restored copy until the schemas can be reconciled. The old `LeagueScramblerPickupDev` remains an unused fallback, and its synthetic fixtures should stay separate.

## Focused verification

Shared Development checks should read existing league, tournament, and player data and clean up any narrowly scoped Pickup write fixtures. Use the disposable port 5003 harness for guest and concurrency tests. It initializes only `LeagueScramblerPickupTest`, starts its own host, and stops that process when the test passes, fails, or is interrupted. It refuses to run if port 5003 already has a listener. Leave the Visual Studio development profiles running independently.

Build the Pickup web project in Release and build its Angular frontend, then run from the worktree root:

```powershell
npm.cmd --prefix tests/functional ci
node tests/functional/scripts/pickup.cjs
```

## Roadmap

- [x] Phase 1 · Discovery, venue entry, session creation and management, one-click account join, guest verification, capacity and approval.
- [ ] Phase 2 · Waitlist offers, private invites, verified account linking, and registration management enhancements.
- [ ] Phase 3 · Session-scoped check-in and QR codes. Existing `PlayerSignIn` assumes a league ID so it is not used for Pickup.
- [ ] Phase 4 · Adapt the checked-in roster to the existing Scrambler and Watch the Scramble input types. Guest registrations need session-scoped roster IDs until linked to global players.
- [ ] Phase 5 · Session-local games, score entry and history. Existing fixed-team and K/Q score storage is tied to league IDs and is not written by Pickup.
- [ ] Phase 6 · Notifications, moderation, retention, external mail verification and release security review.

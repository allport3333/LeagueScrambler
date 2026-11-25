# Pickup Games · Phase 1

## Isolated development

Open `Allport's League Scrambler.sln` in the Pickup worktree and choose **Pickup Development**. The Kestrel profile runs at `https://localhost:5002/pickup`. It uses the checked-out worktree's own Angular output. Rebuild Angular after UI edits.

From the web project directory, the initial setup is:

```powershell
npm.cmd --prefix ClientApp ci
npm.cmd --prefix ClientApp run build -- --configuration=production
dotnet run --launch-profile "Pickup Development" -- --initialize-pickup
dotnet run --launch-profile "Pickup Development"
```

The profile requires Development and forces the local SQL Server database `LeagueScramblerPickupDev` with Windows integrated authentication. It bypasses the existing dotenv search and uses a dedicated authentication cookie and key directory. Email is written as `.eml` files under `%LOCALAPPDATA%\LeagueHub\LeagueScramblerPickupDev\mail`, including verification links. Test with `example.invalid` addresses. The browser needs a trusted ASP.NET development certificate. Port 5001, the original checkout, and the original databases are separate.

## Architecture

- Existing `LeagueType.EventTypeId` values include Pickup, but joining traditional league flows would add permanent `PlayersLeague` membership. Pickup does not use those flows or allocate `LeagueType` rows. It uses its own session UUID.
- `PickupVenue` stores a reusable facility address, IANA time zone and optional coordinates. Discovery filters stored city and postal code, sport, local date, skill and availability. There is no geocoding or radius estimate in Phase 1.
- `PickupSession` references its organizer's existing `User` and a venue. States are Draft, Published, In Progress, Completed and Cancelled. This phase creates Published sessions and supports cancellation. It stores UTC instants plus the venue-local calendar date. Invalid or ambiguous local times are rejected.
- `PickupRegistration` references a session, and optionally an existing `User` and `Player` through the existing `UsersPlayer` association. A guest is a session-scoped registration with a contact fingerprint, never a new global player. An independently verified account-linking flow can later attach a verified guest row without replacing its registration ID.
- Unique session/account and session/contact indexes prevent duplicate entries. SQL Server transaction-scoped application locks serialize joins, verification, approval, edits and cancellations for a session. Only Confirmed rows consume capacity. A verification link does not reserve a place. Declined, Cancelled and other historical rows are retained.
- Pickup discovery and accessible detail routes are anonymous. Public sessions are listed, Unlisted sessions are accessible by UUID, and Private sessions are owner-only in this phase. Private participant invitations and access grants are deferred. Only the organizer can change session details or see the registration list. Existing login cookies and user claims supply the account identity. All writes require the existing same-origin check.
- Guest registration uses name and email. A 20-minute single-use link uses a random token stored only as a hash. The token is delivered in the URL fragment so the opening GET never receives it. A POST verifies the link, then an expiring HttpOnly cookie scoped to that session's API grants access to view or cancel that registration. It cannot authenticate a user to League Hub. The guest endpoints have an IP limit and link issuance also has a per-contact cooldown. Existing account matching never assigns guest ownership to an account.
- The shared `TransactionalMail` service handles local mail. Password recovery and email change remain separate. The Angular route uses existing themes and global navigation. PWA API requests remain network-only.

## API

`GET /api/pickup/catalog` provides the sport catalog and enables Pickup navigation. `GET /sessions` is paginated discovery, `GET /sessions/{id}` is detail, and authenticated `GET /mine` lists the current account's organized or joined sessions. The prefix on each is `/api/pickup`.

`POST /sessions` creates a session, `PUT /sessions/{id}` updates it, and `POST /sessions/{id}/cancel` cancels it. Session-scoped POST actions are `join`, `guest`, `verify`, `leave`, and `registrations/{registrationId}` for an organizer decision. Public payloads include counts and the organizer's display name; the organizer's private notes and participant names are owner-only.

## Migration and rollback

Fresh local setup uses the current EF model to initialize a clean database and seeds only roles and event types. The additive, target-guarded [SQL migration](001-PickupFoundation.sql) upgrades a baseline-only Pickup development database. It does not upgrade production. Disable the Pickup profile to take the feature offline while retaining its data. For local schema rollback, back up the dedicated database and remove Pickup registrations, sessions and venues in that dependency order. Existing account, league and tournament tables do not depend on those three tables. A production rollout will require separate migration and retention review.

## Focused verification

With the Pickup profile running, from the worktree root run:

```powershell
npm.cmd --prefix tests/functional ci
node tests/functional/scripts/pickup.cjs
```

The browser check uses synthetic accounts and local `.eml` files, exercises the real API and SQL transactions, and cancels its fixture sessions after successful verification. No external mail or database is involved.

## Roadmap

- [x] Phase 1 · Discovery, venue entry, session creation and management, one-click account join, guest verification, capacity and approval.
- [ ] Phase 2 · Waitlist/offers, private invites, verified account linking, and registration management enhancements.
- [ ] Phase 3 · Session-scoped check-in and QR codes. Existing `PlayerSignIn` assumes a league ID so it is not used for Pickup.
- [ ] Phase 4 · Adapt the checked-in roster to the existing Scrambler and Watch the Scramble input types. Guest registrations need session-scoped roster IDs until linked to global players.
- [ ] Phase 5 · Session-local games, score entry and history. Existing fixed-team and K/Q score storage is tied to league IDs and is not written by Pickup.
- [ ] Phase 6 · Notifications, moderation, retention, external mail verification and release security review.

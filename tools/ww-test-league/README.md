# WW Test League development seeder

Successfully created and independently verified November 19, 2026 in localhost / LeagueScramblerDev, using Windows authentication. **WW Test League: LeagueId 133.** Production was not modified.

## Accounts

| Account | UserId | Player | Team | Preserved role |
|---|---:|---|---|---|
| allport3333@gmail.com | 1 | 1, Chris Allport | Average Joe's, Silver | Admin |
| allport3333+test@gmail.com | 97 | 7414, WW Test Participant | Fort Fraser, Gold | Player |

Only User97's existing player link was changed, as explicitly authorized. Neither account was recreated. Passwords, roles and User1's link were unchanged.

Preflight found no direct User97 league links or historical account-ownership fields. Player1's existing 8 league memberships, 44 attendance records, 3 team memberships and 89 K/Q memberships could not be attributed to either formerly linked login. All remain with Player1. No historical records were migrated. A protected-data hash comparison inside the transaction confirmed unrelated data remained unchanged.

## Created data

64 participants (63 reused and one new), 16 teams (8 Gold/8 Silver), 2 divisions, 12 weeks, 96 scheduled matchups, 6 completed weeks, 288 team score rows, 6 K/Q sessions, 96 K/Q teams, 384 K/Q memberships, 480 round rows, 384 derived legacy score rows and 392 attendance records.

Week7 is November19, with five further future weeks. Reference scoring settings were copied: 50% substitute score, two allowed subs, two dropped scores, matchup standings. Designated substitutes exercise existing adjustments. Only the test league uses Thursday as its league day. Both accounts were attendance-eligible November19 under real membership/day/lock rules and were not pre-signed-in today. Availability follows the real date.

## Commands

Run from the repository root while the verified Development app is running:

```powershell
.\tools\ww-test-league\Seed.ps1 -Mode inspect
.\tools\ww-test-league\Seed.ps1 -Mode selftest
.\tools\ww-test-league\Seed.ps1 -Mode create -Authorize
.\tools\ww-test-league\Seed.ps1 -Mode verify
.\tools\ww-test-league\Seed.ps1 -Mode reset -Authorize
.\tools\ww-test-league\Seed.ps1 -Mode remove -Authorize
```

Create was rerun successfully and is idempotent. Reset retains the league ID and replaces its owned graph. Remove deletes only owned dependencies in FK order. Both retain global players/accounts and the authorized User97 link. Reset/remove execution remains unverified; they reject unexpected cross-league references. Neither is needed to preview this populated league.

Optional -ReferenceDate yyyy-MM-dd controls schedule dates; otherwise America/New_York's current date is used. The one-time create -Authorize -PrepareTestPlayer operation has already completed.

The utility reuses existing EF Core2.2 models/provider, requires strict local Dev targeting, effective runtime verification and process-bound seed-specific authority, and uses an exclusive seed lock and transaction. No schemas, passwords, roles or authentication behavior were changed.

## Verification and limitations

Backend/seeder Release build and Angular development build passed. Nineteen deterministic seed tests, committed graph validation, independent verify and idempotent create passed. Private reports: tests/functional/.local/ww-test-league. Frontend build log: tests/functional/artifacts/ww-test-league-frontend-build.log.

Real login through both accounts remains pending user verification. Authenticated attendance mutations and personalized browser screenshots are not claimed. Eligibility checks do not prove successful HTTP authentication.

Historical score records have no explicit paired-game ID; existing team-grouped presentation remains appropriate. Schedule and saved K/Q models do not persist start-time/location/court fields; none were fabricated. No frontend placeholders were introduced. Reset/removal preserves the dedicated global test player and account link. No publishing, deployment, commits, pushes or merges.

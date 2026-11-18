# Scheduled Team Scores feature checkpoint — 2026-11-17

Implementation and builds are complete. Database-backed functional verification is **blocked**, not passed. Do not deploy on the strength of the browser-only preview.

## Behavior

- The selected league and today's local calendar date drive the editor. Another past/future date can be selected. Schedule records are filtered by calendar date in the client, preserving the existing all-weeks schedule API for other callers.
- `GetLeagueSchedule` now adds `scheduleId`, `team1Id`, and `team2Id` without removing existing fields.
- Every scheduled matchup gets its own compact card, fixed team names, available division/description, paired score fields, and independent save. Default three games; 1–10 games supported per card. The toolbar default applies to newly added cards.
- No schedule produces a clear message and a blank manual card. Add Manual Matchup remains available when schedules exist. Both dropdowns use teams returned for the selected league; the server independently validates both IDs against that league.
- All selected game scores are required, whole numbers, and nonnegative. Zero is accepted. Self-play, missing values and invalid schedules are rejected.
- `RecordMatchupScores` saves both directions of every game and recalculates both teams' standings in one transaction. It derives wins from scores; existing tie semantics are preserved (both directions have WonGame=false and count as losses).
- SameOrigin and the existing LeagueManagement/LeagueAccess policy protect the new write. GetMatchupScores also requires league management permission. No password, cookie, role or logout implementation changes.
- A transaction-owned SQL application lock serializes this new endpoint's saves within a league. Existing results in either direction, including partial historical results, return 409 before any insertion. A lost confirmation must be resolved by reloading, not blindly retrying.
- A successful save refreshes saved status without discarding other matchup drafts. Changing dates/reloading asks before discarding entered unsaved scores.

## Historical matching and correction limits

Read-only metadata inspection of **LeagueScramblerDev only** confirmed that LeagueTeamScore contains ID, team ID, opponent ID, score, win flag and date. It has no schedule ID, match-series identifier or game number. No schema changes or migration were made.

The reliable existing association is **selected league + calendar date + unordered pair of stable team IDs**. Any row for that key blocks another series. Multiple series between the same pair on one day cannot be distinguished safely with this schema. Repeated schedule entries for the same pair/day share that limitation.

Individual historical game pairing is **not** inferred from insertion order. The old screen wrote all of one team's records followed by the other's, possibly stopping mid-submit. New saves write pairs atomically, but no persisted marker distinguishes new and historical batches. The saved inspector therefore lists actual record IDs, teams, scores and win/loss flags individually. It does not invent game numbers.

No correction/delete action is implemented. Administrators can inspect saved records; corrections require a separately reviewed, explicitly authorized operation. No existing score is automatically replaced, repaired or deleted. Supporting multiple same-day series or reliable historical game editing needs a separate data-model decision.

The legacy single-row `RecordLeagueTeamScore` API remains unchanged for compatibility with existing consumers and regressions. It does not gain the new batch contract; the new screen does not call it. The transaction/application-lock guarantee applies to the new endpoint, not arbitrary legacy writers or direct SQL clients. A future retirement of that API requires separate compatibility work.

## Verification actually completed

| Check | Result |
|---|---|
| Backend Debug build, --no-restore | Passed, 0 errors, 10 existing warnings |
| Angular development build using installed Node 10/packages | Passed |
| Angular production/AOT build using installed packages | Passed |
| Existing process-binding/expiry guard test | Passed |
| Existing standings math tests | 3 passed |
| Browser-only Team Scores UI verification | Passed; synthetic display fixtures; all API requests intercepted and all writes blocked |
| New database/API/browser focused tests | 4 blocked before setup by expired testing authorization |
| Existing database-backed scoring regression | Not executed pending fresh authorization |
| Full regression suite | Not rerun; historical baseline remains 36 passed / 0 failed / 2 accepted blocked |

Angular warns that Browserslist/caniuse-lite data is outdated. Backend warnings include existing unsupported framework/package advisory warnings and existing MVC analyzer warnings. No dependency updates were attempted.

Read-only verification independently confirmed the rebuilt **Visual Studio Debug PID 29448**, start **2026-11-17T20:11:15.3832500Z**, with effective localhost / LeagueScramblerDev / Windows Authentication. This is configuration/process evidence, not a mutation authorization. Automated SQL session correlation **did not pass** and is not claimed. The prior mutation grant expired at 18:37:37 UTC and was neither renewed nor bypassed. A fresh two-hour process-bound grant was requested once and is pending.

No accounts, teams, schedules or scores have been created by this feature's tests yet. No destructive cleanup was performed. Read-only metadata inspection accessed no production database.

## Focused tests implemented

`specs/team-scores.spec.cjs` contains four tests:

1. Schedule stable IDs, atomic three-game scores, ties/wins/losses, calendar-date scoping, duplicate/reversed-pair rejection and another date.
2. Incomplete/negative/empty scores, self-play, cross-league teams, stale schedule ID, foreign/missing Origin, unassigned Manager, Player, anonymous access, and existing partial historical records; exact synthetic SQL snapshots on rejection.
3. Real-browser synthetic Manager login, two scheduled matchups, fixed teams/division/default three games, independent save preserving another draft, saved record inspection, manual addition and mobile screenshot.
4. Real-browser no-schedule fallback, alternate date, manual team selection, configurable one-game save and duplicate saved state.

The schedule seed helper accepts only the run-owned LSAuto league and team IDs, verifies a matching synthetic owner, fixed development database identity and the current PID/start/configuration/expiry proof, and inserts within a transaction. Snapshots/manifests include schedules. Automatic cleanup remains disabled.

## Screenshots and provenance

These are real Chromium renders of the updated Angular application with **browser-only synthetic display fixtures**, not authenticated SQL-backed test successes. Negative placeholder IDs cannot refer to real teams. The preview uses no SQL helper, intercepts every API GET, blocks all non-GETs and external URLs, and verifies zero attempted writes/page errors.

- [Scheduled desktop](team-scores-evidence/scheduled-desktop-preview.png)
- [Scheduled mobile](team-scores-evidence/scheduled-mobile-preview.png)
- [Manual desktop](team-scores-evidence/manual-desktop-preview.png)
- [Manual mobile](team-scores-evidence/manual-mobile-preview.png)
- [Preview assertion results](team-scores-evidence/preview-verification.json)
- [Focused blocked results](artifacts/runs/team-scores-focused/summary.md)
- [Existing nonmutating results](artifacts/runs/team-scores-readonly/summary.md)

## Resume without bypassing safeguards

1. Obtain the pending fresh grant for the independently verified process. If it restarted, independently inspect the new identity/configuration and obtain authorization for that identity. Never reuse PID 29448's grant for a different process.
2. Archive old local approval/proof metadata and issue the established two-hour explicit runtime-testing authorization for the exact current PID/start/DLL/env/profile hashes. Do not record a personal database confirmation on the user's behalf.
3. Run `helpers/runtime-verification.ps1` without `-ReadOnly` to bind the grant, then `Run.ps1 -Mode isolation`. Both must pass before mutations. Preserve `automatedSessionCorrelationPassed=false`.
4. Run:

```powershell
.\tests\functional\Run.ps1 -Mode mutating -TestFilter 'Team Scores' -ReportLabel team-scores-focused
```

5. Diagnose actual failures and rerun only affected cases. Then run the existing affected scoring regression once:

```powershell
.\tests\functional\Run.ps1 -Mode mutating -TestFilter 'team creation, membership, score entry, standings and recalculation' -ReportLabel team-scores-existing-scoring
```

6. Replace preview evidence with clearly labeled real synthetic-development screenshots where available; update this report and WORK_LOG with actual results/manifests. Do not run destructive cleanup, publish, deploy, or expand the feature.

## Files changed

Application:

- Controllers/StatisticsController.cs — partial declaration and additive schedule IDs.
- Controllers/StatisticsController.Matchups.cs — authorized read and atomic batch save.
- Models/MatchupScoresDto.cs — batch request/nullable score validation contracts.
- ClientApp/src/app/data-models/DTOs.ts — optional schedule/team IDs.
- ClientApp/src/app/services/statistics.service.ts — matchup read/write calls.
- ClientApp/src/app/team-scores/team-scores.component.ts — selected-date schedule editor and independent save state.
- ClientApp/src/app/team-scores/team-scores.component.html — compact scheduled/manual cards and saved inspector; other tabs/unlock controls retained.
- ClientApp/src/app/team-scores/team-scores.component.less — scoped desktop/mobile layout.

Testing/documentation:

- tests/functional/helpers/database.ps1 — synthetic schedule seed and snapshot.
- tests/functional/helpers/fixtures.cjs — new endpoint in the guarded regression allowlist.
- tests/functional/playwright.config.cjs — include focused spec.
- tests/functional/specs/team-scores.spec.cjs — four focused cases.
- tests/functional/scripts/team-scores-preview.cjs — no-write browser verification/screenshots.
- tests/functional/TEAM_SCORES_FEATURE.md — this checkpoint.
- tests/functional/team-scores-evidence/ — four preview PNGs and assertion JSON.
- tests/functional/WORK_LOG.md — checkpoint entry.

Pre-existing untracked tests/ux work was preserved. LoginController, Startup, LeagueAccess, login service, publish profiles, .env, package manifests/lockfiles and database models were not changed. No production, IIS, Cloudflare, deployment or publish operations occurred.

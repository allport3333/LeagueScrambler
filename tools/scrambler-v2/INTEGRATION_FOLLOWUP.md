# Scrambler V2 integration follow-up — 2026-11-20

**Updated after explicit user authorization:** real persistence, modification, score saving, printing and exact-owned cleanup now pass. See [INTEGRATION_RESULTS.md](INTEGRATION_RESULTS.md). The remainder below preserves the pre-authorization investigation and approval scope.

## Current result

**The history-endpoint 404 is resolved. Real persistence is awaiting fresh database-test authorization.** No database write test was executed and no expired approval was renewed or bypassed. The large statistical suites were not rerun. No algorithm/application source, branch refs or existing uncommitted work was changed; no commit, merge, push or deployment occurred.

## Root cause and runtime repair

The active checkout is `feature/scrambler-algorithm-v2`, commit `7ac3590`. At the start of this follow-up there was **no listener on port 5001**, so no process was terminated.

The old Debug assembly, timestamp `2026-11-20T02:42:01Z`, did **not** contain `ScramblerHistoryController`; the newer Release assembly did. The V2 source correctly declares `[Route("api/ScrambleData")]` and `[HttpGet("TeammateHistory/{leagueId:int}")]`. Existing `AddMvc`/`UseMvc` registration discovers it normally. No routing or controller code fix was necessary.

Visual Studio automation was used only after confirming the exact original solution, Debug configuration, existing `Allport_s_League_Scrambler` profile, design mode, and no unsaved documents. The Debug build passed (exit 0), then that existing profile was started. No unrelated application/process was stopped.

Verified new listener:

- PID **17800**, `dotnet.exe`, started `2026-11-20T18:03:16.7340220Z`.
- Assembly: `Allport's League Scrambler/bin/Debug/netcoreapp2.2/ASP.NET Core 2.2 with Angular 7.dll` in the original repository.
- Debug assembly SHA-256: `C172ECA70778A3B65528ACCE3986B43E16A675B68304BF22E424BC5E9F7890C7`.
- Bound only to `127.0.0.1` / `::1` on port 5001.
- Existing process guard verifies Visual Studio/VsDebugConsole ancestry, expected Debug DLL, launch profile and environment-file identity.
- Independent runtime inspection verifies **ASPNETCORE_ENVIRONMENT=Development**, server **localhost**, database **LeagueScramblerDev**, **Windows Authentication**. No credentials or connection strings are logged.

## Live HTTP and database verification — read only

Real requests to the new backend, using normal certificate validation, were compared with an independent SQL membership calculation. SQL verification separately confirms actual database name and local machine identity. The comparison checks **every returned pair and its occurrence count**, not just response length.

| Scope | HTTP | Saved source teams | Unique pairs | Pair occurrences | Exact independent comparison |
|---|---:|---:|---:|---:|---|
| WW Winter 2026, league 37 | 200 | 200 | 815 | 1,202 | Pass |
| WW Test League, league 133 | 200 | 96 | 489 | 576 | Pass |

Both responses identify the requested league, contain no duplicate aggregate keys, and use `Cache-Control: no-store`. Invalid league 0 returns **400**; nonexistent league 2147483647 returns **404**. Error bodies are allowed to use ASP.NET's normal plain-text formatter.

Evidence: `tests/functional/artifacts/v2-integration/`, including build exit/log, process identity, runtime inspection, independent read-only SQL comparison and `history-http-verification.json`.

## Authorization gate — stopped here

The existing manual/runtime mutation approvals expired **2026-11-17T18:37:37Z** and refer to an older process. Automated SQL-session correlation still fails. Successful independent runtime inspection grants **no mutation authorization** under the existing test policy.

The requirement comes from `tests/functional/README.md`, “Explicit manual verification for the current process”: “Rebinding after restart requires a new user confirmation of the running target; do not run the approval command automatically.” The currently running process must therefore receive a new explicit debugger/target confirmation and process-bound approval before writes.

### Proposed authorized test scope

Target is exclusively **localhost / LeagueScramblerDev / Development / Windows Authentication**. The test will use a new uniquely named `LSAuto_<run-id>_Lv2persistence` league and normal synthetic registration/login; it will not use either real Allport account.

Expected fixture records:

- One synthetic administrator test account, `lsauto_<run-id>_v2admin@example.invalid`; only this new fixture account receives the test role.
- One new test league, its one owner association and four ordinary default league settings.
- **41 new synthetic player records and league memberships**: forty playing participants plus one bye. No shared/existing player is reused or modified.
- **20 King/Queen team rows**: ten saved historical teams and ten newly generated V2 teams.
- **80 team membership rows**, plus **two bye rounds/two bye links** (one for each saved scramble).
- Up to **50 round-score rows** belonging only to the new V2 scramble if the live score-entry persistence check is included.
- Re-saving and modifying must update these same records, not create duplicate scrambles/memberships. Top designation is temporary algorithm input, not a permanent account/player update.

Verification will generate/save/retrieve V2 assignments; check all forty IDs, the bye, twelve-to-ten Top overflow, genders, strict selected-history exclusions and matchup order; compare history aggregates after saving; exercise a valid assignment modification; check scores/winners; and inspect the saved viewer/printing. Existing court fields are local notes with no persisted model field; no schema change or saved-court claim is proposed.

### Cleanup proposal requiring explicit scope approval

The prepared test currently follows the existing harness's **retain-owned-graphs** policy; it does not automatically delete them. If cleanup is approved, a narrowly scoped cleanup must first validate the manifest's exact league/user/player/team IDs, synthetic names and ownership, inspect incoming references and snapshot the complete fixture graph. It must refuse deletion if any record is shared or ownership is uncertain.

Deletion would then occur in one FK-safe transaction, restricted to those exact IDs: owned scores/memberships and bye links/rounds, teams, league associations/settings, the owned league, and finally the independently owned synthetic players/account when no external references remain. Verify zero owned rows remain and unrelated/reference snapshots are unchanged before committing. No prefix-wide, table-wide, production or pre-existing-league deletion is permitted. If the proof fails, roll back, preserve the manifest and report retained records.

No records have been created yet, so there is currently nothing to clean up. This document is the informed approval scope, not evidence that the mutation/cleanup test has run.

## Pass / pending summary

| Check | Status |
|---|---|
| Diagnose missing V2 route | PASS — stale Debug assembly identified |
| Correct source/registration | PASS — no code correction needed |
| Correct Development process/assembly | PASS — PID 17800, verified Debug/VS ancestry |
| Live scoped history data | PASS — both leagues match independent SQL |
| Runtime/local SQL identity | PASS — Development, localhost/LeagueScramblerDev, Windows Authentication |
| Fresh mutation authorization | **PENDING USER CONFIRMATION** |
| Actual V2 generation/save/retrieve/modification | **NOT RUN** |
| Actual score persistence and saved-data viewer/printing | **NOT RUN** |
| Owned fixture cleanup | **NOT RUN — no fixtures created; scope awaiting approval** |

The Development app is left running for confirmation. Restarting/rebuilding it again will invalidate any subsequent process-bound approval. This follow-up does not recommend merging before the remaining real persistence checks pass.

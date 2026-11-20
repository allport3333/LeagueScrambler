# Scrambler V2 live integration results — 2026-11-20

**Result: the remaining localhost runtime and real database-persistence checks passed. All test-owned records were removed successfully.**

This completes the integration follow-up to [the independent verification](INDEPENDENT_VERIFICATION.md) and [the runtime/authorization investigation](INTEGRATION_FOLLOWUP.md). The statistical suites were not rerun. The Scrambler algorithm and application code were not modified. There was no merge, commit, push, deployment, schema change, production access, real-account password/role change or unrelated-process termination.

## Runtime and authorization

The previous Debug assembly lacked `ScramblerHistoryController`. After a successful Debug build, the verified original Visual Studio solution/profile was started as PID **17800**, listening only on localhost port 5001. The application uses the repository's expected Debug DLL, SHA-256 `C172ECA70778A3B65528ACCE3986B43E16A675B68304BF22E424BC5E9F7890C7`.

The user explicitly authorized the reported Development target, synthetic test scope and exact owned-record cleanup. The existing approval workflow was used to issue a new two-hour binding to that PID, process start time, Debug DLL hash, `.env` hash and launch-profile hash. The prior approval was archived, not reused. Independent effective-runtime inspection verified:

- Environment: **Development**.
- SQL server/database: **localhost / LeagueScramblerDev**.
- Authentication: **Windows Integrated Security**.
- Visual Studio/VsDebugConsole ancestry and loopback-only listener.

Automated correlation to a SQL session still did **not** pass. Reports explicitly retain that distinction. Writes proceeded under the user's fresh process-bound authorization plus independent runtime verification; no guard was disabled.

The live history route returns 200 for both reference leagues, 400 for invalid league 0 and 404 for a nonexistent league. Every real HTTP pair/count matches independent direct SQL membership calculations, with no-store response headers:

| League | Unique pairs | Historical pair occurrences |
|---|---:|---:|
| WW Winter 2026, ID 37 | 815 | 1,202 |
| WW Test League, ID 133 | 489 | 576 |

These counts were rechecked after cleanup and remained unchanged.

## Actual test execution

Command: `Run.ps1 -Mode mutating -TestFilter 'Scrambler V2 persists' -ReportLabel scrambler-v2-integration`.

**Result: 1 passed, 0 failed, 0 skipped; approximately 7.4 minutes.** The test uses real localhost API endpoints and SQL records, not intercepted response fixtures. Creation is deliberately slower because every mutating request rechecks process isolation, and fixture identities/relationships are recorded throughout.

Owned fixture:

- Run ID: `a51acab868b6ae60ca1a7542`.
- League: `LSAuto_a51acab868b6ae60ca1a7542_Lv2persistence`, ID **134**.
- One normally registered/authenticated synthetic administrator, ID **1247**, using the reserved `example.invalid` domain. No real account was used.
- **41** synthetic players and memberships: forty eligible participants and one bye.
- Historical scramble **1** and V2 scramble **2**, ten teams each: **20 teams, 80 team membership rows**.
- **50** round-score records for the V2 scramble, five rounds per team.

### Generation, persistence and relationships — PASS

The V2 engine received the actual newly created player IDs, twelve configured Top priorities, Low roles, actual saved historical teammate pairs and the selected team's league context. Its validated output was submitted to the existing Generate/Save endpoints. API retrieval returned every expected stable team ID, each of the forty expected player assignments exactly once, the correct gender values, and the separate bye.

The first ten ranked players retained Top status; the other two remained included as ordinary players. Every generated team had exactly one retained Top and no pair forbidden by the selected historical scramble. The saved/retrieved team order preserved adjacent matchup pairing and numbering.

Each whole scramble was re-saved using its existing IDs. Team/membership counts did not increase. No duplicate scramble or player assignment was created.

### Modify Teams — PASS

The normally authenticated synthetic session was transferred to the test browser through its genuine issued cookies. The actual Angular component retrieved the saved V2 scramble and opened its existing Matchups modal. No fabricated principal or real-user authentication was used.

The test entered Modify Teams and used the existing player-move handler to swap two ordinary players of the same gender and role between teams. The proposed swap was independently checked against all historical exclusions before applying it. Save Teams completed through the real backend. API retrieval matched the exact changed assignments; all eighty membership row IDs and the twenty team records remained unchanged. Top/gender composition and strict history remained valid.

### Historical calculations after saves/modification — PASS

After initial save, after the compatible swap, and after score saves, the new history endpoint was compared against an independent calculation from the historical and current actual memberships. Each stage contained **120 distinct pair keys and 120 occurrences**. The modified keys, not just the totals, were checked. Idempotent re-saving did not inflate history, byes did not become teammates, and no unrelated league was included.

### Actual score entry/save/retrieve — PASS

The live component initialized five rounds per saved team. Numeric scores were entered into the existing shared score objects; its existing winner calculation and Save Round Scores method were used. SQL and API checks verified all fifty values, the corresponding winners and positive saved record IDs.

A second save updated those same rows: **still fifty score records**. Retrieving the scored scramble restored all fifty entries. No scoring formula, winner rule or substitute behavior was changed.

### Viewer and printing — PASS within browser scope

The actual saved-data viewer displayed all five V2 matchups. Desktop and 390px mobile screenshots were captured. Print Matchups generated HTML containing every eligible participant, the existing score-table layout and Court 4 in the correct matchup. Chromium rendered the output to a two-page A4 PDF, including the separate bye content. Native print-dialog/device behavior was not tested.

Court remains an existing **transient local note**; it has no persisted backend field. The test verified display/printing without claiming saved-court persistence or adding a schema field.

## Exact-ID cleanup — PASS

Before test creation, all **25 application tables** were snapshotted by deterministic primary-key ordering, row counts and server-computed SHA-256 row-content hashes. Secret/account contents were not logged.

Cleanup first verified the exact manifest, synthetic names/IDs, account ownership, league ownership, expected child IDs, every incoming foreign key (including cascade paths), absence of enabled side-effect triggers and **zero outside references**. It then deleted only those exact IDs in one serializable transaction. The transaction required all 25 tables to match the pre-test row-count/content-hash baseline before committing.

| Removed owned records | Count |
|---|---:|
| Synthetic User | 1 |
| Player | 41 |
| LeagueType / UserLeague / LeagueSettings | 1 / 1 / 4 |
| PlayersLeague | 41 |
| KingQueenTeam / KingQueenPlayer | 20 / 80 |
| KingQueenRoundScores | 50 |
| ByeRounds / ByePlayer | 2 / 2 |

Cleanup committed successfully. A **second post-commit verification** again matched all 25 table row counts/hashes to baseline. Thus no test-owned data remained and existing application rows matched their pre-test state. Identity counters may have advanced naturally; no reseeding/reset was attempted.

The manifest retains historical evidence and is annotated with completed cleanup. Screenshots, PDF, test results and sanitized diagnostics remain local as ignored artifacts.

## Evidence and files

- `tests/functional/artifacts/v2-integration/persistence-result.json`: real assignment/score/history results.
- `tests/functional/artifacts/runs/scrambler-v2-integration/`: Playwright HTML/JSON/Markdown report, trace and diagnostics.
- `tests/functional/artifacts/v2-integration/cleanup-plan-<run-id>.json`, `cleanup-execute.json`, `cleanup-verify.json`: exact IDs, removal counts, transaction and post-commit proofs.
- `tests/functional/artifacts/manifests/a51acab868b6ae60ca1a7542.json`: reserved synthetic identities, all fixture IDs and completed-cleanup annotation.
- `tests/functional/artifacts/scrambler-v2-audit/real-persistence-viewer.png`, `real-persistence-mobile.png`, `real-persistence-print.pdf`: saved-data browser evidence.
- `tests/functional/specs/scrambler-v2-persistence.spec.cjs`: extended real test covering modification, history recalculation, scores and print output.
- `tests/functional/scripts/v2-audit/cleanup.cjs` and `cleanup-owned.ps1`: guarded Snapshot/Plan/Execute/Verify workflow. It refuses to overwrite an existing baseline or act on an unverified graph.

## Remaining limitations

No blocking V2 runtime/persistence failure remains in this focused development test. Production/IIS/Cloudflare behavior, native printer/device behavior and real-account authentication were not exercised. The previously documented PWA/security/password-recovery branch-integration discrepancy was not changed or merged as part of this work. Existing court nonpersistence remains intentional. The already completed statistical/constraint results were preserved rather than rerun.

The original Development application is left running. All changes remain uncommitted on `feature/scrambler-algorithm-v2`; master and the separate password-recovery worktree remain unchanged. This report records verification, not permission to merge or deploy.

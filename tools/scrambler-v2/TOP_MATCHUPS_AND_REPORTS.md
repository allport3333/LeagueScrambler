# Top Player matchups and exception-only arrangement reports

Status: **Complete**, November 20, 2026. Implemented in the existing **master**
working tree. No new branch/worktree, commit, push, merge, deployment, or database
write was performed. All pre-existing uncommitted gender/history regression work
was preserved.

## Recovery inspection

After the reported transport disconnect, Git status and source were inspected
before editing. The matchup implementation, structured issues, report markup,
and pairing tests were already present. The preserved passing
`top-matchups.json` evidence was checked against the current engine SHA-256:
`cb6386424e1348928283aa2ad6782ebed507d2121fc564e149e69dfbf7299a3f`.

Those pairing tests were **not rerun**. The development bundle was older than
the new implementation, so the remaining work was fresh frontend builds,
browser visibility checks, focused gender/history regressions, and existing
viewer/save/score/print regressions. No large statistical suite was repeated.

## Pairing behavior

`pairByComposition` now receives the engine's retained Top Player IDs. Player
names, `isTopPlayer` flags on demoted players, and database retrieval order do
not determine Top team status.

The order of priorities is:

1. Preserve complete team membership and the already established individual
   gender balance, top capacity, low-player handling, byes, and strict teammate
   exclusions.
2. Maximize Top-versus-Top matches: `floor(retainedTopTeams / 2)`.
3. Prefer similar opposing male/female counts within that priority. Teams are
   ordered by composition within each pool. When there is an odd Top count,
   each possible remaining Top team is considered, including the composition
   cost of its ordinary matchup pool. Odd total team counts retain one unpaired
   team without inventing an opponent.
4. Randomize equivalent choices and equivalent match order/sides.

Examples verified for ten teams:

| Retained Top Players | Top-versus-Top matches |
|---:|---:|
| 3 | 1, with one remaining Top team facing an ordinary team |
| 4 | 2 |
| 6 | 3 |
| 10 | 5 |

Top-versus-Top pairing can take precedence over perfect opposing composition
similarity. It never changes a team's players or creates a new individual
gender imbalance. Identical opposing compositions are not required. Complete
Random retains its existing behavior and does not acquire Top/gender balancing.

The new ordering runs only during generation, before new saved IDs are assigned.
Retrieval, saved matchups, existing court/score associations, manual editing,
save APIs, and printing do not rerun this ordering.

## Report visibility

The engine returns structured `issues` in addition to its existing full
diagnostic warnings, metrics and result fields. The UI does not parse reason
or warning strings to decide visibility.

The report is hidden for ordinary success, expected top overflow, an odd Top
count, normal minor opposing composition differences, and ordinary bounded
soft-history preference diagnostics. Full diagnostic data remains in the engine
result and test evidence.

The report opens for:

- Failed/invalid generation or validation.
- Inconclusive search-budget exhaustion, distinguished from proven impossibility.
- A service failure or changed inputs requiring another attempt.
- Successful fallback with necessary minimum repeated teammate pairs; all pairs
  remain listed by player name.
- A proven necessary individual gender compromise.
- Unresolved Low Player balancing requiring attention.

The latest attempt is separate from the generation result belonging to the
currently displayed teams. Failed retries therefore show their own diagnostics
while preserving previous teams and their save validation state. The report is
outside the results-only shell, so a first failed attempt is visible even when
no previous teams exist. Ordinary successful generation also no longer displays
the redundant success explanation; the existing results/inline notice remain.

## Completed verification

| Check | Result |
|---|---|
| Preserved pairing suite | 1,080 cases across 1–12 teams and every Top count passed |
| Small exact matching oracle | 160 independently enumerated equal-size cases passed maximum Top count and minimum composition difference |
| Equivalent pairings | 3,000 trials: first Top's partners occurred 983 / 997 / 1,020 times; chi-square 0.698 |
| Odd Top handling | Remaining Top identity occurred 1,019 / 986 / 995 times; chi-square 0.582; equivalent choices varied |
| Pairing invariants | Original player objects/membership retained, no source mutation, no missing or duplicate teams; demoted flags do not affect retained-ID classification |
| Structured outcomes | Normal/odd/overflow results have no issues; strict failure, fallback, budget exhaustion, gender compromise and unresolved low balance have the appropriate issues |
| Existing gender/history regression | 54 roster/history cases, 30 option/role cases, 36 attendance cases and 208 independent allocation-oracle cases passed after the pairing change |
| Browser normal success | No arrangement report or redundant success explanation, including overflow and odd Top count |
| Browser exceptions | Service/strict failures, fallback pairs, successful gender compromise and exhausted-search diagnostics remain visible; failed attempts preserve current teams/result |
| Responsive browser checks | Desktop 1366/1920 and mobile 375/390/430; no new horizontal overflow or JavaScript errors |
| Matchup workflow regression | Seven groups passed generation/retrieval, modification, cancel/save/error behavior, saved IDs, modal focus/scroll, mobile and print checks |
| Score entry regression | Five groups passed automatic winners, ties/blanks, desktop/mobile shared state, ten rounds and save/reload fixture behavior |
| Printing regression | Actual print method/PDF and original baseline comparisons passed at 2/4/6 matchups per page; closed/open viewer output matches |
| Angular development build | Passed, exit 0, hash `bb338955ba2774e32025` |
| Angular production build | Passed, exit 0, hash `7315858bceb0331a3d40`; existing outdated Browserslist-data warning |
| Git whitespace checks | Passed |

Browser/API interactions used deterministic intercepted fixtures, not real
database writes or real login sessions. Backend code and contracts are unchanged.
These checks do not constitute a new real-device or database-persistence test.
The pairing simulations are evidence of varied equivalent choices, not a claim
of uniform sampling of every complete constrained arrangement. The exact
secondary-cost oracle covers equal-size small cases; the production heuristic
retains composition ordering for unequal team sizes and makes no global
minimum-distance claim for arbitrary unequal-size matchings.

## Files and local evidence

Application changes:

- `Allport's League Scrambler/ClientApp/src/app/scrambler/scramble-engine.ts`
- `Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.ts`
- `Allport's League Scrambler/ClientApp/src/app/scrambler/scrambler.component.html`

Focused tests/documentation:

- `tests/functional/scripts/v2-audit/top-matchups.cjs`
- `tests/functional/scripts/v2-audit/common.cjs` (checks Top matchup count instead
  of requiring the old global composition order when Top teams are present)
- `tests/functional/scripts/scrambler-v2-browser.cjs`
- `tools/scrambler-v2/RULES.md`

Ignored local evidence:

- `tests/functional/artifacts/scrambler-v2-audit/top-matchups.json`
- `tests/functional/artifacts/scrambler-v2-audit/gender-balance-regression.json`
- `tests/functional/artifacts/scrambler-v2/browser-results.json`
- `tests/functional/artifacts/scrambler-v2/normal-success-no-report-desktop.png`
- `tests/functional/artifacts/scrambler-v2/minimum-repeat-report.png`
- `tests/functional/artifacts/scrambler-v2/gender-compromise-report-mobile.png`
- `tests/functional/artifacts/scrambler-v2/search-budget-report-mobile.png`
- `tests/functional/artifacts/v2-integration/top-matchups-development-build.log`
- `tests/functional/artifacts/v2-integration/top-matchups-production-build.log`
- Existing matchup/score regression outputs beneath
  `tests/functional/artifacts/scrambler-v2/regression-*`.

Nothing remains unfinished for this focused task. The earlier inability to
recover the exact unsaved Scramble 20 selections remains documented separately
in `GENDER_BALANCE_REGRESSION.md`; it is not claimed resolved by these fixture
checks and does not block completion of this pairing/report task.

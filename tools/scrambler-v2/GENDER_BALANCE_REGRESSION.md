# Multi-history individual gender balance regression

Verified November 20, 2026. This follows the earlier exact-opposing-composition
correction documented in `RETRIEVE_REGRESSION.md`.

## Scramble 20 evidence and limitation

Read-only SQL inspection of **localhost / LeagueScramblerDev**, independently
verified against the running Development process, found sixteen pending team
records for WW Test League (LeagueId 133), Scramble 20: TeamIds 11326–11341.
All have `ScrambleWithScoresToBeSaved=false` and **zero saved player memberships**.
There are no saved bye records for Scramble 20.

Consequently, the database cannot reconstruct Scramble 20's exact players,
temporary gender overrides, manually selected top/low players, byes, selected
historical scrambles, or any unsaved modifications. Historical selection is not
stored on `KingQueenTeam`. The user was asked which previous scramble numbers
were selected; that information has not been supplied at report time.

**The exact Scramble 20 input remains unverified.** The verified reproduction
below uses real saved WW Test League records and reproduces the reported
four-man-team pattern. Its inputs are explicitly identified rather than being
presented as recovered Scramble 20 settings.

## Confirmed reproduction and cause

Current read-only league roster: **64 players, 47 men, 17 women**. Select maximum
team size 4 (sixteen teams), no top/low selections or byes, balanced mode,
fallback off, full-history preference off, and these strict historical scrambles:

**1, 2, 3, 4, 5, 6, 11, 12**.

They produce **663 distinct prohibited within-team player pairs**. Opponents are
not prohibited simply for sharing a match. Historical IDs and genders were read
without changing records. The permanent fixture remaps player/team IDs and
omits names and account information; original IDs remain only in ignored local
read-only evidence.

With deterministic test stream
`gender-counterexample:1,2,3,4,5,6,11,12:2`, the prior V2 implementation returned:

- One 4M/0F team, thirteen 3M/1F teams, two 2M/2F teams.
- All 64 players exactly once, correct team sizes, zero prohibited pairs.
- Gender dispersion cost **162**, although **158** is achievable.

The first constraint-search assignment already contained four-man teams (cost
166). The subsequent bounded pairwise-swap optimizer improved it to 162, then
returned success with an unproved-balance warning. Independent enumeration of
all single cross-team swaps found **126 legal swaps, 79 neutral swaps, and zero
strictly improving swaps** at that returned arrangement. The optimizer had
reached a plateau; success and valid history exclusions did not establish proper
gender balance. Matchup reordering only sorts complete teams and did not cause
the imbalance. This reproduction requires no subsequent team modification.

## Targeted correction

`scramble-engine.ts` keeps its existing mandatory-feasibility search and selected
history fallback proof. Before returning a balanced scramble, it now searches
for the **best feasible individual-team gender dispersion**, starting at the
existing ideal lower bound:

1. Reuse the known history-valid assignment as a search hint, without fixing its
   memberships or removing any legal alternatives.
2. Apply whole-arrangement gender-cost bounds, feasible per-team gender ranges,
   and necessary remaining-player coverage checks during backtracking.
3. Search progressively higher gender costs only after disproving lower costs.
   A true compromise is explicitly reported as the best feasible gender balance.
4. On exhausted search, return an inconclusive result with no new teams, rather
   than publishing the first unbalanced assignment.
5. Preserve the proved gender cost during subsequent low-player/history
   improvement and final validation.

The completion bound is the exact minimum ignoring role/history constraints:
start with current male counts, fill remaining places as female, then allocate
the required remaining men by increasing convex marginal cost. It is a lower
bound for the constrained problem, so it cannot reject a completion with a
better feasible cost. Gender coverage uses distinct-player bipartite matching
for minimum unfilled gender slots, another necessary condition only.

There is no new fixed gender quota or identical-opponent requirement. Gender
infeasibility does **not** imply strict-history infeasibility. Fallback still
requires proof that strict teammate avoidance is impossible, and minimizes
selected-history repeats before optimizing gender. Top priority/overflow,
eligible IDs, byes, low-player precedence, and random candidate ties remain.
Complete Random is unchanged. Similar-composition matchup ordering is unchanged.

## Verified result

A fully gender-balanced strict solution exists for the reproduced configuration:
**fifteen 3M/1F teams and one 2M/2F team**, all sixteen teams of four, all 64 IDs
exactly once, **zero prohibited teammate pairs**. Its dispersion cost is
`15*(3²+1²)+(2²+2²)=158`, equal to the independent ideal lower bound.

Every team has a woman. Seven opposing pairs have identical compositions; one
3M/1F versus 2M/2F pairing remains because the gender totals are odd. No players
are silently removed to force identical compositions.

## Tests actually performed

| Verification | Result |
|---|---|
| Real browser, eight selected saved scrambles | Initial generation plus five independent subsequent generations passed; every team checked for a woman, four players, no repeated IDs, and every strict excluded pair |
| Additional browser generations | 26–40 ms each, 130–137 search nodes; no JavaScript errors or write attempts |
| Seeded real-data fixture | 54 successful no-history/single-history/eight-history runs; 54 distinct arrangements; mean 16.57 ms, median 13 ms, max 100 ms |
| Optional features and roles | 30 passes: history preference, fallback enabled with strict feasible, top/low overlap and overflow, female-top and mixed-top selections |
| Attendance configurations | 36 passes, including 47M/17F, enough women for every team, fewer women than teams, odd gender totals, uneven team sizes |
| Independent allocation oracles | 208 cases: all 64 forbidden-pair graphs on four players with/without top constraints, plus 80 six-player graphs; strict feasibility, minimum repeats, and best feasible gender cost independently enumerated |
| Genuine required gender compromises | Verified and explicitly reported, including a forced four-man team when strict exclusions truly prevent the ideal balance |
| Exhausted gender search | No teams returned; reported budget-exhausted, never strict impossibility or permission for fallback |
| Previous Retrieve regression | All 96 cases passed, including all eleven saved histories singly, multiple histories, changed attendance, byes, and roles |
| Existing engine suite | Passed, including 4,000 seeded runs, top overflow, strict exclusions, tiny exhaustive fallback checks and responsiveness |
| V2 browser integration | Passed history options, roles, league changes, error retention, mobile/desktop layout |
| Matchup, court/print, automatic score winner browser regressions | Passed using intercepted API fixtures; saving/editing/cancel/errors, score state and persistence payloads, court fields and print layout/PDF checks |
| Angular development / production builds | Both passed, exit 0; existing outdated Browserslist-data warning in production build |

Legacy was run with the same anonymized 64-player roster and all eight historical
selections. Each of three runs exceeded its external five-second test limit;
no legacy solution or correctness claim is made for that dense configuration.
The corrected V2 solution itself provides an independently validated feasibility
witness. The earlier single-history legacy comparison still passes.

Not every history-valid arrangement has ideal gender balance: the captured old
output is a counterexample. The correction ensures that a returned balanced-mode
result uses the best feasible gender cost, or reports an inconclusive search.
It does not claim every complete balanced arrangement is sampled uniformly.

## Scope, evidence, and repeatability

Only the pure engine, rule documentation, and focused tests were changed. No
backend endpoints, persistence contracts, authentication, player records, roles,
or league data were modified. Actual browser generation used existing preview
mode with an additional write-blocking request guard. Real persistence was not
repeated; save and score regression checks used intercepted browser fixtures.
No records required cleanup. No commit, merge, push, or deployment occurred.

Current work remains uncommitted in the existing working directory on master,
which had already received V2 through the earlier user-authorized merge. The
separate password-recovery worktree and prior uncommitted regression work were
preserved.

Permanent checks:

```powershell
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/v2-audit/gender-balance-regression.cjs
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/v2-audit/retrieve-history-regression.cjs
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/scrambler-v2.cjs
```

Local ignored evidence:

- `tests/functional/artifacts/v2-integration/scramble20-source.json`: read-only
  SQL evidence, including Scramble 20's pending team IDs.
- `gender-counterexample.json`, `gender-root-cause.json`: prior result,
  prohibited-pair input and independent local-swap enumeration.
- `tests/functional/artifacts/scrambler-v2-audit/gender-balance-regression.json`:
  all results and a complete anonymized valid assignment witness.
- `tests/functional/artifacts/v2-integration/real-workflow-dense-gender.json`:
  actual read-only browser inputs, player IDs, compositions, calls and five
  subsequent independently checked arrangements.
- `real-workflow-dense-gender-desktop.png`,
  `real-workflow-dense-gender-mobile.png`, `real-matchups-dense-gender-mobile.png`.
- `gender-balance-development-build.log`, `gender-balance-production-build.log`.

The reproduced solver defect is corrected and verified. Certification of
Scramble 20's **exact** unsaved input still requires its browser-side selections;
this report does not replace that missing evidence with assumptions.

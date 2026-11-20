# Scrambler Algorithm V2 review

Branch: `feature/scrambler-algorithm-v2`, based on `2a6fcce`.

Worktree: `C:\Users\Allport\source\repos\LeagueScrambler-algorithm-v2`.

The original worktree and the separate password-recovery worktree were preserved. No commit, merge, push, deployment, schema change or database write was performed for this task.

## Implementation and rule priorities

The preimplementation inspection and rule contract are in [RULES.md](RULES.md). The original generation methods remain in the component as `legacyScramblePlayers` and its helpers; an independent frozen snapshot from the base commit is used by comparison tests. The UI calls V2.

`scramble-engine.ts` is a pure asynchronous TypeScript utility with structured input/output. It has no Angular, HTTP, database, save or presentation dependencies. It uses the existing PlayerId and returns existing-compatible team memberships. The component maps those IDs back to the selected Player objects and retains the existing Generate/Save APIs.

- Plain Completely Random uses cryptographic rejection-sampled integers and Fisher–Yates, then fixed balanced-size allocation. Top/Low/gender placement is omitted. For fixed labeled capacities, this shuffle/allocation construction gives equal probability to complete labeled allocations, assuming a uniform random source. This claim does **not** extend to the constrained solver.
- Balanced mode enforces exact team capacities, each eligible player exactly once, separate byes, and at most one retained Top per team. It preserves the established even-team count calculation for maximum sizes 2–5 and explicit team-count precedence.
- Positive configured `KingQueenTopPlayer.Rank` precedes standings. Incomplete/tied priorities use the existing score, Gold priority, unreduced score and name rules, with PlayerId resolving identical names. Manual flags establish membership, not incidental list order. If overflow cannot be prioritized from ranks or standings, generation asks for that data instead of arbitrarily demoting someone.
- With 12 selected Tops and 10 teams, the highest-priority 10 retain the role; the other 2 remain selected ordinary players in their current gender. Permanent flags/rankings are not rewritten. Both Apply Top buttons share priority and capacity logic; the automatic standings button remains male-only.
- Top takes precedence over malformed Top/Low overlap. Gender dispersion, then Low dispersion, then optional full-history frequency are balancing preferences. Hard restrictions always take precedence. The component reports when globally optimal soft balance was not proved.
- Candidate filtering, most-constrained-player selection, random equal-choice ordering, forward checks, symmetry pruning and backtracking replace random invalid-player retry loops. Final assignments are independently validated before GenerateScramble is called.
- Balanced matchup ordering remains male-count descending, then female-count descending; male players are displayed first. Equivalent-composition teams are shuffled. Memberships do not change during matchup ordering.

## History and failure handling

Selected saved scrambles prohibit **all within-team PlayerId pairs** by default. Opponents, unrelated leagues, pending generated teams and byes do not count. Invalid selected history produces a clear failure, not invented restrictions.

The optional fallback is off by default. It starts only after exhaustive strict failure or a sound combinatorial lower bound proves strict impossibility. Increasing repeat bounds are then searched; a fallback is returned only after every smaller bound is disproved. The generated report lists the actual repeated player pairs before saving. A timeout never substitutes for that proof.

The new unchecked “Prioritize fewer previous teammates” option works without selecting scrambles. The read-only `GET /api/ScrambleData/TeammateHistory/{leagueId}` aggregates distinct finalized team memberships into player-pair counts. It exposes only IDs/counts, uses parameterized SQL and the same public read visibility as existing scramble-history reads. Byes, pending previews and unrelated leagues are excluded. There is one fresh aggregate read per enabled generation and no persistent client cache to become stale after team edits. A failed request is distinct from an empty history.

The two options coexist: strict selected exclusions first; team/role requirements; gender/Low balance; full-history variety. The fallback minimizes selected-pair violations before other objectives.

Default search limits are 150,000 nodes and 2.5 seconds, with cooperative event-loop yields. Status distinguishes success, invalid configuration, proved impossible, exhausted budget, cancellation and unexpected error. No failed/inconclusive result creates pending teams or replaces previous results. League/input changes cancel or invalidate stale attempts; repeated clicks are guarded. Old-league selections and locks cannot leak into a new league.

Existing team editing deliberately allows manual size/role overrides. Generated solutions satisfy engine constraints; subsequent manual editing retains that workflow. Save still checks duplicate/completeness identities and selected-history exclusions, and retains the existing save/print state, error handling and confirmation dialogs.

## Verification performed

All evidence is in `tests/functional/artifacts/scrambler-v2/` (ignored generated artifacts).

| Check | Result |
|---|---|
| Angular 7 development and production builds, existing TypeScript/ES5 target | Passed, recorded exit codes 0 |
| ASP.NET Core 2.2 Release build | Passed |
| Pure engine cases | Passed: 8/16/24/32/40/63 attendance, sizes 2–5, explicit counts, byes, Top overflow/ranks/ties/genders, Low spread/overlap, same-name IDs, history scoping/edits/missing data, backtracking, invalid configuration, impossible/budget/cancel/unexpected outcomes |
| Minimum-repeat proof | 25 tiny restricted cases agree with an independent exhaustive oracle |
| Plain shuffle | All 24 four-player permutations enumerated; six fixed-capacity labeled team allocations each occur four times; rejection-sampling tail also tested |
| Statistical fixtures | 4,000 seeded runs: 2,000 plain random and 2,000 balanced; every assignment valid, 4,000 distinct labeled outcomes; maximum per-player team-index chi-square 21.206 (test threshold 28); all 2,000 balanced cases reach their theoretical gender/Low bound |
| Old/new comparison | 100 runs each for 8, 24, 40/10 Tops, 40/12 Tops and 63 players. Both generally complete quickly; V2 adds constraints/validation overhead. Legacy 12-Top case puts two Tops on one team; V2 caps roles and retains every player. The old same-name identity defect is reproduced |
| History preference | Across 100 small fixtures, historical pair cost totals 315 without preference and 0 with preference |
| Runtime fixtures | Median approximately 0.5/1.8/6.4/15.4 ms for 24/40/64/80 players; 80-player maximum approximately 16.6 ms on this machine |
| Combined history runtime | Three 40-player cases with six historical sessions, two strictly excluded sessions and Top/Low roles: valid strict results in approximately 12–43 ms; event-loop timers run during optimization |
| Real read-only history check | Verified localhost, Windows authentication and runtime `LeagueScramblerDev` identity. 1,304 aggregate pairs across WW Test League and WW Winter 2026 match an independent membership calculation. Invalid/missing leagues handled. No records changed |
| Browser V2 fixtures | Configured ranks override standings; overflow; no history query when off; strict and general history together; independent checkbox; failed reads/generation retain data; duplicate-click guard; proved fallback exposes pairs; league-switch cancellation |
| Existing score regression | Desktop/mobile automatic winners, blanks/zero/ties, totals, ten rounds, whole-scramble save/reload and unmatched/unscored cases passed |
| Existing matchup regression | Generation/retrieval, shared modal, manual edits, failure/retry, one save request, cancellation/close/Escape, court notes, disclosures and mobile editing passed |
| Printing | Existing actual print method compared with a freshly built pre-V2 baseline using the same browser/fonts. Printed pixels and PDF page counts identical at 2/4/6 matchups per page; modal open/closed HTML identical |
| Responsive UI | Rendered at 1366/1920 desktop and 375/390/430 mobile. New controls fit; phones have no page overflow. The full-roster desktop fixture retains a pre-existing 105px overflow with or without V2 controls; it was not changed as part of algorithm work |

Browser tests intercept **every application API** and never reach a database or authenticate a real account. Saves in those tests are synthetic transport checks, not verified database persistence. Real sign-in/authentication and a real saved V2 scramble remain for manual development review. No production data was accessed.

Existing Angular dynamic-dependency/Browserslist warnings and the older backend framework/package warnings remain; this change does not update dependencies.

## Limits

- No claim of statistically uniform complete **balanced** assignments. Random local ties and solution diversity tests do not prove that.
- General history and balancing preferences use bounded improvement. Global optima are reported only when the corresponding theoretical lower bound is reached; otherwise a warning is shown. Difficult strict/minimum-repeat cases may return an inconclusive budget result rather than a team assignment.
- Tests cover ordinary league sizes up to 80 for performance; input is capped at 256 to bound browser work. Dense pathological cases can exhaust the configured budget.
- Historical frequencies reflect reliably linked saved team memberships, not reconstructed attendance or assumed historic rosters.
- The frozen V1 comparison avoids running its potentially enormous impossible-history retry loops. V2 impossible-history correctness is checked against independent tiny exhaustive searches instead.

## Files

- `ClientApp/src/app/scrambler/scramble-engine.ts`: pure V2 engine, priority/history utilities and validator.
- `scrambler.component.ts/html/less`: integration, history options, feedback/repeat report, request guards; legacy generator retained.
- `ClientApp/src/app/services/player.service.ts`: aggregate history read.
- `Controllers/ScramblerHistoryController.cs`: league-scoped read-only pair aggregation.
- `tests/functional/fixtures/scrambler-v1-methods.json`: frozen legacy source.
- `tests/functional/scripts/scrambler-v2*.cjs`: engine, legacy comparison, browser integration and existing-fixture regression runners.
- `tools/scrambler-v2/`: rule contract, this report and guarded read-only endpoint integration check.

## Reproduce locally

Run from this worktree, using the repository's compatible Angular Node/npm environment. The worktree currently reuses the original dependency directories through ignored junctions; no dependency or lockfile changes were made.

```powershell
# Synthetic tests; no application server, credentials or database required.
$node = 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe'
& $node tests/functional/scripts/scrambler-v2.cjs
& $node tests/functional/scripts/scrambler-v2-compare.cjs

# Build the development bundle before browser fixtures.
Set-Location "Allport's League Scrambler/ClientApp"
node node_modules/@angular/cli/bin/ng build --preserve-symlinks --progress=false --output-path=../../tests/functional/artifacts/scrambler-v2/development-dist
node node_modules/@angular/cli/bin/ng build --prod --preserve-symlinks --progress=false --output-path=../../tests/functional/artifacts/scrambler-v2/production-dist
Set-Location ../..
$env:PLAYWRIGHT_BROWSERS_PATH = (Resolve-Path tests/functional/.tools/browsers).Path
& $node tests/functional/scripts/scrambler-v2-browser.cjs
& $node tests/functional/scripts/scrambler-v2-regression.cjs scoring-auto-winners

dotnet build "Allport's League Scrambler/Allport's League Scrambler.csproj" --configuration Release
# Optional, read-only: use the existing verified local development .env path.
dotnet run --project tools/scrambler-v2/HistoryCheck.csproj --configuration Release -- '<existing-local-development-.env-path>'
```

The matchup print regression additionally requires a fresh pre-V2 development build in `artifacts/scrambler-v2/baseline-dist`. Set `SCRAMBLER_V2_BASELINE=1`, run the regression runner with `before`, clear that environment variable, then run it with `matchups-modal`. This keeps browser/font differences from being mistaken for print-layout changes.

For manual interactive testing, start the application from this worktree using the normal development launch process and existing securely supplied development environment configuration. The original `.env` was neither copied nor edited. Review the rule contract, generated report and strict/fallback behavior before merging.

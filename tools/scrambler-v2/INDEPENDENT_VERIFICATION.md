# Scrambler V2 independent verification — 2026-11-20

**Later integration update:** the stale runtime was repaired, fresh user authorization obtained, and the actual development persistence/cleanup test passed. See [INTEGRATION_RESULTS.md](INTEGRATION_RESULTS.md). This document retains the original audit's measurements and then-current blockers below.

**Decision: do not merge yet.** The expanded algorithm checks pass, but real database persistence is **BLOCKED**, and the running localhost backend does not expose V2's history endpoint. No actual V2 save/retrieve round trip is claimed.

No algorithm or application source was changed. The verification added tests, a test-project selector, this report/protocol, and one diagnostic output line in the existing read-only history checker. No merge, commit, push, deployment, account/password change, schema change or database write was performed.

## Scope, source and integration

- Active branch: `feature/scrambler-algorithm-v2`, commit `7ac359057b8d79f7898aeec74d23cb4e14a9b29c`.
- Engine SHA-256: `309e59534d53fee520956c1eb8b1dc812ec5017695ff08ba2c7a0235f13a50e6`.
- Local **and independently queried remote** master: `9efcc2fc6e0bf5ca0c0d3a73f19bf78dc08b2105`. It is an ancestor of V2. No merge was attempted.
- PWA is present in master. Security commit `2a6fcce` is present in V2 but is **not** an ancestor of master. Password-recovery changes remain uncommitted in their existing separate worktree. Thus the statement that all other work is already merged is not supported by the actual refs.
- There are no V2 edits to `Startup.cs` or `LoginController.cs` relative to master. That is source compatibility evidence, **not** verification of integrating the pending password-recovery changes.
- Existing uncommitted password-recovery work and all branch refs/worktree registrations were preserved.

The [protocol](VERIFICATION_PLAN.md) was written before the primary new statistical samples. Main families use significance level 0.01 with Holm correction. The final run includes a strengthened independent role validator; repeated deterministic seeded samples are not counted as independent replications.

## Acceptance matrix

| Area | Result | Evidence and limits |
|---|---|---|
| Complete Random fairness | PASS within tested scope | 720,000 equal-capacity samples plus 90,000 supplementary uneven-capacity/slot samples; all hard invariants hold; no corrected primary rejection |
| Balanced correctness | PASS | 72,000 ordinary plus 72,000 role-marked samples; 48 uneven size/gender configurations; independent assignment/role validation |
| Team-index/input-order bias | PASS within tested scope | Six input orders, 49 primary Complete Random tests, equal-composition balanced tests, 12,000 retained-top placement runs and 6,000 composition-conditional runs; no corrected rejection |
| Top priority/overflow | PASS | 24 priority/gender/capacity combinations; explicit list overrides standings; 10/12,10/10,10/8,6/10; additional ties/Gold/raw-score/missing-priority tests |
| Gender balance | PASS | Ordinary fixtures attain theoretical balanced gender composition; unequal output indices tested conditional on intentional composition ordering |
| Low distribution | PASS | Role-marked samples, varied attendance and explicit overlap cases; no ordinary-fixture Low dispersion regression relative to legacy |
| Strict teammate restrictions | PASS | 2,560 graph cases: 1,025 feasible and 1,535 proved impossible; all pairs checked independently; 532 graph cases have one unlabeled strict solution |
| Minimum-repeat fallback | PASS for exact cases | All 2,560 fallback results match exhaustive minima; additional 200 combined-option oracles also match selected-repeat minima; no fallback on inconclusive budget |
| Full-history preference | PASS as bounded preference | 10,000 off/10,000 on: mean cost 2.7662 → 0 in the prespecified favorable fixture; source counts verified independently in Dev |
| Combined history options | PASS for hard priority; soft optimization limited | 1,000 strict-valid preference runs plus 200 exhaustive combined cases, including 71 strict-impossible cases. All selected-repeat minima exact; full soft lexicographic optimum reached in 190/200, not guaranteed |
| Matchup pairing | PASS | Composition ordering/male-first display preserved; membership invariant; 1,000 equal-composition reorderings cover all 24 team permutations |
| Performance/responsiveness | PASS for measured cases | Sizes 8–80, ordinary/strict/history/combined; maximum measured case 861.2ms, with cooperative yields. Chromium 128-player stress case processes a click during generation |
| Actual database persistence | **BLOCKED** | Existing approval expired; SQL process correlation failed. Prepared test is genuinely skipped by the existing guard, not counted as passed |
| Scrambler UI/score/printing regressions | PASS with synthetic APIs | Actual Angular component, desktop/mobile, save/error/modify/retrieve paths, score winners, byes, locks and PDF/pixel checks; no actual backend persistence implied |
| PWA/security integration | PASS for existing current-source fixtures | Current production worker/update/network-only API checks and focused patched-dependency checks pass. Real device authentication is not established |
| Password-recovery integration | **NOT VERIFIED** | Changes are not present on this branch/master; no email or password-reset action was attempted |
| Live V2 backend | **FAIL — stale runtime** | `GET https://localhost:5001/api/ScrambleData/TeammateHistory/0` returns 404. New V2 route should return 400 for invalid league 0 |

## Complete Random: probability model and measurements

Primary fixture: six distinct IDs, three labeled size-two teams. There are `6! / (2!^3) = 90` within-team-unordered labeled arrangements. Each has probability `1/90`; each player has team probability `1/3`; each pair has teammate probability `1/5`; any specified two-person team has probability `1/15`.

Fisher–Yates chooses each permutation with equal probability when supplied independent uniform bounded integers. Exactly `2!^3` permutations map to each fixed-capacity arrangement, establishing the uniform-allocation property for this unconstrained construction. Production bounded integers use rejection sampling, avoiding modulo bias. The production sampler's rejection tail is tested separately. This mathematical argument assumes the cryptographic source supplies uniform draws; finite tests cannot prove entropy quality.

Each input order receives 120,000 runs. The alphabetical group uses the actual production `secureRandomInt` with Node WebCrypto; the other groups use named, SHA-256-seeded xoshiro128** test streams with rejection sampling. These are test injections, not application RNG changes.

| Input order | χ², df=89 | Raw joint-fit p | Cohen's w | Joint TV distance | Largest player/team probability error |
|---|---:|---:|---:|---:|---:|
| Alphabetical | 78.2055 | 0.78634 | 0.02553 | 0.01021 | 0.00175 |
| Reverse alphabetical | 98.4615 | 0.23115 | 0.02864 | 0.01115 | 0.00227 |
| Player ID | 94.7565 | 0.31838 | 0.02810 | 0.01188 | 0.00453 |
| Reverse ID | 84.0030 | 0.62989 | 0.02646 | 0.01015 | 0.00195 |
| Synthetic ranking | 86.9865 | 0.54061 | 0.02692 | 0.01068 | 0.00289 |
| Shuffled | 56.8200 | 0.99687 | 0.02176 | 0.00909 | 0.00185 |

All 90 arrangements occur in every group. Across groups, individual arrangement counts range from 1,219 to 1,461 against expectation 1,333.33 per category. Repeated results are expected; uniqueness is not the acceptance criterion.

There are **zero Holm-corrected rejections among 49 primary tests**: per-order joint arrangement and per-player team fits, cross-order joint homogeneity and cross-order player fits. Observed maximum team-probability deviation is 0.453 percentage points, below the predeclared 1-point practical target. Maximum TV distance is 1.188 percentage points, below the 2.5-point target. Largest original-first/original-last placement difference is 0.364 percentage points; paired 99% intervals are retained in the detailed JSON.

Raw result files contain player-placement counts, all arrangement frequencies, labeled-team assignment frequencies, pair counts and pointwise 99.9% Wilson intervals. Within-scramble pairs and first/last players are dependent; their pooled fits are diagnostic, not independent multinomial primary tests. The joint arrangement test addresses that dependence. Cohen's w is used for one-way GOF and Cramer's V for contingency tables; initial reporting terminology was corrected without changing counts, test statistics, p-values or thresholds.

Supplementary **90,000 runs** cover uneven attendance/configuration, size-proportional team probabilities and all flattened player positions. Every participant is marked both Top and Low in these Random-mode tests; neither role affects assignments. All IDs occur once and no corrected placement/slot rejection occurs. Bigger fixed-capacity teams legitimately have larger player probability; testing every team against `1/teamCount` would create a false bias finding.

## Balanced randomness, roles and ordering

Eight players, four men/four women, four size-two teams have 576 equal-composition labeled mixed-gender arrangements. Six input orders each receive 12,000 ordinary runs and another 12,000 with two male Tops/two female Lows. Every generated arrangement is independently checked for completeness, uniqueness, capacity, applicable retained roles, gender and reported historical cost.

All ordinary and role-marked families have zero corrected player/index/input-order rejections. Complete balanced arrangement fits are supplied as **diagnostics**, not a uniformity theorem. Gender composition sorting and male-first display are intentional. An uneven 26-men/14-women, ten-team configuration is tested against composition-conditional placement expectations in 6,000 runs, not a uniform team-number null.

The retained-top placement experiment uses 12,000 further runs over six orders, ten teams and twelve configured Tops. Exactly the ranked ten retain the role; all forty participants remain. Top player/team index fits have zero corrected rejections.

Top priority cases verify positive explicit rank first, standings next, then existing Gold/raw-score/name ties and stable-ID resolution for identical names. Missing information needed to select excess Tops produces invalid configuration rather than arbitrary demotion. Another 200 mixed-gender overflow cases demote two women, preserve their female classification and permit them to share teams with retained Tops as ordinary players. Source inputs/permanent flags are unchanged. Byes cannot consume retained Top roles.

## Strict history and fallback: exact evidence

Independent enumeration never calls the engine allocator or its final validator. It enumerates team memberships and calculates every teammate pair itself.

- All 1,024 five-player forbidden-edge graphs are checked both without roles and with two retained Tops.
- Another 256 six-player graphs are checked for each role setting.
- Total: 2,560 graph configurations, each tested strict and fallback. Strict results: 1,025 valid, 1,535 proved impossible. Fallback cost matches the mathematical minimum in **2,560/2,560** cases.
- These include 532 configurations with exactly one unlabeled valid solution, plus multiple-solution configurations. Names are identical while IDs differ, exposing name-based identity mistakes.
- A complete 16-player prohibited graph into four size-four teams returns exactly 24 repeated pairs, correctly marked proved minimum. This lower bound is exact because every possible within-team pair is prohibited.
- Zero and positive node-budget exhaustion, cancellation and injected RNG exceptions produce the appropriate distinct outcomes and no partial teams. Budget exhaustion never sets strict-impossibility proof or starts an unproved fallback.

The history index tests independently distinguish repeated memberships within one team, the same pair in different saved teams, unrelated leagues, opponents, pending teams and byes. Existing browser fixtures verify failures do not become assumed zero history and do not generate/save partial data.

With both historical options enabled, 1,000 strict-valid runs have no prohibited pair. In 200 additional small exhaustive cases, including 71 strict-impossible cases, all fallback selected-repeat counts equal the exact optimum. The full priority vector (selected repeats, Low dispersion, frequency cost; gender constant in that fixture) reaches its exact optimum in 190/200. This is the expected limitation of bounded soft optimization; selected-repeat optimality remains proved in all 200.

## Full-history preference: effect size and uncertainty

Prespecified comparison: identical eight-player balanced pools, two Tops/two Lows, same four historical teammate pairs weighted 5/3/2/1, 10,000 independent injected-stream runs per setting. A zero-cost balanced arrangement is feasible. No selected strict restrictions are active in this comparison.

| Measurement | Preference off | Preference on |
|---|---:|---:|
| Mean cost | 2.7662 | 0 |
| Median cost | 2 | 0 |
| Worst cost | 11 | 0 |
| Zero-cost fraction | 36.77% | 100% observed |
| Distinct labeled arrangements | 576 | 216 |
| Correct gender, Top and Low distribution | 10,000/10,000 each | 10,000/10,000 each |

Mean reduction: **2.7662**, 100% in this favorable fixture. Bootstrap 99% CI with 2,000 resamples: **[2.6895, 2.8418]**. Independent-group normal 99% CI: [2.68969, 2.84271]. Standardized mean difference: **1.317**. A 2,000-permutation one-sided check gives p=0.00049975 (finite permutation resolution; not an exact p of zero).

The 216 enabled outcomes are all zero-cost mixed-gender derangements with labeled team permutations, rather than deterministic repetition of one arrangement. All 10,000 enabled samples having zero cost does not prove every future run succeeds: the one-sided 99% upper bound for a nonzero-cost rate after zero observations is approximately 0.0461% under independent sampling.

A separate 100-case small weighted-history oracle finds the exact overall history optimum in 99 cases; one case returns a higher cost and correctly does **not** claim global optimality. Do not describe this option as an exact global optimizer. It lowers average repeat frequency while preserving hard restrictions.

### Actual database history recheck — read only

The console checker validates `.env` localhost/Windows-auth configuration and independently verifies actual `DB_NAME()` and SQL machine identity. It then compares the new controller's aggregate result with a separate grouped-membership calculation.

| League | Finalized teams with linked members | Distinct members | Membership rows | Unique pairs | Pair occurrences | Unique pairs seen more than once |
|---|---:|---:|---:|---:|---:|---:|
| WW Winter 2026, ID 37 | 200 | 63 | 777 | 815 | 1,202 | 291 |
| WW Test League, ID 133 | 96 | 64 | 384 | 489 | 576 | 80 |

The previous **1,304** is `815+489` distinct pair keys counted separately by league, **not** 1,304 historical teammate occurrences and not a merged cross-league history. Total occurrences are 1,778. Duplicate membership rows within one saved team are deduplicated before pair counting. No historical record was changed.

## Legacy comparison and performance

The frozen pre-V2 methods are compiled independently. Eight configurations receive 500 legacy and 500 V2 runs each: 8/16/24/32/40/63/80 attendance, with separate forty-player 10-Top and 12-Top cases. All ordinary attempts complete without duplicated/omitted participants in both implementations. Size/gender/Low quality agrees in these fixtures. V2 has no Top capacity violations; the legacy twelve-Top/ten-team case violates that rule **500/500** times.

| Fixture | Legacy mean ms | V2 mean ms | Legacy worst ms | V2 worst ms |
|---|---:|---:|---:|---:|
| 8 players | 0.106 | 0.170 | 0.890 | 4.091 |
| 40 players, 10 Tops | 0.473 | 1.754 | 1.475 | 5.388 |
| 40 players, 12 Tops | 0.474 | 1.736 | 0.885 | 4.697 |
| 63 players | 0.959 | 6.177 | 4.857 | 51.691 |
| 80 players, 20 Tops | 2.214 | 22.444 | 9.841 | 74.888 |

V2 is **not faster on ordinary easy inputs**. Its additional validity checks/search/optimization cost CPU. Without the history preference, historical repeat costs are sometimes higher and sometimes lower than legacy; there is no blanket history-improvement claim for an option that is off.

Twenty-five actual legacy strict trials run in isolated workers with an external one-second ceiling, without changing its retry-loop limits. Both algorithms succeed in all 25 and repeat no selected pair. Legacy mean/worst: 3.775/69.965ms; V2: 0.771/1.590ms. This limited fixture supports improved constrained selection, not a universal runtime superiority claim. Impossible legacy retry loops are not run indefinitely.

A further 560 generation attempts cover 8/16/24/32/40/63/80 players across ordinary/strict/history/combined modes, twenty attempts per case. The eight-player strict quartet fixture is correctly proved impossible; it is not counted as a timeout or generation bug.

| Players/mode | Median ms | Maximum ms |
|---|---:|---:|
| 24, strict | 0.550 | 861.217 |
| 40, ordinary | 1.661 | 2.391 |
| 40, strict | 1.958 | 2.274 |
| 40, history | 3.145 | 17.543 |
| 40, combined | 3.893 | 19.141 |
| 80, ordinary | 15.703 | 27.031 |
| 80, history | 16.840 | 79.427 |
| 80, combined | 31.224 | 57.418 |

The 861ms outlier is retained in the results rather than hidden behind the median. Default hard-search limits remain 150,000 nodes/2.5 seconds; hard cases can be inconclusive. Timings are measurements on this development workstation, not production latency guarantees.

In Chromium, the actual ES5 engine processes a deliberately dense 128-player frequency fixture for 402.8ms under a 400ms configured budget. A four-millisecond heartbeat fires 59 times, maximum observed gap 20.4ms; a DOM button click is processed **during** generation. It returns a validated success plus the correct unproved-history warning. This is browser event-loop evidence, separate from the full Angular fixture checks.

## UI, persistence and integration gates

Current Angular development and production builds pass, recorded exit codes 0. The backend Release build/read-only integration checker passes. Existing framework/dependency warnings remain; no upgrades were made.

Focused actual-component fixtures pass desktop 1366/1920 and mobile 375/390/430 controls, player/bye selection, explicit count precedence, both Top buttons, history picker, history checkbox, fallback report, Lock Results, input/league cancellation, failure/retry, duplicate-request protection, stable-ID saving, retrieval, Modify/Cancel/Close/Escape and print gating.

Score regressions pass shared desktop/mobile state, ten rounds, automatic round winners, ties, blank versus zero, all-team save payload and reload. The actual print function, court-note methods and all three print templates are byte-equivalent to current master. Rendered print/PDF comparison passes at 2/4/6 per page with modal open/closed. Court 4/9/2 is shown on the correct print cards; blanks stay blank.

**Court limitation:** court values are intentionally local notes held in `Map<Team,string>`; `KingQueenTeam` has no persisted Court field. This predates this audit and the user previously allowed nonpersistent courts. The task did not change that contract. No saved-court persistence claim is made.

The freshly built production PWA passes actual service-worker registration, static caching/no API caching, session/role fixture freshness, update notice without forced reload, unfinished form retention, schedule/roster loading and printing fixtures. Native installation and real standalone authentication are not tested. Patched dependency regression checks also pass. Pending password recovery is not integrated here, and no email/password action was performed.

### Why actual persistence is blocked

1. The existing approved mutation harness cannot correlate the listening process with a SQL session.
2. Its manual/runtime process approvals expired **2026-11-17 18:37:37 UTC**. They were not renewed or forged.
3. Independent read-only runtime inspection verifies that PID 8504 is configured for localhost/LeagueScramblerDev with Windows Authentication. That inspection explicitly grants **no mutation authorization**.
4. A read-only capability check against the live listener returns **404** for the V2 route. The newly compiled controller works against Dev in its separate read-only checker, indicating the running app is stale.
5. The new focused real-persistence test was actually invoked through the normal harness. Result: **1 BLOCKED/SKIPPED**, with the reason “Process authorization is absent, expired, or outside the approved development scope.” Exit code 0 from a skipped test is not a persistence pass.

The prepared test requires a V2-capable backend **before any fixture creation**. Once authorized, it uses normal registration/login for a run-owned synthetic administrator, a uniquely named synthetic league and 41 synthetic players; saves a historical scramble, generates forty V2 players with one bye and twelve ranked Tops, saves/resaves/retrieves using real endpoints, checks every ID/assignment/role/strict pair and duplicate protection, then opens the actual viewer with normally issued test cookies. Its exact IDs are recorded by the existing manifest mechanism. Existing harness policy retains owned league graphs for inspection instead of permitting destructive graph cleanup. No fixture has been created by this blocked run.

Required next steps: restart Visual Studio's application from this V2 branch, confirm the running Development profile targets localhost/LeagueScramblerDev with Windows Authentication, then explicitly rebind its process-scoped development-regression approval using the documented existing workflow. Rerun the focused persistence test. Do not merge until it passes and the branch-integration discrepancy is reviewed.

## Reproduction and evidence

All raw output is local/ignored under `tests/functional/artifacts/scrambler-v2-audit/`; browser fixtures also use `artifacts/scrambler-v2/`, PWA uses `artifacts/pwa/`, and the guarded persistence attempt is in `artifacts/runs/scrambler-v2-audit/`.

```powershell
$node='tests/functional/.tools/node-v22.23.5-win-x64/node.exe'
& $node tests/functional/scripts/v2-audit/statistics.cjs random
& $node tests/functional/scripts/v2-audit/statistics.cjs balanced
& $node tests/functional/scripts/v2-audit/statistics.cjs roles
& $node tests/functional/scripts/v2-audit/random-uneven.cjs
& $node tests/functional/scripts/v2-audit/correctness.cjs
& $node tests/functional/scripts/v2-audit/edge-cases.cjs
& $node tests/functional/scripts/v2-audit/history.cjs
& $node tests/functional/scripts/v2-audit/performance.cjs
& $node tests/functional/scripts/v2-audit/legacy.cjs
& $node tests/functional/scripts/v2-audit/enrich.cjs
# Browser runners require the existing local Playwright browser path and fresh audit build directories.
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path tests/functional/.tools/browsers).Path
& $node tests/functional/scripts/v2-audit/ui.cjs
& $node tests/functional/scripts/v2-audit/browser-heartbeat.cjs
& $node tests/functional/scripts/v2-audit/presentation-proof.cjs
& $node tests/functional/scripts/v2-audit/pwa-integration.cjs
# Keep real writes blocked until the documented runtime confirmation/rebinding has been completed.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/functional/Run.ps1 -Mode mutating -TestFilter 'Scrambler V2 persists' -ReportLabel scrambler-v2-audit
```

New test files are under `tests/functional/scripts/v2-audit/` and `tests/functional/specs/scrambler-v2-persistence.spec.cjs`. `playwright.config.cjs` only adds that guarded spec to the mutating project. `tools/scrambler-v2/Program.cs` only prints additional read-only frequency diagnostics.

Test-harness corrections during this audit: treat mathematically impossible performance fixtures as a valid distinct outcome; ensure the reused browser fixture's main entry point actually executes; strengthen independent retained-role checks; use correctly named one-way effect sizes. Affected checks were rerun/recalculated. No application constraint was weakened to make a test pass.

**Final status:** strong, scoped correctness/randomness evidence; no reproduced algorithm defect requiring a code correction. Actual persistence and live V2 integration remain required acceptance gates. No merge recommendation is given.

# Independent V2 verification protocol — 2026-11-20

Protocol recorded before the new statistical samples. Existing 4,000-run output is not used as a substitute for these experiments. Branch starts at 7ac3590; no merge or commit is authorized.

## Primary statistical endpoints and thresholds

- Family significance level 0.01. Holm correction across each experiment's prespecified primary tests. Report chi-square statistic, degrees of freedom, upper-tail probability computed by the gamma distribution, Cohen's w for one-way fits, Cramer's V for cross-order contingency tables, standardized deviations and Wilson intervals. A nonsignificant result is not a proof of fairness. Correlated diagnostic comparisons are explicitly not independent replications. Effect-size naming was corrected during reporting; counts, statistics, p-values and thresholds were unchanged.
- Complete Random: 120,000 fresh scrambles for each of six input orders (alphabetical, reverse alphabetical, ID, reverse ID, ranking, independently shuffled). Six distinct positive IDs, three fixed labeled teams of size two; 90 equally likely within-team-unordered arrangements. Primary tests per order: 90-arrangement multinomial fit, 15-pair multinomial fit, each player's three-team fit (6 tests), first-versus-last original player placement homogeneity. Expected pair probability 1/5; any two-person labeled team has probability 1/15. Each scramble contributes three correlated teammate pairs; pair-fit p-values are diagnostic only because within-scramble pair indicators are dependent. Arrangement fit is the valid joint primary test. Pair confidence intervals use one Bernoulli observation per pair per scramble.
- Use the production crypto-backed RNG for one 120,000-run order; independent deterministic seeded rejection-sampled generators for the remaining orders, with named seeds fixed in the runner. Explicitly test production rejection-sampling bounds and Fisher–Yates permutation enumeration separately. Never replace the production RNG with Math.random in application code.
- Complete Random practical fairness target: maximum absolute player/team probability deviation <=0.01 and max arrangement TV distance <=0.025; report uncertainty instead of treating these thresholds as proof. Input-order homogeneity uses arrangement categories and player placements; many occurrences of a shared-name label do not make players interchangeable identities.
- Pre-execution clarification: first-versus-last placement and pooled pair-frequency fits are descriptive diagnostics, not independent multinomial observations; the joint arrangement test handles their within-scramble dependence. Holm-controlled primary tests are arrangement fits, per-player team fits and cross-order fits. Confidence intervals are labeled pointwise.
- Balanced: 12,000 runs per six input orders, eight players (four male/four female), four size-two teams. Every team has the same composition, so team-index uniformity is not confounded by intentional sorting. Also sample 12,000 role-marked runs per order (two male Tops/two female Lows); all 576 labeled mixed-gender pair arrangements have equivalent size, gender and role quality. Uniformity of complete balanced arrangements is not required by the specification; report departures as diagnostics and investigate role/player/index dependencies with effect sizes. Uneven compositions are assessed conditional on composition; output ordering itself is intentional.
- History preference: 10,000 runs off plus 10,000 on, same eight-player mixed-gender fixture, same four saved former pairs with weights 5,3,2,1. Strict history is off for this comparison. Preserve two Top/two Low roles. Compare mean/median/cost distribution/max, diversity, gender/role quality; independent-group normal mean-difference CI, plus a fixed-seed bootstrap CI and permutation check. Practical target: lower mean cost when on; exact minimum cost is zero for this fixture. Report how often it is attained. No claim of general global optimization follows from this favorable fixture.

## Independent correctness oracles

- Enumerate labeled allocations for small pools without calling engine candidate/validation helpers. Verify all IDs, byes, capacities, retained roles, every strict pair, reported repeat pairs and composition ordering.
- Exhaust all 1,024 prohibited-edge graphs for five players into capacities 3/2, plus six-player graph samples and role constraints. Exact feasibility/minimum repeated-pair count comes from complete allocations, independent of the engine. An exhausted budget is inconclusive, never impossible.
- Check unique unlabeled strict solutions, multiple solutions, cliques, overlapping histories, identical names/different IDs, unrelated/pending/bye histories, and combined strict/frequency options.
- Top capacity cases 10/12,10/10,10/8,6/10; ranked configured order versus standings, ties, missing priority, mixed genders and Top/Low overlap. Source objects must be unchanged.
- Exhaustive soft-objective comparisons for small balanced pools identify true lower bounds and distinguish best-found from proved optimal. Preserve hard restrictions even if soft objectives conflict.

## Legacy, performance and regression

Use the frozen base-commit legacy methods independently. Equal synthetic inputs, 500 runs/configuration, report valid assignment rate, size/gender/role quality, history cost, diversity, index frequencies and runtime. Do not run the legacy 100,000-attempt impossible retry loops unbounded; cap externally or mark not compared.

Measure up to 80 players, hard strict cases, fallback and timeout/cancel/error paths. Browser heartbeat evidence must demonstrate cooperative yielding. Repeat relevant existing score/modal/printing fixtures against freshly built code. Do not rerun unrelated full suites.

## Real data and safety

Read-only frequency verification rechecks each league separately and reports distinct pair count versus total pair occurrences, finalized team/member counts and source scope. No historical data is changed.

Database persistence is a separate required acceptance gate. Respect the existing localhost/LeagueScramblerDev runtime and process-bound approval checks. Use only a run-owned synthetic fixture and existing Generate/Save/Retrieve endpoints; record exact IDs, snapshot ownership and never touch real scores/accounts. If isolation/authorization fails, record BLOCKED and do not recommend merging. A fixture-only save is not persistence evidence.

## Integration

Record actual local refs instead of assuming branch merges. Preserve all uncommitted work. Compare shared Scrambler changes with latest local master. No automatic merges, commits, pushes or deployments. Report omitted integrations as unverified rather than silently importing them.

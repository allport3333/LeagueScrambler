# WW Test League: Retrieve Scramble regression

Follow-up: `GENDER_BALANCE_REGRESSION.md` documents the subsequently discovered
multi-history gender-balance plateau and its correction. The verification below
predates that additional solver change.

Verified November 20, 2026 against the existing local Development application.

The reported error was reproduced in the actual browser with WW Test League
(LeagueId 133), saved Scramble 1, all 64 eligible players selected, maximum team
size 4, balanced mode, no top/low selections, no byes, strict previous-teammate
avoidance enabled, and fallback/history preference disabled. The same roster is
present in all eleven saved scrambles captured during this investigation.

## Reproduction and cause

1. Select WW Test League and Select All players.
2. Choose maximum team size 4.
3. Open Retrieve Scramble and retrieve Scramble 1 using its existing retrieve button.
4. Click **Scramble With No Duplicate Teams**.

Retrieving succeeded: sixteen saved teams loaded without invoking generation.
Generation then failed with the exact reported “Matching gender compositions are
impossible…” message. The failure came from the newly added parity precheck in
`generateScramble`, called by `ScramblerComponent.scramblePlayers(true)`.
It occurred before assignment search, not during historical record retrieval.

The selected roster contains **47 men and 17 women**. The recent, uncommitted
change incorrectly required every opposing pair to have identical male/female
counts. Such pairs necessarily contribute even totals of each gender, so the
precheck rejected this roster immediately, regardless of teammate exclusions.

The established `reorderMatchups` rule sorts and pairs **similar** compositions;
it does not require exact parity. `RULES.md` already documents gender dispersion
as a balancing objective and selected-history exclusions as mandatory.

## Correction

Removed the added exact-composition parity rejection, composition feasibility
pruning, final exact-composition validator, composition-constrained swaps, and
corresponding save guard. Restored the original male-count/female-count ordering
and randomized equal-composition ordering. No other V2 algorithm was replaced.

This removes only the erroneous uncommitted restriction. Relative to current
HEAD, production code is functionally back to its previously merged V2 behavior;
the remaining engine diff clarifies the intended pairing contract. Permanent
regression tests and an anonymized real-data fixture are added.

The original configuration is feasible. Independently validated legacy and V2
solutions both have fifteen 3M/1F teams and one 2M/2F team, optimal gender
dispersion, sixteen four-player teams, every eligible ID exactly once, and zero
prohibited teammate pairs. There are no four-man teams in these solutions.
Seven matches have identical compositions; the final 3M/1F versus 2M/2F matchup
is unavoidable at this optimal balance with these odd attendance totals.
No players are silently removed or assigned a bye to force exact parity.

## Verification

| Check | Actual result |
|---|---|
| Real browser reproduction before correction | Exact reported error reproduced |
| Real browser after correction | Strict generation succeeds; all 64 IDs and 16 teams retained; all teammate pairs independently checked against saved Scramble 1 |
| Retrieval alone | Loads saved teams; no generation invoked |
| Single selected history | 66 passes: six seeds for each of scrambles 1–6, 11–14, and 16 |
| Multiple selected histories | 12 passes: [1,2] and [1,3,6], six seeds each |
| Changed attendance, explicit byes, top overflow/low overlap | 18 passes; no source flag mutations |
| Historical scope | Exactly 96 within-team prohibited pairs for Scramble 1; opponents, unrelated league records, and unsaved records excluded |
| True impossibility/fallback/exhaustion | Distinct outcomes retained; tiny exhaustive fallback minimum remains two pairs; no fallback on exhausted search |
| Legacy comparison | Three independently validated strict successes on the same remapped real roster/history; 1.96–2.34 ms |
| V2 real-fixture generation | 66 single-history runs: mean 7.86 ms, median 7 ms, maximum 28 ms |
| Existing engine regression suite | Passed, including 4,000 seeded runs and small exhaustive checks |
| V2 browser integration | Passed: history controls, top priority, league transitions, error retention, responsive results/viewer |
| Existing matchup modal tests | Passed: generation/retrieval, modify/save/cancel/errors, focus/scroll, mobile widths, printing |
| Existing automatic score winner tests | Passed: desktop/mobile shared scores, ties/blanks, save/reload, ten rounds |
| Existing court/print tests | Passed: correct court binding, unchanged print layout and pagination |
| Angular development build | Passed, exit 0 |
| Angular production build | Passed, exit 0; existing outdated Browserslist data warning |
| Browser JavaScript errors | None in the executed checks |

## Safety and limits

The running process was independently verified as Development, PID 17800,
using localhost / LeagueScramblerDev / Windows authentication. All actual league
access was read only. Browser generation ran in existing preview mode, with an
additional request guard blocking writes and legacy player-normalization GETs.
Only the existing read-only multiple-history POST was allowed; its request body
was exactly `[1]`. No Generate, Save Teams, or score submission reached the real
backend. No league records needed cleanup.

Save/edit/score/print regressions used intercepted browser fixtures. Real
persistence was not repeated or claimed in this investigation. Real account
login was not tested. The previously completed integration verification remains
separate evidence, not a new test result here.

Changes remain uncommitted in the existing working directory (currently master,
already merged by the earlier authorized operation). This task performed no new
commit, merge, push, deployment, authentication change, or database write. The
password recovery worktree was left untouched. The rejected local changes were
preserved under ignored `artifacts/v2-integration/rejected-exact-gender-change`.

## Repeatable checks and evidence

Using the existing Node 22 test runtime:

```powershell
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/v2-audit/retrieve-history-regression.cjs
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/scrambler-v2.cjs
```

Fixture: `tests/functional/fixtures/ww-test-retrieve-v2.json`. Player/team IDs
are remapped; no player names, emails, or account details are included.

Detailed fixture results and a valid assignment witness:
`tests/functional/artifacts/scrambler-v2-audit/retrieve-history-regression.json`.
Real browser before/after logs and screenshots:
`tests/functional/artifacts/v2-integration/real-workflow-{before,after}.json`,
`real-workflow-before-desktop.png`, `real-workflow-after-desktop.png`,
`real-workflow-after-mobile.png`, and `real-matchups-after-mobile.png`.

Ready for another manual review of the restored existing workflow. This report
does not recommend a new merge or claim exact-composition matchups are possible
for this roster.

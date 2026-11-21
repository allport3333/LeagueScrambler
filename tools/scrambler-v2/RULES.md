# Scrambler V2 rule contract (recorded before implementation)

Base: security commit2a6fcce. Separate worktree/branch feature/scrambler-algorithm-v2. Legacy methods remain for independent comparison; no database mutations are needed for algorithm tests.

## Existing behavior inspected

- Eligible roster is selectedList minus isByePlayer; byes are saved separately. Temporary gender overrides use each selected player's current isMale value.
- Max size2/3/4/5 chooses the next **even** team count, `2*ceil(eligible/(2*maxSize))`. Explicit team count takes precedence. Sizes should differ by at most one; impossible/empty-team configurations must fail rather than silently omit players.
- Completely Random ignores top/low/gender placement and does not call gender-based matchup reordering. Existing code's neighboring-size comparisons are an accidental allocation bias, not a league rule.
- Balanced mode first places top and low players, then men, then women, favoring small teams and underrepresented gender. There is **no fixed mandatory gender quota** in the source. Gender and low distribution are balancing objectives, not grounds to claim a size/history-feasible scramble impossible.
- UI top/low flags are mutually exclusive: selecting one removes the other. For malformed overlapping input V2 gives top designation precedence; demoted top players are ordinary players for this generation, not extra low players. Source roster flags/configured rankings are never permanently rewritten.
- KingQueenTopPlayer has an actual Rank column; GetTopPlayers orders by Rank and returns it. Positive explicit ranks take precedence. Duplicate/missing/default ranks do not establish an incidental database order. Manual marking supplies membership, not ranking. Standings resolve incomplete priorities using the existing automatic button's score-descending, Gold priority, raw-score-descending, name tie rule; PlayerId resolves identical-name ties. Capacity selection is deterministic; placement remains random. The male standings button remains male-only.
- At most one retained top per team is the intended distribution. Excess selected tops are demoted by priority before placement and remain in their current gender's ordinary pool. Low flags are spread as evenly as legal constraints permit.
- Selected saved scrambles mean every within-team pair is prohibited, not just one sampled member. Legacy top/low placement bypasses these checks and name equality conflates people; these are defects. Byes and unsaved generated placeholders are not teammate history.
- Balanced reorderMatchups sorts teams by male count descending, then female count descending; players display men first. Adjacent teams become matches; sortingId is regenerated. V2 randomizes equal-composition ties without moving members between teams. Random mode retains its shuffled allocation order.
- GenerateScramble creates pending team identifiers; SaveKingQueenTeams finalizes memberships/byes. V2 validates before GenerateScramble and does not call it on failed/inconclusive attempts. Existing authorized save/score/modal/printing contracts remain.

## Priority and proof obligations

Hard: unique positive IDs, every eligible ID exactly once, byes excluded, exact balanced capacities, top capacity (balanced mode), selected history restrictions when strict. Gender/low preferences must never silently override strict restrictions.

Soft (balanced): minimum gender-count dispersion, then low-count dispersion, then optional whole-league pair frequency. Retained top distribution is already enforced by capacity. Equivalent choices are randomized. Explicit historical options also work in Random mode but omit gender/top/low balancing; plain Random without extra constraints is Fisher–Yates plus fixed-capacity allocation.

Individual gender balance is now verified by bounded constraint search after mandatory
feasibility and the minimum selected-history repeat count are established. A first legal
assignment and bounded pairwise swaps are insufficient proof of adequate gender balance.
Search starts at the existing ideal dispersion lower bound and proves lower targets
impossible before accepting a compromise. Exhausted search returns an inconclusive
result with no new teams. Ideal gender infeasibility never implies strict-history
infeasibility and never enables fallback by itself. Opposing composition similarity is
separate from individual team balance; identical opposing counts are not required.

After balanced teams are formed, matchup pairing maximizes retained Top-versus-Top
matches, then prefers similar opposing compositions. A possible remaining Top team joins
the ordinary matchup pool. Equivalent pairings and choices of the remaining Top team are
randomized. This changes only new matchup order, never team membership or saved records.
Expected odd Top counts and minor opposing composition differences are not exceptions.

Generation diagnostics retain their complete warnings and metrics. The user-facing
arrangement report uses structured issues: failed/inconclusive attempts, necessary strict
fallback repeats, a proven individual gender compromise, or unresolved Low Player balance.
Routine top overflow, resolved Top/Low precedence, and a positive soft-history preference
cost do not alone trigger a report. Latest-attempt diagnostics are separate from the result
belonging to the displayed teams so a failed retry does not invalidate their save state.

Strict search failure means exhaustive proof or a valid combinatorial lower bound, never timeout. Fallback starts only after such proof and increases the selected-pair violation bound; the first feasible bound is minimum only when every smaller bound was disproved. Budget exhaustion cannot justify fallback. Optional full-history optimization is bounded and must disclose when global optimality is unproved. Balanced complete arrangements are not claimed uniformly distributed.

# Unified desktop K/Q Matchups — November 18, 2026

## Changes
Desktop only (768px and above): each matchup now has one subtle outer border containing the centered original Match heading, two unbordered player rosters with a restrained VS indicator, recorded rounds-won counts, and one shared Round / Team N / Team N score table. Maximum content width is 1020px; roster/heading/table and inter-matchup gaps are compact. Removed separate desktop round-score lists.

The shared table uses the existing comparisonRows projection, original saved scores and true roundWon flags. Ties remain unmarked, missing records remain unavailable, and unknown outcomes remain Not recorded. Existing colors, Sub badges, player ordering, IDs, pairings, numbering, highlight and navigation are unchanged. No TypeScript, backend, scoring or database changes were needed in this pass.

Mobile markup was compared before/after and left identical. Existing mobile CSS declarations were not edited; new visual rules are desktop-scoped. Fixture screenshots at 375px and 390px compare byte-for-byte equal to their pre-change baselines. 430px was also checked for overflow and existing behavior.

## Verification
- Angular development build passed; existing outdated Browserslist warning remains. Log: artifacts/kq-unified-desktop-build.log.
- Four existing focused browser workflow groups passed, extended to assert unified desktop rosters/VS/shared table and exact mobile screenshot equality.
- Tested widths 1366, 1920, 375, 390 and 430. Checked two matchups, correct original Match numbers, stable teams/players, colored rosters/Sub badge, saved values/win flags (including flags deliberately differing from numeric score comparison), tied rounds and unavailable results.
- Verified standings-format direct link to original Match 2, round highlighting, refresh, View All and back filters; actual profile score click, selected week, manual week change restoring all matches, profile return; missing requested team and missing opposing scores handled safely.
- No page errors or write requests. Tests use localhost/intercepted browser fixtures; no SQL, database mutation authorization or live database verification. No full regression suite run.
- Final screenshot-only capture waited for the week dropdown overlay to be removed, avoiding its transient closing animation. Navigation workflows were not repeatedly rerun for this capture.

## Screenshots
- [Unified desktop 1366](player-profile-evidence/kq-unified-desktop-1366.png)
- [Unified desktop 1920](player-profile-evidence/kq-unified-desktop-1920.png)
- [Unchanged mobile 375](player-profile-evidence/kq-responsive-375.png)
- [Unchanged mobile 390](player-profile-evidence/kq-responsive-390.png)
- Mobile pre-change comparisons: kq-mobile-before-unified-375.png and kq-mobile-before-unified-390.png in the same evidence directory.

Results: player-profile-evidence/kq-responsive-results.json. All captured data is synthetic. Live database responses and clicking from the actual standings screen remain unverified; the standings-format deep-link contract was tested directly, while the actual profile click was executed.

Application files changed in this pass: ClientApp/src/app/kqmatchups/kqmatchups.component.html and .css. Focused browser assertions in tests/functional/scripts/player-profile-ui.cjs were updated for the intentional desktop change; screenshots, this report and WORK_LOG.md record verification. All earlier pending work was preserved.

No production/IIS/Cloudflare/deployment changes, no publish/deploy/commit/push/merge. Task complete.
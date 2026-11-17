# Regression work log

## Current autonomous regression cycle

- Retained process-bound manual verification; automatic SQL correlation has not passed. No expiry or restart guard was bypassed.
- Corrected browser registration navigation to accept either the matching-player chooser or general picker.
- First rerun reached creation form, then timed out: the no-match error snackbar has no auto-dismiss duration and intercepts Save clicks. Test now uses its normal Close button (no forced click or application security change).
- Extended runner with `-TestFilter` for focused reruns. Historical results append to ignored `artifacts/history.jsonl`.
- Existing actual-data player-list GETs remain intercepted to avoid gender-normalization writes. No password recovery is permitted.
- Browser registration/create/claim/logout/login/logout passed after selector and snackbar handling fixes.
- Extended the existing valid process binding to the user's expressly authorized development regression scope without changing PID, start time or expiry.
- Added synthetic role provisioning with exact identity/initial-role checks, league snapshots, division/membership, sign-in/locking, teams/scoring/standings, King/Queen, Manager/Player/anonymous authorization, session and public preview tests.
- Fixed SQL assertion helper array nesting; no application change was needed for that test failure.
- Implemented independently guarded orphan-only cleanup; players, league graphs, role fixtures and anything referenced remain retained.
- Confirmed three application defects with failing API/database tests: accepting foreign-league division assignments (200 rather than 400), splitting a new Create Teams batch into separate scramble numbers, and returning division display names as codes in standings.
- Fixed those three paths in ScrambleDataController. Backend Debug build passed (0 errors, 10 pre-existing warnings); Angular development and production builds passed with the existing Browserslist warning.
- Restarted only the existing Visual Studio project debug session. Demonstrated stale PID rejection. Independently verified the new running process's effective Development/localhost/LeagueScramblerDev/integrated-auth settings through read-only Windows process APIs; preserved original authorization expiry and explicitly retained failed SQL correlation status.
- All three targeted application regression tests passed after rebuilding/restarting. Added matching-player browser claim coverage, role-overposting rejection, invalid login, self sign-out ownership, lock-status GET purity and cross-league King/Queen score rejection for the final suite.
- Supplementary read-only browser tests passed actual client standings reductions/drop-lowest, recalculation without compounding, original-total/name tie-breaking and Gold top-player ordering.
- Existing-player browser confirmation exposed a second test interaction defect: notification dismissal was attempted behind an already open dialog. Moved dismissal before opening the dialog and made dismissal tolerate a naturally disappearing notification. No application change or forced click was used.
- Final focused browser rerun passed both new-player and existing-player registration/claim workflows. Latest distinct results across the full run and supplementary runs: 30 passed, 0 failed, 2 blocked (approved legacy credential unavailable; controlled server ticket-expiry/renewal unavailable). The earlier full run had 26 passed, 1 test-interaction failure and 2 blocked; its failed result remains preserved rather than rewritten.
- Safe orphan cleanup independently verified and removed exact synthetic User IDs 1129, 1132, 1133, 1173 and 1174. Cleanup receipts are retained in an append-only local ledger, including when a later preview replaces its summary receipt. All linked users, players, role fixtures and league graphs remain retained.
- All harness JavaScript syntax checks and git diff --check passed. System Node remains 10.16.3. The final report lists actual results, retained data and unresolved security/deployment risks; it does not declare production readiness.

See generated reports and inventory for actual execution results and retained exact synthetic IDs. No test result implies production readiness.

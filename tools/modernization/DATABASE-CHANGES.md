# Authorized Development database changes and cleanup

Scope: **localhost / LeagueScramblerDev only**, Windows authentication, verified actual SQL machine name, compatibility level **130**. User grant: `leaguehub-modernization-development-2026-11-22`, recorded in DEVELOPMENT-AUTHORIZATION.md. The connection string, credentials, password hashes/salts, cookies and reset tokens are not included in this report.

## Changes performed

|Runner|Owned records and operations|Final result|
|---|---|---|
|PlayerImportCheck|Prefixed leagues, six initial players plus an explicitly created profile, divisions, memberships, a team and historical player/score relationships. Actual controller calls add/import, detect duplicates/concurrency, change Gold/Silver/No Division, rename globally while preserving IDs/history/other memberships, create a missing profile without automatic enrollment, then enroll explicitly.|Passed; owned records removed and preexisting snapshot restored.|
|ScheduleCheck|Two prefixed leagues, 17 teams and league divisions. Actual saves/retrieval/edits, 80-game fixtures, scores/protected games, events, calendar conflicts, nonoverlapping later schedules and division/date-scoped replacement.|Passed; schedules/events/scores/teams/divisions/leagues removed. Event schema already existed; no DDL performed.|
|Account-backed HTTP/browser runner|Per complete run: three new accounts (Admin, Manager, registered Player), two prefixed leagues, 21 new players, 16 season teams, divisions, league/user/player mappings; actual login LastLogin updates; member/profile operations; 80 saved games plus 16 appended through the browser; draft/finalized/retrieved/modified Scrambler teams, player links/byes/round scores and created-team score updates; owned reset issuance, failed-send restoration, password/token consumption and replay/concurrency rejection.|Final run passed. All inserted accounts, memberships, games, scores, scrambles, byes, mappings, divisions, teams, leagues and players were removed in FK order.|

Every run uses a unique prefix and records inserted IDs. Account-backed run artifacts are under `tests/functional/artifacts/modernization/authorized-*/authorized-results.json`; final current-source direct reports are `accepted-player-results.json` and `accepted-schedule-results.json`. The final consolidated ID/cleanup inventory is `authorized-database-change-journal-final.json`: **22 run/report records, zero unresolved cleanup**. Earlier failed attempts remain evidence, not unexplained live fixtures.

No existing real user, password, role definition, player or league was deliberately edited. Existing role definitions were reused only by new synthetic accounts. HTTP requests used actual login/password verification and cookie middleware; no test route or production authorization bypass was introduced. Test credentials/cookies were passed to the browser via stdin, not arguments, logs or fixture files. Reset emails used local SMTP pickup only, and run-owned messages containing consumed synthetic tokens were removed. No external delivery occurred.

## Interrupted-run recovery

One launch inherited PowerShell Stop-on-native-stderr behavior. The intentional SMTP failure test wrote its safe diagnostic to stderr, causing the shell to terminate the runner before finally-cleanup. Its exact saved fixture IDs were recovered using `--cleanup-authorized`, after rechecking the grant, local SQL identity and every ownership prefix/reference. `authorized-http-ui-actions/cleanup-recovery-results.json` confirms cleanup; the original incomplete journal is preserved. The Node orchestration wrapper now captures child stdout/stderr directly, so this expected negative test cannot abort cleanup through PowerShell. Other failed test runs completed their own cleanup.

Cleanup refuses mismatched ownership and unrelated membership references. It uses recorded IDs and transactions rather than deleting globally by a loose name prefix. No identity sequence was reset; normal identity advancement from test insert/delete and rolled-back inserts is expected. No production, IIS or schema operation was performed.

## Integrity verification

Before: `authorized-development-before/`. Final after all current-source reruns: `accepted-database-after/`. The earlier `authorized-final-database-after/` comparison is also preserved.

`accepted-final-data-integrity.json` confirms **24 mapped tables, zero differences in counts, checked row hashes and column metadata, and identical foreign-key metadata**. Sensitive account/admin-secret values were deliberately not exported; account fingerprints cover identity/role keys, and all credential mutations were scoped to inserted fixture IDs. Existing historical membership/score queries retain the original fingerprints and 1,966 independently calculated teammate pairs.

## Defects found through writes

1. EF 10 inferred `UserRolesUserRoleId`, absent from SQL; the preserved EF 2 metadata has no such shadow property. The corrected relationship uses the existing UserRoleId FK. No schema change.
2. Current EF could not translate the old explicit-default MAX allocation or grouped representative query. Nullable MAX/coalesce and league-filtered client grouping preserve the legacy results; real retrieval fingerprints and save flows pass.
3. An untyped DBNull value prevented restoring an absent prior reset token after delivery failure. Typed SQL parameters preserve both null and nonnull prior tokens; both negative cases pass.
4. Concurrent requests reproduced two successful resets from the same token using the existing read/save pattern. Atomic token-checked UPDATE now permits exactly one success and one rejection in each of five real competing pairs. Only password hash/salt/token are updated; IDs, roles and other profile fields remain intact.

No data/schema migration script is necessary for the current checkpoint. Future schema scaffolding against the old migration snapshot must be reviewed separately; do not run automatic Migrate/EnsureCreated or production migrations.

# Proposed scoped Development mutation verification

Status: **explicitly authorized by the user on 2026-11-22** for the local LeagueScramblerDev modernization project, including adapting approval gates and cleaning up fixtures. See DEVELOPMENT-AUTHORIZATION.md. This supersedes the earlier pending approval gate; do not request repeat approval. The read-only host remains the default; the explicit `--authorized-development` test mode enables the documented synthetic operations after checking the actual local SQL identity. Production, IIS and deployment are outside the grant.

## Target and ownership

- Only Windows-authenticated `localhost / LeagueScramblerDev`, verified against the actual machine name and SQL compatibility level 130 before execution. Never production or real league records.
- A run-specific unpredictable prefix identifies every new account, league, player and team. Capture all inserted IDs in an artifact journal immediately after each committed fixture transaction.
- At most three synthetic accounts (administrator, manager, ordinary user), generated test passwords held in memory, and a small synthetic player/team/division/league dataset. Existing accounts, passwords, roles and memberships are never changed. Existing role definitions are reused, not modified.
- Reuse the already inspected PlayerImportCheck and ScheduleCheck fixture runners for persistence coverage where practical. They own separate prefixed leagues and retain their fresh approval/process/DLL/config hash/expiry gates. Existing tools may require local TLS and runtime-proof adjustments for the separate .NET 10 process before running.
- No schema creation or migration, no production config, no external email. If schedule event storage is absent, skip event persistence and report that limitation rather than creating a table.

## Operations to verify after approval

1. Create only the synthetic accounts and fixture leagues/divisions/players/teams, through existing application models and guarded fixture transactions. Authorize the synthetic manager only for the synthetic league.
2. Exercise real login/logout and cookie claims through the migrated HTTP middleware. Test administrator/assigned manager/unassigned manager/ordinary/anonymous boundaries. Never issue a fixture cookie for an existing real account.
3. Use actual membership APIs for immediate addition, duplicate prevention, import confirmation, name/division editing and removal, scoped strictly to owned IDs. Verify unrelated league membership and primary keys/history remain intact.
4. Save/retrieve/edit synthetic schedules, including later-date additions, same-calendar-period conflict rejection, division-specific replacement and completed-score protection. Never replace any preexisting real league schedule.
5. Save/retrieve/modify synthetic scrambles and scores using existing generation rules and validate retained memberships, restrictions and result relationships.
6. Test reset consumption/single use only for a synthetic account, with the exact application sender routed to a local SMTP pickup directory. Reset tokens and passwords stay out of logs/screenshots/reports.
7. Capture desktop/mobile actual authenticated browser evidence against the modern backend. Do not intercept the APIs being verified.

## Cleanup and evidence

Delete only IDs recorded as created by this run, verify their ownership prefix and check for unrelated references first. Remove dependent owned score/schedule/membership records in the schema's FK order within transactions, then owned identities. Do not reseed identity counters or delete by a broad prefix alone. If references or ownership are uncertain, stop cleanup and report the remaining IDs for review. Verify all preexisting mapped-table row fingerprints, counts and FK metadata afterwards; document concurrent external changes separately. Persist sanitized test results and the cleanup journal, without credentials or row payloads.

Approval for this plan authorizes only these Development fixture operations and owned cleanup. It does not authorize deployment, production changes, commits, pushes, migrations or edits to real accounts/leagues.

# Development database authorization — framework modernization

Grant ID: **leaguehub-modernization-development-2026-11-22**

The user explicitly authorized this session to read, create, update, delete and clean up data in the local **LeagueScramblerDev** database for comprehensive framework modernization integration, authentication, persistence, migration and regression testing. This includes synthetic users, players, leagues, memberships, schedules, scores, scrambles, tokens and related records, and adapting existing test approval gates. This authorization persists across resumptions of this task unless the user revokes it; no artificial expiry or repeat permission request is imposed.

Before database operations, verify the configured local SQL target and actual DB_NAME()/server machine identity. Prefer run-owned synthetic records, journal inserted IDs, preserve preexisting records and remove only verified owned fixtures. Test credentials/tokens must not appear in diagnostics. Use local SMTP pickup, not external delivery.

This grant does **not** authorize production database/config/account access or modification, IIS changes, commits, pushes, merges or deployments. It does not authorize broad deletion, identity reseeding or unreviewed destructive schema changes. Follow the scoped fixture/cleanup plan in INTEGRATION-APPROVAL.md while recognizing that approval is now granted.

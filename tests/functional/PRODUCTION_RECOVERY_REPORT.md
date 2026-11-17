# Production SQL connection recovery — 2026-11-17

## Confirmed root cause

The deployed ASP.NET Core application had no effective LEAGUESCRAMBLER_DB_CONNECTION setting. Elevated read-only inspection of production process 4056 confirmed it was absent. The IIS app-pool and ASP.NET Core application environment configuration also contained no value; Machine/User environment settings and the production/ancestor .env files were absent.

DataContext.OnConfiguring now requires that environment variable and throws when it is missing. Login's early invalid-model response does not access SQL, explaining why an empty JSON object produced the expected JSON error while structurally valid requests reached the failing database path. DataConnection reads the same setting but has no found caller; normal login/registration use DataContext.

The production error route can obscure the underlying failure. Application Event Viewer contained ANCM start/stop information, not a captured handled database exception stack. Stdout logging was disabled and no stdout directory existed; diagnostic logging was not enabled. Do not claim an Event Viewer exception that was not observed. Before correction, the public database-backed GetLeagues GET returned 500; after correction it returned 200 JSON. The missing live environment value, source behavior and before/after recovery establish the configuration fault; this was not a SameOrigin 403 problem.

## Correction performed under explicit incident authorization

Changed only C:\inetpub\wwwroot\NewLeagueScrambler\web.config: added the application-scoped LEAGUESCRAMBLER_DB_CONNECTION environment variable to the existing aspNetCore configuration. The value was privately recovered from the previously active production connection configuration and verified before use. It targets localhost / LeagueScrambler with the existing SQL-authenticated production credential. Neither its password nor the full connection string is printed in this report. This is deliberately not the development Windows-authentication connection and not LeagueScramblerDev.

No database schema/data/account/permission/password changes, application source changes, binary replacement, publish-profile changes, Publish, commit, push, merge or deployment of a new build occurred. Existing unrelated configuration was checked unchanged. IIS automatically restarted the application after the environment configuration update; no bindings/certificates/app-pool identity were changed.

Configuration safeguards stopped initial helper attempts before writing when XML self-closing serialization differed and the file-replacement call failed. The final atomic replacement succeeded. File replacement initially changed the security descriptor; the original descriptor was then restored from the atomic original and exact equality verified. The final configuration contents remained unchanged during permission restoration. No unrelated ACL changes were retained.

## Backup and rollback

Verified original configuration backup:

C:\Users\Allport\AppData\Local\LeagueScramblerRecovery\20261117-181517\web.config.before

An atomic-original copy is alongside it. Both preserve the pre-correction configuration; SHA256 was verified before replacement. Restoring the original would remove the repaired connection setting, so do so only if deliberately reverting this incident fix. No SQL restore or Data Protection key replacement is involved. Protect these recovery files and do not publish them.

## Executed post-fix verification

- Elevated read-only inspection of new production process 20956, started 2026-11-17T18:16:23.0782910Z: effective connection present; server localhost; database LeagueScrambler; existing SQL authentication. Not LeagueScramblerDev.
- SQL connection opened successfully to the intended database. SELECT DB_NAME() returned LeagueScrambler. Metadata-only permission checks confirmed SELECT/INSERT/UPDATE rights on dbo.User without modifying records.
- GET https://allportsleaguehub.com/api/Login/isauthenticated: 200, false.
- GET https://allportsleaguehub.com/api/ScrambleData/GetLeagues: 200 application/json, valid array with 10 records; record contents were not printed. This same API returned 500 before the fix.
- Original web.config permissions restored and configuration hash unchanged by ACL restoration.
- LoginController, Startup, LeagueAccess, DataContext and DataConnection in the development repository have no source diff from baseline. Shared legacy administration password implementation and authentication configuration were not modified.

An automated invalid-credentials POST login probe was rejected before execution by automatic approval review with 'blocked by policy'; no more specific reason was provided. It was not retried or worked around. No account was used/created by that probe. There was no automated registration or recovery-email test.

## Owner verification needed

1. Sign in normally at https://allportsleaguehub.com using an existing account. Do not disclose credentials. Confirm navigation and normal account state.
2. Use the existing shared administration unlock UI and confirm access; no password change is required or requested.
3. Do not create a disposable production account. Registration uses the repaired database connection and its required permissions were checked; actual account creation remains untested. Check registration only if a real new registration is needed or the existing-account login result suggests another issue.

Login and registration should now reach the intended working database, but a successful real login/registration is not claimed until manually verified. Preserve the new production-only database environment setting when copying future Desktop-staged builds: replacing web.config with an unconfigured generated copy would remove the fix. The existing FolderProfile Desktop staging/manual-copy workflow was not changed.

Sanitized incident evidence is under ignored tests/functional/artifacts/production-recovery. It contains no full connection string or password. Private recovery backup/candidate directories are outside the website and repository.

# Running the restored application in Visual Studio

This document explains how the original LeagueScrambler functionality is preserved on the security branch without exposing its administration password to the browser.

## First-time development setup

1. Open the solution in Visual Studio and check out the security branch.
2. Copy `.env.example` to `.env` in the same directory as `Startup.cs`.
3. Supply a valid SQL Server connection string in `LEAGUESCRAMBLER_DB_CONNECTION`. Credentials were removed from code and are not committed. If you use Windows authentication, a locally configured connection string such as `Server=localhost;Database=LeagueScrambler;Trusted_Connection=True;` may be suitable. If you use SQL authentication, supply your own new user ID and password.
4. Supply the SMTP settings if you need password recovery email functionality.
5. Select an HTTPS launch profile in Visual Studio, trust the local development certificate if prompted, and start the application. The launch settings have been updated to use HTTPS. The authentication cookies deliberately cannot be used over HTTP.
6. To create leagues using the administration password without an account login, make sure the database has exactly one Admin account, or set `LEAGUESCRAMBLER_LEGACY_ADMIN_EMAIL` to the email of the account that should own those leagues.
7. To test password reset emails, set `LEAGUESCRAMBLER_PUBLIC_BASE_URL` to your actual HTTPS website origin; a placeholder or retired hostname will not deliver a working reset link.
8. New registrations automatically obtain a Player session so they can create or claim a player profile securely, without allowing anonymous database writes.
9. Registered Players may remove their own sign-in records; anonymous visitors may not delete other players' sign-ins.
10. Restore the original SQL database schema and data. The existing `Passwords` table must contain the administration password used for old management screens. It remains server-side, never returned by the API. Do not use the former published password on a public system.

## Existing administration flows

* Regular Admin and Manager logins still grant management access.
* On Scrambler and Team Scores, users who know the legacy administration password can enter it and select **Unlock Administration**.
* The password is checked by `POST /api/Login/VerifyAdminPassword`, which creates a separate secure, HTTP-only administration session cookie that expires after six hours of inactivity and renews while you're actively using the site.
* Legacy admin sessions do not replace ordinary player logins. After an unlock, users can add players, remove players, add leagues/divisions, save settings, enter scores, and save team scrambles subject to server permissions.
* The old `GetPassword` endpoint is disabled. The web app no longer calls it.
* Score recalculation now uses POST instead of a GET request with side effects.
* Logging out clears both the ordinary session and any temporary administration cookie.

## Test before merging

1. Launch using HTTPS, verify that the home page and public player lists still load.
2. Add a league with a real Admin login.
3. Log out, unlock via the administration password, and add a player to a test league.
4. Use the same unlocked session to delete the test player, create a division, and save league settings.
5. Enter and recalculate test match scores from Team Scores.
6. Generate and save scrambles, including King and Queen rounds.
7. Confirm an anonymous request without an unlock cannot modify scores, divisions, league settings, or leagues.
8. Confirm a Player login alone cannot modify those resources.
9. Confirm a wrong administration password is rejected and repeated failed attempts are throttled.
10. Confirm the admin cookie expires after six hours of inactivity, renews during active use, and that logout clears it.
11. Validate the player claim, password recovery, and sign-in flows separately.
12. Check Visual Studio build and Angular build logs. These have not been run by ChatGPT in this environment.

## Still required before the site goes public

This is a compatibility and initial security patch. Additional work is required for CSRF protection on authenticated changes, authorization by league ownership, migrating the legacy administration password away from plaintext database storage, and upgrading unsupported ASP.NET Core 2.2 and Angular 7 dependencies. The project must not be deployed on the public internet until these issues have been reviewed and tested.

Previously committed secrets remain visible in Git history even after removing them from this branch. Rotate all live credentials before using any of those systems. No credentials have been rotated automatically.

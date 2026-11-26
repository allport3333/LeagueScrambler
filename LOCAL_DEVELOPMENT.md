# League Hub local development

Use `master` in `C:\Users\Allport\source\repos\Allport's League Scrambler`. All features share one normal application at `https://localhost:5001` and one database, `LeagueScramblerDev`. Keep feature-specific development servers out of the workflow.

## First-time development setup

1. Open the solution in Visual Studio, select **Allport_s_League_Scrambler**, and press F5. If a terminal is already running League Hub, stop it with Ctrl+C before starting Visual Studio. Use Shift+F5 to stop a Visual Studio debugging session.
2. Trust the localhost certificate if prompted. The application uses Windows integrated authentication to connect to the existing local `LeagueScramblerDev` database. Development mail goes to `%LOCALAPPDATA%\LeagueHub\PickupSharedDev\mail`.
3. Run `node tools/pickup/test-development.cjs` from the repository root to check Home and public Pickup discovery. See the [Pickup development notes](tools/pickup/README.md#shared-development) for the terminal launch command and Google configuration. The automated Pickup browser scripts start and stop an isolated test host.

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
13. As Admin or password-based administrator, check score updates, scrambles and sign-in locks across two leagues.
14. As Manager, verify editing an assigned league works and an unassigned league returns HTTP 403.
15. On an unlocked league, sign in a player from its roster. Then confirm a repeated same-day sign-in is rejected. Lock the league and confirm a new sign-in is blocked; unlock it and confirm sign-in works again.
16. Confirm a player cannot be signed into a league they are not assigned to, even using a direct API request.

## Password reset verification after the server is available

* Request a new password reset email and confirm its link works within one hour, changes the password, and cannot be reused.
* Check that requests with a missing token or a null token do not reset any account.
* Check invalid/modified, legacy (old-format), and expired tokens are rejected with a useful error.
* Previously emailed reset links issued before this change intentionally require a new request. The ResetToken column does **not** need a new migration.

* Check that a password reset email's new token is already stored before the link is received. Simulate an SMTP failure and confirm the server logs the failure, the API returns the same account-neutral message, the previous reset link remains valid if it was still current, and retrying is possible.
* Confirm the password-reset form refuses mismatched password/confirmation values and successfully submits a matching pair.

## New login and recovery protection to verify

* Try a valid and an invalid email in Forgot Password; both should display the same account-neutral message. Only the real account should be emailed.
* Try more than 8 recovery requests from one IP in 15 minutes and confirm HTTP 429. A given email address should not receive more than one reset email per two minutes.
* Try 12 incorrect login credentials from one IP; further attempts should receive HTTP 429 until the counter expires, even after a successful login was made earlier in the window.
* Try more than 20 reset-password submissions from one IP within 15 minutes; subsequent requests should return HTTP 429, and the reset page should explain the temporary limit.
* Check `GetLockSignInStatus` with no existing lock row: it should return unlocked without writing a row. Confirm `SetLockSignInStatus` still creates or changes the row.
* Send parallel failed login attempts and parallel password-recovery requests for the same address; the counters/cooldowns should be enforced consistently. A successful login should not erase failed guesses from another request.
* If hosting behind IIS, a tunnel, or another reverse proxy, verify the server sees distinct client IPs before relying on per-IP limits. Otherwise everyone may share one temporary lockout.
* Test a database failure during reset issuance: the server should log it without indicating whether the target email is registered.
* The counters are in-process and not shared between machines; they are basic protection, not proof of resilience against distributed abuse.

## Highest-priority first-boot regression checks

* Build the ASP.NET Core project and Angular frontend on `master`.
* Sign in as Admin/Manager and verify editing an assigned league, creating/deleting a test player, and saving a new scramble and scores.
* In an anonymous browser session, preview a scramble without unlocking administration: team previews should display, but `GenerateScramble` must not write team rows to SQL. Then unlock and verify the generated scramble can be saved.
* Check ordinary and legacy-password administration login/logout, player registration and claiming, public player sign-in, signed-in player removal, league lock/unlock, and password recovery.
* Confirm `LEAGUESCRAMBLER_DB_CONNECTION`, SMTP values, public HTTPS reset origin, IIS/HTTPS certificate, and reverse-proxy client IP handling before public access.

## Still required before the site goes public

This is a compatibility and initial security patch. Additional work is required for CSRF protection on authenticated changes, authorization by league ownership, migrating the legacy administration password away from plaintext database storage, and upgrading unsupported ASP.NET Core 2.2 and Angular 7 dependencies. The project must not be deployed on the public internet until these issues have been reviewed and tested.

Previously committed secrets remain visible in Git history even after removing them from this branch. Rotate all live credentials before using any of those systems. No credentials have been rotated automatically.

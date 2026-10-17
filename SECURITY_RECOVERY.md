# LeagueScrambler security recovery checklist

This security branch contains functionality preservation for legacy administration screens as well as initial hardening. It has not been built or browser tested in the connected environment. Do not deploy it publicly until the remaining security gaps are addressed.

## Changes in the branch

1. The current SQL connection string is loaded from `LEAGUESCRAMBLER_DB_CONNECTION`, not committed source files. Old SQL login credentials were removed from `DataContext.cs`, `DataConnection.cs`, and `App.config`.
2. The previously committed JWT signing key is removed from `appsettings.json`.
3. Login cookies, including temporary administration cookies, are HTTPS only.
4. Public `GetPassword` requests now receive HTTP 410. No Angular component uses that endpoint. Instead, entering the existing league administration password sends it to the server via `POST /api/Login/VerifyAdminPassword`.
5. The verification endpoint checks the existing Passwords database table, applies basic per-IP throttling, and creates a separate, short-lived administration cookie (six hours of inactivity, renewed during active use). The actual administration password is not returned to the browser. The separate cookie preserves normal player login.
6. Role-based league management policy supports Admin, Manager, and a temporary legacy administration credential. Score updates, player and league changes, division edits, and settings changes require the policy.
7. Manager writes to existing leagues now additionally require a matching UserLeagues assignment (including scrambles, team scores, league settings, divisions, league sign-in locks and player changes). Admin and temporary password-based administration retain global access.
8. The public sign-in endpoint now rejects requests for players outside the league, existing sign-ins on the same date, and leagues marked locked. It still permits sign-in without creating an account.
7. Existing Angular screens now display password unlock controls before administration operations. Team Scores management can be unlocked as well.
8. Score recalculation now uses POST because it changes stored standings. The Angular client has been updated accordingly.
9. Password recovery links use HTTPS. Logout clears the temporary administration cookie as well as the ordinary login.
10. HTTPS local Visual Studio launch settings and a safe `.env.example` have been added.

## Password reset safety

* The reset endpoint rejects missing, blank, malformed, expired, and legacy untimed tokens **before** querying the User table. A missing token cannot accidentally match an account with a null ResetToken.
* Newly issued password reset links include an issuance timestamp plus 256 bits of random data, stored in the existing ResetToken text column. They expire after **one hour**; successful use clears the token.
* Previously issued 64-character reset links will no longer work. Request a new password reset link after upgrading.
* The reset page now clearly identifies expired/used links. The current API route, existing password hashing, and database schema remain unchanged.
* Rate limiting for account login and password reset requests is still future work. This change does not substitute for a build or runtime check.

* Password-reset emails are now sent only after the new token has been saved successfully, preventing emailed links from preceding database persistence. If sending the email fails, a conditional database rollback restores the prior reset token (only if no newer token replaced it). The request still reports an error so the user can retry.
* The reset-password Angular form now checks that the password and confirmation match before sending the API request, with an inline mismatch message.

## Manual steps required for development

Read [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). Copy the example environment values into a gitignored `.env`, supply your own SQL and SMTP connection details, launch with HTTPS, and load your existing development database. The application will not connect to SQL until you supply a connection string. No old published credential has been reused.

## Required checks before merging

* Build the solution and Angular frontend in Visual Studio.
* Run the manual test matrix in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md), including public viewing, player login, Admin/Manager login, old password unlock, league creation, division creation, player changes, scrambles, and scores.
* Check that anonymous users and ordinary Player accounts cannot mutate league data without administration rights, except the limited, authenticated first-time player-profile creation and a player's removal of their own sign-in.
* Confirm registration can create or claim a player and that the new account is signed in correctly.
* Confirm password-only league creation assigns the league to a real Admin account, or produces a clear configuration error when no owner can be identified.
* Confirm six-hour administration session expiry, active renewal, and logout behavior.
* Verify the HTTPS certificate and reset-password links work at the eventual deployment hostname.
* Rotate any existing passwords previously committed, and do not treat removal from the current branch as removal from Git history.

## Remaining blockers before a public relaunch

* Add anti-CSRF validation for every state-changing cookie-authenticated endpoint, including the legacy administration session.
* Review and verify per-league authorization across all remaining database write paths. Manager write endpoints covered by this patch now check the existing UserLeagues assignment. Admin and password-based LegacyAdmin remain global as intended.
* Replace the legacy administration password stored in plaintext in the Passwords table with a stronger server-stored password hash or migrate fully to account-based administration.
* Review and secure remaining routes with state changes, including any GET handlers that write data.
* Upgrade the out-of-support ASP.NET Core 2.2 and Angular 7 stack.
* Add automated regression and authorization tests. No running server or database is connected to this review.
* Investigate old SQL and token credentials embedded in prior public commits and assume they may have been exposed until proven retired or rotated.

## Behavior to verify during functional testing

* An anonymous visitor can sign in a player belonging to an unlocked league.
* A locked league rejects all new player sign-ins even if a direct API request bypasses Angular.
* The same player cannot sign in twice on the same date for the same league.
* An Admin or LegacyAdmin can manage multiple leagues as before.
* A Manager can edit an assigned league but receives HTTP 403 for a league absent from UserLeagues.
* A Manager can create a new league and is linked to it; cannot take over an existing unassigned league.
* The existing day-of-league UI restriction is still a client-side rule. Server-side enforcement of league-day scheduling requires a defined admin override policy; do not infer it from a missing/false lock row.

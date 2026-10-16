# LeagueScrambler security recovery checklist

This security branch contains functionality preservation for legacy administration screens as well as initial hardening. It has not been built or browser tested in the connected environment. Do not deploy it publicly until the remaining security gaps are addressed.

## Changes in the branch

1. The current SQL connection string is loaded from `LEAGUESCRAMBLER_DB_CONNECTION`, not committed source files. Old SQL login credentials were removed from `DataContext.cs`, `DataConnection.cs`, and `App.config`.
2. The previously committed JWT signing key is removed from `appsettings.json`.
3. Login cookies, including temporary administration cookies, are HTTPS only.
4. Public `GetPassword` requests now receive HTTP 410. No Angular component uses that endpoint. Instead, entering the existing league administration password sends it to the server via `POST /api/Login/VerifyAdminPassword`.
5. The verification endpoint checks the existing Passwords database table, applies basic per-IP throttling, and creates a separate, short-lived administration cookie (20 minutes). The actual administration password is not returned to the browser. The separate cookie preserves normal player login.
6. Role-based league management policy supports Admin, Manager, and a temporary legacy administration credential. Score updates, player and league changes, division edits, and settings changes require the policy.
7. Existing Angular screens now display password unlock controls before administration operations. Team Scores management can be unlocked as well.
8. Score recalculation now uses POST because it changes stored standings. The Angular client has been updated accordingly.
9. Password recovery links use HTTPS. Logout clears the temporary administration cookie as well as the ordinary login.
10. HTTPS local Visual Studio launch settings and a safe `.env.example` have been added.

## Manual steps required for development

Read [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). Copy the example environment values into a gitignored `.env`, supply your own SQL and SMTP connection details, launch with HTTPS, and load your existing development database. The application will not connect to SQL until you supply a connection string. No old published credential has been reused.

## Required checks before merging

* Build the solution and Angular frontend in Visual Studio.
* Run the manual test matrix in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md), including public viewing, player login, Admin/Manager login, old password unlock, league creation, division creation, player changes, scrambles, and scores.
* Check that anonymous users and ordinary Player accounts cannot mutate league data without administration rights.
* Confirm the 20-minute admin session expiry and logout behavior.
* Verify the HTTPS certificate and reset-password links work at the eventual deployment hostname.
* Rotate any existing passwords previously committed, and do not treat removal from the current branch as removal from Git history.

## Remaining blockers before a public relaunch

* Add anti-CSRF validation for every state-changing cookie-authenticated endpoint, including the legacy administration session.
* Enforce per-league authorization instead of allowing all Admin/Manager/legacy administration sessions to access all league records.
* Replace the legacy administration password stored in plaintext in the Passwords table with a stronger server-stored password hash or migrate fully to account-based administration.
* Review and secure remaining routes with state changes, including any GET handlers that write data.
* Upgrade the out-of-support ASP.NET Core 2.2 and Angular 7 stack.
* Add automated regression and authorization tests. No running server or database is connected to this review.
* Investigate old SQL and token credentials embedded in prior public commits and assume they may have been exposed until proven retired or rotated.

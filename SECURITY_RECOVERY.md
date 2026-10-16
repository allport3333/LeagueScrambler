# Security recovery checklist

This branch is an initial hardening pass, not approval to relaunch.

## Before any deployment

1. Rotate every database password exposed in this repository, including any historical hosting credential, even if you believe the server is retired. Do not reuse the old values anywhere.
2. Review and rotate any JWT signing key previously committed. If tokens are used, supply a new private key using a secure configuration provider, not appsettings.json.
3. Configure the environment variable LEAGUESCRAMBLER_DB_CONNECTION on the application host. The application intentionally fails to start when it is missing. Do not commit local connection strings.
4. Require TLS and verify the public site supports HTTPS, including password reset links. Secure cookies will not work over plain HTTP.
5. Ensure old forgotten password links and database reset tokens cannot still be used.
6. Review every authorization path and test role permissions, including whether a Manager can access only leagues they administer. This patch enforces roles but does not yet enforce league-specific ownership.
7. Add CSRF mitigation to cookie-authenticated mutations. Angular requests and ASP.NET Core actions must use a compatible antiforgery strategy.
8. Replace client-side admin password flows with login and server-managed authorization. The legacy GetPassword endpoint now returns HTTP 410 and unauthenticated admin actions will be denied. The existing UI still expects that old behavior.
9. Upgrade unsupported ASP.NET Core 2.2 and Angular 7 dependencies, and validate build, database migrations, and packages with Visual Studio before relaunching.
10. Add tests for anonymous users, Player, Manager, and Admin roles, including score recording, league administration, registration, recovery, player claim, and scheduled events.
11. Review all remaining APIs, including Get methods that write to the database, for authorization and side effects.
12. Review historical commits for secrets. Deleting a value from the current branch does not erase its history. Treat every published secret as compromised.

## Changes in this first pass

* Database connection values are read from LEAGUESCRAMBLER_DB_CONNECTION.
* Hardcoded old database connection examples are removed from current source.
* The published JWT key is removed.
* Authentication cookies require HTTPS.
* Legacy password disclosure endpoint is disabled.
* Sensitive league mutation routes require an Admin or Manager role.
* Player claiming requires sign-in, and cannot claim a player for another user ID.
* Password reset emails now use an HTTPS URL. Confirm this hostname has valid HTTPS before using it.

## Important current limitations

The master branch remains unchanged until this PR is merged. No .NET build or browser testing has been run in the connected GitHub environment. This branch intentionally changes behavior: anonymous administrative operations stop working until the frontend is updated to use login authorization. This is safer than exposing an administrative password, but users may see errors. Role-only authorization is not sufficient for multi-league isolation. Do not deploy this branch without tests and a second security pass.

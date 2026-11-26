# Google sign-in configuration

League Hub uses its existing account cookie and adds one external association per account in dbo.GoogleAccount. The SQL script GoogleAccount.sql is additive. It requires no changes to existing account rows or player history. Apply it to a confirmed Development database before testing with Google. Review and apply it to the existing production SQL database only during an approved release. With both configuration values absent, password authentication works without this table.

Set **Authentication:Google:ClientId** and **Authentication:Google:ClientSecret** using the project's .NET User Secrets store for Development. The environment equivalents are **Authentication__Google__ClientId** and **Authentication__Google__ClientSecret**. On IIS, provision them using protected server configuration. Use a newly rotated secret. Register the test user in Google Auth Platform while the consent screen is in Testing mode.

The callback is /signin-google on the origin the user started from. Use HTTPS and the registered host and port. The middleware uses state, a correlation cookie, and PKCE. League Hub requests openid, email, and profile. It stores the stable Google identifier and League Hub user ID, and uses verified email and names when opening a new account. Tokens are not stored. To connect an existing account, sign in to League Hub first and use Account > Connected Accounts. To disconnect Google without a password, use the existing Forgot Password flow to establish a password first.

Before enabling this in production, publish the approved Privacy Policy and Terms of Service, set their effective date at release, and confirm the configured Google test account can sign in successfully on both Development origins.

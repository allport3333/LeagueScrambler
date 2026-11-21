# Staging and rollback procedure (preparation; not a deployment authorization)

Status: draft acceptance procedure. The application is still being migrated. Do not use these steps to deploy an incomplete checkpoint. No staging or production service has been changed.

## Required server verification

1. Inventory Windows Server/IIS versions and confirm they meet the selected .NET 10 hosting requirements. The local SDK installation does not establish production server readiness.
2. Install the supported .NET 10 Hosting Bundle/ASP.NET Core Module using a separately authorized maintenance procedure. An ANCM update can affect other IIS applications; coordinate any required restart. Do not invoke an installer or restart from migration tests.
3. Create a separate staging IIS application, hostname, directory and application pool with **No Managed Code**, an appropriate dedicated identity and HTTPS binding. Do not point it at the existing production directory.
4. Grant the pool only required read/execute access to the package, and narrowly scoped write access to its own diagnostics/Data Protection directories. Keep secrets and key material outside static web content.
5. Configure the actual trusted reverse proxy, forwarded headers and HTTPS behavior. Do not trust arbitrary forwarded headers. Verify secure cookie behavior behind the actual hosting arrangement.

## Package and configuration

- Publish from the modernization worktree only after final acceptance, into an explicit isolated artifacts directory. Do not invoke the repository's existing production publish profiles.
- Use the selected supported Node version for the reproducible frontend restore/build and the isolated .NET SDK for backend restore/publish. The final migration build instructions must specify exact commands and output paths after those projects are converted.
- Include freshly built Angular assets, `manifest.webmanifest`, icons, `ngsw.json` and the generated service worker. Verify the IIS/ASP.NET static handling preserves no-cache revalidation for app-shell/PWA metadata, while never caching authenticated API responses.
- Configure connection strings and SMTP through the established secret mechanism. Staging must point to an explicitly verified Development clone, never production by default. Do not copy a secret into a report, command transcript or tracked configuration.
- Set the trusted password reset origin to the staging hostname during authorized staging email tests. Production must use `https://www.allportsleaguehub.com`. Use synthetic mail pickup/transport for routine tests; do not send reset mail to real recipients.
- Provision and persist an appropriate Data Protection key ring and application discriminator. Test cookie compatibility with synthetic accounts. If old sessions cannot be read, document required sign-in; do not replace accounts or password hashes.

## Database review before staging

The migration is intended to retain the existing schema, primary keys and relationships. No automatic production migration is permitted. Compare the modern EF model and generated SQL with the verified existing schema, including SQL Server compatibility level 130. Review any proposed schema script independently; no `EnsureCreated`, destructive recreation or unattended `Database.Migrate` is acceptable.

Use a clone for mutation tests and retain a before snapshot. Record test ownership and delete only proven synthetic records. A transaction or test label is not permission to modify a real league. Revalidate database identity at test startup.

## Acceptance sequence

1. Confirm the deployed assembly/runtime and frontend build identifiers match the intended package; verify actual API route availability, not only static page loading.
2. Verify administrator, manager, ordinary-user and unauthenticated access with authorized synthetic identities. Verify login/logout, recovery, token expiry/single use, and HTML/plain email.
3. Compare representative real Development read results and ordered data fingerprints with the legacy baseline. Review any concurrent legitimate changes instead of treating every hash difference as migration damage.
4. Exercise real frontend/backend integration for player edits/imports, schedule creation/save/edit and score protection, Scrambler save/retrieve/modify/scoring, K/Q results and permissions. Intercepted HTTP fixtures are supplementary evidence.
5. Compare desktop/mobile screenshots with baseline, including Material controls, dialogs, date input, player grids and print layouts.
6. Verify PWA installation/update/offline behavior and logout boundaries on the staging origin. Ensure stale service-worker assets cannot mask a backend/frontend contract mismatch.
7. Review the final installed dependency audit, unresolved risks, logs and acceptance report before considering production authorization.

## Rollback

Before any separately authorized release, preserve the complete previous published backend/static package, environment configuration reference, IIS binding/pool settings and Data Protection keys. Keep a database backup appropriate to the approved operation; framework rollback alone cannot reverse data transformations. No schema change is currently authorized.

For a failed staging deployment, stop only the dedicated staging application/pool through an authorized operation, restore its previous package/configuration, and verify its runtime/API routes. Do not stop unrelated processes or modify the production application. If future schema changes are proposed, require a reviewed forward/backward compatibility plan before deploying them.

For an eventual authorized production rollback, use the reviewed previous package and compatible configuration, verify key persistence and API contracts, and explicitly account for Angular service-worker cached assets. Verify that metadata revalidation obtains the restored manifest and that users are not left with a new frontend against an old backend. Restore database backups only under separate explicit authorization and a reviewed data-loss assessment.

## Current limitations

No server hosting inventory, modern staging package, actual IIS deployment, production cookie compatibility or production smoke test has been verified. Production deployment is not recommended at this intermediate migration checkpoint.

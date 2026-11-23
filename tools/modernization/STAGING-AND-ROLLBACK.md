# Staging and rollback procedure (preparation; not a deployment authorization)

Status: **the accepted package is serving trusted HTTPS at `https://127.0.0.1:8086/`**. The staging administrator journal records a committed IIS update. The current managed session cannot read administrative IIS configuration or write to the deployment directory. A database-backed read passed over IIS. Exact worker SQL identity and account-backed acceptance remain pending. See STATUS.md and RESULTS.md for verified outcomes.

## Verify the staging worker before testing with an account

In elevated Windows PowerShell, use the dedicated pool's current worker PID. If there is no worker yet, load the staging homepage first.

```powershell
Add-Type -Path "$env:windir\System32\inetsrv\Microsoft.Web.Administration.dll"
$iis = New-Object Microsoft.Web.Administration.ServerManager
try { $iis.ApplicationPools['LeagueHubStagingPool'].WorkerProcesses | Select-Object ProcessId }
finally { $iis.Dispose() }
```

After an IIS request to `/api/ScrambleData/GetLeagues`, use local SQL Server security/session metadata in an authorized SSMS connection. Substitute the staging PID. Confirm the observed login and database before writes. A pooled connection can disappear when the worker recycles.

```sql
DECLARE @StagingWorkerPid int = 0; -- Replace with the dedicated pool's worker PID.
SELECT DB_NAME(s.database_id) AS database_name, s.original_login_name, c.auth_scheme
FROM sys.dm_exec_sessions AS s
JOIN sys.dm_exec_connections AS c ON c.session_id = s.session_id
WHERE s.host_process_id = @StagingWorkerPid AND s.is_user_process = 1;
```

After confirming `LeagueScramblerDev` and the pool identity, use a run-owned synthetic fixture with a known password. Record the login response status and generic body without copying the request, cookie or credentials into logs. Verify the cookie, authenticated role and league, logout and persistence across a recycle of only the staging pool. Clean up by fixture ID and verify the Development baseline. The existing IIS evidence includes a synthetic unknown-account check only, which reaches the user lookup path and returns the expected generic failure.

## Deploy or roll back the visual restoration

The candidate ZIP is `tests/functional/artifacts/modernization/visual-restoration/handoff-release/leaguehub-visual-restoration-staging.zip`. Its SHA-256 is `129464CCC9E4F389E075B8FFEE6D0073CB5F05E819309D6EA33B5C643647DD25`. The accompanying manifest verifies all 92 files. The 69 non-browser files match the accepted package, and the 11 service-worker asset hashes match the rebuilt browser directory.

1. From the administrator session, verify the staging site's dedicated pool, root path, and existing configuration. Verify the new ZIP and extract it to a fresh worktree artifact directory. Preserve the accepted review ZIP and existing rollback copy.
2. Capture a new backup of the live staging tree and its staging-specific settings. Confirm the deployed application binaries match the candidate manifest. With this frontend-only release, replace only `C:\inetpub\wwwroot\LeagueHubStaging\ClientApp\dist\browser` with the clean, verified browser tree while the **dedicated staging pool** is stopped. Preserve the existing IIS pool variables, site bindings, web.config, and key material. Start the staging pool and verify the browser subdirectory against the candidate manifest.
3. From a fresh browser context, verify that `https://127.0.0.1:8086/` references `main-IHY7SZHO.js`. Confirm the live Angular service-worker metadata matches the new package and test the update from an existing staging session as well. Run the account-backed staging checks after verifying the worker's SQL identity.
4. If rollback is needed, stop only the staging pool, restore the saved live browser directory, restart that pool, and verify the prior hashed script and service-worker metadata in a fresh context.

## Administrator setup

Open 64-bit **Windows PowerShell 5.1** as Administrator using the same Windows account that will browse staging. Run these commands from the existing worktree. The first command inspects IIS, ports, and Development SQL without applying changes. Run the second only after reading the preflight. Use the same options in both runs.

Windows PowerShell currently has `AllSigned` at LocalMachine scope and rejected the unsigned file. Sign the reviewed script with an approved code-signing certificate trusted by this machine and confirm `Get-AuthenticodeSignature` reports `Valid` before running the commands under that policy.

```powershell
Set-Location -LiteralPath 'C:\Users\Allport\source\repos\LeagueHub-modernization'
.\tools\modernization\Set-LeagueHubStaging.ps1
.\tools\modernization\Set-LeagueHubStaging.ps1 -Apply
```

- The default HTTPS port is 8086. If preflight finds a conflict, pass the same free `-HttpsPort <port>` to both commands. The script checks the existing site, physical path, exclusive pool use, IIS bindings, TCP listener, HTTP.sys certificate reservations, runtime, handler and configuration overrides. It updates only the target site's bindings and dedicated pool. It keeps a previously stopped site or pool stopped.
- The SQL probes compare an encrypted connection with certificate validation, an encrypted local connection that skips certificate validation, and Windows authentication over shared memory. These tests use the invoking account through Windows PowerShell's SQL client. They can distinguish a certificate validation failure from a failure that also affects the trusted-certificate probe. They do not prove that the IIS worker can authenticate or that the deployed SQL client behaves identically. The optional `-TrustLoopbackSqlCertificate` switches the application to the encrypted loopback connection only when strict validation fails and the encrypted diagnostic succeeds. Windows-integrated authentication and the local database guard still apply.
- SQL administration rights on the invoking account are separate from Windows elevation. The script checks the local default instance and Development compatibility level 130. It preserves existing `db_datareader` and `db_datawriter` memberships in `LeagueScramblerDev` and plans only grants those roles and existing direct grants do not cover. A missing login or user is created with individual object grants from the application allowlist. Preflight rejects unexpected explicit permissions and roles, disabled logins, database ownership, and mappings outside Development. For an existing login, the mapping audit uses SQL Server's `sp_helplogins` security metadata and stops if the audit is incomplete. The invoking account needs permission to run that audit, in addition to login management and Development database control.
- Apply stores the dedicated certificate in Local Machine Personal and its public copy in the invoking account's Trusted Root store. Use a browser that trusts this Windows user store. Other Windows users and browsers with independent trust stores may need to trust the same public certificate separately. The script does not edit shared trust, SQL TLS settings, firewall rules, or other sites. Run one staging configuration operation at a time.

After apply, verify the redirect and TLS without disabling client validation. These examples use the default port and force the loopback IPv4 address while validating the name `localhost`.

```powershell
curl.exe --noproxy '*' --resolve localhost:8085:127.0.0.1 -I http://localhost:8085/
curl.exe --noproxy '*' --resolve localhost:8086:127.0.0.1 --fail --silent --show-error --output NUL https://localhost:8086/
```

Check that the first response redirects to `https://localhost:8086/`. Correlate a database-backed staging request with the worker's effective Windows identity and Development database before fixture writes. Then run the account, authorization, recycle and browser acceptance checks in RESULTS.md. If startup or SQL access fails, capture the staging response and staging-specific events before changing permissions.

### Roll back an administrator setup run

Use the printed `rollback.json` under `tests/functional/artifacts/modernization/iis-staging-admin-*/`. It records original site and pool state, the prior binding and managed environment values, the SQL changes planned for this run, commit flags and the certificate thumbprint. For interrupted runs, compare the journal with actual state before reverting, since a change may have completed before its flag was saved. Preserve changes made after the recorded run.

1. In IIS Manager, confirm the staging site ID matches the journal and stop only `LeagueHub Staging` and `LeagueHubStagingPool` if running. Remove the exact `AddedHttps` binding if this run added it. Restore the site HTTP binding from `Http`. If that binding was a wildcard, keep staging stopped pending review of loopback isolation. Restore the pool CLR, bitness, identity and profile loading from the matching journal fields.
2. In IIS Manager's Configuration Editor, open `system.applicationHost/applicationPools` and the environment variable collection for `LeagueHubStagingPool`. Restore recorded `PoolEnvironment` entries. Remove only managed entries absent from that snapshot. The managed keys are `ASPNETCORE_ENVIRONMENT`, `DOTNET_ENVIRONMENT`, `ASPNETCORE_HTTPS_PORT`, and `LEAGUESCRAMBLER_DB_CONNECTION`. Keep unrelated variables and the staging worker's existing Data Protection keys.
3. Connect to local `LeagueScramblerDev` with Windows authentication and verify the SQL machine, database and authentication scheme again. In a transaction, revert only applied entries from `AddedGrants` using `REVOKE <Permission> ON OBJECT::[dbo].[<Table>] FROM [IIS APPPOOL\LeagueHubStagingPool]`. Drop the Development user only if this run created it. Drop the server login only if this run created it and server metadata confirms it has acquired no other use. Preserve all pre-existing grants and principals.
4. Remove the journaled thumbprint from the same Windows user's Trusted Root store only if this run added the trust. Remove the thumbprint from Local Machine Personal only if this run created the certificate and no IIS binding or HTTP.sys reservation still uses it. Verify the dedicated staging friendly name before deleting the certificate.
5. Restore the recorded pool and site running states and verify the original staging HTTP URL. The package stays in place. Use the verified live-file backup only if the deployment files changed in a separate operation.

## Accepted package and deployment sequence

For PWA releases, verify the built browser directory as one version. Check every entry in `ngsw.json` against its on-disk SHA-1, and include the application shell, worker script, web manifest and icons. Preserve the root registration scope and the `/ngsw-worker.js` URL so existing installations can update. Verify the deployed HTTP headers for `ngsw.json`, `ngsw-worker.js`, the web manifest and a deep-link shell. They must revalidate. Fingerprinted scripts and styles can be immutable. API responses use `no-store`.

Prepare the release in a separate directory before it becomes available. When a deployment is authorized, switch the staged site to the verified release as a unit or take the dedicated application offline for the complete replacement. Keep previous fingerprinted files available where the hosting strategy supports it so open clients can finish loading their assigned version. When rolling back, publish the previous working browser contents as a new worker version, for example by adding a unique release identifier to `appData` in its manifest. Angular can ignore a manifest it has already installed. Reverify the rollback shell and every hashed asset, then regenerate the package integrity manifest. Routine releases and rollbacks require no browser cache clearing.

Use a clean extraction of **`tests/functional/artifacts/modernization/leaguehub-angular22-net10-staging-review.zip`** as the package source. `authorized-accepted-package-manifest.json` lists every relative file, size and SHA-256. Local Release and Debug builds, account-backed SQL/HTTP/browser tests, data cleanup and production-worker regressions passed.

A transport/review archive is also prepared: **leaguehub-angular22-net10-staging-review.zip** in the same modernization artifact root. `staging-review-archive.json` records its size/SHA256; `staging-review-archive-verification.json` confirms 92 files with web.config at the archive root and the browser shell at its configured path. Creating this local archive did not deploy it.

The latest local integrity check verified the review ZIP's SHA-256 and all 92 archived files against the accepted manifest. The loose package folder has a different `web.config`. Use a fresh extraction of the verified ZIP as the staging source, and apply staging-specific configuration to that extraction when the deployment is authorized. Preserve the existing folder for review.

For the current authorized staging recovery, compare the live file hashes before replacing files. The comparison found zero differences. Preserve the verified `live-file-backup/` and `accepted-extraction/` under `tests/functional/artifacts/modernization/iis-staging-resume-f4dc3339/`. An elevated session should capture the dedicated site's binding and pool settings and locate its key ring before configuration changes. Continue with the remaining items below:

1. Inventory supported Windows/IIS and .NET shared runtimes; arrange an authorized .NET 10 Hosting Bundle/ANCM installation at **10.0.15 or newer supported .NET 10 servicing**. Verify Microsoft.NETCore.App and Microsoft.AspNetCore.App 10.x are present. Coordinate any restart because ANCM installation can affect other applications. None has been installed on a server during this task.
2. Create a dedicated staging HTTPS **hostname/site at its root**, separate physical directory and 64-bit No Managed Code app pool/identity. A same-host virtual subapplication needs separately verified Angular base href/PathBase/service-worker scope and cookie isolation; do not assume the root-built package supports it unchanged.
3. Provision external staging configuration and an approved Development clone/test database connection. Validate the actual target. The modern driver encrypts SQL by default: use a trusted SQL certificate; test-only loopback TrustServerCertificate settings are not a production default. Keep SQL compatibility at 130 unless separately reviewed. **No schema migration, Migrate/EnsureCreated or identity/account conversion is required.**
4. Persist Data Protection keys outside static content with narrow app-pool ACLs, record the application discriminator and plan for renewed login if old sessions do not transfer. Keep backups of the previous package/configuration references and keys for rollback. Never deploy synthetic fixture keys or SMTP pickup contents.
5. Copy the entire reviewed package, including backend/deps/runtimeconfig/web.config and ClientApp/dist/browser. Verify manifest hashes after copying. Do not deploy only Angular assets against an older backend. The retained historical DLL filename still targets net10.0; generated web.config is already consistent with it.
6. Verify startup/deep links, known API routes, actual role/league boundaries, login/logout/reset, player/import flows, schedule saves/conflicts/score protections, Scrambler/scoring/KQ/dashboard, printing and PWA update/logout boundaries using approved synthetic identities. Repeat the test target guard before writes. Capture staging evidence; no production identities or data should be used.
7. Test native-device install/printing and any designated SMTP inbox only under the relevant authorization. Password-reset origin is intentionally trusted public www.allportsleaguehub.com; do not widen it from request headers or send staging links to real accounts. Local tests used pickup, never external delivery.
8. Review acceptance and rollback results before seeking any production release authorization. Production environment compatibility and existing IIS session survival are not established by local tests.

The preceding read-only/initial package details below are preserved as historical preparation evidence; deploy neither an older package nor an incomplete checkpoint merely because its folder exists.

## Local package checkpoint — 2026-11-22

**Latest reviewed local output:** `tests/functional/artifacts/modernization/staging-package-net10-final/`, rebuilt after the source-path compatibility fix. `staging-package-final-verification.json` confirms 92 files, zero forbidden source/config/tool content, and exact parity with the tested backend assembly and production Angular shell. Earlier package folders below are preserved historical artifacts. Development-only Node lifetime helpers are not shipped. This final package remains undeployed and its existence does not waive the pending mutation/IIS acceptance gates.

An isolated framework-dependent Release package has been built at `tests/functional/artifacts/modernization/staging-package-net10/`. It contains 92 files, generated IIS web.config (ANCM V2 / in-process), net10.0 runtimeconfig and the verified Angular 22 browser assets under `ClientApp/dist/browser`. Final inventory contains **zero .env/node_modules/test/tool/.git paths**. The tested backend assembly and browser index hashes match the published files. Evidence: `staging-package-inventory-final.json`, `package-tested-assembly-parity.json`, `net10-publish.log`. Earlier inventory incorrectly matched the artifact parent path's `tests` segment; only the corrected relative-path inventory is valid.

The retained backend filename is `ASP.NET Core 2.2 with Angular 7.dll`; this is historical naming, not the actual target framework. Its runtimeconfig is net10.0. Do not rename it ad hoc or copy only frontend assets: frontend and backend must be deployed as one compatible reviewed package. The generated web.config references this filename.

To reproduce locally from the modernization worktree in PowerShell, after reading STATUS.md:

```powershell
$env:PATH = (Join-Path (Get-Location) 'tests/functional/.tools/node-v22.23.5-win-x64') + ';' + $env:PATH
& .\tests\functional\.tools\dotnet10\dotnet.exe build "Allport's League Scrambler/Allport's League Scrambler.csproj" -c Release
# Build Angular production normally, or use the already verified asset checkpoint without rerunning migrations.
# The SkipFrontendBuild option is safe only when dist/browser is the verified current production bundle.
& .\tests\functional\.tools\dotnet10\dotnet.exe publish "Allport's League Scrambler/Allport's League Scrambler.csproj" -c Release -p:SkipFrontendBuild=true -o tests/functional/artifacts/modernization/staging-package-net10-next
```

Do not invoke existing production publish profiles. The Angular build requires the documented Node version, not the machine's legacy Node 10. global.json pins the portable SDK version; command-line builds are verified, compatibility with an older Visual Studio installation is not established.

Staging requires a supported .NET **10 Hosting Bundle, at least tested servicing level 10.0.15**, including ANCM and the matching shared runtime; newer supported .NET 10 servicing should be assessed at deployment time. The package's net10.0 runtimeconfig uses framework roll-forward, not automatic adoption of .NET 11. Inventory the actual Windows/IIS host against Microsoft's current supported OS matrix before installation. Hosting reference: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/?view=aspnetcore-10.0.

The modern SQL driver encrypts connections by default. Provision a valid SQL certificate and approved trusted connection configuration. Loopback TrustServerCertificate settings in verification utilities are not application defaults and must not be copied into Production. EF is explicitly configured for database compatibility level 130; do not change the server's level or apply migrations. No database schema migration is required by the current source checkpoint.

Inventory and preserve the old IIS Data Protection key location, ACLs and application discriminator before any release. Offline fixed-application-name fixtures prove cookie format compatibility, not that old production cookies will survive changed content roots/discriminators. Plan for a renewed login unless staging demonstrates preserved session compatibility. Preserve user IDs/password hashes/roles regardless; do not require account recreation. The two cookie schemes remain secure/HTTP-only and retain their existing lifetimes and authorization policies.

SMTP secrets and LEAGUESCRAMBLER_DB_CONNECTION remain external configuration; no .env is shipped. Production password reset uses trusted `https://www.allportsleaguehub.com`; staging verification uses local pickup rather than sending to people. Configure a separate HTTPS hostname/app pool, logs and key persistence; verify proxy/forwarded headers against known proxy addresses, never arbitrary headers. Keep static browser files at the configured dist/browser path and revalidate worker metadata during both deployment and rollback.

**Not ready for deployment:** authenticated account-backed browser/persistence/reset-consumption tests still require the fresh scoped fixture approval in INTEGRATION-APPROVAL.md. No IIS server, real SMTP delivery or native-device PWA installation has been verified. The package is for review, not a deployment recommendation.

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

A modern reviewed local package and authenticated Development acceptance are complete. Server hosting inventory, actual IIS deployment, production cookie/key compatibility, native device/inbox acceptance and production smoke testing remain unverified. Those are staging/release gates, not permission to deploy. Production deployment is not recommended before staging acceptance.

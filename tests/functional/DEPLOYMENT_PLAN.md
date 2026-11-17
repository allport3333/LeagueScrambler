# Deployment and rollback plan — NOT EXECUTED

Status 2026-11-17: **NO-GO** until the evidence gates below are met. This document is preparation, not authorization to deploy, edit IIS/Cloudflare, read/write production SQL, alter credentials or run migrations. Administrators may be actively entering scores. Do not promise uninterrupted deployment or session continuity without testing it.

## 1. Required evidence before scheduling

1. Review ADMIN_COMPATIBILITY_AUDIT.md and STATE_CHANGING_ENDPOINTS.md. Baseline functional results remain 34 pass/0 fail/2 blocked from the prior complete run. Read-only and isolated-filter tests do not replace successful legacy unlock testing.
2. Obtain a safely authorized dev-only legacy test credential, valid process-bound isolation and three administrator browser contexts. Execute the manual matrix against localhost/LeagueScramblerDev. Do not retrieve the stored production password or change the frozen system to satisfy testing.
3. Resolve missing/ambiguous legacy-only league ownership configuration if multiple Admin accounts exist. Confirm whether the three people have accounts at all; do not infer account count from headcount. LEAGUESCRAMBLER_LEGACY_ADMIN_EMAIL must designate the approved existing owner without role/account modifications. Its production value is unknown and must be reviewed privately by its owner later.
4. Establish intended supported domains and actual mapping: Cloudflare zone/DNS and redirects, edge TLS and SSL mode, origin hostname/Host preservation, IIS bindings/site/path, hosting model, app-pool identity and trusted forwarding. Read-only public HEAD results establish only four reachable roots. No tenant-wide proxy trust or cookie change should be used as a compatibility shortcut.
5. Reproduce the actual trusted proxy topology in authorized development/staging configuration and verify valid same-origin writes plus rejection of untrusted forwarded headers. Do not send modifying probes to production. Flexible/HTTP-origin scheme mismatch, stripped source headers and cross-host API rewrites are unresolved launch blockers.
6. Review remaining CSRF/form-compatible management routes. Frozen legacy/session/logout risks must be explicitly accepted by the owner or addressed only under separate direction. Unsupported runtime/package vulnerabilities, prior secret exposure and missing identity-verification/concurrency coverage remain security concerns; this plan does not approve them for public deployment.
7. Validate cookie/session compatibility from the deployed release to the candidate and back using synthetic dev sessions. Preserve effective Data Protection key material, application identity and cookie options. Do not log/export private key values. Confirm losing one administrator's cookie does not evict the other two. Server-ticket expiry and actual legacy success remain blocked until executed.

## 2. Build and assemble the release locally

Use the existing Visual Studio solution/security branch and the existing **FolderProfile.pubxml** workflow: publish Release to **C:\Users\Allport\Desktop\LeagueScrambler**, review the staged output, and only later manually copy reviewed files to IIS under separate approval. Publishing to the Desktop requires explicit authorization first; the production copy is a second approval boundary. No new source checkout/project or profile change is needed. Capture exact commit plus uncommitted diff, SDK/runtime/Node versions, package locks and artifact hashes. No Publish or copy was performed.

Independently inspected profile targets (all Release/FileSystem, DeleteExistingFiles=true):

| Profile | Configured destination | Meaning |
|---|---|---|
| FolderProfile.pubxml | C:\Users\Allport\Desktop\LeagueScrambler | User's normal staging workflow; deletion affects Desktop staging ONLY, not IIS |
| Direct Publish.pubxml | C:\inetpub\wwwroot\NewLeagueScrambler | Direct deployment target; not the user's normal staging workflow; do not invoke |
| FolderProfile1.pubxml | C:\inetpub\wwwroot\LeagueScrambler | Separate IIS target; do not confuse with FolderProfile.pubxml or invoke |

Preserve all profiles and targets unchanged. The staging deletion risk is loss of prior staging output; archive any needed staged release first. It is incorrect to classify FolderProfile.pubxml itself as direct-to-production publishing. The separate manual IIS copy carries the production replacement risk.

Current evidence: the focused management-CSRF backend no-restore Debug build passed with 0 errors/10 existing warnings; Angular development and production builds passed earlier. Four management actions now use SameOrigin; final focused browser/SQL tests passed and one full suite completed with 36 passed/0 failed/2 accepted blocked, all original 34 passes re-established. See FINAL_VERIFICATION_REPORT.md. A reviewed Release publish artifact still needs validation; Debug/functional success is not Release/publish or manual legacy compatibility verification.

**Publish trap:** csproj PublishRunWebpack unconditionally executes npm install, then the production Angular build. Do not casually run dotnet publish or the VS Publish button under a no-install assumption. First prepare/review a reproducible publish procedure using the existing pinned packages, separately addressing that target if necessary. BuildServerSideRenderer=true also triggers the SSR command and may include node_modules. SSR necessity must be confirmed; do not ship a large unnecessary tree or silently change the production hosting model. No publish target was changed in this audit.

The reviewed artifact should contain the complete publish output rather than a hand-selected set of individual DLLs:

- Application and views assemblies (`ASP.NET Core 2.2 with Angular 7*.dll`), deps.json/runtimeconfig.json and required managed/native dependencies matching the publish mode.
- Generated publish web.config with real ANCM processPath/arguments; do not deploy source `%LAUNCHER_PATH%` / `%LAUNCHER_ARGS%` placeholders. Preserve/review effective hosting behavior rather than overwriting IIS settings.
- Appropriate nonsecret appsettings files and required static content/wwwroot, ClientApp/dist JavaScript/CSS/assets/index files with matching hashed bundles.
- Only required server-side assets/dependencies when SSR is intentionally enabled and verified. Debug PDBs/logs are not automatically required for public hosting.

Exclude development .env/connection settings, tests/functional, portable Node/browser tools, test credentials/manifests/reports/traces, source maps containing sensitive code if not intended, node_modules unless explicitly required by SSR, .git, local VS files and private keys. Inspect the staged artifact for exclusions; Git ignore alone does not guarantee publish exclusion. Never replace production secret/configuration files with local files.

## 3. Configuration and database compatibility

| Item | Development | Production requirement (not inspected/changed) |
|---|---|---|
| ASPNETCORE_ENVIRONMENT | Development | Production; developer errors disabled |
| DB connection | localhost / LeagueScramblerDev / current Windows identity | Privately confirmed intended live DB and least-privilege IIS/app identity; never copy the Dev connection |
| Public base URL | https://localhost:5001 | Approved canonical HTTPS recovery origin, chosen from verified supported domains; aliases need not share cookies |
| Legacy owner email | No nonempty local .env value found | Existing approved owner if fallback is ambiguous; no account creation/role migration |
| SMTP | Not exercised; recovery blocked | Existing privately managed credentials/TLS; delivery requires separately authorized test |
| Secrets loading | dotenv probes ancestors and overwrites environment by existing options | Privately verify effective .env location/precedence under actual process working path; preserve current production settings |
| Cookies/Data Protection | Local Debug session | Preserve key persistence/access, identity, scheme/options; verify old/new cookie decryption without exposing keys |
| Origin/proxy | Direct HTTPS localhost | Effective Request.Scheme/Host match browser; restrict proxy trust/Host routing; do not blindly trust CF/X-Forwarded headers |

No migration is introduced by the targeted security/controller/origin fixes. Source scan found no startup Migrate/EnsureCreated/seed operation. This is not proof that the live production schema matches the current branch. A DBA/owner must compare schema against a safely isolated backup/approved metadata process before release; this audit did not query production. No migration, restore, automatic initialization or shared-password conversion is planned. Preserve Passwords, account roles, owner links, score histories and reset state exactly. If a schema difference appears, stop and plan it separately rather than experimenting on production.

## 4. Backups and active-administrator coordination

Before any later deployment, the authorized operator must:

1. Arrange a short maintenance window with all three administrators. Ask them to save work and stop scoring/scrambling; verify no unsaved changes. Do not replace a live DLL/JS mixture while administrators continue writes.
2. Obtain a protected, timestamped backup of the full current deployment, its manifest/hashes, nonpublic configuration, IIS/app-pool/binding settings, and Cloudflare rule/settings inventory. No certificate/private-key export is required by this audit; follow the owner's existing secure recovery procedure.
3. Take a consistent production SQL backup via the authorized DBA workflow and verify it can be restored to an isolated environment. Keep the restore procedure ready. This is a future operator task, not an action performed here.
4. Verify existing Data Protection key persistence/access and backups under the existing identity without exposing key material. Replacing keys or changing application discriminator is not part of this release.
5. Record baseline read-only behavior and which canonical host each administrator uses. Have the complete previous artifact and original configuration immediately available. Assign one operator to deploy and one to validate/rollback.

## 5. Controlled release sequence (future, approval required)

1. Recheck go/no-go evidence and explicit deployment approval. Confirm backup completion and all three administrators ready.
2. Quiesce requests using the agreed IIS maintenance/app_offline procedure only during that authorized window. A brief interruption is expected; do not imply zero downtime on this single existing application.
3. Only after **separate approval for the production copy**, manually copy the complete reviewed Desktop-staged artifact into the intended IIS deployment as one coherent release, preserving approved production settings, database configuration, app identity, Data Protection keys, bindings and certificates. Back up the current IIS deployment first and retain a verified rollback copy. Do not use Direct Publish as a shortcut, copy local .env or run SQL operations.
4. Resume the application and inspect sanitized startup/hosting errors. Confirm HTTPS and correct host handling, absence of developer exception pages, and no reset emails or startup SQL changes. Host identity verification must not expose connection strings.
5. Confirm matching bundles/HTML at each intended hostname and verify Cloudflare/browser caching does not serve old index files with incompatible scripts. Cache rules for authenticated APIs must not cache Set-Cookie/user-specific responses. No blanket purge or Cloudflare change is assumed authorized by this document.
6. Each of the three administrators independently uses the existing supported workflow and privately enters the already-known shared password into the website. Do not record it in reports, automation, screenshots or HAR captures. Verify unlock, normal navigation, refresh and administration availability. Check ordinary-account-plus-unlock and legacy-only logout visibility. Do not tell someone to reset or migrate the password if unlock fails: stop and rollback.
7. Immediate production checks are read-only: existing league/division/roster/score/standings views and preserved session status. Do not create synthetic production records. Mutating validation was required in Dev before release; any live write must be a separately approved normal administrator operation, not an automated probe.
8. Confirm one administrator's logout does not disrupt the other two; do not run repeated bad-password attempts or expiry simulations while real administrators are working. Ask all three to acknowledge functionality before ending maintenance. Keep rollback available through an agreed observation period.

## 6. Rollback triggers and exact recovery order

Triggers: any administrator cannot unlock/login/logout normally; valid same-origin requests receive unexpected 403; any scoring/scramble regression, missing or inconsistent bundles, repeated 500s, key-decryption failures, unexpected database target, or unexplained record changes. Do not weaken origin checks, edit password rows/roles or modify cookies as an emergency workaround.

1. Stop further writes and tell all three administrators to pause. Preserve sanitized failure timestamps/statuses, affected feature and artifact identity; avoid secret-bearing logs.
2. Reenter the agreed maintenance mode. Restore the complete prior deployment artifact and its original approved configuration/identity, preserving original keys and IIS bindings. Do not cherry-pick DLLs or mix frontend releases.
3. Restore any specifically approved release-time cache/routing changes from the recorded baseline only if they were actually changed. Review before action; never reset the whole Cloudflare zone or replace certificates.
4. Resume and verify all three administrator workflows and read-only scores/standings. Confirm no local Dev setting was copied. Record rollback success/failure.
5. Do not restore SQL merely because binaries were rolled back: the planned release has no schema migration. A SQL restore would discard legitimate post-backup scores/registrations. If corruption or incompatible schema is confirmed, stop and obtain a DBA-approved recovery/reconciliation plan with explicit data-loss authorization; do not overwrite ongoing league activity.
6. Keep the failed artifact and sanitized diagnostics for development investigation. No password rotation, role changes or forced account migrations are included in rollback.

## Required operator decisions

Confirm intended domain mappings/proxy TLS mode; privately confirm legacy owner selection and production session-key continuity; supply an approved safe test credential or conduct the owner-operated manual check in an approved window; validate the three-administrator matrix; review remaining CSRF/unsupported-stack risks; approve a reproducible publish procedure and a maintenance/rollback window. Until these gates are resolved, **do not deploy**.

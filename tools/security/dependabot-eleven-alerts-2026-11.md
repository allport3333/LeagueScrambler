# Eleven-alert security review — November 21, 2026

Work is on `master`. The initial working tree was clean. No commit, push, merge, deployment, production configuration change, database mutation, real account change or external email was performed.

## Result

**Four new utility alerts are fixed locally.** Their effective manifests/restores no longer contain either named advisory. **The service-worker alert remains unpatched**, with current exposure assessed and tested. The earlier proxy-addr, Playwright and brace-expansion fixes remain installed and GitHub confirms their alerts are fixed. The earlier Forge, router and middleware alerts remain open.

Authenticated GitHub REST GETs retrieved every specified alert individually, including state, exact GHSA/CVE, affected range and manifest path. This supersedes the older six-alert report's inability to retrieve private records. The connector cannot read Dependabot endpoints; the existing local Git credential helper supplied authentication without printing or storing credentials. No alert was dismissed or changed. New fixes will require a reviewed push and GitHub rescan before their remote records can close.

## All eleven alerts

Locations: **FE** = `Allport's League Scrambler/ClientApp/package-lock.json`; **TEST** = `tests/functional/package-lock.json`; **IMPORT** = `tools/league-management/PlayerImportCheck.csproj`; **EMAIL** = `tools/ui-email-verification/UiEmailCheck.csproj`.

| Alert | Dependency | Exact advisory / CVE | Severity | Initial effective version | Patched version | Location | Actual exposure | Remediation | Remaining status |
|---|---|---|---|---|---|---|---|---|---|
|316|@angular/service-worker|[GHSA-qxh6-94w6-9r5p](https://github.com/advisories/GHSA-qxh6-94w6-9r5p), CVE-2026-54264|High|7.2.13|No Angular 7 patch; 20.3.25 / 21.2.17 / 22.0.1 on newer lines|FE|Production browser worker; credentialed asset redirects are the advisory's prerequisite|Preserved matching Angular tree and static-only configuration; executed the installed redirect method and actual PWA tests|**Mitigated but Not Patched / Requires Framework Upgrade**; GitHub open|
|319|Newtonsoft.Json|[GHSA-5crp-9r3c-p9vr](https://github.com/advisories/GHSA-5crp-9r3c-p9vr), CVE-2024-21907|High|12.0.2 direct|First fixed 13.0.1; selected 13.0.4|IMPORT|Verification utility; reads authorization JSON and serializes DTO/controller/snapshot reports|Updated direct reference; clean restore, DTO/JSON/controller fixtures and depth rejection passed|**Fixed Locally**; GitHub still open pending push/rescan|
|318|Microsoft.AspNetCore.App|[GHSA-6px8-22w5-w334](https://github.com/advisories/GHSA-6px8-22w5-w334), CVE-2019-0564|High|2.2.0 direct|First fixed 2.2.1; selected 2.2.7|IMPORT|Verification utility; constructs MVC/HTTP fixtures, no listening HTTP/2 server|Updated metapackage and runtime reference to existing installed 2.2.7; no production framework change|**Fixed Locally for this advisory**; legacy framework/transitive risks remain|
|325|Newtonsoft.Json|[GHSA-5crp-9r3c-p9vr](https://github.com/advisories/GHSA-5crp-9r3c-p9vr), CVE-2024-21907|High|12.0.2 direct|First fixed 13.0.1; selected 13.0.4|EMAIL|Verification utility; report serialization and transitive MVC JSON requirements|Updated direct reference; actual controller email sender and MIME/token tests passed|**Fixed Locally**; GitHub still open pending push/rescan|
|324|Microsoft.AspNetCore.App|[GHSA-6px8-22w5-w334](https://github.com/advisories/GHSA-6px8-22w5-w334), CVE-2019-0564|High|2.2.0 direct|First fixed 2.2.1; selected 2.2.7|EMAIL|Verification utility; constructs existing LoginController/HTTP/cache fixtures, no web listener|Updated metapackage and runtime reference; clean restore and real sender via local pickup passed|**Fixed Locally for this advisory**; legacy framework/transitive risks remain|
|296|proxy-addr|[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), CVE-2026-90711|Critical|2.0.8 already patched|2.0.8|FE|Development server through Express; not browser/.NET production server|Preserved prior pin; installed/lock/subnet spoof regressions passed|**Fixed; GitHub confirmed fixed**|
|313|playwright|[GHSA-7mvr-c777-76hp](https://github.com/advisories/GHSA-7mvr-c777-76hp), CVE-2025-59288|High|1.55.1 already patched|1.55.1|TEST|Automated browser installation/testing; affected privileged macOS installer download|Preserved matching test/playwright/core versions; TLS installer regression and audit passed|**Fixed; GitHub confirmed fixed**|
|303|node-forge|[GHSA-jc66-7q78-782g](https://github.com/advisories/GHSA-jc66-7q78-782g), CVE-2026-118782|High|0.10.0|Named advisory first fixed 1.4.1; current line 1.4.3 also addresses later issues|FE|Development self-signed certificate generation; named flaw is PKCS#12 import/PBE handling, not the application's production TLS|Retained compatible dependency tree and loopback/no-dev-SSL safeguards; no untrusted PKCS#12 import found|**Still Vulnerable / Mitigated but Not Patched**; parent/toolchain update required|
|295|@angular/router|[GHSA-ff3f-86qr-9cv3](https://github.com/advisories/GHSA-ff3f-86qr-9cv3), CVE-2026-101896|High|7.2.13|No old-line patch; 20.3.32 / 21.2.24 / 22.2.0|FE|Production browser dependency; this advisory's server-rendering DoS path is absent|Confirmed SSR remains disabled and unused SSR packages remain removed|**Requires Framework Upgrade**; SSR prerequisite currently inactive, GitHub open|
|294|brace-expansion|[GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p), CVE-2026-102276|High|1.1.22 already patched|Named advisory fixed 1.1.19; retained 1.1.22|FE|Development/build glob expansion|Preserved pin; all lock occurrences, ordinary globs and bounded hostile-pattern regressions passed|**Fixed; GitHub confirmed fixed**|
|293|webpack-dev-middleware|[GHSA-g84c-rxfj-3j2c](https://github.com/advisories/GHSA-g84c-rxfj-3j2c), CVE-2026-76844|High|3.5.1 and nested 3.4.0|GitHub record identifies 7.4.6; current major line also has fixes, no 3.x patch|FE|Development HTTP middleware; non-slash-terminated publicPath traversal|Confirmed localhost host, host checks enabled and slash-terminated servePath remain|**Mitigated but Not Patched**; builder/middleware migration required|

## Why the five new alerts appeared

The PWA added a direct Angular service-worker dependency. GitHub created alert 316 on November 20 UTC. The two newly added verification project manifests copied old production-era package references: import alerts were created November 21 at 01:03 UTC and email-tool alerts at 16:02 UTC. These are additional dependency paths exposed by recent additions, not regressions of the earlier three patched npm dependencies.

Both tools directly referenced Newtonsoft.Json 12.0.2 and Microsoft.AspNetCore.App 2.2.0; each path was inspected separately. Their common versions do not make the files interchangeable: the import utility reads approval files and checks real membership controller/EF contracts, whereas the email utility exercises the real sender with local SMTP pickup and generates verification reports.

## Utility remediation and compatibility

Newtonsoft.Json is retained because the import utility uses `JObject`, `JArray`, camel-case MVC serialization, typed approval parsing and snapshot/report JSON. The email utility only uses report serialization directly, but its legacy MVC dependency also brings Newtonsoft.Json transitively; deleting the direct reference would leave an older vulnerable transitive version. System.Text.Json is not built into the target framework. Rewriting serializers or adding a different framework merely to remove the direct reference would not be the smallest fix. Both tools now resolve 13.0.4, a patched netstandard-compatible 13.x release.

The broad ASP.NET metapackage was assessed for removal. The tools do not start Kestrel, but they instantiate actual production controllers deriving from `Controller`, plus HTTP, authorization, caching and EF types. A probe replacing the metapackage with current narrow MVC/HTTP 2.3.14 packages restored, but building failed because their transitive `System.Runtime.CompilerServices.Unsafe` 6.0.0 does not support netcoreapp2.2. This incompatible approach was rejected; no unsupported-target suppression or forced dependency override remains.

The compatible correction uses Microsoft.AspNetCore.App 2.2.7 and explicitly aligns `RuntimeFrameworkVersion` with 2.2.7, the installed shared framework used by the successful fixtures. Merely updating the ASP.NET package while leaving an implicit Microsoft.NETCore.App 2.2.0 reference retained the same named advisory through that other metapackage; the runtime-reference alignment closes that remaining named path. The selected patch also clears the older ASP.NET metapackage open-redirect advisory. It is a targeted repair, **not a claim that .NET Core 2.2 is supported or generally secure**.

The last 2.2 patch is 2.2.8, but it is not installed here. The named alert's minimum is 2.2.1; 2.2.7 permits verification using the existing machine runtime without changing installed runtimes or production. A supported-runtime migration remains the appropriate long-term work rather than installing another end-of-life runtime as part of this task.

Both projects accept an optional `BackendAssemblyPath` MSBuild property. Tests used a newly built current backend, rather than trusting an older artifact at the default path. Original default paths remain supported. PlayerImportCheck has an explicit `--fixtures <report-path>` mode for no-SQL dependency/JSON/controller checks; its original database integration mode and fresh, scoped authorization gates are unchanged.

### Remaining NuGet findings

Fresh restore/audit reduced each utility from **16 to 8 vulnerable package findings**, with **zero newly introduced vulnerable packages**. Neither named utility advisory remains anywhere in the audited graph. Eight older transitive package findings remain, including Kestrel.Core 2.2.0, IdentityModel/JWT 5.3.0, SqlClient 4.6.1, Http 4.3.0, Cryptography.Xml 4.5.0, Text.Encodings.Web 4.5.0 and RegularExpressions 4.3.0. They are recorded with exact advisories in `nuget-comparison.json`. Do not interpret these targeted four fixes as a clean audit or dismiss them because the utilities are local.

These utilities are siblings of the production project, not referenced by its build/publish graph. Their binaries are absent from the backend build and frontend distribution. Updating these project references does **not** update the production backend's separate Newtonsoft.Json 12.0.2 / legacy ASP.NET references. Those production dependencies still need a separate reviewed remediation/migration; this task did not silently alter them.

## Angular service worker assessment

The installed worker is 7.2.13, matching Angular core/common/router 7.2.13. Even the last 7.2.16 service-worker metadata requires matching 7.2.16 core/common and does not contain an advisory patch. Installing a worker from Angular 20+ beside Angular 7 would create an unsupported tree and is not an appropriate override.

The advisory concerns retention of sensitive original request headers while rebuilding cross-origin redirected asset requests. The [upstream fix](https://github.com/angular/angular/commit/47d68dc) changes a later `newRequestWithMetadata` implementation. The actual installed Angular 7 worker instead recreates a fresh request with `newRequest(res.url)`, without preserving the original headers.

The new exposure test evaluates the **installed unmodified worker's actual AssetGroup redirect method**, supplying fixture authorization/custom headers and `credentials: include`. Its reconstructed cross-origin request has neither header and uses the default same-origin credential policy. This is evidence about that specific legacy path, not a formal proof covering every worker path or future configuration. The official advisory range still matches the package; it is not marked patched or dismissed.

Current app configuration further limits exposure: explicit same-origin static files, no remote asset URL patterns, `dataGroups: []`, API navigation excluded, no application interceptor attaching Authorization to static files. Private API calls remain network-only. The production worker artifact is byte-identical to the inspected installed worker. Actual PWA regression tests preserve registration, cache behavior, offline rejection, install controls and updates.

Practical mitigation: retain these restrictions, avoid credential-bearing assets and cross-origin asset redirects, never add account/API data caching as a workaround, and review worker changes during upgrades. Do not disable PWA support or patch node_modules merely to quiet GitHub. The registry also reports two other service-worker policy/credential advisories for this old line; details remain in the targeted audit and reinforce the upgrade need.

## Prior fixes and remaining compatibility barriers

- Installed/locked proxy-addr 2.0.8, brace-expansion 1.1.22, and the matching Playwright 1.55.1 test/core packages remain. Targeted advisory queries report zero matches for these installed versions; all existing security regression assertions passed.
- Forge remains introduced by build-angular 0.13.8 → webpack-dev-server 3.1.14 → selfsigned 1.10.14 → node-forge 0.10.0. That parent requires the old Forge range. A top-level 1.x pin would leave the vulnerable nested copy; npm 6 lacks supported overrides. Current selfsigned 5.5.0 requires Node >=18 and has a different API, so substituting it under the old server is not a safe patch. The actual alert is now known to concern zero-iteration PKCS#12 MAC/PBE; this app's development certificate path does not import attacker-supplied PKCS#12 data.
- Router is in the production browser application, but production uses a static Angular SPA served by .NET. `BuildServerSideRenderer=false`, no active server-rendering target/middleware, and no SSR modules in the current install. Thus the named server request parsing path is not active. The separate empty-path SSR advisory also still matches; no Angular 7 patch exists.
- Middleware is introduced directly through the old builder and through webpack-dev-server. Its current line requires modern Node/webpack (latest 8.6.3 requires Node >=20.9 and webpack ^5.101). Old Angular CLI uses webpack 4 and different middleware APIs; installing a modern middleware alone is incompatible. Existing host safeguards were retained, and none of this Node development server runs in the .NET production host.

## Validation results

| Check | Result |
|---|---|
| Clean Git baseline / preservation | Passed; no unrelated existing changes to discard |
| Exact eleven GitHub records | Retrieved individually; three prior alerts confirmed fixed, eight records open before local changes |
| Clean NuGet restores | Passed for both tools with `--force --no-cache` |
| Effective NuGet graph | ASP.NET and runtime refs 2.2.7, Newtonsoft.Json 13.0.4; both named advisories absent; existing transitive risks remain |
| Full npm audits | Frontend still has 139 package findings (8 low, 31 moderate, 77 high, 23 critical); test runner audit has 0. No npm manifest/lock changes |
| Prior dependency security suite | Passed installed/lock versions, proxy spoofing, bounded brace cases, installer TLS flags, disabled SSR and development-host safeguards |
| Backend Release build | Passed; production application project/dependencies unchanged |
| Angular Development / production builds | Both passed; fresh build main hash matches current implementation |
| PlayerImportCheck | Built against current backend; 4 no-SQL JSON/DTO/controller fixture groups passed, including default-depth rejection |
| UiEmailCheck | Built against current backend; 4 origin/template/token/sender groups passed; actual MIME via local pickup, no network email |
| PWA production-worker suite | 8 groups passed: manifest/icons, actual registration/control, installability, private-cache isolation, offline failure, fixture roles/login/logout, roster/schedule printing and safe updates |
| Player browser/import/management UI | 12 groups passed; immediate additions, imports, division/name editing, role restrictions, error/retry and identity preservation via fixtures |
| Import parser/matching | 35 checks passed including TXT/CSV/XLSX/XLS, Unicode, malformed/limited files and matching; 0 external requests |
| Schedule management UI | 5 groups passed: create/import/existing workflows, preview/save, retry, overlap/replacement safeguards, export/reimport and protected scored games via fixtures |
| Schedule component regression | 18 groups passed |
| Scrambler/Home/rosters/date UI | 6 groups passed; generate/save/view/modify/print through fixture APIs, correct dashboard scores/navigation and date behavior |
| Whitespace | `git diff --check` passed; line-ending notices only |

Initial test failures were harness issues: the PWA print assertion referenced an old markup class; older schedule tests used the previous date-label capitalization; a relocated import suite needed its workbook fixture directory; the parser runner initially lacked the local browser-path environment variable. These were corrected without changing application behavior or weakening assertions. Test selector updates now check the current accessible date labels and actual printed matchup cells. The failed parser's owned test process was stopped; unrelated processes/services were not terminated.

MSBuild 9 copy transforms failed when output paths contained this repository's apostrophe. Build outputs were placed in the task-owned `%TEMP%/LeagueHubSecurity-20261121` directory; logs/results remain in repository artifacts. This was a build-output path issue, not a library compatibility fix.

### Verification boundaries

All browser write/authentication calls used synthetic fixtures; no real account login/password change, production operation, SQL write, physical-device install, native mobile printing or inbox delivery was tested. The original SQL integration runner requires fresh scoped authorization; no expired approval was reused. Its database persistence mode was not executed. No algorithm changes justified repeating the large Scrambler simulation suite.

## Follow-up migration scope

1. **Angular/build toolchain:** coordinated Angular core/common/router/service-worker/Material/CLI/TypeScript/Node migration. First fixed versions for the named worker and router advisories are listed above; they are advisory-specific minima, not a guarantee that all other advisories are clear. Angular 20 support ends November 28, 2026; prefer a planned current Angular 22.x patch target, with Material templates, date adapters, PWA caching/update behavior and all existing workflows retested. [Angular support policy](https://angular.dev/reference/releases).
2. **Backend and controller-based tools:** plan a supported .NET migration, including ASP.NET hosting, authentication, EF/query behavior, SQL provider and serializer compatibility. .NET 10 is the minimum currently supported stable LTS line; .NET 11 is also supported. An isolated tool TFM bump cannot be assumed safe while it loads production 2.2 MVC/EF assemblies. .NET Core 2.2 ended support in 2019; installing its last 2.2.8 patch would not resolve that status. [Microsoft support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core).
3. **Do not defer production JSON risk unknowingly:** the production project's separate Newtonsoft.Json 12.0.2 remains affected. Review a compatible application-level JSON update and its real API/database serialization tests separately; the tool-only changes do not propagate to it.

## Files and artifacts

Dependency changes: `tools/league-management/PlayerImportCheck.csproj`, `tools/ui-email-verification/UiEmailCheck.csproj`. Fixture-only extension: `tools/league-management/Program.cs`. New focused worker and reusable PWA-build wrapper: `tests/functional/scripts/security-service-worker.cjs`, `security-pwa-integration.cjs`. Existing PWA/schedule selectors were aligned with current markup. No frontend package manifest/lockfile or production application source/dependency file changed.

Detailed evidence: `tests/functional/artifacts/security-2026-11/`, including authenticated alert records, exact ranges, registry/upstream snapshots, before/after NuGet audits, full npm audits, dependency regression results, builds and fixture/browser reports. These ignored artifacts contain no stored GitHub/SMTP credentials or real reset tokens.

To rerun the no-SQL import mode, build the tool against the desired current backend using `-p:BackendAssemblyPath=<absolute-backend-dll>`, then run `dotnet <PlayerImportCheck.dll> --fixtures <report.json>`. The original three-argument SQL mode still requires its fresh runtime-bound approval file. Run the email utility with only an output directory; its transport is local pickup. Use the existing local Node 22 and `PLAYWRIGHT_BROWSERS_PATH` setup for the security/PWA browser scripts.

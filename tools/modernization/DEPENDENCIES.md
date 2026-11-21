# Dependency migration inventory

Baseline: 0d30bc9. Registry metadata is in artifacts/modernization/target-registry.json.

|Scope|Package|Original range|Classification|Approach|
|---|---|---|---|---|
|dependencies|@angular/animations|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/cdk|~7.3.7|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/common|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/compiler|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/core|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/forms|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/http|^7.2.13|No Longer Needed|No source imports/active authentication usage; remove unused dependency while preserving HttpClient/cookie flow.|
|dependencies|@angular/material|^7.3.7|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/platform-browser|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/platform-browser-dynamic|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/router|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|@angular/service-worker|7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|dependencies|ajv|^6.10.0|Potentially Unsupported|Inspect actual usage; avoid shipping unused JS. Preserve existing CSS appearance.|
|dependencies|angular-oauth2-oidc|^15.0.1|No Longer Needed|No source imports/active authentication usage; remove unused dependency while preserving HttpClient/cookie flow.|
|dependencies|bootstrap|^4.3.1|Potentially Unsupported|Only CSS is configured. Preserve legacy layout; evaluate compatible CSS-only replacement or retained static styles with explicit risk.|
|dependencies|core-js|2.6.5|Requires Upgrade|Replace obsolete IE-era shims with modern browser target support; preserve any required polyfills.|
|dependencies|jquery|^3.4.0|Potentially Unsupported|Inspect actual usage; avoid shipping unused JS. Preserve existing CSS appearance.|
|dependencies|popper.js|^1.15.0|Potentially Unsupported|Inspect actual usage; avoid shipping unused JS. Preserve existing CSS appearance.|
|dependencies|rxjs|^6.6.7|Requires Upgrade|Upgrade to 7.8.2 within supported peer range; preserve observable semantics.|
|dependencies|zone.js|^0.9.1|Requires Upgrade|Upgrade to 0.16.3; explicitly preserve Zone-based change detection.|
|devDependencies|@angular-devkit/build-angular|~0.13.8|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|@angular/cli|^7.3.8|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|devDependencies|@angular/compiler-cli|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|devDependencies|@angular/language-service|^7.2.13|Requires Upgrade|Sequential official core/CLI/Material schematics to 22.3.0; keep framework packages aligned.|
|devDependencies|@types/jasmine|~3.3.12|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|@types/jasminewd2|~2.0.6|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|@types/node|~11.13.4|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|brace-expansion|1.1.22|Requires Upgrade|Preserve security pins while old parents remain, then remove only after new builder prunes old chains.|
|devDependencies|codelyzer|^5.0.0|Requires Replacement|Replace with angular-eslint, preserving useful rule intent.|
|devDependencies|jasmine-core|~3.4.0|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|jasmine-spec-reporter|~4.2.1|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|karma|~4.0.1|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|karma-chrome-launcher|~2.2.0|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|karma-coverage-istanbul-reporter|^2.0.5|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|karma-jasmine|~2.0.1|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|karma-jasmine-html-reporter|^1.4.0|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|protractor|~5.4.2|Requires Replacement|Preserve useful browser scenarios through existing Playwright, retire obsolete runner.|
|devDependencies|proxy-addr|2.0.8|Requires Upgrade|Preserve security pins while old parents remain, then remove only after new builder prunes old chains.|
|devDependencies|ts-node|~8.0.3|Requires Upgrade|Update to a supported version compatible with the selected toolchain.|
|devDependencies|tslint|~5.15.0|Requires Replacement|Replace with angular-eslint, preserving useful rule intent.|
|devDependencies|typescript|3.2.4|Requires Upgrade|Use each intermediate supported range, ending at 6.0.3 (not latest independent TS7).|
|devDependencies|webpack-cli|^3.3.0|No Longer Needed|Remove direct CLI once the supported Angular builder owns bundling.|
|optionalDependencies|node-sass|^4.14.1|Requires Replacement|Remove obsolete native Node Sass after switching to builder-supported Dart Sass.|

## Backend and verification projects

|Dependency|Classification|Approach|
|---|---|---|
|ASP.NET Core 2.2 metapackage/Razor/OAuth/SpaServices|Requires Upgrade / Replacement|SDK shared framework net10.0, endpoint routing, supported static hosting and explicit development SPA proxy; retain cookie schemes/policies.|
|EF Core 2.2 + SQL Server|Requires Upgrade|EF Core 10.0.15 SqlServer; preserve mappings and independently compare read results before any schema operation.|
|EntityFramework 6.3|Potentially Unused|No System.Data.Entity usage found; verify then remove unused EF6 package.|
|Newtonsoft.Json 12.0.2|Requires Upgrade|13.0.4 plus matching ASP.NET Core 10 NewtonsoftJson integration; preserve JSON names and response contracts.|
|System.IdentityModel.Tokens.Jwt 7.0.3|Potentially Unused|No active JWT handler/issuer found; inspect all usage before removal. Existing cookie accounts are retained.|
|System.Configuration.ConfigurationManager|Requires Upgrade|Retain only if DataConnection/provider use is active; no hardcoded connections.|
|Microsoft.Windows.Compatibility / VS LiveShare System.Web reference|Potentially Unused|Remove machine-specific references after verifying no actual API usage.|
|dotenv.net|Compatible|Keep environment/secret-loading behavior while preventing accidental production connection in migration tests.|
|System.Net.Mail.SmtpClient|Compatible|Retain supported platform API and injected transport; preserve HTML/plain/encoding and local test pickup.|
|System.Data.SqlClient|Requires Replacement|Microsoft.Data.SqlClient via modern SQL provider, explicit Development certificate handling; do not weaken production TLS.|
|Playwright 1.55.1|Compatible baseline|Reuse existing infrastructure, adapt removed Angular debug APIs and actual Material DOM selectors; audit final supported version.|
|Legacy verification projects|Requires Upgrade|Modern FrameworkReference/EF packages and current backend reference; keep authorization/fixture guards and test scenarios.|

## Authentication

No active IdentityServer4 dependency/registration was found. Existing custom Users/roles/league mappings and secure ASP.NET cookies are the actual flow. Preserve identity tables and hash compatibility instead of introducing an identity-server/account migration.

## Completed intermediate cleanup (through Angular 12)

- Removed unused `@angular/http` and `angular-oauth2-oidc` direct dependencies after confirming current services use HttpClient and cookie authentication.
- Converted both legacy TSLint targets with the official angular-eslint converter, preserving its mapping of existing rules. Removed TSLint/codelyzer through the converter. Corrected its same-root e2e file patterns and actual tsconfig paths. Historical plugins are pinned to compatible versions rather than accepting the old converter's `latest` suggestions; they must be reevaluated again for the final toolchain.
- Removed unused direct `ajv`, `jquery`, `popper.js` and `webpack-cli` references after searching application imports/build commands. Kept Bootstrap CSS and the application's appearance; Bootstrap JavaScript is not loaded.
- Removed obsolete optional `node-sass`; the Angular builder's supported Sass implementation builds the existing styles successfully. No native install hook is required.
- Removed `core-js@2` and its obsolete reflection import; Ivy no longer requires that polyfill, and application code does not call the legacy reflection APIs. Production build passed after this cleanup. Do not remove the required Zone import.
- Kept the existing Playwright infrastructure and updated shared component inspection for both legacy debug APIs and Ivy, with actual browser scenarios passing on Angular 12.

These are intermediate compatibility checkpoints, not a final vulnerability clearance or a claim that the backend has been upgraded.

The official Angular CLI 16 updater internally invokes npm's forced installation mode after its own migration peer checks; no `--force` was passed to `ng update` and no incompatible Angular override was introduced. Treat intermediate tooling trees as provisional. Final acceptance requires an explicit clean restore without `--force` or `--legacy-peer-deps`, followed by effective dependency/peer and vulnerability audits. Obsolete Jasmine/Protractor tooling and lint-plugin engine constraints still require final testing-tool migration.

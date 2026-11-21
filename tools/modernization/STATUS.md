# Framework modernization checkpoint

Worktree: `C:/Users/Allport/source/repos/LeagueHub-modernization`  
Branch: `feature/framework-modernization`  
Base: `0d30bc9683f2669805958cc575b1fda28ecfcc17` (master and origin/master at start).

## Safety

Master was clean: the prior security work was already committed as `0d30bc9`. No uncommitted work was omitted. Master remains in its original worktree. No commits, pushes, merges, production deployments, production configuration changes, or database writes are authorized by this checkpoint. Database mutation runners retain their fresh, scoped approval requirements. Do not copy original secrets into tracked files.

Recoverable baseline: `tests/functional/artifacts/modernization/baseline-source.zip`. Detailed logs and registry snapshots: `tests/functional/artifacts/modernization/`. Additional baseline build logs are in the original worktree's `tests/functional/artifacts/framework-modernization-baseline/`.

## Target decision

- Angular/Core/CLI/Material/CDK/service-worker **22.3.0**, verified stable registry tags.
- TypeScript **6.0.3**, within Angular 22's `>=6.0 <6.1` range; do not install latest TypeScript 7 independently.
- RxJS **7.8.2** (Angular permits ^6.5.3 or ^7.4); Zone.js **0.16.3**, preserving existing Zone-based change detection.
- Supported Node **22.23.5**, already available as a portable test tool and within the required ^22.22.3 range. Intermediate migrations use isolated Node 10/14/16/18 as required, never production runtimes.
- **.NET 10 LTS / ASP.NET Core 10.0.15 / EF Core 10.0.15**. Official .NET 10 SDK metadata selects SDK **10.0.404**. .NET 11 is newly released; 10 LTS has a mature servicing history and preserves a supported target without adopting the newest major immediately.
- IIS staging will require the matching supported .NET Hosting Bundle/ANCM and an independently configured application; no installer or restart is performed against production.

Sources: [Angular compatibility](https://angular.dev/reference/versions), [Angular support](https://angular.dev/reference/releases), [.NET support](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core), [IIS hosting](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/).

## Current phase

Phase 2: incremental Angular migration. Latest production checkpoint: Angular 18.2.14, Node v18.20.8. Official migrations and source-stable AOT production build passed. Continue with the next supported major and required compatibility work. Backend modernization, final browser integration, database parity, security audit and staging acceptance remain unfinished.

## Authentication finding / decision

The current backend does not reference or register IdentityServer4. Active authentication is the application's existing Users/UserRoles/UserLeagues/UsersPlayer model and two ASP.NET cookie schemes. The unused frontend `angular-oauth2-oidc` dependency is not the current login flow. Preserve cookies, claims, roles, IDs, PBKDF2 legacy hash verification, reset tokens and player mappings; do not migrate accounts into new Identity tables or deploy an unnecessary identity server.

## Planned checkpoints

1. Finish dependency classification, existing test/build failures, before screenshots and read-only Development baseline.
2. Run official core/CLI and Material migration schematics one major at a time, with compatible Node/TypeScript at each step. Build and run focused invariant checks before advancing. Retain NgModule architecture.
3. Migrate backend hosting/middleware and EF/SQL queries while preserving API/serialization and authentication contracts. Do not automatically apply migrations.
4. Integrate modern frontend and backend on separate local ports, use real authenticated synthetic integration fixtures only with verified/scoped Development authorization.
5. Run algorithm/statistical, standings, schedule, management, auth/reset, PWA, printing and responsive regressions. Compare database results and visual baselines.
6. Produce isolated staging package, Hosting Bundle requirements, rollback procedure and evidence-based readiness report. No production deployment recommendation before integration/data checks pass.

## Principal risks

- Angular 7→22 requires sequential migration; root Material barrel imports, old private router import, ViewChild queries, RxJS types and template checks need attention.
- Material MDC changes can invalidate DOM-dependent CSS. Keep brand/layout and compare real screenshots; do not accept a visual redesign as a migration.
- Old Jasmine/Karma scaffolds and debug `ng.probe` browser helpers need supported equivalents; keep the useful scenarios rather than delete them.
- EF 2.2 allowed client query evaluation that modern EF rejects. Preserve query results, ordering, dates, rounding, transactional behavior and existing SQL schema.
- Preserve Newtonsoft JSON contracts initially through modern MVC Newtonsoft support. Do not allow implicit API-controller validation or reference-loop changes to alter responses.
- Preserve PBKDF2/SHA1 legacy verification by explicitly naming the old algorithm where modern constructors require it. Do not change real password hashes or silently force registration.
- Existing cookie sessions may require sign-in after deployment if data-protection keys/purpose change; staging must test key persistence and document this.
- No supported .NET 10 runtime/hosting bundle is installed globally; hash-verified portable SDK 10.0.404 is installed only inside the migration worktree. No IIS changes were made.

## Completion status

Not modernized yet. Not ready for staging or production. Update this document after each passing migration checkpoint and record any blocking issue before proceeding.

## Angular 8 checkpoint (passed)
Official Core 7?8, CLI 7?8 and Material 7?8 schematics completed. Legacy schematic interop adapter prevents CLI 8 from fetching today's CLI and supplies its expected CommonJS chalk default; application dependency/peer checks remain intact. Production build passed. Removed unused private router imports and repaired preexisting invalid historical schedule table grouping, preserving its data. Baseline core invariant suites passed. Development SQL identity verified (SQL Server 2019, compatibility 130); no writes. Recoverable checkpoint: checkpoints/angular8-passed. Angular 9 is next.


## Angular 9 checkpoint (passed)
Core 9.1.13, CLI 9.1.15, Material 9.2.4. Official target-CLI migrations completed. Explicit tslib 1.14.1 satisfies the missing Angular 9 peer; no forced peer bypass. Ivy production build passed. Existing oversized legacy Scrambler stylesheet budget warnings are recorded, not hidden. Source checkpoint: checkpoints/angular9-passed. Angular 10 migration is in progress.


## Angular 12 production checkpoint

Core 12.2.17, Node v14.21.3; official migration step completed, source-stable production build passed in 100 seconds. Detailed warnings and output: angular12-build.log. Completion: 2026-11-21T17:37:43.095Z.

## Angular 12 production checkpoint

Core 12.2.17, Node v14.21.3; official migration step completed, source-stable production build passed in 40 seconds. Detailed warnings and output: angular12-build.log. Completion: 2026-11-21T17:45:27.454Z.

## Angular 13 production checkpoint

Core 13.4.0, Node v14.21.3; official migration step completed, source-stable production build passed in 39 seconds. Detailed warnings and output: angular13-build.log. Completion: 2026-11-21T17:56:20.102Z.

## Angular 14 provisional build (not accepted before migration resume)

Core 14.3.0, Node v14.21.3; official migration step completed, source-stable production build passed in 78 seconds. Detailed warnings and output: angular14-build.log. Completion: 2026-11-21T18:02:22.450Z.

## Angular 14 production checkpoint

Core 14.3.0, Node v14.21.3; official migration step completed, source-stable production build passed in 36 seconds. Detailed warnings and output: angular14-build.log. Completion: 2026-11-21T18:05:11.786Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 32 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:17:01.419Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 28 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:19:13.804Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 34 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:32:34.066Z.

## Angular 15 production checkpoint

Core 15.2.10, Node v14.21.3; official migration step completed, source-stable production build passed in 29 seconds. Detailed warnings and output: angular15-build.log. Completion: 2026-11-21T18:43:50.627Z.

## Angular 16 production checkpoint

Core 16.2.12, Node v16.20.2; official migration step completed, source-stable production build passed in 42 seconds. Detailed warnings and output: angular16-build.log. Completion: 2026-11-21T18:50:07.427Z.

## Angular 17 production checkpoint

Core 17.3.12, Node v18.20.8; official migration step completed, source-stable production build passed in 29 seconds. Detailed warnings and output: angular17-build.log. Completion: 2026-11-21T19:01:36.889Z.

## Angular 18 production checkpoint

Core 18.2.14, Node v18.20.8; official migration step completed, source-stable production build passed in 37 seconds. Detailed warnings and output: angular18-build.log. Completion: 2026-11-21T19:13:10.069Z.

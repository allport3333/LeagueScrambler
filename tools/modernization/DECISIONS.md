# Migration decisions and acceptance gates

## Isolation and checkpoints

Master remains at the recorded baseline in its original worktree. All migration work is on `feature/framework-modernization` in `LeagueHub-modernization`. Checkpoints contain a source archive, binary Git patch and copies of changed/untracked source; creating a checkpoint does not commit, stage, merge or deploy anything. Logs and generated build output stay in ignored local artifacts.

## Frontend sequence

Use official Core/CLI and Material migrations one major at a time, initially retaining NgModules, Zone change detection, existing routing and HttpClient contracts. Pass an AOT production build before moving past each intermediate checkpoint. Historical Node releases are isolated migration tools, not final production requirements. The final supported toolchain is recorded in STATUS.md.

Angular 8 exposed preexisting invalid historical Schedule table markup; wrapping heading cells in rows and restoring the missing tbody preserves the existing content. Angular 9's Ivy compiler passed. Old browser harnesses relying on `ng.probe` need an Ivy-compatible inspection helper before their results can serve as modern-framework evidence. Production PWA tests must still exercise actual production assets rather than debug helpers.

During the 12-to-13 update, packages and the CLI/ESLint migrations installed successfully, but the older CLI failed to resolve CDK's exported `./schematics/migration.json` because it constructed a double-dot-slash subpath. Resumed only the unfinished CDK, Core and Material migrations with the installed target CLI and explicit from/to versions. No peer checks, package exports or application behavior were bypassed. Keep the initial failure log and resume logs alongside the eventual build checkpoint.

The 13-to-14 update exposed the same class of old in-memory DevKit mismatch (`Tree.readText` unavailable). The old CLI returned zero despite reporting migration failure; compilation also succeeded, but this was explicitly rejected as an accepted migration checkpoint. Resumed only CLI/CDK/Core/Material with the installed target CLI after confirming ESLint had completed. The step runner now invokes the target CLI up front and rejects reported migration failures even when the process exits zero; the build gate refuses an unfinished migration record.

Angular 15's target CLI migrations completed. The historical npm 6 tree incorrectly resolved ajv-keywords 5's AJV 8 peer to a hoisted AJV 6, despite schema-utils having its own AJV 8. Added an explicit compatible development AJV 8 peer (aligned to schema-utils' 8.20.0 requirement); no incompatible override or production dependency was introduced. Material's automatic legacy migration also malformed two imports in the Forgot Password dialog; corrected only those import declarations, retaining its existing service calls and behavior. Build logs retain the original failures.

Material MDC migration is a separate visual gate. Compare actual rendered controls and dialogs with the baseline screenshots, including compact date controls, player grids, tables and Scrambler rules. A passing compilation does not accept a visual redesign.

## Backend and authentication

Use .NET 10 LTS with matching ASP.NET Core and EF Core servicing versions rather than newly released .NET 11. Keep the existing controller routes and Newtonsoft response contracts initially. The current source has no active IdentityServer registration; preserve its two cookie schemes, claims, roles and existing custom account tables instead of introducing a different account system.

Legacy PBKDF2 password verification must explicitly retain SHA-1 and its existing iteration count where the modern API requires an algorithm argument. This preserves existing hashes; it does not authorize modifying accounts or imply that legacy hash parameters are an appropriate choice for newly designed authentication. Test hash compatibility with synthetic fixtures. Preserve password reset expiry, single-use consumption and trusted origin.

## Database and integration gate

The verified local Development database is LeagueScramblerDev on localhost (machine identity and schema fingerprints are in local artifacts). Its SQL Server compatibility level is 130. Configure EF translation for the existing database capabilities; do not silently change the database compatibility level. Do not call Database.Migrate or EnsureCreated during startup.

Read-only fingerprints are the before baseline, not proof of EF query parity. Compare actual modernized queries for standings, permissions, schedules, scores, divisions and saved scrambles. Mutation runners must retain fresh scoped authorization checks. Expired approval is not reusable. Real application integration must include the actual modern backend; intercepted browser fixtures alone cannot establish authentication or persistence compatibility.

## Staging gate

No production deployment or IIS restart is authorized. Existing publish profiles must not be invoked. Prepare an isolated publish directory and document the required .NET Hosting Bundle, ANCM, application pool, secrets, HTTPS and Data Protection key persistence. Test whether legacy cookies survive; document required reauthentication if they do not. Staging uses separate configuration and a reviewed Development clone, with a recoverable rollback package. Production recommendation remains withheld until integration and data integrity evidence is satisfactory.

## Risk register

| Risk | Required evidence / mitigation | Current status |
|---|---|---|
| Framework package mismatches | Official sequential migrations; effective versions and clean final restore | In progress |
| Material DOM/CSS regressions | Desktop/mobile before-after screenshots and keyboard checks | Pending MDC migration |
| Removed Angular APIs | Build, routing, forms, HttpClient and PWA regressions | Intermediate builds in progress |
| Obsolete test scaffolds | Replace broken scaffolds with meaningful supported tests; retain useful browser scenarios | Baseline failures recorded |
| EF client evaluation / SQL translation | Compare query results on verified Development data | Pending backend phase |
| JSON/model binding changes | API contract fixtures and real authenticated requests | Pending backend phase |
| Password/account incompatibility | Synthetic legacy hash, role, reset and cookie tests | Investigation complete; tests pending |
| Scores/history damaged by writes | Scoped synthetic ownership, transactions and before/after checks | No writes performed |
| Unsupported IIS runtime | Isolated staging package and Hosting Bundle procedure | No server changes performed |
| Dependency vulnerabilities | Audit final installed tree and GitHub advisories | Final audit pending |

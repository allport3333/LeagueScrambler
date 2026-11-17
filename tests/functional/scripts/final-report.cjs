const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const inputs=['artifacts/results.json','artifacts/runs/standings-math/results.json','artifacts/runs/browser-claim-retest/results.json'];
const latest=new Map();
function walk(suites){for(const suite of suites||[]){for(const spec of suite.specs||[]){for(const test of spec.tests||[]){
  const last=test.results[test.results.length-1];
  const block=(test.annotations||[]).find(a=>a.type==='blocked');
  const status=!last?'NOT EXECUTED':last.status==='passed'?'PASSED':last.status==='skipped'?(block?'BLOCKED':'SKIPPED'):'FAILED';
  latest.set([test.projectName,spec.file,spec.title].join(':'),{test:spec.title,file:spec.file,status,reason:block?block.description:(last&&last.errors||[]).map(e=>e.message.replace(/\x1b\[[0-9;]*m/g,'')).join('; ')});
}}walk(suite.suites);}}
const reports=inputs.map(input=>path.join(root,input)).filter(file=>fs.existsSync(file)).map(file=>JSON.parse(fs.readFileSync(file,'utf8'))).sort((a,b)=>Date.parse(a.stats.startTime)-Date.parse(b.stats.startTime));
for(const report of reports)walk(report.suites);
const rows=[...latest.values()];
const counts=Object.fromEntries(['PASSED','FAILED','BLOCKED','SKIPPED','NOT EXECUTED'].map(s=>[s,rows.filter(r=>r.status===s).length]));
const inventory=JSON.parse(fs.readFileSync(path.join(root,'artifacts/inventory.json'),'utf8'));
const changed=spawnSync('git',['diff','--name-only'],{cwd:path.join(root,'../..'),encoding:'utf8'}).stdout.trim().split(/\r?\n/).filter(Boolean);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>!['node_modules','.tools','artifacts','.local'].includes(e.name)).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.relative(path.join(root,'../..'),path.join(dir,e.name)).replace(/\\/g,'/')]);}
const suiteFiles=files(root);
const table=rows.map(r=>`| ${r.test.replace(/\|/g,'/')} | ${r.status} | ${r.reason.replace(/[\r\n|]/g,' ')} |`).join('\n');
const report=`# LeagueScrambler development regression report

Generated ${new Date().toISOString()}. Target: https://localhost:5001 and localhost SQL Server LeagueScramblerDev, Windows Authentication. No production database access, IIS/certificate/deployment change, framework upgrade, real recovery email, commit, push, merge or deployment was performed.

## Final execution results

${rows.length} distinct executed/blocked tests: **${counts.PASSED} passed, ${counts.FAILED} failed, ${counts.BLOCKED} blocked, ${counts.SKIPPED} skipped, ${counts['NOT EXECUTED']} not executed**. The main full run is in artifacts/results.json; supplementary client-math checks and focused browser-claim reruns are under artifacts/runs. The newest result per test is counted once across those reports, not cumulative repetitions. Prior failing reproductions and reruns remain in artifacts/history.jsonl and WORK_LOG.md.

| Test | Status | Failure/blocker |
|---|---|---|
${table}

## Bugs discovered and fixed

1. Browser test assumed matching-player selection was always displayed. It now supports both matching and general pickers and dismisses the ordinary error snackbar using Close before Save. The complete real browser registration/create/claim/logout/login/logout workflow passed.
2. SQL assertion helper nested result arrays. Corrected test-only serialization.
3. AddPlayer accepted a LeagueDivisionId belonging to another league and returned 200. The controller now rejects the foreign/nonexistent division before writes with HTTP 400. Synthetic before/after database snapshots prove rejection is nonmutating.
4. New Create Teams batch incremented ScrambleNumber per team, splitting one round across multiple scrambles. The controller now allocates a single new number per league per batch. Multi-team grouping and resulting standings round count are tested.
5. Both King/Queen standings projections returned LeagueDivisionName as LeagueDivisionCode. Both now preserve the actual code separately from its display name; tests exercise both routes.
6. Test-only Node initially did not use Windows certificate trust. Scoped system-CA support corrected HTTPS verification without disabling TLS validation or changing certificates.

All application fixes are in Allport's League Scrambler/Controllers/ScrambleDataController.cs. They were built and tested after restarting only the existing Visual Studio project debug session.

## Functional coverage and limits

- Browser and API registration, new-player creation, claiming, login and logout; existing synthetic-player claim confirmation; duplicate/forged claims, role overposting and invalid login rejection.
- Real synthetic Admin/Manager authentication; league creation/default settings, ownership, assigned vs unassigned Manager permissions, and global Admin access.
- Divisions, player assignment/membership removal, cross-league division rejection, public sign-in, forged posted ID/lock-field handling, duplicate and outsider rejection, locks/unlocks, read-only lock status, own sign-out and denial of another player's sign-out.
- Teams, team membership, duplicate team-member rejection, team division, score entry, wins/losses/points standings and recalculation; cross-league score rejection with database checks.
- Saved scrambles, new-team batching, King/Queen round entry/update, substitution flags, standings and division labels; cross-league King/Queen score rejection.
- Public scramble preview executes the actual Angular client algorithm/button with synthetic selection state and verifies zero persistence requests and unchanged SQL snapshots. Complete league-picker UI and global real-player listing are intentionally not exercised.
- Cookie Secure/HttpOnly/SameSite flags, browser cookie expiry and logout tested. Browser cookie expiry is not server-ticket expiry. Successful legacy unlock and server ticket expiry/renewal remain blocked as documented in test results.
- Supplementary browser checks execute actual Development client standings code with in-memory synthetic values for substitute reductions/drop-lowest recalculation, tie-breaking and Gold top-player prioritization. They do not write SQL.

## Isolation and production protections

The initial user-manual confirmation and failed SQL session correlation are separately recorded. Stale authorization was observed to reject the application restart. The rebuilt application's effective Development/localhost/LeagueScramblerDev/integrated-auth environment was then independently read through Windows read-only process APIs. This is separate evidence, **not a successful automated SQL session correlation**. It retains the original authorization deadline and binds PID/start time, Debug DLL/hash, .env hash, launch profile and Visual Studio ancestry. Normal test runs cannot refresh proofs. Changed identity/configuration or expiry blocks writes.

All SQL helper targets are fixed to LeagueScramblerDev. Real-player gender-normalizing GETs are intercepted. External browser requests and recovery routes are blocked. Synthetic email/name namespaces and random run manifests avoid real-account use; exact SQL snapshots validate rejected writes. Test traces may contain synthetic secrets: keep all ignored artifacts local.

## Builds and compatibility

- Backend Debug build with --no-restore: passed, 0 errors and 10 existing warnings (unsupported netcoreapp2.2, vulnerable packages, MVC1001 Error.cshtml.cs:17, MVC1004 GetSignedInPlayers date binding).
- Angular development build: passed; Angular production/AOT/optimization build: passed. Existing outdated Browserslist data warning remains.
- Angular 7/.NET Core 2.2 and system Node 10.16.3 were preserved. Portable Node 22.23.5 and Playwright 1.51.1/Chromium are confined to the test harness. The pinned older browser is only for restricted localhost testing.

## Synthetic data inventory and cleanup

Live inventory: **${inventory.userCount} synthetic accounts, ${inventory.playerCount} synthetic players, ${inventory.linkCount} user-player links and ${inventory.leagueCount} synthetic leagues** retained across all recorded runs. Exact identities, IDs and related league snapshots are in ignored artifacts/inventory.json and artifacts/manifests. No real player/league was modified.

Safely deleted orphan synthetic User IDs: ${(inventory.safelyDeletedOrphanUserIds||[]).join(', ')||'none'}. Only exact manifest-owned Player-role accounts with zero incoming references and no delete triggers are eligible, inside a serializable transaction. Linked accounts, role fixtures, players and league graphs are retained. No broad prefix deletion, truncation, migrations or restoration occurred. Cleanup receipts are in artifacts/cleanup-history.jsonl and artifacts/cleanup-orphans.json.

## Outstanding security and deployment blockers

- Cookie-authenticated mutation endpoints still need anti-CSRF protection.
- Shared legacy administration password remains plaintext in SQL; no credential rotation was attempted. Old repository secrets require independent rotation/recovery work.
- Unsupported ASP.NET Core 2.2/Angular 7/Node 10 and package vulnerability warnings remain. Upgrades require separate authorization and compatibility planning.
- First-time claiming still lacks independent proof that the registrant owns the real-world player identity. Basic in-process throttles are not distributed; legacy unlock concurrency and sign-in/claim database race protection need dedicated concurrency tests.
- Some GET handlers still write historical gender normalization. Public sign-in scheduling/date policy remains partly client-side. Password reset/session revocation and six-hour server expiry/renewal are not established by this suite.
- Existing OAuth/Zone.js peer mismatches and stale Karma/Protractor scaffolding remain outside these focused application fixes. Passing builds do not validate every feature using those dependencies.
- Production hosting configuration, migration compatibility, credentials, SMTP delivery and production behavior were not tested. **This application is not declared production-ready.**

## Files changed

Tracked application source:
${changed.map(f=>'- '+f).join('\n')}

Repository-local test infrastructure (new/uncommitted):
${suiteFiles.filter(f=>!f.endsWith('REGRESSION_REPORT.md')).map(f=>'- '+f).join('\n')}
- tests/functional/REGRESSION_REPORT.md (this report)

## Reuse and priorities

From the existing repository root: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\tests\\functional\\Run.ps1 -Mode all

Use -TestFilter for focused checks and -ReportLabel for a separate local report directory. View the main HTML report with Run.ps1 -Mode report. After a restart or expiry, do not remove/disable the failed guard: independently verify the effective runtime target under valid authority. Safe orphan cleanup is opt-in; league-graph cleanup remains conservative.

Next priorities: provide an approved local legacy test credential, arrange controlled server-expiry testing, add concurrency/CSRF and identity-verification coverage, review remaining write-in-GET routes, then separately plan framework/dependency migration and production hardening. Keep all changes local until reviewed; do not publish test artifacts or credentials.
`;
fs.writeFileSync(path.join(root,'REGRESSION_REPORT.md'),report);
fs.writeFileSync(path.join(root,'artifacts/final-summary.json'),JSON.stringify({generatedAt:new Date().toISOString(),counts,total:rows.length,tests:rows,inventory},null,2));
console.log(JSON.stringify({total:rows.length,counts,report:'tests/functional/REGRESSION_REPORT.md'},null,2));

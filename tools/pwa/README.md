# PWA support — feature/pwa-support

Implemented on `feature/pwa-support`, created from `master` at `02cb88b`. The working tree was clean before branching. No worktree, stash, reset, commit, push, merge, publish or deployment was performed.

## Implementation

- Angular core **7.2.13**, CLI **7.3.8** remain unchanged. Added only the official **@angular/service-worker 7.2.13**, pinned exactly; the lockfile adds only that package.
- Production builds generate `ngsw.json`, `ngsw-worker.js` and Angular's recovery workers. Normal development builds intentionally do not register a service worker.
- Public route **/install-locally**, linked from the existing shared desktop/mobile navigation list. Existing routing and permissions are unchanged.
- `manifest.webmanifest`: Allport's League Hub / League Hub, root scope/start URL, standalone display, existing dark navigation theme and light background.
- Existing `sitelogo1.png` branding resized into 192/512px normal and maskable icons plus a 180px Apple touch icon. Maskable artwork sits inside the safe circle. Reproduce with `powershell -File tools/pwa/Generate-Icons.ps1`.
- Android/Chrome/Edge use a captured `beforeinstallprompt` only after an Install App click. A declined prompt is not automatically retried. An accepted choice alone does not claim successful installation; standalone display or `appinstalled` provides that signal.
- iPhone/iPad receive Safari Share → Add to Home Screen → Open as Web App, where offered → Add instructions. Other iOS browsers are directed to Safari. Unsupported browsers receive useful manual options rather than a nonfunctional install button.
- Offline status is visible globally. No offline account database, background sync, queued submissions or alternative scoring workflow was added.
- Angular SW update events expose Refresh to Update. No automatic reload occurs. Refresh requires explicit confirmation warning about unsaved work. Update checks occur on reconnection and every six hours, with normal Angular worker navigation checks also retained.

## Caching and authentication

`ngsw-config.json` explicitly caches only the static index, root JS/CSS bundles, manifest, generated icons and existing logo. There are **no dataGroups**, wildcard remote resources, API caches or offline write handlers. API URLs and server error routes are excluded from shell navigation fallback. API responses, authentication, attendance and score submissions continue through the existing network/backend path.

Authentication is existing same-origin ASP.NET cookie authentication: HttpOnly, Secure, SameSite=Lax; the separate legacy administrator cookie/policies remain untouched. API services use the injected same-origin BASE_URL. No bearer token storage or external OAuth redirect flow is used by the inspected source. Existing production environment API URL values were not changed.

The cached index is the static Angular shell, not a personalized server-rendered page. Logout/session expiration do not require purging account data from a worker cache because account data is not cached there. Installation may have a separate cookie/session context on iOS: users are explicitly told they may need to log in again. Real standalone cookie sharing and authentication still require device verification.

## Files

- Frontend: package/lockfile, angular.json, ngsw-config.json, src/manifest.webmanifest, src/index.html and src/assets/icons.
- Application: app/pwa (install component and PWA service), app module/root notice markup/styles, one navigation metadata entry.
- Backend source: Startup.cs adds `.webmanifest` MIME support and static-file revalidation headers for index, manifest, ngsw metadata and worker scripts. Authentication/controllers/database models were not modified.
- Tools/tests: icon generator, loopback static preview and tests/functional/scripts/pwa.cjs.

## Local testing

Use the project's existing Node/npm build environment (validated here with Node10.16.3/npm6.9.0). On a fresh checkout install the locked dependencies using that compatible environment. Do not upgrade Angular or run an unrelated dependency fix.

From the repository root:

```powershell
Set-Location ".\Allport's League Scrambler\ClientApp"
npm run build -- --prod --progress=false
Set-Location ..\..
node tools/pwa/preview.cjs
```

Open **http://127.0.0.1:5199/install-locally**. Loopback HTTP is a browser secure-context exception. This preview serves the production build only: **it has no real backend, login or database**, and returns an explicit unavailable response for APIs. Ctrl+C stops it. Its separate origin avoids installing a worker over the normal Development application's origin. A first visit needs a connection; after activation the static shell can open offline, but live information and saving remain unavailable.

Normal `npm start` / ASP.NET Development continues using the regular website without registering the worker. Integrated PWA/account testing requires a separately verified HTTPS staging host serving the production frontend with the real backend pointed only at the approved development database. Do not change the live production environment to perform this test.

Focused browser checks use the already-installed test tools:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/pwa.cjs
```

The script starts and closes its own isolated loopback host, uses fixture APIs only, and never connects to SQL. Fake install events/device user agents are explicitly distinguished from actual OS installation. Its update check uses a second in-memory index hash and real Angular worker, leaving built files unchanged.

## Verification results

- Angular development and production builds passed; backend Release build passed. Existing Browserslist/backend warnings remain.
- Actual production worker registration/control, Chromium manifest parsing and Chromium installability checks passed with no reported installability errors.
- Icon dimensions, MIME/revalidation preview headers, standalone manifest, static offline shell, network-only private reads, failed submissions and absence of API response caches passed.
- Prompt user activation, accepted/declined outcomes, installed-event handling, desktop/mobile navigation, iPhone/Android/unsupported guidance and simulated standalone display passed.
- Mobile widths375/390/430 passed overflow checks. Desktop1366 screenshot captured.
- Existing login/logout UI, Player/Admin navigation and session change behavior passed through network-only **fixture** endpoints with the production worker active. No real account was authenticated.
- Schedule, shared roster and Full Schedule print popup/PDF passed with production worker and fixtures. Existing print layouts were not changed; the install page provides a browser-print fallback.
- Actual version update notification passed without reloading an unfinished form; cancel preserved input, confirmed refresh activated the new version. No application runtime errors were recorded. Injected unavailable requests and blocked legacy third-party CDN requests are intentional network failures in the test.
- The separate older authentication regression command could not run because https://localhost:5001 was not listening. It is not reported as passing.

Evidence: ignored `tests/functional/artifacts/pwa/` (results.json, desktop/mobile screenshots, update screenshot, schedule-print.pdf), and `pwa-{development-build,production-build,backend-build,browser,auth-regression}.log` in the artifacts directory.

## Hosting and review prerequisites

1. Review this uncommitted feature branch and the dependency/configuration diff. Production output must be generated with `--prod`; the existing .NET publish target already does that. No publish target was executed here.
2. Stage the complete dist output atomically, including ngsw.json/worker, manifest and icons. Keep old hashed bundles available long enough for existing clients where the host supports that. Do not deploy a partial index/manifest/assets combination.
3. Verify HTTPS, root-scope hosting, manifest `application/manifest+json`, worker JavaScript MIME and service-worker registration at `/ngsw-worker.js`. Existing source static-file changes request `no-cache` revalidation for PWA metadata/index; confirm IIS/CDN does not override it. Never rewrite missing worker/API requests into an HTML success response. Leave API behavior/authentication intact.
4. Verify direct routes, new-version delivery and browser refresh against staging. No IIS/Cloudflare configuration was changed or inspected remotely; their effective behavior is not claimed verified.
5. On real Android, iOS/iPadOS and desktop installations verify native install/launch, regular and administrator login/logout/expiration, attendance, score entry/save/retrieval, team modification, profiles/standings/history and printing. Current evidence uses Chromium browser emulation and fixture transport, not native device testing or real attendance/score persistence. In-app browser installation may require opening Safari/Chrome/Edge instead.
6. Obtain explicit approval before committing, merging, pushing or deploying. No Personal Leagues, Live Sessions, scoring, schema or account changes are included.

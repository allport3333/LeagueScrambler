# Responsive navigation checkpoint

**Permission correction:** League Management is now Admin/Manager only, matching Scrambler navigation, on desktop and mobile. A new Angular route guard also blocks Player/anonymous direct URLs after waiting for session restoration. This supersedes the original public management visibility described below. Password validation, cookies and backend authorization are unchanged. Angular development build passed. The new four-role browser check could not execute because localhost:5001 refused the connection (development app stopped); it is blocked, not passed. Run `scrambler-workspace.cjs management-permissions` after starting the existing development application. Previous eight navigation checks below preceded this correction.

Completed November 17, 2026. Stopped at user's usage-limit request; no further work pending for this navigation assignment.

- Single dark desktop bar at 1280px and above: league selector left, five existing primary destinations, More (Players, Sign In Sheet, League Management, FAQ), Account (Profile when associated, Logout).
- Below 1280px: compact league selector/hamburger bar with an existing Angular Material overlay sidenav. Grouped left-aligned links, active state, close/outside/Escape dismissal, focus trapping, internal scrolling. Opening does not push page content. Resize to desktop closes the drawer.
- All route names and original visibility rules retained. Anonymous legacy-management access remains available. Existing league handlers, logout handler and authentication subscriptions preserved; only route-start drawer dismissal was added to startup. No new packages or backend/authentication changes.
- Scrambler/League Management shared workspace preserves selections, teams and settings. Menus do not reset application data. Navigating to unrelated routes retains the existing component lifecycle; no new global draft persistence or league persistence across full browser reload was introduced.

## Verification

Angular development build passed using existing packages/Node 10; existing Browserslist warning only. Production/AOT and complete regression suite were not rerun.

Final focused run: **8 grouped checks passed, 0 failed; 0 browser page errors**. Tested Admin, Manager, Player and anonymous visibility; all existing permitted destinations/account actions; active states; drawer selection/outside/close/Escape and keyboard focus; desktop 1920/1366 and overlay 1024/390/375; phone scrolling; no horizontal overflow or page displacement; global league selection; management direct refresh; same live workspace state; Account logout and subsequent refresh. API responses, including logout, were intercepted fixtures. No real SQL, real login/logout, password use, production requests or database mutations.

One screenshot wait initially matched both closing and opening Material menus; the test now waits for one fully opaque panel. Final run passed. Auth-restoration runner selectors were updated for Account menu presentation but that separate suite was not rerun.

## Screenshots

- Desktop: [1366 closed](navigation-evidence/navigation-closed-1366.png), [1920 closed](navigation-evidence/navigation-closed-1920.png), [More open](navigation-evidence/more-open-1366.png), [Account open](navigation-evidence/account-open-1366.png).
- Mobile: [375 closed](navigation-evidence/navigation-closed-375.png), [375 open](navigation-evidence/drawer-open-375.png), [390 closed](navigation-evidence/navigation-closed-390.png), [390 open](navigation-evidence/drawer-open-390.png).
- [1024 open](navigation-evidence/drawer-open-1024.png), [Player drawer](navigation-evidence/drawer-Player-390.png), [Manager drawer](navigation-evidence/drawer-Manager-390.png).
- Results: `navigation-evidence/navigation-results.json`; source preservation: `navigation-evidence/preservation.json`; build log: `artifacts/navigation-responsive-build.log`.

## Files and resuming

Changed application files only: `nav-menu.component.ts`, `.html`, `.css` in `Allport's League Scrambler/ClientApp/src/app/nav-menu/`. Testing: `scripts/scrambler-workspace.cjs` navigation mode/updated menu selectors, `scripts/auth-restoration.cjs` Account selectors, `navigation-evidence/`, this report and WORK_LOG.

With the development Angular bundle/application running, focused rerun from repository root:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path tests/functional/.tools/browsers).Path
& tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/scrambler-workspace.cjs navigation
```

No IIS, Cloudflare, production files/databases, schemas, publish/deployment configuration, authentication or legacy password changes. Nothing committed, pushed, merged or deployed. No additional tests or development cycles needed unless the user reports a defect.

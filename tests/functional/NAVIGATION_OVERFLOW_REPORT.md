# Desktop navigation measured overflow — November 18, 2026

## Changes
Desktop navigation now allocates the existing permitted destinations by measured available width. It no longer uses fixed primary/secondary link lists. The same existing permission-filtered list supplies the desktop bar, overflow menu and mobile drawer.

A hidden, aria-hidden, noninteractive measurement strip measures the current labels/icons and actual Material More button. The flex layout supplies remaining desktop width after the existing league selector, account menu and outer gaps. The allocation includes actual link widths, gaps, More width when needed, and a small rounding allowance. It retains a deterministic prefix of the existing priority order; remaining destinations go into More. If all destinations fit, More disappears entirely.

Layout recalculates after view creation, permission/session/selected-league changes, font readiness, window resize and ResizeObserver container-width changes. requestAnimationFrame coalesces work, NgZone updates Angular, and hidden initial calculation avoids briefly displaying an incorrect link arrangement. ResizeObserver is optional; resize handling remains available without it. Observer/frame cleanup is handled on component destruction.

Dark styling, labels/icons/routes, active highlighting, selected league and account behavior remain. Desktop links cannot wrap. The desktop breakpoint now starts at 1024px so the requested 1024px desktop uses measured overflow; below that the existing drawer/layout remains, without a More menu inside it. No authentication, role permissions or route handling changed.

## Executed verification
Angular development build passed with installed Angular 7 packages and existing Node runtime. Existing outdated Browserslist warning remains. Log: artifacts/navigation-overflow-build.log.

Six grouped focused browser checks passed:
1. Anonymous, Player, Manager and Admin permission lists at 1024/1366/1600/1920.
2. Wide-to-narrow-to-wide resizing preserves every permitted route exactly once between bar/More, without horizontal overflow or a second desktop row.
3. Players get all six links directly whenever they fit; empty More is absent.
4. Active links/More highlighting, Material keyboard Escape dismissal, usable account Profile/Logout menu and league menu options.
5. Phone drawer includes every permitted destination directly and closes normally; no nested More menu.
6. Role and logout-state changes recalculate allocation.

Measured results using synthetic league names and the installed fonts:

| Role | 1024px direct / More | 1366px | 1600px | 1920px |
|---|---|---|---|---|
| Anonymous | 2 / 0 | 2 / 0 | 2 / 0 | 2 / 0 |
| Player | 4 / 2 | 6 / 0 | 6 / 0 | 6 / 0 |
| Manager | 3 / 6 | 6 / 3 | 9 / 0 | 9 / 0 |
| Admin | 3 / 6 | 6 / 3 | 9 / 0 | 9 / 0 |

These counts are observations, not hardcoded limits. Font widths and available parent width determine the split. Measurements and checks are saved in player-profile-evidence/navigation-overflow-results.json.

API authentication/role responses were browser fixtures, and role/logout transitions were simulated through existing presentation/auth-state interfaces. No real login/logout POST, credentials, SQL, database mutations or production access were used. There were no browser page errors or write requests. No full regression suite was run.

## Screenshots
- [Player wide, all six direct](player-profile-evidence/navigation-fit-player-1920.png)
- [Player 1366, no More](player-profile-evidence/navigation-fit-player-1366.png)
- [Player narrow, measured More](player-profile-evidence/navigation-fit-player-1024.png)
- [Admin wide, all nine direct](player-profile-evidence/navigation-fit-admin-1920.png)
- [Admin 1366 with overflow](player-profile-evidence/navigation-fit-admin-1366.png)
- [Admin narrow](player-profile-evidence/navigation-fit-admin-1024.png)

Screenshots contain synthetic league/session fixtures.

## Source scope and rerun
Application files changed only under ClientApp/src/app/nav-menu: nav-menu.component.ts, .html and .css. Focused fixture tests extend tests/functional/scripts/player-profile-ui.cjs; evidence, this report and WORK_LOG.md updated. Earlier pending changes were preserved. No backend, authorization, authentication, production/IIS/Cloudflare or deployment changes; no packages installed, publish, deploy, commit, push or merge.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tests/functional/.tools/browsers'
& 'tests/functional/.tools/node-v22.23.5-win-x64/node.exe' tests/functional/scripts/player-profile-ui.cjs --navigation-overflow
```

Use the existing local development Angular bundle. Task complete.
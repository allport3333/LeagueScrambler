# Authentication restoration fix — completed 2026-11-17

## Root cause and scope

Angular's AuthService initialized its BehaviorSubject to false on every new document. It did not query the server. Navigation subscribed to that client boolean, so a valid browser cookie could coexist with logged-out navigation after refresh. This is distinct from server cookie invalidation: the existing IsAuthenticated endpoint reads User.Identity.IsAuthenticated, and page refresh does not call SignOut. Cookie expiry, Data Protection key loss and real server ticket invalidation are separate cases, not fixed or claimed tested here.

Source inspection also found navigation always choosing the first league and a LeagueService data-loading method redirecting to a profile on missing leagues/player data. A legitimate Admin/Manager may have no claimed player. Those redirects could discard the route being restored.

## Targeted changes

- AuthService starts in a distinct checking state and calls the existing credentialed `/api/Login/isauthenticated` GET. Boolean consumers wait for a confirmed result instead of receiving a fabricated startup false. False, unauthorized or failed checks produce logged-out client state.
- Browser back/forward-cache `pageshow` restoration revalidates the session. Ordinary new-document return navigation checks automatically through service startup.
- State-version guards prevent delayed startup results or metadata responses from reversing a newer login/logout state.
- Navigation hydrates the server role, optional associated player and available leagues. Missing player links (404) are accepted; unauthorized metadata fails closed. Anonymous Home/logout/profile controls are not flashed while checking. Existing role-based navigation conditions remain unchanged.
- Home authentication controls also wait for validation; an already authenticated returning user does not get the login form.
- League loading no longer requires a claimed player or performs automatic error/empty-data redirects. Explicit successful login still uses its existing role-based destination, and navbar logout retains its existing server POST and home navigation.
- Session hydration retains an already selected accessible league and does not emit a redundant selection. A fresh document with no in-memory selection retains the existing first-available default. No browser storage persistence was introduced. Ordinary logged-out validation does not erase independent public/legacy league context.

No new authentication mechanism, token storage or credential persistence. LoginController, Startup, LeagueAccess and LoginService are unchanged, including cookie configuration, server logout, legacy password validation/unlock and authorization. Successful real legacy unlock was not exercised.

## Verification actually executed

**15 focused browser check groups passed, 0 failed**, using the actual local Angular application:

- Player, Manager and Admin role/player/navigation restoration on startup and refresh.
- Refresh preserves profile, Scrambler and standings routes.
- Browser login followed by refresh, navigation to about:blank and back, and persisted-pageshow revalidation.
- Existing selected league B remains selected without a redundant selection emission.
- Explicit navbar logout calls the existing endpoint; client state clears after its response and remains logged out after refresh.
- False, HTTP401 and HTTP503 session-check responses correctly show logged-out state without redirecting.
- Expired-session response on persisted pageshow clears cached role/player navigation.
- Unclaimed Player/no leagues, unclaimed Admin and unclaimed Manager/no leagues retain their routes.
- A delayed check cannot overwrite a newer explicit logged-out client state.

Angular development and production/AOT builds both passed using installed Node10/packages. Existing outdated Browserslist/caniuse-lite warning only; no dependency changes. No full regression run was performed.

**Test limitation:** all API requests were intercepted; login/logout used a synthetic Secure/HttpOnly/SameSite cookie and mocked responses. No real login/logout request, credential, account, database query/mutation or email was used. The expired-session tests simulate the server reporting expiry; they do not expire a real ASP.NET cookie. This verifies Angular behavior, not real server ticket persistence. Final page errors: zero. [Results and exact check list](auth-restoration-evidence/results.json).

For a real-cookie smoke check, sign in normally in the local application and refresh standings, Scrambler or the profile as appropriate; confirm role navigation and the same route remain, then log out and refresh. No production or new synthetic account is required by that manual check.

## Files changed

Application files:

- `ClientApp/src/app/auth.service.ts`
- `ClientApp/src/app/services/league.service.ts`
- `ClientApp/src/app/nav-menu/nav-menu.component.ts`
- `ClientApp/src/app/nav-menu/nav-menu.component.html`
- `ClientApp/src/app/home/home.component.ts`
- `ClientApp/src/app/home/home.component.html`

Harness/reporting: `tests/functional/scripts/auth-restoration.cjs`, `Run-AuthRestoration.ps1`, `auth-restoration-evidence/results.json`, this report and WORK_LOG. Prior pending standings/Team Scores/UX work was preserved. No production, IIS, Cloudflare, database, publish, deploy, commit, push or merge operations occurred.

Rerun only the focused checks with the existing development application running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/functional/Run-AuthRestoration.ps1
```

The runner uses existing portable Node22/Playwright and restores its scoped environment variables. No SQL mutation grant is needed because no SQL or real API writes execute. Work stops at this fix.

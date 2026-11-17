# Administrator compatibility audit — 2026-11-17

Historical audit checkpoint: subsequent four-action management origin-filter remediation and the user's confirmed Desktop-staging/manual-IIS-copy publishing workflow are documented in MANAGEMENT_CSRF_CHECKPOINT.md and the updated DEPLOYMENT_PLAN.md. Legacy authentication remains frozen. Do not treat this earlier audit's 52-case count or five-route scope as the current implementation; current isolated checks number 90 and database/browser verification remains blocked.

## Decision and evidence

**Deployment is not recommended yet.** Existing application authentication/source/configuration was not changed in this audit. No shared password was retrieved, logged, supplied to automation, changed or rotated. No production database, account, IIS configuration, deployment file or Cloudflare setting was accessed or modified. Only unauthenticated public root HEAD requests and DNS lookups were used for routing metadata.

Previous complete functional baseline: **34 passed, 0 failed, 2 blocked**, including all original 30 passes. Current audit adds **52 passing compiled-filter cases** and reruns **9 read-only Playwright tests, all passed**, under artifacts/runs/administrator-audit-readonly. These counts must remain separate; this is not 86 authenticated functional passes. Mutating administrator tests were NOT rerun: the original process authorization expired at 2026-11-17T05:38:08.375Z and the isolation command correctly rejected it. No proof deadline was extended. Automated SQL session correlation still did NOT pass.

## Frozen administrator workflow

1. Ordinary accounts use POST Login/login; role comes from stored account data, not the browser. The default cookie is Secure/HttpOnly/SameSite=Lax; configured ticket lifetime is 30 days. Admin has global access; Manager is restricted to assigned UserLeagues. These roles were not edited.
2. On Scrambler or Team Scores, a person enters the shared administration password and explicitly selects Unlock Administration. Angular posts it over HTTPS to Login/VerifyAdminPassword with credentials. It is not downloaded from SQL to the client or stored in localStorage by this flow. The input is cleared after successful unlock.
3. Server validation selects the first stored Passwords value; plaintext storage is an existing frozen risk. It performs fixed-length digest comparison but does not convert stored plaintext into a password hash. No value was inspected. No deterministic ordering is specified if multiple rows exist; do not query or repair production to investigate this audit.
4. On success the server issues the separate LeagueAdminPassword scheme / LeagueScrambler.Admin cookie, containing NameIdentifier=legacy-admin and role=LegacyAdmin. It is Secure, HttpOnly, SameSite=Strict, host-only by default, nonpersistent, with six-hour ticket lifetime and sliding renewal. Active renewal depends on requests that authenticate the scheme and middleware timing, not merely mouse movement. Browser session restore can affect apparent cookie persistence; six-hour server expiration was not tested.
5. This cookie coexists with an ordinary Player/Admin/Manager cookie; it does not replace the ordinary role. LeagueManagement explicitly authenticates both schemes. LeagueAccess grants Admin or LegacyAdmin global management, while Manager checks assignment. Profile-specific U endpoints still require the ordinary cookie; legacy unlock alone is not an ordinary account login.
6. On component initialization/refresh Scrambler and Team Scores call IsAdminPasswordAuthorized. They restore unlocked UI state if authorized; ordinary Admin/Manager role checks can also enable administration. A client boolean does not authorize server writes.
7. POST Login/logout clears ordinary authentication when present and separately signs out LeagueAdminPassword, and deletes the old access_token cookie. Navbar Logout navigates home and clears ordinary UI state. No logout/cookie behavior was changed.

## Functionality and evidence limits

| Area | Existing evidence | What still needs verification |
|---|---|---|
| Ordinary Admin/Manager login, role permissions | Prior synthetic authenticated tests passed | Production proxy-origin compatibility; no real credentials used |
| Shared unlock | Source traced; invalid password test previously passed | Successful unlock BLOCKED without approved test credential |
| Leagues/divisions/settings/rosters | Prior synthetic Admin/Manager mutation tests passed | Same operations via actual LegacyAdmin cookie |
| Scrambles/teams/scores/KQ/standings | Prior synthetic API/browser preview tests passed | Legacy-unlocked UI journey and production-form parity |
| Navigation/refresh | Component initialization traced; ordinary browser sessions previously passed | Legacy-only refresh/navigation in each administrator's browser |
| Logout | Prior ordinary browser logout passed; server clears both schemes by source | Combined/legacy-only logout with authorized credential |
| Simultaneous three administrators | No single-session eviction registry found; self-contained cookies imply independent browser sessions | Actual three-context legacy-cookie test BLOCKED, not claimed passing |
| Server expiration/sliding renewal | Six-hour configuration inspected | BLOCKED pending controlled server timing/extended test |

Three people sharing one password does NOT establish that SQL contains three role=Admin accounts. If there are multiple Admin accounts, password-only AddNewLeague cannot infer an owner unless LEAGUESCRAMBLER_LEGACY_ADMIN_EMAIL selects an existing account. The local .env has no nonempty owner setting; production configuration was not inspected. Do not infer production is missing it. Configured owner lookup does not itself enforce role=Admin; administrators must verify their intended owner through an independently authorized process. No roles, setting values or ownership records were changed.

Static usability risk: navbar Logout is rendered only for ordinary loggedIn state. Unlocking only the legacy cookie does not update AuthService's ordinary loggedIn flag. Therefore legacy-only users may not see a Logout link. This is an existing source-level risk, not a newly executed browser reproduction. Changing it would change a frozen workflow, so it is documented, not fixed. Also, open tabs can retain stale unlocked UI booleans after another tab logs out; server authorization should reject later writes. Manual verification must check both UI and server result.

## Four public hostnames and origin compatibility

Observed 2026-11-17 around 05:47 UTC, with normal TLS validation, no cookies and no redirect-following:

| Host | Public DNS / HTTPS HEAD / | Root Location redirect | Backend identity |
|---|---|---|---|
| allportsleaguehub.com | Cloudflare addresses; 200; Server=cloudflare | None observed | Not established |
| www.allportsleaguehub.com | Same Cloudflare address pair as hub apex; 200 | None observed | Not established |
| allportsleaguescrambler.com | Different Cloudflare address pair; 200 | None observed | Not established |
| www.allportsleaguescrambler.com | Same Cloudflare address pair as scrambler apex; 200 | None observed | Not established |

All four HTTPS roots are publicly reachable; this does not prove identical application, IIS site, database, subpath/API routing, certificates behind Cloudflare or intended supported aliases. HTTP roots timed out after 15 seconds each in this environment, so HTTP-to-HTTPS redirects are UNVERIFIED. No production login/API/page body/record was requested.

Angular derives BASE_URL from the document's base href, currently `/`; service routes use that base rather than a hardcoded production API host. Unused environment.apiUrl strings and old-domain social metadata exist but have no found apiUrl consumer in src. Thus a page served under each host should call its own origin. This is source inference, not a production browser trace.

The actual compiled SameOrigin filter passed **52 isolated cases, 0 failures**, run by OriginCompatibility.ps1 without a web host, SQL or network. Each of the four HTTPS hosts accepts its own exact Origin, valid Referer fallback and explicit default port 443. It rejects other aliases, wrong schemes, opaque/missing origin, host rewrite mismatches and raw forwarded-header spoofing. All aliases are separate origins; do not cross-allow them simply because they belong to the owner. Nonbrowser callers can forge Origin, so this is CSRF mitigation, not authentication. Ordinary authorization remains necessary.

Pipeline requirements and unknowns:

- The filter compares browser source with Request.Scheme and Request.Host, ignoring raw forwarded headers. Program uses WebHost.CreateDefaultBuilder; Startup does not add broad ForwardedHeaders/CORS trust. Repository production AllowedHosts is `*`, not a verified hostname allowlist.
- IIS/ANCM out-of-process integration normally reconstructs scheme/client address through a restricted local proxy. The published hosting model, effective IIS bindings, host rewriting and trusted proxy chain were not inspected. A filter-only spoofing test does not certify upstream middleware/header sanitization.
- Cloudflare Full/Full(strict) uses HTTPS to the origin; Flexible uses HTTP. With Flexible or other HTTP origin hops, a browser https Origin can disagree with the app's effective http scheme and cause 403 or redirect loops. Current mode is UNKNOWN. Do not change code to blindly trust X-Forwarded-Proto/Host or CF headers. Validate an explicitly trusted proxy chain or end-to-end TLS first under separate configuration review.
- Browser Origin is normally present on modern HTTPS writes. Referer is fallback only when Origin is absent; null/invalid Origin never falls back. Privacy tools/proxies stripping both headers intentionally cause 403. Cross-host POST redirects/rewrite rules can break matching. A navigation redirect before presenting a page differs from redirecting its API writes.
- Host-only cookies do not move between apex/www or old/new domains. Each administrator must remain on one supported hostname or unlock again at the destination. No cross-domain SSO is promised. Do not widen cookie Domain or alter authentication to mask this behavior.
- Data Protection key persistence, application discriminator, app-pool identity and deployment path affect old cookie decryption. Preserving source cookie settings is insufficient proof existing production sessions survive replacement. Reauthentication, recycle and rollback compatibility remain untested.

No specific production mismatch was established, so no speculative application/proxy fix was applied. See DEPLOYMENT_PLAN.md and STATE_CHANGING_ENDPOINTS.md for gates and remaining gaps.

## Safe manual verification (not performed)

First renew process-bound authority and independently verify the actual localhost/LeagueScramblerDev runtime; never bypass expiry. Use three separate private browser contexts and unique synthetic leagues/players. Obtain an explicitly authorized development-only credential; never retrieve/copy the production shared password to automation or traces. If no safe credential exists, leave legacy success blocked and schedule owner-operated production access checks only under a separately approved deployment window.

Each administrator should later verify: supported hostname; unlock by the existing UI; no ordinary role change; navigate Scrambler to Team Scores and refresh; manage only designated synthetic dev league/division/player; preview then save scramble; score/KQ update and standings; then logout. Verify protected writes are rejected after logout, including another open tab. Repeat ordinary-account-plus-unlock and legacy-only cases. With all three contexts unlocked, logging out one must not revoke the other two; do not test conflicting simultaneous score edits. Check shared-IP throttle without deliberately locking out real administrators. Record pass/fail and HTTP status only, never passwords/cookies/HAR bodies. Server expiry requires a separate controlled/extended test.

## References

- [Microsoft IIS/proxy integration](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-2.2): restricted forwarding differs from trusting arbitrary headers.
- [Cloudflare encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/): browser TLS does not establish origin-hop TLS.
- [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): same-site cookies, source-origin verification and authorization solve different problems.

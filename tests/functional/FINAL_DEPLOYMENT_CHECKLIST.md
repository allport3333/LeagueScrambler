# Final deployment compatibility checklist — 2026-11-17

Scope: finish compatibility checks, not an authentication rewrite. No application source, credentials, cookies, roles, workflow, production system or data changed. **Do not deploy yet.** Detailed background remains in ADMIN_COMPATIBILITY_AUDIT.md, STATE_CHANGING_ENDPOINTS.md and DEPLOYMENT_PLAN.md.

## What the repository establishes

- Source web.config declares ANCM V2 and publish-time launcher placeholders. It does not establish actual IIS bindings, physical paths, hosting model, HTTPS termination or Cloudflare routing. launchSettings.json is development configuration, not evidence about production.
- Program uses the default web host. No explicit general forwarded-header trust, key persistence, application discriminator, cookie Domain override or custom server-side ticket store was found. Production AllowedHosts is `*`; this is not a verified domain/binding allowlist.
- Earlier public observations: all four HTTPS roots returned 200 through Cloudflare, without root redirects; HTTP checks timed out. These are historical observations, not refreshed checks in this follow-up. DNS/HEAD cannot prove the same IIS application, API mapping or SQL database. Only the operator can privately confirm the actual routing chain under the current access restrictions.
- Each host's own browser Origin passes if ASP.NET Core sees that same HTTPS host. Cross-alias API calls, HTTP origin-hop mismatches, host rewriting or stripped Origin/Referer can fail. The 52 compiled-filter cases passed previously but do not exercise live IIS/Cloudflare integration. Do not fix uncertainty by trusting arbitrary forwarded headers or cross-allowing aliases.
- **Confirmed workflow correction:** FolderProfile.pubxml publishes Release to C:\Users\Allport\Desktop\LeagueScrambler; DeleteExistingFiles=true affects that Desktop staging directory ONLY. This is the user's normal workflow and is preserved. Direct Publish.pubxml independently targets C:\inetpub\wwwroot\NewLeagueScrambler, while FolderProfile1.pubxml targets C:\inetpub\wwwroot\LeagueScrambler; neither is the normal staging profile. Staging Publish requires explicit authorization; reviewed files are manually copied to IIS only after separate approval, with an IIS backup and preserved production settings/keys. PublishRunWebpack still runs npm install. No profile/target was modified or invoked.

## Multiple administrators and session continuity

- Three people sharing one password receive separate per-browser legacy cookies after unlock. No single-session eviction/central login registry was found; one person's login should not replace another's cookie. Actual three-browser legacy success remains untested, not guaranteed. Shared IP throttling can affect all three after repeated wrong attempts; do not exercise lockout on production.
- All legacy sessions identify as legacy-admin with global LegacyAdmin management rights; actions are not individually attributable. Three people does not imply three SQL Admin accounts. With an ordinary Admin/Manager login, new-league ownership uses that account. Password-only creation instead uses LEAGUESCRAMBLER_LEGACY_ADMIN_EMAIL, or falls back only when exactly one Admin account exists. Verify the intended existing owner privately; do not create accounts or alter roles to satisfy this audit.
- The legacy cookie is Secure/HttpOnly/SameSite=Strict, nonpersistent, six-hour ticket lifetime with sliding renewal. Ordinary authentication is separate (30-day configured lifetime, Secure/HttpOnly/SameSite=Lax). Host-only cookies do not carry across the four aliases. Stay on the same chosen hostname during verification.
- A restart is not inherently a logout if cookie keys, application discriminator, identity, scheme/options and valid ticket remain compatible. Conversely, losing key storage/access, changing effective application identity/content-root-derived discriminator, or deploying incompatible middleware can invalidate old tickets. No explicit key configuration means persistence is environment-dependent; repository review cannot establish production key durability. Do not change key/cookie configuration during this release merely to test it.
- Navbar Logout is gated by ordinary loggedIn state and may be absent for legacy-only unlock. Closing one tab is not logout; another tab may retain stale unlocked controls. Frozen behavior remains unchanged. Record any missing Logout button as a failed compatibility check rather than assuming the session ended.

## Concise owner-operated manual test

Precondition: freshly authorized, independently verified **localhost / LeagueScramblerDev** runtime before ANY test that creates/edits records. Expired proof must not be reused or extended by editing JSON. Use unique synthetic leagues/players only. Enter the password you already know directly into the UI if authorized for this Dev instance; do not send it to Codex, copy it into a credential file, query it from SQL, or capture password/cookie-bearing traces. If it is not valid in Dev, stop that test without changing Passwords or requesting the production value.

| Step | Your action | Pass condition |
|---|---|---|
| 1 | Open three separate private browser contexts on localhost HTTPS; each person uses the existing supported login/unlock flow | All three independently unlock; ordinary role is unchanged |
| 2 | In the first context create a uniquely named synthetic league | Creation succeeds and intended existing owner can access it; no owner-ambiguity error |
| 3 | Add/edit its division, synthetic player and membership using existing controls | Expected changes save and appear after reload |
| 4 | Preview a scramble, then deliberately save teams; enter synthetic scores/KQ round and refresh standings | Preview alone does not persist; deliberate saves and totals are correct |
| 5 | Navigate Scrambler ↔ Team Scores, then refresh each browser | All three retain expected management access on the same hostname |
| 6 | Log out context 1 using its existing UI; refresh it and another open tab | Session ends and protected saves are denied; missing Logout control is recorded as failure |
| 7 | Check contexts 2 and 3, then log each out | Context 1 logout does not revoke theirs; each can independently end its own session |
| 8 | Under a separately authorized local restart/release rehearsal, verify access before and after restart and candidate-to-previous-artifact rollback | Cookie continuity/relogin behavior matches the agreed requirement; no unexpected loss of access |

Repeat relevant steps for legacy-only and ordinary-account-plus-legacy usage. Step 8 requires restoring valid process-bound test evidence after every restart before further test writes. Do not change the system clock, test expiry by assumptions, or send recovery email. Successful legacy unlock and server-ticket expiry remain BLOCKED until actually verified; browser cookie deletion is not server expiry testing. No production mutation is part of this checklist. Later production smoke checks must be owner-operated/read-only in an approved deployment window; test writes belong in Dev.

## CSRF priority: evidence versus possibility

**Completed remediation verification:** nine routes now have SameOrigin. The four prioritized form-compatible POSTs (ScrambleData/AddNewLeague/{leagueName}, Statistics/UpdateTeamScores/{leagueName}, Statistics/SetTeamDivision and Statistics/AddPlayerToLeagueTeam) carry the method-scoped check; authorization/roles are unchanged. Focused Admin/Manager browser and rejected-write SQL checks passed, followed by one full suite: 36 passed/0 failed/2 accepted blocked; all previous 34 passes passed again. No global antiforgery check exists. Other management actions remain unprotected, and Login/logout accepts an empty POST but its workflow is frozen. This is not global CSRF remediation or proof of production proxy/legacy session compatibility. See FINAL_VERIFICATION_REPORT.md.

**Not confirmed browser exploits:** no credential-bearing malicious-origin reproduction was executed. SameSite blocks many unrelated-site credentialed POST scenarios; attacker-controlled same-site origins, browser behavior and top-level cookie responses need separate assessment. A raw HTTP request with forged Origin is not proof of victim-browser CSRF. JSON POSTs without explicit checks are gaps, but content-type/preflight and lack of CORS permissions materially affect exploitability. Existing frozen legacy risks are not resolved by this checklist. Do not call these proven authorization bypasses or silently weaken protection for compatibility.

## What can be automatic versus what needs you

| Requirement | Automatic evidence possible | Your participation / current limit |
|---|---|---|
| Source routes, publish hazards, filter rules, build/package checks | Repository inspection; existing no-restore build; isolated 52-case filter runner | Review publish destination before any publish; no package/publish execution assumed |
| Public hostname reachability | DNS/HEAD metadata, already observed | Confirm intended domains and actual Cloudflare→IIS mapping, TLS mode, Host preservation and API routing privately |
| Existing functional regression | Baseline 34 passed, 0 failed, 2 blocked; all original 30 retained | Renew valid Dev isolation before any mutating rerun; no need to rerun unchanged code solely for this documentation pass |
| Three-person legacy workflow/owner selection | Automation only with safe authorized test credential and valid isolation | Manual checklist above; never disclose/retrieve production password |
| Session persistence and rollback | Local rehearsal after equivalent hosting/key setup is established | Privately verify current key persistence, app identity/access and rollback compatibility; do not export key values |
| Artifact/schema/backups | Artifact inspection/hashes and isolated compatibility tests | Approve reproducible Release artifact, backup/restore validation and maintenance window; production schema was not queried |
| Remaining risk decision | Source inventory can prioritize | Review CSRF/frozen-workflow/unsupported-stack risks before approving release; no broad migration is started here |

## Exactly what remains, in order

1. **You:** privately confirm all four intended host mappings, HTTPS origin hop, effective Host/scheme and existing session-key/app identity stability. No infrastructure changes are prescribed by this audit.
2. **You + safeguarded Dev testing:** renew isolation authority, confirm legacy-only owner selection and complete the three-context manual checklist. Record only result/status; leave genuine blocked tests blocked.
3. **Security decision:** address or explicitly review unresolved management CSRF and frozen-system risks without changing frozen authentication. There is no newly confirmed browser exploit in this pass, but missing checks remain material.
4. **Release operator:** after explicit authorization, publish Release using existing FolderProfile.pubxml to the Desktop staging directory; review output/exclusions and the npm install target before use. Back up IIS, preserve production database/configuration/Data Protection keys, and manually copy reviewed files only after separate approval. Keep a verified previous deployment for rollback. No migration is required by the targeted fixes; actual live schema parity remains unverified.
5. **You + all three administrators:** agree a maintenance/rollback window, stop active edits, and perform approved read-only post-release access checks. Deployment requires a separate go/no-go decision after the above evidence; nothing has been deployed.

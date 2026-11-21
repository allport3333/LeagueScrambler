# UI and password reset email verification

Verified on 2026-11-21, on `master`. Existing uncommitted schedule and management work was preserved. No commit, merge, push, deployment, production change, database write, real password change, or external email was performed for these improvements.

## What existed and what was completed

The application already had the four Scrambler rule bindings, dashboard data and navigation, roster dialogs, the player browser/import workflows, and password reset token generation, expiry and consumption. Their existence did not establish that the requested presentation was complete. The missing presentation changes, HTML email integration, and latest saved K/Q week default were implemented and tested against rendered Angular components.

The latest instructions supersede the earlier request for a collapsible Scrambler Setup: Setup is now permanently visible, and only Scramble Rules collapses. Screenshots of a collapsed Setup are intentionally inapplicable.

## Implementation

### Scrambler

- Removed obsolete Setup visibility state, handler, hidden bindings and controls. Scrambler Setup is a normal centered heading; Team Configuration, Player Selection and Player Balancing remain available.
- Added a native, initially closed Scramble Rules disclosure immediately below Team Configuration. The complete header is clickable and keyboard accessible, with explicit expanded semantics and a centered title/adjacent chevron.
- Enabled rules are discoverable through an enabled-option count. Collapsing preserves all four values, team configuration and selected players; checkbox defaults are unchanged.
- Expanded settings use two compact columns on desktop and one on mobile, with each explanation beside its associated control.
- No algorithm, historical restriction, matchup pairing or save contract changes.

### Home dashboard

- Recent Game Scores now has separated date, opponent, prominent score and textual result columns; compact mobile rows preserve the same information. Zero scores and unavailable result labels are handled explicitly.
- Upcoming Schedule uses separate date/week and emphasized opponent areas with compact row dividers. Existing schedule query parameters, next-game roster buttons and View Game History remain.
- Kept the bordered standings table and all dashboard information, with consistent headings and subtle section separation. Data retrieval and calculations were not changed.

### K/Q Matchups

- A small pure helper selects the most recent saved matchup using its actual game date, then existing number/ID ordering for ties or missing dates. It does not assume the largest scramble number is latest.
- Uses the existing league-scoped finalized-scrambles response; defensive filtering excludes explicit unsaved placeholders. No future schedule-only week is fabricated.
- Initial browsing and league changes choose the latest available saved week. A deliberate older selection survives same-league refreshes. Explicit score/history deep links retain priority.
- Equivalent navigation emissions and query-only navigation reuse existing metadata to avoid redundant list requests. Empty and single-week leagues are supported.

### League management

- Current League Players has a centered search field capped at 520px, with division filtering and Show/Hide All Players together below. The roster remains wider and retains editing and removal actions.
- Browse Existing Players has a dedicated search row capped at 680px, a separate gender/division/count toolbar, and both total available and shown counts. Header and controls remain outside the scrolling grid.
- Existing immediate additions, captured division selection, server-confirmed removal from the available grid, duplicate safeguards, and open-modal behavior are preserved. No membership endpoint changes.
- Fixed the underlying roster button selector specificity so the existing global management form rule cannot override its intended aligned control height.

### Password reset email

- Added `Services/PasswordResetEmail.cs` and wired the existing controller sender to it. The real sending method constructs both UTF-8 plain text and HTML alternate views, plain first and HTML last.
- Branded inline navy/blue table markup includes a reset button, mobile viewport support and an Outlook conditional width wrapper. The HTML does not display a long raw reset URL; the plain alternative includes the usable link.
- Trusted origin defaults to `https://www.allportsleaguehub.com`. `LEAGUESCRAMBLER_PUBLIC_BASE_URL` accepts that public HTTPS origin or HTTPS loopback only in Development. Untrusted hosts, credentials, paths, queries and fragments are rejected; request Host headers are not used.
- The existing `/resetpassword` route and URL-encoded token are preserved. Expiry wording uses the same one-hour lifetime supplied by the controller.
- Existing token generation, validation, reset persistence and one-time consumption methods were preserved byte-for-byte after newline normalization. Diagnostics omit token values, credentials and provider exception text.
- Updated `.env.example` and `LOCAL_DEVELOPMENT.md`; actual SMTP credentials, local `.env` and production configuration were not changed.

## Running application

Read-only inspection confirmed the original Visual Studio Development application on `https://localhost:5001`, PID 21540, started at `2026-11-21T14:25:55.8759140Z`, using the original repository's Debug `netcoreapp2.2/ASP.NET Core 2.2 with Angular 7.dll`.

The verified Development connection was Windows-authenticated `localhost` / `LeagueScramblerDev`. No mutation authorization was requested or used for this UI/email verification. Only the identified original debug application was rebuilt/restarted; unrelated processes were not terminated.

The final main browser run fetched assets from this running Development application with service workers disabled, rather than relying only on a separate build directory. API and authentication responses were intercepted with synthetic fixtures; this is rendered application verification, not real-account login testing. The player-toolbar suite used the freshly built Development assets with the same fixture isolation.

## Results

| Check | Result and evidence |
|---|---|
| Angular Development build | Passed; `frontend-development.log` |
| Angular production build | Passed; `frontend-production.log` |
| Backend and isolated email test build | Passed; `backend-build.log`, `email-build.log` |
| Main live-asset browser suite | Passed, 6 test groups, zero page errors; `live-browser-results.json` |
| Player toolbar/browser and editing regressions | Passed, 3 groups, zero page errors; `player-toolbars/results.json` |
| K/Q default/refresh/deep-link tests | Passed, 5 groups; `kq-default-results.json` |
| Email origin/template/token/sender tests | Passed, 4 groups; `email-results.json` |
| Existing schedule component regression suite | Passed, 18 groups after the prior date-field change |
| Token security preservation | 3 unchanged-method hash checks passed; `security-preservation.json` |
| Git whitespace check | Passed; Git reported line-ending normalization warnings only |

### Responsive and interaction measurements

Scramble Rules and management controls were checked at 320, 375, 430, 768, 1280, 1920, 2560 and 3440px. Rules heading/chevron group centering differed by less than 2px from its header center; collapsed disclosure height remained under 72px. Expanded columns were two on desktop and one on mobile. No page, grid or player-button horizontal overflow was detected.

| Viewport | Browser grid columns |
|---:|---:|
| 320 | 2 |
| 375 | 3 |
| 430 | 3 |
| 768 | 5 |
| 1280 | 8 |
| 1920 | 12 |
| 2560 | 17 |
| 3440 | 23 |

The browser fixture contained 599 available players, including duplicate names with different IDs and long compound names. Tests exercised combined name/gender filtering, Gold then Silver addition, pending/success behavior, persistent dialog controls while scrolling, roster searching, division filtering, and Show All. Existing name/division edits and removal confirmation cancel/confirm were exercised through intercepted service contracts, retaining player identity and a second league view. These are not database persistence claims.

Scrambler interaction checks generated all 24 selected synthetic players, saved through the intercepted existing contract, opened Matchups and Modify Teams, cancelled modification without changing membership, and produced the application's printable markup. OS print dialogs and physical printing were not exercised. The large statistical algorithm suite was not rerun because no algorithm changed.

K/Q tests used a saved number 2 dated later than saved number 10, plus an unsaved future number 99. Number 2 was selected initially, 99 excluded, manual number 10 retained on refresh, and switching to single-week/empty leagues and back selected each appropriate default. Saved 15/10 scores and winner data were preserved.

Home checks at 375, 430, 768, 1280, 1920 and 2560px retained 25/Won, 19/Lost and 0/result-unavailable scores, all three upcoming games and their navigation parameters. The actual opponent roster dialog opened with the correct synthetic players.

The previous First Game Date request was additionally verified at 375, 430, 1280 and 1920px: manual ISO date entry, calendar selection, matching field heights, rectangular borders, inside-right calendar icon, viewport-bounded popup, invalid-date rejection and unchanged local calendar dates in generated schedules all passed. There was no UTC conversion.

### Email verification boundary

The exact private controller sender was invoked with its existing injected `SmtpClient` using **local pickup transport**, not Gmail SMTP. The generated `.eml` was verified as `multipart/alternative` with plain text first and HTML last. No real recipient/account lookup or external delivery occurred. Preview artifacts contain only an intentionally invalid placeholder token.

The existing token validator accepted current and 59-minute tokens and rejected 61-minute, future, malformed and missing tokens. One-time reset persistence code was checked unchanged; an actual account reset/reuse attempt was deliberately not performed.

HTML previews were checked at 375, 768 and 1280px. Gmail/Outlook client rendering, inbox receipt, a real email click and complete real-account password reset remain unverified. The local Development origin remains localhost by design. Before production deployment, confirm the production environment's existing `LEAGUESCRAMBLER_PUBLIC_BASE_URL` is absent (canonical default) or the canonical public HTTPS origin; an invalid production localhost setting now fails safely instead of sending unusable links.

Existing obsolete-runtime/package and MVC analyzer build warnings remain in the logs. This task did not upgrade the framework or dependencies.

## Screenshots and detailed artifacts

All detailed logs/results are under [ui-email-improvements](../../tests/functional/artifacts/ui-email-improvements/).

- Rules collapsed: [desktop](../../tests/functional/artifacts/ui-email-improvements/setup-visible-rules-collapsed-1920.png), [mobile](../../tests/functional/artifacts/ui-email-improvements/setup-visible-rules-collapsed-375.png).
- Rules expanded: [desktop](../../tests/functional/artifacts/ui-email-improvements/rules-expanded-1920.png), [mobile](../../tests/functional/artifacts/ui-email-improvements/rules-expanded-375.png).
- Latest saved K/Q week: [desktop](../../tests/functional/artifacts/ui-email-improvements/kq-latest-1920.png); [manual older week on mobile](../../tests/functional/artifacts/ui-email-improvements/kq-manual-375.png).
- Roster controls: [desktop](../../tests/functional/artifacts/ui-email-improvements/player-toolbars/roster-controls-1920.png), [mobile](../../tests/functional/artifacts/ui-email-improvements/player-toolbars/roster-controls-375.png).
- Browse players: [desktop](../../tests/functional/artifacts/ui-email-improvements/player-toolbars/browser-toolbar-1920.png), [mobile](../../tests/functional/artifacts/ui-email-improvements/player-toolbars/browser-toolbar-375.png), [3440px](../../tests/functional/artifacts/ui-email-improvements/player-toolbars/browser-toolbar-3440.png).
- Dashboard scores/schedule: [desktop](../../tests/functional/artifacts/ui-email-improvements/home-scores-schedule-1920.png), [mobile](../../tests/functional/artifacts/ui-email-improvements/home-scores-schedule-375.png).
- Email: [desktop HTML](../../tests/functional/artifacts/ui-email-improvements/email-html-1280.png), [mobile HTML](../../tests/functional/artifacts/ui-email-improvements/email-html-375.png), [plain text](../../tests/functional/artifacts/ui-email-improvements/email-plain-text.png).

## Main implementation files

- `ClientApp/src/app/scrambler/scrambler.component.{ts,html,less}`: setup visibility removal, compact centered Rules disclosure, roster control layout.
- `ClientApp/src/app/player-home-dashboard/player-home-dashboard.component.{html,css}`: scores, upcoming games and section hierarchy.
- `ClientApp/src/app/kqmatchups/kqmatchups.component.{ts,html}` and `latest-saved-week.ts`: saved-date default and navigation preservation.
- `ClientApp/src/app/league-management/existing-player-browser.component.{html,css}`: browser search/filter toolbar.
- `Controllers/LoginController.cs`, `Services/PasswordResetEmail.cs`: actual HTML/plain sending and trusted origin handling.
- `tests/functional/scripts/ui-email-improvements.cjs`, `kq-default-week.cjs`, `player-toolbar-ui.cjs`, extensions to the existing browser/player-tab harnesses, and this directory's isolated .NET email verification utility.

Implementation and fixture/browser verification are complete. Live recipient delivery, real-account authentication/reset and physical-device/email-client testing are the remaining verification boundaries; they are not claimed as passed.

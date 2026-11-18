# LeagueScrambler / Allport's League Hub — UX audit

Date: 2026-11-17. Inspection/recommendation only. **No application UI, CSS, authentication, database, IIS, Cloudflare or publishing changes were made.** The existing 36-pass/0-fail/2-accepted-blocked functional baseline is historical context; the functional suite was **not rerun**.

## Overall assessment

The application has substantial, useful league-running capability and a recognisable volleyball identity. Desktop users who already know the terminology can find productive tools. The largest weaknesses are discovery for newcomers and operating dense league-night screens on a phone—not a need for a fashionable reskin or a new framework.

Prioritise the player picker, mobile scoring/scrambling, league context and accessibility before broad visual polish. Preserve the distinctive logo/navy-blue palette, division grouping, useful desktop tables, public nonpersisting previews, and the sophisticated balancing/King-and-Queen options. Offer progressive disclosure rather than deleting expert functionality.

This is an expert inspection, not a study with recruited users. Counts below are observations/approximations, not measured conversion rates or invented completion times. No independently confirmed Critical end-to-end workflow blocker was established under this read-only scope. Findings: **7 High, 10 Medium, 3 Low**. Automated engine severity is different from this user-impact priority.

## Read this evidence distinction first

**A — live public observation:** Production homepage, anonymous navigation and login/register form presentation were exercised in a fresh browser, with no production submission/authentication experiment. Only explicitly safe anonymous authentication-status GETs could reach its API; other API reads were replaced with empty display responses. These pages expose no real player information in screenshots.

**B — local rendered layout preview:** The existing Visual Studio application was started locally. The established read-only process inspector verified PID 3380, Development, localhost / LeagueScramblerDev with Windows Authentication. No mutation authority was renewed or reused. Browser interception supplies synthetic league/player/score data; all API data in these previews is fabricated **in the browser only**, not SQL. For protected layouts, the existing client navigation subject was explicitly modelled as post-login through Angular's Development debug API. This is NOT server authentication, a bypass of server authorization, or a claim that those role workflows completed with real credentials.

**C — source-supported / inaccessible:** Actual legacy unlock, actual account registration/claiming, saved scoring/scrambles, real-session refresh/expiry, database failure semantics and concurrent administrators were not exercised. The shared legacy password was never requested, retrieved, entered or exposed. Recommendations derived from source or fixtures say so. Previous functional passes do not turn these audit previews into new end-to-end tests.

## Safety and reproducibility

- Reused portable Node 22, Playwright 1.51.1 and its installed Chromium; no system Node 10/Angular/package changes or framework migration.
- Standalone axe-core 4.10.3 downloaded only into tests/ux/tools; no application dependency installation. All custom audit harness/output files are under tests/ux. The existing read-only inspector updated only its normal nonauthorizing inspection metadata.
- Every browser non-GET request was blocked. Development hot-reload POSTs and one deliberately simulated local login-error request were aborted; **zero API writes were forwarded**. No SQL query or record creation was needed for the audit. No real account credentials/cookies were used.
- No production IIS/process restart, configuration or file inspection/change was performed. Starting local Visual Studio is separate from the live IIS site.
- Display data uses Sample Player labels and example.invalid email only. Email/phone links and schedule cells are masked when applicable. No real credentials, shared passwords, tokens, cookie stores, HARs or historical regression traces are included in the review ZIP.
- 114 screenshots are indexed with source/role/state. Scans are Chromium viewport checks, not real iOS/Android testing. Native keyboards, Safari, screen-reader operation, 320px/400% zoom, printing, offline/reconnect and large real datasets were not fully tested. No WCAG compliance certification is claimed.

## Coverage by workflow

| Area | Evidence mode | Coverage / limit |
|---|---|---|
| Homepage/new visitor | Live production anonymous | All five sizes; Login/Register/Cancel/navigation; no submission |
| Login/registration | Live production forms + local validation/error display | Blank public forms; local synthetic email/blank-password keyboard check; no real account login or creation |
| Create/claim player | Local display-only form preview | Existing client form; 16 synthetic suggestions, keyboard path, Create workaround; no registration/claim/save |
| Returning player | Local synthetic post-login layout + source | Navigation/profile/tabs/context; actual cookie persistence and refresh require owner confirmation |
| Players/roster | Local Manager layout preview | Male/female lists and form affordances; real roster updates not executed |
| League selection/dashboard | Local Player/Manager layouts | Selector, tabs, division standings; synthetic league data only |
| League creation/divisions | Local Manager forms + source | Nested Add League/Add Division forms, no submit |
| League settings | Setup access point + source only | Actual Modify Settings pane not reliably opened by audit automation; source reviewed; no value changed/saved |
| Player sign-in | Local Player layout | Signed-in list and entry affordances; no check-in/lock writes |
| Scramble configuration/results | Local UI + actual public client algorithm | Synthetic selection, actual preview button/algorithm, no persisted teams |
| Team management | Local Manager layout | Create-team/add-member and League Teams tabs, no mutations |
| Score entry | Local Manager layout | Default multi-game cards/date/submit position; no score saved |
| Standings/rankings | Local synthetic populated tables | Round/division/gender views, scroll geometry; no arithmetic rerun |
| King/Queen formats | Local existing retrieval renderer + synthetic response | Match/team/round results captured; no live saved scramble or score update |
| Legacy administrator | Anonymous locked screen + source only | No shared password requested/read/entered; successful unlock and session restoration NOT tested |
| Errors/validation | Local simulated request abort and invalid email | Rendering/copy only; not a real backend failure or authentication test |
| Loading/empty states | Empty views captured; loading source-reviewed | Transient delayed-read loading capture was not reliable; no real performance conclusion |

## Responsive findings

| Requested CSS viewport | Captured states | States with page-width overflow |
|---|---:|---:|
| 1920 × 1080 | 15 | 0 |
| 1366 × 768 | 22 | 0 |
| 768 × 1024 | 20 | 0 |
| 390 × 844 | 19 | 4 |
| 375 × 667 | 38 | 12 |

Counts include different states/full-page views, not independent defects or devices. At 375px the Manager score layout is 425px wide (+50px), and the Scrambler is 433px (+58px). The populated score page is about 1259px tall; the Scrambler and nested setup views are about 2076–2335px. Table-only overflow is different: the standings page can fit while totals remain offscreen inside a scroll region. Desktop/tablet views are substantially more workable, but the two-row manager menu at 1366px and nested tabs still impose cognitive load.

## Approximate interaction friction

An activation/field entry means a click/tap or entering a field, not a keystroke. Counts vary with preselection, role and branch, exclude waiting, and are not user-study timing. Mutating endpoints were not called to finish these estimates.

| Workflow | Approximate interactions | Friction / caveat |
|---|---|---|
| Find public scores from homepage | No visible direct route discovered in anonymous menu | First visit only reveals Home/F.A.Q and authentication; owner must decide intended public destinations |
| Sign in to an account | ~4: open Login, fill 2 fields, submit | Enter did not submit in local frontend check; actual sign-in not executed |
| Register then claim an existing player | ~10: open + 5 fields + submit, then search/select/confirm | Modelled from UI/source; matching/general branches vary; not timed or executed end-to-end |
| Create a new player after registration | ~5–7 more activations/field entries, branch dependent | Suggestion overlay can hide Create; a no-match query was needed in the fixture |
| Manage a league/division | ~5–8 plus scrolling/tab pagination | Setup is inside Scrambler/nested tabs; creation/save not performed |
| Run a basic scramble | ~6–10 plus player selection, setup dependent | Selection was supplied synthetically to inspect preview; this is an estimate, not measured task completion |
| Enter a 3-game match | ~11–15 activations/field entries plus mobile scrolling | 2 team selections, 6 scores, optional date, navigation/save; no save executed |
| View current standings on phone | ~3–5 from established navigation; more for filters | Source-supported refresh/context issue can interrupt this path; real returning-user session untested |

## Functional observations versus design preferences

The player suggestion overlay obstructing a normal Create action and login Enter behavior were reproduced in local client rendering without writes (UX-02, UX-09). The custom claim modal's focus escape/semantics is also directly observed (UX-07). Navigation refresh/session restoration is a **source-supported risk** reproduced in modelled client state, not a live authenticated-session defect declaration (UX-05). No business-rule, authorization or database defect is asserted from a fabricated/empty response. CSS style consistency is explicitly a preference/opportunity (UX-18).

## Prioritised findings

### UX-01 — Give a new visitor a useful first action beyond authentication

**Priority:** High · **Screen:** Homepage and public navigation

**Class / confidence:** Observed usability issue. High: live anonymous production browser.

**Problem:** The first screen is largely a large logo plus Login, Register and Forgot Password. The anonymous navigation exposes Home and F.A.Q, without an obvious league, scores, standings or check-in entry. There is no explanatory heading describing what a new visitor can do.

**Evidence:** [home_visitor_laptop-1366x768_production.png](screenshots/home_visitor_laptop-1366x768_production.png); [navigation_visitor_mobile-375x667_production.png](screenshots/navigation_visitor_mobile-375x667_production.png)

**User impact:** A new player needs prior instructions or assumes every task requires account creation. Friends checking results cannot discover the relevant public route from this landing page.

**Proposed improvement:** Retain the logo and add a short purpose statement and permission-appropriate task links: Find a league, Scores & standings, and Sign in to my account. Keep management private. Decide with the owner which already-public views should be discoverable rather than widening access automatically.

**Complexity:** Small–medium: content and navigation; no scoring rewrite. **Functional risk:** Medium: public/private destinations and deep links must retain existing authorization.

**Future acceptance check:** A first-time visitor can identify the site purpose and find an intended public result view without being told a URL.

### UX-02 — Bound player-search suggestions and keep Create/Close reachable

**Priority:** High · **Screen:** Player claiming after registration

**Class / confidence:** UI interaction defect reproduced with synthetic display data. High for this 16-result fixture; real account creation not performed.

**Problem:** At 375px, the suggestions overlap the action area; a normal Create New Player click was intercepted by a player suggestion. Names truncate to nearly identical Sample Play… labels. Clearing the query returns all players again, so that is not a reliable dismissal mechanism. A no-match query made Create reachable.

**Evidence:** [claim-picker_new-player_mobile-375x667_local-form-preview.png](screenshots/claim-picker_new-player_mobile-375x667_local-form-preview.png); [player-create_new-player_mobile-375x667_local-form-preview.png](screenshots/player-create_new-player_mobile-375x667_local-form-preview.png)

**User impact:** A newcomer can select the wrong person, fail to find the create action, or abandon claiming. The workaround is not discoverable.

**Proposed improvement:** Use a bounded listbox/autocomplete with wrapped names, a clear dismissal path and a separate persistent Create New Player action. Show only existing non-sensitive context needed to distinguish matches. Preserve exact ownership/duplicate-claim checks and explicit confirmation.

**Complexity:** Medium: picker and overlay layout. **Functional risk:** Medium: selection/automatic-claim state and duplicate rejection must be regression-tested.

**Future acceptance check:** With at least 16 matches at 375px, all results remain distinguishable and Create/Close work without clearing or inventing a query.

### UX-03 — Make mobile score entry fit and pair opponents by game

**Priority:** High · **Screen:** Team Management → Enter Team Scores

**Class / confidence:** Observed layout defect plus design recommendation. High for geometry; saving was not attempted.

**Problem:** The 375px layout has a 425px document width. Tabs and fields are clipped sideways; two opponent cards become vertically separated. Even the default three games require comparing scores across separated sections, with the save action below the first viewport.

**Evidence:** [scoring-populated_manager_mobile-375x667_local-role-layout-preview.png](screenshots/scoring-populated_manager_mobile-375x667_local-role-layout-preview.png); [scoring-populated_manager_laptop-1366x768_local-role-layout-preview.png](screenshots/scoring-populated_manager_laptop-1366x768_local-role-layout-preview.png)

**User impact:** Courtside entry requires scrolling and remembering which opponent/game is being edited; accidental transposition is more likely.

**Proposed improvement:** Preserve the useful two-team comparison on desktop. On phones, show one match card with Game 1/2/3 rows and adjacent scores for both teams, an explicit date, and a readable review/save action. Remove page-level overflow; do not change scoring rules or payloads.

**Complexity:** Medium. **Functional risk:** Medium–high: game indexing, paired score submission, date and standings updates must remain unchanged.

**Future acceptance check:** At 375px and 390px there is no page-wide horizontal scroll, and each pair of game scores can be entered together.

### UX-04 — Separate the basic scramble task from advanced configuration

**Priority:** High · **Screen:** Scrambler input and preview

**Class / confidence:** Observed layout/usability issue. High for rendered controls; full setup completion not timed.

**Problem:** The mobile Scrambler reaches 433px document width at a 375px viewport. Max Team Size, Number of Teams, random/lock options and advanced top-player controls occupy the top; major buttons clip, and management/retrieval tools continue down a long page.

**Evidence:** [scrambler-populated_manager_mobile-375x667_local-role-layout-preview.png](screenshots/scrambler-populated_manager_mobile-375x667_local-role-layout-preview.png); [scramble-preview_visitor_375x667_local.png](screenshots/scramble-preview_visitor_375x667_local.png)

**User impact:** The league-night operator must scan many expert options before taking the common action, with uncertainty about which team-count control is active.

**Proposed improvement:** Offer a basic sequence: league/session → signed-in players → team size or number of teams → preview. Put advanced balancing and top-player settings in a clearly labelled expandable section, preserving every existing option and an expert view.

**Complexity:** Medium–large, staged. **Functional risk:** High if selection/balancing state is changed; begin with layout/disclosure only.

**Future acceptance check:** The normal preview path is visible and readable on a phone without exposing every advanced option or losing the existing algorithm.

### UX-05 — Restore navigation and league context when a session page is refreshed

**Priority:** High · **Screen:** Returning-user deep links and navigation

**Class / confidence:** Source-supported functional risk, not a real-session authentication test. Medium–high: fixture browser plus source; needs owner confirmation with an actual session.

**Problem:** Direct-entry fixture pages can show Player/Manager component content while the navbar still shows only Home/F.A.Q and lacks league selection. AuthService starts its BehaviorSubject at false, AppComponent does not hydrate it, and NavMenu depends on it. League selection is also an in-memory BehaviorSubject. The paired screenshot shows the expected post-login layout after deliberately modelling that client state.

**Evidence:** [standings_player_laptop-1366x768_local-display-fixture.png](screenshots/standings_player_laptop-1366x768_local-display-fixture.png); [standings-populated_player_laptop-1366x768_local-role-layout-preview.png](screenshots/standings-populated_player_laptop-1366x768_local-role-layout-preview.png)

**User impact:** A returning player may appear logged out or lose the working league after refresh, despite an otherwise valid server session; some direct views are blank or ambiguous.

**Proposed improvement:** Verify this exact real-session refresh case first. If confirmed, initialize the navigation from existing read-only session endpoints and restore/validate a selected league. This is UI-state restoration, not a new cookie, role, password or authentication system.

**Complexity:** Medium. **Functional risk:** Medium–high: preserve ordinary/legacy distinctions and reject stale or unassigned league selections.

**Future acceptance check:** An actually authenticated user can refresh a permitted deep link and retain correct navigation/context without changing authentication behavior.

### UX-06 — Keep mobile standings readable and keyboard-scrollable

**Priority:** High · **Screen:** Player standings and league dashboard

**Class / confidence:** Observed usability/accessibility issue. High for synthetic populated tables and axe result.

**Problem:** The outer page fits, but standings columns continue inside a narrow horizontal region; total points/wins disappear to the right. Nested Overall/Division and Men/Women tabs compete for width. Axe flags scrollable-region-focusable on some table states.

**Evidence:** [standings-populated_player_mobile-390x844_local-role-layout-preview.png](screenshots/standings-populated_player_mobile-390x844_local-role-layout-preview.png); [dashboard_player_mobile-390x844_local-display-fixture.png](screenshots/dashboard_player_mobile-390x844_local-display-fixture.png)

**User impact:** A phone user cannot easily compare rank, name and useful totals together; keyboard users may struggle to reach the horizontal region.

**Proposed improvement:** Keep desktop/print tables. Use a concise mobile summary with rank/name/essential total visible, optional detail expansion and clear scroll affordance. Where full tables remain, make the labelled scroll container keyboard-operable and consider a pinned identifier column.

**Complexity:** Medium. **Functional risk:** Medium: preserve sort order, round/matchup meaning, divisions, adjustments and printed output.

**Future acceptance check:** A user can read their rank and essential total without sideways hunting, and can keyboard-scroll any remaining full table.

### UX-07 — Use the existing accessible dialog pattern for the custom claim overlay

**Priority:** High · **Screen:** Claim a Player modal

**Class / confidence:** Observed accessibility defect in a display-only form. High: keyboard and DOM inspection.

**Problem:** The custom overlay has no dialog role. During 24 Tab steps, five focus stops were outside it, including background actions. Axe also reports mat-option required-parent issues. This is not equivalent to the application’s existing Material confirmation-dialog pattern.

**Evidence:** [claim-picker_new-player_mobile-375x667_local-form-preview.png](screenshots/claim-picker_new-player_mobile-375x667_local-form-preview.png)

**User impact:** Keyboard/screen-reader users can lose context or operate background controls while the overlay is visually active.

**Proposed improvement:** Reuse an appropriate existing Material dialog/listbox pattern, give the dialog a name, move focus inside it, constrain focus while open, and restore focus on close. Retain explicit claim confirmation and the current backend ownership validation.

**Complexity:** Medium. **Functional risk:** Medium: cancellation, search selection and automatic claiming must continue correctly.

**Future acceptance check:** Tab stays within the active dialog, Escape/Cancel works predictably, the title is announced, and focus returns to the trigger.

### UX-08 — Move league setup out of the Scrambler’s nested tool tabs

**Priority:** Medium · **Screen:** League creation, divisions and settings

**Class / confidence:** Observed information-architecture issue. High for location and layout; no creation/settings save tested.

**Problem:** Add League/Add Division are nested below the scramble configuration in management tabs. At 375px those pages are approximately 2076–2335px tall, with tab pagination adding navigation friction. An Add Player tab could not be directly tapped without navigating pagination.

**Evidence:** [add-league_manager_mobile-375x667_local-role-layout-preview.png](screenshots/add-league_manager_mobile-375x667_local-role-layout-preview.png); [add-division_manager_mobile-375x667_local-role-layout-preview.png](screenshots/add-division_manager_mobile-375x667_local-role-layout-preview.png); [league-settings-accesspoint_manager_375x667_local-layout-preview.png](screenshots/league-settings-accesspoint_manager_375x667_local-layout-preview.png)

**User impact:** Occasional managers struggle to discover setup tools, and routine setup requires unrelated scrolling through play controls.

**Proposed improvement:** Provide a permission-appropriate Manage League entry with Players, Divisions and Settings. Keep existing routes/actions available initially; do not rewrite ownership or the shared-password unlock workflow.

**Complexity:** Medium. **Functional risk:** Medium: existing league ownership, Manager scope and unlocked administration must remain intact.

**Future acceptance check:** An authorized manager can discover league setup without passing through scramble controls.

### UX-09 — Make login behave like a standard keyboard-friendly form

**Priority:** Medium · **Screen:** Login and form validation

**Class / confidence:** Observed local UI behavior, no login sent. High for frontend observation.

**Problem:** With a syntactically valid synthetic email and blank password, Submit remains enabled. Enter from the password field did not submit. Source uses click-driven login fields rather than a form submit handler. Registration provides some inline feedback but differs from login.

**Evidence:** [login-validation_visitor_mobile-375x667_local.png](screenshots/login-validation_visitor_mobile-375x667_local.png); [registration-validation_visitor_mobile-375x667_local.png](screenshots/registration-validation_visitor_mobile-375x667_local.png)

**User impact:** Keyboard users hit a dead end with Enter, and users receive avoidable submit-time errors instead of clear required-field feedback.

**Proposed improvement:** Use a semantic form/submit interaction, keep server validation, and present accessible required-field and format feedback. Add suitable email/inputmode and autocomplete hints. Do not change credential requirements or expose account existence.

**Complexity:** Small–medium. **Functional risk:** Low–medium: preserve current account-neutral errors, throttling and security checks.

**Future acceptance check:** Enter submits valid local form input; missing required values are explained clearly, and autofill/password managers receive appropriate hints.

### UX-10 — Raise text contrast without changing the brand palette

**Priority:** Medium · **Screen:** Navigation, tabs and helper labels

**Class / confidence:** Automated accessibility finding with visual confirmation. High for sampled states; not a complete compliance assessment.

**Problem:** Axe measured enabled production navbar text at 4.22:1 (#9a9da0 on #343a40) and some normal-size tab text at 4.29:1 (#7a7a7a on white), below 4.5:1. Some helper text also needs review. Disabled controls and logo text have different exceptions and are not blanket failures.

**Evidence:** [home_visitor_desktop-1920x1080_production.png](screenshots/home_visitor_desktop-1920x1080_production.png); [scoring-populated_manager_mobile-375x667_local-role-layout-preview.png](screenshots/scoring-populated_manager_mobile-375x667_local-role-layout-preview.png)

**User impact:** Reduced readability outdoors and for people with low vision; subtle selected/unselected states become harder to see.

**Proposed improvement:** Adjust a small shared set of foreground/background tokens and selected/focus styles. Preserve navy/blue identity and strong Gold/Silver grouping; validate actual text sizes and states rather than replacing the palette.

**Complexity:** Small. **Functional risk:** Low, provided disabled/selected/focus distinctions are retained.

**Future acceptance check:** Sampled enabled text meets its applicable contrast threshold, including focus/selected states, without relying on color alone.

### UX-11 — Make failure feedback actionable and avoid blocking the next step

**Priority:** Medium · **Screen:** Login errors and global notifications

**Class / confidence:** Observed simulated-error rendering plus source review. High for displayed message; server failure not caused or tested.

**Problem:** A deliberately aborted local request produces a generic Login Failed notice. Source uses the same generic copy for most non-429 failures, and error snackbars omit a duration. A persistent overlay can obstruct controls unless explicitly closed.

**Evidence:** [login-error_visitor_mobile-375x667_simulated-network-failure.png](screenshots/login-error_visitor_mobile-375x667_simulated-network-failure.png)

**User impact:** Users cannot distinguish a connection problem from bad input and may repeatedly retry. The message competes with the form instead of guiding recovery.

**Proposed improvement:** Keep account-neutral wording but distinguish retryable connection failures from input problems; anchor errors to the task, announce them accessibly and keep controls reachable. For saved data, show an explicit success state and what was saved rather than implying a failed operation succeeded.

**Complexity:** Small–medium. **Functional risk:** Medium: avoid leaking backend/SQL/account details or altering retry semantics.

**Future acceptance check:** A user can identify the next safe action, dismiss the message by keyboard, and continue without covered controls.

### UX-12 — Explain empty, unselected and unavailable states separately

**Priority:** Medium · **Screen:** Standings, schedules, teams and profile statistics

**Class / confidence:** Observed display-fixture state plus design recommendation. Medium: data availability and real permissions were not exercised.

**Problem:** Some direct-entry views show empty tables or a selector with little explanation. The user cannot tell whether no league is selected, no results exist, a filter is empty, or data failed. Zero profile statistics in these fixtures must not be interpreted as a production defect.

**Evidence:** [standings_visitor_mobile-390x844_locked_local.png](screenshots/standings_visitor_mobile-390x844_locked_local.png); [schedule_anonymous_mobile-375x667_local-display-fixture.png](screenshots/schedule_anonymous_mobile-375x667_local-display-fixture.png); [profile_player_mobile-375x667_local-display-fixture.png](screenshots/profile_player_mobile-375x667_local-display-fixture.png)

**User impact:** New and returning users can mistake missing context for missing records or a broken site.

**Proposed improvement:** Provide distinct states with a contextual next action: Choose a league, No rounds recorded yet, No results match this filter, or Could not load—retry. Keep authorized creation actions separate from public viewing.

**Complexity:** Small–medium. **Functional risk:** Low–medium: distinguish errors from genuine zero values and respect permissions.

**Future acceptance check:** Each empty state explains its cause and a safe next action without misleadingly promising data.

### UX-13 — Name navigation by user tasks and define league-specific terms

**Priority:** Medium · **Screen:** Manager navigation, player statistics and scramble options

**Class / confidence:** Usability recommendation grounded in rendered labels. High for labels; preference/owner decisions remain.

**Problem:** Team Management is both a top-level destination and an inner tab; League Teams also exists elsewhere. K/Q, Low Player, Bye, Sub Score and Round versus Matchup assume prior league knowledge.

**Evidence:** [scoring-populated_manager_laptop-1366x768_local-role-layout-preview.png](screenshots/scoring-populated_manager_laptop-1366x768_local-role-layout-preview.png); [scrambler-populated_manager_laptop-1366x768_local-role-layout-preview.png](screenshots/scrambler-populated_manager_laptop-1366x768_local-role-layout-preview.png)

**User impact:** Experienced operators can learn it, but a new manager has to guess where scores or settings live and what options mean.

**Proposed improvement:** Keep expert terminology where useful and add concise explanations. Prefer task labels such as Enter Scores and View Standings, with predictable destinations and a short K/Q glossary. Do not rename scoring concepts without owner confirmation.

**Complexity:** Small–medium. **Functional risk:** Medium: terminology changes can confuse existing users; retain familiar names or transitional labels.

**Future acceptance check:** A new manager can locate score entry and distinguish round/matchup standings without external coaching.

### UX-14 — Explain adjusted and dropped scores at the value, not only in the legend

**Priority:** Medium · **Screen:** King/Queen and individual standings

**Class / confidence:** Design opportunity, not a proven color-only WCAG failure. Medium: rendered fixture and source labels.

**Problem:** Dropped/reduced/substitute score conventions require referring back to a compact legend and understanding the calculation. Dense mobile cells hide much of that context.

**Evidence:** [standings-populated_player_mobile-390x844_local-role-layout-preview.png](screenshots/standings-populated_player_mobile-390x844_local-role-layout-preview.png); [kq-results_player_375x667_local-display-fixture.png](screenshots/kq-results_player_375x667_local-display-fixture.png)

**User impact:** A player can distrust the total or ask administrators to explain a correct result.

**Proposed improvement:** Provide an accessible score explanation or expanded row showing raw score, substitute reduction and dropped status in words. Keep all existing calculations, division codes and sort order; retain compact expert/print views.

**Complexity:** Medium. **Functional risk:** High if calculation logic is touched; keep this a presentation-only change.

**Future acceptance check:** A player can explain their displayed total using the UI, without changing any verified arithmetic.

### UX-15 — Reduce repeated entry and uncertainty across registration and claiming

**Priority:** Medium · **Screen:** Registration → profile search → new player

**Class / confidence:** Workflow opportunity requiring post-registration confirmation. Medium: forms inspected separately; no account created in this audit.

**Problem:** The journey spans registration, matching/general pickers, optional new-player entry and confirmation. Both registration and player creation ask for first/last names; the audit did not execute registration and cannot assert whether every post-registration path currently prefills them.

**Evidence:** [registration_visitor_mobile-375x667_production.png](screenshots/registration_visitor_mobile-375x667_production.png); [player-create_new-player_mobile-375x667_local-form-preview.png](screenshots/player-create_new-player_mobile-375x667_local-form-preview.png)

**User impact:** Users may not understand the difference between a login account and a league player record, or may create a duplicate profile.

**Proposed improvement:** Explain the distinction in one sentence and show progress: Account → Find your player → Ready. Reuse supplied names where safe and confirmed, prioritise an existing match, and preserve explicit ownership confirmation.

**Complexity:** Medium. **Functional risk:** Medium–high: auto-claim and duplicate protection must stay unchanged.

**Future acceptance check:** The actual registered-user journey avoids unnecessary name re-entry and clearly explains choosing versus creating a player.

### UX-16 — Use enduring field labels and intention-specific actions

**Priority:** Medium · **Screen:** Player/team forms and mobile actions

**Class / confidence:** Usability recommendation plus partial accessibility findings. Medium–high.

**Problem:** Several actions use generic Submit and some fields lean on placeholder-only naming. Axe also flags an unlabeled text input in the generated scramble preview. Native form buttons are smaller than comfortable courtside controls, while Material controls use a different scale. Tiny hidden Material native inputs are not the actual touch targets and were excluded from violation claims.

**Evidence:** [team-management_manager_mobile-375x667_local-role-layout-preview.png](screenshots/team-management_manager_mobile-375x667_local-role-layout-preview.png); [player-create_new-player_mobile-375x667_local-form-preview.png](screenshots/player-create_new-player_mobile-375x667_local-form-preview.png); [scramble-preview_visitor_1366x768_local.png](screenshots/scramble-preview_visitor_1366x768_local.png)

**User impact:** Users have to infer what data will be saved, and labels can be lost as values are entered.

**Proposed improvement:** Use visible persistent labels and verbs such as Save scores, Add player to this team, Create league. Aim for comfortable ~44px targets where feasible, while recognising WCAG AA’s 24px/spacing rules and exceptions.

**Complexity:** Small–medium. **Functional risk:** Low if event handling and submitted fields remain unchanged.

**Future acceptance check:** Each action states its effect and visible labels remain understandable after values are entered.

### UX-17 — Add a semantic page structure and meaningful image alternatives

**Priority:** Medium · **Screen:** Shared shell and homepage

**Class / confidence:** Accessibility findings; some rules are best-practice checks. High for sampled pages.

**Problem:** The live homepage logo has no alternative text. Many scanned pages lack a main landmark and level-one page heading; profile headings also raise order warnings. Lack of a specific h1 is not by itself a blanket WCAG failure, but the navigation structure is weak.

**Evidence:** [home_visitor_desktop-1920x1080_production.png](screenshots/home_visitor_desktop-1920x1080_production.png); [profile_player_mobile-375x667_local-display-fixture.png](screenshots/profile_player_mobile-375x667_local-display-fixture.png)

**User impact:** Assistive-technology users have less context and fewer efficient ways to move to the task.

**Proposed improvement:** Give the logo a suitable alternative, provide one meaningful page title and main region, a skip link and a sensible heading hierarchy. Use the existing semantic controls/dialog patterns where they already work.

**Complexity:** Small–medium. **Functional risk:** Low: ensure headings do not unintentionally change CSS layout.

**Future acceptance check:** Keyboard/screen-reader users can identify the site/page and jump to main content; decorative images are distinguished correctly.

### UX-18 — Consolidate visual tokens instead of replacing the visual identity

**Priority:** Low · **Screen:** Forms, cards, buttons and spacing

**Class / confidence:** Subjective design preference supported by inconsistency. Design judgement, not a functional defect.

**Problem:** Native grey buttons, blue Material actions, pink accent buttons, large grey panels and differing card/field spacing make related actions look unrelated. This does not mean the working interface needs a fashionable replacement.

**Evidence:** [login_visitor_laptop-1366x768_production.png](screenshots/login_visitor_laptop-1366x768_production.png); [scoring-populated_manager_laptop-1366x768_local-role-layout-preview.png](screenshots/scoring-populated_manager_laptop-1366x768_local-role-layout-preview.png)

**User impact:** A small polish cost is paid on every screen as users relearn action emphasis.

**Proposed improvement:** Keep the volleyball identity, navy/blue, strong division grouping and useful desktop tables. Define a small spacing/type/action system and apply it incrementally to the highest-use screens first.

**Complexity:** Small initially; medium across the site. **Functional risk:** Low–medium: global CSS changes can affect many existing templates.

**Future acceptance check:** The same action importance has consistent styling without removing useful expert controls.

### UX-19 — Keep browser/page identity consistent with League Hub

**Priority:** Low · **Screen:** Browser tab and shared navigation

**Class / confidence:** Observed production naming difference; repository title already changed. High for captured production document.title.

**Problem:** The captured production document title still says Allport’s League Scrambler while the displayed logo says League Hub. The source title was already changed before this audit; this is a deployment-state note, not a request to redo that work.

**Evidence:** [home_visitor_desktop-1920x1080_production.png](screenshots/home_visitor_desktop-1920x1080_production.png)

**User impact:** Bookmarks/tabs and subpages provide inconsistent orientation.

**Proposed improvement:** Include the approved title change in a later separately authorised release and consider a small consistent site identity on interior screens. Do not deploy as part of this audit.

**Complexity:** Small. **Functional risk:** Low.

**Future acceptance check:** Tab/page branding agrees after an authorised release; no authentication or routing change is needed.

### UX-20 — Keep loading feedback proportional and describe its scope

**Priority:** Low · **Screen:** Team scores and data-loading panels

**Class / confidence:** Source-based recommendation; transient screenshot capture limited. Low–medium; no production performance claim.

**Problem:** Source includes a fixed 400px loading wrapper and a 200px spinner. The audit’s delayed-fixture attempt did not reliably capture that transient state, so a mobile overflow or real loading-time failure is not claimed from it.

**Evidence:** [team-scores_visitor_mobile-390x844_locked_local.png](screenshots/team-scores_visitor_mobile-390x844_locked_local.png)

**User impact:** Large or undifferentiated loading overlays can hide context and leave users unsure which task is waiting.

**Proposed improvement:** Review the actual loading state with a controlled delay later: concise labelled status near the affected area, accessible busy/live status, preserved page context, and a retry state for failure.

**Complexity:** Small–medium. **Functional risk:** Low–medium: avoid enabling duplicate saves while requests are pending.

**Future acceptance check:** A controlled slow-read check communicates what is loading and recovers accessibly; no real latency target is invented.


## Accessibility results and manual checks

Automated axe-core checks found **10 rule categories** across repeated states. Do not sum repeated page violations as distinct user defects. The engine's critical label on missing image alternatives/structural ARIA is not the same as an audit Critical workflow-blocker rating.

| Rule | Sample engine impact | Captured states | Interpretation |
|---|---|---:|---|
| color-contrast | serious | 84 | Elements must meet minimum color contrast ratio thresholds |
| image-alt | critical | 23 | Images must have alternative text |
| landmark-one-main | moderate | 111 | Document should have one main landmark |
| page-has-heading-one | moderate | 105 | Page should contain a level-one heading |
| region | moderate | 114 | All page content should be contained by landmarks |
| scrollable-region-focusable | serious | 13 | Scrollable region must have keyboard access |
| heading-order | moderate | 19 | Heading levels should only increase by one |
| aria-required-parent | critical | 1 | Certain ARIA roles must be contained by particular parents |
| listitem | serious | 2 | <li> elements must be contained in a <ul> or <ol> |
| label | critical | 1 | Form elements must have labels |

The live navbar contrast example is 4.22:1 for normal 18px text; the applicable target is 4.5:1. Some Material tab text is 4.29:1. Logo contrast and disabled-text exceptions were not misclassified. The logo lacks alt text; main/page-heading structure needs work. Manual Tab inspection found five out-of-modal focus stops during 24 steps and zero dialog-role elements in the custom claim state. Local login Enter did not submit, and the button remained enabled with a blank password. Actual assistive-technology announcement was not tested.

Touch recommendations should be interpreted carefully: WCAG 2.2 AA 2.5.8 uses 24px or spacing exceptions; ~44px is a useful comfort goal, not a universal AA threshold. Hidden 1px Material native checkbox inputs are not actual pointer targets; no failure count was based on those raw bounding boxes. Similarly, wide data tables can qualify for reflow exceptions, but surrounding controls must still fit and horizontal scrolling needs keyboard access. See evidence/accessibility-summary.json and VIEWPORT_MEASUREMENTS.csv.

## What to preserve

1. Volleyball/League Hub identity and recognisable logo; make it support the task rather than remove it.
2. Gold/Silver division grouping, readable desktop comparison tables and print-oriented views.
3. Current player ownership/claim protection, roles, Manager league scoping and existing shared legacy administration workflow—no new authentication system is proposed.
4. Public preview separated from intentional persisted scramble generation.
5. Team balancing, top/low/bye/substitute options, K/Q rounds and the verified standings arithmetic; hide complexity progressively, do not discard it.
6. Clear team-versus-team desktop score comparison, searchable player selection and existing inline registration mismatch feedback.

## Alternatives grounded in relevant products

These are pattern references, not competitor scoring, purchases, copied screens or instructions to add their entire feature sets.

- **Task/context-first landing:** LeagueApps documents an important-information Home and access to schedules/results. For League Hub, expose current league/date and the next useful action, while preserving current permission boundaries. Do not add messaging/payments/native-app complexity merely because those products have it. [LeagueApps player guide](https://support.leagueapps.com/hc/en-us/articles/1500003303901-LeagueApps-Play-App-Guide-for-Parents-Players).
- **Score entry attached to a match:** TeamSnap places entering/editing results within the schedule/game context. Borrow the clear match identity and explicit save/review, not its feature permissions or notification behavior. This can reduce ambiguity between League Teams, Team Management and scores. [TeamSnap results guide](https://helpme.teamsnap.com/article/594-enter-game-results).
- **Reviewable paired scores:** Playtomic's league guide keeps round/match context and paired set scores before Update. A lightweight League Hub mobile editor can retain opponent identity with each game row; it need not reproduce a large multi-step manager console. [Playtomic league score guide](https://helpmanager.playtomic.com/hc/en-gb/articles/29511711697937-How-to-add-the-score-of-a-League-match).

## Proposed roadmap (not implemented)

See [UX_IMPLEMENTATION_ROADMAP.md](UX_IMPLEMENTATION_ROADMAP.md) for sequencing and acceptance gates. Start with alt text/semantics, contrast, meaningful action labels and bounded picker actions. Next address mobile scoring, table access and league context, then optionally create a task-based league-night view. A full visual rewrite is neither necessary nor justified by this inspection. Effort labels are relative planning estimates, not delivery commitments.

The concept sheet in mockups is **proposal only**, not screenshots of implemented improvements or a functional prototype. It shows a task-based landing, a compact mobile league-night view and paired score rows while retaining the identity. Review it with the owner before choosing any change.

## Remaining inspection limits and future validation

No real Manager/Admin account, actual legacy credential or production mutation was used. The claim UI was opened via an existing local client method, not completed registration. Initial direct-entry previews deliberately show missing client navigation state; post-login previews explicitly model it. Fixtures do not establish true empty-data/backend failure behavior, actual saving confirmations or schema compatibility. The Add Player nested tab needed pagination and was not forced; player creation was inspected through its separate form. The actual Modify Settings pane was not reliably opened by automation: its access point is captured, and settings details are source-only. A loading screenshot attempt was unreliable; loading is source-only, not a measured delay. Earlier audit-script locator/Angular change-detection issues are harness limitations, not site defects.

Before any approved implementation, validate the highest-use tasks with a player, a manager and the three actual administrators in a safe authorised environment. Preserve the existing 36-pass baseline and two accepted blockers, use focused tests for changed UI states, and retain server-side security contracts. Do not weaken CSRF, roles, ownership checks or the frozen legacy workflow for design convenience. No future implementation is authorised by this report.

## Deliverables and references

- [Executive summary](UX_EXECUTIVE_SUMMARY.md), [roadmap](UX_IMPLEMENTATION_ROADMAP.md), [screenshot index](SCREENSHOT_INDEX.md), [visual gallery](SCREENSHOT_GALLERY.html), [contact sheet](CONTACT_SHEET.png), [concept sheet](mockups/CONCEPTS.png).
- Local ZIP: LeagueScrambler_UX_Audit_2026-11-17.zip. It contains reports, screenshots, selected sanitised evidence and concepts, not browser/session traces, production configuration or database artifacts. No hosted upload link is provided by this local workspace; attach the ZIP from tests/ux to ChatGPT.
- Standards: [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). [axe-core project](https://github.com/dequelabs/axe-core). References accessed 2026-11-17; product behavior is drawn from official documentation, not independently tested competitor apps.

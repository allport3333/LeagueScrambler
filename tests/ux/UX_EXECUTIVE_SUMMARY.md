# UX executive summary

2026-11-17. Recommendations only; no application changes. 114 screenshots across all requested viewport sizes. Production observation is anonymous/read-only; protected layouts use explicitly simulated local display data, not actual authentication. The 36-pass functional baseline was not rerun.

## Assessment

Keep the useful league-running tools and volleyball identity. The application serves experienced desktop operators better than newcomers or players using a phone. Highest value comes from discoverability, mobile score/scramble layout, player claiming and reliable context—not a trendy rebuild. No Critical end-to-end blocker was proven under this read-only scope.

## Ten highest-value improvements

| Priority | Finding | Proposed change | Confidence / limit |
|---|---|---|---|
| High | [UX-01](UX_AUDIT_REPORT.md#ux-01--give-a-new-visitor-a-useful-first-action-beyond-authentication) Give a new visitor a useful first action beyond authentication | Retain the logo and add a short purpose statement and permission-appropriate task links: Find a league, Scores & standings, and Sign in to my account. Keep management private. Decide with the owner which already-public views should be discoverable rather than widening access automatically. | High: live anonymous production browser |
| High | [UX-02](UX_AUDIT_REPORT.md#ux-02--bound-playersearch-suggestions-and-keep-createclose-reachable) Bound player-search suggestions and keep Create/Close reachable | Use a bounded listbox/autocomplete with wrapped names, a clear dismissal path and a separate persistent Create New Player action. Show only existing non-sensitive context needed to distinguish matches. Preserve exact ownership/duplicate-claim checks and explicit confirmation. | High for this 16-result fixture; real account creation not performed |
| High | [UX-03](UX_AUDIT_REPORT.md#ux-03--make-mobile-score-entry-fit-and-pair-opponents-by-game) Make mobile score entry fit and pair opponents by game | Preserve the useful two-team comparison on desktop. On phones, show one match card with Game 1/2/3 rows and adjacent scores for both teams, an explicit date, and a readable review/save action. Remove page-level overflow; do not change scoring rules or payloads. | High for geometry; saving was not attempted |
| High | [UX-04](UX_AUDIT_REPORT.md#ux-04--separate-the-basic-scramble-task-from-advanced-configuration) Separate the basic scramble task from advanced configuration | Offer a basic sequence: league/session → signed-in players → team size or number of teams → preview. Put advanced balancing and top-player settings in a clearly labelled expandable section, preserving every existing option and an expert view. | High for rendered controls; full setup completion not timed |
| High | [UX-05](UX_AUDIT_REPORT.md#ux-05--restore-navigation-and-league-context-when-a-session-page-is-refreshed) Restore navigation and league context when a session page is refreshed | Verify this exact real-session refresh case first. If confirmed, initialize the navigation from existing read-only session endpoints and restore/validate a selected league. This is UI-state restoration, not a new cookie, role, password or authentication system. | Medium–high: fixture browser plus source; needs owner confirmation with an actual session |
| High | [UX-06](UX_AUDIT_REPORT.md#ux-06--keep-mobile-standings-readable-and-keyboardscrollable) Keep mobile standings readable and keyboard-scrollable | Keep desktop/print tables. Use a concise mobile summary with rank/name/essential total visible, optional detail expansion and clear scroll affordance. Where full tables remain, make the labelled scroll container keyboard-operable and consider a pinned identifier column. | High for synthetic populated tables and axe result |
| High | [UX-07](UX_AUDIT_REPORT.md#ux-07--use-the-existing-accessible-dialog-pattern-for-the-custom-claim-overlay) Use the existing accessible dialog pattern for the custom claim overlay | Reuse an appropriate existing Material dialog/listbox pattern, give the dialog a name, move focus inside it, constrain focus while open, and restore focus on close. Retain explicit claim confirmation and the current backend ownership validation. | High: keyboard and DOM inspection |
| Medium | [UX-08](UX_AUDIT_REPORT.md#ux-08--move-league-setup-out-of-the-scramblers-nested-tool-tabs) Move league setup out of the Scrambler’s nested tool tabs | Provide a permission-appropriate Manage League entry with Players, Divisions and Settings. Keep existing routes/actions available initially; do not rewrite ownership or the shared-password unlock workflow. | High for location and layout; no creation/settings save tested |
| Medium | [UX-09](UX_AUDIT_REPORT.md#ux-09--make-login-behave-like-a-standard-keyboardfriendly-form) Make login behave like a standard keyboard-friendly form | Use a semantic form/submit interaction, keep server validation, and present accessible required-field and format feedback. Add suitable email/inputmode and autocomplete hints. Do not change credential requirements or expose account existence. | High for frontend observation |
| Medium | [UX-10](UX_AUDIT_REPORT.md#ux-10--raise-text-contrast-without-changing-the-brand-palette) Raise text contrast without changing the brand palette | Adjust a small shared set of foreground/background tokens and selected/focus styles. Preserve navy/blue identity and strong Gold/Silver grouping; validate actual text sizes and states rather than replacing the palette. | High for sampled states; not a complete compliance assessment |

## Preserve

Logo/navy-blue identity, Gold/Silver grouping, desktop/print tables, team balancing and K/Q logic, clear public preview vs save distinction, all verified security/ownership rules, and the existing shared-password administration workflow.

## Mobile and accessibility priorities

375px scoring pages reached 425px width and Scrambler pages 433px. Nested tabs, offscreen totals and a narrow overlapping claim list create the most friction. Fix the missing logo alternative, sampled text contrast, keyboard-accessible scroll regions and the custom claim modal before broad styling. Some axe categories are best practices; this is not a WCAG certificate.

## Effort and next decision

Quick wins: concise landing copy/links, contrast, alt/heading landmarks, meaningful labels and required-field/keyboard form behavior. Moderate: picker/dialog, responsive score rows/tables, consistent league context. Substantial/optional: a task-based league-night hub with progressive expert controls. Do not begin a framework migration or delete useful features. See UX_IMPLEMENTATION_ROADMAP.md.

Review UX_AUDIT_REPORT.md, CONTACT_SHEET.png and the concept sheet; choose a small first phase before authorising code changes. Real account/legacy unlock, actual saving, real-session refresh and loading timing remain unverified.

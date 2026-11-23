# Angular 22 visual regression inventory

## Player disclosure, mobile actions, and Team Scores

The mobile roster had a Material select for commands that act on a player. Replacing it with a menu gives those commands standard keyboard navigation, Escape dismissal, and focus restoration. The Player List heading is the disclosure control. Collapsing it preserves the selection. The Low Player button and legend use the existing Material downward arrow. The active desktop button has a filled background.

At 320 px the first Team Scores revision showed a clipped date and floating score labels even though the page width check passed. The final layout gives the date its own row at that width, labels the toolbar fields above their outlines, and uses shared score column headings. The paired inputs stay aligned alongside their game number. The empty schedule uses a short inline message beside the existing manual entry workflow.

Matching Edge screenshots and geometry results are in `tests/functional/artifacts/modernization/role-management-polish/`. The `roster-before` and `scores-before` folders use the preceding Angular 22 bundle. The `roster-after` and `scores-after` folders use the rebuilt bundle. The source tests use synthetic browser fixtures.

## Scrambler roster and guided configuration follow-up

The earlier responsive sweep missed the space consumed by MDC checkbox margins and desktop actions. The revised roster reserves space for names and centers 16 px icons in 28 px desktop buttons. With the same fixture at 1920 px, the space between the top of the player panel and its first row fell from 198 px to 77 px. The roster uses one column on narrow phones, two at 768 px, five at 1920 px and nine at 3440 px. Short fixture names stayed on one line and longer names used at most two lines at all eight inspected widths.

Team Configuration defaults to Maximum Team Size 4 and shows one active input. The browser verified the original size and count ranges, rejection of 26 teams for 24 players, retention of both values and checked rules when switching modes, and generated teams of the expected sizes through fixture responses. The unchanged engine received only the active setting.

Evidence is in `tests/functional/artifacts/modernization/scrambler-roster-refinement/`. Use `final-before/` for the preceding Angular 22 build and `guided-final-after/` for the revised roster, Team Configuration, and browser results. The local production build log is `guided-final-production.log`.

Baseline is the master implementation at `0d30bc9`, the legacy screenshots and the more recent accepted modernization captures. The older Team Scores screenshot documents the original visual density. The current date-based matchup workflow is intentional.

| Priority | Area | Evidence and cause | Expected presentation |
| --- | --- | --- | --- |
| High | Login and alerts | `tests/ux/screenshots/login-error_visitor_mobile-375x667_simulated-network-failure.png` and global snackbar CSS. Oversized red notifications are explicitly authored in application CSS. MDC renders the inner surface separately, which leaves inconsistent text and action styling. | Compact inline login feedback with an accessible announcement. Keep ordinary alert and confirmation surfaces readable. |
| High | Team Scores | `tests/ux/screenshots/team-scores_manager_mobile-375x667_local-display-fixture.png` and current template. The current Material outline fields leave fixed subscript space on every row, and the Bootstrap wrapper takes only ten columns even on phones. The 150% Team Management child risks horizontal overflow. | Retain date-based matchups and paired scores. Keep labels and fields aligned and let the page use the phone width. |
| High | Scrambler | `authorized-atomic-reset-acceptance/browser/scrambler-mobile.png`, `tests/functional/scrambler-workspace-evidence/` and current roster template. Legacy negative icon margins are still applied to modern MDC icon targets. Desktop roster width is expressed as fixed percentages. | Small glyphs, independent named controls, adaptive blue and pink player grid, and compact setup. Keep the mobile action picker, rules and existing result and print workflows. |
| High | Management and Dashboard tabs | Current template and styles. Management forces five labels into equal shrinking cells and explicitly wraps them. The dashboard relies on default Material pagination. | Single-line labels with active indicator, keyboard semantics and scrollable navigation on narrower screens. |
| Medium | K/Q standings and profiles | `tests/functional/mobile-standings-refinements-evidence/`, `authorized-atomic-reset-acceptance/browser/kqmatchups-mobile.png` and shared profile CSS. Profile spacing comes largely from application card, section and table rules. | Keep bordered statistics and meaningful highlights. Tighten history spacing while preserving expand, score and teammate navigation. |
| Preserve | Matchup viewer and print | `angular7-matchups-baseline/edit-mobile-430.png` and existing print parity artifacts. The current viewer has deliberate typography, table and scroll-restoration work. | Preserve dialog geometry, focus, team colors and printed rows. |
| Review | Home, account, roster, import, schedule, sign-in, password recovery, PWA and FAQ | Accepted home, roster, import and schedule screenshots are in `authorized-atomic-reset-acceptance/browser/`. The legacy UX report and screenshot index cover additional pages. | Keep the established hierarchy and purpose-built grids. Check shared changes for spillover into these flows. |

Modernization evidence paths above are relative to `tests/functional/artifacts/modernization/` unless they start with `tests/`.

## Evidence after correction

The comparison retains the date-based matchup workflow and the already accepted player browser, import, schedule, and matchup viewer designs. The oversized snackbar wrapper and history spacing came from application styles. Material's inner snackbar surface, form metrics and header pagination made several of those presentation problems more apparent.

Open `visual-restoration/final-before/` and `visual-restoration/handoff-visual/` for matching viewport screenshots and layout measurements. The browser fixtures cover 320, 375, 390, 430, 768, 1024, 1280, 1600, 1920, 2560, and 3440 px. The populated roster comparison uncovered the obsolete `checkboxPosition` input and truncated desktop names. The supported toggle position, wrapped names, and adaptive grid are visible in the revised captures. Team Scores, detailed roster/import/schedule, matchup modals and print have separate browser fixture directories alongside the visual sweep.

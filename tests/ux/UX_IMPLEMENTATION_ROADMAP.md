# Proposed UX implementation roadmap — not authorised or implemented

## Phase 1: small, reversible improvements

- UX-10/17: contrast tokens, logo alternatives, main/page headings and skip navigation. Separate WCAG requirements from best-practice checks.
- UX-01/13/16: concise purpose and task labels, explain K/Q terminology, descriptive Save/Add actions. Confirm which public routes should be discoverable.
- UX-09: keyboard form submission and field guidance, preserving server validation and neutral errors.
- UX-02: contain suggestions and keep actions reachable; verify with 16+ matches at both phone widths.

**Gate:** owner approves copy/visual changes; keyboard and five-width smoke check; no backend/auth contract changes. Relative effort: small templates/styles to one-component work; no fixed day estimate.

## Phase 2: moderate high-value workflow improvements

- UX-03: paired opponent score rows on mobile; maintain current score DTO/date/indexing and existing desktop comparison.
- UX-06/07: keyboard-scrollable standings, essential mobile columns/detail expansion, proper claim-dialog/listbox semantics/focus.
- UX-05: first verify a real-session refresh, then repair client-state restoration if confirmed using existing read-only status endpoints. Do not change cookies, credentials or roles.
- UX-08/11/12: context-labelled setup tools and predictable save/error/empty states.

**Gate:** focused regression tests for the changed paths in valid Dev isolation; preserve existing functional/security baseline and administrator workflows. Avoid combining score arithmetic changes with UI work. Risk: medium, higher for state/indexing.

## Phase 3: substantial, optional restructuring

- Task-oriented Tonight / Check in / Run scramble / Enter scores / Results view.
- Progressive disclosure for balancing/top/low/bye/substitute settings while retaining an expert view and printable results.
- Consistent Manage League location for Players, Divisions and Settings, without changing permission boundaries or legacy unlock steps.

**Gate:** first test a clickable nonproduction concept with a new player, an experienced manager and the three administrators. Adopt only if it improves observed tasks; do not replace established tools solely for appearance. No full frontend/framework migration is recommended by this audit.

## Deferred decisions

Confirm registered-name prefill behavior before changing it (UX-15). Loading is source-only here (UX-20). Browser title already changed in the repository; its production deployment is separate (UX-19). Real Safari/touch, 320px/400% zoom, assistive technology, print and slow/error/reconnect tests require their own approved scope. Do not weaken CSRF/authentication to simplify interaction.

## Success criteria to measure later

No page-wide overflow at the requested phone widths; a newcomer can locate the intended result view; Create/Close never hides behind search suggestions; keyboard dialog focus and Enter work; league/date/opponents are explicit before saving; existing counts/scores/ownership tests retain their results. Approximate click counts in the audit are hypotheses, not evidence of an achieved reduction.

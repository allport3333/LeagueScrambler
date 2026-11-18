# League Management consolidation

Follow-up: Current League Players now starts with no rows displayed. Typing a name shows matching rows; clearing the search hides them. Show All Players explicitly reveals the full roster and changes to Hide All Players. League changes return to the search-first state. Existing API loading and removal behavior are unchanged. Focused desktop/375/390 search/show/hide checks passed; `management-consolidation-evidence/search-results.json` records the execution.

## Implemented

The dedicated management page now has **Manage Players**, **League Settings**, and **League Setup**, under the centered Player and League Management heading. Ordinary forms are limited to 940–1000px, with additional roster width. Cards use the existing blue theme, white backgrounds and restrained borders/shadows. Setup cards sit side by side on wide screens and stack on phones. Existing tab pagination remains available on narrow screens; no horizontal page overflow was observed.

Manage Players includes the current league roster, local name filtering, optional available division labels, loading/error/retry/empty states, and red Remove from League actions. A Material dialog identifies the player and league, explains what is preserved and requires confirmation. Removal uses the unchanged DeletePlayer API, which removes a PlayersLeague association, not the Player or user account. Duplicate same-name entries in a roster are blocked rather than guessed between. The original existing-player autocomplete/division picker and new-player form remain below the roster; successful additions, creation and removals reload the management roster.

League Settings retains the original five controls, options, handlers and explicit Save Settings action. Larger screens use two columns; phones stack fields. Changing a setting does not itself send a save request.

League Setup contains both original league/division forms with their existing validation, handlers, password conditions and selected-league context. No new nested tabs. The redundant page-level Scrambler/Standings links were removed: the main navigation exposes both to Admin/Manager and uses the same routes/shared workspace. Returning to Scrambler through it retains the live component and unrelated draft state.

## Preserved and limited

- No backend, API, database schema, account-linking, scoring, standings calculation, ownership, cookie, authentication or legacy password implementation changed. No packages installed. Prior pending Admin/Manager management-route safeguards were preserved.
- Original creation request/validation and league/division creation methods remain unchanged. Added presentation refresh/error feedback around player callbacks. Existing removal callbacks now capture the confirmed target and avoid updating the wrong local league view if selection changes during a request. This does not change the server mutation contract.
- **Division limitation:** the existing roster API returns Player records without membership division metadata. The UI displays division names/codes from existing league-scoped standings metadata when available. Members without that metadata may have no displayed division, even if a division is assigned. No assignment is guessed, changed or labeled falsely as unassigned; a complete roster-division response would require a later read-only API enhancement.
- Original new-player creation retains its existing default division behavior. This pass does not add a new division write to that request. The existing-player division picker keeps its current behavior, including optional no-division selection.
- Pre-existing creation limitation: the original handler appends its locally constructed player (initial ID 0) to the Scrambler's gender arrays rather than the returned player. The new management roster independently reloads saved records and has the correct IDs. Refresh/reselect the league before using newly created players in Scrambler; correcting that older local-state behavior was deferred to preserve the requested creation implementation.
- Existing AddPlayer/DeletePlayer endpoints resolve names. That backend behavior was intentionally preserved. Duplicate membership additions remain idempotent according to the current API contract; they are not newly redefined as rejected requests.
- Successful shared-password unlocking, SQL persistence, actual ownership assignment, database duplicate handling and real cross-league integrity were not executed. Browser fixtures and source review are not database verification.

## Executed verification

**10 functional groups passed, 0 failed, 0 page errors**, using the actual Angular UI and an entirely intercepted in-memory API model:

1. Three sections, league roster loading, available division display, search and no-results state.
2. Removal confirmation/cancel with no request, confirmed league-scoped removal, retained fixture global player and other-league membership.
3. Existing-player autocomplete, division selection, membership addition and duplicate idempotence without global fixture creation.
4. Existing new-player form and creation request; refreshed management roster uses returned saved records.
5. Local settings changes followed by original five explicit save requests.
6. Existing league/division forms, endpoints and selected-league payloads.
7. All sections and dialogs at 1366×768, 1920×1080, 375×667 and 390×844 without page overflow.
8. Switching leagues, empty roster and failed-load/retry states.
9. Return through main navigation preserves the same Scrambler instance and selections.
10. Manager access and Player direct-route denial through the existing guard.

After final visual refinements, **five additional visual groups passed**, with zero page errors and zero write requests: four requested viewport sizes (tabs, nonoverlapping roster actions, fitting dialog, expandable new-player form, responsive setup), and existing locked administration visibility/disabled removal. No password was supplied or unlock attempted.

API writes in the functional run were fulfilled by fixtures and never reached ASP.NET or SQL. The synthetic data existed only in browser-test memory; there are no retained database records or cleanup requirements. Font/icon GET assets were the only allowed external requests; production domains were blocked. No mutation approval was renewed or bypassed, and automated SQL session correlation is not claimed.

Development and production/AOT Angular builds passed using installed Node 10/packages, with the existing outdated Browserslist warning. Logs: `artifacts/management-consolidation-build.log` and `artifacts/management-consolidation-production-build.log`. No full regression suite was run. The first test attempts corrected selectors for Angular Material 7 combobox/listbox semantics and the Save Settings snackbar's OK action; no application behavior was changed to satisfy those fixture issues.

Source comparison confirms unchanged scramble/print algorithms, Save Settings, legacy unlock entry point and league/division creation methods. See `management-consolidation-evidence/preservation.json`.

## Screenshots

| Workflow | Desktop | Mobile |
|---|---|---|
| Manage Players | [1366](management-consolidation-evidence/manage-players-1366.png), [1920](management-consolidation-evidence/manage-players-1920.png) | [375](management-consolidation-evidence/manage-players-375.png), [390](management-consolidation-evidence/manage-players-390.png) |
| Add Existing Player | [Desktop](management-consolidation-evidence/add-existing-1366.png) | [Phone](management-consolidation-evidence/add-existing-390.png) |
| Create New Player expanded | [Desktop](management-consolidation-evidence/create-new-player-expanded-1366.png) | [Phone](management-consolidation-evidence/create-new-player-expanded-390.png) |
| Remove confirmation | [Desktop](management-consolidation-evidence/remove-confirmation-1366.png) | [Phone](management-consolidation-evidence/remove-confirmation-390.png) |
| League Settings | [Desktop](management-consolidation-evidence/league-settings-1366.png) | [Phone](management-consolidation-evidence/league-settings-390.png) |
| League Setup | [Desktop](management-consolidation-evidence/league-setup-1366.png) | [Phone](management-consolidation-evidence/league-setup-390.png) |

Screenshots use synthetic data/drafts only. Results: `results.json` (functional) and `visual-results.json` under the same evidence folder. This report supersedes the earlier five-tab `MANAGEMENT_LAYOUT_REPORT.md` for the current UI.

## Files and rerun

Application changes: `scrambler.component.ts`, `scrambler.component.html`, `scrambler.component.less` in the existing Angular Scrambler folder. New focused runner: `tests/functional/scripts/management-consolidation.cjs`; report, `WORK_LOG.md` and `management-consolidation-evidence/`. Earlier pending navigation/role work was retained.

With the existing local application serving a **development Angular bundle** (the harness uses Angular's debug probe):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path tests/functional/.tools/browsers).Path
& tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/management-consolidation.cjs
# Read-only visual checks/captures only:
& tests/functional/.tools/node-v22.23.5-win-x64/node.exe tests/functional/scripts/management-consolidation.cjs --visual-only
```

If the production build currently supplies the local bundle, run the existing Angular development build before using this fixture runner. Production build artifacts were generated locally only. No Publish, deployment, production/IIS/Cloudflare changes, commits, pushes or merges. Stop at this feature.

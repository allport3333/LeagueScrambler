# Scrambler workspace changes and verification

Completed locally November 17, 2026 (build timestamps after midnight UTC November 18). This is an Angular presentation change, not a rewrite of scramble generation. No production, SQL, credentials, authentication, publish profiles or deployment files were changed. No packages were installed.

## Implemented

- Main navigation now has a dedicated **League Management** route. The original settings, player addition/deletion, league addition and division forms were moved intact. The original unlock form remains available; its password handling and server permissions are unchanged.
- Scrambler and League Management share one live workspace component. Moving between those routes preserves the same Scrambler instance, selected players/league, preferences, generated teams, court inputs, round scores and printing state. Hidden sections remain mounted. Direct management navigation also works. Navigating to an unrelated page or refreshing retains the application's previous component lifecycle; this is not new persistent storage.
- Removed the duplicate visual Standings tab. Internal standings retrieval, processing and top-player balancing remain. The dedicated K/Q Standings page was not modified.
- Retained **Create Teams and Scores** in its existing tab. Its own manual-roster and unsaved-score lifecycle makes a separate route riskier than a visual move; separation is deferred rather than changing draft behavior. Thus four tabs remain: Select Players, Retrieve Scramble, Manage Scores, Create Teams and Scores.
- Grouped setup into Team Configuration, Scramble Rules, Player Selection and Player Balancing. Selected male/female counts are prominent; size/count exclusivity is explained. Primary scrambling, secondary selection/balancing and Reset are visually distinguished. Existing disabled predicates and algorithms were retained; empty and access-dependent states have explanations.
- Four-column desktop roster retained, including original player checkbox/menu actions and colors. Phones use full-width compact roster rows so names remain readable. Added a player-icon key.
- Empty result controls/cards are hidden until teams exist; only a compact message remains. Result-dependent buttons cannot run without results. Hiding results retains their DOM and court inputs.
- Added a top results toolbar with generated/retrieved scramble numbers, Modify Teams, Save Teams, Matchups Per Page beside Print, Number of Rounds, Hide Results and Hide Setup. Removed the original scattered duplicates. Existing bordered pair cards, team numbers, ordering, court controls and player colors remain.
- Modify Teams snapshots local team membership before editing. Existing dropdowns continue to move players locally. A clear editing/draft status is shown; Finish Editing retains the draft, Cancel restores original assignments, and successful existing Save Teams clears the editing snapshot. Replacing drafts by retrieval/scrambling or a meaningful reset requires confirmation. Reset retains its original roster-selection behavior.
- Screen-only hiding of the three print templates prevents their invisible absolute-positioned contents from widening phone pages. Their markup and the print function are unchanged.

## Executed verification

All browser tests use the actual Angular application at localhost with synthetic API responses intercepted in Playwright. Unknown/nonlocal traffic is blocked. Application POSTs used in the tests are fulfilled locally, never sent to the API. No SQL access or mutation authorization was used or renewed; automated SQL session correlation is not represented as passed.

| Focused phase | Result | Scope |
|---|---|---|
| Workspace routing | Passed, 1 grouped check | Navigation to management/back retains the identical live component and full tested state; duplicate standings tab absent |
| Setup | Passed, 1 grouped check | Select All/Deselect All, 24 players, four columns, size/count exclusivity, tab state and empty disabled action |
| Results/editing/responsive/printing | Passed, 8 grouped checks | Staged moves, Cancel, explicit Save request, actual balanced algorithm (24 unique players in 12 male/female pairs), access-disabled Save, top/low/bye, fetching, standings-driven preference, temporary gender, all five sizes and print comparisons |
| Follow-up navigation/settings/retrieval | Passed, 3 grouped checks | Actual round/print selectors, Hide/Show Setup, retrieval of teams/round scores/number, Manage Scores navigation, direct management route and original locked form |
| Existing standings math tests | 3 passed, 0 failed | Substitute/drop calculation, tie sorting and standings-driven top selection |
| Angular development build | Passed | Installed Node 10/packages, no dependency changes |
| Angular production/AOT build | Passed | Installed Node 10/packages, no dependency changes |

The 13 browser checks are grouped assertions in a focused script, not 13 new full-suite regression cases. Browser page errors: zero in successful runs. The complete functional suite was deliberately not rerun; its historical 36-passed/2-accepted-blocked baseline is not presented as a new execution.

Initial responsive checks caught excessive balancing-button height and clipped names; scoped CSS corrected them. Invisible print templates caused remaining horizontal overflow; the screen-only fix preserved identical print output. Follow-up fixture corrections scoped a password selector to the administration field and excluded webpack's aborted SockJS requests from application-write accounting; no authentication behavior was changed for these test issues.

### Printing evidence

Before editing, the harness captured the exact HTML written by the original `printMatchups()` popup. It then rendered that HTML in Chromium print media, saved PNGs/PDFs and compared the updated output. For the same six-match fixture, all normalized HTML hashes, screenshot hashes and PDF page counts match at **2, 4 and 6 Matchups Per Page**. Existing page counts are respectively **4, 2 and 1**, including the original pagination behavior at the first setting. UI action bars and editing dropdowns are absent from this print output.

Source comparison also confirms **122 existing methods unchanged**, including the print method, score handling, retrieval, preference actions and balancing helpers. The only modified existing methods are the editing toggle, adding snapshot cleanup after existing Save success, and a draft-discard guard before the unchanged scrambling body. Print templates are equivalent to HEAD ignoring CRLF.

This verifies browser-generated output, not a physical printer. Existing court inputs are not data-bound into the separate print templates; preservation of a typed court value while hiding results was tested, but automatic transfer of it into printed court fields is not claimed or newly implemented.

## Limits and deferred verification

- No real database save, score update, league modification or shared-password unlock was executed. Mutation authorization was not renewed. A later authorized isolated Dev session is needed to verify persisted writes; current Save tests prove the existing request path executes, not SQL persistence.
- The existing Save Teams flow finalizes new generated placeholders. It was not redesigned into an editor for already saved roster membership. Retrieved-team edits remain a local preview with a warning; the existing save path is retained. Do not treat this change as a historical roster-correction feature.
- League Management authorization remains server enforced, with the same original controls and unlock form. Browser checks cover Admin-shaped navigation, access-disabled saving and the locked administration form, not successful real legacy unlock or every management mutation/role combination.
- Manual Teams separation is deferred as described above. No global state persistence, new algorithms or API changes were introduced.

## Screenshots and artifacts

All images use synthetic players and a synthetic league. Relative links below open original versus updated evidence.

| State | Before | Updated |
|---|---|---|
| Empty setup | [Original](scrambler-workspace-evidence/before-empty.png) | [Updated](scrambler-workspace-evidence/after-empty.png) |
| Configured players | [Original](scrambler-workspace-evidence/before-configured.png) | [Updated](scrambler-workspace-evidence/after-configured.png) |
| Generated teams | [Original](scrambler-workspace-evidence/before-generated.png) | [Updated](scrambler-workspace-evidence/after-generated.png) |

- [Editing Teams](scrambler-workspace-evidence/after-editing.png)
- [Results toolbar and retrieved matchups](scrambler-workspace-evidence/results-controls-and-matchups.png)
- [League Management](scrambler-workspace-evidence/league-management.png), [locked administration](scrambler-workspace-evidence/league-management-unlock.png)
- [Desktop 1920](scrambler-workspace-evidence/workspace-1920.png), [desktop 1366](scrambler-workspace-evidence/workspace-1366.png), [tablet 768](scrambler-workspace-evidence/workspace-768.png)
- [Mobile 390](scrambler-workspace-evidence/workspace-390.png), [mobile 375](scrambler-workspace-evidence/workspace-375.png)
- Printed PDFs: [2 per page](scrambler-workspace-evidence/print-2-after.pdf), [4 per page](scrambler-workspace-evidence/print-4-after.pdf), [6 per page](scrambler-workspace-evidence/print-6-after.pdf). Matching `before` PDFs/PNGs and JSON hashes are in the same folder.
- Exact browser results: `stage1-results.json`, `setup-results.json`, `final-results.json`, `followup-results.json`; source comparison: `source-preservation.json`.
- Build logs: `artifacts/scrambler-workspace-development-build.log`, `artifacts/scrambler-workspace-production-build.log`. Existing outdated Browserslist data warning remains; no dependency updates attempted.
- Existing math test HTML report: `artifacts/runs/scrambler-workspace-math/html/index.html`.

## Changed files and rerun

Application files: `app.module.ts`, `nav-menu/nav-menu.component.html`, `scrambler/scrambler.component.ts`, `.html`, `.less`, and new `scrambler/scrambler-workspace.component.ts`, all under `Allport's League Scrambler/ClientApp/src/app`.

Testing/docs: `tests/functional/scripts/scrambler-workspace.cjs`, `Run-ScramblerWorkspace.ps1`, this report, `WORK_LOG.md`, and `scrambler-workspace-evidence/`.

With the existing development app running, rerun the isolated browser checks from repository root:

```powershell
.\tests\functional\Run-ScramblerWorkspace.ps1
```

Use `-Mode followup` etc. for an affected phase only. These fixtures do not require or grant database mutation permission. The original pre-change baseline must not be regenerated against the updated UI. No full regression run, deployment, Publish, commit, push or merge was performed.

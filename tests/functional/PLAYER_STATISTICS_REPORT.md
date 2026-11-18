# Player statistics implementation and verification

Completed: November 18, 2026. Scope: player profiles only, with small supporting profile-navigation changes. No database access, data creation, application restart, publishing, or production changes occurred.

## Correctness findings

| Area | Confirmed original problem / definition | Implemented behavior |
|---|---|---|
| Regular teammates | GetCombinedStats did not consistently restrict teammate relationships to the selected league. | Restrict teams and relationships to the league and selected player's teams; group by PlayerId; exclude self. |
| Duplicate-looking names | The original projection already used Distinct on ID and name. Identical displayed names therefore do not prove identical IDs were duplicated. No affected real response was queried. | One row per actual PlayerId; preserve separate namesakes and display their IDs where needed. Do not merge or delete player records. |
| Regular totals | Membership joins could multiply saved games when duplicate associations exist. | Select each saved LeagueTeamScore ID once. |
| Opponents | Original logic used only the player's first team and counted opponent-owned results. | Use the player's own saved results across their teams in the selected league, grouped by opponent. |
| Regular teammate frequency | Previously not reliably calculated in the distinct-name list. | Times played together means unique saved team-game records on shared teams. Wins together counts won records from that same set. |
| K/Q frequency | Existing Count means distinct saved scrambles together; WinsTogether means won rounds, not won weeks. | Preserve those separate definitions and label them explicitly. Never combine these counts with regular League Team games. |
| K/Q raw rounds | Repeated joins and nullable win metadata could distort results or throw. | Unique saved score IDs, exact saved team membership, nullable win metadata retained as unknown. |
| Streaks | Dates alone do not order multiple same-day records deterministically. | Date then saved score ID. Actual intraday play sequence is not stored and remains unverified. |

Important limits: membership records have no per-game attendance or effective dates. Regular teammate statistics describe saved games belonging to shared roster teams; they cannot establish actual on-court attendance. Distinct saved score IDs are retained even if separate database records contain identical values. This is not a historical data repair. The precise identity of the originally reported repeated names remains unverified without the affected real API response.

Existing LeagueStats.LeagueName actually identifies a team inside the selected league. The API field is preserved; the interface clarifies its meaning. Empty verified datasets can produce zero totals; missing uncalculated fields show an em dash. Raw historical scores remain separate from adjusted standings scores. No scoring, dropped-score, substitute, ranking, or standings calculations were changed.

## Interface changes

- Shared centered player header with selected league, gender, and division only when assigned.
- Three original categories retained with centered responsive tabs. Player ID, league ID, and active tab survive direct refresh and teammate navigation. The old player-stats URL redirects to the existing tabbed profile.
- K/Q summary and chronological expandable matchup history replace the default side-by-side long tables. Expansions contain raw rounds, win indicators, actual teammates, profile links, and stable saved-matchup links. Optional detailed round and teammate-frequency tables remain available.
- Displayed matchup numbers describe the player's chronological history; navigation uses actual scramble and saved team IDs. A saved zero score can link; incomplete associations cannot. K/Q Matchups can return to the originating player profile without changing normal standings navigation.
- League Team summary retains wins, losses, and points. Expandable dates retain all original opponent/results rows.
- League Player Stats retains overview, streaks, scoped team comparisons, sortable opponent and teammate tables, and detailed opponent values. Namesake players remain distinct.
- Loading, empty, missing-player, failed-request/retry, invalid-league, and incomplete-history states are distinct. Stale requests are canceled/guarded and unchanged context does not repeatedly reload statistics.
- Shared compact blue-theme styling supports 1366/1920 desktop and 375/390/430 phone widths. A profile-only mobile adjustment removes the obsolete navigation spacer; unrelated screens retain their spacing.

## Executed verification

| Verification | Result | Evidence |
|---|---|---|
| Production C# calculation helper, deterministic fixtures | 7 regression groups passed | player-profile-evidence/calculation-results.json |
| Actual Angular browser workflows with intercepted HTTP | 10 grouped checks passed; no page errors or write requests | player-profile-evidence/browser-results.json |
| Final viewport captures and request-count checks | 6 grouped checks passed; no page errors or write requests | player-profile-evidence/capture-results.json |
| Backend Debug compilation, no restore | 0 errors, 12 warnings | artifacts/player-profile-backend-build.log |
| Angular development build | Passed | artifacts/player-profile-development-build.log |
| Angular production/AOT build | Passed | artifacts/player-profile-production-build.log |

These are grouped focused assertions, not a claim that 23 existing Playwright cases or the full functional regression baseline were rerun. Calculation tests execute the production helper with existing model types; browser fixtures are generated from those results. Browser HTTP is intercepted, non-GET requests are blocked, and no SQL session is opened. No database isolation authorization was renewed or bypassed; automated SQL correlation is not claimed successful.

Fixtures cover empty/solo players, repeated partners, different partners, duplicate membership joins, two people sharing a name, multiple leagues, exact regular-game/win totals, own-perspective opponent records, nullable K/Q wins, repeated round numbers across saved teams/scrambles, raw zero scores, chronology, sorting, links/return/refresh, all tabs, league changes, failure/retry, and incomplete data. Final screenshots explicitly open/close history sections before capture.

Backend warnings include existing package/framework/MVC warnings and two locked Debug DLL/PDB cleanup warnings. Output copying was disabled to compile without replacing the running application's binaries. **The existing Visual Studio process still needs a normal Stop Debugging, Build, and Start to load the backend changes.** Live EF query translation, actual development API responses, and database-backed persistence remain unverified. No real-data calculation reconciliation was performed. Angular reports the existing outdated Browserslist database warning; dependencies were not updated.

### Repeat focused verification

With the existing local Angular development application available, use:

```powershell
.\tests\functional\Run-PlayerProfile.ps1
```

The runner uses the existing portable test Node runtime and installed browsers, not the Angular Node runtime. Optional modes: `-Mode calculations`, `-Mode browser`, or `-Mode capture`. Browser inspection uses Angular development debugging facilities; rebuild the existing frontend in development mode before rerunning if the current served bundle is production. No install or SQL access is required. The latest production build output remains local and was not deployed.

## Screenshot index

All images use synthetic fixtures, not real player information.

| Screen | Screenshot |
|---|---|
| Shared header | [Header](player-profile-evidence/profile-header.png) |
| K/Q overview and collapsed history | [Desktop](player-profile-evidence/king-queen-1366.png) |
| Expanded rounds, teammates and saved-zero navigation | [Desktop](player-profile-evidence/king-queen-expanded-1366.png) |
| K/Q teammate frequency definitions | [Frequency table](player-profile-evidence/king-queen-teammate-counts.png) |
| League Team summary / dates | [Desktop](player-profile-evidence/league-team-1366.png) |
| Expanded League Team game results | [Desktop](player-profile-evidence/league-team-expanded-1366.png) |
| League Player overview | [Desktop](player-profile-evidence/league-player-1366.png) |
| Corrected ID-based teammates / namesakes | [Desktop](player-profile-evidence/corrected-teammates-1366.png) |
| Mobile K/Q expanded | [390px](player-profile-evidence/king-queen-expanded-390.png) |
| Mobile League Team expanded | [390px](player-profile-evidence/league-team-expanded-390.png) |
| Mobile League Player | [375px](player-profile-evidence/league-player-375.png) |

Equivalent viewport captures with suffixes 1920, 375, 390, and 430 are in the same directory. The retained browser-failure.png documents an initial test expectation mismatch about additional valid query parameters; the assertion was corrected and the browser workflow subsequently passed. It is not a final application failure.

## Changed files

Application paths below are relative to `Allport's League Scrambler/`:

- Controllers/StatisticsController.cs: four targeted read-only endpoints (GetCombinedStats, GetLeagueTeamScores, GetDetailedPerformanceStats, GetProfile).
- Models/PlayerProfileStatistics.cs: isolated calculation helper and read projection DTOs; no schema changes.
- ClientApp/src/app/player-stats-tabs/player-stats-tabs.component.ts, .html, .css and profile-statistics.shared.css.
- ClientApp/src/app/detailed-player-stats/detailed-player-stats.component.ts and .html.
- ClientApp/src/app/league-team-player-scores/league-team-player-scores.component.ts and .html.
- ClientApp/src/app/combined-stats-tab/combined-stats-tab.component.ts and .html.
- ClientApp/src/app/services/statistics.service.ts: optional selected-league parameter for profile metadata.
- ClientApp/src/app/kqmatchups/kqmatchups.component.ts and .html: conditional profile return navigation.
- ClientApp/src/app/app.component.ts, .html, .css: profile-only mobile spacing.
- ClientApp/src/app/app.module.ts: legacy profile URL redirect.

Testing/documentation: tests/functional/Run-PlayerProfile.ps1; scripts/test-player-profile-calculations.ps1; scripts/player-profile-ui.cjs; player-profile-evidence/; this report; WORK_LOG.md. Build logs are retained under artifacts/ (ignored output).

Authentication, legacy shared password, authorization rules, cookies, credentials, database schema/data, unrelated Scrambler/League Management screens, IIS/Cloudflare and publish profiles were not modified. No publish, deployment, commit, push, or merge was performed.

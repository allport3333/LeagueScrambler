# Player statistics correction pass — November 18, 2026

## Diagnosis and corrections

1. **Detailed round table:** removed only the visible Saved Scramble heading/cell. Date, Round, Score and Won now each occupy 25% of the table. Removed the old 540px minimum width so all four columns fit phones. Internal scramble/team/score identifiers, chronological ordering, all raw scores and navigation remain intact.

2. **Losses:** the current backend source already calculated TotalLosses from the same unique saved score records used for games and wins. The Angular component already expected totalLosses. Missing fields were being presented as dashes, concealing an incompatible backend response. Added explicit response validation rather than inventing frontend totals from an incomplete response.

3. **Teammates:** the current helper already groups by PlayerId, filters league/team membership, excludes self and aggregates distinct saved score IDs. The running development process was still using a different build: PID 37156 launched the existing project's Debug `ASP.NET Core 2.2 with Angular 7.dll`, last written November 17 at 7:00:14 PM. Read-only assembly metadata inspection found neither PlayerProfileStatistics nor TimesPlayedTogether. This demonstrates a source/runtime mismatch and explains why the new frequency fields were unavailable. No database/API request was issued to inspect the affected real records; the exact identities behind the reported repeated names therefore remain unverified. Separate real PlayerIds with the same name must remain separate.

The interface now rejects missing numeric fields, repeated teammate IDs or wins exceeding games with a clear incompatible-response message. It does not deduplicate in Angular. Backend and frontend default ordering is Games Together descending, then name, then PlayerId. All three columns remain sortable and profile links preserve the selected league.

## Counting rules and limits

- A unique persisted LeagueTeamScore.Id is one team-game record. Repeated membership joins and repeated instances of the same score ID count once; three different saved IDs on one date count three games.
- Regular teammate games/wins use only selected-player teams and their co-rostered players in the selected league. K/Q rounds are never included.
- Invalid/transient rows (nonpositive ID, negative score, missing date, self-opponent or opponent outside the selected league) are excluded consistently from totals, teammates, opponents and streak calculations. No stored records are repaired or removed.
- The model has non-nullable integer TeamScore and Boolean WonGame. There is no pending/finalized flag, nullable result, draw marker, game-pair ID or attendance/effective-membership dates. Missing score rows contribute no games; a saved zero score is valid. It is impossible to distinguish an accidentally saved default zero/false from a legitimate saved zero loss using this schema alone.
- Existing SaveLeagueMatchup records ties as WonGame=false for both sides; UpdateTeamScores counts false as losses. This correction preserves that existing rule rather than redefining draws. Therefore completed persisted games satisfy wins + losses = games, and win percentage uses that same denominator.
- A saved one-sided historical result is counted by its own score ID; the schema cannot reliably pair it with a reciprocal record when multiple games share the same teams/date. No guessing based on matching date/score is introduced. Separate erroneous database rows with different IDs cannot safely be merged as duplicates.
- Roster links cannot establish attendance or the date a player joined a team. Counts reflect recorded shared team membership under the existing data model. Those historical limitations need real-data reconciliation if more precise attendance statistics are required.

## Verification executed

- **12 C# calculation groups passed**, including 33/19/14, all wins, all losses, no games, saved zero, three games/two wins on one date, zero shared wins, duplicate membership/score joins, namesakes, multiple leagues/teams, missing/invalid records, existing tie rules, and prior K/Q assertions.
- **3 targeted browser groups passed**: four-column raw score preservation/mobile fit; losses/unique teammate counts/default ordering; incompatible old-response rejection and retry recovery.
- **10 existing profile browser workflow groups passed** after the functional changes. Final CSS-only table-width correction was then verified by the targeted browser checks; no unnecessary full regression suite was run.
- **Angular development build passed** after the final CSS correction; existing outdated Browserslist warning remains.
- **Backend no-restore Debug compilation passed: 0 errors, 12 warnings**, including existing framework/package warnings and locked running DLL/PDB warnings. Output copying was suppressed to avoid replacing running binaries. This is compilation evidence, not live EF integration verification.
- One initial targeted test expected only two teammates in the 33-game fixture, overlooking a third co-rostered player with zero recorded games. Corrected that test expectation; no application change was needed for it. Final browser runs have no page errors or write requests.

All browser APIs were intercepted with fixtures generated by the actual production C# helper. No SQL, production access, account creation, cleanup, score writes, email or isolation authorization changes occurred. No API response from the affected real player was verified. Live database-backed execution remains unverified.

## Required local runtime step

**Stop Debugging, build the existing solution normally in Visual Studio, and restart the same development profile after confirming its existing LeagueScramblerDev configuration.** The running old DLL was not replaced or restarted during this pass. Merely rebuilding Angular cannot update the server response. Verify the affected real profile after that restart; an incompatible backend now produces an explicit error instead of silently showing missing counts.

Rerun fixture checks with:

```powershell
.\tests\functional\Run-PlayerProfile.ps1 -Mode corrections
```

## Screenshots

- [Detailed round table, desktop](player-profile-evidence/corrections-round-table-desktop.png)
- [Detailed round table, mobile](player-profile-evidence/corrections-round-table-mobile.png)
- [33 games, 19 wins, 14 losses](player-profile-evidence/corrections-losses-33-games.png)
- [Teammate counts, desktop](player-profile-evidence/corrections-teammates-desktop.png)
- [Teammate counts, mobile](player-profile-evidence/corrections-teammates-mobile.png)

Screenshots are synthetic. Repeated Alex Synthetic names intentionally represent distinct IDs, which remain identified separately.

## Files changed

Application: Models/PlayerProfileStatistics.cs; ClientApp/src/app/combined-stats-tab/combined-stats-tab.component.ts; ClientApp/src/app/detailed-player-stats/detailed-player-stats.component.html; ClientApp/src/app/player-stats-tabs/profile-statistics.shared.css. StatisticsController already calls the helper and did not require modification.

Tests: Run-PlayerProfile.ps1; scripts/test-player-profile-calculations.ps1; scripts/player-profile-ui.cjs; generated player-profile-evidence screenshots/fixtures/results; this report and WORK_LOG.md.

No authentication, authorization, password, scoring write path, schema, historical score, standings algorithm, unrelated screen or deployment configuration was changed. No publish/deploy/commit/push/merge was performed.

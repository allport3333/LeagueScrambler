# Tournament Center

LeagueType remains the event container. PlayersLeague assigns event membership, LeagueDivision defines divisions, and UserLeague scopes Manager access. Event creation reuses the existing transaction and settings. The Development classification script verifies the specific fixture IDs and names.

PlayerSignIn stores attendance by event, local date, and player. Open and manual modes use checked-in members. Skipped mode uses the roster. An absent player has no round assignment. A bye is an eligible participant assigned to rest and receives no score.

## Development migration order

1. Apply `Apply-EventTypes.sql`.
2. Apply `Apply-TournamentCheckIn.sql`.
3. Apply `Apply-TournamentRoundSettings.sql`.
4. Apply `Apply-TournamentRounds.sql`.
5. Run `Classify-DevelopmentEvents.sql` only in LeagueScramblerDev when the guarded example classifications are needed.

The settings column is nullable for existing configurations. The center supplies initial values until the organizer saves. TournamentRound uniquely maps an event and round number to a saved scramble and records the generation settings and eligibility snapshot. KingQueenTeam and KingQueenPlayer hold teams and assignments, ByeRounds and ByePlayer hold rests, and KingQueenRoundScores stores games within matchups. No existing data is migrated into guided rounds.

## Use and safeguards

Open Tournament Center after creation. Manage Participants opens the existing player management tools for the selected event. Set the check-in mode, save team and round settings, and generate a preview. Saving makes the rounds visible to linked participants. Refreshing loads the persisted rounds and points to the next incomplete score entry. Standings are available before, during, and after score entry through the existing King & Queen calculation.

Generation runs Scrambler V2 in the browser with a bounded search and ranks candidate schedules by historical violations, bye spread, and repeat cost. Gender balancing and Top/Low placement are independent. Strict fallback is opt-in and the engine only uses it when it proves strict assignment impossible for that round. An explicit even active-team limit is required for automatic rests. Previously saved and preserved rounds inform the replacement preview.

The server checks roster identity, eligibility, capacity, manual byes, team sizes, retained Top Player separation, and strict pair exclusions on save. It uses a transaction and event-scoped lock for round settings, assignments, and scores. Existing score records prevent regeneration. A round with no saved score can be replaced after the organizer reviews the preview, including if matchups have already been printed. Reprint and redistribute those matchups after replacement.

Printing shares the existing Scrambler print document and offers a printable preview by round or selection. Rounds use the existing adjacent team pairing and established King & Queen point and win semantics. Completion is derived from the saved score rows. There is no separately editable completion state.

## Focused checks

Build Angular in production mode and run the Angular unit tests. From the repository root, with the project Node toolchain and Edge available, run `dotnet run --project tools/tournament-center/EventTypeCheck -c Release`. The test proves database identity, creates scoped fixture events, runs the same team engine used in the app, checks the 24-player roster and 20-player attendance flow, saves five rounds, exercises score protection and regeneration, verifies restart/resume, and finishes all scores. It also saves a random tournament with both manual and capacity-based byes. The fixture rows are removed by event identity in cleanup.

For fixture-based visual verification, copy the Angular production browser bundle under this worktree's ignored `tests/functional/artifacts` directory. Set `LEAGUE_TEST_DIST` to the copied browser directory and `LEAGUE_TEST_OUT` to the screenshot destination. Run `node tests/functional/scripts/tournament-center.cjs` to check the three themes, modal print preview, and responsive organizer and participant pages without a database mutation.

The search compares complete schedules within a budget and can report inconclusive results. It makes no guarantee of a globally minimum repeat count.

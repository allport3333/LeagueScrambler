# Tournament Center approach

Keep LeagueType as the event container. PlayersLeague assigns event membership, LeagueDivision defines divisions, and UserLeague scopes Manager access. Reuse the existing creation transaction and default settings. Classify the known Development examples separately from the schema migration.

Reuse PlayerSignIn for attendance by event, local date, and player. A tournament needs explicit check-in availability and its event date. One saved King/Queen scramble should represent each tournament round. KingQueenTeam and KingQueenPlayer hold the assignments, ByeRounds and ByePlayer record rests, and KingQueenRoundScores records games within matchups. Fixed LeagueTeam and LeagueTeamScore records are a separate workflow.

Keep Scrambler V2 as the one team assignment engine. Accumulate teammate frequencies and bye counts across rounds in orchestration, then validate and persist the round links and assignments together. Reuse King/Queen score entry, rankings, and print pairing. Keep legacy routes and apply role-scoped event navigation after selection.

## Development migration order

1. Run `Apply-EventTypes.sql` against the intended Development database or clone.
2. Run `Apply-TournamentCheckIn.sql` against the same database.
3. Run `Classify-DevelopmentEvents.sql` only in `LeagueScramblerDev`. It checks the exact event IDs and names before updating the two known tournaments.

The current branch includes typed event creation, resumable tournament details, and event-date check-in. The tournament check-in API uses the existing attendance table and transaction lock. The prior kiosk and profile write paths reject tournament attendance so they cannot bypass check-in settings. Existing league and pickup attendance behavior remains in those paths.

Run `dotnet run --project tools/tournament-center/EventTypeCheck -c Release` for the Development database persistence check. It uses temporary events and fixture memberships and removes them afterward.

The remaining work includes persisted team and round configuration, previews and round persistence, bye rotation, scoring and print integration, completion state, and verification of the complete organizer walkthrough. The branch is a development checkpoint.

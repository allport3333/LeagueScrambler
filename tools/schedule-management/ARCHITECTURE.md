# Schedule management architecture and schema decision

Inspected before implementation: LeagueTeam stores division as a string;
LeagueDivision stores each league's configurable code/name. LeagueSchedule stores
league ID, week, date, two non-null team foreign keys and MatchDescription. There
is no court/location column. LeagueTeamScore links two teams and a date, not a
persisted schedule ID. Existing Schedule/Full Schedule read Statistics/GetLeagueSchedule.

Existing ordinary games will remain in LeagueSchedule. No score, team or division
schema changes or historical rewrites are required. Courts/location may be entered
as existing matchup notes; a structured court field is not claimed.

Standalone events cannot be represented safely in that table: fake teams would
pollute scheduling/scoring, while making team IDs nullable would break existing
navigation assumptions. The necessary additive change is dbo.LeagueScheduleEvent:
an event ID, league FK, week/date, type/title and optional division context. This
supplements the existing schedule; it is not a second ordinary-game system.

Migration risks: deploy the additive table before using persisted events; preserve
all existing rows. No destructive/down migration is automatic. Existing viewers
and game management must continue working when the event table is absent, exposing
an explicit events-unavailable capability rather than returning database errors.
Production migration/deployment requires separate review and is not performed.

Writes use the existing LeagueManagement/LeagueAccess/SameOrigin controls, a
serializable transaction, revision validation and the existing league matchup-score
application lock. Reliable saved team/opponent IDs plus date protect their exact
scheduled pairing; unreliable legacy opponent IDs conservatively protect any
matching team/date. No scored game
may be changed/deleted. Future replacement is explicitly scoped to selected team
divisions; scored and past games survive.

Structured imports reuse the pinned, bounded local spreadsheet worker. Automatic
OCR/image interpretation and PDF text extraction are unavailable in the current
application/toolchain; reference files plus explicit transcription are supported
and labeled accordingly. No extracted data is fabricated, and every import or
generation requires preview and explicit save.

using System;
using System.Data;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Allport_s_League_Scrambler.Controllers
{
    public partial class TournamentsController
    {
        public sealed record DeleteTournamentInput(string Name, string Revision);
        private sealed record DeletionSummary(string Name, DateOnly? EventDate, Guid? Version,
            int[] Roster, int Generated, int Scores, int LegacyScores, int TeamScores)
        {
            public int Participants => Roster.Length;
            public string Revision => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(
                new { Name, EventDate, Version, Roster, Generated, Scores, LegacyScores, TeamScores })));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("deletion-preview")]
        public async Task<IActionResult> DeletionPreview(int leagueId)
        {
            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var summary = await ReadDeletionSummary(db, leagueId);
            await transaction.CommitAsync();
            if (summary == null) return NotFound(new { message = "Tournament not found." });
            return Ok(new { summary.Name, summary.EventDate, summary.Participants, summary.Generated,
                HasScores = summary.Scores > 0 || summary.LegacyScores > 0 || summary.TeamScores > 0, summary.Revision });
        }

        [Authorize(Roles = "Admin")]
        [SameOrigin]
        [HttpDelete]
        public async Task<IActionResult> DeleteTournament(int leagueId, [FromBody] DeleteTournamentInput input)
        {
            if (!ModelState.IsValid || string.IsNullOrEmpty(input?.Name) || input.Name.Length > 50 ||
                input.Revision?.Length != 64)
                return BadRequest(new { message = "Type the tournament name to confirm deletion." });

            await using var db = new DataContext();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                await LockTournamentWrites(db, leagueId);
                var summary = await ReadDeletionSummary(db, leagueId);
                if (summary == null) return NotFound(new { message = "Tournament not found." });
                if (!string.Equals(input.Revision, summary.Revision, StringComparison.Ordinal))
                    return Conflict(new { message = "The tournament changed. Review its current details before deleting it." });
                if (!string.Equals(input.Name, summary.Name, StringComparison.Ordinal))
                    return BadRequest(new { message = "The typed name must match the tournament name exactly." });

                await DeleteOwnedTournamentData(db, leagueId);
                await transaction.CommitAsync();
                return NoContent();
            }
            catch (SqlException error) when (error.Number is 547 or 1205 or 51000 or 51003 or 51011 or 51012 or 51013 or 51014)
            {
                HttpContext.RequestServices.GetRequiredService<ILogger<TournamentsController>>()
                    .LogWarning(error, "Tournament {LeagueId} deletion was rolled back", leagueId);
                return Conflict(new { message = error.Number switch
                {
                    1205 or 51000 => "The tournament is busy. Review it and try again.",
                    51011 => "Another event uses a membership or division linked to this tournament.",
                    51012 => "A historical player score links this tournament to a membership or team from another event.",
                    51013 => "A historical team score links this tournament to a team from another event.",
                    51014 => "A historical schedule links this tournament to teams or fixtures from another event.",
                    _ => "A database relationship prevents safe tournament deletion."
                } + " No records were deleted." });
            }
        }

        private static async Task<DeletionSummary> ReadDeletionSummary(DataContext db, int leagueId)
        {
            var name = await db.Leagues.Where(row => row.ID == leagueId && row.EventTypeId == 2)
                .Select(row => row.LeagueName).SingleOrDefaultAsync();
            if (name == null) return null;
            var details = await db.TournamentConfigurations.AsNoTracking().SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            var members = db.PlayersLeagues.Where(row => row.LeagueID == leagueId);
            var teams = db.KingQueenTeam.Where(row => row.LeagueID == leagueId);
            var scrambles = db.TournamentRounds.Where(row => row.LeagueId == leagueId).Select(row => row.ScrambleNumber)
                .Union(teams.Select(row => row.ScrambleNumber))
                .Union(db.ByeRounds.Where(row => row.LeagueID == leagueId).Select(row => row.ScrambleNumber));
            var assignments = db.KingQueenPlayer.Where(row =>
                teams.Any(team => team.Id == row.KingQueenTeamId));
            return new DeletionSummary(name, details?.EventDate == default(DateOnly) ? null : details?.EventDate,
                details?.Version, await members.Select(row => row.PlayerID).Distinct().OrderBy(id => id).ToArrayAsync(),
                await scrambles.CountAsync(),
                await db.KingQueenRoundScores.CountAsync(row => teams.Any(team => team.Id == row.KingQueenTeamId)),
                await db.PlayerScore.CountAsync(row => members.Any(member => member.Id == row.PlayersLeagueID) ||
                    assignments.Any(assignment => assignment.Id == row.KingQueenPlayerId)),
                await db.LeagueTeamScore.CountAsync(row => db.LeagueTeam.Any(team => team.LeagueID == leagueId &&
                    (team.Id == row.LeagueTeamId || team.Id == row.OpponentsLeagueTeamId))));
        }

        private static Task DeleteOwnedTournamentData(DataContext db, int leagueId) =>
            db.Database.ExecuteSqlInterpolatedAsync($"""
                DECLARE @event int={leagueId};

                -- Explicit child deletes below handle the known schema. Refuse new
                -- cascading or nulling relationships that could touch foreign data.
                IF EXISTS (
                    SELECT 1 FROM sys.foreign_keys fk
                    JOIN sys.foreign_key_columns c ON c.constraint_object_id=fk.object_id
                    JOIN sys.tables t ON t.object_id=fk.referenced_object_id
                    WHERE SCHEMA_NAME(t.schema_id)=N'dbo' AND fk.delete_referential_action<>0
                      AND t.name IN (N'LeagueType',N'PlayersLeague',N'PlayerScore',N'KingQueenTeam',N'KingQueenPlayer',
                          N'KingQueenRoundScores',N'ByePlayer',N'ByeRounds',N'TournamentRound',N'TournamentConfiguration',
                          N'LeagueScheduleEvent',N'LeagueSchedule',N'LeagueTeamScore',N'LeagueTeamPlayer',N'LeagueTeam',
                          N'PlayerSignIn',N'LeagueSignInLocked',N'KingQueenTopPlayer',N'LeagueSettings',N'UserLeague',N'LeagueDivision')
                      AND NOT EXISTS (
                          SELECT 1 FROM (VALUES
                              (N'LeagueType',N'ByeRounds',N'LeagueID'),
                              (N'LeagueType',N'KingQueenTopPlayer',N'LeagueId'),
                              (N'LeagueType',N'LeagueSettings',N'LeagueId'),
                              (N'LeagueType',N'PlayerSignIn',N'LeagueId'),
                              (N'LeagueType',N'UserLeague',N'LeagueTypeId'),
                              (N'PlayersLeague',N'PlayerScore',N'PlayersLeagueID'),
                              (N'KingQueenTeam',N'KingQueenPlayer',N'KingQueenTeamId'),
                              (N'KingQueenTeam',N'KingQueenRoundScores',N'KingQueenTeamId'),
                              (N'ByeRounds',N'ByePlayer',N'ByeRoundId'),
                              (N'LeagueTeam',N'LeagueTeamPlayer',N'LeagueTeamId'),
                              (N'LeagueTeam',N'LeagueTeamScore',N'LeagueTeamId')
                          ) allowed(parentTable,childTable,childColumn)
                          WHERE allowed.parentTable=t.name AND fk.delete_referential_action=1
                            AND fk.parent_object_id=OBJECT_ID(N'dbo.'+allowed.childTable)
                            AND COL_NAME(c.parent_object_id,c.parent_column_id)=allowed.childColumn
                      ))
                    THROW 51003, 'Unexpected cascading tournament relationship.', 1;

                -- Legacy rows can reference two separate events. A conflicting reference
                -- must never be resolved by removing an ordinary league's data.
                IF EXISTS (SELECT 1 FROM dbo.PlayersLeague m LEFT JOIN dbo.LeagueDivision d ON d.Id=m.LeagueDivisionId
                    WHERE (m.LeagueID=@event AND m.LeagueTypeID<>@event)
                       OR (m.LeagueID<>@event AND (m.LeagueTypeID=@event OR d.LeagueID=@event OR d.LeagueTypeID=@event)))
                OR EXISTS (SELECT 1 FROM dbo.LeagueDivision d WHERE (d.LeagueID=@event AND d.LeagueTypeID<>@event)
                    OR (d.LeagueID<>@event AND d.LeagueTypeID=@event))
                OR EXISTS (SELECT 1 FROM dbo.LeagueSignInLocked s WHERE (s.LeagueId=@event AND s.LeagueTypeID<>@event)
                    OR (s.LeagueId<>@event AND s.LeagueTypeID=@event))
                    THROW 51011, 'Tournament membership or division crosses event boundaries.', 1;
                IF EXISTS (SELECT 1 FROM dbo.PlayerScore s
                    JOIN dbo.PlayersLeague m ON m.ID=s.PlayersLeagueID
                    JOIN dbo.KingQueenPlayer p ON p.Id=s.KingQueenPlayerId
                    JOIN dbo.KingQueenTeam t ON t.Id=p.KingQueenTeamId
                    WHERE (m.LeagueID=@event AND t.LeagueID<>@event) OR (m.LeagueID<>@event AND t.LeagueID=@event))
                    THROW 51012, 'Tournament player score crosses event boundaries.', 1;
                IF EXISTS (SELECT 1 FROM dbo.LeagueTeamScore s JOIN dbo.LeagueTeam t ON t.ID=s.LeagueTeamId
                    JOIN dbo.LeagueTeam o ON o.ID=s.OpponentsLeagueTeamId
                    WHERE (t.LeagueID=@event AND o.LeagueID<>@event) OR (t.LeagueID<>@event AND o.LeagueID=@event))
                    THROW 51013, 'Tournament team score crosses event boundaries.', 1;
                IF EXISTS (SELECT 1 FROM dbo.LeagueSchedule s JOIN dbo.LeagueTeam a ON a.ID=s.Team1Id
                    JOIN dbo.LeagueTeam b ON b.ID=s.Team2Id
                    WHERE (s.LeagueId=@event AND (a.LeagueID<>@event OR b.LeagueID<>@event))
                       OR (s.LeagueId<>@event AND (a.LeagueID=@event OR b.LeagueID=@event)))
                    THROW 51014, 'Tournament schedule crosses event boundaries.', 1;

                DELETE s FROM dbo.PlayerScore s JOIN dbo.PlayersLeague m ON m.ID=s.PlayersLeagueID WHERE m.LeagueID=@event;
                DELETE s FROM dbo.KingQueenRoundScores s JOIN dbo.KingQueenTeam t ON t.Id=s.KingQueenTeamId WHERE t.LeagueID=@event;
                DELETE p FROM dbo.KingQueenPlayer p JOIN dbo.KingQueenTeam t ON t.Id=p.KingQueenTeamId WHERE t.LeagueID=@event;
                DELETE FROM dbo.KingQueenTeam WHERE LeagueID=@event;
                DELETE p FROM dbo.ByePlayer p JOIN dbo.ByeRounds r ON r.Id=p.ByeRoundId WHERE r.LeagueID=@event;
                DELETE FROM dbo.ByeRounds WHERE LeagueID=@event;
                DELETE FROM dbo.TournamentRound WHERE LeagueId=@event;
                DELETE FROM dbo.TournamentConfiguration WHERE LeagueId=@event;

                DELETE FROM dbo.LeagueScheduleEvent WHERE LeagueId=@event;
                DELETE FROM dbo.LeagueSchedule WHERE LeagueId=@event;
                DELETE s FROM dbo.LeagueTeamScore s JOIN dbo.LeagueTeam t ON t.ID=s.LeagueTeamId WHERE t.LeagueID=@event;
                DELETE p FROM dbo.LeagueTeamPlayer p JOIN dbo.LeagueTeam t ON t.ID=p.LeagueTeamId WHERE t.LeagueID=@event;
                DELETE FROM dbo.LeagueTeam WHERE LeagueID=@event;
                DELETE FROM dbo.PlayerSignIn WHERE LeagueId=@event;
                DELETE FROM dbo.LeagueSignInLocked WHERE LeagueId=@event;
                DELETE FROM dbo.KingQueenTopPlayer WHERE LeagueId=@event;
                DELETE FROM dbo.LeagueSettings WHERE LeagueId=@event;
                DELETE FROM dbo.UserLeague WHERE LeagueTypeId=@event;
                DELETE FROM dbo.PlayersLeague WHERE LeagueID=@event;
                DELETE FROM dbo.LeagueDivision WHERE LeagueID=@event;
                DELETE FROM dbo.LeagueType WHERE ID=@event AND EventTypeId=2;
                IF @@ROWCOUNT <> 1 THROW 51003, 'Tournament changed during deletion.', 1;
                """);
    }
}


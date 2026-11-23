using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers
{
    [Route("api/[controller]")]
    public partial class StatisticsController : Controller
    {
        [HttpGet("[action]/{leagueName}")]
        public List<LeagueTeam> GetTeams(string leagueName)
        {
            List<LeagueTeam> teams = new List<LeagueTeam>();
            var context = new DataContext();

            try
            {
                var league = context.Leagues
                    .FirstOrDefault(x => x.LeagueName == leagueName);

                if (league == null)
                {
                    return teams;
                }

                // Order: Gold, then Silver, then Bronze, then anything else
                teams = context.LeagueTeam
                    .Where(x => x.LeagueID == league.ID)
                    .OrderBy(x => x.Division.ToLower() != "gold")
                    .ThenBy(x => x.Division.ToLower() != "silver")
                    .ThenBy(x => x.Division.ToLower() != "bronze")
                    .ToList();
            }
            catch (Exception)
            {
                return teams;
            }

            return teams;
        }

        [HttpGet("[action]/{leagueId}")]
        public List<LeagueTeam> GetTeamsByLeagueId(int leagueId)
        {
            List<LeagueTeam> teams = new List<LeagueTeam>();
            var context = new DataContext();

            try
            {
                teams = context.LeagueTeam
                    .Where(x => x.LeagueID == leagueId)
                    .OrderBy(x => x.Division.ToLower() != "gold")
                    .ThenBy(x => x.Division.ToLower() != "silver")
                    .ThenBy(x => x.Division.ToLower() != "bronze")
                    .ToList();
            }
            catch (Exception)
            {
                return teams;
            }

            return teams;
        }


        [HttpGet("league-team-scores/{playerId}/{leagueId}")]
        public IActionResult GetLeagueTeamScores(int playerId, int leagueId)
        {
            using (var context = new DataContext())
            {
                var teamIds = context.LeagueTeam.Where(t => t.LeagueID == leagueId &&
                    context.LeagueTeamPlayer.Any(m => m.LeagueTeamId == t.Id && m.PlayerId == playerId)).Select(t => t.Id);
                var scores = context.LeagueTeamScore.AsNoTracking().Where(s => teamIds.Contains(s.LeagueTeamId))
                    .OrderBy(s => s.Date).ThenBy(s => s.Id).Select(s => new {
                        ScoreId = s.Id, s.Date, s.LeagueTeamId,
                        OpponentTeam = context.LeagueTeam.Where(t => t.Id == s.OpponentsLeagueTeamId).Select(t => t.TeamName).FirstOrDefault(),
                        s.TeamScore, s.WonGame
                    }).ToList();
                return Ok(scores);
            }
        }

        [HttpGet("league-standings/{leagueId}")]
        public IActionResult GetLeagueStandings(int leagueId)
        {
            var _context = new DataContext();

            // Get standings for the league
            var standings = _context.LeagueTeam
                .Where(lt => lt.LeagueID == leagueId)
                .Select(team => new
                {
                    TeamId = team.Id,
                    TeamName = team.TeamName,
                    Division = team.Division,
                    Wins = _context.LeagueTeamScore
                        .Where(score => score.LeagueTeamId == team.Id && score.WonGame)
                        .Count(),
                    Losses = _context.LeagueTeamScore
                        .Where(score => score.LeagueTeamId == team.Id && !score.WonGame)
                        .Count(),
                    TotalPoints = _context.LeagueTeamScore
                        .Where(score => score.LeagueTeamId == team.Id)
                        .Sum(score => score.TeamScore)
                })
                .ToList();

            return Ok(standings);
        }



        [HttpGet("combined-stats/{playerId}/{leagueId}")]
        public IActionResult GetCombinedStats(int playerId, int leagueId)
        {
            using (var context = new DataContext())
            {
                var teams = context.LeagueTeam.AsNoTracking().Where(t => t.LeagueID == leagueId).ToList();
                var leagueTeamIds = teams.Select(t => t.Id).ToList();
                var members = context.LeagueTeamPlayer.AsNoTracking().Where(m => leagueTeamIds.Contains(m.LeagueTeamId)).ToList();
                var ownTeamIds = members.Where(m => m.PlayerId == playerId).Select(m => m.LeagueTeamId).Distinct().ToList();
                var scores = context.LeagueTeamScore.AsNoTracking().Where(g => ownTeamIds.Contains(g.LeagueTeamId)).ToList();
                var playerIds = members.Where(m => ownTeamIds.Contains(m.LeagueTeamId)).Select(m => m.PlayerId).Distinct().ToList();
                var players = context.Players.AsNoTracking().Where(p => playerIds.Contains(p.Id)).ToList();
                return Ok(PlayerProfileStatistics.Combined(playerId, leagueId, teams, members, scores, players));
            }
        }



        [HttpPost("[action]")]
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult RecordLeagueTeamScore([FromBody] LeagueTeamScoreDto dto)
        {
            var _context = new DataContext();
            // Make sure the "Team" and "OpponentTeam" actually exist:
            var mainTeam = _context.LeagueTeam.FirstOrDefault(t => t.Id == dto.TeamId);
            var oppTeam = _context.LeagueTeam.FirstOrDefault(t => t.Id == dto.OpponentsTeamId);
            if (mainTeam == null || oppTeam == null)
            {
                return BadRequest("Either the main team or the opponent team was not found.");
            }

            if (mainTeam.LeagueID != oppTeam.LeagueID)
            {
                return BadRequest("Both teams must be in the same league.");
            }
            if (!LeagueAccess.CanManage(User, _context, mainTeam.LeagueID))
            {
                return Forbid();
            }

            var newScore = new LeagueTeamScore
            {
                LeagueTeamId = dto.TeamId,
                OpponentsLeagueTeamId = dto.OpponentsTeamId,
                TeamScore = dto.TeamScore,
                WonGame = dto.WonGame,
                Date = dto.Date, // or DateTime.Now if you want the current time
                LeagueTeam = mainTeam,
                OpponentsTeam = oppTeam
            };

            _context.LeagueTeamScore.Add(newScore);
            _context.SaveChanges();

            return Ok(newScore);
        }


        [HttpPost("[action]/{leagueName}")]
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public IActionResult UpdateTeamScores(string leagueName)
        {
            var _context = new DataContext();
            var league = _context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);
            if (league == null)
            {
                return Ok(new List<LeagueTeam>());
            }

            if (!LeagueAccess.CanManage(User, _context, league.ID))
            {
                return Forbid();
            }

            var teams = _context.LeagueTeam
                .Where(x => x.LeagueID == league.ID)
                .ToList();

            // For each team, count how many times they have "WonGame" = true
            foreach (var team in teams)
            {
                var winsAsMain = _context.LeagueTeamScore
                    .Count(s => s.LeagueTeamId == team.Id && s.WonGame == true);

                var lossesAsMain = _context.LeagueTeamScore
                    .Count(s => s.LeagueTeamId == team.Id && s.WonGame == false);

                team.TotalWins = winsAsMain;
                team.TotalLosses = lossesAsMain;

                _context.LeagueTeam.Update(team);
                _context.SaveChanges();
            }

            var updatedTeams = _context.LeagueTeam
                .Where(x => x.LeagueID == league.ID)
                .ToList();

            return Ok(updatedTeams);
        }


        [HttpGet("[action]/{leagueID}")]
        public List<PlayerInformation> GetPlayers(int leagueID)
        {
            List<PlayersLeague> playersLeagues = new List<PlayersLeague>();
            List<PlayerScore> playerScores = new List<PlayerScore>();
            PlayerScore singlePlayerScores = new PlayerScore();
            List<PlayerScore> allOnePlayerScores = new List<PlayerScore>();
            PlayerScore onePlayerScore = new PlayerScore();
            List<Player> players = new List<Player>();
            Player singlePlayer = new Player();
            var context = new DataContext();
            playersLeagues = context.PlayersLeagues.Where(x => x.LeagueID == leagueID).ToList();
            List<PlayerInformation> playerInformation = new List<PlayerInformation>();

            foreach (var playerLeague in playersLeagues)
            {

                allOnePlayerScores = context.PlayerScore.Where(x => x.PlayersLeagueID == playerLeague.Id).ToList();
                singlePlayer = context.Players.Where(x => x.Id == playerLeague.PlayerID).FirstOrDefault();

                PlayerInformation information = new PlayerInformation
                {
                    AllPlayerScores = allOnePlayerScores,
                    PlayerID = playerLeague.PlayerID,
                    FirstName = singlePlayer.FirstName,
                    LastName = singlePlayer.LastName,
                    IsSub = playerLeague.IsSub
                };
                playerInformation.Add(information);
            }



            return playerInformation;
        }

        [HttpGet("GetLeagueSchedule/{leagueId}")]
        public IActionResult GetLeagueSchedule(int leagueId)
        {
            using (var _context = new DataContext())
            {
                var schedule = ScheduleManagementController.PublicSchedule(_context, leagueId);

                return Ok(schedule);
            }
        }


        [HttpGet("GetAllTeamsWithPlayers/{leagueId}")]
        public List<TeamWithPlayersDto> GetAllTeamsWithPlayers(int leagueId)
        {
            using (var _context = new DataContext())
            {
                // 1) Grab all teams in the specified league
                var leagueTeams = _context.LeagueTeam
                    .Where(t => t.LeagueID == leagueId)
                    .ToList();

                // 2) For each team, find its players by looking up LeagueTeamPlayer
                var results = leagueTeams
                    .Select(team => new TeamWithPlayersDto
                    {
                        Id = team.Id,
                        TeamName = team.TeamName,
                        TotalWins = team.TotalWins,
                        TotalLosses = team.TotalLosses,
                        Division = team.Division,
                        // 3) Query LeagueTeamPlayer to get players for this specific team
                        Players = _context.LeagueTeamPlayer
                            .Where(ltp => ltp.LeagueTeamId == team.Id)
                            .Select(ltp => new PlayerDtoFullName
                            {
                                Id = ltp.Player.Id,
                                FullName = ltp.Player.FirstName + " " + ltp.Player.LastName,
                                IsMale = ltp.Player.IsMale
                            })
                            .ToList()
                    })
                    // 4) Order the results by division
                    .OrderBy(x => x.Division == "Gold" ? 1 :
                                  x.Division == "Silver" ? 2 :
                                  x.Division == "Bronze" ? 3 : 4)
                    .ToList();

                return results;
            }
        }



        [HttpPost("AddPlayerToLeagueTeam")]
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public IActionResult AddPlayerToLeagueTeam(int leagueTeamId, int playerId, int? leagueId = null)
        {
            using var context = new DataContext();
            var team = context.LeagueTeam.AsNoTracking().SingleOrDefault(t => t.Id == leagueTeamId);
            if (team == null || (leagueId.HasValue && team.LeagueID != leagueId))
                return BadRequest("Team does not belong to the selected league.");
            if (!LeagueAccess.CanManage(User, context, team.LeagueID))
                return Forbid();

            try
            {
                using var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable);
                if (!context.PlayersLeagues.Any(member => member.LeagueID == team.LeagueID && member.PlayerID == playerId))
                    return BadRequest("Player must be enrolled in the selected league.");
                // Only fixed league-team memberships count toward the active roster.
                if (context.LeagueTeamPlayer.Any(member => member.PlayerId == playerId &&
                    member.LeagueTeam.LeagueID == team.LeagueID))
                    return Conflict("Player is already assigned to a team in this league.");

                context.LeagueTeamPlayer.Add(new LeagueTeamPlayer { LeagueTeamId = leagueTeamId, PlayerId = playerId });
                context.SaveChanges();
                transaction.Commit();
                return Ok(new { message = $"Added player {playerId} to team {leagueTeamId} successfully." });
            }
            catch (Microsoft.Data.SqlClient.SqlException error) when (error.Number == 1205)
            {
                return Conflict("Another roster update was in progress. Refresh the roster and try again.");
            }
            catch (DbUpdateException error) when (error.InnerException is Microsoft.Data.SqlClient.SqlException sql &&
                (sql.Number == 1205 || sql.Number == 2601 || sql.Number == 2627))
            {
                return Conflict("Another roster update was in progress. Refresh the roster and try again.");
            }
        }

        [HttpPost("AddTeam")]
        [SameOrigin]
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult AddTeam([FromBody] AddTeamRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.TeamName))
                return BadRequest("Enter a team name.");
            using var _context = new DataContext();
            if (!LeagueAccess.CanManage(User, _context, request.LeagueId))
                return Forbid();
            if (!_context.Leagues.Any(league => league.ID == request.LeagueId))
                return BadRequest("League not found.");

            var name = request.TeamName.Trim();
            var division = request.Division?.Trim() ?? "";
            if (_context.LeagueTeam.Any(team => team.LeagueID == request.LeagueId &&
                team.TeamName.Trim().ToUpper() == name.ToUpper() && (team.Division ?? "").Trim().ToUpper() == division.ToUpper()))
                return Conflict("A team with that name already exists in this division.");

            // Create new LeagueTeam
            var newTeam = new LeagueTeam
            {
                LeagueID = request.LeagueId,
                TeamName = name,
                Division = division,
                TotalWins = 0,
                TotalLosses = 0
            };

            _context.LeagueTeam.Add(newTeam);
            _context.SaveChanges();

            // Return the newly created row (with its ID)
            return Ok(newTeam);

        }

        [HttpGet("available-dates/{leagueName}")]
        public IActionResult GetAvailableScoreDates(string leagueName)
        {
            var _context = new DataContext();

            // Step 1: Get the League ID from the LeagueType table using the league name
            var leagueId = _context.Leagues
                .Where(lt => lt.LeagueName == leagueName)
                .Select(lt => lt.ID)
                .FirstOrDefault();

            // Step 2: Check if the league exists
            if (leagueId == 0)
            {
                return NotFound($"League with name '{leagueName}' was not found.");
            }

            // Step 3: Fetch distinct dates for the league using the League ID
            var dates = _context.LeagueTeamScore
                .Where(score => score.LeagueTeam.LeagueID == leagueId)
                .Select(score => score.Date.Date)
                .Distinct()
                .OrderByDescending(date => date)
                .ToList();

            return Ok(dates);
        }


        // The request body for creating a team
        public class AddTeamRequest
        {
            public int LeagueId { get; set; }
            public string TeamName { get; set; }
            public string Division { get; set; }  // e.g. "Silver" or "Gold"
        }


        [HttpGet("[action]/{date}/{leagueName}")]
        public List<LeagueTeamScoreDto> GetTeamScores(string date, string leagueName)
        {
            var _context = new DataContext();
            var league = _context.Leagues
                .FirstOrDefault(x => x.LeagueName == leagueName);
            if (league == null)
            {
                return new List<LeagueTeamScoreDto>();
            }

            var parsedDate = DateTime.Parse(date);

            var scores = _context.LeagueTeamScore
                // If you must filter by league, you can do a join or check the teams leagueID
                .Where(s => s.Date.Date == parsedDate.Date && s.LeagueTeam.LeagueID == league.ID)
                .Include(s => s.LeagueTeam)
                .Include(s => s.OpponentsTeam)
                .ToList();

            var result = scores
                .Select(s => new LeagueTeamScoreDto
                {
                    Id = s.Id,
                    TeamId = s.LeagueTeamId,
                    OpponentsTeamId = s.OpponentsLeagueTeamId,
                    TeamScore = s.TeamScore,
                    WonGame = s.WonGame,
                    Date = s.Date,
                    OpponentsTeamName = s.OpponentsTeam.TeamName,
                    TeamName = s.LeagueTeam.TeamName
                })
                .OrderBy(s => s.TeamId)  // Correct placement of OrderBy
                .ToList();


            return result;
        }

        [HttpGet("[action]/{playerId}")]
        public List<LeagueTeamScoreDto> GetTeamScoresForPlayer(int playerId)
        {
            var _context = new DataContext();
            // 1) Get all LeagueTeamIds for this player from LeagueTeamPlayer
            var playerTeamIds = _context.LeagueTeamPlayer
                    .Where(ltp => ltp.PlayerId == playerId)
                    .Select(ltp => ltp.LeagueTeamId)
                    .Distinct()
                    .ToList();

            if (!playerTeamIds.Any())
            {
                // This player isn't on any LeagueTeams
                return new List<LeagueTeamScoreDto>();
            }

            // 2) Find all LeagueTeamScore rows where the main team or the opponent team
            //    is one of the player's teams
            var scores = _context.LeagueTeamScore
                .Where(s => playerTeamIds.Contains(s.LeagueTeamId))
                .ToList();

            // 3) Convert to Dto
            var result = scores.Select(s => new LeagueTeamScoreDto
            {
                Id = s.Id,
                TeamId = s.LeagueTeamId,
                OpponentsTeamId = s.OpponentsLeagueTeamId,
                TeamScore = s.TeamScore,
                WonGame = s.WonGame,
                Date = s.Date
            })
            .ToList();

            return result;

        }

        [HttpPost("SetTeamDivision")]
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public IActionResult SetTeamDivision(int leagueTeamId, string division)
        {
            var _context = new DataContext();
            var team = _context.LeagueTeam.FirstOrDefault(t => t.Id == leagueTeamId);
            if (team == null)
                return NotFound("Team not found.");

            if (!LeagueAccess.CanManage(User, _context, team.LeagueID))
                return Forbid();

            team.Division = division; // e.g. "Silver" or "Gold"
            _context.SaveChanges();

            return Ok($"Team {team.TeamName} updated to division: {division}");

        }

        [HttpGet("GetProfile")]
        public async Task<IActionResult> GetProfile(int playerId, int? leagueId = null)
        {
            using (var context = new DataContext())
            {
                var player = await context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == playerId);
                if (player == null) return NotFound();
                string divisionName = null;
                if (leagueId.HasValue)
                    divisionName = await (from membership in context.PlayersLeagues
                        join division in context.LeagueDivision on membership.LeagueDivisionId equals (int?)division.Id
                        where membership.PlayerID == playerId && membership.LeagueID == leagueId.Value && division.LeagueID == leagueId.Value
                        select division.Name).FirstOrDefaultAsync();
                return Ok(new { player.Id, player.FirstName, player.LastName, player.IsMale, player.Gender, player.IsSub, DivisionName = divisionName });
            }
        }

        [HttpGet("GetPlayerLeagues")]
        public async Task<IActionResult> GetPlayerLeagues(int playerId)
        {
            var _context = new DataContext();
            var leagues = await (from pl in _context.PlayersLeagues
                                 join l in _context.Leagues on pl.LeagueID equals l.ID
                                 where pl.PlayerID == playerId
                                 select new
                                 {
                                     l.LeagueName,
                                     pl.IsSub
                                 }).ToListAsync();

            return Ok(leagues);
        }

        [HttpGet("GetPerformanceStats")]
        public async Task<IActionResult> GetPerformanceStats(int playerId)
        {
            var _context = new DataContext();
            var stats = await (from kqrs in _context.KingQueenRoundScores
                               join kqt in _context.KingQueenTeam on kqrs.KingQueenTeamId equals kqt.Id
                               where (from kqp in _context.KingQueenPlayer
                                      where kqp.PlayerId == playerId && kqp.KingQueenTeamId == kqt.Id
                                      select kqp.Id).Any()
                               select new
                               {
                                   kqrs.RoundScore,
                                   kqrs.RoundWon
                               }).ToListAsync();

            return Ok(new
            {
                TotalRounds = stats.Count,
                TotalScores = stats.Sum(s => s.RoundScore),
                TotalWins = stats.Count(s => (bool)s.RoundWon)
            });
        }

        [HttpGet("GetByeRounds")]
        public async Task<IActionResult> GetByeRounds(int playerId)
        {
            var _context = new DataContext();
            var byeRounds = await (from bp in _context.ByePlayer
                                   join br in _context.ByeRounds on bp.ByeRoundId equals br.Id
                                   where bp.PlayerId == playerId
                                   select new
                                   {
                                       br.DateOfRound
                                   }).ToListAsync();

            return Ok(byeRounds);
        }

        [HttpGet("GetDetailedPerformanceStats")]
        public async Task<IActionResult> GetDetailedPerformanceStats(int playerId, int leagueId)
        {
            using (var context = new DataContext())
            {
                var rounds = await (from score in context.KingQueenRoundScores.AsNoTracking()
                    join team in context.KingQueenTeam on score.KingQueenTeamId equals team.Id
                    where team.LeagueID == leagueId && context.KingQueenPlayer.Any(m => m.PlayerId == playerId && m.KingQueenTeamId == team.Id)
                    select new ProfileRound { ScoreId = score.Id, Id = team.Id, RoundNumber = score.RoundId,
                        RoundScore = score.RoundScore, RoundWon = score.RoundWon, ScrambleNumber = team.ScrambleNumber, DateOfTeam = team.DateOfTeam })
                    .ToListAsync();
                var teamIds = rounds.Select(r => r.Id).Distinct().ToList();
                var members = await (from member in context.KingQueenPlayer.AsNoTracking()
                    join team in context.KingQueenTeam on member.KingQueenTeamId equals team.Id
                    join player in context.Players on member.PlayerId equals player.Id
                    where team.LeagueID == leagueId && teamIds.Contains(team.Id) && member.PlayerId != playerId
                    select new ProfileMember { Id = team.Id, PlayerId = player.Id, PlayerName = player.FirstName + " " + player.LastName,
                        IsMale = player.IsMale, ScrambleNumber = team.ScrambleNumber }).ToListAsync();
                return Ok(PlayerProfileStatistics.KingQueen(playerId, rounds, members));
            }
        }
    }
    public class TeamMember
    {
        public int PlayerId { get; set; }
        public string PlayerName { get; set; }
        public bool IsMale { get; set; }
    }
}

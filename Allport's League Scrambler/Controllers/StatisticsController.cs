using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static Microsoft.AspNetCore.Hosting.Internal.HostingApplication;

namespace Allport_s_League_Scrambler.Controllers
{
    [Route("api/[controller]")]
    public class StatisticsController : Controller
    {
        [HttpGet("[action]/{leagueName}")]
        public List<LeagueTeam> GetTeams(string leagueName)
        {
            List<LeagueTeam> teams = new List<LeagueTeam>();
            var context = new DataContext();
            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            try
            {
                teams = context.LeagueTeam.Where(x => x.LeagueID == league.ID).ToList();
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
                teams = context.LeagueTeam.Where(x => x.LeagueID == leagueId).ToList();
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
            var _context = new DataContext();

            // Filter scores for the player's team within the specified league
            var scores = _context.LeagueTeamScore
                .Join(
                    _context.LeagueTeamPlayer,
                    score => score.LeagueTeamId,
                    teamPlayer => teamPlayer.LeagueTeamId,
                    (score, teamPlayer) => new { score, teamPlayer }
                )
                .Join(
                    _context.LeagueTeam,
                    joined => joined.teamPlayer.LeagueTeamId,
                    leagueTeam => leagueTeam.Id,
                    (joined, leagueTeam) => new { joined.score, joined.teamPlayer, leagueTeam }
                )
                .Where(joined =>
                    joined.leagueTeam.LeagueID == leagueId && // Match league
                    joined.score.LeagueTeamId == joined.leagueTeam.Id && // Match team
                    joined.teamPlayer.PlayerId == playerId) // Match player
                .GroupBy(joined => joined.score.Id) // Group by unique score ID to eliminate duplicates
                .Select(group => new
                {
                    Date = group.FirstOrDefault().score.Date,
                    OpponentTeam = _context.LeagueTeam
                        .Where(t => t.Id == group.FirstOrDefault().score.OpponentsLeagueTeamId)
                        .Select(t => t.TeamName)
                        .FirstOrDefault(),
                    TeamScore = group.FirstOrDefault().score.TeamScore,
                    WonGame = group.FirstOrDefault().score.WonGame
                })
                .ToList();

            return Ok(scores);
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
            var _context = new DataContext();

            // Get all scores for the player's team within the specified league
            var scores = _context.LeagueTeamScore
                .Join(
                    _context.LeagueTeamPlayer,
                    score => score.LeagueTeamId,
                    teamPlayer => teamPlayer.LeagueTeamId,
                    (score, teamPlayer) => new { score, teamPlayer }
                )
                .Join(
                    _context.LeagueTeam,
                    joined => joined.teamPlayer.LeagueTeamId,
                    leagueTeam => leagueTeam.Id,
                    (joined, leagueTeam) => new { joined.score, joined.teamPlayer, leagueTeam }
                )
                .Where(joined => joined.teamPlayer.PlayerId == playerId && joined.leagueTeam.LeagueID == leagueId)
                .Select(joined => new
                {
                    Score = joined.score,
                    TeamPlayer = joined.teamPlayer,
                    LeagueTeam = joined.leagueTeam
                })
                .ToList();

            if (!scores.Any())
            {
                return Ok(new
                {
                    totalScores = 0,
                    totalWins = 0,
                    totalGames = 0,
                    winPercentage = 0,
                    averageScore = 0,
                    highestScore = 0,
                    lowestScore = 0,
                    longestWinStreak = 0,
                    longestLossStreak = 0,
                    totalOpponents = 0,
                    opponentStats = new List<object>(),
                    leagueStats = new List<object>(),
                    teammateStats = new List<object>()
                });
            }



            int? leagueTeamId = null;

            if (scores != null && scores.Count > 0 && scores[0].Score != null)
            {
                leagueTeamId = scores[0].Score.LeagueTeamId;
            }

            // Log or handle cases where opponentsLeagueTeamId is null
            if (leagueTeamId == null)
            {
                Console.WriteLine("OpponentsLeagueTeamId is null. Ensure scores contain valid data.");
            }

            var distinctOpponentTeamIds = _context.LeagueTeamScore
                    .Where(s => s.LeagueTeamId == leagueTeamId)
                    .Select(s => s.OpponentsLeagueTeamId)
                    .Distinct()
                    .ToList();

            // Ensure valid opponent IDs
            if (distinctOpponentTeamIds == null || !distinctOpponentTeamIds.Any())
            {
                Console.WriteLine("No distinct opponent team IDs found.");
            }

            // Calculate totals
            var totalScores = scores.Sum(s => s.Score.TeamScore);
            var totalWins = scores.Count(s => s.Score.WonGame);
            var totalGames = scores.Count();
            var winPercentage = totalGames > 0 ? (double)totalWins / totalGames * 100 : 0;

            // Calculate averages
            var averageScore = totalGames > 0 ? scores.Average(s => s.Score.TeamScore) : 0;

            // Calculate highest and lowest scores
            var highestScore = totalGames > 0 ? scores.Max(s => s.Score.TeamScore) : 0;
            var lowestScore = totalGames > 0 ? scores.Min(s => s.Score.TeamScore) : 0;

            // Streak calculations
            int currentWinStreak = 0, longestWinStreak = 0;
            int currentLossStreak = 0, longestLossStreak = 0;
            foreach (var game in scores.OrderBy(s => s.Score.Date))
            {
                if (game.Score.WonGame)
                {
                    currentWinStreak++;
                    longestWinStreak = Math.Max(longestWinStreak, currentWinStreak);
                    currentLossStreak = 0;
                }
                else
                {
                    currentLossStreak++;
                    longestLossStreak = Math.Max(longestLossStreak, currentLossStreak);
                    currentWinStreak = 0;
                }
            }

            // Opponent stats
            var opponentStats = distinctOpponentTeamIds
                 .Select(opponentsLeagueTeamId => new
                 {
                     OpponentTeamId = opponentsLeagueTeamId,
                     OpponentTeamName = _context.LeagueTeam
                         .Where(t => t.Id == opponentsLeagueTeamId)
                         .Select(t => t.TeamName)
                         .FirstOrDefault(),
                     GamesPlayed = _context.LeagueTeamScore
                         .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId)
                         .Count(),
                     Wins = _context.LeagueTeamScore
                         .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId && s.WonGame)
                         .Count(),
                     WinPercentage = _context.LeagueTeamScore
                         .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId)
                         .Count() > 0
                         ? (double)_context.LeagueTeamScore
                             .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId && s.WonGame)
                             .Count() /
                           _context.LeagueTeamScore
                             .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId)
                             .Count() * 100
                         : 0,
                     TotalPointsScored = _context.LeagueTeamScore
                         .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId)
                         .Sum(s => s.TeamScore),
                     AveragePointsPerGame = _context.LeagueTeamScore
                         .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId)
                         .Count() > 0
                         ? (double)_context.LeagueTeamScore
                             .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId)
                             .Sum(s => s.TeamScore) /
                           _context.LeagueTeamScore
                             .Where(s => s.LeagueTeamId == opponentsLeagueTeamId && s.OpponentsLeagueTeamId == leagueTeamId)
                             .Count()
                         : 0
                 })
                 .ToList();

            // League stats
            var leagueStats = scores
                .GroupBy(s => s.Score.LeagueTeamId)
                .Select(g => new
                {
                    LeagueTeamId = g.Key,
                    LeagueName = _context.LeagueTeam
                        .Where(lt => lt.Id == g.Key)
                        .Select(lt => lt.TeamName)
                        .FirstOrDefault(),
                    GamesPlayed = g.Count(),
                    Wins = g.Count(s => s.Score.WonGame),
                    WinPercentage = g.Count() > 0 ? (double)g.Count(s => s.Score.WonGame) / g.Count() * 100 : 0
                })
                .ToList();

            // Teammate stats
            var teammateStats = _context.LeagueTeamPlayer
                .Where(tp => tp.PlayerId == playerId) // Find the LeagueTeamId for the given player
                .Select(tp => tp.LeagueTeamId)
                .Distinct() // Ensure only one LeagueTeamId is retrieved
                .Join(_context.LeagueTeamPlayer,
                      team => team,
                      other => other.LeagueTeamId,
                      (team, other) => new { TeamPlayer = team, Teammate = other }) // Join to find teammates
                .Where(joined => joined.Teammate.PlayerId != playerId) // Exclude the original player
                .Select(joined => new
                {
                    PlayerId = joined.Teammate.PlayerId,
                    PlayerName = _context.Players
                        .Where(p => p.Id == joined.Teammate.PlayerId)
                        .Select(p => p.FirstName + " " + p.LastName)
                        .FirstOrDefault()
                })
                .Distinct()
                .ToList();


            // Total unique opponents
            var totalOpponents = scores
                .Select(s => s.Score.OpponentsLeagueTeamId)
                .Distinct()
                .Count();

            // Results
            return Ok(new
            {
                totalScores,
                totalWins,
                totalGames,
                winPercentage,
                averageScore,
                highestScore,
                lowestScore,
                longestWinStreak,
                longestLossStreak,
                totalOpponents,
                opponentStats,
                leagueStats,
                teammateStats
            });
        }



        [HttpPost("[action]")]
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


        [HttpGet("[action]/{leagueName}")]
        public List<LeagueTeam> UpdateTeamScores(string leagueName)
        {
            var _context = new DataContext();
            var league = _context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);
            if (league == null)
            {
                return new List<LeagueTeam>();
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

            return updatedTeams;
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
                var schedule = _context.LeagueSchedule
                    .Where(s => s.LeagueId == leagueId)
                    .GroupBy(s => new { s.WeekNumber, s.Date })
                    .Select(g => new
                    {
                        WeekNumber = g.Key.WeekNumber,
                        Date = g.Key.Date,
                        Matches = g.Select(m => new
                        {
                            Team1Name = _context.LeagueTeam.FirstOrDefault(t => t.Id == m.Team1Id).TeamName,
                            Team2Name = _context.LeagueTeam.FirstOrDefault(t => t.Id == m.Team2Id).TeamName,
                            MatchDescription = m.MatchDescription,
                            Division = _context.LeagueTeam.FirstOrDefault(t => t.Id == m.Team1Id).Division,
                        }).ToList()
                    })
                    .ToList();

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
                    .ToList();

                return results;
            }
        }



        [HttpPost("AddPlayerToLeagueTeam")]
        public IActionResult AddPlayerToLeagueTeam(int leagueTeamId, int playerId)
        {
            using (var _context = new DataContext())
            {
                var leagueTeam = _context.LeagueTeam.FirstOrDefault(t => t.Id == leagueTeamId);
                var player = _context.Players.FirstOrDefault(p => p.Id == playerId);

                if (leagueTeam == null || player == null)
                    return BadRequest("LeagueTeam or Player not found.");

                // Check if the player is already on the team
                var exists = _context.LeagueTeamPlayer
                    .Any(ltp => ltp.LeagueTeamId == leagueTeamId && ltp.PlayerId == playerId);
                if (exists)
                    return BadRequest("Player is already on that team.");

                // Add the player to the team
                var newRow = new LeagueTeamPlayer
                {
                    LeagueTeamId = leagueTeamId,
                    PlayerId = playerId
                };
                _context.LeagueTeamPlayer.Add(newRow);
                _context.SaveChanges();

                return Ok(new { message = $"Added player {playerId} to team {leagueTeamId} successfully." });
            }
        }



        [HttpPost("AddTeam")]
        public IActionResult AddTeam([FromBody] AddTeamRequest request)
        {
            var _context = new DataContext();
            // Basic checks
            var league = _context.Leagues.FirstOrDefault(x => x.ID == request.LeagueId);
            if (league == null)
                return BadRequest("League not found.");

            // Create new LeagueTeam
            var newTeam = new LeagueTeam
            {
                LeagueID = request.LeagueId,
                TeamName = request.TeamName,
                Division = request.Division ?? "", // e.g. "Silver" or "Gold"
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
                // If you must filter by league, you can do a join or check the team’s leagueID
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
        public IActionResult SetTeamDivision(int leagueTeamId, string division)
        {
            var _context = new DataContext();
            var team = _context.LeagueTeam.FirstOrDefault(t => t.Id == leagueTeamId);
            if (team == null)
                return NotFound("Team not found.");

            team.Division = division; // e.g. "Silver" or "Gold"
            _context.SaveChanges();

            return Ok($"Team {team.TeamName} updated to division: {division}");

        }

        [HttpGet("GetProfile")]
        public async Task<IActionResult> GetProfile(int playerId)
        {
            var _context = new DataContext();
            var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId);
            if (player == null)
            {
                return NotFound();
            }

            return Ok(player);
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
            var _context = new DataContext();

            // Fetch individual round scores and wins
            var individualRounds = await (from kqrs in _context.KingQueenRoundScores
                                          join kqt in _context.KingQueenTeam on kqrs.KingQueenTeamId equals kqt.Id
                                          where kqt.LeagueID == leagueId &&
                                                (from kqp in _context.KingQueenPlayer
                                                 where kqp.PlayerId == playerId && kqp.KingQueenTeamId == kqt.Id
                                                 select kqp.Id).Any()
                                          select new
                                          {
                                              RoundNumber = kqrs.RoundId,
                                              kqrs.RoundScore,
                                              kqrs.RoundWon,
                                              kqt.ScrambleNumber,
                                              kqt.DateOfTeam,
                                              kqt.Id // Include KingQueenTeamId for filtering teammates
                                          })
                                          .OrderBy(x => x.DateOfTeam) // First, order by DateOfTeam
                                          .ThenBy(x => x.RoundNumber)
                                          .ToListAsync();

            // Fetch team members for the player's teams
            var playerTeamIds = individualRounds.Select(r => r.Id).Distinct();

            var teamData = await (from kqp in _context.KingQueenPlayer
                                  join kqt in _context.KingQueenTeam on kqp.KingQueenTeamId equals kqt.Id
                                  where playerTeamIds.Contains(kqt.Id) // Filter only teams the player is on
                                        && kqp.PlayerId != playerId    // Exclude the player themselves
                                  select new
                                  {
                                      kqt.ScrambleNumber,
                                      kqp.PlayerId,
                                      PlayerName = _context.Players
                                          .Where(p => p.Id == kqp.PlayerId)
                                          .Select(p => p.FirstName + " " + p.LastName)
                                          .FirstOrDefault(),
                                      IsMale = _context.Players
                                          .Where(p => p.Id == kqp.PlayerId)
                                          .Select(p => p.IsMale)
                                          .FirstOrDefault(),
                                      kqt.Id // Include KingQueenTeamId for filtering teammates
                                  }).Distinct().ToListAsync();

            var winsTogether = await (from kqrs in _context.KingQueenRoundScores
                                      join kqt in _context.KingQueenTeam on kqrs.KingQueenTeamId equals kqt.Id
                                      join kqp in _context.KingQueenPlayer on kqt.Id equals kqp.KingQueenTeamId
                                      where playerTeamIds.Contains(kqt.Id) // Filter only teams the player is on
                                            && kqrs.RoundWon == true       // Count only rounds won
                                            && kqp.PlayerId != playerId    // Exclude the player themselves
                                      group new { kqp.PlayerId, kqrs.RoundId, kqrs.KingQueenTeamId }
                                      by new { kqp.PlayerId, kqrs.RoundId, kqrs.KingQueenTeamId } into uniqueWins
                                      select new
                                      {
                                          PlayerId = uniqueWins.Key.PlayerId,
                                          RoundId = uniqueWins.Key.RoundId,
                                          TeamId = uniqueWins.Key.KingQueenTeamId
                                      })
                                      .GroupBy(win => win.PlayerId)
                                      .Select(group => new
                                      {
                                          PlayerId = group.Key,
                                          WinsTogether = group.Count() // Count all unique combinations of RoundId and TeamId
                                      }).ToListAsync();


            // Group team members by scramble number
            var teamsGrouped = teamData
                .GroupBy(t => t.ScrambleNumber)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(t => new TeamMember
                    {
                        PlayerId = t.PlayerId,
                        PlayerName = t.PlayerName,
                        IsMale = t.IsMale
                    }).ToList()
                );

            // Calculate scramble totals, handling duplicate players correctly
            var scrambleTotals = individualRounds
                .GroupBy(r => r.ScrambleNumber)
                .Select(g => new
                {
                    ScrambleNumber = g.Key,
                    TotalScore = g.GroupBy(r => r.Id).Sum(teamGroup => teamGroup.Sum(r => r.RoundScore)), // Avoid double-counting
                    Wins = g.Count(r => (bool)r.RoundWon),
                    Team = teamsGrouped.TryGetValue(g.Key, out var team) ? team : new List<TeamMember>()
                })
                .ToList();

            var teammateCounts = (from teammate in teamData
                                  join win in winsTogether on teammate.PlayerId equals win.PlayerId into winData
                                  from win in winData.DefaultIfEmpty() // Handle left join
                                  group new { teammate, win } by new { teammate.PlayerId, teammate.PlayerName } into grouped
                                  select new
                                  {
                                      PlayerId = grouped.Key.PlayerId,
                                      PlayerName = grouped.Key.PlayerName,
                                      Count = grouped.Select(g => g.teammate.ScrambleNumber).Distinct().Count(), // Count unique scrambles
                                      WinsTogether = grouped.FirstOrDefault()?.win?.WinsTogether ?? 0 // Use WinsTogether directly from win
                                  })
                               .OrderByDescending(t => t.Count)
                               .ToList();




            // Calculate overall totals
            var totalScores = individualRounds.GroupBy(r => r.Id).Sum(teamGroup => teamGroup.Sum(r => r.RoundScore)); // Avoid double-counting
            var totalWins = individualRounds.Count(r => (bool)r.RoundWon);

            return Ok(new
            {
                IndividualRounds = individualRounds,
                ScrambleTotals = scrambleTotals,
                TotalScores = totalScores,
                TotalWins = totalWins,
                TeammateCounts = teammateCounts
            });
        }
    }
    public class TeamMember
    {
        public int PlayerId { get; set; }
        public string PlayerName { get; set; }
        public bool IsMale { get; set; }
    }
}

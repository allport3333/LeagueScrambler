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
                            MatchDescription = m.MatchDescription
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
                .Where(s => s.Date.Date == parsedDate.Date)
                .ToList();

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
                                          }).ToListAsync();

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

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

        [HttpPost("[action]")]
        public List<TeamScore> AddScore([FromBody] List<TeamScore> teamScore)
        {
            var context = new DataContext();
            List<TeamScore> teamScoresAdded = new List<TeamScore>();
            foreach (var score in teamScore)
            {
                var newScore = new TeamScore()
                {
                    Date = score.Date,
                    Team1ID = score.Team1ID,
                    Team2ID = score.Team2ID,
                    Team1Score = score.Team1Score,
                    Team2Score = score.Team2Score
                };
                teamScoresAdded.Add(newScore);
                context.TeamScore.Add(newScore);
            }

            context.SaveChanges();

            return teamScoresAdded;
        }

        [HttpGet("[action]/{leagueName}")]
        public List<LeagueTeam> UpdateTeamScores(string leagueName)
        {
            var context = new DataContext();
            var teams = new List<LeagueTeam>();
            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            teams = context.LeagueTeam.Where(x => x.LeagueID == league.ID).ToList();

            foreach (var team in teams)
            {
                var teamScores1 = new List<TeamScore>();
                teamScores1 = context.TeamScore.Where(x => x.Team1ID == team.Id && x.Team1Score == 15).ToList();
                var teamScores2 = new List<TeamScore>();
                teamScores2 = context.TeamScore.Where(x => x.Team2ID == team.Id && x.Team2Score == 15).ToList();
                var totalWins = teamScores1.Count();
                totalWins = totalWins + teamScores2.Count(); ;

                var teamScoresLosses1 = new List<TeamScore>();
                teamScoresLosses1 = context.TeamScore.Where(x => x.Team1ID == team.Id && x.Team1Score != 15).ToList();
                var teamScoresLosses2 = new List<TeamScore>();
                teamScoresLosses2 = context.TeamScore.Where(x => x.Team2ID == team.Id && x.Team2Score != 15).ToList();
                var totalLosses = teamScoresLosses1.Count();
                totalLosses = totalLosses + teamScoresLosses2.Count();

                var leagueTeam = context.LeagueTeam.Where(x => x.Id == team.Id).FirstOrDefault();
                leagueTeam.TotalWins = totalWins;
                leagueTeam.TotalLosses = totalLosses;
                context.LeagueTeam.Update(leagueTeam);
                context.SaveChanges();
            }

            var updatedTeams = GetTeams(league.LeagueName);

            context.SaveChanges();
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

        [HttpPost("[action]")]
        public LeagueTeam AddTeam([FromBody] NewCreatedTeam newCreatedTeam)
        {
            var context = new DataContext();
            var newTeam = new LeagueTeam();
            if (newCreatedTeam.LeagueName != null)
            {
                var league = context.Leagues.Where(x => x.LeagueName == newCreatedTeam.LeagueName).FirstOrDefault();
                var teamExists = context.LeagueTeam.Where(x => x.TeamName == newCreatedTeam.TeamName && x.LeagueID == league.ID).FirstOrDefault();

                if (teamExists == null)
                {
                    newTeam = new LeagueTeam()
                    {
                        TeamName = newCreatedTeam.TeamName,
                        TotalLosses = 0,
                        TotalWins = 0,
                        LeagueID = league.ID
                    };


                    context.LeagueTeam.Add(newTeam);
                    context.SaveChanges();

                    return newTeam;

                }
                else
                {
                    return newTeam;
                }
            }
            else
            {
                return newTeam;
            }

        }

        [HttpGet("[action]/{date}/{leagueName}")]
        public List<LeagueTeamScore> GetTeamScores(string date, string leagueName)
        {
            var context = new DataContext();
            var teams = new List<LeagueTeam>();
            //List<TeamScore> leagueTeamScores = new List<TeamScore>();
            List<LeagueTeam> leagueTeams = new List<LeagueTeam>();
            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            leagueTeams = context.LeagueTeam.Where(x => x.LeagueID == league.ID).ToList();
            teams = context.LeagueTeam.Where(x => x.LeagueID == league.ID).ToList();
            var newDate = DateTime.Parse(date);
            List<LeagueTeamScore> leagueTeamScores1 = new List<LeagueTeamScore>();

            foreach (var team in teams)
            {
                List<TeamScore> teamScores = context.TeamScore.Where(x => x.Team1ID == team.Id && x.Date == newDate).ToList();
                foreach (var teamScoreSingle in teamScores)
                {
                    LeagueTeamScore leagueTeamScore = new LeagueTeamScore();
                    leagueTeamScore.Team1ID = teamScoreSingle.Team1ID;
                    leagueTeamScore.Team2ID = teamScoreSingle.Team2ID;
                    leagueTeamScore.Team1Score = teamScoreSingle.Team1Score;
                    leagueTeamScore.Team2Score = teamScoreSingle.Team2Score;
                    leagueTeamScore.Id = teamScoreSingle.Id;
                    leagueTeamScore.Date = teamScoreSingle.Date;
                    foreach (var leagueTeam in leagueTeams)
                    {
                        if (leagueTeam.Id == teamScoreSingle.Team1ID)
                        {
                            leagueTeamScore.Team1Name = leagueTeam.TeamName;
                        }
                        if (leagueTeam.Id == teamScoreSingle.Team2ID)
                        {
                            leagueTeamScore.Team2Name = leagueTeam.TeamName;
                        }
                    }
                    leagueTeamScores1.Add(leagueTeamScore);
                }

            }

            return leagueTeamScores1.OrderBy(x => x.Team1Name).ToList();
        }

        [HttpGet("GetLeagues")]
        public async Task<IActionResult> GetLeagues()
        {

            var _context = new DataContext();
            var leagues = await _context.Leagues
                .Select(l => new { l.ID, l.LeagueName })
                .ToListAsync();

            return Ok(leagues);
        }

        [HttpGet("GetLeaguesForPlayer")]
        public async Task<IActionResult> GetLeaguesForPlayer(int playerId)
        {
            if (playerId <= 0)
            {
                return BadRequest("Invalid playerId.");
            }

            var _context = new DataContext();

            var leagues = await (from pl in _context.PlayersLeagues
                                 join l in _context.Leagues on pl.LeagueID equals l.ID
                                 where pl.PlayerID == playerId
                                 select new
                                 {
                                     l.ID,
                                     l.LeagueName
                                 }).ToListAsync();

            if (leagues == null || !leagues.Any())
            {
                return NotFound($"No leagues found for playerId {playerId}.");
            }

            return Ok(leagues);
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
                                  select new
                                  {
                                      kqt.ScrambleNumber,
                                      kqp.PlayerId,
                                      PlayerName = _context.Players
                                          .Where(p => p.Id == kqp.PlayerId)
                                          .Select(p => p.FirstName + " " + p.LastName)
                                          .FirstOrDefault(),
                                          isMale = _context.Players
                                          .Where(p => p.Id == kqp.PlayerId)
                                          .Select(p => p.IsMale)
                                          .FirstOrDefault(),
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
                        IsMale = t.isMale
                    }).ToList()
                );

            // Calculate scramble totals
            var scrambleTotals = individualRounds
                .GroupBy(r => r.ScrambleNumber)
                .Select(g => new
                {
                    ScrambleNumber = g.Key,
                    TotalScore = g.Sum(r => r.RoundScore),
                    Wins = g.Count(r => (bool)r.RoundWon),
                    Team = teamsGrouped.TryGetValue(g.Key, out var team) ? team : new List<TeamMember>()
                })
                .ToList();

            // Calculate overall totals
            var totalScores = individualRounds.Sum(r => r.RoundScore);
            var totalWins = individualRounds.Count(r => (bool)r.RoundWon);

            return Ok(new
            {
                IndividualRounds = individualRounds,
                ScrambleTotals = scrambleTotals,
                TotalScores = totalScores,
                TotalWins = totalWins
            });
        }
    }
    public class TeamMember
    {
        public int PlayerId { get; set; }
        public string PlayerName { get; set; }
        public bool IsMale { get; set;}
    }
}

using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Mvc;

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
        public TeamScore AddScore([FromBody] TeamScore teamScore)
        {
            var context = new DataContext();
            var newScore = new TeamScore()
            {
                Date = teamScore.Date,                
                Team1ID = teamScore.Team1ID,
                Team2ID = teamScore.Team2ID,
                Team1Score = teamScore.Team1Score,
                Team2Score = teamScore.Team2Score                
            };
            context.TeamScore.Add(newScore);
            context.SaveChanges();
            return newScore;
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
                    LastName = singlePlayer.LastName
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

    }
}

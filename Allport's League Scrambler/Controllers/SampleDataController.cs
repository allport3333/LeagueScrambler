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
    public class SampleDataController : Controller
    {


        [HttpGet("[action]")]
        public IEnumerable<Player> GetPlayers()
        {
            List<Player> players = new List<Player>();
            var context = new DataContext();
            players = context.Players.OrderBy(x => x.LastName).ToList();
            foreach (var player in players)
            {
                if (player.IsMale != false)
                {
                    player.Gender = "Male";
                }
                else
                {
                    player.Gender = "Female";
                }
            }

            context.SaveChanges();

            return players;
        }

        [HttpGet("[action]")]
        public IEnumerable<Player> GetAllMalePlayers()
        {
            List<Player> players = new List<Player>();
            var context = new DataContext();
            players = context.Players.Where(x => x.IsMale == true).OrderBy(x => x.LastName).ToList();

            return players;
        }
        [HttpGet("[action]")]
        public IEnumerable<LeagueType> GetLeagues()
        {
            List<LeagueType> leagues = new List<LeagueType>();
            var context = new DataContext();
            leagues = context.Leagues.ToList();

            return leagues;
        }
        [HttpGet("[action]")]
        public IEnumerable<Player> GetAllFemalePlayers()
        {
            List<Player> players = new List<Player>();
            var context = new DataContext();
            players = context.Players.Where(x => x.IsMale == false).OrderBy(x => x.LastName).ToList();

            return players;
        }

        [HttpGet("[action]")]
        public int GetNumberOfBrackets()
        {
            int players;
            int brackets;
            var context = new DataContext();
            players = context.Players.Count();

            if (players > 6 && players <= 8)
            {
                brackets = 1;
            }
            else if (players > 8 && players <= 16)
            {
                brackets = 2;
            }
            else if (players > 16 && players <= 24)
            {
                brackets = 3;
            }
            else if (players > 24 && players <= 32)
            {
                brackets = 4;
            }
            else if (players > 32 && players <= 40)
            {
                brackets = 5;
            }
            else if (players > 40 && players <= 48)
            {
                brackets = 6;
            }
            else if (players > 48 && players <= 56)
            {
                brackets = 7;
            }
            else if (players > 56 && players <= 64)
            {
                brackets = 8;
            }
            else
            {
                brackets = 0;
            }
            return brackets;
        }

        [HttpGet("[action]/{leagueName}")]
        public IEnumerable<Player> SelectLeague(string leagueName)
        {
            List<Player> players = new List<Player>();
            var context = new DataContext();
            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            var leagueLinks = context.PlayersLeagues.Where(x => x.LeagueID == league.ID).ToList();

            foreach (var leagueLink in leagueLinks)
            {
                var singlePlayer = context.Players.Where(x => x.Id == leagueLink.PlayerID).FirstOrDefault();

                players.Add(singlePlayer); 
            }
           players = players.OrderBy(x => x.LastName).ToList();
            return players;
        }

        [HttpPost("[action]/{leagueName}")]
        public Player AddPlayer([FromBody] Player player, string leagueName)
        {
            var context = new DataContext();
            var playerExists = context.Players.Where(x => x.FirstName == player.FirstName && x.LastName == player.LastName).FirstOrDefault();

            if (playerExists != null)
            {
                var existingLeague = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
                var linkExists = context.PlayersLeagues.Where(x => x.LeagueID == existingLeague.ID && x.PlayerID == playerExists.Id).FirstOrDefault();
                if (linkExists != null)
                {
                    return playerExists;
                }
                else
                {
                    var addNewLink = new PlayersLeague()
                    {
                        PlayerID = playerExists.Id,
                        LeagueID = existingLeague.ID
                        
                    };

                    context.PlayersLeagues.Add(addNewLink);
                    context.SaveChanges();

                    return playerExists;
                }
            }

            var newPlayer = new Player()
            {
                FirstName = player.FirstName,
                LastName = player.LastName,
                IsMale = player.IsMale,
                Gender = player.Gender
            };
            context.Players.Add(newPlayer);
            context.SaveChanges();

            var addedPlayer = context.Players.Where(x => x.FirstName == player.FirstName && x.LastName == player.LastName).FirstOrDefault();
            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            var addedPlayersLeagues = new PlayersLeague()
            {
                LeagueID = league.ID,
                PlayerID = addedPlayer.Id
            };

            context.PlayersLeagues.Add(addedPlayersLeagues);
 
            context.SaveChanges();

            return player;

        }
       
    }
}

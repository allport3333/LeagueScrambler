using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Controllers
{
    [Route("api/[controller]")]
    public class SampleDataController : Controller
    {
        [HttpGet("[action]")]
        public Password GetPassword()
        {
            Password password = new Password();
            var context = new DataContext();
            password = context.Passwords.FirstOrDefault();


            return password;
        }

        [HttpGet("[action]")]
        public IEnumerable<Player> GetPlayers()
        {
            List<Player> players = new List<Player>();
            var context = new DataContext();
            players = context.Players
                .OrderBy(x => x.FirstName == "Open" ? 1 : 0) // Order "Open" to the end
                .ThenBy(x => x.FirstName)
                .ToList();

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
            players = context.Players
                .Where(x => x.IsMale)
                .OrderBy(x => x.FirstName == "Open" ? 1 : 0) // Order "Open" to the end
                .ThenBy(x => x.FirstName)
                .ToList();


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
            players = context.Players
                .Where(x => !x.IsMale)
                .OrderBy(x => x.FirstName == "Open" ? 1 : 0) // Order "Open" to the end
                .ThenBy(x => x.FirstName)
                .ToList();


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
                singlePlayer.IsSub = leagueLink.IsSub;
                players.Add(singlePlayer);
            }
            players = players
                .OrderBy(x => x.FirstName == "Open" ? 1 : 0) // Order "Open" to the end
                .ThenBy(x => x.FirstName)
                .ToList();

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
                        LeagueID = existingLeague.ID,
                        IsSub = player.IsSub

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
                PlayerID = addedPlayer.Id,
                IsSub = player.IsSub
            };

            context.PlayersLeagues.Add(addedPlayersLeagues);

            context.SaveChanges();

            return player;

        }

        [HttpPost("[action]/{leagueName}")]
        public List<KingQueenTeamWithPlayers> SaveKingQueenTeams([FromBody] List<KingQueenTeamWithPlayers> teams, string leagueName)
        {
            var context = new DataContext();
            var existingLeague = context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);

            if (existingLeague == null)
            {
                // Handle the case where the league doesn't exist
                // You might want to return an error response or handle it as needed.
                return null;
            }

            var currentDate = DateTime.Now;
            var leagueId = existingLeague.ID;

            var results = new List<KingQueenTeamWithPlayers>();

            // Find the last scramble number from the database for each team
            var lastScrambleNumber = context.KingQueenTeam
                .Where(kt => kt.LeagueID == existingLeague.ID)
                .Select(kt => kt.ScrambleNumber)
                .DefaultIfEmpty(0)
                .Max();

            foreach (var team in teams)
            {


                // Increment the last scramble number by one to get the new scramble number
                var newScrambleNumber = lastScrambleNumber + 1;

                var newKingQueenTeam = new KingQueenTeam()
                {
                    LeagueID = existingLeague.ID,
                    DateOfTeam = DateTime.Now,
                    ScrambleNumber = newScrambleNumber // Assign the new scramble number
                };

                context.KingQueenTeam.Add(newKingQueenTeam);
                context.SaveChanges();

                var teamPlayers = new List<KingQueenPlayer>();

                foreach (var player in team.Players)
                {
                    // Retrieve the associated Player entity
                    var playerEntity = context.Players.FirstOrDefault(p => p.Id == player.Id);

                    if (playerEntity != null)
                    {
                        var newKingQueenPlayer = new KingQueenPlayer()
                        {
                            KingQueenTeamId = newKingQueenTeam.Id,
                            PlayerId = playerEntity.Id
                        };

                        context.KingQueenPlayer.Add(newKingQueenPlayer);
                        context.SaveChanges();

                        teamPlayers.Add(newKingQueenPlayer);
                    }
                }

                // Retrieve the associated KingQueenTeam entity
                var kingQueenTeam = context.KingQueenTeam
                    .Where(t =>
                        t.DateOfTeam.Date == currentDate.Date &&
                        t.LeagueID == leagueId &&
                        t.ScrambleNumber == newScrambleNumber && // Check the scramble number
                        t.KingQueenPlayers.Any(kqp => teamPlayers.Any(tp => kqp.PlayerId == tp.PlayerId)))
                    .FirstOrDefault();

                var result = new KingQueenTeamWithPlayers
                {
                    KingQueenTeam = kingQueenTeam,
                    Players = team.Players
                };

                results.Add(result);
            }

            return results;
        }


        [HttpGet("[action]/{leagueName}/{scrambleNumber}")]
        public List<KingQueenTeamWithPlayers> GetKingQueenTeamsByScrambleNumber(string leagueName, int scrambleNumber)
        {
            var context = new DataContext();
            var existingLeague = context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);

            if (existingLeague == null)
            {
                // Handle the case where the league doesn't exist
                // You might want to return an error response or handle it as needed.
                return null;
            }

            var currentDate = DateTime.Now;
            var leagueId = existingLeague.ID;

            var results = new List<KingQueenTeamWithPlayers>();

            // Retrieve KingQueenTeams based on the provided ScrambleNumber
            var kingQueenTeams = context.KingQueenTeam
                .Where(t =>
                    t.LeagueID == leagueId &&
                    t.ScrambleNumber == scrambleNumber)
                .ToList();

            foreach (var kingQueenTeam in kingQueenTeams)
            {
                // Retrieve the associated KingQueenPlayers for each team
                var teamPlayers = context.KingQueenPlayer
                    .Where(kqp => kqp.KingQueenTeamId == kingQueenTeam.Id)
                    .Select(kqp => new Player
                    {
                // Map KingQueenPlayer properties to Player properties
                // Example: (adjust property names as needed)
                Id = kqp.Player.Id,
                        FirstName = kqp.Player.FirstName,
                        LastName = kqp.Player.LastName,
                        IsMale = kqp.Player.IsMale,
                // Map other properties
            })
                    .ToList();

                var result = new KingQueenTeamWithPlayers
                {
                    KingQueenTeam = kingQueenTeam,
                    Players = teamPlayers
                };

                results.Add(result);
            }

            return results;
        }




        [HttpPost("[action]/{leagueName}")]
        public Player DeletePlayer([FromBody] Player player, string leagueName)
        {
            var context = new DataContext();
            var playerExists = context.Players.Where(x => x.FirstName == player.FirstName && x.LastName == player.LastName).FirstOrDefault();

            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            var playerLeaguesExist = context.PlayersLeagues.Where(x => x.LeagueID == league.ID && x.PlayerID == playerExists.Id).FirstOrDefault();

            context.PlayersLeagues.Remove(playerLeaguesExist);

            context.SaveChanges();

            return player;

        }

        [HttpPost("[action]/{leagueName}")]
        public LeagueType AddNewLeague(string leagueName)
        {
            var context = new DataContext();
            var newLeague = new LeagueType();
            var leagueExists = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();

            if (leagueExists == null)
            {
                newLeague = new LeagueType()
                {
                    LeagueName = leagueName
                };


                context.Leagues.Add(newLeague);
                context.SaveChanges();

                return newLeague;

            }
            else
            {
                return newLeague;
            }




        }

    }
}

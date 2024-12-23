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
    public class ScrambleDataController : Controller
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

        [HttpGet("[action]/{leagueName}")]
        public IEnumerable<KingQueenTeam> SelectedLeagueScrambles(string leagueName)
        {
            List<KingQueenTeam> players = new List<KingQueenTeam>();
            var context = new DataContext();
            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            var kingQueenTeamsDistinct = context.KingQueenTeam
                .Where(x => x.LeagueID == league.ID)
                .GroupBy(x => x.ScrambleNumber)
                .Select(g => g.First())
                .ToList();

            return kingQueenTeamsDistinct;
        }

        [HttpGet("SearchPlayers")]
        public IActionResult SearchPlayers(string searchTerm)
        {
            var context = new DataContext();
            var players = context.Players
                .Where(p => p.FirstName.Contains(searchTerm) || p.LastName.Contains(searchTerm))
                .Select(p => new { p.Id, p.FirstName, p.LastName })
                .ToList();

            return Ok(players);
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

        [HttpPost("SaveKingQueenRoundScores/{leagueName}")]
        public async Task<IActionResult> SaveKingQueenRoundScores(
        [FromRoute] string leagueName,
        [FromBody] KingQueenRoundScoresRequest request)
        {
            var context = new DataContext();
            if (request == null || request.RoundScores == null || !request.RoundScores.Any())
            {
                return BadRequest("Invalid round scores data.");
            }

            try
            {
                foreach (var score in request.RoundScores)
                {
                    // Check if the score exists and update it, otherwise add a new entry
                    var existingScore = await context.KingQueenRoundScores
                        .FirstOrDefaultAsync(s => s.Id == score.Id);

                    if (existingScore != null)
                    {
                        existingScore.RoundScore = score.RoundScore;
                        existingScore.RoundWon = score.RoundWon;
                        existingScore.RoundId = score.RoundId;
                    }
                    else
                    {
                        var newScore = new KingQueenRoundScores
                        {
                            KingQueenTeamId = score.KingQueenTeamId,
                            RoundScore = score.RoundScore,
                            RoundWon = score.RoundWon,
                            RoundId = score.RoundId
                        };
                        context.KingQueenRoundScores.Add(newScore);
                    }
                }

                await context.SaveChangesAsync();

                return Ok(new KingQueenRoundScoresResponse
                {
                    Success = true,
                    Message = "Round scores saved successfully.",
                    SavedScores = request.RoundScores
                });
            }
            catch (Exception ex)
            {
                // Handle and log exception
                return StatusCode(500, new { Success = false, Message = $"An error occurred: {ex.Message}" });
            }
        }

        [HttpPost("[action]")]
        public async Task<IActionResult> UpdateKingQueenPlayerSubStatus([FromBody] UpdateSubStatusDto dto)
        {
            var context = new DataContext();
            if (dto == null)
            {
                return BadRequest("Invalid data");
            }

            var kingQueenPlayer = await context.KingQueenPlayer
                .FirstOrDefaultAsync(p => p.KingQueenTeamId == dto.KingQueenTeamId && p.PlayerId == dto.PlayerId);

            if (kingQueenPlayer == null)
            {
                return NotFound("KingQueenPlayer not found");
            }

            kingQueenPlayer.isSubScore = dto.IsSubScore;

            try
            {
                await context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return StatusCode(500, "Error updating sub status");
            }

            return NoContent();
        }

        [HttpGet("{teamId}/player/{playerId}")]
        public IActionResult GetKingQueenTeamDetails(int teamId, int playerId)
        {
            var context = new DataContext();
            // Fetch the KingQueenTeam and include its players
            var team = context.KingQueenTeam
                .Include(t => t.KingQueenPlayers) // Ensure players are included in the result
                .FirstOrDefault(t => t.Id == teamId);

            if (team == null)
            {
                return NotFound(); // Return 404 if the team does not exist
            }

            // Ensure the requested player is part of the team
            var player = team.KingQueenPlayers.FirstOrDefault(p => p.PlayerId == playerId);
            if (player == null)
            {
                return NotFound($"Player with ID {playerId} is not part of Team {teamId}");
            }

            return Ok(team); // Return the team details
        }


        [HttpPost("[action]/{leagueName}")]
        public KingQueenTeamsResponse SaveKingQueenTeams([FromBody] KingQueenTeamsResponse request, string leagueName)
        {
            var context = new DataContext();
            var existingLeague = context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);

            if (existingLeague == null)
            {
                return null; // Return null if league doesn't exist
            }

            var currentDate = DateTime.Now;
            var leagueId = existingLeague.ID;

            var results = new List<KingQueenTeamWithPlayers>();
            var scrambleNumber = context.KingQueenTeam
                .Where(kt => kt.LeagueID == leagueId)
                .Select(kt => kt.ScrambleNumber)
                .DefaultIfEmpty(0)
                .Max() + 1;

            var savedByePlayers = new List<Player>();

            // Process and save KingQueenTeams
            foreach (var team in request.KingQueenTeams)
            {
                var newTeam = new KingQueenTeam
                {
                    LeagueID = leagueId,
                    DateOfTeam = currentDate,
                    ScrambleNumber = scrambleNumber,
                    KingQueenPlayers = new List<KingQueenPlayer>() // Ensure it is not null
                };

                context.KingQueenTeam.Add(newTeam);
                context.SaveChanges();

                foreach (var player in team.Players)
                {
                    var newKingQueenPlayer = new KingQueenPlayer
                    {
                        KingQueenTeamId = newTeam.Id,
                        PlayerId = player.Id,
                        isSubScore = newTeam.KingQueenPlayers?.Where(x => x.PlayerId == player.Id)
                      .FirstOrDefault()?.isSubScore ?? false
                };
                    context.KingQueenPlayer.Add(newKingQueenPlayer);
                }
                context.SaveChanges();

                results.Add(new KingQueenTeamWithPlayers
                {
                    KingQueenTeam = newTeam,
                    Players = team.Players
                });
            }

            var newByeRound = new ByeRounds
            {
                LeagueID = leagueId,
                DateOfRound = DateTime.Now,
                ScrambleNumber = scrambleNumber
            };
            context.ByeRounds.Add(newByeRound);
            context.SaveChanges(); // Save the ByeRound to generate its Id

            // Process and save ByePlayers
            foreach (var player in request.ByePlayers)
            {
                var newByePlayer = new ByePlayer
                {
                    ByeRoundId = newByeRound.Id,
                    PlayerId = player.Id
                };
                context.ByePlayer.Add(newByePlayer);
                context.SaveChanges();

                savedByePlayers.Add(player);
            }

            // Return the combined response
            return new KingQueenTeamsResponse
            {
                KingQueenTeams = results,
                ByePlayers = savedByePlayers
            };
        }




        [HttpGet("[action]/{leagueName}/{scrambleNumber}")]
        public KingQueenTeamsResponse GetKingQueenTeamsByScrambleNumber(string leagueName, int scrambleNumber)
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
                        Id = kqp.Player.Id,
                        FirstName = kqp.Player.FirstName,
                        LastName = kqp.Player.LastName,
                        IsMale = kqp.Player.IsMale
                    })
                    .ToList();

                var kingQueenRoundScores = context.KingQueenRoundScores
                    .Where(kqrs => kqrs.KingQueenTeamId == kingQueenTeam.Id)
                    .ToList();

                if (kingQueenTeam.KingQueenRoundScores == null)
                {
                    kingQueenTeam.KingQueenRoundScores = new List<KingQueenRoundScores>();
                }

                var result = new KingQueenTeamWithPlayers
                {
                    KingQueenTeam = kingQueenTeam,
                    Players = teamPlayers
                };

                results.Add(result);
            }

            var byeRound = context.ByeRounds
                .Where(t =>
                    t.LeagueID == leagueId &&
                    t.ScrambleNumber == scrambleNumber)
                .FirstOrDefault();


            var byePlayers = new List<Player>();

            if (byeRound != null)
            {
                // Retrieve the ByePlayers associated with the ByeRound
                byePlayers = context.ByePlayer
                    .Where(bp => bp.ByeRoundId == byeRound.Id)
                    .Select(bp => context.Players.FirstOrDefault(p => p.Id == bp.PlayerId))
                    .Where(p => p != null) // Filter out null players, just in case
                    .ToList();
            }

            return new KingQueenTeamsResponse
            {
                KingQueenTeams = results,
                ByePlayers = byePlayers
            };
        }

        [HttpGet("GetByLeague/{leagueName}")]
        public async Task<IActionResult> GetStandingsByLeague(string leagueName)
        {
            var context = new DataContext();

            // Step 1: Get the LeagueID for the given leagueName
            var leagueId = await context.Leagues
                .Where(league => league.LeagueName == leagueName)
                .Select(league => league.ID)
                .FirstOrDefaultAsync();

            if (leagueId == 0)
            {
                return BadRequest(new { message = "League not found." });
            }

            // Step 2: Retrieve KingQueenTeams for the league
            var kingQueenTeams = await context.KingQueenTeam
                .Where(team => team.LeagueID == leagueId)
                .Include(team => team.KingQueenRoundScores) // Include round scores to validate rounds
                .Include(team => team.KingQueenPlayers)
                .ThenInclude(player => player.Player)
                .ToListAsync();

            if (!kingQueenTeams.Any())
            {
                return Ok(new { message = "No teams found in the league." });
            }

            // Step 3: Identify unique rounds using ScrambleNumber and RoundId
            var validRounds = kingQueenTeams
                .SelectMany(team => team.KingQueenRoundScores.Select(score => new
                {
                    ScrambleNumber = team.ScrambleNumber, // ScrambleNumber from KingQueenTeam
                    RoundId = score.RoundId,// RoundId from KingQueenRoundScores
                }))
                .Distinct() // Ensure unique ScrambleNumber + RoundId combinations
                .OrderBy(round => round.ScrambleNumber)
                .ThenBy(round => round.RoundId)
                .ToList();

            if (!validRounds.Any())
            {
                return Ok(new { message = "No valid rounds found in the league." });
            }

            // Step 4: Build player scores based on valid rounds
            var playerScores = kingQueenTeams
            .SelectMany(team => team.KingQueenPlayers, (team, player) => new
            {
                PlayerId = player.PlayerId,
                PlayerName = player.Player.FirstName + " " + player.Player.LastName,
                IsMale = player.Player.IsMale,
                Scores = team.KingQueenRoundScores.Select(score => new
                {
                    RoundId = score.RoundId,
                    Score = score.RoundScore,
                    ScrambleNumber = team.ScrambleNumber,
                    RoundWon = (bool)score.RoundWon ? 1 : 0,
                    IsSubScore = player.isSubScore // Assign IsSubScore here per score
                }).ToList()
            })
            .GroupBy(playerData => new { playerData.PlayerId, playerData.PlayerName, playerData.IsMale })
            .Select(group => new
            {
                PlayerId = group.Key.PlayerId,
                PlayerName = group.Key.PlayerName,
                IsMale = group.Key.IsMale,
                Scores = validRounds.Select(round => new
                {
                    RoundId = round.RoundId,
                    ScrambleNumber = round.ScrambleNumber,
                    IsSubScore = group
                        .SelectMany(player => player.Scores)
                        .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId)?.IsSubScore ?? false, // Use per-score IsSubScore
                    Score = group.SelectMany(player => player.Scores)
                                 .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId)?.Score ?? 0, // Assign 0 for missing scores
                    RoundWon = group.SelectMany(player => player.Scores)
                                    .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId)?.RoundWon ?? 0 // Assign 0 if missing
                })
                .OrderBy(score => score.ScrambleNumber)
                .ThenBy(score => score.RoundId)
                .ToList()
            })
            .ToList();

            // Step 5: Calculate the total number of unique rounds
            var maxRounds = validRounds.Count;

            // Step 6: Return the result
            return Ok(new { playerScores, maxRounds });

        }

        [HttpGet("GetByLeagueMatchup/{leagueName}")]
        public async Task<IActionResult> GetStandingsByLeagueMatchup(string leagueName)
        {
            var context = new DataContext();

            // Step 1: Get the LeagueID for the given leagueName
            var leagueId = await context.Leagues
                .Where(league => league.LeagueName == leagueName)
                .Select(league => league.ID)
                .FirstOrDefaultAsync();

            if (leagueId == 0)
            {
                return BadRequest(new { message = "League not found." });
            }

            // Step 2: Retrieve KingQueenTeams for the league
            var kingQueenTeams = await context.KingQueenTeam
                .Where(team => team.LeagueID == leagueId)
                .Include(team => team.KingQueenRoundScores) // Include round scores
                .Include(team => team.KingQueenPlayers)
                .ThenInclude(player => player.Player)
                .ToListAsync();

            if (!kingQueenTeams.Any())
            {
                return Ok(new { message = "No teams found in the league." });
            }

            // Step 3: Identify unique rounds using ScrambleNumber and RoundId
            var validRounds = kingQueenTeams
                .SelectMany(team => team.KingQueenRoundScores.Select(score => new
                {
                    ScrambleNumber = team.ScrambleNumber,
                    RoundId = score.RoundId
                }))
                .Distinct()
                .OrderBy(round => round.ScrambleNumber)
                .ThenBy(round => round.RoundId)
                .ToList();

            if (!validRounds.Any())
            {
                return Ok(new { message = "No valid rounds found in the league." });
            }

            // Step 4: Build player scores aggregated by scramble
            var unfilteredPlayerScores = kingQueenTeams
                .SelectMany(team => team.KingQueenPlayers, (team, player) => new
                {
                    PlayerId = player.PlayerId,
                    PlayerName = player.Player.FirstName + " " + player.Player.LastName,
                    IsMale = player.Player.IsMale,
                    Scores = team.KingQueenRoundScores
                        .GroupBy(score => team.ScrambleNumber)
                        .Select(scrambleGroup => new
                        {
                            roundId = scrambleGroup.FirstOrDefault().RoundId,
                            ScrambleNumber = scrambleGroup.Key,
                            Score = scrambleGroup.Sum(roundScore => roundScore.RoundScore),
                            RoundWon = scrambleGroup.Count(roundScore => (bool)roundScore.RoundWon),
                            IsSubScore = player.isSubScore // Include IsSubScore
                        })
                        .OrderBy(scramble => scramble.ScrambleNumber)
                        .ToList()
                })
                .GroupBy(playerData => new { playerData.PlayerId, playerData.PlayerName, playerData.IsMale })
                .Select(group => new
                {
                    PlayerId = group.Key.PlayerId,
                    PlayerName = group.Key.PlayerName,
                    IsMale = group.Key.IsMale,
                    Scores = group.SelectMany(player => player.Scores).ToList()
                })
                .ToList();

            // Step 5: Get all unique ScrambleNumbers across all teams and assign sequential RoundIds
            var allScrambleNumbers = kingQueenTeams
                .Where(team => team.KingQueenRoundScores.Any())
                .Select(team => team.ScrambleNumber)
                .Distinct()
                .OrderBy(scramble => scramble)
                .ToList();

            var scrambleWithRoundIds = allScrambleNumbers
                .Select((scrambleNumber, index) => new
                {
                    ScrambleNumber = scrambleNumber,
                    RoundId = index + 1
                })
                .ToList();

            try
            {


            // Step 6: Normalize each player's scores
            var playerScores = unfilteredPlayerScores.Select(player =>
            {
                var summedScoresByScramble = player.Scores
                    .GroupBy(score => score.ScrambleNumber)
                    .ToDictionary(
                        group => group.Key,
                        group => new
                        {
                            ScrambleNumber = group.Key,
                            Score = group.Sum(s => s.Score),
                            RoundWon = group.Sum(s => s.RoundWon),
                            IsSubScore = group.Any(s => s.IsSubScore ?? false)
                        }
                    );

                var normalizedScores = scrambleWithRoundIds
                    .Select(scramble =>
                    {
                        if (summedScoresByScramble.TryGetValue(scramble.ScrambleNumber, out var existingScore))
                        {
                            return new
                            {
                                ScrambleNumber = scramble.ScrambleNumber,
                                RoundId = scramble.RoundId,
                                Score = existingScore.Score,
                                RoundWon = existingScore.RoundWon,
                                IsSubScore = existingScore.IsSubScore
                            };
                        }
                        else
                        {
                            return new
                            {
                                ScrambleNumber = scramble.ScrambleNumber,
                                RoundId = scramble.RoundId,
                                Score = 0,
                                RoundWon = 0,
                                IsSubScore = false
                            };
                        }
                    })
                    .OrderBy(score => score.ScrambleNumber)
                    .ToList();

                return new
                {
                    PlayerId = player.PlayerId,
                    PlayerName = player.PlayerName,
                    IsMale = player.IsMale,
                    Scores = normalizedScores
                };
            }).ToList();

                return Ok(new { playerScores, maxRounds = validRounds.Select(round => round.ScrambleNumber).Distinct().Count() });
            }
            catch (Exception ex)
            {

                throw;
            }
        }



        [HttpPost("[action]/{leagueName}")]
        public KingQueenTeamsResponse GetKingQueenTeamsByScrambleNumbers(string leagueName, [FromBody] List<int> scrambleNumbers)
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

            // Retrieve KingQueenTeams based on the provided ScrambleNumbers
            var kingQueenTeams = context.KingQueenTeam
                .Where(t =>
                    t.LeagueID == leagueId &&
                    scrambleNumbers.Contains(t.ScrambleNumber))
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


            var byeRounds = context.ByeRounds
                .Where(t =>
                    t.LeagueID == leagueId &&
                    scrambleNumbers.Contains(t.ScrambleNumber))
                .ToList();

            var byePlayers = new List<Player>();

            if (byeRounds != null && byeRounds.Any())
            {
                // Retrieve all ByePlayers associated with the ByeRounds
                var byePlayerIds = context.ByePlayer
                    .Where(bp => byeRounds.Select(br => br.Id).Contains(bp.ByeRoundId))
                    .Select(bp => bp.PlayerId)
                    .ToList();

                // Map the ByePlayers to their corresponding Player entries
                byePlayers = context.Players
                    .Where(p => byePlayerIds.Contains(p.Id))
                    .ToList();
            }

            return new KingQueenTeamsResponse
            {
                KingQueenTeams = results,
                ByePlayers = byePlayers
            };

        }

        [HttpGet("SearchPlayersInLeague")]
        public IActionResult SearchPlayersInLeague(string searchTerm, string leagueName)
        {
            var context = new DataContext();
            var league = context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);

            if (league == null)
                return NotFound("League not found.");

            var playersInLeague = context.PlayersLeagues
                .Where(pl => pl.LeagueID == league.ID)
                .Select(pl => pl.Player)
                .Where(p => p.FirstName.Contains(searchTerm) || p.LastName.Contains(searchTerm))
                .Select(p => new { p.Id, p.FirstName, p.LastName })
                .ToList();

            return Ok(playersInLeague);
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
            var newUserLeague = new UserLeague();
            var leagueExists = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();

            var username = User.Identity.Name; // Assuming the username is in the claim


            if (leagueExists == null)
            {
                newLeague = new LeagueType()
                {
                    LeagueName = leagueName
                };


                context.Leagues.Add(newLeague);
                context.SaveChanges();



                if (username != null)
                {
                    var newRetrievedLeague = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
                    var retrievedUser = context.Users.Where(x => x.LoginName == username).FirstOrDefault();
                    newUserLeague = new UserLeague()
                    {
                        LeagueTypeId = newRetrievedLeague.ID,
                        UserId = retrievedUser.UserId

                    };
                    context.UserLeagues.Add(newUserLeague);
                    context.SaveChanges();
                }

                return newLeague;

            }
            else
            {
                if (username != null)
                {
                    var newRetrievedLeague = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
                    var retrievedUser = context.Users.Where(x => x.LoginName == username).FirstOrDefault();
                    newUserLeague = new UserLeague()
                    {
                        LeagueTypeId = newRetrievedLeague.ID,
                        UserId = retrievedUser.UserId

                    };
                    context.UserLeagues.Add(newUserLeague);
                    context.SaveChanges();
                }
                return newLeague;
            }




        }

    }
}

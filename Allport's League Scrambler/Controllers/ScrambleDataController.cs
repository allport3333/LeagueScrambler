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

        [HttpPost("claimPlayer")]
        public IActionResult ClaimPlayer([FromBody] ClaimPlayerRequest request)
        {
            var context = new DataContext();
            var userPlayer = new UsersPlayer
            {
                UserId = request.UserId,
                PlayerId = request.PlayerId
            };

            context.UsersPlayer.Add(userPlayer);
            context.SaveChanges();

            return Ok(new { message = "Player claimed successfully" });
        }

        [HttpGet("GetPlayerByFirstLastName")]
        public IActionResult GetPlayerByFirstLastName(string firstName, string lastName)
        {
            var context = new DataContext();

            // Search by first name and last name
            var players = context.Players
                .Where(p => p.FirstName == firstName && p.LastName == lastName)
                .ToList();

            // If no players found, search by last name only
            if (!players.Any())
            {
                players = context.Players
                    .Where(p => p.LastName == lastName)
                    .ToList();

                if (!players.Any())
                {
                    return NotFound("No players found with the given name or last name.");
                }
            }

            return Ok(players);
        }



        public class ClaimPlayerRequest
        {
            public int UserId { get; set; }
            public int PlayerId { get; set; }
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
                .Where(x => x.LeagueID == league.ID && x.ScrambleWithScoresToBeSaved == true)
                .GroupBy(x => x.ScrambleNumber)
                .Select(g => g.First())
                .ToList();

            return kingQueenTeamsDistinct;
        }

        [HttpGet("SearchPlayers")]
        public IActionResult SearchPlayers(string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return BadRequest("Search term cannot be empty.");

            var context = new DataContext();
            var searchTerms = searchTerm.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            var players = context.Players
                .Where(p =>
                    // If there's only one search term, match against either FirstName or LastName
                    (searchTerms.Length == 1 &&
                        (p.FirstName.StartsWith(searchTerms[0], StringComparison.OrdinalIgnoreCase) ||
                         p.LastName.StartsWith(searchTerms[0], StringComparison.OrdinalIgnoreCase))) ||
                    // If there are multiple search terms, match them in sequence
                    (searchTerms.Length == 2 &&
                        p.FirstName.StartsWith(searchTerms[0], StringComparison.OrdinalIgnoreCase) &&
                        p.LastName.StartsWith(searchTerms[1], StringComparison.OrdinalIgnoreCase)))
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

        [HttpPost("[action]")]
        public IActionResult AddPlayerWithoutLeague([FromBody] Player player)
        {
            var context = new DataContext();

            // Check if the player already exists
            var playerExists = context.Players
                .FirstOrDefault(x => x.FirstName == player.FirstName && x.LastName == player.LastName);

            if (playerExists != null)
            {
                // Return existing player if found
                return Ok(playerExists);
            }

            // Create a new player
            var newPlayer = new Player
            {
                FirstName = player.FirstName,
                LastName = player.LastName,
                IsMale = player.IsMale,
                Gender = player.Gender,
                IsSub = player.IsSub
            };

            context.Players.Add(newPlayer);
            context.SaveChanges();

            // Return the newly created player
            return Ok(newPlayer);
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
            var team = context.KingQueenTeam.Where(x => x.ScrambleWithScoresToBeSaved == true)
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

        [HttpPost("GenerateScramble/{leagueName}")]
        public IActionResult GenerateScramble([FromBody] KingQueenTeamsResponse request, string leagueName)
        {
            using (var context = new DataContext())
            {
                // 1) Check that the league exists
                var existingLeague = context.Leagues
                    .FirstOrDefault(x => x.LeagueName == leagueName);

                if (existingLeague == null)
                {
                    return NotFound("League does not exist.");
                }

                var leagueId = existingLeague.ID;

                // 2) Determine next ScrambleNumber (if that's how you want to group these new teams)
                var scrambleNumber = context.KingQueenTeam
                    .Where(kt => kt.LeagueID == leagueId)
                    .Select(kt => kt.ScrambleNumber)
                    .DefaultIfEmpty(0)
                    .Max() + 1;

                // 3) Prepare a list to hold the newly created teams
                var createdTeams = new List<KingQueenTeam>();

                // 4) Loop through each KingQueenTeamWithPlayers in the request
                foreach (var teamWithPlayers in request.KingQueenTeams)
                {
                    // Create a new KingQueenTeam record (one per item in KingQueenTeams)
                    var newTeam = new KingQueenTeam
                    {
                        LeagueID = leagueId,
                        DateOfTeam = DateTime.Now,
                        ScrambleNumber = scrambleNumber,
                        ScrambleWithScoresToBeSaved = false
                    };

                    // Add and save the team so we can get its ID
                    context.KingQueenTeam.Add(newTeam);
                    context.SaveChanges();

                    // Keep track of all created teams
                    createdTeams.Add(newTeam);
                }
                return Ok(createdTeams);
            }
        }




        [HttpPost("[action]/{leagueName}")]
        public KingQueenTeamsResponse SaveKingQueenTeams([FromBody] KingQueenTeamsResponse request, string leagueName)
        {
            using (var context = new DataContext())
            {
                var existingLeague = context.Leagues
                    .FirstOrDefault(x => x.LeagueName == leagueName);
                if (existingLeague == null)
                {
                    return null;
                }

                var leagueId = existingLeague.ID;

                // 1) Find the highest ScrambleNumber for unscrambled teams:
                var latestScrambleNumber = context.KingQueenTeam
                    .Where(kt => kt.LeagueID == leagueId && kt.ScrambleWithScoresToBeSaved == false)
                    .Select(kt => kt.ScrambleNumber)
                    .DefaultIfEmpty(0)
                    .Max();

                // If 0, it means none exist, or everything is already true
                if (latestScrambleNumber == 0)
                {
                    return null; // or handle "nothing to finalize"
                }

                // 2) Get all teams for that scramble number
                var teamsToFinalize = context.KingQueenTeam
                    .Where(kt => kt.LeagueID == leagueId
                              && kt.ScrambleWithScoresToBeSaved == false
                              && kt.ScrambleNumber == latestScrambleNumber)
                    .OrderBy(kt => kt.Id) // or some order
                    .ToList();

                if (teamsToFinalize.Count == 0)
                {
                    return null;
                }

                // 3) Mark them as finalized
                foreach (var team in teamsToFinalize)
                {
                    team.ScrambleWithScoresToBeSaved = true;
                }
                context.SaveChanges();

                // 4) If request.KingQueenTeams has the same count, 
                //    attach the players in the same index order:
                var results = new List<KingQueenTeamWithPlayers>();
                for (int i = 0; i < teamsToFinalize.Count && i < request.KingQueenTeams.Count; i++)
                {
                    var dbTeam = teamsToFinalize[i];
                    var reqTeam = request.KingQueenTeams[i];

                    // Insert KingQueenPlayers for each player in reqTeam
                    foreach (var player in reqTeam.Players)
                    {
                        var newKingQueenPlayer = new KingQueenPlayer
                        {
                            KingQueenTeamId = dbTeam.Id,
                            PlayerId = player.Id,
                            isSubScore = false  // or set properly
                        };
                        context.KingQueenPlayer.Add(newKingQueenPlayer);
                    }
                    context.SaveChanges();

                    // Build the result item
                    results.Add(new KingQueenTeamWithPlayers
                    {
                        KingQueenTeam = dbTeam,
                        Players = reqTeam.Players
                    });
                }

                // 5) Create a new ByeRounds record
                var newByeRound = new ByeRounds
                {
                    LeagueID = leagueId,
                    DateOfRound = DateTime.Now,
                    ScrambleNumber = latestScrambleNumber
                };
                context.ByeRounds.Add(newByeRound);
                context.SaveChanges();

                // 6) Insert all ByePlayers
                var savedByePlayers = new List<Player>();
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

                // 7) Return
                return new KingQueenTeamsResponse
                {
                    KingQueenTeams = results,
                    ByePlayers = savedByePlayers
                };
            }
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
                .Include(t => t.KingQueenPlayers)
                .Where(t =>
                    t.LeagueID == leagueId &&
                    t.ScrambleNumber == scrambleNumber && t.ScrambleWithScoresToBeSaved == true)
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

        [HttpPost("SignInPlayer")]
        public async Task<IActionResult> SignInPlayer([FromBody] PlayerSignIn playerSignIn)
        {
            var context = new DataContext();
            if (playerSignIn == null)
            {
                return BadRequest("Invalid data.");
            }

            // Ensure the DateTime only includes the date
            playerSignIn.DateTime = playerSignIn.DateTime.ToLocalTime();

            // Add the player sign-in record to the database
            context.PlayerSignIn.Add(playerSignIn);
            await context.SaveChangesAsync();

            var player = await context.Players.FindAsync(playerSignIn.PlayerId);

            if (player == null)
            {
                return NotFound("Player not found.");
            }

            // Return the custom result
            var result = new PlayerSignInResult
            {
                PlayerSignInId = playerSignIn.PlayerSignInId,
                DateTime = playerSignIn.DateTime,
                LeagueId = playerSignIn.LeagueId,
                PlayerId = playerSignIn.PlayerId,
                FirstName = player.FirstName,
                LastName = player.LastName,
                Gender = player.IsMale ? "Male" : "Female"
            };

            return Ok(result);
        }

        [HttpPost("SaveCreatedTeamScores")]
        public async Task<IActionResult> SaveCreatedTeamScores([FromBody] List<TeamScoreDto> scores)
        {
            var context = new DataContext();
            if (scores == null || !scores.Any())
            {
                return BadRequest("No scores provided.");
            }

            try
            {
                List<KingQueenTeam> updatedTeams = new List<KingQueenTeam>();

                // Retrieve the latest scramble number for the league
                var leagueId = scores.First().LeagueId;
                var latestScrambleNumber = await context.KingQueenTeam
                    .Where(t => t.LeagueID == leagueId && t.ScrambleWithScoresToBeSaved == true)
                    .OrderByDescending(t => t.ScrambleNumber)
                    .Select(t => t.ScrambleNumber)
                    .FirstOrDefaultAsync();

                foreach (var teamScore in scores)
                {
                    // If scramble number is 0, assign a new scramble number
                    if (teamScore.ScrambleNumber == 0)
                    {
                        teamScore.ScrambleNumber = latestScrambleNumber + 1;
                        latestScrambleNumber = teamScore.ScrambleNumber; // Update for subsequent teams
                    }

                    // Get or create KingQueenTeam
                    var team = await context.KingQueenTeam.Where(t => t.ScrambleWithScoresToBeSaved == true)
                        .Include(t => t.KingQueenPlayers)
                        .Include(t => t.KingQueenRoundScores)
                        .FirstOrDefaultAsync(t => t.Id == teamScore.KingQueenTeamId);

                    if (team == null)
                    {
                        team = new KingQueenTeam
                        {
                            LeagueID = teamScore.LeagueId,
                            DateOfTeam = DateTime.Parse(teamScore.Date),
                            ScrambleNumber = teamScore.ScrambleNumber,
                            KingQueenPlayers = new List<KingQueenPlayer>(),
                            KingQueenRoundScores = new List<KingQueenRoundScores>(),
                            ScrambleWithScoresToBeSaved = true
                        };
                        await context.KingQueenTeam.AddAsync(team);
                    }

                    await context.SaveChangesAsync(); // Save to generate the KingQueenTeam ID

                    // Refresh the team from the database to ensure it's up-to-date
                    team = await context.KingQueenTeam.Where(t => t.ScrambleWithScoresToBeSaved == true)
                        .Include(t => t.KingQueenPlayers)
                        .Include(t => t.KingQueenRoundScores)
                        .FirstOrDefaultAsync(t => t.Id == team.Id);

                    // Add or update KingQueenPlayers
                    foreach (var player in teamScore.Players)
                    {
                        var existingPlayer = team.KingQueenPlayers.FirstOrDefault(p => p.PlayerId == player.PlayerId);
                        if (existingPlayer == null)
                        {
                            team.KingQueenPlayers.Add(new KingQueenPlayer
                            {
                                PlayerId = player.PlayerId,
                                isSubScore = player.isSubScore
                            });
                        }
                    }

                    await context.SaveChangesAsync(); // Save after updating players

                    // Refresh the team again
                    team = await context.KingQueenTeam.Where(t => t.ScrambleWithScoresToBeSaved == true)
                        .Include(t => t.KingQueenPlayers)
                        .Include(t => t.KingQueenRoundScores)
                        .FirstOrDefaultAsync(t => t.Id == team.Id);

                    // Add or update KingQueenRoundScores
                    foreach (var roundScore in teamScore.RoundScores)
                    {
                        var existingScore = team.KingQueenRoundScores.FirstOrDefault(r => r.RoundId == roundScore.RoundId);
                        if (existingScore != null)
                        {
                            existingScore.RoundScore = roundScore.RoundScore;
                            existingScore.RoundWon = roundScore.RoundWon;
                        }
                        else
                        {
                            team.KingQueenRoundScores.Add(new KingQueenRoundScores
                            {
                                RoundId = roundScore.RoundId,
                                RoundScore = roundScore.RoundScore,
                                RoundWon = roundScore.RoundWon
                            });
                        }
                    }

                    await context.SaveChangesAsync(); // Save after updating round scores

                    updatedTeams.Add(team);
                }

                // Prepare the response
                var response = updatedTeams.Select(t => new
                {
                    t.Id,
                    t.LeagueID,
                    t.DateOfTeam,
                    t.ScrambleNumber,
                    Players = t.KingQueenPlayers.Select(p => new
                    {
                        p.PlayerId,
                        p.isSubScore,
                        PlayerDetails = context.Players.FirstOrDefault(player => player.Id == p.PlayerId)
                    }).ToList(),
                    RoundScores = t.KingQueenRoundScores.Select(rs => new
                    {
                        rs.RoundId,
                        rs.RoundScore,
                        rs.RoundWon
                    }).ToList()
                });

                return Ok(new
                {
                    LatestScrambleNumber = latestScrambleNumber,
                    UpdatedTeams = response
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while saving scores: {ex.Message}");
            }
        }
        [HttpGet("GetTeamsByScrambleNumber")]
        public async Task<IActionResult> GetTeamsByScrambleNumber(int leagueId, int scrambleNumber)
        {
            var context = new DataContext();

            var teams = await context.KingQueenTeam
                .Where(t => t.LeagueID == leagueId && t.ScrambleNumber == scrambleNumber && t.ScrambleWithScoresToBeSaved == true)
                .Include(t => t.KingQueenPlayers)
                .ThenInclude(p => p.Player)
                .Select(t => new
                {
                    t.Id,
                    t.LeagueID,
                    t.ScrambleNumber,
                    Players = t.KingQueenPlayers.Select(p => new
                    {
                        Id = p.Player.Id, // Use "Id" for consistency
                        p.Player.FirstName,
                        p.Player.LastName,
                        p.Player.IsMale
                    }).ToList()
                })
                .ToListAsync();

            return Ok(teams);
        }



        [HttpGet("[action]")]
        public IActionResult GetScrambleNumbers(int leagueId)
        {
            var context = new DataContext();
            var scrambleNumbers = context.KingQueenTeam
                .Where(t => t.LeagueID == leagueId && t.ScrambleWithScoresToBeSaved == true)
                .Select(t => t.ScrambleNumber)
                .Distinct()
                .OrderBy(n => n)
                .ToList();

            return Ok(scrambleNumbers);
        }

        [HttpGet("GetTopPlayers")]
        public IActionResult GetTopPlayers(int leagueId, int? maxPlayers = null)
        {
            var _context = new DataContext();

            // Query KingQueenTopPlayer, ordered by Rank ascending
            var query = _context.KingQueenTopPlayer
                .Where(kqt => kqt.LeagueId == leagueId)
                .OrderBy(kqt => kqt.Rank);


            var topPlayers = query
                .Join(
                    _context.Players,
                    kqt => kqt.PlayerId,
                    p => p.Id,
                    (kqt, p) => new {
                        p.Id,
                        p.FirstName,
                        p.LastName,
                        p.IsMale,
                        p.Gender,
                        IsTopPlayer = true,
                        kqt.Rank
                    }
                )
                .ToList();

            return Ok(topPlayers);
        }


        [HttpGet("GetSignedInPlayersAsPlayers")]
        public async Task<IActionResult> GetSignedInPlayersAsPlayers(int leagueId, string date)
        {
            try
            {

                var context = new DataContext();

                // Attempt to parse the date string dynamically
                if (!DateTime.TryParse(date, out var inputDate))
                {
                    return BadRequest("Invalid date format. Please provide a valid date.");
                }

                // Convert to Eastern Time if needed
                var easternTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
                var easternDateTime = TimeZoneInfo.ConvertTime(inputDate, easternTimeZone);

                // Use only the date part for comparison
                var inputDateOnly = easternDateTime.Date;

                // Query the database
                var signedInPlayers = await context.PlayerSignIn
                    .Where(x => x.LeagueId == leagueId && x.DateTime.Date == inputDateOnly)
                    .ToListAsync();

                if (!signedInPlayers.Any())
            {
                return Ok(new List<Player>()); // Return empty list if no records found
            }

            // Fetch the corresponding Player objects
            var playerIds = signedInPlayers.Select(x => x.PlayerId).Distinct().ToList();
            var players = await context.Players
                .Where(p => playerIds.Contains(p.Id))
                .OrderBy(p => p.FirstName)
                .ThenBy(p => p.LastName)
                .ToListAsync();

            // Map and enrich the data for the frontend
            var playerList = players.Select(player => new Player
            {
                Id = player.Id,
                FirstName = player.FirstName,
                LastName = player.LastName,
                IsMale = player.IsMale,
                Gender = player.IsMale ? "Male" : "Female",
                IsSub = player.IsSub
            }).ToList();
                return Ok(playerList);
            }
            catch (Exception ex)
            {
                var e = ex;
                throw;
            }
        }

        [HttpGet("GetSignedInPlayers")]
        public async Task<IActionResult> GetSignedInPlayers(int leagueId, DateTime date)
        {
            var context = new DataContext();
            var signedInPlayers = await context.PlayerSignIn
                .Where(signIn => signIn.LeagueId == leagueId && signIn.DateTime.Date == date.Date)
                .Select(signIn => new PlayerSignInResult
                {
                    PlayerSignInId = signIn.PlayerSignInId,
                    DateTime = signIn.DateTime,
                    LeagueId = signIn.LeagueId,
                    PlayerId = signIn.PlayerId,
                    FirstName = signIn.Player.FirstName,
                    LastName = signIn.Player.LastName,
                    Gender = signIn.Player.Gender
                })
                .ToListAsync();

            return Ok(signedInPlayers);
        }

        [HttpDelete("SignInPlayer/{playerSignInId}")]
        public async Task<IActionResult> DeleteSignInPlayer(int playerSignInId)
        {
            var context = new DataContext();

            var signInRecord = await context.PlayerSignIn.FindAsync(playerSignInId);

            if (signInRecord == null)
            {
                return NotFound($"PlayerSignIn record with ID {playerSignInId} not found.");
            }

            context.PlayerSignIn.Remove(signInRecord);
            await context.SaveChangesAsync();

            return NoContent();
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
                .Where(team => team.LeagueID == leagueId && team.ScrambleWithScoresToBeSaved == true)
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
                .Where(team => team.LeagueID == leagueId && team.ScrambleWithScoresToBeSaved == true)
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

        [HttpGet("[action]/{leagueID}")]
        public List<Player> GetPlayers(int leagueID)
        {
            var context = new DataContext();

            // Retrieve players associated with the given league
            var players = context.PlayersLeagues
                .Where(pl => pl.LeagueID == leagueID)
                .Select(pl => pl.Player) // Get the associated Player object
                .OrderBy(x => x.FirstName == "Open" ? 1 : 0) // Order "Open" to the end
                .ThenBy(x => x.FirstName) // Then alphabetically by FirstName
                .ToList();

            // Assign gender values
            foreach (var player in players)
            {
                player.Gender = player.IsMale ? "Male" : "Female";
            }

            // Save changes if needed (e.g., if Gender is stored in the database)
            context.SaveChanges();

            return players;
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
                    scrambleNumbers.Contains(t.ScrambleNumber) && t.ScrambleWithScoresToBeSaved == true)
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

            // Split the search term into words
            var searchTerms = searchTerm.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            var playersInLeague = context.PlayersLeagues
                .Where(pl => pl.LeagueID == league.ID)
                .Select(pl => pl.Player)
                .Where(p =>
                    // If there is only one term, match either first or last name
                    (searchTerms.Length == 1 &&
                        (p.FirstName.StartsWith(searchTerms[0], StringComparison.OrdinalIgnoreCase) ||
                         p.LastName.StartsWith(searchTerms[0], StringComparison.OrdinalIgnoreCase))) ||
                    // If there are two terms, match first and last name in sequence
                    (searchTerms.Length == 2 &&
                        p.FirstName.StartsWith(searchTerms[0], StringComparison.OrdinalIgnoreCase) &&
                        p.LastName.StartsWith(searchTerms[1], StringComparison.OrdinalIgnoreCase)))
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
            var leagueExists = context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);

            var username = User.Identity.Name; // Assuming the username is in the claim

            if (leagueExists == null)
            {
                // Create new league
                newLeague = new LeagueType()
                {
                    LeagueName = leagueName
                };

                context.Leagues.Add(newLeague);
                context.SaveChanges();

                // Retrieve the newly created league ID
                var newLeagueId = newLeague.ID;

                // Insert default league settings
                var defaultSettings = new List<LeagueSettings>
                            {
                                new LeagueSettings
                                {
                                    LeagueId = newLeagueId,
                                    SettingName = "subScorePercent",
                                    SettingValue = "50"
                                },
                                new LeagueSettings
                                {
                                    LeagueId = newLeagueId,
                                    SettingName = "numberOfSubsAllowed",
                                    SettingValue = "100"
                                },
                                new LeagueSettings
                                {
                                    LeagueId = newLeagueId,
                                    SettingName = "dropLowest",
                                    SettingValue = "0"
                                },
                                new LeagueSettings
                                {
                                    LeagueId = newLeagueId,
                                    SettingName = "dayOfLeague",
                                    SettingValue = "Monday"
                                }
                            };

                context.LeagueSettings.AddRange(defaultSettings);
                context.SaveChanges();

                // Associate the user with the new league
                if (username != null)
                {
                    var retrievedUser = context.Users.FirstOrDefault(x => x.LoginName == username);
                    if (retrievedUser != null)
                    {
                        newUserLeague = new UserLeague()
                        {
                            LeagueTypeId = newLeagueId,
                            UserId = retrievedUser.UserId
                        };

                        context.UserLeagues.Add(newUserLeague);
                        context.SaveChanges();
                    }
                }

                return newLeague;
            }
            else
            {
                // League already exists, associate user with it
                if (username != null)
                {
                    var existingLeague = context.Leagues.FirstOrDefault(x => x.LeagueName == leagueName);
                    var retrievedUser = context.Users.FirstOrDefault(x => x.LoginName == username);

                    if (retrievedUser != null && existingLeague != null)
                    {
                        newUserLeague = new UserLeague()
                        {
                            LeagueTypeId = existingLeague.ID,
                            UserId = retrievedUser.UserId
                        };

                        context.UserLeagues.Add(newUserLeague);
                        context.SaveChanges();
                    }
                }

                return leagueExists;
            }
        }


    }
}

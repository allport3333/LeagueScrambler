using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Security.Claims;
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
    public class ScrambleDataController : Controller
    {
        // Legacy endpoint intentionally disabled. Passwords must never be returned to clients.
        [HttpGet("[action]")]
        public IActionResult GetPassword()
        {
            return StatusCode(410, "Legacy password retrieval has been removed. Sign in as a league manager.");
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

            // Display normalization must never persist from a public GET.
            return players;
        }

        [HttpPost("claimPlayer")]
        [SameOrigin]
        [Authorize]
        public IActionResult ClaimPlayer([FromBody] ClaimPlayerRequest request)
        {
            if (request == null || !LeagueAccess.TryGetAccountId(User, out var accountId) ||
                (request.UserId != 0 && request.UserId != accountId)) return Forbid();

            return WritePlayerAssociation(accountId, context =>
                context.Players.SingleOrDefault(player => player.Id == request.PlayerId), false);
        }

        [HttpGet("ClaimablePlayers")]
        [Authorize]
        public IActionResult ClaimablePlayers([FromQuery] string search)
        {
            if (!LeagueAccess.TryGetAccountId(User, out var accountId)) return Forbid();
            var term = search?.Trim() ?? "";
            if (term.Length > 200) return BadRequest();
            using var context = new DataContext();
            if (context.UsersPlayer.Any(link => link.UserId == accountId)) return Conflict("This account already has a player profile.");
            if (term.Length < 2) return Ok(new { players = Array.Empty<object>(), claimedProfiles = Array.Empty<object>(), claimedExactMatch = false });
            var matches = Services.ProfileSearch.Match(context, term);
            var available = Services.ProfileSearch.Results(context, matches.Where(player =>
                !context.UsersPlayer.Any(link => link.PlayerId == player.Id))).ToList();
            var exactName = System.Text.RegularExpressions.Regex.Replace(term, @"\s+", " ").ToUpperInvariant();
            var recoveryAccounts = Services.RecoveryEligibility.Accounts(context);
            var claimedProfiles = term.Contains(' ') ? Services.ProfileSearch.Results(context, matches.Where(player =>
                (player.FirstName + " " + player.LastName).ToUpper() == exactName &&
                recoveryAccounts.Any(link => link.PlayerId == player.Id))).ToArray() : Array.Empty<Services.ProfileSearch.ProfileMatch>();
            return Ok(new { players = available, claimedProfiles, claimedExactMatch = claimedProfiles.Length > 0 });
        }

        [HttpPost("CreateAndClaimPlayer")]
        [SameOrigin]
        [Authorize]
        public IActionResult CreateAndClaimPlayer([FromBody] Player input)
        {
            if (!LeagueAccess.TryGetAccountId(User, out var accountId)) return Forbid();
            var first = input?.FirstName?.Trim();
            var last = input?.LastName?.Trim();
            if (string.IsNullOrWhiteSpace(first) || string.IsNullOrWhiteSpace(last) ||
                first.Length > 100 || last.Length > 100 || input.Gender is not ("Male" or "Female"))
                return BadRequest("Enter a first name, last name and supported gender classification.");
            return WritePlayerAssociation(accountId, _ => new Player {
                FirstName = first, LastName = last, Gender = input.Gender, IsMale = input.Gender == "Male", IsSub = null
            }, true);
        }

        private IActionResult WritePlayerAssociation(int accountId, Func<DataContext, Player> resolvePlayer, bool create)
        {
            try
            {
                using var context = new DataContext();
                using var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable);
                if (context.UsersPlayer.Any(link => link.UserId == accountId)) return Conflict("This account already has a player association.");
                var player = resolvePlayer(context);
                if (player == null) return NotFound();
                if (create)
                {
                    // Distinct players can share a name. The account link is the ownership check.
                    context.Players.Add(player);
                    context.SaveChanges();
                }
                else if (context.UsersPlayer.Any(link => link.PlayerId == player.Id))
                    return Conflict("This player is already associated with an account.");

                context.UsersPlayer.Add(new UsersPlayer { UserId = accountId, PlayerId = player.Id });
                context.SaveChanges();
                transaction.Commit();
                return Ok(new { message = "Player claimed successfully", playerId = player.Id });
            }
            catch (Microsoft.Data.SqlClient.SqlException error) when (error.Number == 1205)
            {
                return Conflict("The profile association changed. Refresh the search and try again.");
            }
            catch (DbUpdateException error) when (error.InnerException is Microsoft.Data.SqlClient.SqlException sql &&
                (sql.Number == 1205 || sql.Number == 2601 || sql.Number == 2627))
            {
                return Conflict("The profile association changed. Refresh the search and try again.");
            }
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
            // Initial selection may be empty, or an old link may name a removed league.
            // Keep the existing array response contract without evaluating a null entity.
            if (string.IsNullOrWhiteSpace(leagueName))
                return new List<KingQueenTeam>();

            using (var context = new DataContext())
            {
                var leagueId = context.Leagues.AsNoTracking()
                    .Where(x => x.LeagueName == leagueName)
                    .Select(x => (int?)x.ID)
                    .FirstOrDefault();
                if (!leagueId.HasValue)
                    return new List<KingQueenTeam>();

                var selectedLeagueId = leagueId.Value;
                return context.KingQueenTeam.AsNoTracking()
                    .Where(x => x.LeagueID == selectedLeagueId && x.ScrambleWithScoresToBeSaved == true)
                    // EF 2 grouped these league-filtered rows on the client.
                    // Select one stable representative using the saved creation timestamp.
                    .ToList()
                    .GroupBy(x => x.ScrambleNumber)
                    .Select(g => g.OrderByDescending(team => team.DateOfTeam).ThenByDescending(team => team.Id).First())
                    .OrderBy(t => t.ScrambleNumber)
                    .ToList();
            }
        }

        [HttpGet("SearchPlayers")]
        public IActionResult SearchPlayers(string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return BadRequest("Search term cannot be empty.");

            using var context = new DataContext();
            var searchTerms = searchTerm.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            // EF 2 evaluated these ordinal comparisons locally. Keep their exact
            // semantics instead of substituting the database's collation rules.
            // Fetch only the public autocomplete fields, without tracked entities.
            var players = context.Players.AsNoTracking()
                .Select(p => new { p.Id, p.FirstName, p.LastName })
                .AsEnumerable()
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
        [Authorize]
        [SameOrigin]
        public IActionResult AddPlayer([FromBody] Player player, string leagueName, [FromQuery] int leagueDivisionId = 0, [FromQuery] bool existingOnly = false, [FromQuery] int expectedLeagueId = 0)
        {
            var context = new DataContext();

            if (player == null)
            {
                return NotFound();
            }

            int? divisionIdToSave = null;
            if (leagueDivisionId > 0)
            {
                divisionIdToSave = leagueDivisionId;
            }

            var existingLeague = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            if (existingLeague == null)
            {
                return NotFound();
            }

            if (!LeagueAccess.CanManage(User, context, existingLeague.ID))
                return Forbid();
            if (!User.IsInRole("Admin") && !User.IsInRole("Manager") && (!existingOnly || existingLeague.EventTypeId != 2))
                return Forbid();

            if (existingOnly && (player.Id <= 0 || leagueDivisionId < 0 || expectedLeagueId != existingLeague.ID))
                return BadRequest("Select a valid existing player and division.");

            if (divisionIdToSave.HasValue && !context.LeagueDivision.Any(d =>
                d.Id == divisionIdToSave.Value && d.LeagueID == existingLeague.ID))
            {
                return BadRequest("The selected division does not belong to this league.");
            }

            if (existingOnly)
            {
                // ID-based immediate addition never creates a profile or changes a
                // membership another administrator may already have added.
                var selected = context.Players.SingleOrDefault(p => p.Id == player.Id);
                if (selected == null) return NotFound("This player is no longer available.");
                using (var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable))
                {
                    var memberships = context.PlayersLeagues.Where(m => m.LeagueID == existingLeague.ID && m.PlayerID == selected.Id).ToDictionary(m => m.PlayerID);
                    var alreadyMember = memberships.ContainsKey(selected.Id);
                    var membership = EnsureExistingMembership(context, memberships, existingLeague.ID, selected.Id, leagueDivisionId);
                    if (!alreadyMember)
                    {
                        context.SaveChanges();
                    }
                    var divisionName = context.LeagueDivision.Where(d => d.Id == membership.LeagueDivisionId && d.LeagueID == existingLeague.ID)
                        .Select(d => string.IsNullOrEmpty(d.Name) ? d.Code : d.Name).FirstOrDefault();
                    transaction.Commit();
                    return Ok(new { player = selected, leagueId = existingLeague.ID,
                        leagueDivisionId = membership.LeagueDivisionId ?? 0, leagueDivisionName = divisionName, alreadyMember });
                }
            }

            using (var membershipTransaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable))
            {
            var playerExists = context.Players
                .Where(x => x.FirstName == player.FirstName && x.LastName == player.LastName)
                .FirstOrDefault();

            if (playerExists != null)
            {
                var linkExists = context.PlayersLeagues
                    .Where(x => x.LeagueID == existingLeague.ID && x.PlayerID == playerExists.Id)
                    .FirstOrDefault();

                if (linkExists != null)
                {
                    // If they re-add and chose a division, update it
                    if (divisionIdToSave.HasValue)
                    {
                        linkExists.LeagueDivisionId = divisionIdToSave.Value;
                    }

                    // Also allow updating IsSub
                    if (player.IsSub.HasValue)
                    {
                        linkExists.IsSub = player.IsSub;
                    }

                    context.SaveChanges();
                    membershipTransaction.Commit();
                    return Ok(playerExists);
                }
                else
                {
                    var addNewLink = new PlayersLeague()
                    {
                        PlayerID = playerExists.Id,
                        LeagueID = existingLeague.ID,
                        IsSub = player.IsSub,
                        LeagueDivisionId = divisionIdToSave
                    };

                    context.PlayersLeagues.Add(addNewLink);
                    context.SaveChanges();
                    membershipTransaction.Commit();
                    return Ok(playerExists);
                }
            }

            // Create new Player
            var newPlayer = new Player()
            {
                FirstName = player.FirstName,
                LastName = player.LastName,
                IsMale = player.IsMale,
                Gender = player.Gender
            };

            context.Players.Add(newPlayer);
            context.SaveChanges();

            var addedPlayer = context.Players
                .Where(x => x.FirstName == player.FirstName && x.LastName == player.LastName)
                .FirstOrDefault();

            if (addedPlayer == null)
            {
                return NotFound();
            }

            var addedPlayersLeagues = new PlayersLeague()
            {
                LeagueID = existingLeague.ID,
                PlayerID = addedPlayer.Id,
                IsSub = player.IsSub,
                LeagueDivisionId = divisionIdToSave
            };

            context.PlayersLeagues.Add(addedPlayersLeagues);
            context.SaveChanges();
            membershipTransaction.Commit();
            return Ok(addedPlayer);
            }
        }

        [HttpGet("AvailableLeaguePlayers/{leagueId:int}")]
        [Authorize]
        public IActionResult AvailableLeaguePlayers(int leagueId, [FromQuery] int? memberPlayerId = null, [FromQuery] bool includeMembers = false, [FromQuery] bool membersOnly = false)
        {
            using (var context = new DataContext())
            {
                if (!context.Leagues.Any(l => l.ID == leagueId)) return NotFound();
                if (!LeagueAccess.CanManage(User, context, leagueId)) return Forbid();
                if (memberPlayerId.HasValue)
                {
                    var membership = context.PlayersLeagues.SingleOrDefault(m => m.LeagueID == leagueId && m.PlayerID == memberPlayerId.Value);
                    if (membership == null) return NotFound();
                    var player = context.Players.AsNoTracking().Single(p => p.Id == membership.PlayerID);
                    var divisionName = context.LeagueDivision.Where(d => d.Id == membership.LeagueDivisionId && d.LeagueID == leagueId).Select(d => string.IsNullOrEmpty(d.Name) ? d.Code : d.Name).FirstOrDefault();
                    var teams = (from link in context.LeagueTeamPlayer.AsNoTracking() join team in context.LeagueTeam.AsNoTracking() on link.LeagueTeamId equals team.Id
                        where link.PlayerId == memberPlayerId.Value && team.LeagueID == leagueId select new { team.Id, team.TeamName, team.Division }).Distinct().ToList();
                    return Ok(new { player, leagueId, membershipId = membership.Id, leagueDivisionId = membership.LeagueDivisionId ?? 0, leagueDivisionName = divisionName, teams, canEditProfile = User.IsInRole("Admin"), alreadyMember = true });
                }
                var players = context.Players.AsNoTracking()
                    .Where(p => membersOnly ? context.PlayersLeagues.Any(m => m.LeagueID == leagueId && m.PlayerID == p.Id) : includeMembers || !context.PlayersLeagues.Any(m => m.LeagueID == leagueId && m.PlayerID == p.Id))
                    .OrderBy(p => p.FirstName).ThenBy(p => p.LastName).ThenBy(p => p.Id)
                    .Select(p => new { p.Id, p.FirstName, p.LastName, p.IsMale }).ToList();
                var divisions = context.LeagueDivision.AsNoTracking().Where(d => d.LeagueID == leagueId)
                    .OrderBy(d => d.SortOrder).ThenBy(d => d.Name)
                    .Select(d => new { d.Id, d.Code, d.Name }).ToList();
                if (includeMembers)
                    return Ok(new { players, divisions, members = context.PlayersLeagues.AsNoTracking().Where(m => m.LeagueID == leagueId)
                        .Select(m => new { playerId = m.PlayerID, divisionId = m.LeagueDivisionId ?? 0 }).ToList() });
                return Ok(new { players, divisions });
            }
        }

        [HttpPut("LeaguePlayer/{leagueId:int}/{playerId:int}")]
        [HttpPut("LeaguePlayerDivision/{leagueId:int}/{playerId:int}")]
        [SameOrigin]
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult UpdateLeaguePlayerDivision(int leagueId, int playerId, [FromBody] LeaguePlayerDivisionRequest request)
        {
            using (var context = new DataContext())
            {
                if (!LeagueAccess.CanManage(User, context, leagueId)) return Forbid();
                if (playerId <= 0 || request == null || request.DivisionId < 0 || !request.ExpectedDivisionId.HasValue || request.ExpectedDivisionId < 0)
                    return BadRequest("Choose a valid player and division.");
                using (var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable))
                {
                    var membership = context.PlayersLeagues.SingleOrDefault(m => m.LeagueID == leagueId && m.PlayerID == playerId);
                    if (membership == null) return NotFound("This player is no longer in the selected league.");
                    var player = context.Players.Single(p => p.Id == playerId);
                    bool profileChanged = false;
                    if (request.FirstName != null || request.LastName != null)
                    {
                        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName) ||
                            request.FirstName.Length > 100 || request.LastName.Length > 100 ||
                            System.Text.RegularExpressions.Regex.IsMatch(request.FirstName + request.LastName, @"[\x00-\x1F\x7F]"))
                            return BadRequest("Enter valid first and last names of up to 100 characters.");
                        var first = System.Text.RegularExpressions.Regex.Replace(request.FirstName.Trim(), @"\s+", " ");
                        var last = System.Text.RegularExpressions.Regex.Replace(request.LastName.Trim(), @"\s+", " ");
                        profileChanged = first != player.FirstName || last != player.LastName;
                        // League managers and password-only administration do not grant
                        // authority to rename a global profile shared by other leagues.
                        if (profileChanged && !User.IsInRole("Admin")) return Forbid();
                        if (profileChanged && (request.ExpectedFirstName != player.FirstName || request.ExpectedLastName != player.LastName))
                            return Conflict(new { message = "This player's name changed. Reopen Edit to review the current profile." });
                        if (profileChanged && context.Players.Any(p => p.Id != playerId && p.FirstName == first && p.LastName == last))
                            return Conflict(new { message = "Another player already uses this name. Review the existing profiles before changing it." });
                        // Both profile and division validation complete before a single commit.
                        if (profileChanged) { player.FirstName = first; player.LastName = last; }
                    }
                    if ((membership.LeagueDivisionId ?? 0) != request.ExpectedDivisionId.Value)
                        return Conflict(new { message = "This membership changed. Reopen Edit to review its current division." });
                    var division = request.DivisionId > 0 ? context.LeagueDivision.SingleOrDefault(d => d.Id == request.DivisionId && d.LeagueID == leagueId) : null;
                    if (request.DivisionId > 0 && division == null) return BadRequest("The division does not belong to this league.");
                    // Team divisions and team-player assignments have independent records.
                    // Changing the player's current division never rewrites either or history.
                    membership.LeagueDivisionId = request.DivisionId > 0 ? (int?)request.DivisionId : null;
                    context.SaveChanges(); transaction.Commit();
                    return Ok(new { leagueId, membershipId = membership.Id, player, profileChanged,
                        leagueDivisionId = membership.LeagueDivisionId ?? 0, leagueDivisionName = division == null ? "" : string.IsNullOrEmpty(division.Name) ? division.Code : division.Name });
                }
            }
        }

        // Shared create-only rule for the browser and file import. The caller owns
        // the transaction; existing memberships and their assignments are untouched.
        private static PlayersLeague EnsureExistingMembership(DataContext context, IDictionary<int, PlayersLeague> memberships,
            int leagueId, int playerId, int divisionId)
        {
            if (memberships.TryGetValue(playerId, out var existing)) return existing;
            var member = new PlayersLeague { LeagueID = leagueId, PlayerID = playerId,
                LeagueDivisionId = divisionId > 0 ? (int?)divisionId : null, IsSub = null };
            context.PlayersLeagues.Add(member); memberships.Add(playerId, member); return member;
        }

        [HttpPost("ImportLeaguePlayers/{leagueId:int}")]
        [RequestSizeLimit(131072)]
        [SameOrigin]
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult ImportLeaguePlayers(int leagueId, [FromBody] LeaguePlayerImportRequest request)
        {
            using (var context = new DataContext())
            {
                if (!context.Leagues.Any(l => l.ID == leagueId)) return NotFound();
                if (!LeagueAccess.CanManage(User, context, leagueId)) return Forbid();
                if (request?.Players == null || request.Players.Count == 0 || request.Players.Count > 1000 ||
                    request.Players.Any(p => p == null || p.PlayerId <= 0 || p.DivisionId < 0) ||
                    request.Players.Select(p => p.PlayerId).Distinct().Count() != request.Players.Count)
                    return BadRequest("Choose between 1 and 1000 distinct existing players with valid divisions.");
                var ids = request.Players.Select(p => p.PlayerId).ToList();
                var divisionIds = request.Players.Where(p => p.DivisionId > 0).Select(p => p.DivisionId).Distinct().ToList();
                using (var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable))
                {
                    var players = context.Players.Where(p => ids.Contains(p.Id)).ToDictionary(p => p.Id);
                    if (players.Count != ids.Count) return BadRequest("A selected player no longer exists. Reload the preview before importing.");
                    var divisions = context.LeagueDivision.Where(d => d.LeagueID == leagueId).ToDictionary(d => d.Id);
                    if (divisionIds.Any(id => !divisions.ContainsKey(id))) return BadRequest("A selected division does not belong to this league. Reload the preview before importing.");
                    var memberships = context.PlayersLeagues.Where(m => m.LeagueID == leagueId && ids.Contains(m.PlayerID)).ToDictionary(m => m.PlayerID);
                    var existingIds = new HashSet<int>(memberships.Keys);
                    foreach (var entry in request.Players) EnsureExistingMembership(context, memberships, leagueId, entry.PlayerId, entry.DivisionId);
                    context.SaveChanges();
                    var results = request.Players.Select(entry => {
                        var membership = memberships[entry.PlayerId];
                        return new { player = players[entry.PlayerId], leagueId, leagueDivisionId = membership.LeagueDivisionId ?? 0,
                            leagueDivisionName = membership.LeagueDivisionId.HasValue && divisions.ContainsKey(membership.LeagueDivisionId.Value) ?
                                (divisions[membership.LeagueDivisionId.Value].Name ?? divisions[membership.LeagueDivisionId.Value].Code) : null,
                            alreadyMember = existingIds.Contains(entry.PlayerId) };
                    }).ToList();
                    transaction.Commit();
                    return Ok(new { leagueId, atomic = true, results });
                }
            }
        }


        [HttpPost("[action]")]
        [SameOrigin]
        [Authorize]
        public IActionResult AddPlayerWithoutLeague([FromBody] Player player, [FromQuery] int? importLeagueId = null)
        {
            // Registration uses this endpoint before the new player has a league.
            // It is never available anonymously, and existing player accounts
            // cannot continually create unassociated profiles.
            if (player == null || string.IsNullOrWhiteSpace(player.FirstName) ||
                string.IsNullOrWhiteSpace(player.LastName))
            {
                return BadRequest("A first and last name are required.");
            }
            var userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdValue, out var currentUserId))
            {
                return Unauthorized();
            }

            var context = new DataContext();
            if (importLeagueId.HasValue)
            {
                if (!LeagueAccess.CanManage(User, context, importLeagueId.Value)) return Forbid();
                if (!context.Leagues.Any(l => l.ID == importLeagueId.Value)) return NotFound();
                if (player.FirstName.Length > 100 || player.LastName.Length > 100 ||
                    (player.Gender != "Male" && player.Gender != "Female")) return BadRequest("Enter valid names and choose a gender.");
                Func<string, string> normalize = name => System.Text.RegularExpressions.Regex.Replace(name.Normalize(System.Text.NormalizationForm.FormKC).Trim(), @"\s+", " ");
                player.FirstName = normalize(player.FirstName); player.LastName = normalize(player.LastName);
                using (var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable))
                {
                    var name = normalize(player.FirstName + " " + player.LastName);
                    var existing = context.Players.AsEnumerable().Where(p => string.Equals(normalize(p.FirstName + " " + p.LastName), name, StringComparison.OrdinalIgnoreCase)).ToList();
                    if (existing.Count > 1) return Conflict(new { message = "Several players already have this name. Choose the correct existing player." });
                    if (existing.Count == 1) { transaction.Commit(); return Ok(existing[0]); }
                    // Same profile creation model as registration; no membership is created.
                    var created = new Player { FirstName = player.FirstName, LastName = player.LastName, Gender = player.Gender, IsMale = player.Gender == "Male", IsSub = null };
                    context.Players.Add(created); context.SaveChanges(); transaction.Commit(); return Ok(created);
                }
            }
            bool isManager = User.IsInRole("Admin") || User.IsInRole("Manager");
            if (!isManager && context.UsersPlayer.Any(up => up.UserId == currentUserId))
            {
                return Forbid();
            }

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
                IsMale = string.Equals(player.Gender, "Male", StringComparison.OrdinalIgnoreCase),
                Gender = player.Gender,
                IsSub = player.IsSub
            };

            context.Players.Add(newPlayer);
            context.SaveChanges();

            // Return the newly created player
            return Ok(newPlayer);
        }


        private static bool IsGuidedTournamentTeam(DataContext context, int teamId) =>
            context.KingQueenTeam.Any(team => team.Id == teamId && context.TournamentRounds.Any(round =>
                round.LeagueId == team.LeagueID && round.ScrambleNumber == team.ScrambleNumber));

        [HttpPost("SaveKingQueenRoundScores/{leagueName}")]
        [Authorize(Policy = "LeagueManagement")]
        public async Task<IActionResult> SaveKingQueenRoundScores(
        [FromRoute] string leagueName,
        [FromBody] KingQueenRoundScoresRequest request)
        {
            var context = new DataContext();
            if (request == null || request.RoundScores == null || !request.RoundScores.Any())
            {
                return BadRequest("Invalid round scores data.");
            }

            var league = context.Leagues.FirstOrDefault(l => l.LeagueName == leagueName);
            if (league == null)
                return NotFound("League not found.");
            if (!LeagueAccess.CanManage(User, context, league.ID))
                return Forbid();

            foreach (var score in request.RoundScores)
            {
                var storedTeamId = score.Id > 0
                    ? context.KingQueenRoundScores.Where(r => r.Id == score.Id)
                        .Select(r => r.KingQueenTeamId).FirstOrDefault()
                    : 0;
                var targetTeamId = storedTeamId > 0 ? storedTeamId : score.KingQueenTeamId;
                if (!context.KingQueenTeam.Any(t =>
                    t.Id == targetTeamId && t.LeagueID == league.ID))
                {
                    return BadRequest("Score references a team outside the selected league.");
                }
                if (IsGuidedTournamentTeam(context, targetTeamId))
                    return Conflict("Save guided tournament scores in Tournament Center.");
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
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
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

            var leagueId = await context.KingQueenTeam
                .Where(t => t.Id == kingQueenPlayer.KingQueenTeamId)
                .Select(t => t.LeagueID).FirstOrDefaultAsync();
            if (!LeagueAccess.CanManage(User, context, leagueId))
                return Forbid();

            if (IsGuidedTournamentTeam(context, dto.KingQueenTeamId))
                return Conflict("Guided tournament assignments are managed in Tournament Center.");
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
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult GenerateScramble([FromBody] KingQueenTeamsResponse request, string leagueName)
        {
            using (var context = new DataContext())
            {
                // Keep the event lookup valid until the legacy team writes commit.
                using var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable);
                // 1) Check that the league exists
                var existingLeague = context.Leagues
                    .FirstOrDefault(x => x.LeagueName == leagueName);

                if (existingLeague == null)
                {
                    return NotFound("League does not exist.");
                }

                if (!LeagueAccess.CanManage(User, context, existingLeague.ID))
                    return Forbid();

                var leagueId = existingLeague.ID;

                if (context.TournamentConfigurations.Any(row => row.LeagueId == leagueId))
                    return Conflict("Generate tournament rounds in Tournament Center.");

                // 2) Determine next ScrambleNumber (if that's how you want to group these new teams)
                var scrambleNumber = (context.KingQueenTeam
                    .Where(kt => kt.LeagueID == leagueId)
                    .Select(kt => (int?)kt.ScrambleNumber)
                    .Max() ?? 0) + 1;

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
                transaction.Commit();
                return Ok(createdTeams);
            }
        }




        [HttpPost("[action]/{leagueName}")]
        [Authorize(Policy = "LeagueManagement")]
        public IActionResult SaveKingQueenTeams([FromBody] KingQueenTeamsResponse request, string leagueName)
        {
            using (var context = new DataContext())
            {
                var existingLeague = context.Leagues
                    .FirstOrDefault(x => x.LeagueName == leagueName);
                if (existingLeague == null)
                {
                    return Ok((KingQueenTeamsResponse)null);
                }

                if (!LeagueAccess.CanManage(User, context, existingLeague.ID))
                    return Forbid();

                var leagueId = existingLeague.ID;

                if (context.TournamentConfigurations.Any(row => row.LeagueId == leagueId))
                    return Conflict("Save tournament rounds in Tournament Center.");

                // The viewer supplies stable IDs for both generated and retrieved teams.
                // Keep the legacy no-ID finalization path below for other existing callers.
                if (request == null || request.KingQueenTeams == null || request.KingQueenTeams.Count == 0)
                    return BadRequest("No teams supplied.");
                if (request.KingQueenTeams.Any(t => t == null || t.KingQueenTeam == null || t.Players == null))
                    return BadRequest("Invalid team assignments.");
                if (request.KingQueenTeams.Any(t => t.KingQueenTeam.Id > 0))
                {
                    var requestedIds = request.KingQueenTeams.Select(t => t.KingQueenTeam.Id).ToList();
                    if (requestedIds.Any(id => id <= 0) || requestedIds.Distinct().Count() != requestedIds.Count)
                        return BadRequest("Supply each saved team exactly once.");
                    var requestedPlayers = request.KingQueenTeams.SelectMany(t => t.Players).ToList();
                    if (requestedPlayers.Any(p => p == null)) return BadRequest("Invalid player.");
                    var playerIds = requestedPlayers.Select(p => p.Id).ToList();
                    if (playerIds.Any(id => id <= 0) || playerIds.Distinct().Count() != playerIds.Count ||
                        context.Players.Count(p => playerIds.Contains(p.Id)) != playerIds.Count)
                        return BadRequest("Supply valid players with no duplicate team assignments.");

                    using (var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable))
                    {
                        var selectedTeams = context.KingQueenTeam.Where(t => requestedIds.Contains(t.Id)).OrderBy(t => t.Id).ToList();
                        if (selectedTeams.Count != requestedIds.Count || selectedTeams.Any(t => t.LeagueID != leagueId) ||
                            selectedTeams.Select(t => t.ScrambleNumber).Distinct().Count() != 1 ||
                            selectedTeams.Select(t => t.ScrambleWithScoresToBeSaved).Distinct().Count() != 1)
                            return BadRequest("Teams must belong to one selected league scramble.");
                        var selectedNumber = selectedTeams[0].ScrambleNumber;
                        var allScrambleIds = context.KingQueenTeam.Where(t => t.LeagueID == leagueId && t.ScrambleNumber == selectedNumber).Select(t => t.Id).ToList();
                        if (allScrambleIds.Count != requestedIds.Count || allScrambleIds.Except(requestedIds).Any())
                            return BadRequest("Save the complete selected scramble.");
                        var finalized = selectedTeams[0].ScrambleWithScoresToBeSaved;
                        var links = context.KingQueenPlayer.Where(p => requestedIds.Contains(p.KingQueenTeamId)).ToList();
                        if (finalized && (links.Count != playerIds.Count || links.Select(p => p.PlayerId).Distinct().Count() != links.Count || links.Any(p => !playerIds.Contains(p.PlayerId))))
                            return BadRequest("Saved scramble players must remain the same; only team assignments may change.");
                        if (!finalized && links.Count > 0) return BadRequest("Pending scramble already has assignments. Retrieve it before retrying.");
                        foreach (var requestedTeam in request.KingQueenTeams)
                        {
                            foreach (var player in requestedTeam.Players)
                            {
                                if (finalized)
                                {
                                    // Move existing membership rows, retaining IDs and substitute-score flags.
                                    links.Single(p => p.PlayerId == player.Id).KingQueenTeamId = requestedTeam.KingQueenTeam.Id;
                                }
                                else context.KingQueenPlayer.Add(new KingQueenPlayer { KingQueenTeamId = requestedTeam.KingQueenTeam.Id, PlayerId = player.Id, isSubScore = false });
                            }
                        }
                        if (!finalized)
                        {
                            var byes = request.ByePlayers ?? new List<Player>();
                            if (byes.Any(p => p == null || p.Id <= 0) || byes.Select(p => p.Id).Distinct().Count() != byes.Count || byes.Any(p => playerIds.Contains(p.Id)))
                                return BadRequest("Invalid bye assignments.");
                            var byeIds = byes.Select(p => p.Id).ToList();
                            if (context.Players.Count(p => byeIds.Contains(p.Id)) != byeIds.Count)
                                return BadRequest("Invalid bye players.");
                            var byeRound = new ByeRounds { LeagueID = leagueId, DateOfRound = selectedTeams[0].DateOfTeam, ScrambleNumber = selectedNumber };
                            context.ByeRounds.Add(byeRound);
                            context.SaveChanges();
                            foreach (var player in byes) context.ByePlayer.Add(new ByePlayer { ByeRoundId = byeRound.Id, PlayerId = player.Id });
                            selectedTeams.ForEach(t => t.ScrambleWithScoresToBeSaved = true);
                        }
                        context.SaveChanges();
                        transaction.Commit();
                        return Ok(new KingQueenTeamsResponse {
                            KingQueenTeams = selectedTeams.Select(team => new KingQueenTeamWithPlayers { KingQueenTeam = team, Players = request.KingQueenTeams.Single(t => t.KingQueenTeam.Id == team.Id).Players }).ToList(),
                            ByePlayers = request.ByePlayers ?? new List<Player>()
                        });
                    }
                }

                // 1) Find the highest ScrambleNumber for unscrambled teams:
                var latestScrambleNumber = context.KingQueenTeam
                    .Where(kt => kt.LeagueID == leagueId && kt.ScrambleWithScoresToBeSaved == false)
                    .Select(kt => (int?)kt.ScrambleNumber)
                    .Max() ?? 0;

                // If 0, it means none exist, or everything is already true
                if (latestScrambleNumber == 0)
                {
                    return Ok((KingQueenTeamsResponse)null); // or handle "nothing to finalize"
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
                    return Ok((KingQueenTeamsResponse)null);
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
                return Ok(new KingQueenTeamsResponse
                {
                    KingQueenTeams = results,
                    ByePlayers = savedByePlayers
                });
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
                // SaveKingQueenTeams assigns request positions in this exact ID order.
                .OrderBy(t => t.Id)
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
        [SameOrigin]
        public async Task<IActionResult> SignInPlayer([FromBody] PlayerSignIn playerSignIn)
        {
            // This endpoint stays public so leagues can use the existing
            // kiosk/player sign-in workflow without creating an account.
            if (playerSignIn == null || playerSignIn.LeagueId <= 0 || playerSignIn.PlayerId <= 0)
            {
                return BadRequest("Invalid player or league.");
            }

            using (var context = new DataContext())
            using (var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable))
            {
                var now = AttendanceRules.EasternNow(DateTime.UtcNow);
                await AttendanceSerialization.Acquire(context, playerSignIn.LeagueId, now.Date);
                if (!await context.Leagues.AnyAsync(l => l.ID == playerSignIn.LeagueId))
                {
                    return NotFound("League not found.");
                }
                if (await context.Leagues.AnyAsync(l => l.ID == playerSignIn.LeagueId && l.EventTypeId == 2))
                    return Conflict("Use Tournament Check In for this event.");

                // Do not trust a posted player ID to belong to this league.
                if (!await context.PlayersLeagues.AnyAsync(pl =>
                    pl.LeagueID == playerSignIn.LeagueId && pl.PlayerID == playerSignIn.PlayerId))
                {
                    return BadRequest("Player does not belong to the selected league.");
                }

                var availability = await LeagueAttendanceAvailability.Read(context, playerSignIn.LeagueId, now);
                if (availability.Locked)
                    return StatusCode(423, availability.Reason);

                playerSignIn.DateTime = now;
                playerSignIn.PlayerSignInId = 0;
                playerSignIn.LockedSignIn = false;

                if (await context.PlayerSignIn.AnyAsync(signIn =>
                    signIn.LeagueId == playerSignIn.LeagueId &&
                    signIn.PlayerId == playerSignIn.PlayerId &&
                    signIn.DateTime.Date == playerSignIn.DateTime.Date))
                {
                    return Conflict("This player is already signed in for this date.");
                }

                var player = await context.Players.FindAsync(playerSignIn.PlayerId);
                if (player == null)
                {
                    return NotFound("Player not found.");
                }

                context.PlayerSignIn.Add(playerSignIn);
                await context.SaveChangesAsync();
                transaction.Commit();

                return Ok(new PlayerSignInResult
                {
                    PlayerSignInId = playerSignIn.PlayerSignInId,
                    DateTime = playerSignIn.DateTime,
                    LeagueId = playerSignIn.LeagueId,
                    PlayerId = playerSignIn.PlayerId,
                    FirstName = player.FirstName,
                    LastName = player.LastName,
                    Gender = player.IsMale ? "Male" : "Female"
                });
            }
        }

        [HttpPost("SaveCreatedTeamScores")]
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public async Task<IActionResult> SaveCreatedTeamScores([FromBody] List<TeamScoreDto> scores)
        {
            await using var context = new DataContext();
            if (scores == null || !scores.Any())
            {
                return BadRequest("No scores provided.");
            }

            await using var transaction = await context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            // Verify every requested league and existing team before any writes.
            if (scores.Any(sc => sc.LeagueId <= 0 ||
                !LeagueAccess.CanManage(User, context, sc.LeagueId) ||
                !context.Leagues.Any(l => l.ID == sc.LeagueId)))
                return Forbid();

            if (scores.Any(score => context.TournamentConfigurations.Any(row => row.LeagueId == score.LeagueId)))
                return Conflict("Enter guided tournament scores in Tournament Center.");

            // The Create Teams screen sends temporary positive team IDs for
            // brand-new teams. Those IDs won't exist in the database yet and
            // must remain valid. Reject only IDs that *do* exist in another
            // league; the save method creates a new team when no row exists.
            if (scores.Any(sc => sc.KingQueenTeamId > 0 &&
                context.KingQueenTeam.Any(t =>
                    t.Id == sc.KingQueenTeamId && t.LeagueID != sc.LeagueId)))
                return BadRequest("One of the teams belongs to another league.");

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

                // All new teams in one submitted batch share the new scramble
                // number for their league, rather than incrementing per team.
                var newScrambleNumbers = new Dictionary<int, int>();
                foreach (var teamScore in scores)
                {
                    // If scramble number is 0, assign a new scramble number
                    if (teamScore.ScrambleNumber == 0)
                    {
                        if (!newScrambleNumbers.TryGetValue(teamScore.LeagueId, out var nextScrambleNumber))
                        {
                            nextScrambleNumber = (context.KingQueenTeam
                                .Where(t => t.LeagueID == teamScore.LeagueId && t.ScrambleWithScoresToBeSaved)
                                .Select(t => (int?)t.ScrambleNumber)
                                .Max() ?? 0) + 1;
                            newScrambleNumbers.Add(teamScore.LeagueId, nextScrambleNumber);
                        }
                        teamScore.ScrambleNumber = nextScrambleNumber;
                        latestScrambleNumber = Math.Max(latestScrambleNumber, nextScrambleNumber);
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
                }).ToList();

                await transaction.CommitAsync();
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
                    (kqt, p) => new
                    {
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
        [Authorize]
        [SameOrigin]
        public async Task<IActionResult> DeleteSignInPlayer(int playerSignInId)
        {
            var context = new DataContext();

            var signInRecord = await context.PlayerSignIn.FindAsync(playerSignInId);

            if (signInRecord == null)
            {
                return NotFound($"PlayerSignIn record with ID {playerSignInId} not found.");
            }
            if (await context.Leagues.AnyAsync(l => l.ID == signInRecord.LeagueId && l.EventTypeId == 2))
                return Conflict("Use Tournament Check In for this event.");

            // Managers can remove entries; ordinary players can only remove
            // their own entry. This preserves the existing sign-in toggle.
            bool isLeagueManager = LeagueAccess.CanManage(User, context, signInRecord.LeagueId);
            bool isOwnEntry = false;
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var currentUserId))
            {
                isOwnEntry = await context.UsersPlayer.AnyAsync(
                    up => up.UserId == currentUserId && up.PlayerId == signInRecord.PlayerId);
            }
            if (!isLeagueManager && !isOwnEntry)
            {
                return Forbid();
            }

            using var transaction = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable);
            var now = AttendanceRules.EasternNow(DateTime.UtcNow);
            await AttendanceSerialization.Acquire(context, signInRecord.LeagueId, signInRecord.DateTime.Date);
            await context.Entry(signInRecord).ReloadAsync();
            if (context.Entry(signInRecord).State == EntityState.Detached) return NoContent();
            if (!isLeagueManager)
            {
                var availability = await LeagueAttendanceAvailability.Read(context, signInRecord.LeagueId, now);
                if (availability.Locked) return StatusCode(423, availability.Reason);
            }

            context.PlayerSignIn.Remove(signInRecord);
            await context.SaveChangesAsync();
            transaction.Commit();
            return NoContent();
        }


        [HttpGet("GetByLeague/{leagueName}")]
        public async Task<IActionResult> GetStandingsByLeague(string leagueName)
        {
            var context = new DataContext();

            var leagueId = await context.Leagues
                .Where(league => league.LeagueName == leagueName)
                .Select(league => league.ID)
                .FirstOrDefaultAsync();

            if (leagueId == 0)
            {
                return BadRequest(new { message = "League not found." });
            }

            var isTournament = await context.Leagues.AnyAsync(league => league.ID == leagueId && league.EventTypeId == 2);
            var kingQueenTeams = await context.KingQueenTeam
                .Where(team => team.LeagueID == leagueId && team.ScrambleWithScoresToBeSaved == true)
                .Include(team => team.KingQueenRoundScores)
                .Include(team => team.KingQueenPlayers)
                    .ThenInclude(player => player.Player)
                .ToListAsync();

            var guidedRounds = isTournament
                ? await context.TournamentRounds.AsNoTracking().Where(round => round.LeagueId == leagueId).ToListAsync()
                : new List<TournamentRound>();
            if (guidedRounds.Any(round => round.VoidedAtUtc != null))
            {
                var voided = guidedRounds.Where(round => round.VoidedAtUtc != null).Select(round => round.ScrambleNumber).ToHashSet();
                kingQueenTeams.RemoveAll(team => voided.Contains(team.ScrambleNumber));
                guidedRounds.RemoveAll(round => round.VoidedAtUtc != null);
            }
            var wins = guidedRounds.Count == 0 ? null : Services.TournamentMatchupResults.WinsByPlayer(guidedRounds, kingQueenTeams);
            var tournamentProgress = isTournament ? await TournamentProgress(context, leagueId, guidedRounds, kingQueenTeams) : null;
            if (isTournament) kingQueenTeams = kingQueenTeams.Where(team => team.KingQueenRoundScores.Count != 0).ToList();
            if (!kingQueenTeams.Any())
            {
                if (isTournament) return Ok(new { playerScores = Array.Empty<object>(), maxRounds = 0, tournamentProgress });
                return Ok(new { message = "No teams found in the league." });
            }

            var validRounds = kingQueenTeams
                .SelectMany(team => team.KingQueenRoundScores.Select(score => new
                {
                    ScrambleNumber = team.ScrambleNumber,
                    RoundId = score.RoundId,
                }))
                .Distinct()
                .OrderBy(round => round.ScrambleNumber)
                .ThenBy(round => round.RoundId)
                .ToList();

            if (!validRounds.Any())
            {
                if (isTournament) return Ok(new { playerScores = Array.Empty<object>(), maxRounds = 0, tournamentProgress });
                return Ok(new { message = "No valid rounds found in the league." });
            }

            var leagueDivisionLookupRows = await (
                from pl in context.PlayersLeagues
                join ld in context.LeagueDivision on pl.LeagueDivisionId equals ld.Id into ldJoin
                from ld in ldJoin.DefaultIfEmpty()
                where pl.LeagueID == leagueId
                select new
                {
                    PlayerId = pl.PlayerID,
                    LeagueDivisionId = pl.LeagueDivisionId,
                    LeagueDivisionCode = ld != null ? ld.Code : null,
                    LeagueDivisionName = ld != null ? ld.Name : null
                }
            ).ToListAsync();

            var playerDivisionLookup = new Dictionary<int, (int LeagueDivisionId, string LeagueDivisionCode, string LeagueDivisionName)>();

            for (int i = 0; i < leagueDivisionLookupRows.Count; i++)
            {
                var row = leagueDivisionLookupRows[i];

                int divisionId = 0;
                string divisionCode = "Unassigned";
                string divisionName = "Unassigned";

                if (row.LeagueDivisionId.HasValue)
                {
                    divisionId = row.LeagueDivisionId.Value;
                }

                if (!string.IsNullOrWhiteSpace(row.LeagueDivisionCode))
                {
                    divisionCode = row.LeagueDivisionCode;
                }

                if (!string.IsNullOrWhiteSpace(row.LeagueDivisionName))
                {
                    divisionName = row.LeagueDivisionName;
                }

                if (!playerDivisionLookup.ContainsKey(row.PlayerId))
                {
                    playerDivisionLookup.Add(row.PlayerId, (divisionId, divisionCode, divisionName));
                }
            }

            var playerScores = kingQueenTeams
                .SelectMany(team => team.KingQueenPlayers, (team, player) => new
                {
                    PlayerId = player.PlayerId,
                    PlayerName = player.Player.FirstName + " " + player.Player.LastName,
                    IsMale = player.Player.IsMale,
                    Scores = team.KingQueenRoundScores.Select(score => new
                    {
                        KingQueenTeamId = team.Id,
                        RoundId = score.RoundId,
                        Score = score.RoundScore,
                        ScrambleNumber = team.ScrambleNumber,
                        RoundWon = (bool)score.RoundWon ? 1 : 0,
                        IsSubScore = player.isSubScore
                    }).ToList()
                })
                .GroupBy(playerData => new { playerData.PlayerId, playerData.PlayerName, playerData.IsMale })
                .Select(group => new
                {
                    PlayerId = group.Key.PlayerId,
                    PlayerName = group.Key.PlayerName,
                    IsMale = group.Key.IsMale,

                    LeagueDivisionId = playerDivisionLookup.ContainsKey(group.Key.PlayerId)
                        ? playerDivisionLookup[group.Key.PlayerId].LeagueDivisionId
                        : 0,

                    LeagueDivisionCode = playerDivisionLookup.ContainsKey(group.Key.PlayerId)
                        ? playerDivisionLookup[group.Key.PlayerId].LeagueDivisionCode
                        : "Unassigned",

                    LeagueDivisionName = playerDivisionLookup.ContainsKey(group.Key.PlayerId)
                        ? playerDivisionLookup[group.Key.PlayerId].LeagueDivisionName
                        : "Unassigned",

                    Scores = validRounds.Select(round => new
                    {
                        RoundId = round.RoundId,
                        ScrambleNumber = round.ScrambleNumber,
                        HasSavedScore = group.SelectMany(p => p.Scores).Count(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId) == 1,
                        KingQueenTeamId = group.SelectMany(p => p.Scores)
                            .Where(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId)
                            .Select(s => (int?)s.KingQueenTeamId).FirstOrDefault(),

                        IsSubScore = group
                            .SelectMany(player => player.Scores)
                            .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId) != null
                            && group
                                .SelectMany(player => player.Scores)
                                .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId).IsSubScore == true,

                        Score = group.SelectMany(player => player.Scores)
                                     .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId) != null
                            ? group.SelectMany(player => player.Scores)
                                   .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId).Score
                            : 0,

                        RoundWon = group.SelectMany(player => player.Scores)
                                        .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId) != null
                            ? group.SelectMany(player => player.Scores)
                                   .FirstOrDefault(s => s.ScrambleNumber == round.ScrambleNumber && s.RoundId == round.RoundId).RoundWon
                            : 0
                    })
                    .OrderBy(score => score.ScrambleNumber)
                    .ThenBy(score => score.RoundId)
                    .ToList()
                })
                .ToList();

            var maxRounds = validRounds.Count;

            return Ok(new { playerScores, maxRounds, matchupWins = wins, tournamentProgress });
        }



        [HttpGet("GetByLeagueMatchup/{leagueName}")]
        public async Task<IActionResult> GetStandingsByLeagueMatchup(string leagueName)
        {
            var context = new DataContext();

            var leagueId = await context.Leagues
                .Where(league => league.LeagueName == leagueName)
                .Select(league => league.ID)
                .FirstOrDefaultAsync();

            if (leagueId == 0)
            {
                return BadRequest(new { message = "League not found." });
            }

            var isTournament = await context.Leagues.AnyAsync(league => league.ID == leagueId && league.EventTypeId == 2);
            var kingQueenTeams = await context.KingQueenTeam
                .Where(team => team.LeagueID == leagueId && team.ScrambleWithScoresToBeSaved == true)
                .Include(team => team.KingQueenRoundScores)
                .Include(team => team.KingQueenPlayers)
                    .ThenInclude(player => player.Player)
                .ToListAsync();

            var guidedRounds = isTournament
                ? await context.TournamentRounds.AsNoTracking().Where(round => round.LeagueId == leagueId).ToListAsync()
                : new List<TournamentRound>();
            if (guidedRounds.Any(round => round.VoidedAtUtc != null))
            {
                var voided = guidedRounds.Where(round => round.VoidedAtUtc != null).Select(round => round.ScrambleNumber).ToHashSet();
                kingQueenTeams.RemoveAll(team => voided.Contains(team.ScrambleNumber));
                guidedRounds.RemoveAll(round => round.VoidedAtUtc != null);
            }
            var wins = guidedRounds.Count == 0 ? null : Services.TournamentMatchupResults.WinsByPlayer(guidedRounds, kingQueenTeams);
            var tournamentProgress = isTournament ? await TournamentProgress(context, leagueId, guidedRounds, kingQueenTeams) : null;
            if (isTournament) kingQueenTeams = kingQueenTeams.Where(team => team.KingQueenRoundScores.Count != 0).ToList();
            if (!kingQueenTeams.Any())
            {
                if (isTournament) return Ok(new { playerScores = Array.Empty<object>(), maxRounds = 0, tournamentProgress });
                return Ok(new { message = "No teams found in the league." });
            }

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
                if (isTournament) return Ok(new { playerScores = Array.Empty<object>(), maxRounds = 0, tournamentProgress });
                return Ok(new { message = "No valid rounds found in the league." });
            }

            var leagueDivisionLookupRows = await (
                from pl in context.PlayersLeagues
                join ld in context.LeagueDivision on pl.LeagueDivisionId equals ld.Id into ldJoin
                from ld in ldJoin.DefaultIfEmpty()
                where pl.LeagueID == leagueId
                select new
                {
                    PlayerId = pl.PlayerID,
                    LeagueDivisionId = pl.LeagueDivisionId,
                    LeagueDivisionCode = ld != null ? ld.Code : null,
                    LeagueDivisionName = ld != null ? ld.Name : null
                }
            ).ToListAsync();

            var playerDivisionLookup = new Dictionary<int, (int LeagueDivisionId, string LeagueDivisionCode, string LeagueDivisionName)>();

            for (int i = 0; i < leagueDivisionLookupRows.Count; i++)
            {
                var row = leagueDivisionLookupRows[i];

                int divisionId = 0;
                string divisionCode = "Unassigned";
                string divisionName = "Unassigned";

                if (row.LeagueDivisionId.HasValue)
                {
                    divisionId = row.LeagueDivisionId.Value;
                }

                if (!string.IsNullOrWhiteSpace(row.LeagueDivisionCode))
                {
                    divisionCode = row.LeagueDivisionCode;
                }

                if (!string.IsNullOrWhiteSpace(row.LeagueDivisionName))
                {
                    divisionName = row.LeagueDivisionName;
                }

                if (!playerDivisionLookup.ContainsKey(row.PlayerId))
                {
                    playerDivisionLookup.Add(row.PlayerId, (divisionId, divisionCode, divisionName));
                }
            }

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

            var unfilteredPlayerScores = kingQueenTeams
                .SelectMany(team => team.KingQueenPlayers, (team, player) => new
                {
                    PlayerId = player.PlayerId,
                    PlayerName = player.Player.FirstName + " " + player.Player.LastName,
                    IsMale = player.Player.IsMale,

                    LeagueDivisionId = playerDivisionLookup.ContainsKey(player.PlayerId)
                        ? playerDivisionLookup[player.PlayerId].LeagueDivisionId
                        : 0,

                    LeagueDivisionCode = playerDivisionLookup.ContainsKey(player.PlayerId)
                        ? playerDivisionLookup[player.PlayerId].LeagueDivisionCode
                        : "Unassigned",

                    LeagueDivisionName = playerDivisionLookup.ContainsKey(player.PlayerId)
                        ? playerDivisionLookup[player.PlayerId].LeagueDivisionName
                        : "Unassigned",

                    Scores = team.KingQueenRoundScores
                        .GroupBy(score => team.ScrambleNumber)
                        .Select(scrambleGroup => new
                        {
                            KingQueenTeamId = team.Id,
                            ScrambleNumber = scrambleGroup.Key,
                            Score = scrambleGroup.Sum(roundScore => roundScore.RoundScore),
                            RoundWon = scrambleGroup.Count(roundScore => (bool)roundScore.RoundWon),
                            IsSubScore = player.isSubScore
                        })
                        .OrderBy(scramble => scramble.ScrambleNumber)
                        .ToList()
                })
                .GroupBy(playerData => new
                {
                    playerData.PlayerId,
                    playerData.PlayerName,
                    playerData.IsMale,
                    playerData.LeagueDivisionId,
                    playerData.LeagueDivisionCode,
                    playerData.LeagueDivisionName
                })
                .Select(group => new
                {
                    PlayerId = group.Key.PlayerId,
                    PlayerName = group.Key.PlayerName,
                    IsMale = group.Key.IsMale,
                    LeagueDivisionId = group.Key.LeagueDivisionId,
                    LeagueDivisionCode = group.Key.LeagueDivisionCode,
                    LeagueDivisionName = group.Key.LeagueDivisionName,
                    Scores = group.SelectMany(player => player.Scores).ToList()
                })
                .ToList();

            var playerScores = unfilteredPlayerScores.Select(player =>
            {
                var summedScoresByScramble = player.Scores
                    .GroupBy(score => score.ScrambleNumber)
                    .ToDictionary(
                        group => group.Key,
                        group => new
                        {
                            ScrambleNumber = group.Key,
                            TeamIds = group.Select(s => s.KingQueenTeamId).Distinct().ToList(),
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
                                HasSavedScore = existingScore.TeamIds.Count == 1,
                                KingQueenTeamId = existingScore.TeamIds.Count == 1 ? (int?)existingScore.TeamIds[0] : null,
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
                                HasSavedScore = false,
                                KingQueenTeamId = (int?)null,
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
                    LeagueDivisionId = player.LeagueDivisionId,
                    LeagueDivisionCode = player.LeagueDivisionCode,
                    LeagueDivisionName = player.LeagueDivisionName,
                    Scores = normalizedScores
                };
            }).ToList();

            var maxRounds = allScrambleNumbers.Count;

            return Ok(new { playerScores, maxRounds, matchupWins = wins, tournamentProgress });
        }


        private sealed record SavedTournamentProgress(int Completed, int Total, string Status);

        private static async Task<SavedTournamentProgress> TournamentProgress(DataContext db, int leagueId,
            IReadOnlyList<TournamentRound> rounds, IReadOnlyList<KingQueenTeam> teams)
        {
            var config = await db.TournamentConfigurations.AsNoTracking().SingleOrDefaultAsync(row => row.LeagueId == leagueId);
            var total = config?.RoundSettingsJson != null
                ? System.Text.Json.JsonSerializer.Deserialize<TournamentRoundSettings>(config.RoundSettingsJson).NumberOfRounds : 0;
            var matched = teams.ToLookup(team => team.ScrambleNumber);
            var completed = rounds.Count(round => Services.TournamentMatchupResults.IsComplete(matched[round.ScrambleNumber], round.GamesPerMatchup));
            return new SavedTournamentProgress(completed, total,
                Services.TournamentMatchupResults.TournamentStatus(total, rounds.Count, completed, config?.WorkflowStep ?? 1));
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

            // Display normalization must never persist from a public GET.

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
        [Authorize(Policy = "LeagueManagement")]
        [SameOrigin]
        public IActionResult DeletePlayer([FromBody] Player player, string leagueName)
        {
            var context = new DataContext();
            var league = context.Leagues.FirstOrDefault(l => l.LeagueName == leagueName);
            if (league == null)
                return NotFound("League not found.");
            if (!LeagueAccess.CanManage(User, context, league.ID))
                return Forbid();
            if (player == null)
                return BadRequest("Player is required.");

            var candidates = player.Id > 0 ? context.Players.Where(x => x.Id == player.Id).ToList() :
                context.Players.Where(x => x.FirstName == player.FirstName && x.LastName == player.LastName).ToList();
            if (candidates.Count > 1) return BadRequest("Select the player by ID; this name is ambiguous.");
            var playerExists = candidates.SingleOrDefault();
            if (playerExists == null)
                return NotFound("Player not found.");

            var playerLeaguesExist = context.PlayersLeagues.FirstOrDefault(x =>
                x.LeagueID == league.ID && x.PlayerID == playerExists.Id);
            if (playerLeaguesExist == null)
                return NotFound("Player is not assigned to this league.");

            context.PlayersLeagues.Remove(playerLeaguesExist);
            context.SaveChanges();

            return Ok(player);

        }

        [HttpPost("[action]/{leagueName}")]
        [SameOrigin]
        [Authorize]
        public async Task<IActionResult> AddNewLeague(string leagueName, [FromQuery] int eventTypeId = 1,
            [FromQuery] DateOnly? eventDate = null, [FromQuery] int? venueId = null)
        {
            if (!LeagueAccess.TryGetAccountId(User, out var ownerId))
                return Forbid();
            var isAdmin = User.IsInRole("Admin");
            if (eventTypeId != 2 && !isAdmin && !User.IsInRole("Manager")) return Forbid();

            leagueName = leagueName?.Trim();
            if (!ModelState.IsValid || string.IsNullOrEmpty(leagueName) || leagueName.Length > 50)
                return BadRequest(new { message = "Enter an event name of 50 characters or fewer and choose a valid event type and date." });

            await using var context = new DataContext();
            await using var transaction = await context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            if (eventTypeId == 2)
            {
                await context.Database.ExecuteSqlRawAsync(
                    "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='LeagueHub:TournamentCreation', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000, 'Tournament creation is busy. Please retry.', 1;");
                if (!isAdmin && await context.TournamentConfigurations.CountAsync(config => config.OwnerUserId == ownerId &&
                    context.Leagues.Any(league => league.ID == config.LeagueId && league.EventTypeId == 2)) >= TournamentsController.OwnedTournamentLimit)
                    return Conflict(new { message = "You have reached your limit of 3 tournaments. Contact an administrator if you need an existing tournament removed." });
            }
            if (!await context.EventTypes.AnyAsync(type => type.ID == eventTypeId))
                return BadRequest(new { message = "Choose a valid event type." });
            if (eventTypeId == 2 && !eventDate.HasValue)
                return BadRequest(new { message = "Choose a tournament date." });
            if (venueId.HasValue) await Services.FacilityIdentity.Lock(context);
            if (venueId.HasValue && (eventTypeId is not (1 or 2) ||
                !await FacilitiesController.Directory(context).AnyAsync(venue => venue.Id == venueId)))
                return BadRequest(new { message = "Choose an available facility." });
            var existing = await context.Leagues.FirstOrDefaultAsync(league => league.LeagueName == leagueName);
            if (existing != null)
                return LeagueAccess.CanManage(User, context, existing.ID)
                    ? Conflict(new { message = "A league with that name already exists." })
                    : Forbid();

            var league = new LeagueType { LeagueName = leagueName, EventTypeId = eventTypeId };
            context.Leagues.Add(league);
            await context.SaveChangesAsync();

            context.LeagueSettings.AddRange(
                new LeagueSettings { LeagueId = league.ID, SettingName = "subScorePercent", SettingValue = "50" },
                new LeagueSettings { LeagueId = league.ID, SettingName = "numberOfSubsAllowed", SettingValue = "100" },
                new LeagueSettings { LeagueId = league.ID, SettingName = "dropLowest", SettingValue = "0" },
                new LeagueSettings { LeagueId = league.ID, SettingName = "dayOfLeague", SettingValue = "Monday" });
            context.UserLeagues.Add(new UserLeague { LeagueTypeId = league.ID, UserId = ownerId });
            if (venueId.HasValue) context.EventFacilities.Add(new EventFacility { LeagueId = league.ID, VenueId = venueId.Value });
            if (eventTypeId == 2)
                context.TournamentConfigurations.Add(new TournamentConfiguration
                    { LeagueId = league.ID, EventDate = eventDate.Value, OwnerUserId = ownerId, WorkflowStep = 1, Version = Guid.NewGuid() });
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(league);
        }



    }
}

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

internal static class TournamentDeletionCheck
{
    public static async Task Run()
    {
        await using var db = new DataContext();
        Check(await db.Database.SqlQueryRaw<string>("SELECT DB_NAME() AS [Value]").SingleAsync() == "LeagueScramblerDev",
            "Only the Development database may be used.");
        var prefix = "DeleteCheck-" + Guid.NewGuid().ToString("N")[..16];
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var accounts = Enumerable.Range(1, 3).Select(role => new RegistrationModel
        {
            Email = $"{prefix}-{role}@example.invalid", Password = password, FirstName = "Deletion",
            LastName = "Development Fixture", UserRoleId = role
        }.ToUser()).ToArray();
        var shared = await db.PlayersLeagues.AsNoTracking().FirstAsync(row =>
            db.Leagues.Any(league => league.ID == row.LeagueID && league.EventTypeId == 1));
        var existingTournaments = await db.Leagues.Where(row => row.EventTypeId == 2)
            .OrderBy(row => row.ID).Select(row => row.ID).ToArrayAsync();
        var ids = new List<int>();
        int? crossScoreId = null;
        using var host = Allport_s_League_Scrambler.Program.CreateHostBuilder([])
            .UseEnvironment("TournamentTest")
            .ConfigureWebHost(web => web.UseUrls("https://127.0.0.1:0")
                .UseContentRoot(Path.GetFullPath("Allport's League Scrambler")))
            .ConfigureServices(services => services.AddDataProtection().UseEphemeralDataProtectionProvider())
            .ConfigureLogging(logging => logging.SetMinimumLevel(LogLevel.Error)).Build();
        await host.StartAsync();
        var origin = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>().Addresses.Single();
        using var admin = Client(origin);
        using var manager = Client(origin);
        using var player = Client(origin);
        using var anonymous = Client(origin);
        try
        {
            db.Users.AddRange(accounts);
            await db.SaveChangesAsync();
            foreach (var (client, account) in new[] { (admin, accounts[0]), (manager, accounts[1]), (player, accounts[2]) })
            {
                using var login = await client.PostAsJsonAsync("/api/Login/login", new { account.Email, password });
                login.EnsureSuccessStatusCode();
            }

            var empty = await Create(admin, "empty");
            var roster = await Create(manager, "roster");
            var generated = await Create(admin, "generated");
            var scored = await Create(admin, "scored");
            var historical = await Create(admin, "historical");
            var playerFirst = await Create(player, "player-1");
            var playerSecond = await Create(player, "player-2");
            var lastSlot = await Task.WhenAll(
                CreateRequest(player, "player-3a"), CreateRequest(player, "player-3b"));
            var lastResult = lastSlot.Single(response => response.StatusCode == HttpStatusCode.OK);
            Check(lastSlot.Count(response => response.StatusCode == HttpStatusCode.Conflict) == 1,
                "Concurrent requests did not bypass the final owner slot.");
            var playerThird = (await lastResult.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
            ids.Add(playerThird);
            foreach (var response in lastSlot) response.Dispose();
            Check(await db.Leagues.CountAsync(row => row.LeagueName.StartsWith(prefix + "-player-3")) == 1,
                "Rejected creation left no partial event.");
            var managerSecond = await Create(manager, "manager-2");
            var managerThird = await Create(manager, "manager-3");
            using (var limited = await CreateRequest(manager, "manager-4"))
                Check(limited.StatusCode == HttpStatusCode.Conflict, "Manager ownership limit.");
            using (var ordinaryCreation = await player.PostAsync($"/api/ScrambleData/AddNewLeague/{prefix}-ordinary?eventTypeId=1", null))
                Check(ordinaryCreation.StatusCode == HttpStatusCode.Forbidden, "Tournament ownership does not grant ordinary league creation.");
            foreach (var id in new[] { playerFirst, playerSecond, playerThird })
            {
                using var own = await player.GetAsync(Url(id));
                using var denied = await manager.GetAsync(Url(id) + "/round-settings");
                own.EnsureSuccessStatusCode();
                Check(denied.StatusCode == HttpStatusCode.Forbidden, "Another account cannot manage an owned tournament.");
            }
            using (var membership = await player.PostAsJsonAsync(
                $"/api/ScrambleData/AddPlayer/{prefix}-player-1?existingOnly=true&expectedLeagueId={playerFirst}",
                new { id = shared.PlayerID }))
                membership.EnsureSuccessStatusCode();
            var ownDetails = (await player.GetFromJsonAsync<JsonElement>(Url(playerFirst))).GetProperty("details");
            var version = ownDetails.GetProperty("version").GetGuid();
            var detailsChange = new { name = prefix + "-player-1", eventDate = "2027-01-27", description = "Owner update", version };
            using (var unauthorizedDetails = await manager.PutAsJsonAsync(Url(playerFirst) + "/details", detailsChange))
                Check(unauthorizedDetails.StatusCode == HttpStatusCode.Forbidden, "Another organizer cannot update details.");
            using (var unauthorizedRound = await player.GetAsync(Url(roster) + "/rounds"))
                Check(unauthorizedRound.StatusCode == HttpStatusCode.Forbidden, "An account without membership cannot read private rounds.");
            using (var unauthorizedScores = await player.PutAsJsonAsync(Url(roster) + "/rounds/1/scores", new
            {
                version, scores = new[] { new { teamId = 1, opponentId = 2, game = 1, points = 21, opponentPoints = 19 } }
            }))
                Check(unauthorizedScores.StatusCode == HttpStatusCode.Forbidden, "Ownership does not grant scoring access to another event.");
            using (var unauthorizedRoster = await manager.DeleteAsync(Url(playerFirst) + "/participants/" + shared.PlayerID))
                Check(unauthorizedRoster.StatusCode == HttpStatusCode.Forbidden, "Another organizer cannot remove participants.");
            using (var ownerUpdate = await player.PutAsJsonAsync(Url(playerFirst) + "/details", detailsChange))
                ownerUpdate.EnsureSuccessStatusCode();
            db.TournamentRounds.Add(new TournamentRound { LeagueId = playerSecond, RoundNumber = 1,
                ScrambleNumber = 1, GamesPerMatchup = 1, GenerationJson = "{}" });
            var home = new KingQueenTeam { LeagueID = playerSecond, ScrambleNumber = 1, DateOfTeam = DateTime.Today };
            var away = new KingQueenTeam { LeagueID = playerSecond, ScrambleNumber = 1, DateOfTeam = DateTime.Today };
            db.KingQueenTeam.AddRange(home, away);
            await db.SaveChangesAsync();
            var scoringVersion = await db.TournamentConfigurations.Where(row => row.LeagueId == playerSecond)
                .Select(row => row.Version).SingleAsync();
            using (var ownerScore = await player.PutAsJsonAsync(Url(playerSecond) + "/rounds/1/scores", new
            {
                version = scoringVersion,
                scores = new[] { new { teamId = home.Id, opponentId = away.Id, game = 1, points = 21, opponentPoints = 19 } }
            }))
                ownerScore.EnsureSuccessStatusCode();
            using (var list = await player.GetAsync("/api/tournaments/managed"))
                Check(list.Headers.GetValues("X-Owned-Tournament-Count").Single() == "3", "Owned count at limit.");
            await Delete(player, playerFirst, await Preview(admin, playerFirst), HttpStatusCode.Forbidden);
            await Delete(admin, playerFirst, await Preview(admin, playerFirst), HttpStatusCode.NoContent);
            using (var list = await player.GetAsync("/api/tournaments/managed"))
                Check(list.Headers.GetValues("X-Owned-Tournament-Count").Single() == "2", "Administrator deletion frees the owner slot.");
            var replacement = await Create(player, "player-new");
            foreach (var id in new[] { playerSecond, playerThird, replacement, managerSecond, managerThird })
                await Delete(admin, id, await Preview(admin, id), HttpStatusCode.NoContent);

            var externalDivision = new LeagueDivision { LeagueID = generated, Code = "EXT", Name = "External fixture division", SortOrder = 1 };
            db.LeagueDivision.Add(externalDivision);
            await db.SaveChangesAsync();
            db.PlayersLeagues.Add(new PlayersLeague { LeagueID = historical, PlayerID = shared.PlayerID, LeagueDivisionId = externalDivision.Id });
            await db.SaveChangesAsync();
            await db.TournamentConfigurations.Where(row => row.LeagueId == historical).ExecuteDeleteAsync();
            await Delete(admin, historical, await Preview(admin, historical), HttpStatusCode.NoContent);
            Check(await db.LeagueDivision.AnyAsync(row => row.Id == externalDivision.Id && row.LeagueID == generated),
                "Historical deletion preserved the external division definition.");
            foreach (var id in new[] { roster, generated, scored })
                db.PlayersLeagues.Add(new PlayersLeague { LeagueID = id, PlayerID = shared.PlayerID });
            foreach (var id in new[] { generated, scored })
            {
                db.TournamentRounds.Add(new TournamentRound { LeagueId = id, RoundNumber = 1, ScrambleNumber = 1,
                    GamesPerMatchup = 1, GenerationJson = "{}" });
                db.PlayerSignIn.Add(new PlayerSignIn { LeagueId = id, PlayerId = shared.PlayerID, DateTime = DateTime.Today });
                db.ByeRounds.Add(new ByeRounds { LeagueID = id, ScrambleNumber = 1, DateOfRound = DateTime.Today,
                    ByePlayers = [new ByePlayer { PlayerId = shared.PlayerID }] });
            }
            var scoredTeam = new KingQueenTeam { LeagueID = scored, ScrambleNumber = 1, DateOfTeam = DateTime.Today,
                ScrambleWithScoresToBeSaved = true, KingQueenPlayers = [new KingQueenPlayer { PlayerId = shared.PlayerID }],
                KingQueenRoundScores = [new KingQueenRoundScores { RoundId = 1, RoundScore = 21, RoundWon = true }] };
            db.KingQueenTeam.Add(scoredTeam);
            await db.SaveChangesAsync();
            var unrelatedMemberId = await db.PlayersLeagues.Where(row => row.LeagueID == generated)
                .Select(row => row.Id).SingleAsync();
            var score = new PlayerScore { PlayersLeagueID = unrelatedMemberId, KingQueenPlayerId = scoredTeam.KingQueenPlayers.Single().Id,
                Date = DateTime.Today };
            db.PlayerScore.Add(score);
            await db.SaveChangesAsync();
            crossScoreId = score.Id;

            var preview = await Preview(admin, scored);
            Check(preview.GetProperty("participants").GetInt32() == 1 &&
                preview.GetProperty("generated").GetInt32() == 1 && preview.GetProperty("hasScores").GetBoolean(),
                "Preview reports the roster, rounds and scores.");
            await Delete(manager, roster, await Preview(admin, roster), HttpStatusCode.Forbidden);
            await Delete(player, empty, await Preview(admin, empty), HttpStatusCode.Forbidden);
            await Delete(anonymous, empty, await Preview(admin, empty), HttpStatusCode.Unauthorized);
            using var ordinary = await admin.GetAsync(Url(shared.LeagueID) + "/deletion-preview");
            Check(ordinary.StatusCode == HttpStatusCode.NotFound, "Ordinary leagues are excluded.");
            await Delete(admin, shared.LeagueID, preview, HttpStatusCode.NotFound);
            await Delete(admin, scored, preview, HttpStatusCode.Conflict);
            Check(await db.KingQueenRoundScores.AnyAsync(row => row.KingQueenTeamId == scoredTeam.Id) &&
                await db.PlayerScore.AnyAsync(row => row.Id == crossScoreId) &&
                await db.TournamentRounds.AnyAsync(row => row.LeagueId == scored),
                "Conflict preserves both tournament and shared records.");
            await db.PlayerScore.Where(row => row.Id == crossScoreId).ExecuteDeleteAsync();
            crossScoreId = null;
            await Delete(admin, scored, preview, HttpStatusCode.Conflict);
            await Delete(admin, empty, await Preview(admin, empty), HttpStatusCode.BadRequest, "Wrong name");

            using var browser = Process.Start(new ProcessStartInfo("node", "tests/functional/scripts/tournament-deletion-live.cjs")
            {
                UseShellExecute = false, RedirectStandardInput = true
            });
            await browser.StandardInput.WriteAsync(JsonSerializer.Serialize(new { origin, password,
                adminEmail = accounts[0].Email, managerEmail = accounts[1].Email, playerEmail = accounts[2].Email,
                scored, scoredName = prefix + "-scored", rosterName = prefix + "-roster" }));
            browser.StandardInput.Close();
            await browser.WaitForExitAsync();
            Check(browser.ExitCode == 0, "Role, confirmation and responsive browser verification.");

            await Delete(admin, scored, await Preview(admin, empty), HttpStatusCode.NotFound);
            foreach (var id in new[] { empty, roster })
                await Delete(admin, id, await Preview(admin, id), HttpStatusCode.NoContent);
            var generatedPreview = await Preview(admin, generated);
            var concurrent = await Task.WhenAll(SendDelete(admin, generated, generatedPreview), SendDelete(admin, generated, generatedPreview));
            foreach (var response in concurrent) response.Dispose();
            Check(concurrent.Select(response => response.StatusCode).Order()
                .SequenceEqual(new[] { HttpStatusCode.NoContent, HttpStatusCode.NotFound }),
                "Only one of two simultaneous deletion requests succeeded.");
            Check(!await db.Leagues.AnyAsync(row => ids.Contains(row.ID)) &&
                !await db.PlayersLeagues.AnyAsync(row => ids.Contains(row.LeagueID)) &&
                !await db.PlayerSignIn.AnyAsync(row => ids.Contains(row.LeagueId)) &&
                !await db.ByeRounds.AnyAsync(row => ids.Contains(row.LeagueID)) &&
                !await db.KingQueenTeam.AnyAsync(row => ids.Contains(row.LeagueID)) &&
                !await db.KingQueenPlayer.AnyAsync(row => row.KingQueenTeamId == scoredTeam.Id) &&
                !await db.KingQueenRoundScores.AnyAsync(row => row.KingQueenTeamId == scoredTeam.Id) &&
                !await db.TournamentRounds.AnyAsync(row => ids.Contains(row.LeagueId)) &&
                !await db.TournamentConfigurations.AnyAsync(row => ids.Contains(row.LeagueId)),
                "Only owned records were removed.");
            Check(await db.Players.AnyAsync(row => row.Id == shared.PlayerID) &&
                await db.PlayersLeagues.AnyAsync(row => row.Id == shared.Id) &&
                await db.Leagues.AnyAsync(row => row.ID == shared.LeagueID),
                "Shared player and unrelated membership remain intact.");
            var preservedTournaments = await db.Leagues
                .Where(row => existingTournaments.Contains(row.ID) && row.EventTypeId == 2)
                .OrderBy(row => row.ID).Select(row => row.ID).ToArrayAsync();
            Check(existingTournaments.SequenceEqual(preservedTournaments),
                "Existing tournaments remain intact.");
            Console.WriteLine("Development tournament deletion API and database checks passed.");
        }
        finally
        {
            if (crossScoreId is int scoreId)
                await db.PlayerScore.Where(row => row.Id == scoreId).ExecuteDeleteAsync();
            var browserFixture = await db.Leagues.Where(row => row.EventTypeId == 2 && row.LeagueName == prefix + "-browser-created")
                .Select(row => row.ID).ToArrayAsync();
            ids.AddRange(browserFixture);
            foreach (var id in ids)
            {
                if (!await db.Leagues.AnyAsync(row => row.ID == id && row.LeagueName.StartsWith(prefix))) continue;
                await Delete(admin, id, await Preview(admin, id), HttpStatusCode.NoContent);
            }
            foreach (var account in accounts)
                await db.Users.Where(row => row.UserId == account.UserId && row.Email == account.Email).ExecuteDeleteAsync();
            await host.StopAsync();
        }

        async Task<int> Create(HttpClient client, string name)
        {
            using var response = await CreateRequest(client, name);
            response.EnsureSuccessStatusCode();
            var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
            ids.Add(id);
            return id;
        }

        Task<HttpResponseMessage> CreateRequest(HttpClient client, string name) =>
            client.PostAsync($"/api/ScrambleData/AddNewLeague/{prefix}-{name}?eventTypeId=2&eventDate=2027-01-27", null);
    }

    private static HttpClient Client(string origin)
    {
        var client = new HttpClient(new HttpClientHandler
        {
            AllowAutoRedirect = false,
            ServerCertificateCustomValidationCallback = (request, _, _, _) =>
                request.RequestUri.IsLoopback && request.RequestUri.GetLeftPart(UriPartial.Authority) == origin
        }) { BaseAddress = new Uri(origin) };
        client.DefaultRequestHeaders.Add("Origin", origin);
        return client;
    }

    private static string Url(int id) => $"/api/tournaments/{id}";

    private static Task<JsonElement> Preview(HttpClient client, int id) =>
        client.GetFromJsonAsync<JsonElement>(Url(id) + "/deletion-preview");

    private static async Task Delete(HttpClient client, int id, JsonElement preview, HttpStatusCode expected, string name = null)
    {
        using var response = await SendDelete(client, id, preview, name);
        Check(response.StatusCode == expected,
            $"Deletion of fixture {id}: expected {(int)expected}, got {(int)response.StatusCode}. {await response.Content.ReadAsStringAsync()}");
    }

    private static async Task<HttpResponseMessage> SendDelete(HttpClient client, int id, JsonElement preview, string name = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, Url(id)) { Content = JsonContent.Create(new
        {
            name = name ?? preview.GetProperty("name").GetString(),
            revision = preview.GetProperty("revision").GetString()
        }) };
        return await client.SendAsync(request);
    }

    private static void Check(bool condition, string description)
    {
        if (!condition) throw new InvalidOperationException(description);
    }
}


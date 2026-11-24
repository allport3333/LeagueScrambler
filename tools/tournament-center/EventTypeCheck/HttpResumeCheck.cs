using System.Diagnostics;
using System.IO;
using System;
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

internal static class HttpResumeCheck
{
    public static async Task Run(string prefix, int leagueId)
    {
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var manager = new RegistrationModel
        {
            Email = prefix + "@example.invalid", Password = password,
            FirstName = "Tournament", LastName = "Development Fixture", UserRoleId = 2
        }.ToUser();
        manager.LastLogin = DateTime.Now;
        await using var db = new DataContext();
        var selectedLeague = await db.Leagues.AsNoTracking().SingleAsync(row => row.ID == 37 && row.LeagueName == "WW Winter 2026" && row.EventTypeId == 1);
        var savedOwner = await db.TournamentConfigurations.Where(row => row.LeagueId == leagueId)
            .Select(row => row.OwnerUserId).SingleAsync();
        var selectedMemberships = await db.PlayersLeagues.Where(row => row.LeagueID == selectedLeague.ID)
            .OrderBy(row => row.PlayerID).Select(row => row.PlayerID).ToArrayAsync();
        db.Users.Add(manager);
        await db.SaveChangesAsync();
        try
        {
            db.UserLeagues.Add(new UserLeague { UserId = manager.UserId, LeagueTypeId = leagueId });
            db.UserLeagues.Add(new UserLeague { UserId = manager.UserId, LeagueTypeId = selectedLeague.ID });
            await db.SaveChangesAsync();
            Environment.SetEnvironmentVariable("SMTP_MODE", "smtp");
            for (var boot = 0; boot < 2; boot++)
            {
                using var host = Allport_s_League_Scrambler.Program.CreateHostBuilder(Array.Empty<string>())
                    .UseEnvironment("TournamentTest")
                    .ConfigureWebHost(web => web.UseUrls("https://127.0.0.1:0")
                        .UseContentRoot(Path.GetFullPath("Allport's League Scrambler")))
                    .ConfigureServices(services => services.AddDataProtection().UseEphemeralDataProtectionProvider())
                    .ConfigureLogging(logging => logging.ClearProviders()).Build();
                await host.StartAsync();
                try
                {
                    var origin = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>().Addresses.Single();
                    using var client = new HttpClient(new HttpClientHandler
                    {
                        AllowAutoRedirect = false,
                        ServerCertificateCustomValidationCallback = (request, _, _, _) =>
                            request.RequestUri.IsLoopback && request.RequestUri.GetLeftPart(UriPartial.Authority) == origin
                    }) { BaseAddress = new Uri(origin) };
                    client.DefaultRequestHeaders.Add("Origin", origin);
                    using var anonymous = await client.GetAsync($"/api/tournaments/{leagueId}/rounds");
                    if (anonymous.StatusCode != HttpStatusCode.Unauthorized) throw new InvalidOperationException("Anonymous rounds access was not denied.");
                    using var login = await client.PostAsJsonAsync("/api/Login/login", new { manager.Email, password });
                    login.EnsureSuccessStatusCode();
                    if (boot == 0)
                    {
                        using var denied = await client.GetAsync($"/api/tournaments/{leagueId}/round-settings");
                        if (denied.StatusCode != HttpStatusCode.Forbidden) throw new InvalidOperationException("A cross-owner management request was allowed.");
                        await db.TournamentConfigurations.Where(row => row.LeagueId == leagueId)
                            .ExecuteUpdateAsync(set => set.SetProperty(row => row.OwnerUserId, manager.UserId));
                    }
                    var settings = await client.GetFromJsonAsync<JsonElement>($"/api/tournaments/{leagueId}/round-settings");
                    if (settings.GetProperty("settings").GetProperty("numberOfRounds").GetInt32() != 5)
                        throw new InvalidOperationException("HTTP resume did not load five configured rounds.");
                    var saved = await client.GetFromJsonAsync<JsonElement>($"/api/tournaments/{leagueId}/rounds");
                    var rounds = saved.GetProperty("rounds");
                    if (rounds.GetArrayLength() != 5 || rounds[0].GetProperty("status").GetString() != "partial")
                        throw new InvalidOperationException("HTTP resume did not load the persisted round results.");
                    if (boot == 1)
                    {
                        await RunBrowser(origin, manager.Email, password, leagueId, false);
                        await db.Users.Where(row => row.UserId == manager.UserId && row.Email == manager.Email)
                            .ExecuteUpdateAsync(set => set.SetProperty(row => row.UserRoleId, 1));
                        await RunBrowser(origin, manager.Email, password, leagueId, true);
                    }
                }
                finally { await host.StopAsync(); }
            }
            var unchanged = await db.Leagues.AsNoTracking().SingleAsync(row => row.ID == selectedLeague.ID);
            var currentMemberships = await db.PlayersLeagues.Where(row => row.LeagueID == selectedLeague.ID)
                .OrderBy(row => row.PlayerID).Select(row => row.PlayerID).ToArrayAsync();
            if (!selectedMemberships.SequenceEqual(currentMemberships)) throw new InvalidOperationException("WW Winter 2026 membership changed.");
            if (unchanged.LeagueName != selectedLeague.LeagueName || unchanged.EventTypeId != selectedLeague.EventTypeId ||
                await db.TournamentConfigurations.AnyAsync(row => row.LeagueId == selectedLeague.ID))
                throw new InvalidOperationException("Creating a tournament changed WW Winter 2026.");
            Console.WriteLine("Authenticated HTTPS restart verification passed against the Development database.");
        }
        finally
        {
            await db.TournamentConfigurations.Where(row => row.LeagueId == leagueId && row.OwnerUserId == manager.UserId)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.OwnerUserId, savedOwner));
            await db.TournamentConfigurations.Where(row => row.OwnerUserId == manager.UserId &&
                db.Leagues.Any(eventRow => eventRow.ID == row.LeagueId && (eventRow.LeagueName == prefix + "-UI" || eventRow.LeagueName == prefix + "-ADMIN")))
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.OwnerUserId, (int?)null));
            await db.UserLeagues.Where(link => link.UserId == manager.UserId).ExecuteDeleteAsync();
            await db.Users.Where(user => user.UserId == manager.UserId && user.Email == manager.Email).ExecuteDeleteAsync();
        }
    }
    private static async Task RunBrowser(string origin, string email, string password, int leagueId, bool administrator)
    {
        using var process = Process.Start(new ProcessStartInfo("node", "tests/functional/scripts/tournament-center-live.cjs")
        {
            UseShellExecute = false, RedirectStandardInput = true
        });
        await process.StandardInput.WriteAsync(JsonSerializer.Serialize(new { origin, email, password, leagueId, administrator }));
        process.StandardInput.Close();
        await process.WaitForExitAsync();
        if (process.ExitCode != 0) throw new InvalidOperationException("The SQL-backed browser check did not complete.");
    }
}
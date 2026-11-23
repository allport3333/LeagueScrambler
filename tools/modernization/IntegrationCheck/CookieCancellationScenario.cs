using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Allport_s_League_Scrambler;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

internal static class CookieCancellationScenario
{
    private static void Need(bool condition, string check)
    {
        if (!condition) throw new InvalidOperationException(check);
        Console.WriteLine("PASS " + check);
    }

    private static TaskCompletionSource<bool> Signal() => new(TaskCreationOptions.RunContinuationsAsynchronously);

    private static bool HasSqlException(Exception error)
    {
        while (error != null)
        {
            if (error is SqlException) return true;
            error = error.InnerException;
        }
        return false;
    }

    public static async Task Run()
    {
        const string disconnectedSql = "Server=127.0.0.1,1;Database=LeagueScramblerDev;Integrated Security=true;Connect Timeout=1";
        Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION", disconnectedSql);
        using (var canceled = new CancellationTokenSource())
        {
            canceled.Cancel();
            await using var db = new DataContext();
            Exception observed = null;
            try
            {
                await db.Users.AsNoTracking().Where(user => user.UserId == 1)
                    .Select(user => new { user.UserRoleId }).SingleOrDefaultAsync(canceled.Token);
            }
            catch (OperationCanceledException error) { observed = error; }
            Need(observed is TaskCanceledException, "original EF query reproduces TaskCanceledException with an aborted token");
        }

        var entered = Signal();
        var completed = Signal();
        var controls = new CancellationFilter(entered, completed);
        var source = Path.GetFullPath("Allport's League Scrambler");
        var calls = 0;
        var role = "Admin";
        var mode = "";
        using var host = Allport_s_League_Scrambler.Program.CreateHostBuilder(Array.Empty<string>())
            .UseEnvironment("Staging")
            .ConfigureLogging(logging => logging.ClearProviders())
            .ConfigureWebHost(web => web.UseEnvironment("Staging").UseContentRoot(source).UseUrls("http://127.0.0.1:0")
                .UseSetting(WebHostDefaults.ApplicationKey, typeof(Startup).Assembly.FullName))
            .ConfigureServices(services =>
            {
                var sqlLookup = (AccountRoleLookup)services.Last(item => item.ServiceType == typeof(AccountRoleLookup)).ImplementationInstance;
                services.AddSingleton<IStartupFilter>(controls);
                services.AddDataProtection().UseEphemeralDataProtectionProvider();
                services.AddControllers().AddApplicationPart(typeof(CookieCancellationFixtureController).Assembly);
                services.AddSingleton<AccountRoleLookup>(async (user, token) =>
                {
                    Interlocked.Increment(ref calls);
                    if (mode == "abort")
                    {
                        entered.TrySetResult(true);
                        await Task.Delay(Timeout.Infinite, token);
                    }
                    try
                    {
                        if (mode == "sql") return await sqlLookup(user, token);
                        if (mode == "timeout") throw new TimeoutException("Test-only lookup timeout.");
                        if (mode == "other-cancellation") throw new TaskCanceledException("Test-only independent cancellation.");
                    }
                    catch (Exception error) { controls.LookupFailure = error; throw; }
                    return role;
                });
            }).Build();
        Need(Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION") == disconnectedSql, "failure probe uses only the isolated loopback SQL target");
        await host.StartAsync();
        var url = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>().Addresses.Single();
        var cookieOptions = host.Services.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<CookieAuthenticationOptions>>().Get("Cookies");
        var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "1"), new Claim(ClaimTypes.Role, "Admin") }, "Cookies");
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity),
            new AuthenticationProperties { IssuedUtc = DateTimeOffset.UtcNow, ExpiresUtc = DateTimeOffset.UtcNow.AddHours(1) }, "Cookies");
        using var client = new HttpClient(new HttpClientHandler { UseCookies = false }) { BaseAddress = new Uri(url) };
        var cookie = cookieOptions.Cookie.Name + "=" + cookieOptions.TicketDataFormat.Protect(ticket);
        async Task<HttpResponseMessage> Request(string path, HttpMethod method = null, CancellationToken token = default)
        {
            using var request = new HttpRequestMessage(method ?? HttpMethod.Get, path);
            request.Headers.Add("Cookie", cookie);
            return await client.SendAsync(request, token);
        }

        foreach (var path in new[] { "/api/Statistics/AddTeam", "/api/Statistics/AddPlayerToLeagueTeam?leagueTeamId=11&playerId=21&leagueId=101" })
        {
            using (var anonymous = await client.PostAsync(path, null))
                Need(anonymous.StatusCode == HttpStatusCode.Unauthorized, "team write rejects anonymous request");
            role = "Player";
            using (var player = await Request(path, HttpMethod.Post))
                Need(player.StatusCode == HttpStatusCode.Forbidden, "team write rejects ordinary account");
        }
        role = "Admin";
        calls = 0;
        using (var response = await Request("/scrambler"))
            Need(response.StatusCode == HttpStatusCode.OK && calls == 0, "SPA deep-link shell skips the account lookup");
        using (var response = await Request("/api/cookie-cancellation-fixture"))
            Need(response.StatusCode == HttpStatusCode.OK && calls == 1, "Admin authorization validates once for the request");
        role = "Manager";
        using (var response = await Request("/api/Login/GetUsersRole"))
            Need((await response.Content.ReadAsStringAsync()).Contains("\"Manager\""), "existing cookie observes a current Manager role");
        using (var response = await Request("/api/cookie-cancellation-fixture"))
            Need(response.StatusCode == HttpStatusCode.OK, "Manager still satisfies the management policy");
        role = "Player";
        using (var response = await Request("/api/cookie-cancellation-fixture"))
            Need(response.StatusCode == HttpStatusCode.Forbidden, "role demotion takes effect on the next protected request");
        role = null;
        using (var response = await Request("/api/cookie-cancellation-fixture"))
            Need(response.StatusCode == HttpStatusCode.Unauthorized, "missing account invalidates the request principal");
        role = "Admin";
        foreach (var failure in new[] { "timeout", "other-cancellation", "sql" })
        {
            mode = failure;
            controls.LookupFailure = null;
            using var response = await Request("/api/cookie-cancellation-fixture");
            Need(response.StatusCode == HttpStatusCode.InternalServerError &&
                (failure == "timeout" && controls.LookupFailure is TimeoutException ||
                 failure == "other-cancellation" && controls.LookupFailure is TaskCanceledException ||
                 failure == "sql" && HasSqlException(controls.LookupFailure)),
                failure + " surfaces as an error without authorizing the request");
        }

        mode = "abort";
        controls.Failure = null;
        using (var clientAbort = new CancellationTokenSource())
        {
            var pending = Request("/api/cookie-cancellation-fixture", token: clientAbort.Token);
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            clientAbort.Cancel();
            try { using var response = await pending; }
            catch (OperationCanceledException) when (clientAbort.IsCancellationRequested) { }
            await completed.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Need(controls.Failure == null && controls.AbortedPrincipalRejected, "disconnected HTTP request finishes without exception or accepted principal");
        }
        mode = "";
        using (var response = await Request("/api/cookie-cancellation-fixture"))
            Need(response.StatusCode == HttpStatusCode.OK, "a later request revalidates the same session normally");
        using (var response = await Request("/api/Login/logout", HttpMethod.Post))
            Need(response.StatusCode == HttpStatusCode.OK &&
                response.Headers.TryGetValues("Set-Cookie", out var cookies) &&
                cookies.Any(value => value.StartsWith(cookieOptions.Cookie.Name + "=;", StringComparison.Ordinal)),
                "logout expires the normal account cookie after aborted navigation");
        await host.StopAsync();
    }

    private sealed class CancellationFilter(TaskCompletionSource<bool> entered, TaskCompletionSource<bool> completed) : IStartupFilter
    {
        public Exception Failure { get; set; }
        public Exception LookupFailure { get; set; }
        public bool AbortedPrincipalRejected { get; private set; }
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, continuation) =>
            {
                try { await continuation(); }
                catch (Exception error) { Failure = error; throw; }
                finally
                {
                    if (entered.Task.IsCompleted && context.RequestAborted.IsCancellationRequested)
                    {
                        AbortedPrincipalRejected = context.User.Identity?.IsAuthenticated != true;
                        completed.TrySetResult(true);
                    }
                }
            });
            next(app);
        };
    }
}

[Route("api/cookie-cancellation-fixture")]
[Authorize(Policy = "LeagueManagement")]
public sealed class CookieCancellationFixtureController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok();
}

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Authentication.Google;
using System.Net;
using System.Text.Json;
using Allport_s_League_Scrambler;
using Allport_s_League_Scrambler.Pickup;

if (!PickupEnvironment.Requested || !PickupEnvironment.DisposableTest ||
    Environment.GetEnvironmentVariable("ASPNETCORE_URLS") != "https://localhost:5003")
    throw new InvalidOperationException("Only the disposable Pickup test profile can run the Google fixture.");

Allport_s_League_Scrambler.Program.CreateHostBuilder(args)
    .ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string>
    {
        ["Authentication:Google:ClientId"] = "fixture-client",
        ["Authentication:Google:ClientSecret"] = "fixture-value"
    }))
    .ConfigureServices(services =>
    {
        services.AddSingleton<IStartupFilter, GoogleFixtureAuthorization>();
        services.AddControllers().AddApplicationPart(typeof(Startup).Assembly);
        services.PostConfigure<GoogleOptions>(GoogleDefaults.AuthenticationScheme, options =>
        {
            options.AuthorizationEndpoint = "https://localhost:5003/api/google-fixture/authorize";
            options.Backchannel = new HttpClient(new GoogleFixtureBackchannel());
        });
    })
    .Build().Run();

sealed class GoogleFixtureBackchannel : HttpMessageHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.Method == HttpMethod.Post && request.RequestUri.Host == "oauth2.googleapis.com")
        {
            var form = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(await request.Content.ReadAsStringAsync(cancellationToken));
            if (!form.TryGetValue("code", out var code) || string.IsNullOrEmpty(form["code_verifier"]))
                return new HttpResponseMessage(HttpStatusCode.BadRequest);
            return Json(new { access_token = code.ToString(), token_type = "Bearer", expires_in = 300, refresh_token = "fixture-token" });
        }

        var token = request.Headers.Authorization?.Parameter;
        var parts = token?.Split(':');
        if (request.Method == HttpMethod.Get && request.RequestUri.Host == "www.googleapis.com" && parts is { Length: 2 } &&
            Guid.TryParseExact(parts[1], "N", out _))
        {
            var (subject, email) = parts[0] switch
            {
                "existing" => ("existing-" + parts[1], "existing-" + parts[1]),
                "new" => ("new-" + parts[1], "new-" + parts[1]),
                "new-changed" => ("new-" + parts[1], "changed-" + parts[1]),
                _ => (null, null)
            };
            if (subject != null)
                return Json(new { id = subject, email = email + "@example.invalid", verified_email = true,
                    given_name = "Fixture", family_name = "Google", name = "Fixture Google" });
        }
        throw new InvalidOperationException("Unexpected fixture OAuth request.");
    }

    private static HttpResponseMessage Json(object payload) => new(HttpStatusCode.OK)
        { Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json") };
}

sealed class GoogleFixtureAuthorization : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Map("/api/google-fixture/authorize", fixture => fixture.Run(context =>
        {
            var query = context.Request.Query;
            if (query["redirect_uri"] != "https://localhost:5003/signin-google" ||
                query["scope"] != "openid email profile" || query["code_challenge_method"] != "S256" ||
                string.IsNullOrEmpty(query["state"]))
            {
                context.Response.StatusCode = 400;
                return Task.CompletedTask;
            }
            var choice = context.Request.Cookies["google-fixture-choice"];
            var callback = QueryHelpers.AddQueryString("/signin-google", "state", query["state"].ToString());
            context.Response.Redirect(choice == "cancel" || choice == null
                ? QueryHelpers.AddQueryString(callback, "error", "access_denied")
                : QueryHelpers.AddQueryString(callback, "code", choice));
            return Task.CompletedTask;
        }));
        next(app);
    };
}

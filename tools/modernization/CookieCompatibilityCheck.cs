// Offline synthetic ticket compatibility. These keys are isolated from every real application.
using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class CookieCompatibilityCheck
{
    const string Application = "LeagueHubModernizationSyntheticCookieFixture";
    static readonly string[] Schemes = { "Cookies", "LeagueAdminPassword" };
    static void Need(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
    static string Workspace()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory }) {
            for (var directory = new DirectoryInfo(start); directory != null; directory = directory.Parent)
                if (File.Exists(Path.Combine(directory.FullName, ".git")) || Directory.Exists(Path.Combine(directory.FullName, ".git"))) return directory.FullName;
        }
        throw new InvalidOperationException("Run cookie fixtures inside the repository checkout.");
    }

    public static void Run(string output, string baseline)
    {
        // Use an explicit artifact-only key ring; never locate a real IIS/user key ring.
        var baselineData = baseline == null ? null : JObject.Parse(File.ReadAllText(baseline));
        var version = typeof(CookieAuthenticationOptions).Assembly.GetName().Version;
        var artifactRoot = Path.GetFullPath(Path.Combine(Workspace(), "tests/functional/artifacts/modernization")) + Path.DirectorySeparatorChar;
        var keyDirectory = baselineData == null ? Path.Combine(artifactRoot, "cookie-compatibility-fixtures", "v" + version.Major, "synthetic-cookie-keys") : (string)baselineData["keyDirectory"];
        keyDirectory = Path.GetFullPath(keyDirectory);
        Need(keyDirectory.StartsWith(artifactRoot, StringComparison.OrdinalIgnoreCase) && keyDirectory.EndsWith("synthetic-cookie-keys", StringComparison.Ordinal), "Only this checkout's synthetic modernization artifact key ring is permitted.");
        if (baselineData != null) {
            Need((string)baselineData["application"] == Application, "Unexpected cookie fixture application.");
            Need(new Version((string)baselineData["cookieAssemblyVersion"]).Major == 2, "Expected an actual legacy cookie fixture.");
        }
        Directory.CreateDirectory(keyDirectory);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keyDirectory)).SetApplicationName(Application);
        var authentication = services.AddAuthentication("Cookies");
        foreach (var scheme in Schemes) authentication.AddCookie(scheme);
        using (var provider = services.BuildServiceProvider()) {
            var options = provider.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>();
            var fixtures = new JArray();
            foreach (var scheme in Schemes) {
                var format = options.Get(scheme).TicketDataFormat;
                var properties = new AuthenticationProperties { IssuedUtc = DateTimeOffset.UtcNow, ExpiresUtc = DateTimeOffset.UtcNow.AddHours(1), IsPersistent = true };
                var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] {
                    new Claim(ClaimTypes.NameIdentifier, "not-a-real-account"), new Claim(ClaimTypes.Role, "FrameworkFixtureRole")
                }, scheme));
                var ticket = new AuthenticationTicket(principal, properties, scheme);
                var encoded = baselineData == null ? format.Protect(ticket)
                    : (string)((JArray)baselineData["tickets"]).Single(t => (string)t["scheme"] == scheme)["protectedTicket"];
                var decoded = format.Unprotect(encoded);
                Need(decoded != null && decoded.AuthenticationScheme == scheme && decoded.Principal.FindFirst(ClaimTypes.NameIdentifier).Value == "not-a-real-account" && decoded.Principal.IsInRole("FrameworkFixtureRole"), "Synthetic cookie ticket is incompatible.");
                var changed = encoded.Substring(0, 10) + (encoded[10] == 'A' ? 'B' : 'A') + encoded.Substring(11);
                Need(format.Unprotect(changed) == null, "Tampered cookie accepted.");
                var other = options.Get(Schemes.Single(s => s != scheme)).TicketDataFormat;
                Need(other.Unprotect(encoded) == null, "Cookie schemes are not isolated.");
                fixtures.Add(new JObject { ["scheme"] = scheme, ["protectedTicket"] = encoded });
            }
            var result = new { application = Application, keyDirectory, cookieAssemblyVersion = version.ToString(),
                mode = baselineData == null ? "current runtime fixture capture and self-check" : "legacy ticket acceptance by current runtime", tickets = fixtures,
                note = "Synthetic-only key ring and invalid account identity. No real cookies, accounts, database writes or HTTP requests. Does not establish IIS key configuration or middleware expiration behavior." };
            File.WriteAllText(Path.Combine(output, "synthetic-cookie-fixtures.json"), JsonConvert.SerializeObject(result, Formatting.Indented));
        }
    }
}

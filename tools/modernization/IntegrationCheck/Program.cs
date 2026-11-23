// Isolated real Kestrel/Startup/SQL read integration. Never creates accounts or memberships.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Allport_s_League_Scrambler;
using Allport_s_League_Scrambler.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal sealed class ReadOnlyFilter : IStartupFilter
{
 public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app => {
  app.Use(async (context, continuation) => {
   // Test-host boundary only. The production application and its authorization are unchanged.
   if (context.Request.Method != "GET" && context.Request.Method != "HEAD" &&
       !(context.Request.Method == "POST" && context.Request.Path == "/api/Login/logout")) {
    context.Response.StatusCode = 405; return;
   }
   await continuation();
  });
  next(app);
 };
}
internal static class IntegrationCheck
{
 const string Origin = "https://localhost:5443";
 static void Need(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
 static string Hash(JToken token) {
  JToken Sort(JToken item) => item is JObject obj ? new JObject(obj.Properties().OrderBy(p => p.Name, StringComparer.Ordinal).Select(p => new JProperty(p.Name, Sort(p.Value)))) :
   item is JArray array ? new JArray(array.Select(Sort)) : item.DeepClone();
  return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Sort(token).ToString(Formatting.None))));
 }
 static HttpClient Client() => new HttpClient(new HttpClientHandler {
  AllowAutoRedirect = false, UseCookies = false,
  ServerCertificateCustomValidationCallback = (request, certificate, chain, errors) => request.RequestUri.Host == "localhost" && request.RequestUri.Port == 5443
 }) { BaseAddress = new Uri(Origin), Timeout = TimeSpan.FromSeconds(30) };
 static async Task Main(string[] args) {
  try { await Run(args); } catch (Exception error) {
   // No exception messages, HTTP response payloads, cookies, SQL parameters or credentials in diagnostics.
   Console.Error.WriteLine("Integration failed: " + error.GetType().Name);
   Console.Error.WriteLine(error.StackTrace); Environment.ExitCode = 1;
  }
 }
 static async Task Run(string[] args) {
  if (args.Length is >= 1 and <= 3 && args[0] == "--verify-team-development") {
   await TeamVerification.Run(args, Run);
   return;
  }
  if (args.Length == 1 && args[0] == "--smtp-config-check")
  {
   await MailTransportScenario.CheckStartup();
   return;
  }
  if (args.Length == 2 && args[0] == "--smtp-probe")
  {
   await MailTransportScenario.LiveProbe(args[1]);
   return;
  }
  if (args.Length == 1 && args[0] == "--mail-transport")
  {
   await MailTransportScenario.Run();
   return;
  }
  if (args.Length == 1 && args[0] == "--cookie-cancellation") {
   await CookieCancellationScenario.Run();
   return;
  }
  Need(args.Length == 2 || args.Length == 3 && (args[2] == "--serve" || args[2] == "--development" || args[2] == "--authorized-development" || args[2] == "--cleanup-authorized" || args[2] == "--team-authorization" || args[2] == "--cleanup-team-authorization" || args[2] == "--recovery-search"), "Pass Development env path, artifact directory and supported test mode.");
  var recoverySearch = args.Length == 3 && args[2] == "--recovery-search";
  var development = args.Length == 3 && args[2] == "--development";
  var focused = args.Length == 3 && (args[2] == "--team-authorization" || args[2] == "--cleanup-team-authorization");
  var authorized = focused || args.Length == 3 && args[2] == "--authorized-development";
  var cleanup = args.Length == 3 && (args[2] == "--cleanup-authorized" || args[2] == "--cleanup-team-authorization");
  var root = Directory.GetCurrentDirectory();
  Need(File.Exists(Path.Combine(root, "tools/modernization/STATUS.md")), "Run from modernization root.");
  var output = Path.GetFullPath(args[1]);
  Need(output.StartsWith(Path.GetFullPath(Path.Combine(root, "tests/functional/artifacts/modernization")) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && (cleanup ? Directory.Exists(output) : !Directory.Exists(output)), "Use an appropriate modernization artifact directory.");
  var source = Path.Combine(root, "Allport's League Scrambler");
  Need(focused || recoverySearch || File.Exists(Path.Combine(source, "ClientApp/dist/browser/index.html")), "Copy the verified browser assets first.");
  var line = File.ReadLines(Path.GetFullPath(args[0])).Single(x => x.TrimStart().StartsWith("LEAGUESCRAMBLER_DB_CONNECTION=", StringComparison.Ordinal));
  var connection = new SqlConnectionStringBuilder(line.Substring(line.IndexOf('=') + 1).Trim().Trim('"', '\''));
  Need(connection.DataSource == "localhost" && connection.InitialCatalog == "LeagueScramblerDev" && connection.IntegratedSecurity &&
   string.IsNullOrEmpty(connection.UserID) && string.IsNullOrEmpty(connection.Password) && string.IsNullOrEmpty(connection.AttachDBFilename), "Refusing SQL target.");
  if (focused || recoverySearch) connection.DataSource = "lpc:localhost";
  connection.TrustServerCertificate = true; // Verified local test certificate only; never production configuration.
  Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION", connection.ConnectionString);
  Environment.SetEnvironmentVariable("SMTP_SERVER", "localhost");
  Environment.SetEnvironmentVariable("SMTP_PORT", "25252");
  Environment.SetEnvironmentVariable("SMTP_USERNAME", "");
  Environment.SetEnvironmentVariable("SMTP_PASSWORD", "");
  using (var context = new DataContext()) {
   context.Database.OpenConnection();
   using var command = context.Database.GetDbConnection().CreateCommand();
   command.CommandText = "SELECT DB_NAME(), CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')), CONVERT(int,compatibility_level) FROM sys.databases WHERE database_id=DB_ID()";
   using var reader = command.ExecuteReader();
   Need(reader.Read() && reader.GetString(0) == "LeagueScramblerDev" && reader.GetString(1).Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase) && reader.GetInt32(2) == 130, "Runtime SQL identity mismatch.");
   reader.Close();
   command.CommandText = "SELECT CASE WHEN COL_LENGTH(N'dbo.User', N'SessionVersion') IS NOT NULL AND OBJECT_ID(N'dbo.AccountRecoveryRequest', N'U') IS NOT NULL THEN 1 ELSE 0 END";
   if (!recoverySearch) Need((int)command.ExecuteScalar() == 1, "Development account-recovery schema is missing. See the recovery runbook.");
  }
  Directory.CreateDirectory(output);
  if (cleanup) { DevelopmentAuthorization.Configure(args[0], Path.Combine(output, "cleanup-recovery-results.json"), focused); AuthenticatedScenario.RecoverCleanup(root, output); return; }
  if (authorized) DevelopmentAuthorization.Configure(args[0], Path.Combine(output, "authorized-results.json"), focused);
  var pickup = Path.Combine(output, "smtp-pickup"); Directory.CreateDirectory(pickup);
  Environment.SetEnvironmentVariable("SMTP_MODE", "pickup");
  Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_VERIFICATION_KEY", Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
  Environment.SetEnvironmentVariable("SMTP_PICKUP_DIRECTORY", pickup);
  var keyring = Path.Combine(output, "synthetic-cookie-keys"); Directory.CreateDirectory(keyring);
  // Staging pipeline serves the compiled production SPA; SQL remains the guarded Development database.
  // No real key ring, SMTP connection, account password or role is read or modified.
  using var loopbackKey = (focused || recoverySearch) ? System.Security.Cryptography.RSA.Create(2048) : null;
  using var loopbackCertificate = (focused || recoverySearch)
   ? new System.Security.Cryptography.X509Certificates.CertificateRequest("CN=localhost", loopbackKey,
      System.Security.Cryptography.HashAlgorithmName.SHA256, System.Security.Cryptography.RSASignaturePadding.Pkcs1)
      .CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddHours(1))
   : null;
  using var host = Allport_s_League_Scrambler.Program.CreateHostBuilder(Array.Empty<string>())
   .UseEnvironment(development ? "Development" : "Staging")
   .ConfigureLogging(logging => { logging.ClearProviders(); if (authorized) logging.AddProvider(new SanitizedExceptionLogger(Path.Combine(output, "server-exception-types.log"))); })
   .ConfigureWebHost(web => web.UseEnvironment(development ? "Development" : "Staging").UseContentRoot(source).UseSetting(WebHostDefaults.ApplicationKey, typeof(Startup).Assembly.FullName).UseUrls(Origin).ConfigureKestrel(options => {
    if (focused || recoverySearch) options.ConfigureHttpsDefaults(https => https.ServerCertificate = loopbackCertificate);
   }))
   .ConfigureServices(services => {
    services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keyring)).SetApplicationName("LeagueHubModernizationReadOnlyHttpFixtures");
    if (!authorized) services.AddSingleton<IStartupFilter, ReadOnlyFilter>();
   }).Build();
  var smtp = host.Services.GetRequiredService<SmtpClient>(); smtp.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory; smtp.PickupDirectoryLocation = pickup; smtp.EnableSsl = false;
  Need(host.Services.GetRequiredService<IWebHostEnvironment>().EnvironmentName == (development ? "Development" : "Staging"), "Unexpected effective web hosting environment.");
  Need(Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION") == connection.ConnectionString, "Startup changed the guarded SQL target.");
  await host.StartAsync();
  try {
   if (authorized) { await AuthenticatedScenario.Run(root, output, smtp, focused); return; }
   if (recoverySearch)
   {
    await VerifyPublicRecoverySearch(output);
    return;
   }
   var checks = new List<object>();
   var options = host.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>();
   string Cookie(string scheme, string role, bool expired = false) {
    var now = DateTimeOffset.UtcNow;
    var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "-90220001"), new Claim(ClaimTypes.Role, role) }, scheme);
    var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), new AuthenticationProperties {
     IssuedUtc = now.AddMinutes(-5), ExpiresUtc = expired ? now.AddMinutes(-1) : now.AddMinutes(20)
    }, scheme);
    return options.Get(scheme).Cookie.Name + "=" + options.Get(scheme).TicketDataFormat.Protect(ticket);
   }
   using var client = Client();
   if (development) client.Timeout = TimeSpan.FromMinutes(3);
   async Task<JToken> Get(string path, int status, string cookie = null, string digest = null) {
    using var request = new HttpRequestMessage(HttpMethod.Get, path);
    if (cookie != null) request.Headers.Add("Cookie", cookie);
    using var response = await client.SendAsync(request);
    Need((int)response.StatusCode == status, "Unexpected HTTP status for " + path + ": " + (int)response.StatusCode);
    var text = await response.Content.ReadAsStringAsync();
    var json = text.Length == 0 ? JValue.CreateNull() : JToken.Parse(text);
    if (digest != null) Need(Hash(json) == digest, "Wire JSON differs from legacy for " + path);
    checks.Add(new { path, status, legacyDigestMatched = digest != null }); return json;
   }
   var admin = Cookie("Cookies", "Admin");
   const string retiredCookie = "LeagueScrambler.Admin=retired-cookie-placeholder";
   var ordinary = Cookie("Cookies", "Player");
   var manager = Cookie("Cookies", "Manager");
   foreach (var id in new[] { 37, 133 }) {
    foreach (var path in new[] { "/api/ScheduleManagement/" + id, "/api/ScrambleData/AvailableLeaguePlayers/" + id + "?includeMembers=true&membersOnly=true" }) {
     // Signed tickets with no valid account must not grant any role.
     await Get(path, 401); await Get(path, 401, ordinary); await Get(path, 401, manager);
     await Get(path, 401, admin); await Get(path, 401, retiredCookie); await Get(path, 401, Cookie("Cookies", "Admin", true));
    }
   }
   var baseline = JObject.Parse(File.ReadAllText(Path.Combine(root, "tests/functional/artifacts/modernization/legacy-query-results.json")));
   string Digest(string name) => (string)((JArray)baseline["entries"]).Single(e => (string)e["Query"] == name)["OrderedDigest"];
   foreach (var id in new[] { 37, 133 }) {
    await Get("/api/Statistics/league-standings/" + id, 200, null, Digest("league-" + id + "/team-standings"));
    await Get("/api/Statistics/GetLeagueSchedule/" + id, 200, null, Digest("league-" + id + "/public-schedule"));
    await Get("/api/ScrambleData/TeammateHistory/" + id, 200, null, Digest("league-" + id + "/history"));
   }
   var invalidAccount = await Get("/api/Login/isauthenticated", 200, admin);
   Need(!(bool)invalidAccount, "A signed cookie without a valid account authenticated.");
   var auth = await Get("/api/Login/isauthenticated", 200); Need(!(bool)auth, "Anonymous authenticated.");
   using (var request = new HttpRequestMessage(HttpMethod.Post, "/api/Login/logout")) {
    request.Headers.Add("Cookie", admin + "; " + retiredCookie);
    using var response = await client.SendAsync(request); Need(response.StatusCode == HttpStatusCode.OK, "Logout failed.");
    var cleared = response.Headers.GetValues("Set-Cookie").ToArray();
    Need(cleared.Any(c => c.StartsWith(options.Get("Cookies").Cookie.Name + "=;")), "Logout did not clear the account session.");
    checks.Add(new { path = "/api/Login/logout", status = 200, accountCookieCleared = true });
   }
   foreach (var path in development ? new[] { "/", "/fetch-data", "/scrambler", "/league-management", "/resetpassword" } : new[] { "/", "/fetch-data", "/scrambler", "/league-management", "/resetpassword", "/manifest.webmanifest", "/ngsw.json", "/ngsw-worker.js" }) {
    using var response = await client.GetAsync(path); Need(response.StatusCode == HttpStatusCode.OK, "SPA/static route unavailable: " + path);
    if (path.StartsWith("/ngsw") || path.Contains("manifest")) Need(response.Headers.CacheControl?.NoCache == true, "Worker metadata cache policy changed.");
    checks.Add(new { path, status = 200 });
   }
   Need(!Directory.GetFiles(pickup).Any(), "Unexpected email generated.");
   File.WriteAllText(Path.Combine(output, "http-results.json"), JsonConvert.SerializeObject(new { pass = true, realKestrel = true, realStartup = true, realSqlReads = true, syntheticAuthenticationOnly = true, databaseWrites = false, environment = (development ? "Development CLI proxy" : "Staging compiled SPA") + " / guarded Development SQL", checks }, Formatting.Indented));
   Console.WriteLine("PASS: real public HTTP/SQL reads, retired-cookie and invalid-account rejection, logout and compiled SPA/PWA hosting (" + checks.Count + " checks).");
   if (args.Length == 3) {
    File.WriteAllText(Path.Combine(output, "browser-fixture.json"), JsonConvert.SerializeObject(new { origin = Origin, syntheticOnly = true }));
    Console.WriteLine("READONLY_INTEGRATION_READY");
    var deadline = DateTime.UtcNow.AddMinutes(15);
    while (DateTime.UtcNow < deadline && !File.Exists(Path.Combine(output, "stop-request"))) await Task.Delay(250);
   }
  } finally { await host.StopAsync(); }
 }
 static async Task VerifyPublicRecoverySearch(string output)
 {
  using var client = Client();
  async Task<JObject> Search(string name, int page = 0)
  {
   using var response = await client.GetAsync("/api/account-recovery/profiles?search=" + Uri.EscapeDataString(name) + "&page=" + page);
   Console.WriteLine($"Recovery lookup HTTP {(int)response.StatusCode}, type {response.Content.Headers.ContentType?.MediaType}");
   Need(response.StatusCode == HttpStatusCode.OK && response.Content.Headers.ContentType?.MediaType == "application/json",
    "Public search did not return JSON.");
   var json = JObject.Parse(await response.Content.ReadAsStringAsync());
   Need(json["players"] is JArray list && list.Count <= 30 && json["hasMore"]?.Type == JTokenType.Boolean &&
    list.Cast<JObject>().All(row => row.Properties().All(property =>
     property.Name is "id" or "firstName" or "lastName" or "leagues")), "Unexpected public search fields.");
   return json;
  }

  using var context = new DataContext();
  var clearlyUnclaimed = await context.Players.AsNoTracking()
   .Where(player => !context.UsersPlayer.Any(link => link.PlayerId == player.Id))
   .Where(player => player.FirstName != null && player.FirstName.Length >= 2)
   .Select(player => new { player.Id, player.FirstName })
   .FirstOrDefaultAsync();
  if (clearlyUnclaimed != null)
   Need(!(await Search(clearlyUnclaimed.FirstName))["players"].Any(row => (int)row["id"] == clearlyUnclaimed.Id),
    "Unclaimed profile appeared in recovery lookup.");
  var unclaimedLeagueMembers = await context.Players.CountAsync(player =>
   !context.UsersPlayer.Any(link => link.PlayerId == player.Id) &&
   context.PlayersLeagues.Any(link => link.PlayerID == player.Id));
  var orphanedLinks = await context.UsersPlayer.CountAsync(link =>
   !context.Users.Any(user => user.UserId == link.UserId) || !context.Players.Any(player => player.Id == link.PlayerId));
  var ambiguousProfiles = await context.UsersPlayer.GroupBy(link => link.PlayerId)
   .CountAsync(group => group.Count() > 1);
  var claimedMultipleLeagues = await context.Players.CountAsync(player =>
   context.UsersPlayer.Any(link => link.PlayerId == player.Id && context.Users.Any(user => user.UserId == link.UserId)) &&
   context.PlayersLeagues.Where(link => link.PlayerID == player.Id).Select(link => link.LeagueID).Distinct().Count() > 1);
  var results = new List<object>();
  foreach (var term in new[] { "Chris", "Allport", "Uwe" })
  {
   var clock = System.Diagnostics.Stopwatch.StartNew();
   var hits = await Search(term);
   var elapsedMilliseconds = clock.Elapsed.TotalMilliseconds;
   var caseVariant = await Search(term.ToUpperInvariant());
   Need(JToken.DeepEquals(hits, caseVariant), "Case-insensitive lookups did not agree.");
   var folded = term.ToUpperInvariant();
   var expected = await context.Players.AsNoTracking()
    .Where(player => player.FirstName.ToUpper().Contains(folded) || player.LastName.ToUpper().Contains(folded))
    .Where(player => context.UsersPlayer.Count(link => link.PlayerId == player.Id) == 1 &&
     (from link in context.UsersPlayer
      join user in context.Users on link.UserId equals user.UserId
      where link.PlayerId == player.Id && (user.UserRoleId == 1 || user.UserRoleId == 2 || user.UserRoleId == 3) &&
       user.Email != null && user.Email.Trim() != "" && user.PasswordHash != null && user.PasswordHash.Length == 32 &&
       user.PasswordSalt != null && user.PasswordSalt.Length >= 8
      select link.UsersPlayerId).Any())
    .OrderBy(player => player.LastName).ThenBy(player => player.FirstName).ThenBy(player => player.Id)
    .Select(player => player.Id).Take(61).ToListAsync();
   var actual = hits["players"].Select(player => (int)player["id"]).ToArray();
   Need(actual.SequenceEqual(expected.Take(30)) && (bool)hits["hasMore"] == (expected.Count > 30),
    "Search results do not match the verified Development database.");
   var secondPage = await Search(term, 1);
   Need(secondPage["players"].Select(player => (int)player["id"]).SequenceEqual(expected.Skip(30).Take(30)) &&
    (bool)secondPage["hasMore"] == (expected.Count > 60), "Recovery pagination does not follow the eligible ordering.");
   results.Add(new { term, matchCount = actual.Length, elapsedMilliseconds });
  }
  Need(!(await Search("RecoverySearch" + Guid.NewGuid().ToString("N")))["players"].Any(), "An unmatched name returned profiles.");
  using var unknown = await client.GetAsync("/api/account-recovery/unknown");
  Need(unknown.StatusCode == HttpStatusCode.NotFound && !(await unknown.Content.ReadAsStringAsync()).Contains("<html", StringComparison.OrdinalIgnoreCase),
   "An unknown API URL returned the SPA shell.");
  var indexes = await context.Database.SqlQueryRaw<string>(
   "SELECT CONCAT(OBJECT_NAME(i.object_id), '.', i.name) AS Value FROM sys.indexes AS i " +
   "WHERE i.object_id IN (OBJECT_ID(N'dbo.Player'), OBJECT_ID(N'dbo.PlayersLeague')) AND i.name IS NOT NULL")
   .ToListAsync();
  File.WriteAllText(Path.Combine(output, "recovery-search-results.json"), JsonConvert.SerializeObject(
   new { pass = true, database = "LeagueScramblerDev", server = "localhost", readOnly = true, anonymous = true, results, indexes, unclaimedLeagueMembers, orphanedLinks, ambiguousProfiles, claimedMultipleLeagues }));
 }
}

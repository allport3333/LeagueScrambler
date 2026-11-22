// Read-only legacy/modern EF result comparison. Never saves entities or emits row payloads.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Allport_s_League_Scrambler.Controllers;
using Allport_s_League_Scrambler.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
#if NET10_0_OR_GREATER
using Microsoft.Data.SqlClient;
#else
using System.Data.SqlClient;
#endif

internal static class QueryParitySnapshot
{
 internal sealed class Digest
 {
  public string Query { get; set; }
  public int Status { get; set; }
  public int ArrayEntries { get; set; }
  public string OrderedDigest { get; set; }
  public string UnorderedDigest { get; set; }
  public string ErrorType { get; set; }
  public string DiagnosticStack { get; set; }
 }
 static readonly JsonSerializer Serializer = JsonSerializer.Create(new JsonSerializerSettings {
  ContractResolver = new CamelCasePropertyNamesContractResolver()
 });
 static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
 static string Hash(string text) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(text))).Replace("-", ""); }
 static JToken Canonical(JToken token, bool unordered)
 {
  var obj = token as JObject;
  if (obj != null) return new JObject(obj.Properties().OrderBy(p => p.Name, StringComparer.Ordinal).Select(p => new JProperty(p.Name, Canonical(p.Value, unordered))));
  var array = token as JArray;
  if (array != null) {
   var values = array.Select(t => Canonical(t, unordered));
   if (unordered) values = values.OrderBy(t => t.ToString(Formatting.None), StringComparer.Ordinal);
   return new JArray(values);
  }
  return token.DeepClone();
 }
 static int CountArrays(JToken token) { return (token is JArray ? token.Count() : 0) + token.Children().Sum(CountArrays); }
 static void Capture(List<Digest> entries, string name, Func<object> query)
 {
  try {
   var result = query(); var status = 200; object body = result;
   var obj = result as ObjectResult;
   var json = result as JsonResult;
   var code = result as StatusCodeResult;
   if (obj != null) { status = obj.StatusCode ?? 200; body = obj.Value; }
   else if (json != null) { status = json.StatusCode ?? 200; body = json.Value; }
   else if (code != null) { status = code.StatusCode; body = null; }
   else if (result is ForbidResult) { status = 403; body = null; }
   var token = body == null ? JValue.CreateNull() : JToken.FromObject(body, Serializer);
   entries.Add(new Digest { Query = name, Status = status, ArrayEntries = CountArrays(token),
    OrderedDigest = Hash(Canonical(token, false).ToString(Formatting.None)), UnorderedDigest = Hash(Canonical(token, true).ToString(Formatting.None)) });
  } catch (Exception error) {
   // Exception messages/SQL parameter values may contain private records or configuration.
   entries.Add(new Digest { Query = name, ErrorType = error.GetType().Name, DiagnosticStack = error.StackTrace });
  }
 }
 static T Controller<T>() where T : Controller, new()
 {
  // In-memory identity for read query coverage only. No cookie, account, role or permission is created.
  return new T { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext {
   User = new ClaimsPrincipal(new ClaimsIdentity(new[] {
    new Claim(ClaimTypes.NameIdentifier, "-90220001"), new Claim(ClaimTypes.Role, "Admin")
   }, "Cookies"))
  } } };
 }
 static string Workspace()
 {
  for (var directory = new DirectoryInfo(Environment.CurrentDirectory); directory != null; directory = directory.Parent)
   if ((File.Exists(Path.Combine(directory.FullName, ".git")) || Directory.Exists(Path.Combine(directory.FullName, ".git"))) &&
       File.Exists(Path.Combine(directory.FullName, "tools/modernization/STATUS.md"))) return directory.FullName;
  throw new InvalidOperationException("Run inside the modernization worktree.");
 }
 public static int Run(string[] args)
 {
  try {
   Require(args.Length == 2 || args.Length == 3, "Pass the existing Development env path, output JSON, and optional legacy baseline JSON.");
   var output = Path.GetFullPath(args[1]);
   var artifacts = Path.GetFullPath(Path.Combine(Workspace(), "tests/functional/artifacts/modernization")) + Path.DirectorySeparatorChar;
   Require(output.StartsWith(artifacts, StringComparison.OrdinalIgnoreCase), "Snapshot output must remain in modernization artifacts.");
   Require(!File.Exists(output), "Preserve previous snapshots; choose a new output filename.");
   var line = File.ReadLines(Path.GetFullPath(args[0])).Single(x => x.TrimStart().StartsWith("LEAGUESCRAMBLER_DB_CONNECTION=", StringComparison.Ordinal));
   var connection = new SqlConnectionStringBuilder(line.Substring(line.IndexOf('=') + 1).Trim().Trim('"', '\''));
   Require(connection.DataSource == "localhost" && connection.InitialCatalog == "LeagueScramblerDev" && connection.IntegratedSecurity &&
    String.IsNullOrEmpty(connection.UserID) && String.IsNullOrEmpty(connection.Password) && String.IsNullOrEmpty(connection.AttachDBFilename), "Refusing a nonlocal/nondevelopment SQL target.");
#if NET10_0_OR_GREATER
   // The verified loopback Development server has a local certificate. No production TLS setting is changed.
   connection.TrustServerCertificate = true;
#endif
   Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION", connection.ConnectionString);
   var entries = new List<Digest>(); int[] leagueIds;
   using (var context = new DataContext()) {
    context.Database.OpenConnection();
    using (var command = context.Database.GetDbConnection().CreateCommand()) {
     command.CommandText = "SELECT DB_NAME(), CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')), CONVERT(int,compatibility_level) FROM sys.databases WHERE database_id=DB_ID()";
     using (var reader = command.ExecuteReader()) Require(reader.Read() && reader.GetString(0) == "LeagueScramblerDev" &&
      String.Equals(reader.GetString(1), Environment.MachineName, StringComparison.OrdinalIgnoreCase) && reader.GetInt32(2) == 130, "Runtime SQL identity/compatibility mismatch.");
    }
    var leagues = context.Leagues.AsNoTracking().Where(l => l.LeagueName == "WW Test League" || l.LeagueName == "WW Winter 2026").OrderBy(l => l.ID).ToList();
    Require(leagues.Count == 2, "Both established reference leagues must exist."); leagueIds = leagues.Select(l => l.ID).ToArray();
    var searchOnly = Environment.GetEnvironmentVariable("LEAGUE_QUERY_SEARCH_ONLY") == "1";
    var retrievalOnly = Environment.GetEnvironmentVariable("LEAGUE_QUERY_RETRIEVAL_ONLY") == "1";
    if (searchOnly) {
     using (var search = Controller<ScrambleDataController>())
      foreach (var term in new[] { "Chris", "chris all", "AL", "not-a-real-name-fixture" }) {
       var selectedTerm = term;
       Capture(entries, "autocomplete/" + term, () => search.SearchPlayers(selectedTerm));
      }
    } else if (!retrievalOnly) Capture(entries, "account-role-ids", () => context.Users.AsNoTracking().OrderBy(u => u.UserId).Select(u => new { u.UserId, u.UserRoleId, u.IsAdmin }).ToList());
    foreach (var league in searchOnly ? leagues.Take(0) : leagues) {
     var id = league.ID; var prefix = "league-" + id + "/";
     using (var stats = Controller<StatisticsController>())
     using (var players = Controller<ScrambleDataController>()) {
      if (retrievalOnly) { Capture(entries, prefix + "retrieval-list", () => players.SelectedLeagueScrambles(league.LeagueName)); continue; }
      Capture(entries, prefix + "players", () => players.GetPlayers(id));
      Capture(entries, prefix + "memberships", () => players.AvailableLeaguePlayers(id, null, true, true));
      Capture(entries, prefix + "teams", () => stats.GetTeamsByLeagueId(id));
      Capture(entries, prefix + "team-rosters", () => stats.GetAllTeamsWithPlayers(id));
      Capture(entries, prefix + "team-standings", () => stats.GetLeagueStandings(id));
      Capture(entries, prefix + "public-schedule", () => stats.GetLeagueSchedule(id));
      Capture(entries, prefix + "management-schedule-state", () => {
       var state = ScheduleManagementController.Read(context, id);
       return new { state.Teams, state.Divisions, state.Games, state.Events, state.Protected, state.EventsAvailable, state.Revision };
      });
      Capture(entries, prefix + "top-players", () => players.GetTopPlayers(id));
      Capture(entries, prefix + "history", () => Controller<ScramblerHistoryController>().TeammateHistory(id));
      Capture(entries, prefix + "league-permissions", () => context.UserLeagues.AsNoTracking().Where(u => u.LeagueTypeId == id).OrderBy(u => u.UserLeagueId).Select(u => new { u.UserLeagueId, u.UserId, u.LeagueTypeId }).ToList());
      Capture(entries, prefix + "round-scores", () => (from score in context.KingQueenRoundScores.AsNoTracking() join team in context.KingQueenTeam on score.KingQueenTeamId equals team.Id where team.LeagueID == id orderby score.Id select new { score.Id, score.KingQueenTeamId, score.RoundId, score.RoundScore, score.RoundWon }).ToList());
      var playerId = context.PlayersLeagues.AsNoTracking().Where(m => m.LeagueID == id).OrderBy(m => m.PlayerID).Select(m => m.PlayerID).FirstOrDefault();
      if (playerId > 0) {
       Capture(entries, prefix + "player-team-scores", () => stats.GetLeagueTeamScores(playerId, id));
       Capture(entries, prefix + "player-kq-statistics", () => stats.GetDetailedPerformanceStats(playerId, id).GetAwaiter().GetResult());
      }
      var scramble = context.KingQueenTeam.AsNoTracking().Where(t => t.LeagueID == id && t.ScrambleWithScoresToBeSaved).OrderByDescending(t => t.DateOfTeam).ThenByDescending(t => t.Id).Select(t => t.ScrambleNumber).FirstOrDefault();
      if (scramble > 0) Capture(entries, prefix + "saved-scramble", () => players.GetKingQueenTeamsByScrambleNumber(league.LeagueName, scramble));
     }
    }
   }
   var differences = new List<object>();
   if (args.Length == 3) {
    var baseline = JObject.Parse(File.ReadAllText(Path.GetFullPath(args[2])))["entries"].ToObject<List<Digest>>();
    Require(baseline.Count == entries.Count, "Query coverage differs from the legacy baseline.");
    foreach (var actual in entries) {
     var old = baseline.Single(e => e.Query == actual.Query);
     if (old.Status != actual.Status || old.OrderedDigest != actual.OrderedDigest || old.ErrorType != actual.ErrorType)
      differences.Add(new { actual.Query, orderOnly = old.UnorderedDigest != null && old.UnorderedDigest == actual.UnorderedDigest, legacyError = old.ErrorType, currentError = actual.ErrorType });
    }
   }
   Directory.CreateDirectory(Path.GetDirectoryName(output));
   File.WriteAllText(output, JsonConvert.SerializeObject(new { capturedUtc = DateTime.UtcNow, ormVersion = typeof(DbContext).Assembly.GetName().Version.ToString(),
    leagueIds, readOnly = true, databaseWrites = false, syntheticPrincipalOnly = true, authorizationTested = false,
    payloadsStored = false, entries, differences }, Formatting.Indented));
   var failures = entries.Count(e => e.ErrorType != null || e.Status != 200);
   Console.WriteLine("Read-only query fingerprints: " + entries.Count + "; failures=" + failures + "; differences=" + differences.Count + ". No row payloads or credentials stored.");
   return failures == 0 && differences.Count == 0 ? 0 : 1;
  } catch (Exception error) { Console.Error.WriteLine("Query snapshot refused/failed: " + error.GetType().Name + "; sensitive diagnostics withheld."); return 1; }
 }
}

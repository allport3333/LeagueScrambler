// Test tooling only. No production authentication/authorization policy is changed.
using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;

internal static class DevelopmentAuthorization
{
 public const string Grant = "leaguehub-modernization-development-2026-11-22";
 public static void Configure(string envFile, string reportFile, bool sharedMemory = false) {
  var root = Directory.GetCurrentDirectory();
  var grantFile = Path.Combine(root, "tools/modernization/DEVELOPMENT-AUTHORIZATION.md");
  if (!File.Exists(grantFile) || !File.ReadAllText(grantFile).Contains(Grant)) throw new InvalidOperationException("Recorded user authorization required.");
  var output = Path.GetFullPath(reportFile);
  var artifacts = Path.GetFullPath(Path.Combine(root, "tests/functional/artifacts/modernization")) + Path.DirectorySeparatorChar;
  if (!output.StartsWith(artifacts, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Use modernization artifact output.");
  Directory.CreateDirectory(Path.GetDirectoryName(output));
  var line = File.ReadLines(Path.GetFullPath(envFile)).Single(x => x.TrimStart().StartsWith("LEAGUESCRAMBLER_DB_CONNECTION=", StringComparison.Ordinal));
  var builder = new SqlConnectionStringBuilder(line.Substring(line.IndexOf('=') + 1).Trim().Trim('"', '\''));
  if (builder.DataSource != "localhost" || builder.InitialCatalog != "LeagueScramblerDev" || !builder.IntegratedSecurity ||
      !string.IsNullOrEmpty(builder.UserID) || !string.IsNullOrEmpty(builder.Password) || !string.IsNullOrEmpty(builder.AttachDBFilename)) throw new InvalidOperationException("Refusing nonlocal/nondevelopment target.");
  if (sharedMemory) builder.DataSource = "lpc:localhost";
  builder.TrustServerCertificate = true; // Verified loopback Development certificate only.
  using (var sql = new SqlConnection(builder.ConnectionString)) {
   sql.Open(); using var command = sql.CreateCommand();
   command.CommandText = "SELECT DB_NAME(),CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')),CONVERT(int,compatibility_level) FROM sys.databases WHERE database_id=DB_ID()";
   using var reader = command.ExecuteReader();
   if (!reader.Read() || reader.GetString(0) != "LeagueScramblerDev" || !reader.GetString(1).Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase) || reader.GetInt32(2) != 130)
    throw new InvalidOperationException("Runtime Development database identity mismatch.");
  }
  Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION", builder.ConnectionString);
  Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
  File.WriteAllText(output + ".authorization.json", JsonConvert.SerializeObject(new {
   grantId = Grant, grantSha256 = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(grantFile))), verifiedUtc = DateTime.UtcNow,
   server = "localhost", database = "LeagueScramblerDev", machine = Environment.MachineName, compatibilityLevel = 130,
   databaseWritesAuthorized = true, productionAuthorized = false
  }, Formatting.Indented));
 }
}

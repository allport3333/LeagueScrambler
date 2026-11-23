using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class TeamVerification
{
 public static async Task Run(string[] args, Func<string[],Task> test)
 {
  var root = new DirectoryInfo(AppContext.BaseDirectory);
  while (root != null && !File.Exists(Path.Combine(root.FullName, "tools/modernization/STATUS.md"))) root = root.Parent;
  if (root == null) throw new InvalidOperationException("Modernization worktree not found.");
  Directory.SetCurrentDirectory(root.FullName);
  var configuration = args.Length > 1 ? Path.GetFullPath(args[1]) :
   Path.Combine(root.Parent.FullName, "Allport's League Scrambler", "Allport's League Scrambler", ".env");
  var run = args.Length > 2 ? args[2] : $"authorized-team-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..8]}";
  if (!System.Text.RegularExpressions.Regex.IsMatch(run, @"^authorized-team-[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$"))
   throw new InvalidOperationException("Unrecognized recovery run name.");
  var folder = Path.Combine(root.FullName,"tests/functional/artifacts/modernization",run);
  var http = Path.Combine(folder,"http");
  var recovery = args.Length > 2;
  var before = Path.Combine(folder,"before.json");
  if (recovery ? !File.Exists(before) || !File.Exists(Path.Combine(http,"authorized-results.json")) : Directory.Exists(folder))
   throw new InvalidOperationException("Invalid run or recovery artifact directory.");
  if (recovery && (bool?)JObject.Parse(File.ReadAllText(Path.Combine(http,"authorized-results.json")))["cleanupCompleted"] == true)
   throw new InvalidOperationException("This run already completed cleanup.");
  DevelopmentAuthorization.Configure(configuration, Path.Combine(folder,"verification"), sharedMemory:true);
  if (!recovery) File.WriteAllText(before, Fingerprint());
  Console.WriteLine("Development evidence: " + folder);
  Exception failure = null;
  try { await test(new[] { configuration,http,recovery ? "--cleanup-team-authorization" : "--team-authorization" }); }
  catch (Exception error) { failure = error; }
  var after = Fingerprint();
  File.WriteAllText(Path.Combine(folder,recovery ? "after-recovery.json" : "after.json"),after);
  var equal = JToken.DeepEquals(JToken.Parse(File.ReadAllText(before)),JToken.Parse(after));
  File.WriteAllText(Path.Combine(folder,recovery ? "recovery-summary.json" : "integration-summary.json"),
   JsonConvert.SerializeObject(new { pass = equal && failure == null, fingerprintsMatch = equal, recovery, error = failure?.GetType().Name },Formatting.Indented));
  if (failure != null || !equal) throw new InvalidOperationException("Development verification failed. See the named run evidence.",failure);
  Console.WriteLine("PASS: Development checks and owned cleanup succeeded. Before and after fingerprints match.");
 }

 static string Fingerprint()
 {
  using var context = new DataContext();
  context.Database.OpenConnection();
  using var tx = context.Database.BeginTransaction(System.Data.IsolationLevel.Serializable);
  using var cmd = context.Database.GetDbConnection().CreateCommand();
  cmd.Transaction = tx.GetDbTransaction();
  cmd.CommandTimeout = 120;
  string HashRows(string sql) {
   cmd.CommandText = sql;
   using var reader = cmd.ExecuteReader();
   using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
   while (reader.Read()) hash.AppendData(System.Text.Encoding.UTF8.GetBytes(reader.GetString(0)));
   return Convert.ToHexString(hash.GetHashAndReset());
  }
  string Q(string name) => "[" + name.Replace("]","]]") + "]";
  var tables = new List<object>();
  foreach (var entity in context.Model.GetEntityTypes().OrderBy(entity => entity.GetTableName(),StringComparer.Ordinal)) {
   var table = entity.GetTableName();
   if (table == null) continue;
   var schema = entity.GetSchema() ?? "dbo";
   var store = StoreObjectIdentifier.Table(table,schema);
   var keys = entity.FindPrimaryKey()?.Properties.Select(p => Q(p.GetColumnName(store))).ToArray();
   if (keys == null || keys.Length == 0) throw new InvalidOperationException("Cannot fingerprint unordered table " + table);
   var columns = entity.GetProperties().Where(property => table is not ("User" or "Password") ||
    (property.Name is "Id" or "UserId" or "UserRoleId")).Select(p => Q(p.GetColumnName(store))).Distinct().ToArray();
   var qualified = Q(schema) + "." + Q(table);
   cmd.CommandText = "SELECT COUNT_BIG(*) FROM " + qualified;
   var count = (long)cmd.ExecuteScalar();
   var hash = HashRows($"SELECT {string.Join(",",columns)} FROM {qualified} ORDER BY {string.Join(",",keys)} FOR JSON PATH, INCLUDE_NULL_VALUES");
   tables.Add(new { table = qualified, count, hash });
  }
  var schemaHash = HashRows("SELECT * FROM sys.columns WHERE object_id IN (SELECT object_id FROM sys.tables) ORDER BY object_id,column_id FOR JSON PATH, INCLUDE_NULL_VALUES");
  var foreignKeys = HashRows("SELECT fk.*,fc.constraint_column_id,fc.parent_column_id,fc.referenced_column_id FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fc ON fk.object_id=fc.constraint_object_id ORDER BY fk.object_id,fc.constraint_column_id FOR JSON PATH, INCLUDE_NULL_VALUES");
  tx.Commit();
  return JsonConvert.SerializeObject(new { database = "LeagueScramblerDev", tables, schemaHash, foreignKeys },Formatting.Indented);
 }
}


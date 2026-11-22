// Read-only endpoint integration check. Never loads SMTP settings or changes records.
using System;
using Microsoft.Data.SqlClient;
using System.IO;
using System.Linq;
using Allport_s_League_Scrambler.Controllers;
using Allport_s_League_Scrambler.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
class HistoryCheck {
 static void Require(bool value,string message){if(!value)throw new Exception(message);}
 static int Main(string[] args){try{
  Require(args.Length==1,"Pass the existing local development .env path.");
  var line=File.ReadLines(Path.GetFullPath(args[0])).Single(x=>x.TrimStart().StartsWith("LEAGUESCRAMBLER_DB_CONNECTION="));
  var connection=new SqlConnectionStringBuilder(line.Substring(line.IndexOf('=')+1).Trim().Trim('"','\''));
  Require(connection.DataSource=="localhost"&&connection.InitialCatalog=="LeagueScramblerDev"&&connection.IntegratedSecurity&&String.IsNullOrEmpty(connection.UserID)&&String.IsNullOrEmpty(connection.Password)&&String.IsNullOrEmpty(connection.AttachDBFilename),"Refusing a nonlocal or nondevelopment database.");
  // Loopback-only verified Development certificate; never alters application TLS settings.
  connection.TrustServerCertificate=true;
  Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION",connection.ConnectionString);
  using(var c=new DataContext()){
   c.Database.OpenConnection();using(var command=c.Database.GetDbConnection().CreateCommand()){command.CommandText="SELECT DB_NAME(), CONVERT(nvarchar(128), SERVERPROPERTY('MachineName'))";using(var reader=command.ExecuteReader()){Require(reader.Read()&&reader.GetString(0)=="LeagueScramblerDev"&&String.Equals(reader.GetString(1),Environment.MachineName,StringComparison.OrdinalIgnoreCase),"Runtime SQL identity mismatch.");}}
   var leagues=c.Leagues.AsNoTracking().Where(l=>l.LeagueName=="WW Test League"||l.LeagueName=="WW Winter 2026").Select(l=>l.ID).ToList();Require(leagues.Count>0,"No reference leagues available.");
   var controller=new ScramblerHistoryController();int checkedPairs=0;
   foreach(var id in leagues){
    var actual=controller.TeammateHistory(id) as OkObjectResult;Require(actual!=null,"History endpoint did not return success.");var data=JObject.FromObject(actual.Value, Newtonsoft.Json.JsonSerializer.Create(new Newtonsoft.Json.JsonSerializerSettings { ContractResolver=new Newtonsoft.Json.Serialization.CamelCasePropertyNamesContractResolver() }));Require(data.Value<int>("leagueId")==id,"League scope mismatch.");
    var members=(from m in c.KingQueenPlayer.AsNoTracking() join t in c.KingQueenTeam.AsNoTracking() on m.KingQueenTeamId equals t.Id join p in c.Players.AsNoTracking() on m.PlayerId equals p.Id where t.LeagueID==id&&t.ScrambleWithScoresToBeSaved select new {m.KingQueenTeamId,m.PlayerId}).ToList();
    var expected=members.GroupBy(x=>x.KingQueenTeamId).SelectMany(t=>{var ids=t.Select(x=>x.PlayerId).Distinct().OrderBy(x=>x).ToArray();return ids.SelectMany((a,i)=>ids.Skip(i+1).Select(b=>a+":"+b));}).GroupBy(x=>x).ToDictionary(g=>g.Key,g=>g.Count());
    var pairs=(JArray)data["pairs"];Require(pairs.Count==expected.Count,"Aggregate pair count differs from independent membership calculation.");foreach(var pair in pairs){var key=pair.Value<int>("player1Id")+":"+pair.Value<int>("player2Id");Require(expected.ContainsKey(key)&&expected[key]==pair.Value<int>("count"),"Pair frequency mismatch.");checkedPairs++;}
    Console.WriteLine("LEAGUE "+id+": finalizedTeams="+members.Select(x=>x.KingQueenTeamId).Distinct().Count()+"; distinctSavedMembers="+members.Select(x=>x.PlayerId).Distinct().Count()+"; membershipRows="+members.Count+"; uniquePairs="+pairs.Count+"; totalPairOccurrences="+expected.Values.Sum()+"; repeatedUniquePairs="+expected.Count(x=>x.Value>1));
   }
   Require(controller.TeammateHistory(0) is BadRequestObjectResult,"Invalid league must be rejected.");Require(controller.TeammateHistory(Int32.MaxValue) is NotFoundObjectResult,"Missing league must not return empty history.");
   Console.WriteLine("PASS: verified localhost/LeagueScramblerDev; "+leagues.Count+" leagues; "+checkedPairs+" aggregate pairs match independent saved-membership calculation. Invalid/missing league states verified. Read-only; no account or league changes.");
  }return 0;
 }catch(Exception error){Console.Error.WriteLine("History integration check failed: "+error.GetType().Name+"; sensitive configuration and database diagnostics withheld.");return 1;}}
}


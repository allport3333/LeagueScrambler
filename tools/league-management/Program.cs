// Explicitly approved, isolated Development SQL integration test. No accounts,
// authentication credentials, real player profiles or real leagues are changed.
using System;
using System.Collections.Generic;
using Microsoft.Data.SqlClient;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Controllers;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;

class PlayerImportCheck {
 static readonly List<string> checks=new List<string>();
 static readonly List<int> leagueIds=new List<int>(),playerIds=new List<int>();
 static string prefix,reportPath,phase="authorization",failedCheck;static bool cleaned=false;
 static void Require(bool value,string text){if(!value){failedCheck=text;throw new InvalidOperationException(text);}}
 static string HashFile(string file){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-","");}
 static string Snapshot(){using(var c=new DataContext()){
  var data=new {players=c.Players.AsNoTracking().OrderBy(p=>p.Id).ToList(),leagues=c.Leagues.AsNoTracking().OrderBy(l=>l.ID).ToList(),members=c.PlayersLeagues.AsNoTracking().OrderBy(m=>m.Id).Select(m=>new{m.Id,m.PlayerID,m.LeagueID,m.LeagueDivisionId,m.IsSub}).ToList(),divisions=c.LeagueDivision.AsNoTracking().OrderBy(d=>d.Id).Select(d=>new{d.Id,d.LeagueID,d.Name,d.Code,d.SortOrder}).ToList(),teams=c.LeagueTeam.AsNoTracking().OrderBy(t=>t.Id).ToList(),teamPlayers=c.LeagueTeamPlayer.AsNoTracking().OrderBy(t=>t.Id).Select(t=>new{t.Id,t.LeagueTeamId,t.PlayerId}).ToList(),kqTeams=c.KingQueenTeam.AsNoTracking().OrderBy(t=>t.Id).ToList(),kqPlayers=c.KingQueenPlayer.AsNoTracking().OrderBy(t=>t.Id).ToList(),kqScores=c.KingQueenRoundScores.AsNoTracking().OrderBy(t=>t.Id).ToList()};
  using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(data)))).Replace("-","");
 }}
 static void Report(bool pass,string failure=null){File.WriteAllText(reportPath,JsonConvert.SerializeObject(new{pass,phase,database="LeagueScramblerDev",server="localhost",environment="Development",prefix,leagueIds,playerIds,checks,cleanupCompleted=cleaned,failure,failedCheck,mode="real SQL writes through current controller methods; synthetic claims; no HTTP login testing"},Formatting.Indented));}
 static ScrambleDataController Controller(string role="Admin"){
  var principal=new ClaimsPrincipal(new ClaimsIdentity(new[]{new Claim(ClaimTypes.Role,role),new Claim(ClaimTypes.NameIdentifier,int.MaxValue.ToString())},"DevelopmentTest"));
  return new ScrambleDataController{ControllerContext=new ControllerContext{HttpContext=new DefaultHttpContext{User=principal}}};
 }
 static LeaguePlayerImportRequest Request(params int[] pairs){return new LeaguePlayerImportRequest{Players=Enumerable.Range(0,pairs.Length/2).Select(i=>new LeaguePlayerImportEntry{PlayerId=pairs[i*2],DivisionId=pairs[i*2+1]}).ToList()};}
 static JObject Ok(IActionResult action){var result=action as OkObjectResult;Require(result!=null,"Expected a successful controller result.");return JObject.FromObject(result.Value,JsonSerializer.Create(new JsonSerializerSettings{ContractResolver=new CamelCasePropertyNamesContractResolver()}));}
 static int Count(int league){using(var c=new DataContext())return c.PlayersLeagues.Count(m=>m.LeagueID==league);}
 static void Cleanup(){
  if(leagueIds.Count==0&&playerIds.Count==0){cleaned=true;return;}
  using(var c=new DataContext())using(var transaction=c.Database.BeginTransaction(System.Data.IsolationLevel.Serializable)){
   var leagues=c.Leagues.Where(l=>leagueIds.Contains(l.ID)).ToList();var players=c.Players.Where(p=>playerIds.Contains(p.Id)).ToList();
   Require(leagues.Count==leagueIds.Count&&leagues.All(l=>l.LeagueName==prefix+"_Main"||l.LeagueName==prefix+"_Other"),"Cleanup league ownership mismatch.");
   Require(players.Count==playerIds.Count&&players.All(p=>p.FirstName.StartsWith(prefix)&&p.LastName.StartsWith("Participant")),"Cleanup player ownership mismatch.");
   Require(!c.PlayersLeagues.Any(m=>playerIds.Contains(m.PlayerID)&&!leagueIds.Contains(m.LeagueID)),"A fixture player acquired an unrelated membership; cleanup refused.");
   var ownedTeams=c.LeagueTeam.Where(t=>leagueIds.Contains(t.LeagueID)).ToList();var teamIds=ownedTeams.Select(t=>t.Id).ToList();
   Require(ownedTeams.All(t=>t.TeamName==prefix+"_Team"),"Cleanup team ownership mismatch.");c.LeagueTeamPlayer.RemoveRange(c.LeagueTeamPlayer.Where(t=>teamIds.Contains(t.LeagueTeamId)));c.LeagueTeam.RemoveRange(ownedTeams);c.SaveChanges();
   var kqIds=c.KingQueenTeam.Where(t=>leagueIds.Contains(t.LeagueID)).Select(t=>t.Id).ToList();c.KingQueenRoundScores.RemoveRange(c.KingQueenRoundScores.Where(t=>kqIds.Contains(t.KingQueenTeamId)));c.KingQueenPlayer.RemoveRange(c.KingQueenPlayer.Where(t=>kqIds.Contains(t.KingQueenTeamId)));c.SaveChanges();c.KingQueenTeam.RemoveRange(c.KingQueenTeam.Where(t=>leagueIds.Contains(t.LeagueID)));c.SaveChanges();
   c.PlayersLeagues.RemoveRange(c.PlayersLeagues.Where(m=>leagueIds.Contains(m.LeagueID)));c.SaveChanges();
   c.LeagueDivision.RemoveRange(c.LeagueDivision.Where(d=>leagueIds.Contains(d.LeagueID)));c.SaveChanges();
   c.Leagues.RemoveRange(leagues);c.Players.RemoveRange(players);c.SaveChanges();transaction.Commit();
  }
  using(var c=new DataContext())Require(!c.Leagues.Any(l=>leagueIds.Contains(l.ID))&&!c.Players.Any(p=>playerIds.Contains(p.Id))&&!c.PlayersLeagues.Any(m=>leagueIds.Contains(m.LeagueID)),"Cleanup verification failed.");cleaned=true;
 }
 // Dependency/serialization smoke checks do not require or authorize SQL access.
 // The existing three-argument integration mode retains all fresh-approval gates.
 static int Fixtures(string output){
  try{
   var local=new List<string>();
   var input=JObject.Parse("{\"userAuthorized\":false,\"scope\":\"fixture-only\",\"identity\":{\"pid\":97},\"expiresAt\":\"2026-11-21T00:00:00Z\"}");
   Require(!input.Value<bool>("userAuthorized")&&input["identity"].Value<int>("pid")==97&&input.Value<DateTime>("expiresAt").Kind==DateTimeKind.Utc,"Approval JSON contract changed.");
   local.Add("Approval JSON typed/date parsing retained; fixture data does not authorize database access.");
   var request=Request(101,501,102,0);var copy=JsonConvert.DeserializeObject<LeaguePlayerImportRequest>(JsonConvert.SerializeObject(request));
   Require(copy.Players.Count==2&&copy.Players[0].PlayerId==101&&copy.Players[0].DivisionId==501&&copy.Players[1].DivisionId==0,"Membership request JSON changed.");
   var result=Ok(new OkObjectResult(new{LeagueId=37,Atomic=true,Results=new[]{new{Player=new Player{Id=101,FirstName="Fixture",LastName="O'Neill-Smith",IsMale=true},LeagueDivisionId=501,AlreadyMember=false}}}));
   Require(result.Value<int>("leagueId")==37&&result.Value<bool>("atomic")&&(int)result["results"][0]["player"]["id"]==101&&(string)result["results"][0]["player"]["lastName"]=="O'Neill-Smith","MVC result/camel case JSON contract changed.");
   local.Add("Actual MVC result and membership DTO round trips retain IDs, division, punctuation and camel-case contracts.");
   var method=typeof(ScrambleDataController).GetMethod("ImportLeaguePlayers");
   Require(method.GetCustomAttributes(typeof(AuthorizeAttribute),true).Cast<AuthorizeAttribute>().Any(a=>a.Policy=="LeagueManagement"),"Bulk authorization policy missing.");
   Require(Controller("Player").User.IsInRole("Player")&&!Controller("Player").User.IsInRole("Admin"),"Synthetic role setup changed.");
   local.Add("Current controller loads, its LeagueManagement authorization metadata and HTTP/role fixture types remain compatible.");
   bool rejected=false;try{JsonConvert.DeserializeObject(new string('[',128)+"0"+new string(']',128));}catch(JsonReaderException){rejected=true;}
   Require(rejected,"Deep JSON input was not rejected by the patched default depth limit.");
   local.Add("Patched JSON default rejects excessive nesting; ordinary report serialization remains available.");
   Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));File.WriteAllText(output,JsonConvert.SerializeObject(new{pass=true,checks=local,databaseWrites=false,mode="dependency/JSON/controller fixtures only; SQL integration not executed"},Formatting.Indented));
   Console.WriteLine("PASS: four dependency/JSON/controller fixture groups; no SQL or external messages.");return 0;
  }catch(Exception e){Console.Error.WriteLine("Fixture verification failed ("+e.GetType().Name+").");return 1;}
 }
 static int Main(string[] args){
  if(args.Length==2&&args[0]=="--fixtures")return Fixtures(args[1]);
  string before=null;Exception failure=null;
  try{
   Require(args.Length==3,"Pass authorization (or --modernization-authorized), Development .env and report path.");reportPath=Path.GetFullPath(args[2]);
   var modernization=args[0]=="--modernization-authorized";
   if(modernization)DevelopmentAuthorization.Configure(args[1],reportPath);
   else {
   var approval=JObject.Parse(File.ReadAllText(args[0]));
   Require(approval.Value<bool>("userAuthorized")&&approval.Value<string>("scope")=="player-import-synthetic-development"&&approval.Value<string>("database")=="LeagueScramblerDev"&&approval.Value<string>("server")=="localhost"&&approval.Value<string>("environment")=="Development"&&approval.Value<DateTime>("expiresAt").ToUniversalTime()>DateTime.UtcNow,"Fresh scoped user authorization is required.");
   // CIM records microseconds; Process.StartTime includes 100ns ticks. Compare at
   // CIM precision while retaining the exact PID and configuration hashes.
   var identity=approval["identity"];var process=Process.GetProcessById(identity.Value<int>("pid"));Require(process.StartTime.ToUniversalTime().Ticks/10==identity.Value<DateTime>("processStartUtc").ToUniversalTime().Ticks/10,"Verified development process changed.");
   Require(HashFile(identity.Value<string>("projectDll"))==identity.Value<string>("dllSha256")&&HashFile(args[1])==identity.Value<string>("envSha256"),"Verified development configuration changed.");
   }
   var line=File.ReadLines(args[1]).Single(x=>x.TrimStart().StartsWith("LEAGUESCRAMBLER_DB_CONNECTION="));var db=new SqlConnectionStringBuilder(line.Substring(line.IndexOf('=')+1).Trim().Trim('"','\''));
   Require(db.DataSource=="localhost"&&db.InitialCatalog=="LeagueScramblerDev"&&db.IntegratedSecurity&&string.IsNullOrEmpty(db.UserID)&&string.IsNullOrEmpty(db.Password)&&string.IsNullOrEmpty(db.AttachDBFilename),"Only the approved local Windows-authenticated development database is allowed.");
   if(modernization)db.TrustServerCertificate=true;
   Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION",db.ConnectionString);Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT","Development");
   using(var c=new DataContext()){c.Database.OpenConnection();using(var cmd=c.Database.GetDbConnection().CreateCommand()){cmd.CommandText="SELECT DB_NAME(),CONVERT(nvarchar(128),SERVERPROPERTY('MachineName'))";using(var reader=cmd.ExecuteReader())Require(reader.Read()&&reader.GetString(0)=="LeagueScramblerDev"&&string.Equals(reader.GetString(1),Environment.MachineName,StringComparison.OrdinalIgnoreCase),"SQL identity mismatch.");}}
   checks.Add(modernization?"Explicit modernization Development grant, localhost SQL machine/database identity and Windows authentication verified.":"Fresh user authorization, effective Development runtime, process binding, localhost SQL identity and Windows authentication verified.");
   before=Snapshot();prefix="LSImport_"+Guid.NewGuid().ToString("N");phase="create owned fixtures";
   var main=new LeagueType{LeagueName=prefix+"_Main"};var other=new LeagueType{LeagueName=prefix+"_Other"};var players=Enumerable.Range(1,6).Select(i=>new Player{FirstName=prefix,LastName="Participant"+i,IsMale=i%2==0,Gender=i%2==0?"Male":"Female"}).ToList();
   using(var c=new DataContext())using(var tx=c.Database.BeginTransaction()){
    c.Leagues.AddRange(main,other);c.Players.AddRange(players);c.SaveChanges();leagueIds.AddRange(new[]{main.ID,other.ID});playerIds.AddRange(players.Select(p=>p.Id));Report(false);
    tx.Commit();
   }
   var gold=new LeagueDivision{LeagueID=main.ID,Name="Gold",Code="G",SortOrder=1};var silver=new LeagueDivision{LeagueID=main.ID,Name="Silver",Code="S",SortOrder=2};var foreign=new LeagueDivision{LeagueID=other.ID,Name="Open",Code="O",SortOrder=1};
   using(var c=new DataContext())using(var tx=c.Database.BeginTransaction()){c.LeagueDivision.AddRange(gold,silver,foreign);c.SaveChanges();c.PlayersLeagues.AddRange(new PlayersLeague{LeagueID=main.ID,PlayerID=players[0].Id,LeagueDivisionId=gold.Id},new PlayersLeague{LeagueID=other.ID,PlayerID=players[1].Id,LeagueDivisionId=foreign.Id});c.SaveChanges();tx.Commit();}
   phase="validate authorization and inputs";
   var controller=Controller();var method=typeof(ScrambleDataController).GetMethod("ImportLeaguePlayers");Require(method.GetCustomAttributes(typeof(AuthorizeAttribute),true).Cast<AuthorizeAttribute>().Any(a=>a.Policy=="LeagueManagement"),"Bulk authorization policy missing.");
   Require(Controller("Player").ImportLeaguePlayers(main.ID,Request(players[2].Id,0)) is ForbidResult&&Controller("Manager").ImportLeaguePlayers(main.ID,Request(players[2].Id,0)) is ForbidResult,"Unauthorized role or unrelated Manager was allowed.");
   Require(controller.ImportLeaguePlayers(int.MaxValue,Request(players[2].Id,0)) is NotFoundResult,"Missing league was accepted.");
   Require(controller.ImportLeaguePlayers(main.ID,null) is BadRequestObjectResult&&controller.ImportLeaguePlayers(main.ID,new LeaguePlayerImportRequest{Players=new List<LeaguePlayerImportEntry>()}) is BadRequestObjectResult,"Empty import accepted.");
   Require(controller.ImportLeaguePlayers(main.ID,Request(players[2].Id,0,players[2].Id,0)) is BadRequestObjectResult,"Duplicate IDs accepted.");
   Require(controller.ImportLeaguePlayers(main.ID,Request(players[2].Id,-1)) is BadRequestObjectResult&&controller.ImportLeaguePlayers(main.ID,Request(int.MaxValue,0)) is BadRequestObjectResult,"Invalid player/division accepted.");
   Require(controller.ImportLeaguePlayers(main.ID,Request(players[3].Id,gold.Id,players[4].Id,foreign.Id)) is BadRequestObjectResult&&Count(main.ID)==1,"Invalid cross-league division caused partial writes.");
   checks.Add("Actual controller rejects Player/unassigned Manager, missing league, empty requests, duplicate IDs, missing players and negative/cross-league divisions; invalid batch leaves valid rows uninserted.");
   phase="confirmed bulk addition";
   var request=Request(players[0].Id,silver.Id,players[1].Id,silver.Id,players[2].Id,0);var response=Ok(controller.ImportLeaguePlayers(main.ID,request));
   Require(response.Value<bool>("atomic")&&(int)response["leagueId"]==main.ID&&((JArray)response["results"]).Count==3&&response["results"].Count(r=>(bool)r["alreadyMember"])==1,"Incorrect bulk result.");
   using(var c=new DataContext()){
    Require(c.PlayersLeagues.Single(m=>m.LeagueID==main.ID&&m.PlayerID==players[0].Id).LeagueDivisionId==gold.Id,"Existing division changed.");
    Require(c.PlayersLeagues.Single(m=>m.LeagueID==main.ID&&m.PlayerID==players[1].Id).LeagueDivisionId==silver.Id,"Imported Silver division incorrect.");
    Require(c.PlayersLeagues.Single(m=>m.LeagueID==main.ID&&m.PlayerID==players[2].Id).LeagueDivisionId==null,"No Division incorrectly stored.");
    Require(c.PlayersLeagues.Single(m=>m.LeagueID==other.ID&&m.PlayerID==players[1].Id).LeagueDivisionId==foreign.Id,"Other league changed.");
    Require(c.Players.Where(p=>playerIds.Contains(p.Id)).OrderBy(p=>p.Id).Select(p=>p.FirstName).ToList().All(n=>n==prefix),"Player profile changed.");
   }
   var repeated=Ok(controller.ImportLeaguePlayers(main.ID,request));Require(repeated["results"].All(r=>(bool)r["alreadyMember"])&&Count(main.ID)==3,"Repeated confirmation duplicated or changed memberships.");
   var available=Ok(controller.AvailableLeaguePlayers(main.ID));var availableIds=available["players"].Select(p=>(int)p["id"]).ToList();Require(!availableIds.Contains(players[1].Id)&&availableIds.Contains(players[3].Id),"Available players not reconciled.");
   var context=Ok(controller.AvailableLeaguePlayers(main.ID,null,true));Require(context["members"].Any(m=>(int)m["playerId"]==players[1].Id),"Current league roster context missing imported member.");
   checks.Add("Real bulk addition creates two memberships, preserves an existing Gold membership despite requested Silver, stores Silver and No Division correctly, preserves other league/profile data, updates roster/available reads and is idempotent.");
   phase="concurrent requests";
   var errors=new List<string>();var successes=0;
   var actions=new Action[]{()=>Ok(Controller().ImportLeaguePlayers(main.ID,Request(players[3].Id,gold.Id,players[4].Id,silver.Id))),()=>Ok(Controller().ImportLeaguePlayers(main.ID,Request(players[4].Id,silver.Id,players[3].Id,gold.Id)))};
   Task.WaitAll(actions.Select(action=>Task.Run(()=>{try{action();System.Threading.Interlocked.Increment(ref successes);}catch(Exception e){lock(errors)errors.Add(e.GetType().Name);}})).ToArray());
   Require(successes>=1,"All concurrent imports failed.");using(var c=new DataContext())Require(c.PlayersLeagues.Count(m=>m.LeagueID==main.ID&&(m.PlayerID==players[3].Id||m.PlayerID==players[4].Id))==2,"Concurrent import duplicated memberships.");
   var browser=Ok(Controller().AddPlayer(new Player{Id=players[5].Id},main.LeagueName,gold.Id,true,main.ID));var afterBrowser=Ok(Controller().ImportLeaguePlayers(main.ID,Request(players[5].Id,silver.Id)));Require((bool)afterBrowser["results"][0]["alreadyMember"]&&(int)afterBrowser["results"][0]["leagueDivisionId"]==gold.Id&&Count(main.ID)==6,"Browser/import shared membership rules diverged.");
   checks.Add("Concurrent reversed bulk requests: "+successes+" committed, "+errors.Count+" rolled back; exactly one membership per player. Existing browser addition then import preserves the browser's division.");
   phase="edit division without changing identity or teams";
   int membershipId;using(var c=new DataContext()){membershipId=c.PlayersLeagues.Single(m=>m.LeagueID==main.ID&&m.PlayerID==players[0].Id).Id;var team=new LeagueTeam{LeagueID=main.ID,TeamName=prefix+"_Team",Division="Gold"};c.LeagueTeam.Add(team);c.SaveChanges();c.LeagueTeamPlayer.Add(new LeagueTeamPlayer{LeagueTeamId=team.Id,PlayerId=players[0].Id});c.SaveChanges();}
   var editInfo=Ok(controller.AvailableLeaguePlayers(main.ID,players[0].Id));Require(((JArray)editInfo["teams"]).Count==1,"Edit did not expose existing team assignment.");
   var current=gold.Id;foreach(var target in new[]{silver.Id,gold.Id,0,gold.Id}){var edit=Ok(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=target,ExpectedDivisionId=current}));Require((int)edit["membershipId"]==membershipId,"Edit replaced membership identity.");using(var c=new DataContext()){var m=c.PlayersLeagues.Single(x=>x.Id==membershipId);Require((m.LeagueDivisionId??0)==target&&m.PlayerID==players[0].Id,"Wrong division or identity.");Require(c.LeagueTeam.Single(t=>t.LeagueID==main.ID).Division=="Gold"&&c.LeagueTeamPlayer.Count(t=>t.PlayerId==players[0].Id)==1,"Edit modified team relationships.");}current=target;}
   Require(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=foreign.Id,ExpectedDivisionId=gold.Id}) is BadRequestObjectResult,"Foreign edit division allowed.");
   Require(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=silver.Id,ExpectedDivisionId=0}) is ConflictObjectResult,"Stale edit overwritten.");
   Require(Controller("Player").UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=silver.Id,ExpectedDivisionId=gold.Id}) is ForbidResult,"Unauthorized edit allowed.");
   checks.Add("Actual Gold→Silver→Gold→No Division→Gold edits retain membership and player IDs, existing team assignment and team division; foreign division, stale edit and unauthorized role rejected.");
   phase="create profile without membership";
   var created=Ok(controller.AddPlayerWithoutLeague(new Player{FirstName=prefix,LastName="ParticipantInline",Gender="Female"},main.ID));var createdId=(int)created["id"];playerIds.Add(createdId);Report(false);
   using(var c=new DataContext())Require(!c.PlayersLeagues.Any(m=>m.PlayerID==createdId),"Profile creation silently enrolled a player.");
   var same=Ok(controller.AddPlayerWithoutLeague(new Player{FirstName="  "+prefix+"  ",LastName=" ParticipantInline ",Gender="Female"},main.ID));Require((int)same["id"]==createdId,"Normalized duplicate profile was created.");
   Require(Controller("Player").AddPlayerWithoutLeague(new Player{FirstName=prefix,LastName="ParticipantDenied",Gender="Male"},main.ID) is ForbidResult,"Unauthorized import profile creation allowed.");
   Require(controller.AddPlayerWithoutLeague(new Player{FirstName=prefix,LastName="ParticipantInvalid",Gender="Invalid"},main.ID) is BadRequestObjectResult,"Invalid import gender accepted.");
   Ok(controller.ImportLeaguePlayers(main.ID,Request(createdId,silver.Id)));using(var c=new DataContext())Require(c.PlayersLeagues.Single(m=>m.LeagueID==main.ID&&m.PlayerID==createdId).LeagueDivisionId==silver.Id,"Separate confirmation did not enroll created profile correctly.");
   checks.Add("Existing profile API creates an independent profile only; normalized duplicate returns same ID; unauthorized/invalid requests rejected; separate import confirmation enrolls the created ID into Silver.");
   phase="global name edit and historical relationships";
   int historicalTeamId,historicalPlayerId,historicalScoreId,otherMembershipId;
   using(var c=new DataContext()){
    var otherMember=new PlayersLeague{LeagueID=other.ID,PlayerID=players[0].Id,LeagueDivisionId=foreign.Id};c.PlayersLeagues.Add(otherMember);
    var historical=new KingQueenTeam{LeagueID=main.ID,DateOfTeam=DateTime.Today.AddDays(-7),ScrambleNumber=1,ScrambleWithScoresToBeSaved=true};c.KingQueenTeam.Add(historical);c.SaveChanges();historicalTeamId=historical.Id;otherMembershipId=otherMember.Id;
    var linked=new KingQueenPlayer{KingQueenTeamId=historical.Id,PlayerId=players[0].Id,isSubScore=false};var score=new KingQueenRoundScores{KingQueenTeamId=historical.Id,RoundId=1,RoundScore=42,RoundWon=true};c.KingQueenPlayer.Add(linked);c.KingQueenRoundScores.Add(score);c.SaveChanges();historicalPlayerId=linked.Id;historicalScoreId=score.Id;
   }
   var renamedFirst=prefix+" X";var renamedLast="Participant O'Neill-De la Cruz";
   var rename=Ok(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=gold.Id,ExpectedDivisionId=gold.Id,FirstName="  "+renamedFirst+"  ",LastName="  "+renamedLast+"  ",ExpectedFirstName=prefix,ExpectedLastName="Participant1"}));
   Require((bool)rename["profileChanged"]&&(int)rename["membershipId"]==membershipId,"Name update replaced membership or failed to report profile change.");
   Require(controller.GetPlayers(other.ID).Single(p=>p.Id==players[0].Id).LastName==renamedLast,"Updated global name absent in another league read.");
   using(var c=new DataContext()){
    var p=c.Players.Single(x=>x.Id==players[0].Id);Require(p.FirstName==renamedFirst&&p.LastName==renamedLast&&p.Gender==players[0].Gender&&p.IsMale==players[0].IsMale,"Name edit changed unrelated profile fields or mishandled whitespace/punctuation.");
    Require(c.PlayersLeagues.Single(m=>m.Id==otherMembershipId).LeagueDivisionId==foreign.Id,"Name edit changed other membership.");
    Require(c.KingQueenPlayer.Single(k=>k.Id==historicalPlayerId).PlayerId==p.Id&&c.KingQueenRoundScores.Single(k=>k.Id==historicalScoreId).RoundScore==42&&c.KingQueenTeam.Single(k=>k.Id==historicalTeamId).ScrambleNumber==1,"Name edit changed historical identity, scramble or score.");
   }
   var badName=new LeaguePlayerDivisionRequest{DivisionId=gold.Id,ExpectedDivisionId=gold.Id,FirstName=prefix,LastName="Participant Unauthorized",ExpectedFirstName=renamedFirst,ExpectedLastName=renamedLast};
   Require(Controller("LegacyAdmin").UpdateLeaguePlayerDivision(main.ID,players[0].Id,badName) is ForbidResult,"Membership-management authority incorrectly granted global name editing.");
   Require(controller.UpdateLeaguePlayerDivision(other.ID,players[2].Id,badName) is NotFoundObjectResult,"Nonmember profile could be edited through an unrelated league.");
   Require(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=gold.Id,ExpectedDivisionId=gold.Id,FirstName=" ",LastName="Participant",ExpectedFirstName=renamedFirst,ExpectedLastName=renamedLast}) is BadRequestObjectResult,"Blank name accepted.");
   Require(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=gold.Id,ExpectedDivisionId=gold.Id,FirstName=prefix,LastName="Participant2",ExpectedFirstName=renamedFirst,ExpectedLastName=renamedLast}) is ConflictObjectResult,"Duplicate existing name not flagged.");
   Require(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=gold.Id,ExpectedDivisionId=gold.Id,FirstName=prefix,LastName="Participant Stale",ExpectedFirstName=prefix,ExpectedLastName="Participant1"}) is ConflictObjectResult,"Stale name overwrote a profile.");
   Require(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=foreign.Id,ExpectedDivisionId=gold.Id,FirstName=prefix,LastName="Participant Invalid Division",ExpectedFirstName=renamedFirst,ExpectedLastName=renamedLast}) is BadRequestObjectResult,"Foreign division accepted with profile update.");
   using(var c=new DataContext())Require(c.Players.Single(p=>p.Id==players[0].Id).LastName==renamedLast,"Rejected combined edit partially saved the profile.");
   Ok(controller.UpdateLeaguePlayerDivision(main.ID,players[0].Id,new LeaguePlayerDivisionRequest{DivisionId=gold.Id,ExpectedDivisionId=gold.Id,FirstName=prefix,LastName="Participant1",ExpectedFirstName=renamedFirst,ExpectedLastName=renamedLast}));
   Ok(controller.DeletePlayer(new Player{Id=players[5].Id,FirstName="stale",LastName="name"},main.LeagueName));using(var c=new DataContext())Require(c.Players.Any(p=>p.Id==players[5].Id)&&!c.PlayersLeagues.Any(m=>m.LeagueID==main.ID&&m.PlayerID==players[5].Id),"Removal failed to use ID or removed global profile.");
   checks.Add("Global first/last rename retains player/membership IDs, reflects in another league, preserves team/scramble/player/score relationships and unrelated profile fields. Blank/duplicate/stale names, unauthorized global editing, nonmember and foreign division rejected atomically. ID-based removal keeps global profile.");
   phase="cleanup";
  }catch(Exception e){failure=e;}
  finally{
   try{if(reportPath!=null){Cleanup();if(before!=null)Require(Snapshot()==before,"Unrelated data snapshot differs after cleanup.");checks.Add("Only run-owned memberships, divisions, leagues and synthetic players removed; final complete player/league/division/membership snapshot matches the pre-test snapshot.");}}
   catch(Exception e){failure=e;}
   if(reportPath!=null)Report(failure==null,failure==null?null:failure.GetType().Name+" during "+phase);
  }
  if(failure!=null){Console.Error.WriteLine("Player import database check failed during "+phase+" ("+failure.GetType().Name+"). Details withheld; see owned-fixture report.");return 1;}
  Console.WriteLine("PASS: approved localhost/LeagueScramblerDev; real membership writes, divisions, validation, concurrent duplicates, roster reconciliation and owned cleanup verified.");return 0;
 }
}

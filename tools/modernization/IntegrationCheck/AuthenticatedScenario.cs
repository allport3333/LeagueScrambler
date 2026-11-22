using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal sealed class AuthenticatedScenario
{
 const string Origin="https://localhost:5443";
 readonly string root,output,prefix="LSMod_"+Guid.NewGuid().ToString("N"),playerPrefix="Mod"+Guid.NewGuid().ToString("N").Substring(0,6);
 readonly List<int> users=new(),leagues=new(),players=new(),teams=new();
 readonly List<object> checks=new();
 string phase="fixture preparation",failedCheck,reportName="authorized-results.json";bool cleaned;
 LeagueType main,other;LeagueDivision gold,silver,foreign;List<Player> roster;List<LeagueTeam> seasonTeams;
 string password="É-Modernization-Test-"+Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
 SmtpClient smtp;
 string AdminEmail=>prefix+".admin@example.invalid";
 string ManagerEmail=>prefix+".manager@example.invalid";
 string PlayerEmail=>prefix+".player@example.invalid";
 AuthenticatedScenario(string root,string output,string recoveredPrefix=null,string recoveredPlayerPrefix=null){this.root=root;this.output=output;if(recoveredPrefix!=null)prefix=recoveredPrefix;if(recoveredPlayerPrefix!=null)playerPrefix=recoveredPlayerPrefix;}
 void Need(bool condition,string message){if(!condition){failedCheck=message;throw new InvalidOperationException(message);}}
 void Journal(bool pass=false,Exception error=null)=>File.WriteAllText(Path.Combine(output,reportName),JsonConvert.SerializeObject(new{
  pass,phase,prefix,playerPrefix,userIds=users,leagueIds=leagues,playerIds=players,teamIds=teams,checks,cleanupCompleted=cleaned,
  failedCheck,error=error?.GetType().Name,diagnosticStack=error?.StackTrace,sqlError=(error?.GetBaseException() as Microsoft.Data.SqlClient.SqlException)?.Number,authorization=DevelopmentAuthorization.Grant,
  actualHttp=true,authenticationMode="real synthetic account login; see individual check outcomes",database="LeagueScramblerDev",server="localhost",credentialsStored=false
 },Formatting.Indented));
 HttpClient Client(out CookieContainer cookies){cookies=new CookieContainer();return new HttpClient(new HttpClientHandler{
  CookieContainer=cookies,AllowAutoRedirect=false,
  ServerCertificateCustomValidationCallback=(request,cert,chain,errors)=>request.RequestUri.Host=="localhost"&&request.RequestUri.Port==5443
 }){BaseAddress=new Uri(Origin),Timeout=TimeSpan.FromSeconds(45)};}
 async Task<JToken> Request(HttpClient client,string method,string path,object body,int status=200,string origin=Origin){
  using var request=new HttpRequestMessage(new HttpMethod(method),path);
  if(origin!=null)request.Headers.Add("Origin",origin);
  if(body!=null)request.Content=new StringContent(JsonConvert.SerializeObject(body),Encoding.UTF8,"application/json");
  using var response=await client.SendAsync(request);
  Need((int)response.StatusCode==status,"HTTP "+method+" "+path+" expected "+status+", received "+(int)response.StatusCode);
  checks.Add(new{phase,method,path,status});var text=await response.Content.ReadAsStringAsync();
  if(text.Length==0)return JValue.CreateNull();try{return JToken.Parse(text);}catch(JsonReaderException){return new JValue(text);}
 }
 void Seed(){
  using var c=new DataContext();using var tx=c.Database.BeginTransaction();
  File.WriteAllText(Path.Combine(output,"user-model-properties.json"),JsonConvert.SerializeObject(c.Model.FindEntityType(typeof(User)).GetProperties().Select(p=>new{name=p.Name,shadow=p.IsShadowProperty()}),Formatting.Indented));
  Need(!c.Leagues.Any(l=>l.LeagueName.StartsWith(prefix))&&!c.Players.Any(p=>p.FirstName==playerPrefix),"Synthetic ownership prefix collision.");
  main=new LeagueType{LeagueName=prefix+"_Main"};other=new LeagueType{LeagueName=prefix+"_Other"};
  var admin=new RegistrationModel{Email=AdminEmail,Password=password,FirstName=playerPrefix,LastName="Administrator",UserRoleId=1}.ToUser();
  var manager=new RegistrationModel{Email=ManagerEmail,Password=password,FirstName=playerPrefix,LastName="Manager",UserRoleId=2}.ToUser();
  admin.LastLogin=manager.LastLogin=DateTime.Now;admin.IsAdmin=true;
  roster=Enumerable.Range(1,21).Select(i=>new Player{FirstName=playerPrefix,LastName="Player "+i.ToString("D2"),IsMale=i%2==0,Gender=i%2==0?"Male":"Female"}).ToList();
  c.Leagues.AddRange(main,other);c.Users.AddRange(admin,manager);c.Players.AddRange(roster);c.SaveChanges();
  leagues.AddRange(new[]{main.ID,other.ID});users.AddRange(new[]{admin.UserId,manager.UserId});players.AddRange(roster.Select(p=>p.Id));Journal();
  gold=new LeagueDivision{LeagueID=main.ID,Name="Gold",Code="G",SortOrder=1};silver=new LeagueDivision{LeagueID=main.ID,Name="Silver",Code="S",SortOrder=2};foreign=new LeagueDivision{LeagueID=other.ID,Name="Other",Code="O",SortOrder=1};
  c.LeagueDivision.AddRange(gold,silver,foreign);c.SaveChanges();
  seasonTeams=Enumerable.Range(0,16).Select(i=>new LeagueTeam{LeagueID=main.ID,TeamName=prefix+"_Team"+i.ToString("D2"),Division=i<8?"Gold":"Silver"}).ToList();
  c.LeagueTeam.AddRange(seasonTeams);c.UserLeagues.Add(new UserLeague{UserId=manager.UserId,LeagueTypeId=main.ID});
  c.PlayersLeagues.AddRange(roster.Take(18).Select((p,i)=>new PlayersLeague{PlayerID=p.Id,LeagueID=main.ID,LeagueDivisionId=i<9?gold.Id:silver.Id}));
  c.PlayersLeagues.Add(new PlayersLeague{PlayerID=roster[0].Id,LeagueID=other.ID,LeagueDivisionId=foreign.Id});
  c.SaveChanges();teams.AddRange(seasonTeams.Select(t=>t.Id));Journal();tx.Commit();
 }
 public static async Task Run(string root,string output,SmtpClient smtp){
  var test=new AuthenticatedScenario(root,output){smtp=smtp};Exception failure=null;
  try{test.Seed();await test.Check();}catch(Exception error){failure=error;}
  finally{try{test.Cleanup();}catch(Exception error){failure=error;}test.Journal(failure==null,failure);}
  if(failure!=null)throw new InvalidOperationException("Authenticated Development check failed; see sanitized artifact.",failure);
  Console.WriteLine("PASS: actual accounts/login, roles, membership/schedule/Scrambler persistence, reset single use, browser integration and owned cleanup.");
 }
 public static void RecoverCleanup(string root,string output){
  var saved=JObject.Parse(File.ReadAllText(Path.Combine(output,"authorized-results.json")));
  var prefix=(string)saved["prefix"];var playerPrefix=(string)saved["playerPrefix"];
  if((string)saved["authorization"]!=DevelopmentAuthorization.Grant||(string)saved["database"]!="LeagueScramblerDev"||
     !System.Text.RegularExpressions.Regex.IsMatch(prefix??"","^LSMod_[a-f0-9]{32}$")||!System.Text.RegularExpressions.Regex.IsMatch(playerPrefix??"","^Mod[a-f0-9]{6}$"))throw new InvalidOperationException("Unrecognized cleanup journal.");
  var test=new AuthenticatedScenario(root,output,prefix,playerPrefix){reportName="cleanup-recovery-results.json"};
  test.users.AddRange(saved["userIds"].ToObject<List<int>>());test.leagues.AddRange(saved["leagueIds"].ToObject<List<int>>());test.players.AddRange(saved["playerIds"].ToObject<List<int>>());test.teams.AddRange(saved["teamIds"].ToObject<List<int>>());
  test.Cleanup();test.Journal(true);Console.WriteLine("PASS: interrupted run's journal-owned fixtures removed; original failure journal preserved.");
 }
 async Task Check(){
  using var admin=Client(out var adminCookies);using var manager=Client(out _);using var player=Client(out _);using var anonymous=Client(out _);
  phase="actual registration and login";Journal();
  var registration=await Request(player,"POST","/api/Login/register",new{email=PlayerEmail,password,firstName=playerPrefix,lastName="Player Account",userRoleId=1});
  var playerUser=(int)registration["userId"];users.Add(playerUser);Journal();
  using(var c=new DataContext()){
   Need(c.Users.Single(u=>u.UserId==playerUser).UserRoleId==3,"Registration accepted an elevated role.");
   c.UsersPlayer.Add(new UsersPlayer{UserId=playerUser,PlayerId=roster[0].Id});c.SaveChanges();
  }
  await Request(anonymous,"POST","/api/Login/register",new{email=PlayerEmail,password,firstName=playerPrefix,lastName="Duplicate"},400);
  await Request(admin,"POST","/api/Login/login",new{email=AdminEmail,password,rememberMe=true});
  await Request(manager,"POST","/api/Login/login",new{email=ManagerEmail,password});
  await Request(anonymous,"POST","/api/Login/login",new{email=AdminEmail,password="Wrong-Test-Password"},400);
  await Request(anonymous,"POST","/api/Login/login",new{email=AdminEmail,password},403,"https://attacker.invalid");
  var cookie=adminCookies.GetCookies(new Uri(Origin)).Cast<Cookie>().Single(c=>c.Name==".AspNetCore.Cookies");
  Need(cookie.HttpOnly&&cookie.Secure,"Login cookie lost HTTP-only/secure flags.");
  foreach(var client in new[]{admin,manager,player}){var authenticated=await Request(client,"GET","/api/Login/isauthenticated",null);Need((bool)authenticated,"Actual login session not recognized.");}
  var role=await Request(admin,"GET","/api/Login/GetUsersRole",null);Need((string)role["role"]=="Admin","Administrator claim lost.");
  var managerLeagues=await Request(manager,"GET","/api/Login/getuserleagues",null);Need(managerLeagues.Count()==1&&(int)managerLeagues[0]["id"]==main.ID,"Manager league scope changed.");
  await Request(player,"GET","/api/Login/getuserleagues",null);
  phase="HTTP role and membership boundaries";Journal();
  foreach(var path in new[]{"/api/ScheduleManagement/"+main.ID,"/api/ScrambleData/AvailableLeaguePlayers/"+main.ID}){
   await Request(admin,"GET",path,null);await Request(manager,"GET",path,null);await Request(player,"GET",path,null,403);await Request(anonymous,"GET",path,null,401);
  }
  await Request(manager,"GET","/api/ScheduleManagement/"+other.ID,null,403);
  await Request(manager,"GET","/api/ScrambleData/AvailableLeaguePlayers/"+other.ID,null,403);
  await Request(admin,"POST","/api/ScrambleData/AddPlayer/"+Uri.EscapeDataString(main.LeagueName)+"?leagueDivisionId="+gold.Id+"&existingOnly=true&expectedLeagueId="+main.ID,new{Id=roster[18].Id});
  await Request(admin,"POST","/api/ScrambleData/AddPlayer/"+Uri.EscapeDataString(main.LeagueName)+"?leagueDivisionId="+gold.Id+"&existingOnly=true&expectedLeagueId="+main.ID,new{Id=roster[18].Id});
  await Request(admin,"POST","/api/ScrambleData/ImportLeaguePlayers/"+main.ID,new{players=new[]{new{playerId=roster[17].Id,divisionId=gold.Id},new{playerId=roster[19].Id,divisionId=silver.Id}}});
  int membership;
  using(var c=new DataContext())membership=c.PlayersLeagues.Single(m=>m.LeagueID==main.ID&&m.PlayerID==roster[0].Id).Id;
  await Request(admin,"PUT","/api/ScrambleData/LeaguePlayer/"+main.ID+"/"+roster[0].Id,new{divisionId=silver.Id,expectedDivisionId=gold.Id,firstName=playerPrefix,lastName="Player 01 Updated",expectedFirstName=playerPrefix,expectedLastName="Player 01"});
  using(var c=new DataContext()){
   var current=c.PlayersLeagues.Single(m=>m.Id==membership);Need(current.LeagueDivisionId==silver.Id&&current.PlayerID==roster[0].Id,"Membership identity changed.");
   Need(c.PlayersLeagues.Single(m=>m.LeagueID==other.ID&&m.PlayerID==roster[0].Id).LeagueDivisionId==foreign.Id,"Unrelated membership changed.");
   Need(c.Players.Single(p=>p.Id==roster[0].Id).LastName=="Player 01 Updated","Global profile update missing.");
  }
  await Request(manager,"PUT","/api/ScrambleData/LeaguePlayer/"+main.ID+"/"+roster[1].Id,new{divisionId=silver.Id,expectedDivisionId=gold.Id,firstName=playerPrefix,lastName="Unauthorized Rename",expectedFirstName=playerPrefix,expectedLastName=roster[1].LastName},403);
  await Request(admin,"PUT","/api/ScrambleData/LeaguePlayer/"+main.ID+"/"+roster[1].Id,new{divisionId=foreign.Id,expectedDivisionId=gold.Id},400);
  phase="HTTP schedule persistence";Journal();
  var state=await Request(admin,"GET","/api/ScheduleManagement/"+main.ID,null);
  var schedule=new ManagedScheduleRequest{Revision=(string)state["revision"],Mode="append"};
  for(var week=0;week<10;week++)foreach(var offset in new[]{0,8})for(var game=0;game<4;game++)schedule.Entries.Add(new ManagedScheduleEntry{Kind="game",WeekNumber=week+1,Date=new DateTime(2027,5,23).AddDays(week*7).ToString("yyyy-MM-dd"),Team1Id=seasonTeams[offset+game*2].Id,Team2Id=seasonTeams[offset+game*2+1].Id,Description="Owned HTTP fixture"});
  await Request(manager,"POST","/api/ScheduleManagement/"+main.ID,schedule);
  state=await Request(admin,"GET","/api/ScheduleManagement/"+main.ID,null);
  Need(state["entries"].Count()==80,"Saved HTTP schedule missing games.");
  schedule.Revision=(string)state["revision"];await Request(admin,"POST","/api/ScheduleManagement/"+main.ID,schedule,400);
  phase="HTTP Scrambler create/save/retrieve/score";Journal();
  var assignment=new KingQueenTeamsResponse{KingQueenTeams=Enumerable.Range(0,4).Select(i=>new KingQueenTeamWithPlayers{KingQueenTeam=new KingQueenTeam(),Players=roster.Skip(i*4).Take(4).ToList()}).ToList(),ByePlayers=roster.Skip(16).Take(2).ToList()};
  var generated=await Request(admin,"POST","/api/ScrambleData/GenerateScramble/"+main.LeagueName,assignment);
  Need(generated.Count()==4,"Scramble team creation missing IDs.");
  for(var i=0;i<4;i++)assignment.KingQueenTeams[i].KingQueenTeam=generated[i].ToObject<KingQueenTeam>();
  var saved=await Request(admin,"POST","/api/ScrambleData/SaveKingQueenTeams/"+main.LeagueName,assignment);
  var number=assignment.KingQueenTeams[0].KingQueenTeam.ScrambleNumber;
  var retrieved=await Request(admin,"GET","/api/ScrambleData/GetKingQueenTeamsByScrambleNumber/"+main.LeagueName+"/"+number,null);
  Need(retrieved["kingQueenTeams"].Count()==4,"Retrieved scramble missing teams.");
  await Request(admin,"POST","/api/ScrambleData/SaveKingQueenRoundScores/"+main.LeagueName,new KingQueenRoundScoresRequest{RoundScores=assignment.KingQueenTeams.Select((t,i)=>new KingQueenRoundScores{KingQueenTeamId=t.KingQueenTeam.Id,RoundId=1,RoundScore=i%2==0?21:17,RoundWon=i%2==0}).ToList(),KingQueenPlayers=new List<KingQueenPlayer>()});
  using(var c=new DataContext()){
   var ids=assignment.KingQueenTeams.Select(t=>t.KingQueenTeam.Id).ToList();Need(c.KingQueenRoundScores.Count(r=>ids.Contains(r.KingQueenTeamId))==4,"Round scores not persisted.");
   Need(c.KingQueenPlayer.Count(p=>ids.Contains(p.KingQueenTeamId))==16,"Saved player membership missing.");
  }
  // A new unscored scramble verifies editing without touching a scored result.
  foreach(var item in assignment.KingQueenTeams)item.KingQueenTeam=new KingQueenTeam();
  generated=await Request(admin,"POST","/api/ScrambleData/GenerateScramble/"+main.LeagueName,assignment);
  for(var i=0;i<4;i++)assignment.KingQueenTeams[i].KingQueenTeam=generated[i].ToObject<KingQueenTeam>();
  await Request(admin,"POST","/api/ScrambleData/SaveKingQueenTeams/"+main.LeagueName,assignment);
  var swap=assignment.KingQueenTeams[0].Players[0];assignment.KingQueenTeams[0].Players[0]=assignment.KingQueenTeams[1].Players[0];assignment.KingQueenTeams[1].Players[0]=swap;
  await Request(admin,"POST","/api/ScrambleData/SaveKingQueenTeams/"+main.LeagueName,assignment);
  // The original no-ID finalization path must still find the latest draft.
  foreach(var item in assignment.KingQueenTeams)item.KingQueenTeam=new KingQueenTeam();
  var legacyDraft=await Request(admin,"POST","/api/ScrambleData/GenerateScramble/"+main.LeagueName,assignment);
  var legacySaved=await Request(admin,"POST","/api/ScrambleData/SaveKingQueenTeams/"+main.LeagueName,assignment);
  Need(legacySaved["kingQueenTeams"].Count()==4,"Legacy no-ID finalization failed.");
  var manualScores=Enumerable.Range(0,4).Select(i=>new TeamScoreDto{LeagueId=main.ID,Date="2027-02-07",ScrambleNumber=0,
   Players=roster.Skip(i*4).Take(4).Select(p=>new PlayerDto{PlayerId=p.Id,isSubScore=false}).ToList(),
   RoundScores=new List<RoundScoreDto>{new RoundScoreDto{RoundId=1,RoundScore=i%2==0?21:17,RoundWon=i%2==0}}}).ToList();
  var createdScores=await Request(admin,"POST","/api/ScrambleData/SaveCreatedTeamScores",manualScores);
  var scoredTeams=(JArray)createdScores["updatedTeams"];Need(scoredTeams.Count==4&&scoredTeams.Select(t=>(int)t["scrambleNumber"]).Distinct().Count()==1,"Created-team score batch did not share one scramble number.");
  for(var i=0;i<4;i++){manualScores[i].KingQueenTeamId=(int)scoredTeams[i]["id"];manualScores[i].ScrambleNumber=(int)scoredTeams[i]["scrambleNumber"];}
  manualScores[0].RoundScores[0].RoundScore=22;
  await Request(admin,"POST","/api/ScrambleData/SaveCreatedTeamScores",manualScores);
  using(var c=new DataContext())Need(c.KingQueenRoundScores.Single(r=>r.KingQueenTeamId==manualScores[0].KingQueenTeamId&&r.RoundId==1).RoundScore==22,"Created-team score update did not retain the saved team ID.");
  phase="HTTP recovery single use";Journal();
  // SpecifiedPickupDirectory rejects SSL locally, so failure paths need no network transport.
  smtp.EnableSsl=true;
  await Request(anonymous,"POST","/api/Login/forgotpassword",new{email=ManagerEmail});
  using(var c=new DataContext())Need(c.Users.Where(u=>u.UserId==users[1]).Select(u=>u.ResetToken).Single()==null,"Failed delivery did not restore a null prior token.");
  var priorToken="v2."+DateTimeOffset.UtcNow.ToUnixTimeSeconds()+"."+Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
  using(var c=new DataContext()){var account=c.Users.Single(u=>u.UserId==users[0]);account.ResetToken=priorToken;c.SaveChanges();}
  await Request(anonymous,"POST","/api/Login/forgotpassword",new{email=AdminEmail});
  using(var c=new DataContext())Need(c.Users.Where(u=>u.UserId==users[0]).Select(u=>u.ResetToken).Single()==priorToken,"Failed delivery did not preserve the previous valid token.");
  priorToken=null;smtp.EnableSsl=false;
  var accepted=await Request(anonymous,"POST","/api/Login/forgotpassword",new{email=PlayerEmail});
  var unknown=await Request(anonymous,"POST","/api/Login/forgotpassword",new{email=prefix+".missing@example.invalid"});
  Need(JToken.DeepEquals(accepted,unknown),"Recovery response discloses account existence.");
  string token;using(var c=new DataContext())token=c.Users.Where(u=>u.UserId==playerUser).Select(u=>u.ResetToken).Single();
  Need(!string.IsNullOrEmpty(token),"Reset token not stored.");
  var pickup=Path.Combine(output,"smtp-pickup");var messages=Directory.GetFiles(pickup,"*.eml");Need(messages.Length==1,"Reset email not picked up locally.");
  var mime=File.ReadAllText(messages[0]);Need(mime.Contains("multipart/alternative")&&mime.Contains("text/html")&&mime.Contains("text/plain"),"Actual reset email lost HTML/plain alternatives.");
  var newPassword="É-New-Modernization-"+Convert.ToBase64String(RandomNumberGenerator.GetBytes(20));
  await Request(anonymous,"POST","/api/Login/resetpassword",new{token,password=newPassword});
  await Request(anonymous,"POST","/api/Login/resetpassword",new{token,password=newPassword},400);
  using(var c=new DataContext())Need(c.Users.Where(u=>u.UserId==playerUser).Select(u=>u.ResetToken).Single()==null,"Consumed reset token remains stored.");
  await Request(player,"POST","/api/Login/logout",new{});
  await Request(player,"POST","/api/Login/login",new{email=PlayerEmail,password},400);
  await Request(player,"POST","/api/Login/login",new{email=PlayerEmail,password=newPassword});
  phase="concurrent reset consumption";Journal();
  for(var attempt=0;attempt<5;attempt++){
   var concurrentToken="v2."+DateTimeOffset.UtcNow.ToUnixTimeSeconds()+"."+Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
   using(var c=new DataContext()){var account=c.Users.Single(u=>u.UserId==playerUser);account.ResetToken=concurrentToken;c.SaveChanges();}
   async Task<int> Submit(){using var request=new HttpRequestMessage(HttpMethod.Post,"/api/Login/resetpassword");request.Headers.Add("Origin",Origin);request.Content=new StringContent(JsonConvert.SerializeObject(new{token=concurrentToken,password=newPassword}),Encoding.UTF8,"application/json");using var response=await anonymous.SendAsync(request);return (int)response.StatusCode;}
   var statuses=await Task.WhenAll(Submit(),Submit());checks.Add(new{phase,path="/api/Login/resetpassword",statuses});
   Need(statuses.Count(s=>s==200)==1&&statuses.Count(s=>s==400)==1,"Concurrent submissions consumed one reset token more than once.");
  }
  // Remove the run-owned message after token use; never retain live tokens in diagnostics.
  foreach(var message in messages)File.Delete(message);token=null;mime=null;
  phase="actual authenticated browser";Journal();
  await Browser(adminCookies);
  using(var c=new DataContext()){
   Need(c.Players.Single(p=>p.Id==roster[20].Id).LastName=="Browser Updated","Browser profile edit was not persisted.");
   Need(c.PlayersLeagues.Single(m=>m.LeagueID==main.ID&&m.PlayerID==roster[20].Id).LeagueDivisionId==gold.Id,"Browser import destination division was not persisted.");
   Need(c.LeagueSchedule.Count(g=>g.LeagueId==main.ID)==96,"Browser-generated 16-game schedule was not appended to the original 80.");
  }
  phase="actual logout";
  await Request(admin,"POST","/api/Login/logout",new{});var signedOut=await Request(admin,"GET","/api/Login/isauthenticated",null);Need(!(bool)signedOut,"Logout session still authenticated.");
 }
 async Task Browser(CookieContainer cookies){
  var node=Path.Combine(root,"tests/functional/.tools/node-v22.23.5-win-x64/node.exe");
  var start=new ProcessStartInfo(node){WorkingDirectory=root,UseShellExecute=false,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true};
  start.ArgumentList.Add(Path.Combine(root,"tools/modernization/real-browser.cjs"));start.ArgumentList.Add(output);start.ArgumentList.Add("--stdin-fixture");
  start.Environment["PLAYWRIGHT_BROWSERS_PATH"]=Path.Combine(Directory.GetParent(root).FullName,"Allport's League Scrambler/tests/functional/.tools/browsers");
  using var process=Process.Start(start);
  await process.StandardInput.WriteAsync(JsonConvert.SerializeObject(new{origin=Origin,syntheticOnly=true,databaseBackedSyntheticAccount=true,allowMutations=true,leagueName=main.LeagueName,leagueId=main.ID,addPlayerName=playerPrefix+" Player 21",importPlayerName=playerPrefix+" Browser Updated",cookies=cookies.GetCookies(new Uri(Origin)).Cast<Cookie>().Select(c=>new{name=c.Name,value=c.Value,url=Origin,httpOnly=c.HttpOnly,secure=c.Secure,sameSite="Lax"})}));process.StandardInput.Close();
  var stdout=process.StandardOutput.ReadToEndAsync();var stderr=process.StandardError.ReadToEndAsync();await process.WaitForExitAsync();
  File.WriteAllText(Path.Combine(output,"browser-run.log"),(await stdout)+(await stderr));Need(process.ExitCode==0,"Actual authenticated browser verification failed; see browser artifacts.");
 }
 void Cleanup(){
  phase="owned cleanup";Journal();if(leagues.Count==0&&users.Count==0&&players.Count==0){cleaned=true;return;}
  using var c=new DataContext();using var tx=c.Database.BeginTransaction(System.Data.IsolationLevel.Serializable);
  // Recover a partial registration only for the exact new email, whose absence was guaranteed by our unique run prefix.
  var createdUser=c.Users.Where(u=>u.Email==PlayerEmail).Select(u=>u.UserId).SingleOrDefault();if(createdUser>0&&!users.Contains(createdUser))users.Add(createdUser);
  Need(c.Leagues.Count(l=>leagues.Contains(l.ID)&&l.LeagueName.StartsWith(prefix))==leagues.Count,"Cleanup league ownership mismatch.");
  Need(c.Users.Count(u=>users.Contains(u.UserId)&&u.Email.StartsWith(prefix))==users.Count,"Cleanup account ownership mismatch.");
  Need(c.Players.Count(p=>players.Contains(p.Id)&&p.FirstName==playerPrefix)==players.Count,"Cleanup player ownership mismatch.");
  Need(!c.PlayersLeagues.Any(m=>players.Contains(m.PlayerID)&&!leagues.Contains(m.LeagueID)),"Unrelated membership references a fixture player.");
  var kqIds=c.KingQueenTeam.Where(t=>leagues.Contains(t.LeagueID)).Select(t=>t.Id).ToList();var byeIds=c.ByeRounds.Where(b=>leagues.Contains(b.LeagueID)).Select(b=>b.Id).ToList();
  c.KingQueenRoundScores.RemoveRange(c.KingQueenRoundScores.Where(r=>kqIds.Contains(r.KingQueenTeamId)));
  c.KingQueenPlayer.RemoveRange(c.KingQueenPlayer.Where(p=>kqIds.Contains(p.KingQueenTeamId)));
  c.ByePlayer.RemoveRange(c.ByePlayer.Where(p=>byeIds.Contains(p.ByeRoundId)));c.SaveChanges();
  c.KingQueenTeam.RemoveRange(c.KingQueenTeam.Where(t=>kqIds.Contains(t.Id)));c.ByeRounds.RemoveRange(c.ByeRounds.Where(b=>byeIds.Contains(b.Id)));
  c.LeagueTeamScore.RemoveRange(c.LeagueTeamScore.Where(s=>teams.Contains(s.LeagueTeamId)&&teams.Contains(s.OpponentsLeagueTeamId)));
  c.LeagueSchedule.RemoveRange(c.LeagueSchedule.Where(g=>leagues.Contains(g.LeagueId)));
  c.LeagueScheduleEvent.RemoveRange(c.LeagueScheduleEvent.Where(e=>leagues.Contains(e.LeagueId)));
  c.LeagueTeamPlayer.RemoveRange(c.LeagueTeamPlayer.Where(p=>teams.Contains(p.LeagueTeamId)));
  c.PlayerSignIn.RemoveRange(c.PlayerSignIn.Where(p=>leagues.Contains(p.LeagueId)));
  c.KingQueenTopPlayer.RemoveRange(c.KingQueenTopPlayer.Where(p=>leagues.Contains(p.LeagueId)));
  c.UsersPlayer.RemoveRange(c.UsersPlayer.Where(p=>users.Contains(p.UserId)));c.UserLeagues.RemoveRange(c.UserLeagues.Where(u=>users.Contains(u.UserId)));c.SaveChanges();
  c.PlayersLeagues.RemoveRange(c.PlayersLeagues.Where(p=>leagues.Contains(p.LeagueID)));c.LeagueTeam.RemoveRange(c.LeagueTeam.Where(t=>teams.Contains(t.Id)));c.SaveChanges();
  c.LeagueDivision.RemoveRange(c.LeagueDivision.Where(d=>leagues.Contains(d.LeagueID)));c.LeagueSettings.RemoveRange(c.LeagueSettings.Where(s=>leagues.Contains(s.LeagueId)));c.SaveChanges();
  c.Players.RemoveRange(c.Players.Where(p=>players.Contains(p.Id)));c.Users.RemoveRange(c.Users.Where(u=>users.Contains(u.UserId)));c.Leagues.RemoveRange(c.Leagues.Where(l=>leagues.Contains(l.ID)));c.SaveChanges();tx.Commit();
  var pickup=Path.Combine(output,"smtp-pickup");if(Directory.Exists(pickup))foreach(var message in Directory.GetFiles(pickup,"*.eml"))File.Delete(message);
  cleaned=true;password=null;
 }
}

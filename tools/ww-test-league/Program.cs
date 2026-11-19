using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace LeagueHubDevelopmentSeed {
 public class AccountInfo { public int UserId; public string Email; public int? UserRoleId; public bool IsAdmin; public List<int> PlayerIds; }
 public class SeedPlan {
  public DateTime ReferenceDate; public int ReferenceLeagueId; public List<AccountInfo> Accounts; public List<int> Participants;
  public List<LeagueTeam> ReferenceTeams; public List<LeagueDivision> ReferenceDivisions; public Dictionary<string,string> Settings;
  public bool NeedsSeparateTestPlayer;
 }
 public static partial class Program {
  public const string Name="WW Test League",ReferenceName="WW Winter 2026",MarkerName="developmentSeedOwner",Marker="LeagueHub.WWTestLeague.v1.61dd5f63-4918-4297-a0cf-3de9918e9957";
  public const string RegularEmail="allport3333+test@gmail.com",AdminEmail="allport3333@gmail.com";
  static JObject authority; static int allowedLinkUser; static bool preparePlayer; static string reportPath;
  public static int Main(string[] args) {
   try {
    var values=new Dictionary<string,string>();for(int i=0;i<args.Length;i+=2){if(i+1>=args.Length)throw new Exception("Arguments require name/value pairs.");values.Add(args[i],args[i+1]);}
    var mode=values.ContainsKey("--mode")?values["--mode"]:"inspect";
    if(!new[]{"inspect","create","reset","remove","verify","selftest"}.Contains(mode))throw new Exception("Unknown seed operation.");
    reportPath=values["--report"];if(mode=="selftest"){SelfTest();return 0;}preparePlayer=values.ContainsKey("--prepare-test-player")&&values["--prepare-test-player"]=="true";
    var builder=new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION")??"");
    Require(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")=="Development"&&builder.DataSource=="localhost"&&builder.InitialCatalog=="LeagueScramblerDev"&&builder.IntegratedSecurity&&String.IsNullOrEmpty(builder.UserID)&&String.IsNullOrEmpty(builder.Password),"Only Development/localhost/LeagueScramblerDev/Windows authentication is accepted.");
    bool write=new[]{"create","reset","remove"}.Contains(mode);
    if(write){authority=JObject.Parse(File.ReadAllText(values["--authority"]));CheckAuthority();}
    var day=values.ContainsKey("--date")?DateTime.ParseExact(values["--date"],"yyyy-MM-dd",CultureInfo.InvariantCulture):AttendanceRules.EasternNow(DateTime.UtcNow).Date;
    using(var c=new DataContext()) {
     c.Database.OpenConnection();using(var triggers=c.Database.GetDbConnection().CreateCommand()){triggers.CommandText="SELECT COUNT(*) FROM sys.triggers WHERE parent_class=1 AND is_disabled=0";Require(Convert.ToInt32(triggers.ExecuteScalar())==0,"Enabled database triggers require review before any seed operation.");}using(var cmd=c.Database.GetDbConnection().CreateCommand()){cmd.CommandText="SELECT DB_NAME()";Require((string)cmd.ExecuteScalar()=="LeagueScramblerDev","Effective SQL database mismatch.");}
     var existing=c.Leagues.SingleOrDefault(l=>l.LeagueName==Name);
     if(existing!=null)Require(c.LeagueSettings.Any(s=>s.LeagueId==existing.ID&&s.SettingName==MarkerName&&s.SettingValue==Marker),"An unowned league already uses WW Test League. No changes made.");
     if(mode=="inspect"){var p=Plan(c,day);Report(new{mode,database="LeagueScramblerDev",leagueId=existing==null?(int?)null:existing.ID,referenceLeagueId=p.ReferenceLeagueId,accounts=p.Accounts,sharedPlayerConflict=p.NeedsSeparateTestPlayer,referenceParticipants=p.Participants.Count,teams=p.ReferenceTeams.Count,divisions=p.ReferenceDivisions.Select(d=>new{d.Code,d.Name}),settings=p.Settings,plannedWeeks=SeasonWeeks,completedWeeks=CompletedWeeks,kingQueenSessions=KqSessions});return 0;}
     if(mode=="verify"){Require(existing!=null,"Test league does not exist.");Report(Verify(c,existing.ID));return 0;}
     if(mode=="create"&&existing!=null){Report(new{mode="create",alreadyExists=true,verification=Verify(c,existing.ID)});return 0;}
     Require(mode!="reset"&&mode!="remove"||existing!=null,"No owned test league exists to reset/remove.");
     var plan=mode=="remove"?null:Plan(c,day);
     if(plan!=null&&plan.NeedsSeparateTestPlayer)Require(preparePlayer&&authority.Value<bool>("allowTestAccountRelink"),"Both accounts currently link to the same player. Explicit approval to prepare/relink only the regular test account is required before seeding.");
     var originalPlayerIds=c.Players.AsNoTracking().Select(p=>p.Id).ToList();var excludeLink=plan!=null&&plan.NeedsSeparateTestPlayer?plan.Accounts.Single(a=>a.Email==RegularEmail).UserId:0;
     using(var tx=c.Database.BeginTransaction(IsolationLevel.Serializable)) {
      c.Database.ExecuteSqlCommand("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'LeagueHub.WWTestLeague.v1', @LockMode=N'Exclusive', @LockOwner=N'Transaction', @LockTimeout=5000; IF @r<0 THROW 50000,'Test league seeding is already running',1;");
      // A second process cannot pass the name check and insert a duplicate after the initial inspection.
      existing=c.Leagues.SingleOrDefault(l=>l.LeagueName==Name);
      if(mode=="create")Require(existing==null,"Test league was created by another process; retry create to verify it.");
      if(existing!=null)Require(c.LeagueSettings.Any(s=>s.LeagueId==existing.ID&&s.SettingName==MarkerName&&s.SettingValue==Marker),"Seed ownership marker mismatch.");
      int id=existing==null?-1:existing.ID;var before=ProtectedHash(c,id,originalPlayerIds,excludeLink);
      if(mode=="remove"){Erase(c,id,true);Require(before==ProtectedHash(c,id,originalPlayerIds,excludeLink),"Unrelated data changed during removal; rolling back.");CheckAuthority();tx.Commit();Report(new{mode,removedLeagueId=id,sharedPlayersAndAccountsPreserved=true});return 0;}
      if(mode=="reset")Erase(c,id,false);
      if(existing==null){existing=new LeagueType{LeagueName=Name};c.Leagues.Add(existing);Save(c);id=existing.ID;}
      object accountSetup=null;
      if(plan.NeedsSeparateTestPlayer) {
       var test=plan.Accounts.Single(a=>a.Email==RegularEmail);Require(test.UserId==97&&plan.Accounts.Single(a=>a.Email==AdminEmail).UserId==1&&plan.Accounts.Single(a=>a.Email==AdminEmail).PlayerIds.Single()==1,"Explicitly approved account identities changed.");
       using(var check=c.Database.GetDbConnection().CreateCommand()){check.Transaction=c.Database.CurrentTransaction.GetDbTransaction();check.CommandText="SELECT COUNT(*) FROM sys.foreign_keys WHERE referenced_object_id=OBJECT_ID('dbo.UsersPlayer')";Require(Convert.ToInt32(check.ExecuteScalar())==0,"Account-link dependent records require review before relinking.");}
       var preservedHistory=new{leagueMemberships=c.PlayersLeagues.Count(m=>m.PlayerID==1),attendance=c.PlayerSignIn.Count(m=>m.PlayerId==1),teamMemberships=c.LeagueTeamPlayer.Count(m=>m.PlayerId==1),kingQueenMemberships=c.KingQueenPlayer.Count(m=>m.PlayerId==1),directTestAccountLeagueLinks=c.UserLeagues.Count(m=>m.UserId==97)};
       var link=c.UsersPlayer.Single(l=>l.UserId==test.UserId);
       Require(link.PlayerId==plan.Accounts.Single(a=>a.Email==AdminEmail).PlayerIds.Single(),"Test account relationship changed since inspection.");
       var player=new Player{FirstName="WW Test",LastName="Participant",IsMale=true,Gender="Male",IsSub=false};c.Players.Add(player);Save(c);
       allowedLinkUser=test.UserId;var previous=link.PlayerId;link.PlayerId=player.Id;Save(c);test.PlayerIds=new List<int>{player.Id};plan.Participants.Add(player.Id);
       accountSetup=new{userId=test.UserId,previousPlayerId=previous,createdPlayerId=player.Id,preservedHistory,note="Dedicated account setup persists after league reset/removal; shared profiles are never deleted."};
      }
      Seed(c,existing,plan);Require(before==ProtectedHash(c,id,originalPlayerIds,excludeLink),"Unrelated data changed during seeding; rolling back.");
      var verification=Verify(c,id);CheckAuthority();tx.Commit();Report(new{mode,accountSetup,verification,unrelatedRecordsUnchanged=true});return 0;
     }
    }
   }catch(Exception e){Console.Error.WriteLine("WW Test League operation failed; uncommitted changes rolled back: "+e.GetBaseException().Message);return 1;}
  }
  static void Require(bool condition,string message){if(!condition)throw new InvalidOperationException(message);}
  static void CheckAuthority(){
   Require(authority!=null&&authority.Value<string>("scope")=="ww-test-league"&&authority.Value<string>("database")=="LeagueScramblerDev"&&authority.Value<string>("server")=="localhost"&&authority.Value<DateTime>("expiresAt").ToUniversalTime()>DateTime.UtcNow,"Seed-specific authorization expired or invalid.");
   var identity=authority["identity"];var process=Process.GetProcessById(identity.Value<int>("pid"));Require(Math.Abs((process.StartTime.ToUniversalTime()-identity.Value<DateTime>("processStartUtc").ToUniversalTime()).TotalSeconds)<1,"Development app restarted.");
   foreach(var pair in new[]{new[]{"projectDll","dllSha256"},new[]{"envFile","envSha256"},new[]{"launchProfile","launchProfileSha256"}}) {
    var file=identity.Value<string>(pair[0]);if(String.IsNullOrEmpty(file))continue;
    Require(File.Exists(file)&&String.Equals(Hash(File.ReadAllBytes(file)),identity.Value<string>(pair[1]),StringComparison.OrdinalIgnoreCase),"Development process/configuration binding changed.");
   }
  }
  static string Hash(byte[] bytes){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
  static void Report(object report){Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(reportPath)));File.WriteAllText(reportPath,JsonConvert.SerializeObject(report,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(report,Formatting.Indented));}
  static void Save(DataContext c){
   Require(!c.ChangeTracker.Entries().Any(e=>e.State!=EntityState.Unchanged&&e.State!=EntityState.Detached&&(e.Entity is User||e.Entity is UserRoles||e.Entity is Password)),"Account, credentials, roles and shared administration records are not seed targets.");
   Require(!c.ChangeTracker.Entries<Player>().Any(e=>e.State==EntityState.Modified||e.State==EntityState.Deleted),"Existing player profiles are never modified/deleted.");
   Require(!c.ChangeTracker.Entries<Player>().Any(e=>e.State==EntityState.Added)||preparePlayer&&authority!=null&&authority.Value<bool>("allowTestAccountRelink"),"Creating a dedicated test player requires explicit account-setup authorization.");
   Require(!c.ChangeTracker.Entries<UsersPlayer>().Any(e=>e.State!=EntityState.Unchanged&&e.State!=EntityState.Detached&&(e.State!=EntityState.Modified||e.Entity.UserId!=allowedLinkUser)),"Only the explicitly authorized regular test account link may change.");c.SaveChanges();
  }
  static SeedPlan Plan(DataContext c,DateTime day){
   var reference=c.Leagues.AsNoTracking().SingleOrDefault(l=>l.LeagueName==ReferenceName);Require(reference!=null,"Reference league WW Winter 2026 is missing in the development database.");
   var accounts=c.Users.AsNoTracking().Where(u=>u.Email==RegularEmail||u.Email==AdminEmail).Select(u=>new AccountInfo{UserId=u.UserId,Email=u.Email,UserRoleId=u.UserRoleId,IsAdmin=u.IsAdmin}).ToList();
   Require(accounts.Count==2,"Both exact-email accounts must already be registered through the real application. No users or credentials are fabricated.");
   Require(accounts.Single(a=>a.Email==RegularEmail).UserRoleId==3&&!accounts.Single(a=>a.Email==RegularEmail).IsAdmin,"Regular test account must already have Player permissions; its role will not be changed.");
   Require(accounts.Single(a=>a.Email==AdminEmail).UserRoleId==1&&accounts.Single(a=>a.Email==AdminEmail).IsAdmin,"Administrator account permissions do not match the expected existing admin.");
   foreach(var a in accounts){a.PlayerIds=c.UsersPlayer.AsNoTracking().Where(l=>l.UserId==a.UserId).Select(l=>l.PlayerId).Distinct().ToList();Require(a.PlayerIds.Count==1&&c.Players.Any(p=>p.Id==a.PlayerIds[0]),"Each account requires one reliable existing player association before seed setup; no name matching is used.");}
   var ids=c.PlayersLeagues.AsNoTracking().Where(m=>m.LeagueID==reference.ID).Select(m=>m.PlayerID).Distinct().ToList();foreach(var a in accounts)if(!ids.Contains(a.PlayerIds[0]))ids.Add(a.PlayerIds[0]);
   Require(ids.Count>=48&&ids.Count<=96,"Expected a realistic 48-96 existing-player reference roster.");
   var teams=c.LeagueTeam.AsNoTracking().Where(t=>t.LeagueID==reference.ID&&(t.Division=="Gold"||t.Division=="Silver")).OrderBy(t=>t.Id).ToList();Require(teams.Count(t=>t.Division=="Gold")==8&&teams.Count(t=>t.Division=="Silver")==8,"Reference needs exactly eight teams in each division.");
   var settings=c.LeagueSettings.AsNoTracking().Where(s=>s.LeagueId==reference.ID).ToList();Require(settings.GroupBy(s=>s.SettingName).All(g=>g.Count()==1),"Reference setting names are duplicated.");
   var copy=settings.Where(s=>new[]{"numberOfSubsAllowed","dropLowest","subScorePercent","standingsType","dayOfLeague"}.Contains(s.SettingName)).ToDictionary(s=>s.SettingName,s=>s.SettingValue);
   Require(copy.Count==5&&copy["subScorePercent"]=="50"&&copy["numberOfSubsAllowed"]=="2"&&copy["dropLowest"]=="2"&&copy["standingsType"]=="matchup","Reference scoring settings differ; review the seed assumptions before continuing.");copy["dayOfLeague"]=day.DayOfWeek.ToString();
   return new SeedPlan{ReferenceDate=day.Date,ReferenceLeagueId=reference.ID,Accounts=accounts,Participants=ids.OrderBy(i=>i).ToList(),ReferenceTeams=teams,ReferenceDivisions=c.LeagueDivision.AsNoTracking().Where(d=>d.LeagueID==reference.ID).OrderBy(d=>d.SortOrder).ToList(),Settings=copy,NeedsSeparateTestPlayer=accounts[0].PlayerIds[0]==accounts[1].PlayerIds[0]};
  }
 }
}




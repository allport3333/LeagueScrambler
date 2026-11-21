using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Newtonsoft.Json;

namespace Allport_s_League_Scrambler.Controllers {
 [Route("api/ScheduleManagement")]
 [Authorize(Policy="LeagueManagement")]
 public class ScheduleManagementController:Controller {
  public class TeamInfo {public int Id;public string TeamName;public string DivisionKey;public string Division;}
  public class State {
   public List<LeagueDivision> Divisions;public List<TeamInfo> Teams;public List<LeagueSchedule> Games;public List<LeagueScheduleEvent> Events;
   public HashSet<int> Protected;public bool EventsAvailable;public string Revision;public int DefaultDay;
  }
  public static string Key(string value){return (value??"").Trim().Normalize(NormalizationForm.FormKC).ToLowerInvariant();}
  public static bool EventsExist(DataContext c){
   bool close=c.Database.GetDbConnection().State!=System.Data.ConnectionState.Open;
   if(close)c.Database.OpenConnection();try{using(var cmd=c.Database.GetDbConnection().CreateCommand()){
    var tx=c.Database.CurrentTransaction;if(tx!=null)cmd.Transaction=tx.GetDbTransaction();
    cmd.CommandText="SELECT CASE WHEN OBJECT_ID(N'dbo.LeagueScheduleEvent',N'U') IS NULL THEN 0 ELSE 1 END";return Convert.ToInt32(cmd.ExecuteScalar())==1;
   }}finally{if(close)c.Database.CloseConnection();}
  }
  public static State Read(DataContext c,int leagueId){
   var s=new State{Divisions=c.LeagueDivision.AsNoTracking().Where(d=>d.LeagueID==leagueId).OrderBy(d=>d.SortOrder).ThenBy(d=>d.Id).ToList(),Games=c.LeagueSchedule.AsNoTracking().Where(g=>g.LeagueId==leagueId).OrderBy(g=>g.Id).ToList()};
   s.Teams=c.LeagueTeam.AsNoTracking().Where(t=>t.LeagueID==leagueId).OrderBy(t=>t.Id).ToList().Select(t=>{
    var matches=s.Divisions.Where(candidate=>Key(candidate.Name)==Key(t.Division)||Key(candidate.Code)==Key(t.Division)).ToList();
    var d=matches.Count==1?matches[0]:null;return new TeamInfo{Id=t.Id,TeamName=t.TeamName,DivisionKey=d!=null?"d:"+d.Id:string.IsNullOrWhiteSpace(t.Division)?"none":"text:"+Key(t.Division),Division=d!=null?(string.IsNullOrWhiteSpace(d.Name)?d.Code:d.Name):t.Division??""};
   }).ToList();
   s.EventsAvailable=EventsExist(c);s.Events=s.EventsAvailable?c.LeagueScheduleEvent.AsNoTracking().Where(e=>e.LeagueId==leagueId).OrderBy(e=>e.Id).ToList():new List<LeagueScheduleEvent>();
   DayOfWeek weekday;var setting=c.LeagueSettings.Where(x=>x.LeagueId==leagueId&&x.SettingName=="dayOfLeague").Select(x=>x.SettingValue).FirstOrDefault();s.DefaultDay=Enum.TryParse(setting,true,out weekday)?(int)weekday:(int)DateTime.Today.DayOfWeek;
   var leagueTeamIds=s.Teams.Select(t=>t.Id).ToList();
   var scores=c.LeagueTeamScore.AsNoTracking().Where(x=>leagueTeamIds.Contains(x.LeagueTeamId)||leagueTeamIds.Contains(x.OpponentsLeagueTeamId)).Select(x=>new{x.LeagueTeamId,x.OpponentsLeagueTeamId,x.Date}).ToList();
   s.Protected=new HashSet<int>(s.Games.Where(g=>scores.Any(x=>x.Date.Date==g.Date.Date&&
    (leagueTeamIds.Contains(x.LeagueTeamId)&&leagueTeamIds.Contains(x.OpponentsLeagueTeamId)&&x.LeagueTeamId!=x.OpponentsLeagueTeamId
     ? (x.LeagueTeamId==g.Team1Id&&x.OpponentsLeagueTeamId==g.Team2Id||x.LeagueTeamId==g.Team2Id&&x.OpponentsLeagueTeamId==g.Team1Id)
     : (x.LeagueTeamId==g.Team1Id||x.LeagueTeamId==g.Team2Id||x.OpponentsLeagueTeamId==g.Team1Id||x.OpponentsLeagueTeamId==g.Team2Id)))).Select(g=>g.Id));
   using(var sha=SHA256.Create())s.Revision=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(new{s.Teams,divisions=s.Divisions.Select(d=>new{d.Id,d.Code,d.Name}),games=s.Games.Select(g=>new{g.Id,g.WeekNumber,g.Date,g.Team1Id,g.Team2Id,g.MatchDescription}),events=s.Events.Select(e=>new{e.Id,e.WeekNumber,e.Date,e.Title,e.EventType,e.DivisionKey}),locked=s.Protected.OrderBy(i=>i),s.EventsAvailable})))).Replace("-","");
   return s;
  }
  static string Day(DateTime d){return d.ToString("yyyy-MM-dd",CultureInfo.InvariantCulture);}
  public static object Context(State s,int leagueId){return new{leagueId,s.Revision,today=Day(DateTime.Today),s.DefaultDay,teams=s.Teams.Select(t=>new{t.Id,t.TeamName,t.DivisionKey,t.Division}),divisions=s.Divisions.Select(d=>new{d.Id,d.Name,d.Code}),eventsAvailable=s.EventsAvailable,
   entries=s.Games.Select(g=>new{g.Id,kind="game",g.WeekNumber,date=Day(g.Date),g.Team1Id,g.Team2Id,description=g.MatchDescription,divisionKey="",eventType="",isProtected=s.Protected.Contains(g.Id)}).Cast<object>().Concat(s.Events.Select(e=>(object)new{e.Id,kind="event",e.WeekNumber,date=Day(e.Date),team1Id=0,team2Id=0,description=e.Title,e.DivisionKey,e.EventType,isProtected=false})).ToList()};}
  [HttpGet("{leagueId:int}")]
  public IActionResult Get(int leagueId){using(var c=new DataContext()){if(!LeagueAccess.CanManage(User,c,leagueId))return Forbid();if(!c.Leagues.Any(l=>l.ID==leagueId))return NotFound();return Ok(Context(Read(c,leagueId),leagueId));}}
  static bool Changed(LeagueSchedule old,ManagedScheduleEntry entry,DateTime date){return old.WeekNumber!=entry.WeekNumber||old.Date.Date!=date.Date||old.Team1Id!=entry.Team1Id||old.Team2Id!=entry.Team2Id||(old.MatchDescription??"")!=(entry.Description??"");}
  public static DateTime CalendarWeekStart(DateTime date){return date.Date.AddDays(-((int)date.DayOfWeek+6)%7);}
  public static HashSet<int> ReplacementGameIds(State s,IEnumerable<ManagedScheduleEntry> preview,IEnumerable<string> scopes,DateTime today){var allowed=new HashSet<string>(scopes);var teams=s.Teams.ToDictionary(t=>t.Id);var windows=new Dictionary<string,List<DateTime>>();foreach(var e in preview.Where(e=>e.Kind=="game")){DateTime date;if(!DateTime.TryParseExact(e.Date,"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out date))continue;foreach(var id in new[]{e.Team1Id,e.Team2Id})if(teams.ContainsKey(id)&&allowed.Contains(teams[id].DivisionKey)){var key=teams[id].DivisionKey;if(!windows.ContainsKey(key))windows[key]=new List<DateTime>();windows[key].Add(date.Date);}}return new HashSet<int>(s.Games.Where(g=>g.Date.Date>=today.Date&&!s.Protected.Contains(g.Id)&&new[]{g.Team1Id,g.Team2Id}.All(id=>teams.ContainsKey(id)&&allowed.Contains(teams[id].DivisionKey)&&windows.ContainsKey(teams[id].DivisionKey)&&g.Date.Date>=windows[teams[id].DivisionKey].Min()&&g.Date.Date<=windows[teams[id].DivisionKey].Max())).Select(g=>g.Id));}
  static string Pair(int a,int b){return Math.Min(a,b)+":"+Math.Max(a,b);}
  [HttpPost("{leagueId:int}")][SameOrigin][RequestSizeLimit(2097152)]
  public IActionResult Save(int leagueId,[FromBody]ManagedScheduleRequest request){
   if(!ModelState.IsValid||request==null||request.Entries==null||request.Entries.Count>1000||request.Entries.Any(e=>e==null)||request.MaxGamesPerTeam<1||request.MaxGamesPerTeam>10||!new[]{"append","edit","replace-future"}.Contains(request.Mode)||request.DeleteGameIds==null||request.DeleteEventIds==null||request.ReplaceDivisions==null||request.CrossRules==null||request.CrossRules.Count>30)return BadRequest("Choose a valid schedule operation with at most 1000 entries and 1–10 games per team per week.");
   using(var c=new DataContext()){
    if(!LeagueAccess.CanManage(User,c,leagueId))return Forbid();
    if(!c.Leagues.Any(l=>l.ID==leagueId))return NotFound();
    if(request.DeleteGameIds.Count>1000||request.DeleteEventIds.Count>1000)return BadRequest("Remove at most 1000 records per operation.");
    using(var tx=c.Database.BeginTransaction(System.Data.IsolationLevel.Serializable)){
     c.Database.ExecuteSqlCommand("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={0}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000, 'Another schedule or score save is in progress. Reload before retrying.', 1;","LeagueScrambler:MatchupScores:"+leagueId);
     var s=Read(c,leagueId);if(s.Revision!=request.Revision)return Conflict(new{message="The schedule, teams or saved results changed. Reload before saving; nothing was overwritten."});
     var teams=s.Teams.ToDictionary(t=>t.Id);var divisions=new HashSet<string>(s.Teams.Select(t=>t.DivisionKey).Concat(s.Divisions.Select(d=>"d:"+d.Id)));
     if(request.CrossRules.Any(r=>r==null||r.Division1==r.Division2||!divisions.Contains(r.Division1)||!divisions.Contains(r.Division2)||r.EveryWeeks<1||r.EveryWeeks>104))return BadRequest("Choose valid division pairs and crossing frequency.");
     if(request.Mode!="edit"&&(request.Entries.Any(e=>e.Id!=0)||request.DeleteGameIds.Any()||request.DeleteEventIds.Any()))return BadRequest("Only Edit Schedule may update or explicitly delete existing records.");
     if(request.ReplaceDivisions.Any(d=>!divisions.Contains(d))||request.Mode=="replace-future"&&!request.ReplaceDivisions.Any())return BadRequest("Select the divisions whose future unplayed games may be replaced.");
     var remove=new HashSet<int>(request.DeleteGameIds);var removeEvents=new HashSet<int>(request.DeleteEventIds);
     if(remove.Any(id=>!s.Games.Any(g=>g.Id==id))||removeEvents.Any(id=>!s.Events.Any(e=>e.Id==id)))return BadRequest("A removed record does not belong to this league.");
     if(request.Mode=="replace-future")remove.UnionWith(ReplacementGameIds(s,request.Entries,request.ReplaceDivisions,DateTime.Today));
     if(remove.Any(s.Protected.Contains))return Conflict(new{message="Games with saved results cannot be removed."});
     var changes=new Dictionary<int,ManagedScheduleEntry>();var parsed=new Dictionary<ManagedScheduleEntry,DateTime>();
     foreach(var e in request.Entries){DateTime date;if(!DateTime.TryParseExact(e.Date,"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out date)||date.Year<1753||date.Year>9998||e.WeekNumber<1||e.WeekNumber>104||e.Id<0||(e.Description??"").Length>500)return BadRequest("Every row needs a valid ISO date, week 1–104 and short notes.");parsed[e]=date;
      if(e.Kind=="event"){
       if(!s.EventsAvailable)return BadRequest("Standalone events require the additive schedule-events migration.");
       if(string.IsNullOrWhiteSpace(e.Description)||e.Description.Length>200||!new[]{"Tournament","Playoffs","NoGames","Other"}.Contains(e.EventType)||!string.IsNullOrEmpty(e.DivisionKey)&&!divisions.Contains(e.DivisionKey))return BadRequest("Check the event title, type and division.");
       if(e.Id>0&&(!s.Events.Any(x=>x.Id==e.Id)||removeEvents.Contains(e.Id)))return BadRequest("An edited event does not belong to this league or is also deleted.");continue;
      }
      if(e.Kind!="game"||e.Team1Id==e.Team2Id||!teams.ContainsKey(e.Team1Id)||!teams.ContainsKey(e.Team2Id))return BadRequest("Each game requires two different teams from the selected league.");
      LeagueSchedule old=e.Id>0?s.Games.SingleOrDefault(g=>g.Id==e.Id):null;
      if(e.Id>0&&(old==null||remove.Contains(e.Id)))return BadRequest("An edited game does not belong to this league or is also deleted.");
      if(old!=null&&!Changed(old,e,date))continue;
      if(old!=null&&s.Protected.Contains(old.Id))return Conflict(new{message="Saved results protect this game's teams, date, week and notes. Nothing was changed."});
      var a=teams[e.Team1Id].DivisionKey;var b=teams[e.Team2Id].DivisionKey;
      if(a!=b&&(!request.AllowCrossDivision||!request.CrossRules.Any(r=>((r.Division1==a&&r.Division2==b)||(r.Division1==b&&r.Division2==a))&&(e.WeekNumber-1)%r.EveryWeeks==0)))return BadRequest("A cross-division game is not explicitly permitted for this week.");
      if(e.Id>0){if(changes.ContainsKey(e.Id))return BadRequest("An existing game occurs more than once in the request.");changes.Add(e.Id,e);}
     }
     if(request.Entries.Where(e=>e.Id>0).GroupBy(e=>e.Kind+":"+e.Id).Any(g=>g.Count()>1))return BadRequest("An existing record occurs more than once in the request.");
     var final=s.Games.Where(g=>!remove.Contains(g.Id)&&!changes.ContainsKey(g.Id)).Select(g=>new ManagedScheduleEntry{Id=g.Id,Kind="game",WeekNumber=g.WeekNumber,Date=Day(g.Date),Team1Id=g.Team1Id,Team2Id=g.Team2Id}).Concat(request.Entries.Where(e=>e.Kind=="game"&&(e.Id==0||changes.ContainsKey(e.Id)))).ToList();
     var touched=request.Entries.Where(e=>e.Kind=="game"&&(e.Id==0||changes.ContainsKey(e.Id))).ToList();
     Func<ManagedScheduleEntry,string> describe=g=>(g.Id>0?"saved game #"+g.Id:"preview game")+" ("+g.Date+", "+(teams.ContainsKey(g.Team1Id)?teams[g.Team1Id].TeamName:"Team #"+g.Team1Id)+" v "+(teams.ContainsKey(g.Team2Id)?teams[g.Team2Id].TeamName:"Team #"+g.Team2Id)+")";
     var calendarPeriods=final.Select(g=>g.Date).Distinct().ToDictionary(d=>d,d=>CalendarWeekStart(DateTime.ParseExact(d,"yyyy-MM-dd",CultureInfo.InvariantCulture)));
     foreach(var e in touched){var duplicate=final.FirstOrDefault(g=>!ReferenceEquals(g,e)&&g.Date==e.Date&&Pair(g.Team1Id,g.Team2Id)==Pair(e.Team1Id,e.Team2Id));if(duplicate!=null)return BadRequest(new{message=teams[e.Team1Id].TeamName+" v "+teams[e.Team2Id].TeamName+" on "+e.Date+" duplicates "+describe(duplicate)+". Remove the duplicate or choose another date."});
      var period=CalendarWeekStart(parsed[e]);foreach(var team in new[]{e.Team1Id,e.Team2Id}){var appearances=final.Where(g=>calendarPeriods[g.Date]==period&&(g.Team1Id==team||g.Team2Id==team)).ToList();if(appearances.Count>request.MaxGamesPerTeam){var others=appearances.Where(g=>!ReferenceEquals(g,e)).ToList();return BadRequest(new{message=teams[team].TeamName+" on "+e.Date+" exceeds the "+request.MaxGamesPerTeam+" game(s) per team limit for calendar week "+Day(period)+" to "+Day(period.AddDays(6))+". Conflicts with "+string.Join("; ",others.Take(3).Select(describe))+(others.Count>3?" and "+(others.Count-3)+" more games":"")+". Move a game to another calendar week, remove an eligible unplayed game, or explicitly increase the weekly limit."});}}
     }
     var finalEvents=s.Events.Where(e=>!removeEvents.Contains(e.Id)&&!request.Entries.Any(x=>x.Kind=="event"&&x.Id==e.Id)).Select(e=>new ManagedScheduleEntry{Kind="event",WeekNumber=e.WeekNumber,Date=Day(e.Date),Description=e.Title,EventType=e.EventType,DivisionKey=e.DivisionKey}).Concat(request.Entries.Where(e=>e.Kind=="event")).ToList();
     if(finalEvents.GroupBy(e=>e.Date+"|"+Key(e.Description)+"|"+(e.DivisionKey??"")).Any(g=>g.Count()>1))return BadRequest("Duplicate special events require review.");
     if(touched.Any(g=>finalEvents.Any(e=>e.EventType=="NoGames"&&e.Date==g.Date&&(string.IsNullOrEmpty(e.DivisionKey)||teams[g.Team1Id].DivisionKey==e.DivisionKey||teams[g.Team2Id].DivisionKey==e.DivisionKey))))return BadRequest("A game conflicts with a No Games event.");
     if(request.Entries.Any(e=>e.Kind=="event"&&e.EventType=="NoGames"&&final.Any(g=>g.Date==e.Date&&(string.IsNullOrEmpty(e.DivisionKey)||teams[g.Team1Id].DivisionKey==e.DivisionKey||teams[g.Team2Id].DivisionKey==e.DivisionKey))))return BadRequest("A No Games event conflicts with existing matchups.");
     c.LeagueSchedule.RemoveRange(c.LeagueSchedule.Where(g=>g.LeagueId==leagueId&&remove.Contains(g.Id)));
     if(s.EventsAvailable)c.LeagueScheduleEvent.RemoveRange(c.LeagueScheduleEvent.Where(e=>e.LeagueId==leagueId&&removeEvents.Contains(e.Id)));
     foreach(var e in request.Entries){if(e.Kind=="event"){
       var target=e.Id>0?c.LeagueScheduleEvent.Single(x=>x.Id==e.Id&&x.LeagueId==leagueId):new LeagueScheduleEvent{LeagueId=leagueId};if(e.Id==0)c.LeagueScheduleEvent.Add(target);target.WeekNumber=e.WeekNumber;target.Date=parsed[e];target.Title=e.Description.Trim();target.EventType=e.EventType;target.DivisionKey=e.DivisionKey;
      }else if(e.Id==0||changes.ContainsKey(e.Id)){
       var target=e.Id>0?c.LeagueSchedule.Single(g=>g.Id==e.Id&&g.LeagueId==leagueId):new LeagueSchedule{LeagueId=leagueId};if(e.Id==0)c.LeagueSchedule.Add(target);target.WeekNumber=e.WeekNumber;target.Date=parsed[e].Add(e.Id>0?target.Date.TimeOfDay:TimeSpan.Zero);target.Team1Id=e.Team1Id;target.Team2Id=e.Team2Id;target.MatchDescription=e.Description??"";
      }}
     c.SaveChanges();tx.Commit();return Ok(new{message="Schedule saved.",atomic=true,context=Context(Read(c,leagueId),leagueId),removedGames=remove.Count,removedEvents=removeEvents.Count});
    }
   }
  }
  // Existing public schedule contract is retained; standalone events are additive.
  public static object PublicSchedule(DataContext c,int leagueId){var s=Read(c,leagueId);var teams=s.Teams.ToDictionary(t=>t.Id);
   return s.Games.Select(g=>new{g.WeekNumber,date=g.Date}).Concat(s.Events.Select(e=>new{e.WeekNumber,date=e.Date})).Distinct().OrderBy(w=>w.date).ThenBy(w=>w.WeekNumber).Select(w=>new{w.WeekNumber,w.date,
    matches=s.Games.Where(g=>g.WeekNumber==w.WeekNumber&&g.Date==w.date).Select(g=>new{scheduleId=g.Id,g.Team1Id,g.Team2Id,team1Name=teams.ContainsKey(g.Team1Id)?teams[g.Team1Id].TeamName:"Unavailable team",team2Name=teams.ContainsKey(g.Team2Id)?teams[g.Team2Id].TeamName:"Unavailable team",g.MatchDescription,team1Division=teams.ContainsKey(g.Team1Id)?teams[g.Team1Id].Division:"",team2Division=teams.ContainsKey(g.Team2Id)?teams[g.Team2Id].Division:"",division=teams.ContainsKey(g.Team1Id)&&teams.ContainsKey(g.Team2Id)?teams[g.Team1Id].DivisionKey==teams[g.Team2Id].DivisionKey?teams[g.Team1Id].Division:teams[g.Team1Id].Division+" / "+teams[g.Team2Id].Division:""}).ToList(),
    events=s.Events.Where(e=>e.WeekNumber==w.WeekNumber&&e.Date==w.date).Select(e=>new{e.Id,e.Title,e.EventType,e.DivisionKey,division=s.Teams.FirstOrDefault(t=>t.DivisionKey==e.DivisionKey)?.Division??s.Divisions.Where(d=>"d:"+d.Id==e.DivisionKey).Select(d=>d.Name??d.Code).FirstOrDefault()??""}).ToList()}).ToList();
  }
 }
}

using System;
using System.Collections.Generic;
using System.Linq;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.EntityFrameworkCore;

namespace LeagueHubDevelopmentSeed {
 public static partial class Program {
  const int CompletedWeeks=6,SeasonWeeks=12,KqSessions=6;
  static void Seed(DataContext c,LeagueType league,SeedPlan plan) {
   foreach(var setting in plan.Settings)c.LeagueSettings.Add(new LeagueSettings{LeagueId=league.ID,League=league,SettingName=setting.Key,SettingValue=setting.Value});
   c.LeagueSettings.Add(new LeagueSettings{LeagueId=league.ID,League=league,SettingName=MarkerName,SettingValue=Marker});
   c.LeagueSettings.Add(new LeagueSettings{LeagueId=league.ID,League=league,SettingName="developmentSeedReferenceDate",SettingValue=plan.ReferenceDate.ToString("yyyy-MM-dd")});
   c.UserLeagues.Add(new UserLeague{UserId=plan.Accounts.Single(a=>a.Email==AdminEmail).UserId,LeagueTypeId=league.ID,LeagueType=league});
   c.LeagueSignInLocked.Add(new LeagueSignInLocked{LeagueId=league.ID,LeagueType=league,SignInLocked=false});
   var divisions=plan.ReferenceDivisions.Select(d=>new LeagueDivision{LeagueID=league.ID,LeagueType=league,Code=d.Code,Name=d.Name,SortOrder=d.SortOrder}).ToList();c.LeagueDivision.AddRange(divisions);
   var teams=plan.ReferenceTeams.OrderBy(t=>t.Division=="Gold"?0:1).ThenBy(t=>t.Id).Select(t=>new LeagueTeam{LeagueID=league.ID,Division=t.Division,TeamName=t.TeamName}).ToList();c.LeagueTeam.AddRange(teams);Save(c);
   var ids=plan.Participants.Distinct().ToList();var people=c.Players.AsNoTracking().Where(p=>ids.Contains(p.Id)).ToList();Require(people.Count==ids.Count,"A participant player record is missing.");
   int regular=plan.Accounts.Single(a=>a.Email==RegularEmail).PlayerIds.Single(),admin=plan.Accounts.Single(a=>a.Email==AdminEmail).PlayerIds.Single();Require(regular!=admin,"Separate account player identities required.");
   var rosters=BuildRosters(people,regular,admin,0,8,0);var subs=people.Where(p=>p.Id!=regular&&p.Id!=admin).OrderByDescending(p=>p.Id).Take(4).Select(p=>p.Id).ToList();
   var membership=new Dictionary<int,PlayersLeague>();
   for(int i=0;i<teams.Count;i++)foreach(var player in rosters[i]) {
    var division=player.IsMale?divisions.SingleOrDefault(d=>d.Code==(teams[i].Division=="Gold"?"GM":"SM")):null;
    var link=new PlayersLeague{LeagueID=league.ID,LeagueType=league,PlayerID=player.Id,LeagueDivision=division,IsSub=subs.Contains(player.Id)};membership.Add(player.Id,link);c.PlayersLeagues.Add(link);c.LeagueTeamPlayer.Add(new LeagueTeamPlayer{LeagueTeamId=teams[i].Id,PlayerId=player.Id});
   }
   Save(c);var schedule=new List<LeagueSchedule>();
   for(int week=0;week<SeasonWeeks;week++)for(int division=0;division<2;division++) {
    var group=teams.Skip(division*8).Take(8).ToList();for(int round=0;round<week%7;round++){var last=group[7];group.RemoveAt(7);group.Insert(1,last);}
    for(int match=0;match<4;match++) {
     var one=group[match];var two=group[7-match];if(week%2==1){var swap=one;one=two;two=swap;}
     var day=plan.ReferenceDate.AddDays((week-CompletedWeeks)*7);var record=new LeagueSchedule{LeagueId=league.ID,WeekNumber=week+1,Date=day,Team1Id=one.Id,Team2Id=two.Id,MatchDescription=one.TeamName+" vs "+two.TeamName};schedule.Add(record);c.LeagueSchedule.Add(record);
     if(week<CompletedWeeks)for(int game=0;game<3;game++) {
      bool oneWins=(week*11+division*7+match*5+game*game*3+game)%11<6;int loser=3+(week*7+match*2+game*3+division)%12;
      c.LeagueTeamScore.Add(new LeagueTeamScore{LeagueTeamId=one.Id,OpponentsLeagueTeamId=two.Id,Date=day,TeamScore=oneWins?15:loser,WonGame=oneWins});
      c.LeagueTeamScore.Add(new LeagueTeamScore{LeagueTeamId=two.Id,OpponentsLeagueTeamId=one.Id,Date=day,TeamScore=oneWins?loser:15,WonGame=!oneWins});
     }
    }
   }
   Save(c);
   // Cached team totals use the same saved WonGame predicates as existing persistence, not invented standings totals.
   foreach(var team in teams){team.TotalWins=c.LeagueTeamScore.Count(s=>s.LeagueTeamId==team.Id&&s.WonGame);team.TotalLosses=c.LeagueTeamScore.Count(s=>s.LeagueTeamId==team.Id&&!s.WonGame);}Save(c);
   for(int session=0;session<KqSessions;session++) {
    var date=plan.ReferenceDate.AddDays((session-KqSessions)*7);var players=BuildRosters(people,regular,admin,1,0,7919+session);
    for(int i=0;i<16;i++) {
     var team=new KingQueenTeam{LeagueID=league.ID,DateOfTeam=date,ScrambleNumber=session+1,ScrambleWithScoresToBeSaved=true};c.KingQueenTeam.Add(team);Save(c);
     var members=players[i].Select(player=>new KingQueenPlayer{KingQueenTeamId=team.Id,PlayerId=player.Id,isSubScore=subs.Contains(player.Id)}).ToList();c.KingQueenPlayer.AddRange(members);
     int raw=0;for(int round=1;round<=5;round++){bool firstWins=(session*7+i/2*11+round*round*3+round)%13<7;bool won=i%2==0?firstWins:!firstWins;int points=won?20:(session*5+i/2*3+round*2)%20;raw+=points;c.KingQueenRoundScores.Add(new KingQueenRoundScores{KingQueenTeamId=team.Id,RoundId=round,RoundScore=points,RoundWon=won});}
     Save(c);foreach(var member in members)c.PlayerScore.Add(new PlayerScore{PlayersLeagueID=membership[member.PlayerId].Id,KingQueenPlayerId=member.Id,Date=date,PlayersTotalLeagueScore=raw});Save(c);
    }
   }
   var now=AttendanceRules.EasternNow(DateTime.UtcNow);
   for(int week=0;week<CompletedWeeks;week++)foreach(var player in people)c.PlayerSignIn.Add(new PlayerSignIn{LeagueId=league.ID,PlayerId=player.Id,DateTime=plan.ReferenceDate.AddDays((week-CompletedWeeks)*7).AddHours(18),LockedSignIn=false});
   foreach(var player in people.Where(p=>p.Id!=regular&&p.Id!=admin).OrderBy(p=>p.Id).Take(8))c.PlayerSignIn.Add(new PlayerSignIn{LeagueId=league.ID,PlayerId=player.Id,DateTime=plan.ReferenceDate==now.Date?now:plan.ReferenceDate.AddHours(18),LockedSignIn=false});
   Save(c);
  }
  static void SelfTest() {
   var people=Enumerable.Range(1,64).Select(id=>new Player{Id=id,FirstName="Seed",LastName=id.ToString(),IsMale=id<=47,Gender=id<=47?"Male":"Female"}).ToList();int cases=0;
   foreach(var seed in Enumerable.Range(0,7)) {
    var groups=BuildRosters(people,1,2,seed==0?0:1,seed==0?8:0,seed==0?0:7919+seed);
    Require(groups.Count==16&&groups.All(g=>g.Count==4),"Pure roster size test failed.");Require(groups.FindIndex(g=>g.Any(p=>p.Id==1))!=groups.FindIndex(g=>g.Any(p=>p.Id==2)),"Account participants shared a team.");cases++;
   }
   foreach(int week in Enumerable.Range(0,12)) {
    var order=Enumerable.Range(0,8).ToList();for(int n=0;n<week%7;n++){int last=order[7];order.RemoveAt(7);order.Insert(1,last);}var pairs=Enumerable.Range(0,4).Select(i=>new[]{order[i],order[7-i]}).ToList();Require(pairs.SelectMany(p=>p).Distinct().Count()==8&&pairs.All(p=>p[0]!=p[1]),"Round-robin pairing test failed.");cases++;
   }
   Report(new{mode="selftest",passedCases=cases,databaseOpened=false,checks=new[]{"16 unique four-player teams and separate account participants across all seven roster variants","Every team plays once per round-robin week; no self pairing"}});
  }
  static List<List<Player>> BuildRosters(List<Player> people,int regular,int admin,int regularTeam,int adminTeam,int seed) {
   var groups=Enumerable.Range(0,16).Select(i=>new List<Player>()).ToList();groups[regularTeam].Add(people.Single(p=>p.Id==regular));groups[adminTeam].Add(people.Single(p=>p.Id==admin));var limit=(int)Math.Ceiling(people.Count/16d);var random=new Random(seed);
   var remaining=people.Where(p=>p.Id!=regular&&p.Id!=admin).Select(p=>new{Player=p,Key=random.Next()}).OrderBy(p=>p.Player.IsMale?1:0).ThenBy(p=>p.Key).Select(p=>p.Player).ToList();int start=0;
   foreach(var player in remaining){var next=Enumerable.Range(0,16).Select(offset=>(start+offset)%16).Where(i=>groups[i].Count<limit).OrderBy(i=>groups[i].Count).First();groups[next].Add(player);start=(next+1)%16;}
   Require(groups.All(g=>g.Count>=3&&g.Count<=6),"Seed rosters must remain realistic 3-6 person teams.");Require(groups.SelectMany(g=>g).Select(p=>p.Id).Distinct().Count()==people.Count,"Duplicate player/team association in seed roster.");return groups;
  }
 }
}

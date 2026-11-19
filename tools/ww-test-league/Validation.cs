using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace LeagueHubDevelopmentSeed {
 public static partial class Program {
  static void Erase(DataContext c,int id,bool removeLeague) {
   var teams=c.LeagueTeam.Where(t=>t.LeagueID==id).Select(t=>t.Id).ToList();var kq=c.KingQueenTeam.Where(t=>t.LeagueID==id).Select(t=>t.Id).ToList();
   var memberships=c.PlayersLeagues.Where(m=>m.LeagueID==id).Select(m=>m.Id).ToList();var kp=c.KingQueenPlayer.Where(p=>kq.Contains(p.KingQueenTeamId)).Select(p=>p.Id).ToList();
   Require(!c.LeagueSchedule.Any(s=>s.LeagueId!=id&&(teams.Contains(s.Team1Id)||teams.Contains(s.Team2Id))),"Another league references these teams; refusing cleanup.");
   Require(!c.LeagueTeamScore.Any(s=>teams.Contains(s.LeagueTeamId)!=teams.Contains(s.OpponentsLeagueTeamId)),"A cross-league score references these teams; refusing cleanup.");
   Require(!c.PlayerScore.Any(s=>s.KingQueenPlayerId.HasValue&&kp.Contains(s.KingQueenPlayerId.Value)&&!memberships.Contains(s.PlayersLeagueID)),"A shared historical score references this league; refusing cleanup.");
   c.PlayerScore.RemoveRange(c.PlayerScore.Where(s=>memberships.Contains(s.PlayersLeagueID)));Save(c);
   var byes=c.ByeRounds.Where(b=>b.LeagueID==id).Select(b=>b.Id).ToList();c.ByePlayer.RemoveRange(c.ByePlayer.Where(p=>byes.Contains(p.ByeRoundId)));c.ByeRounds.RemoveRange(c.ByeRounds.Where(b=>b.LeagueID==id));
   c.KingQueenRoundScores.RemoveRange(c.KingQueenRoundScores.Where(r=>kq.Contains(r.KingQueenTeamId)));c.KingQueenPlayer.RemoveRange(c.KingQueenPlayer.Where(p=>kq.Contains(p.KingQueenTeamId)));Save(c);
   c.KingQueenTeam.RemoveRange(c.KingQueenTeam.Where(t=>t.LeagueID==id));c.KingQueenTopPlayer.RemoveRange(c.KingQueenTopPlayer.Where(p=>p.LeagueId==id));
   c.LeagueTeamScore.RemoveRange(c.LeagueTeamScore.Where(s=>teams.Contains(s.LeagueTeamId)));c.LeagueSchedule.RemoveRange(c.LeagueSchedule.Where(s=>s.LeagueId==id));c.LeagueTeamPlayer.RemoveRange(c.LeagueTeamPlayer.Where(p=>teams.Contains(p.LeagueTeamId)));Save(c);
   c.LeagueTeam.RemoveRange(c.LeagueTeam.Where(t=>t.LeagueID==id));c.PlayerSignIn.RemoveRange(c.PlayerSignIn.Where(s=>s.LeagueId==id));c.PlayersLeagues.RemoveRange(c.PlayersLeagues.Where(p=>p.LeagueID==id));Save(c);
   c.LeagueDivision.RemoveRange(c.LeagueDivision.Where(d=>d.LeagueID==id));c.LeagueSettings.RemoveRange(c.LeagueSettings.Where(s=>s.LeagueId==id));c.LeagueSignInLocked.RemoveRange(c.LeagueSignInLocked.Where(s=>s.LeagueId==id));c.UserLeagues.RemoveRange(c.UserLeagues.Where(l=>l.LeagueTypeId==id));Save(c);
   if(removeLeague){c.Leagues.Remove(c.Leagues.Single(l=>l.ID==id));Save(c);}
  }
  static string ProtectedHash(DataContext c,int ownedId,List<int> originalPlayers,int excludedLinkUser) {
   var foreignTeams=c.LeagueTeam.AsNoTracking().Where(t=>t.LeagueID!=ownedId).Select(t=>t.Id).ToList();var foreignKq=c.KingQueenTeam.AsNoTracking().Where(t=>t.LeagueID!=ownedId).Select(t=>t.Id).ToList();var foreignMemberships=c.PlayersLeagues.AsNoTracking().Where(m=>m.LeagueID!=ownedId).Select(m=>m.Id).ToList();var foreignByes=c.ByeRounds.AsNoTracking().Where(b=>b.LeagueID!=ownedId).Select(b=>b.Id).ToList();
   var value=new Dictionary<string,object>{
    {"players",c.Players.AsNoTracking().OrderBy(p=>p.Id).ToList().Where(p=>originalPlayers.Contains(p.Id)).ToList()},
    {"users",c.Users.AsNoTracking().OrderBy(u=>u.UserId).Select(u=>new{u.UserId,u.Email,u.FirstName,u.LastName,u.UserRoleId,u.IsAdmin,u.CreatedAt}).ToList()},
    {"roles",c.UserRoles.AsNoTracking().OrderBy(r=>r.UserRoleId).ToList()},
    {"accountLinks",c.UsersPlayer.AsNoTracking().Where(l=>l.UserId!=excludedLinkUser).OrderBy(l=>l.UsersPlayerId).ToList()},
    {"leagues",c.Leagues.AsNoTracking().Where(l=>l.ID!=ownedId).OrderBy(l=>l.ID).ToList()},
    {"memberships",c.PlayersLeagues.AsNoTracking().Where(m=>m.LeagueID!=ownedId).OrderBy(m=>m.Id).ToList()},
    {"divisions",c.LeagueDivision.AsNoTracking().Where(d=>d.LeagueID!=ownedId).OrderBy(d=>d.Id).ToList()},
    {"owners",c.UserLeagues.AsNoTracking().Where(l=>l.LeagueTypeId!=ownedId).OrderBy(l=>l.UserLeagueId).ToList()},
    {"settings",c.LeagueSettings.AsNoTracking().Where(s=>s.LeagueId!=ownedId).OrderBy(s=>s.LeagueSettingsId).ToList()},
    {"teams",c.LeagueTeam.AsNoTracking().Where(t=>t.LeagueID!=ownedId).OrderBy(t=>t.Id).ToList()},
    {"teamPlayers",c.LeagueTeamPlayer.AsNoTracking().Where(p=>foreignTeams.Contains(p.LeagueTeamId)).OrderBy(p=>p.Id).ToList()},
    {"teamScores",c.LeagueTeamScore.AsNoTracking().Where(s=>foreignTeams.Contains(s.LeagueTeamId)).OrderBy(s=>s.Id).ToList()},
    {"schedule",c.LeagueSchedule.AsNoTracking().Where(s=>s.LeagueId!=ownedId).OrderBy(s=>s.Id).ToList()},
    {"kq",c.KingQueenTeam.AsNoTracking().Where(t=>t.LeagueID!=ownedId).OrderBy(t=>t.Id).ToList()},
    {"kqPlayers",c.KingQueenPlayer.AsNoTracking().Where(p=>foreignKq.Contains(p.KingQueenTeamId)).OrderBy(p=>p.Id).ToList()},
    {"kqScores",c.KingQueenRoundScores.AsNoTracking().Where(r=>foreignKq.Contains(r.KingQueenTeamId)).OrderBy(r=>r.Id).ToList()},
    {"legacyScores",c.PlayerScore.AsNoTracking().Where(s=>foreignMemberships.Contains(s.PlayersLeagueID)).OrderBy(s=>s.Id).ToList()},
    {"byes",c.ByeRounds.AsNoTracking().Where(b=>b.LeagueID!=ownedId).OrderBy(b=>b.Id).ToList()},
    {"byePlayers",c.ByePlayer.AsNoTracking().Where(b=>foreignByes.Contains(b.ByeRoundId)).OrderBy(b=>b.Id).ToList()},
    {"attendance",c.PlayerSignIn.AsNoTracking().Where(s=>s.LeagueId!=ownedId).OrderBy(s=>s.PlayerSignInId).ToList()},
    {"attendanceLocks",c.LeagueSignInLocked.AsNoTracking().Where(s=>s.LeagueId!=ownedId).OrderBy(s=>s.Id).ToList()},
    {"topPlayerPreferences",c.KingQueenTopPlayer.AsNoTracking().Where(p=>p.LeagueId!=ownedId).OrderBy(p=>p.Id).ToList()}
   };
   return Hash(Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(value)));
  }
  static object Verify(DataContext c,int leagueId) {
   Require(c.LeagueSettings.Count(s=>s.LeagueId==leagueId&&s.SettingName==MarkerName&&s.SettingValue==Marker)==1,"Seed marker missing/duplicated.");
   var members=c.PlayersLeagues.AsNoTracking().Where(m=>m.LeagueID==leagueId).ToList();var ids=members.Select(m=>m.PlayerID).ToList();Require(ids.Count==ids.Distinct().Count(),"Duplicate league membership.");
   var teams=c.LeagueTeam.AsNoTracking().Where(t=>t.LeagueID==leagueId).ToList();var teamIds=teams.Select(t=>t.Id).ToList();var roster=c.LeagueTeamPlayer.AsNoTracking().Where(p=>teamIds.Contains(p.LeagueTeamId)).ToList();Require(teams.Count==16&&roster.Count==ids.Count&&roster.Select(p=>p.PlayerId).Distinct().Count()==ids.Count,"Invalid team/roster graph.");
   var schedule=c.LeagueSchedule.AsNoTracking().Where(s=>s.LeagueId==leagueId).OrderBy(s=>s.WeekNumber).ThenBy(s=>s.Id).ToList();Require(schedule.Count==SeasonWeeks*8&&schedule.Select(s=>s.WeekNumber).Distinct().Count()==SeasonWeeks,"Incomplete season schedule.");
   Require(schedule.All(s=>s.Team1Id!=s.Team2Id&&teamIds.Contains(s.Team1Id)&&teamIds.Contains(s.Team2Id)),"Schedule references an unrelated/missing team.");
   Require(schedule.GroupBy(s=>new{s.WeekNumber,s.Team1Id,s.Team2Id}).All(g=>g.Count()==1),"Duplicate scheduled matchup.");
   Require(schedule.GroupBy(s=>s.WeekNumber).All(w=>w.SelectMany(s=>new[]{s.Team1Id,s.Team2Id}).Distinct().Count()==16),"Every team must play once per week.");
   var scores=c.LeagueTeamScore.AsNoTracking().Where(s=>teamIds.Contains(s.LeagueTeamId)).ToList();Require(scores.Count==CompletedWeeks*8*6,"Incorrect completed-game record count.");
   foreach(var match in schedule.Where(s=>s.WeekNumber<=CompletedWeeks)) {
    var one=scores.Where(s=>s.LeagueTeamId==match.Team1Id&&s.OpponentsLeagueTeamId==match.Team2Id&&s.Date.Date==match.Date.Date).ToList();var two=scores.Where(s=>s.LeagueTeamId==match.Team2Id&&s.OpponentsLeagueTeamId==match.Team1Id&&s.Date.Date==match.Date.Date).ToList();
    Require(one.Count==3&&two.Count==3&&one.Count(s=>s.WonGame)+two.Count(s=>s.WonGame)==3,"Saved results inconsistent with scheduled match/date.");
   }
   Require(teams.All(t=>t.TotalWins==scores.Count(s=>s.LeagueTeamId==t.Id&&s.WonGame)&&t.TotalLosses==scores.Count(s=>s.LeagueTeamId==t.Id&&!s.WonGame)),"Team cached records disagree with games.");Require(teams.Select(t=>t.TotalWins).Distinct().Count()>1,"Team performance must vary.");
   var kq=c.KingQueenTeam.AsNoTracking().Where(t=>t.LeagueID==leagueId).ToList();var kqIds=kq.Select(t=>t.Id).ToList();var kp=c.KingQueenPlayer.AsNoTracking().Where(p=>kqIds.Contains(p.KingQueenTeamId)).ToList();var rounds=c.KingQueenRoundScores.AsNoTracking().Where(r=>kqIds.Contains(r.KingQueenTeamId)).ToList();
   Require(kq.Count==KqSessions*16&&rounds.Count==kq.Count*5&&kp.Count==ids.Count*KqSessions,"Incomplete King/Queen history.");
   Require(kq.GroupBy(t=>t.ScrambleNumber).All(g=>g.Count()==16)&&kp.All(p=>ids.Contains(p.PlayerId)),"King/Queen membership scope mismatch.");
   foreach(var group in kq.GroupBy(t=>t.ScrambleNumber)) {
    var ordered=group.OrderBy(t=>t.Id).ToList();for(int i=0;i<16;i+=2)for(int round=1;round<=5;round++){var a=rounds.Single(r=>r.KingQueenTeamId==ordered[i].Id&&r.RoundId==round);var b=rounds.Single(r=>r.KingQueenTeamId==ordered[i+1].Id&&r.RoundId==round);Require(a.RoundWon==(a.RoundScore>b.RoundScore)&&b.RoundWon==(b.RoundScore>a.RoundScore)&&a.RoundWon!=b.RoundWon,"Invalid original King/Queen round winners.");}
   }
   var legacy=c.PlayerScore.AsNoTracking().Where(s=>members.Select(m=>m.Id).Contains(s.PlayersLeagueID)).ToList();Require(legacy.Count==ids.Count*KqSessions&&legacy.All(s=>s.KingQueenPlayerId.HasValue&&kp.Any(p=>p.Id==s.KingQueenPlayerId.Value&&s.PlayersTotalLeagueScore==rounds.Where(r=>r.KingQueenTeamId==p.KingQueenTeamId).Sum(r=>r.RoundScore))),"Legacy history differs from saved rounds.");
   var today=AttendanceRules.EasternNow(DateTime.UtcNow);var day=c.LeagueSettings.Where(s=>s.LeagueId==leagueId&&s.SettingName=="dayOfLeague").Select(s=>s.SettingValue).Single();bool locked=c.LeagueSignInLocked.Any(s=>s.LeagueId==leagueId&&s.SignInLocked);
   var accounts=c.Users.AsNoTracking().Where(u=>u.Email==RegularEmail||u.Email==AdminEmail).Select(u=>new{u.UserId,u.Email,u.UserRoleId,u.IsAdmin}).ToList().Select(u=>{
    var pid=c.UsersPlayer.Where(l=>l.UserId==u.UserId).Select(l=>l.PlayerId).Single();Require(ids.Contains(pid),"Test account is not a participant.");var own=roster.Single(r=>r.PlayerId==pid);var team=teams.Single(t=>t.Id==own.LeagueTeamId);var next=schedule.Where(s=>s.Date.Date>=today.Date&&(s.Team1Id==team.Id||s.Team2Id==team.Id)).OrderBy(s=>s.Date).FirstOrDefault();
    return new{u.UserId,u.Email,u.UserRoleId,u.IsAdmin,playerId=pid,teamId=team.Id,teamName=team.TeamName,division=team.Division,nextWeek=next==null?(int?)null:next.WeekNumber,nextDate=next==null?(DateTime?)null:next.Date,attendanceAvailable=AttendanceRules.UnavailableReason(true,locked,day,today)==null};
   }).ToList();Require(accounts.Select(a=>a.playerId).Distinct().Count()==2,"The accounts must have separate player identities.");
   return new{leagueName=Name,leagueId,players=ids.Count,teams=teams.Count,divisions=c.LeagueDivision.Count(d=>d.LeagueID==leagueId),scheduledWeeks=SeasonWeeks,scheduledMatchups=schedule.Count,completedWeeks=CompletedWeeks,teamGameScoreRows=scores.Count,kingQueenSessions=KqSessions,kingQueenTeams=kq.Count,kingQueenPlayerRows=kp.Count,kingQueenRoundRows=rounds.Count,legacyPlayerScoreRows=legacy.Count,attendanceRows=c.PlayerSignIn.Count(s=>s.LeagueId==leagueId),settings=c.LeagueSettings.Where(s=>s.LeagueId==leagueId&&s.SettingName!=MarkerName).Select(s=>new{s.SettingName,s.SettingValue}).ToList(),accounts,limitations=new[]{"Scheduled game records have team/opponent/date but no explicit game-pair identifier; historical results use the existing team-grouped presentation.","Schedule and saved King/Queen models have no persisted start-time/location/court fields. No values were fabricated.","The dedicated player/account association, if explicitly prepared, remains after league removal; shared player records and accounts are never deleted."}};
  }
 }
}

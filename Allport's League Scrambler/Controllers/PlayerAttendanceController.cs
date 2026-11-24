using System;
using System.Data;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Allport_s_League_Scrambler.Controllers
{
 [Route("api/PlayerAttendance")]
 [Authorize(AuthenticationSchemes=CookieAuthenticationDefaults.AuthenticationScheme)]
 public class PlayerAttendanceController:Controller
 {
  public class AttendanceState {
   public bool Visible {get;set;} public bool IsOwnProfile {get;set;} public bool SignedIn {get;set;}
   public bool CanSignIn {get;set;} public bool CanRemove {get;set;} public string Reason {get;set;} public string Date {get;set;}
  }
  private async Task<AttendanceState> ReadState(DataContext context,int leagueId,int playerId,DateTime now) {
   var state=new AttendanceState {Date=now.ToString("yyyy-MM-dd")};int userId;
   if(!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value,out userId))return state;
   var linked=await context.UsersPlayer.Where(link=>link.UserId==userId).Select(link=>link.PlayerId).Distinct().ToListAsync();
   state.IsOwnProfile=linked.Contains(playerId);state.Visible=state.IsOwnProfile||linked.Count==0;
   if(!state.IsOwnProfile){state.Reason=linked.Count==0?"Your account has no linked player profile.":null;return state;}
   if(await context.Leagues.AnyAsync(league=>league.ID==leagueId&&league.EventTypeId==2)){
    state.Reason="Use Tournament Check In for this event.";return state;
   }
   var member=await context.PlayersLeagues.AnyAsync(link=>link.PlayerID==playerId&&link.LeagueID==leagueId);
   var locked=await context.LeagueSignInLocked.AnyAsync(value=>value.LeagueId==leagueId&&value.SignInLocked);
   var day=await context.LeagueSettings.Where(value=>value.LeagueId==leagueId&&value.SettingName=="dayOfLeague").Select(value=>value.SettingValue).FirstOrDefaultAsync();
   var start=now.Date;var end=start.AddDays(1);
   var count=await context.PlayerSignIn.CountAsync(record=>record.PlayerId==playerId&&record.LeagueId==leagueId&&record.DateTime>=start&&record.DateTime<end);
   state.SignedIn=count>0;state.Reason=AttendanceRules.UnavailableReason(member,locked,day,now);
   if(count>1&&state.Reason==null)state.Reason="Multiple attendance records require administrator review.";
   state.CanSignIn=state.Reason==null&&count==0;state.CanRemove=state.Reason==null&&count==1;
   return state;
  }
  [HttpGet("{leagueId:int}/{playerId:int}")]
  public async Task<IActionResult> Status(int leagueId,int playerId) {
   if(leagueId<=0||playerId<=0)return BadRequest();
   using(var context=new DataContext())return Ok(await ReadState(context,leagueId,playerId,AttendanceRules.EasternNow(DateTime.UtcNow)));
  }
  [HttpPost("{leagueId:int}/{playerId:int}")]
  [SameOrigin]
  public Task<IActionResult> SignIn(int leagueId,int playerId) {return Change(leagueId,playerId,false);}
  [HttpDelete("{leagueId:int}/{playerId:int}")]
  [SameOrigin]
  public Task<IActionResult> Remove(int leagueId,int playerId) {return Change(leagueId,playerId,true);}
  private async Task<IActionResult> Change(int leagueId,int playerId,bool remove) {
   if(leagueId<=0||playerId<=0)return BadRequest();
   using(var context=new DataContext())
   using(var transaction=context.Database.BeginTransaction(IsolationLevel.Serializable)) {
    var now=AttendanceRules.EasternNow(DateTime.UtcNow);
    await AttendanceSerialization.Acquire(context,leagueId,now.Date);
    var state=await ReadState(context,leagueId,playerId,now);
    if(!state.IsOwnProfile)return Forbid();
    if(state.Reason!=null)return StatusCode(423,new {message=state.Reason});
    var start=now.Date;var end=start.AddDays(1);
    if(remove){
     var row=await context.PlayerSignIn.SingleOrDefaultAsync(record=>record.PlayerId==playerId&&record.LeagueId==leagueId&&record.DateTime>=start&&record.DateTime<end);
     if(row!=null){context.PlayerSignIn.Remove(row);await context.SaveChangesAsync();}
    }else{
     if(state.SignedIn)return Conflict(new {message="Already signed in for tonight."});
     context.PlayerSignIn.Add(new PlayerSignIn {PlayerId=playerId,LeagueId=leagueId,DateTime=now,LockedSignIn=false});
     await context.SaveChangesAsync();
    }
    transaction.Commit();return NoContent();
   }
  }
 }
}

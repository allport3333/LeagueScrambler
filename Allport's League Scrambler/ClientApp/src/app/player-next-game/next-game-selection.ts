// Schedule dates are SQL calendar dates, not instants. Do not shift them through UTC.
export function scheduleDateKey(value: any): string {
 const match=/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(String(value||''));if(!match)return null;
 const check=new Date(Date.UTC(+match[1],+match[2]-1,+match[3]));
 return check.getUTCFullYear()===+match[1]&&check.getUTCMonth()===+match[2]-1&&check.getUTCDate()===+match[3]?match.slice(1).join('-'):null;
}
// Current leagues use the application's Eastern local calendar, including DST.
export function leagueToday(now=new Date()): string {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('/');
 return parts[2]+'-'+parts[0]+'-'+parts[1];
}
export function selectNextGames(playerId:number,teams:any[],schedule:any[],today=leagueToday()):any {
 const own=teams.filter(team=>team.id>0&&(team.players||[]).some(player=>player.id===playerId));
 const ids=new Set(own.map(team=>team.id));const games:any[]=[];const seen=new Set<string>();
 schedule.forEach(week=>{const date=scheduleDateKey(week.date);if(!date||date<today)return;
  (week.matches||[]).forEach((match,index)=>{
   const first=ids.has(match.team1Id),second=ids.has(match.team2Id);if(!first&&!second)return;
   if(!(match.team1Id>0&&match.team2Id>0)||match.team1Id===match.team2Id)return;
   const key=match.scheduleId>0?'id:'+match.scheduleId:week.weekNumber+':'+date+':'+index;
   if(seen.has(key))return;seen.add(key);
   const team=own.find(team=>team.id===(first?match.team1Id:match.team2Id));
   games.push({date,weekNumber:week.weekNumber,scheduleId:match.scheduleId,teamId:team.id,teamName:team.teamName,
    opponentName:second&&first?match.team1Name+' / '+match.team2Name:(first?match.team2Name:match.team1Name),
    bothTeams:first&&second,division:team.division||match.division||null,match});
  });
 });
 games.sort((a,b)=>a.date.localeCompare(b.date)||a.weekNumber-b.weekNumber||(a.scheduleId||0)-(b.scheduleId||0));
 const next=games.length?games.filter(game=>game.date===games[0].date):[];
 return {hasTeam:own.length>0,hasSchedule:schedule.length>0,games:next,weeks:next.filter((game,index)=>next.findIndex(other=>other.weekNumber===game.weekNumber&&other.date===game.date)===index)};
}

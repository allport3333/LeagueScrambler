// Pure scheduling/import validation. No persistence or framework dependencies.
export interface ScheduleTeam { id:number;teamName:string;divisionKey:string;division:string; }
export interface ScheduleEntry {id:number;kind:string;weekNumber:number;date:string;team1Id:number;team2Id:number;description:string;divisionKey:string;eventType:string;isProtected?:boolean;original?:string;source?:string;sourceDivision?:string;sourceTeam1?:string;sourceTeam2?:string;issues?:string[];conflicts?:ScheduleConflict[];key?:number;expanded?:boolean;}
export interface ScheduleConflict {rule:string;teamId?:number;date:string;savedGameId?:number;message:string;}
// A displayed Week label may restart. Weekly limits use ISO calendar weeks, Monday?Sunday.
export function calendarWeekStart(value:string):string {const day=isoDay(value);if(!day)return '';const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10);}
export function calendarWeekEnd(value:string):string {const start=calendarWeekStart(value);if(!start)return '';const date=new Date(start+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+6);return date.toISOString().slice(0,10);}
export function replacementGameIds(preview:ScheduleEntry[],saved:ScheduleEntry[],teams:ScheduleTeam[],scopes:string[],today:string):number[]{const lookup=new Map(teams.map(t=>[t.id,t] as [number,ScheduleTeam])),windows=new Map<string,string[]>();preview.filter(e=>e.kind==='game'&&isoDay(e.date)).forEach(e=>[lookup.get(e.team1Id),lookup.get(e.team2Id)].filter(Boolean).forEach(t=>{if(scopes.includes(t.divisionKey)){const dates=windows.get(t.divisionKey)||[];dates.push(e.date);windows.set(t.divisionKey,dates);}}));windows.forEach(dates=>dates.sort());return saved.filter(e=>e.kind==='game'&&!e.isProtected&&e.date>=today&&[e.team1Id,e.team2Id].every(id=>{const team=lookup.get(id),dates=team&&windows.get(team.divisionKey);return dates&&scopes.includes(team.divisionKey)&&e.date>=dates[0]&&e.date<=dates[dates.length-1];})).map(e=>e.id);}
export interface DivisionPlan {key:string;included:boolean;weeks:number;firstDate:string;day:number;games:number;}
export interface CrossRule {division1:string;division2:string;everyWeeks:number;games:number;}
export const normalize=(s:any)=>String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export const pair=(a:any,b:any)=>[String(a),String(b)].sort().join('|');
export function shuffle<T>(values:T[],random:()=>number=Math.random):T[]{const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function isoDay(value:string,format='iso',excel=false):string {
 let y:number,m:number,d:number;let match;
 if(excel&&/^\d{4,5}(\.\d+)?$/.test(String(value))){const date=new Date(Date.UTC(1899,11,30)+Math.floor(Number(value))*86400000);return date.toISOString().slice(0,10);}
 if(match=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/.exec(String(value))){y=+match[1];m=+match[2];d=+match[3];}
 else if(format!=='iso'&&(match=/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(String(value).trim()))){y=+match[3];if(y<100)y+=2000;m=+match[format==='mdy'?1:2];d=+match[format==='mdy'?2:1];}
 else return '';
 const date=new Date(Date.UTC(y,m-1,d));if(y<1753||y>9998||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return '';
 return date.toISOString().slice(0,10);
}
export function entrySignature(e:ScheduleEntry):string{return JSON.stringify([e.kind,e.weekNumber,e.date,e.team1Id,e.team2Id,e.description||'',e.divisionKey||'',e.eventType||'']);}
export function changed(e:ScheduleEntry):boolean{return !e.id||e.original!==entrySignature(e);}
export function blankEntry(date='',week=1,division=''):ScheduleEntry{return {id:0,kind:'game',weekNumber:week,date,team1Id:0,team2Id:0,description:'',divisionKey:division,eventType:'Other'};}
function dates(plan:DivisionPlan,excluded:Set<string>):string[]{
 if(!isoDay(plan.firstDate)||!Number.isInteger(plan.weeks)||plan.weeks<1||plan.weeks>104||!Number.isInteger(plan.day)||plan.day<0||plan.day>6||!Number.isInteger(plan.games)||plan.games<1||plan.games>10)throw Error('Choose valid dates, weekday, 1–104 weeks and 1–10 games per team.');
 const result:string[]=[],d=new Date(plan.firstDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(plan.day-d.getUTCDay()+7)%7);
 for(let attempt=0;result.length<plan.weeks&&attempt<500;attempt++,d.setUTCDate(d.getUTCDate()+7)){if(d.getUTCFullYear()>9998)throw Error('The season extends beyond the supported date range.');const value=d.toISOString().slice(0,10);if(!excluded.has(value))result.push(value);}
 if(result.length!==plan.weeks)throw Error('Too many excluded dates for this season.');return result;
}
export function generateSchedule(teams:ScheduleTeam[],plans:DivisionPlan[],excluded:string[],method:string,cross:CrossRule[]=[],random:()=>number=Math.random):{entries:ScheduleEntry[],byes:any[],warnings:string[]} {
 const active=plans.filter(p=>p.included),exclude=new Set(excluded),entries:ScheduleEntry[]=[],byes:any[]=[],warnings:string[]=[];
 if(!active.length||!['round-robin','balanced'].includes(method))throw Error('Select divisions and a scheduling method.');
 const calendars=new Map<string,string[]>();active.forEach(p=>{const pool=teams.filter(t=>t.divisionKey===p.key);if(pool.length<2)throw Error('Each included division needs at least two teams.');if(p.games>pool.length-1&&!cross.length)throw Error('Games per week exceeds the number of distinct division opponents.');calendars.set(p.key,dates(p,exclude));});
 const activeCount=teams.filter(t=>active.some(p=>p.key===t.divisionKey)).length,estimated=cross.length?Math.floor(activeCount/2)*active[0].weeks*active[0].games:active.reduce((n,p)=>n+p.weeks*p.games*Math.floor(teams.filter(t=>t.divisionKey===p.key).length/2),0);
 if(activeCount>128||estimated>1000)throw Error('Use at most 128 teams and 1000 games per preview; split large divisions or seasons into separate operations.');
 if(cross.length){const base=active[0];if(active.some(p=>p.weeks!==base.weeks||p.games!==base.games||JSON.stringify(calendars.get(p.key))!==JSON.stringify(calendars.get(base.key))))throw Error('Cross-division generation requires aligned dates, weeks and games-per-week settings.');if(cross.some(r=>r.division1===r.division2||!calendars.has(r.division1)||!calendars.has(r.division2)||!Number.isInteger(r.everyWeeks)||r.everyWeeks<1||r.everyWeeks>104||!Number.isInteger(r.games)||r.games<1))throw Error('Select distinct included division pairs and valid crossing frequency/count.');}
 const cost=new Map<string,number>(),byeCost=new Map<number,number>();const add=(a:ScheduleTeam,b:ScheduleTeam,week:number,date:string)=>{const e=blankEntry(date,week,a.divisionKey);e.team1Id=a.id;e.team2Id=b.id;entries.push(e);cost.set(pair(a.id,b.id),(cost.get(pair(a.id,b.id))||0)+1);};
 if(!cross.length){active.forEach(p=>{
  const pool=teams.filter(t=>t.divisionKey===p.key),calendar=calendars.get(p.key);let round=0;const initial:(ScheduleTeam|null)[]=shuffle(pool,random);if(initial.length%2)initial.push(null);
  while(round<p.weeks*p.games){let ring=initial.slice();
   for(let turn=0;turn<ring.length-1&&round<p.weeks*p.games;turn++,round++){
    const week=Math.floor(round/p.games)+1,date=calendar[week-1];for(let i=0;i<ring.length/2;i++){const a=ring[i],b=ring[ring.length-1-i];if(a&&b)add(a,b,week,date);else {const team=a||b;byes.push({week,date,division:p.key,teamId:team.id});}}
    ring=[ring[0],ring[ring.length-1],...ring.slice(1,-1)];
   }
  }
 });}else{
  warnings.push('Cross-division weeks use a randomized balanced heuristic. Review opponent and bye summaries; a global optimum is not claimed.');
  const p=active[0],calendar=calendars.get(p.key);
  for(let w=1;w<=p.weeks;w++)for(let round=0;round<p.games;round++){
   const used=new Set<number>();for(const rule of shuffle(cross,random)){if((w-1)%rule.everyWeeks)continue;
    for(let n=0;n<rule.games;n++){const candidates:any[]=[];teams.filter(t=>t.divisionKey===rule.division1&&!used.has(t.id)).forEach(a=>teams.filter(t=>t.divisionKey===rule.division2&&!used.has(t.id)).forEach(b=>{if(!entries.some(e=>e.date===calendar[w-1]&&pair(e.team1Id,e.team2Id)===pair(a.id,b.id)))candidates.push({a,b,cost:cost.get(pair(a.id,b.id))||0});}));
     if(!candidates.length)throw Error('This crossing attempt could not fit all requested games; infeasibility is not proven. Regenerate or reduce crossings.');
     const best=shuffle(candidates,random).sort((a,b)=>a.cost-b.cost)[0];add(best.a,best.b,w,calendar[w-1]);used.add(best.a.id);used.add(best.b.id);
    }}
   for(const plan of active){let pool=shuffle(teams.filter(t=>t.divisionKey===plan.key&&!used.has(t.id)),random);
    if(pool.length%2){pool.sort((a,b)=>(byeCost.get(a.id)||0)-(byeCost.get(b.id)||0));const bye=pool.shift();byeCost.set(bye.id,(byeCost.get(bye.id)||0)+1);byes.push({week:w,date:calendar[w-1],division:plan.key,teamId:bye.id});}
    while(pool.length){const a=pool.shift(),choices=shuffle(pool.filter(b=>!entries.some(e=>e.date===calendar[w-1]&&pair(e.team1Id,e.team2Id)===pair(a.id,b.id))),random).sort((b,c)=>(cost.get(pair(a.id,b.id))||0)-(cost.get(pair(a.id,c.id))||0));if(!choices.length)throw Error('This crossing arrangement reached a dead end, not proven impossibility. Regenerate or reduce games per week.');const b=choices[0];pool=pool.filter(t=>t.id!==b.id);add(a,b,w,calendar[w-1]);}
   }
  }
 }
 if(entries.length>1000)throw Error('Generate at most 1000 games per operation; split the season or divisions.');
 // Multiple rounds on one date cannot repeat the same pair: the score model cannot distinguish them.
 const seen=new Set<string>();entries.forEach(e=>{const key=e.date+'|'+pair(e.team1Id,e.team2Id);if(seen.has(key))throw Error('A repeated pair falls on the same date; reduce games per week or regenerate.');seen.add(key);});
 return {entries:entries.sort((a,b)=>a.date.localeCompare(b.date)||a.weekNumber-b.weekNumber),byes,warnings};
}
export function validateSchedule(entries:ScheduleEntry[],teams:ScheduleTeam[],existing:ScheduleEntry[],maxGames:number,cross:CrossRule[],eventsAvailable:boolean):void {
 const lookup=new Map(teams.map(t=>[t.id,t] as [number,ScheduleTeam])),combined=existing.concat(entries.filter(e=>e.kind==='game'));const periodCache=new Map<string,string>(),periodFor=(date:string)=>{if(!periodCache.has(date))periodCache.set(date,calendarWeekStart(date));return periodCache.get(date);};
 entries.forEach(e=>{const issues:string[]=[];e.issues=issues;e.conflicts=[];const conflict=(code:string,rule:string,game:ScheduleEntry,message:string,teamId?:number)=>{if(!issues.includes(code))issues.push(code);if(!e.conflicts.some(c=>c.message===message))e.conflicts.push({rule,teamId,date:e.date,savedGameId:game&&game.kind==='game'&&game.id||undefined,message});};const gameLabel=(g:ScheduleEntry)=>{const a=lookup.get(g.team1Id),b=lookup.get(g.team2Id);return (g.id?'saved game #'+g.id:'preview game')+' ('+g.date+', '+(a?a.teamName:'Team #'+g.team1Id)+' v '+(b?b.teamName:'Team #'+g.team2Id)+')';};
  if(e.id&&!changed(e))return;
  if(e.isProtected){issues.push('Saved results lock this game.');return;}
  if(!isoDay(e.date)||!Number.isInteger(+e.weekNumber)||e.weekNumber<1||e.weekNumber>104)issues.push('invalid');
  if(e.kind==='event'){if(!eventsAvailable||!e.description.trim()||e.description.length>200||!['Tournament','Playoffs','NoGames','Other'].includes(e.eventType))issues.push('invalid');if(entries.concat(existing).filter(x=>x.kind==='event'&&x.date===e.date&&normalize(x.description)===normalize(e.description)&&(x.divisionKey||'')===(e.divisionKey||'')).length>1)issues.push('duplicate');if(combined.some(g=>g.kind==='game'&&g.date===e.date&&e.eventType==='NoGames'&&(!e.divisionKey||[lookup.get(g.team1Id),lookup.get(g.team2Id)].some(t=>t&&t.divisionKey===e.divisionKey))))issues.push('date');return;}
  const a=lookup.get(e.team1Id),b=lookup.get(e.team2Id);if(!a||!b){issues.push('unresolved');return;}
  if(a.id===b.id)issues.push('invalid');
  if(a.divisionKey!==b.divisionKey&&!cross.some(r=>pair(r.division1,r.division2)===pair(a.divisionKey,b.divisionKey)&&(e.weekNumber-1)%r.everyWeeks===0))issues.push('division');
  if(e.sourceDivision&&!([a.division,b.division].some(d=>normalize(d)===normalize(e.sourceDivision))&&a.divisionKey===b.divisionKey))issues.push('division');
  combined.filter(g=>g!==e&&g.kind==='game'&&g.date===e.date&&pair(g.team1Id,g.team2Id)===pair(e.team1Id,e.team2Id)).forEach(g=>conflict('duplicate','duplicate',g,a.teamName+' v '+b.teamName+' on '+e.date+' duplicates '+gameLabel(g)+'. Remove the duplicate or choose another date.'));
  const period=periodFor(e.date);if(period)for(const team of [a,b]){const appearances=combined.filter(g=>g.kind==='game'&&periodFor(g.date)===period&&(g.team1Id===team.id||g.team2Id===team.id));if(appearances.length>maxGames){const others=appearances.filter(g=>g!==e);others.forEach(g=>conflict('date','weekly-limit',g,team.teamName+' on '+e.date+' exceeds the '+maxGames+' game(s) per team limit for calendar week '+period+' to '+calendarWeekEnd(e.date)+'. Conflicts with '+gameLabel(g)+'. Move a game to another calendar week, remove an eligible unplayed game, or explicitly increase the weekly limit.',team.id));}}
  entries.concat(existing).filter(event=>event.kind==='event'&&event.eventType==='NoGames'&&event.date===e.date&&(!event.divisionKey||event.divisionKey===a.divisionKey||event.divisionKey===b.divisionKey)).forEach(event=>conflict('date','no-games',event,a.teamName+' v '+b.teamName+' on '+e.date+' conflicts with '+(event.id?'saved event #'+event.id+': ':'')+event.description+'. Change the game date or the No Games event.'));

 });
}
export function scheduleSummary(entries:ScheduleEntry[],teams:ScheduleTeam[]):any {
 const pairs=new Map<string,number>(),perTeam=new Map<number,Set<number>>(),divisions:any={};entries.filter(e=>e.kind==='game').forEach(e=>{const a=teams.find(t=>t.id===e.team1Id),b=teams.find(t=>t.id===e.team2Id);if(!a||!b)return;pairs.set(pair(a.id,b.id),(pairs.get(pair(a.id,b.id))||0)+1);[a,b].forEach(t=>{if(!perTeam.has(t.id))perTeam.set(t.id,new Set());perTeam.get(t.id).add(t.id===a.id?b.id:a.id);});const label=a.divisionKey===b.divisionKey?(a.division||'No Division'):(a.division||'No Division')+' / '+(b.division||'No Division');divisions[label]=(divisions[label]||0)+1;});
 return {games:entries.filter(e=>e.kind==='game').length,weeks:new Set(entries.map(e=>e.weekNumber)).size,repeats:Array.from(pairs.values()).reduce((a,n)=>a+Math.max(0,n-1),0),coverage:teams.map(t=>({team:t.teamName,count:(perTeam.get(t.id)||new Set()).size})),divisions:Object.keys(divisions).map(name=>({name,games:divisions[name]}))};
}
export interface ScheduleMapping {week:number;date:number;team1:number;team2:number;division:number;notes:number;type:number;title:number;start:number;}
export function detectScheduleMapping(grid:any):ScheduleMapping {
 const empty=()=>({week:-1,date:-1,team1:-1,team2:-1,division:-1,notes:-1,type:-1,title:-1,start:1});
 const aliases={week:['week','weeknumber','round'],date:['date','gamedate'],team1:['team1','hometeam','home'],team2:['team2','awayteam','away','opponent'],division:['division','divisionname'],notes:['notes','description','location','court'],type:['type','kind','eventtype'],title:['event','eventtitle','title']};
 for(let i=0;i<Math.min(24,grid.rows.length);i++){const m=empty();grid.rows[i].forEach((cell,c)=>Object.keys(aliases).forEach(key=>{if(aliases[key].includes(normalize(cell).replace(/[^a-z0-9]/g,'')))m[key]=c;}));if(m.week>=0&&m.date>=0&&(m.team1>=0&&m.team2>=0||m.title>=0)){m.start=i+2;return m;}}
 const m=empty();if(grid.rows.length&&grid.rows.every(r=>r.length===4)&&/^\d+$/.test(grid.rows[0][0]))Object.assign(m,{week:0,date:1,team1:2,team2:3});return m;
}
export function importScheduleGrid(grid:any,m:ScheduleMapping,teams:ScheduleTeam[],format='iso'):ScheduleEntry[]{
 if(m.week<0||m.date<0||(m.team1<0||m.team2<0)&&m.title<0)throw Error('Map Week, Date, and the team columns (or event title).');
 if(!Number.isInteger(+m.start)||m.start<1||m.start>grid.rows.length+1)throw Error('Choose a valid first data row.');
 const mapped=[m.week,m.date,m.team1,m.team2,m.division,m.notes,m.type,m.title].filter(n=>n>=0);if(new Set(mapped).size!==mapped.length)throw Error('Map each field to a distinct column.');
 const result:ScheduleEntry[]=[];for(let r=m.start-1;r<grid.rows.length;r++){const row=grid.rows[r];if(!row.some(x=>String(x).trim()))continue;const text=(c:number)=>c>=0?String(row[c]||'').trim():'';
  const e=blankEntry(isoDay(text(m.date),format,grid.types&&grid.types[r+':'+m.date]==='n'),Number(text(m.week).replace(/^week\s*/i,'')));e.description=text(m.notes);e.sourceDivision=text(m.division);e.source=row.join(' | ');
  const type=normalize(text(m.type));if(text(m.title)||['event','tournament','playoffs','nogames','other'].includes(type.replace(/\s/g,''))){e.kind='event';e.description=text(m.title)||text(m.notes);e.eventType=type==='tournament'?'Tournament':type==='playoffs'?'Playoffs':type.replace(/\s/g,'')==='nogames'?'NoGames':'Other';}
  else {e.sourceTeam1=text(m.team1);e.sourceTeam2=text(m.team2);for(const part of ['team1','team2']){const input=text(m[part]);const exact=teams.filter(t=>normalize(t.teamName)===normalize(input));e[part+'Id']=exact.length===1?exact[0].id:0;}}
  if(mapped.some(c=>grid.invalid&&grid.invalid[r+':'+c]))e.source+=' [Invalid mapped workbook cell]';if(mapped.some(c=>grid.invalid&&grid.invalid[r+':'+c]))e.date='';result.push(e);
 }
 if(!result.length||result.length>1000)throw Error('Import between 1 and 1000 schedule records.');return result;
}
export function importScheduleText(text:string,teams:ScheduleTeam[],format='iso'):ScheduleEntry[]{
 let week=0,date='',division='';const rows:ScheduleEntry[]=[];
 text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach(line=>{const heading=/^week\s+(\d+)\s*[|:–-]\s*(.+)$/i.exec(line);if(heading){week=+heading[1];date=isoDay(heading[2],format);return;}
  const div=/^division\s*:\s*(.+)$/i.exec(line);if(div){division=div[1];return;}
  const e=blankEntry(date,week);e.source=line;e.sourceDivision=division;const event=/^(event|tournament|playoffs|no games)\s*:\s*(.+)$/i.exec(line);
  if(event){e.kind='event';e.description=event[2];e.eventType=normalize(event[1])==='no games'?'NoGames':normalize(event[1])==='tournament'?'Tournament':normalize(event[1])==='playoffs'?'Playoffs':'Other';}
  else{const parts=line.split(/\s+(?:vs\.?|v)\s+/i);if(parts.length===2){e.sourceTeam1=parts[0];e.sourceTeam2=parts[1];const a=teams.filter(t=>normalize(t.teamName)===normalize(parts[0])),b=teams.filter(t=>normalize(t.teamName)===normalize(parts[1]));e.team1Id=a.length===1?a[0].id:0;e.team2Id=b.length===1?b[0].id:0;}}
  rows.push(e);
 });if(!rows.length||rows.length>1000)throw Error('Use Week N | YYYY-MM-DD headings followed by Team 1 vs Team 2 lines (maximum 1000 entries).');return rows;
}

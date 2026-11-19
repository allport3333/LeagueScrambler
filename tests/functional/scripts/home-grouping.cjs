// Read-only synthetic browser fixtures. Every application API request is intercepted.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../home-grouping-evidence');fs.mkdirSync(out,{recursive:true});
const before=process.argv[2]==='before';let browser;
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1366,height:900}}),page=await context.newPage();
 const errors=[],checks=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 let mode='matchup',variant='normal',accountPlayerId=1001;
 const leagues=[{id:101,leagueName:'Synthetic League'},{id:102,leagueName:'Second Synthetic League'}];
 const teams=[{id:11,teamName:'Synthetic Harbor Aces with a very long full team name',division:'Gold',players:[{id:1001}]},{id:12,teamName:'Synthetic Court Rockets',division:'Gold',players:[{id:1002}]},{id:13,teamName:'Synthetic Silver Team with Another Long Name',division:'Silver',players:[]}];
 const base=new Date();base.setHours(0,0,0,0);const date=base.getFullYear()+'-'+String(base.getMonth()+1).padStart(2,'0')+'-'+String(base.getDate()).padStart(2,'0');
 const score=(value,won=false,sub=false)=>({score:value,roundWon:won,isSubScore:sub,roundId:1,hasSavedScore:true,scrambleNumber:7,kingQueenTeamId:701});
 const record=(id,scores,isMale=true,division=41)=>({playerId:id,playerName:id===1001||id===1002?'Synthetic Player':'Synthetic '+id,isMale,leagueDivisionId:division,leagueDivisionCode:division===41?'GM':division===42?'SM':null,scores});
 function standings(round){
  if(variant==='empty')return {maxRounds:3,playerScores:[]};
  const rows=[record(1001,variant==='zero'?[score(0),score(0),score(0)]:round?[score(10),score(25,true),score(20,true)]:[score(10),score(30,true,true),score(20,true)]),record(1002,[score(10),score(20),score(25,true)]),record(1003,[score(5),score(15),score(20,true)]),record(1004,[score(10),score(20),score(30)],true,42),record(1005,[score(0),score(0),score(0)],true,null),record(1006,[score(100),score(100),score(100)],false,42),record(1007,[score(90),score(90),score(90)],false,42)];
  rows.forEach(p=>p.scores.forEach((s,i)=>s.roundId=i+1));return {maxRounds:3,playerScores:rows};
 }
 await context.route('**/*',async route=>{
  const req=route.request();let url;try{url=assertLocalUrl(req.url());}catch{const u=new URL(req.url());if(req.method()==='GET'&&['fonts.googleapis.com','fonts.gstatic.com','use.fontawesome.com'].includes(u.hostname)&&['font','stylesheet'].includes(req.resourceType()))return route.continue();return route.abort();}
  const p=url.pathname.toLowerCase();if(!p.startsWith('/api/'))return route.continue();assert.equal(req.method(),'GET','No real or fixture writes required');calls.push(url.pathname+url.search);let data=[];
  if(p.endsWith('/isauthenticated'))data=true;
  else if(p.endsWith('/getusersrole'))data={role:'Player'};
  else if(p.endsWith('/getusersplayer'))data={playerId:accountPlayerId};
  else if(p.endsWith('/isadminpasswordauthorized'))data=false;
  else if(p.includes('/getuserleagues')||p.endsWith('/getleagues'))data=leagues;
  else if(p.endsWith('/getsettingvalue'))data={settingValue:{numberOfSubsAllowed:'0',dropLowest:'1',subScorePercent:'50',standingsType:mode}[url.searchParams.get('settingName')]};
  else if(p.includes('/getbyleague')){
   if(variant==='failure'){await route.fulfill({status:503,contentType:'application/json',body:'{}'});return;}
   data=decodeURIComponent(p).includes('second synthetic')?{maxRounds:0,playerScores:[]}:standings(!p.includes('matchup'));
   if(variant==='delayed')await new Promise(r=>setTimeout(r,350));
  }
  else if(p.includes('/getleagueschedule/'))data=p.endsWith('/102')?[]:[{weekNumber:7,date:date+'T00:00:00',matches:[{scheduleId:300,team1Id:11,team2Id:12,team1Name:teams[0].teamName,team2Name:teams[1].teamName,division:'Gold',matchDescription:''}]}];
  else if(p.includes('/getallteamswithplayers/')||p.includes('/getteams/'))data=teams;
  else if(p.includes('/league-standings/'))data=teams.map((t,i)=>({...t,teamId:t.id,wins:9-i,losses:i,totalPoints:120-i}));
  else if(p.includes('/league-team-scores/'))data=[{date:date,opponentTeam:'Synthetic Rockets',teamScore:20,wonGame:true}];
  else if(p.includes('/getdetailedperformancestats'))data={individualRounds:[],scrambleTotals:[{scrambleNumber:7,dateOfTeam:date+'T00:00:00',totalScore:87,wins:3}]};
  else if(p.includes('/playerattendance/'))data={visible:true,isOwnProfile:true,canSignIn:false,canRemove:false,isSignedIn:false,reason:'Sign in is available on Sunday only.'};
  else if(p.includes('/getprofile'))data={id:accountPlayerId,firstName:'Synthetic',lastName:'Player',isMale:true};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 async function go(url,selector){await page.goto(BASE_URL+url);await expect(page.locator(selector)).toBeVisible();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);}
 async function component(selector,fn,arg){return page.evaluate(({selector,fn,arg})=>{const d=window.ng.probe(document.querySelector(selector));return d.injector.get(window.ng.coreTokens.NgZone).run(()=>eval('('+fn+')')(d.componentInstance,arg));},{selector,fn:fn.toString(),arg});}

 await go('/','app-player-home-dashboard');const home=page.locator('app-player-home-dashboard');
 await expect(home.locator('.recent-kq')).toContainText('87');await expect(home.locator('.current-kq-standing')).toContainText('3rd of 5');
 await expect(home.locator('.home-team')).toContainText('120');await expect(home.locator('.home-team')).toContainText('20');await expect(home.locator('.home-team .recent-kq')).toHaveCount(0);
 assert.deepEqual(await home.locator('.home-team-sections>section h3').allTextContents(),['Your Team Standings','Recent Game Scores']);
 const linkChecks=[['.recent-kq','View King/Queen History','/player-stats-tabs/1001','kq'],['.home-team','View Game History','/player-stats-tabs/1001','team'],['.home-team','View League Standings','/league-dashboard',null],['app-player-next-game','View Full Schedule','/league-dashboard','schedule']];
 for(const [selector,label,pathname,tab] of linkChecks){const href=await home.locator(selector).getByRole('link',{name:label,exact:true}).getAttribute('href');const url=new URL(href,BASE_URL);assert.equal(url.pathname,pathname);assert.equal(url.searchParams.get('leagueId'),'101');if(tab)assert.equal(url.searchParams.get('tab'),tab);}
 for(const width of [1366,1920,375,390,430]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
  const geometry=await home.evaluate(host=>{
   const select=s=>host.querySelector(s),box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,bottom:r.bottom,right:r.right};};
   const next=select('app-player-next-game'),attendance=select('app-player-attendance'),kq=select('.recent-kq'),team=select('.home-team'),upcoming=select('.home-upcoming');
   return{next:box(next),attendance:box(attendance),kq:box(kq),team:box(team),upcoming:box(upcoming),directNext:attendance.nextElementSibling===kq,directTeam:kq.nextElementSibling===team,standings:box(select('#home-team-standings-title')),results:box(select('#home-team-results-title')),orders:[next,attendance,kq,team,upcoming].map(e=>getComputedStyle(e).order)};
  });
  assert(geometry.next.bottom<=geometry.attendance.y+1);assert(geometry.attendance.bottom<=geometry.kq.y+1);assert(geometry.kq.bottom<=geometry.team.y+1);assert(geometry.team.bottom<=geometry.upcoming.y+1);assert(geometry.directNext&&geometry.directTeam);assert(geometry.orders.every(order=>order==='0'));
  if(width<701)assert(geometry.standings.y<geometry.results.y);else assert(geometry.standings.x<geometry.results.x);
  assert.equal(await home.evaluate(e=>e.scrollWidth>e.clientWidth),false);if(width<500)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});
 }
 checks.push('DOM and rendered order at1366/1920/375/390/430: Next Game, attendance, independent KQ card, one Team card with standings then recent scores; Upcoming Schedule preserved below. No CSS ordering or phone overflow.');
 checks.push('Latest87 points, date,3 round wins, original-score label, Overall3/5 and division2/3 retained; both team data sets and all four existing contextual routes retain player/league/tab.');
 await home.locator('.home-team').getByRole('link',{name:'View Game History',exact:true}).click();await expect(page).toHaveURL(new RegExp('player-stats-tabs[/]1001.*leagueId=101.*tab=team'));await expect(page.locator('.profile-header')).toContainText('Synthetic Player');
 await go('/','app-player-home-dashboard');await home.locator('.recent-kq').getByRole('link',{name:'View King/Queen History',exact:true}).click();await expect(page).toHaveURL(new RegExp('player-stats-tabs[/]1001.*leagueId=101.*tab=kq'));
 checks.push('Team and KQ history links actually open the correct profile statistics tabs. No component TypeScript, data loading, calculations or APIs changed.');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,calls,mode:'Read-only synthetic browser fixtures; all API traffic intercepted.'},null,2));await browser.close();
})().catch(async error=>{console.error(error.stack);if(browser){const page=browser.contexts()[0].pages()[0];if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

// Read-only synthetic browser fixtures. Every application API request is intercepted.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../mobile-league-home-evidence');fs.mkdirSync(out,{recursive:true});
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
 await go('/league-dashboard','app-league-team-standings');const teamRoot=page.locator('app-league-team-standings');
 for(const width of [1366,1920]){await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);const table=teamRoot.locator('mat-table').first();await expect(table).toBeVisible();const pixels=await table.screenshot({path:path.join(out,(before?'before':'after')+'-desktop-table-'+width+'.png')});if(!before){const baseline=fs.readFileSync(path.join(out,'before-desktop-table-'+width+'.png'));assert.equal(pixels.readUInt32BE(16),baseline.readUInt32BE(16));assert.equal(pixels.readUInt32BE(20),baseline.readUInt32BE(20));if(width===1366)assert(pixels.equals(baseline),'Desktop table pixels changed at1366');await page.screenshot({path:path.join(out,'desktop-league-standings-'+width+'.png'),fullPage:true});}}
 if(before){await browser.close();return;}
 const expected=await component('app-league-team-standings',c=>c.divisions);
 for(const width of [320,375,390,430,600,768,1024]){
  await page.setViewportSize({width,height:844});await expect(teamRoot.locator('.mobile-league-standings').first()).toBeVisible();await expect(teamRoot.locator('mat-table').first()).not.toBeVisible();await expect(teamRoot).not.toContainText('Swipe or scroll');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await teamRoot.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  const actual=await teamRoot.locator('.division-standings').evaluateAll(cards=>cards.map(card=>({division:card.querySelector('h3').textContent.trim(),rows:Array.from(card.querySelectorAll('.mobile-league-standings li')).map(row=>({rank:Number(row.querySelector('.mobile-team-rank').textContent),name:row.querySelector('strong').textContent.trim(),stats:Array.from(row.querySelectorAll('dd')).map(e=>Number(e.textContent)),overflow:row.scrollWidth>row.clientWidth}))})));
  for(const group of actual){assert.equal(group.rows.length,expected[group.division].length);group.rows.forEach((row,i)=>{const source=expected[group.division][i];assert.deepEqual(row.stats,[source.wins,source.losses,source.totalPoints]);assert.equal(row.rank,source.rank);assert.equal(row.name,source.teamName);assert.equal(row.overflow,false);});}
  await page.screenshot({path:path.join(out,'league-standings-'+width+'.png'),fullPage:true});
 }
 checks.push('Stacked league rows at320/375/390/430/600/768/1024: exact rank/order/full team names/wins/losses/points, Gold/Silver headings, no swipe text, no row/component/page horizontal overflow. Desktop1366 table pixels identical;1366/1920 table image dimensions identical to baseline, same material cells/data.');
 await go('/','app-player-home-dashboard');let home=page.locator('app-player-home-dashboard');const standing=home.locator('.current-kq-standing');await expect(standing).toContainText('3rd of 5');await expect(standing).toContainText("Overall Men's");await expect(standing).toContainText('GM: 2nd of 3');await expect(home.locator('.recent-kq')).toContainText('87');
 for(const width of [1366,1920,375,390,430]){await page.setViewportSize({width,height:900});const kq=await home.getByRole('heading',{name:'Latest King/Queen Score'}).boundingBox(),games=await home.getByRole('heading',{name:'Recent Game Scores'}).boundingBox();assert(kq.y<games.y);assert.equal(await home.evaluate(e=>e.scrollWidth>e.clientWidth),false);if(width<500)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});}
 const homeRanking=await component('app-player-home-dashboard',c=>c.currentStanding);await standing.getByRole('link').click();await expect(page.locator('app-league-standings')).toBeVisible();await expect.poll(()=>component('app-league-standings',c=>c.playerLoading===false&&c.maleStandings&&c.maleStandings.length)).toBe(5);const full=await component('app-league-standings',c=>({rank:c.maleStandings.findIndex(p=>p.playerId===1001)+1,total:c.maleStandings.length,divisionRank:c.divisionMaleStandings[41].findIndex(p=>p.playerId===1001)+1,divisionTotal:c.divisionMaleStandings[41].length}));assert.equal(full.rank,homeRanking.rank);assert.equal(full.total,homeRanking.total);assert.equal(full.divisionRank,homeRanking.divisionRank);assert.equal(full.divisionTotal,homeRanking.divisionTotal);checks.push('K/Q summary above Game Scores at5 widths; stable player ID despite duplicate names; actual 50% sub reduction/drop-lowest/matchup tie breaker produce Overall3/5 and GM2/3, matching full standings live arrays and contextual link.');
 mode='round';await go('/','app-player-home-dashboard');await expect(standing).toContainText('2nd of 5');await expect(standing).toContainText('By Round');await standing.getByRole('link').click();await expect.poll(()=>component('app-league-standings',c=>c.maleStandings&&c.maleStandings.findIndex(p=>p.playerId===1001))).toBe(1);checks.push('Round mode uses existing round-wins tie breaker, matches full K/Q standings rank2/5.');
 mode='matchup';accountPlayerId=1006;await go('/','app-player-home-dashboard');await expect(standing).toContainText('1st of 2');await expect(standing).toContainText("Overall Women's");accountPlayerId=1005;await go('/','app-player-home-dashboard');await expect(standing).toContainText('5th of 5');await expect(standing).not.toContainText('Division');checks.push('Female standings use female participant count; unassigned division omitted; legitimate zero-score ranked player stays ranked.');
 accountPlayerId=1001;variant='empty';await go('/','app-player-home-dashboard');await expect(standing).toContainText('Not yet ranked');variant='failure';await page.reload();await expect(standing).toContainText('Current standing could not be loaded.');await expect(standing).not.toContainText('Not yet ranked');await expect(home).toContainText('87');
 variant='normal';await page.reload();await expect(standing).toContainText('3rd of 5');await component('app-player-home-dashboard',c=>c.leagues.setSelectedLeague(102));await expect(standing).toContainText('Not yet ranked');await expect(standing).not.toContainText('3rd of 5');
 await component('app-player-home-dashboard',c=>c.leagues.setSelectedLeague(101));await expect(standing).toContainText('3rd of 5');variant='delayed';await component('app-player-home-dashboard',c=>c.loadOverview(true));await component('app-player-home-dashboard',c=>c.leagues.setSelectedLeague(102));await expect(standing).toContainText('Not yet ranked');await page.waitForTimeout(500);await expect(standing).not.toContainText('3rd of 5');
 accountPlayerId=null;variant='normal';await go('/','app-player-home-dashboard');await expect(home).toContainText('Link your player record');await expect(standing).toHaveCount(0);checks.push('Distinct no-ranking/request-failure states, league scoping, cancelled stale responses, no standing for unlinked account; latest KQ score preserved during rank failure.');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,calls,mode:'Intercepted browser fixtures only; no SQL or database mutations.'},null,2));await browser.close();
})().catch(async error=>{console.error(error.stack);if(browser){const page=browser.contexts()[0].pages()[0];if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

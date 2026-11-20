// Static development bundle + intercepted APIs only. No application server or SQL writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/scrambler-v2'),dist=path.join(out,process.env.SCRAMBLER_V2_BASELINE==='1'?'baseline-dist':'development-dist');
const origin='https://localhost:5001';
async function asset(route){const url=new URL(route.request().url());let file=path.resolve(dist,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(dist+path.sep)){return route.abort();}if(!path.extname(file))file=path.join(dist,'index.html');if(!fs.existsSync(file))return route.abort();const ext=path.extname(file);return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'})[ext]||'application/octet-stream'});}
exports.asset=asset;
if(require.main===module)(async()=>{
 const browser=await chromium.launch(),context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1366,height:1000}}),page=await context.newPage();
 const errors=[],calls=[],checks=[];let failHistory=false,failGenerate=false,delayHistory=0;
 const players=Array.from({length:40},(_,i)=>({id:i+1,firstName:'Synthetic',lastName:'Player '+(i+1),isMale:i<24,gender:i<24?'Male':'Female',isTopPlayer:i<12,isLowPlayer:i>=32,isByePlayer:false}));
 const historical=Array.from({length:10},(_,i)=>({kingQueenTeam:{id:501+i,leagueID:101,scrambleNumber:7,scrambleWithScoresToBeSaved:true},players:players.slice(i*4,i*4+4)}));
 let returnedHistory=historical;
 const pairs=historical.flatMap(row=>row.players.flatMap((p,i)=>row.players.slice(i+1).map(q=>({player1Id:p.id,player2Id:q.id,count:1}))));
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname.toLowerCase();if(u.origin!==origin)return route.abort();if(!p.startsWith('/api/'))return asset(route);
  calls.push({path:p,method:req.method()});let body=[];
  if(p==='/api/login/isauthenticated')body=true;
  else if(p==='/api/login/getusersrole')body={role:'Admin'};
  else if(p==='/api/login/getusersplayer')body={playerId:1};
  else if(p==='/api/login/isadminpasswordauthorized')body=false;
  else if(p==='/api/login/getuserleagues'||p==='/api/scrambledata/getleagues')body=[{id:101,leagueName:'Synthetic League'},{id:102,leagueName:'Second League'}];
  else if(u.searchParams.has('settingName'))body={settingValue:{dropLowest:'0',numberOfSubsAllowed:'100',subScorePercent:'100',standingsType:'round',dayOfLeague:'Monday'}[u.searchParams.get('settingName')]};
  else if(p.includes('/selectleague/'))body=players;
  else if(p.includes('/gettopplayers'))body=players.slice(0,12).map((x,i)=>({...x,rank:12-i}));
  else if(p.includes('/getbyleague'))body={maxRounds:1,playerScores:players.map(x=>({playerId:x.id,playerName:x.firstName+' '+x.lastName,isMale:x.isMale,scores:[{roundId:1,score:x.id,roundWon:true,isSubScore:false}]}))};
  else if(p.includes('/teammatehistory/')){if(delayHistory)await new Promise(r=>setTimeout(r,delayHistory));if(failHistory)return route.fulfill({status:503,body:'Fixture unavailable'});body={leagueId:Number(p.split('/').pop()),pairs};}
  else if(p.includes('/getkingqueenteamsbyscramblenumbers/'))body={kingQueenTeams:returnedHistory,byePlayers:[]};
  else if(p.includes('/generatescramble/')){if(failGenerate)return route.fulfill({status:500,body:'Fixture generation failure'});body=req.postDataJSON().kingQueenTeams.map((_,i)=>({id:901+i,scrambleNumber:8}));}
  else if(p.includes('/savekingqueenteams/'))body={...req.postDataJSON(),kingQueenTeams:req.postDataJSON().kingQueenTeams.map(t=>({...t,kingQueenTeam:{...t.kingQueenTeam,scrambleNumber:8}}))};
  else if(req.method()!=='GET')throw Error('Unexpected write blocked: '+p);
  return route.fulfill({json:body});
 });
 page.on('pageerror',e=>errors.push(e.message));
 async function component(fn,arg){return page.evaluate(({fn,arg})=>{const d=window.ng.probe(document.querySelector('app-scrambler-component'));return d.injector.get(window.ng.coreTokens.NgZone).run(()=>eval('('+fn+')')(d.componentInstance,arg));},{fn:String(fn),arg});}
 try{
  await page.goto(origin+'/scrambler');await page.waitForFunction(()=>window.ng&&window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.malePlayers1.length===24);
  async function setup(){await component((c,people)=>{c.selectedList=people;c.teamSize=4;c.numberOfTeams=10;c.teamCount=10;c.isActionAllowed=true;c.displayTopPlayers=people.filter(p=>p.isTopPlayer);c.displayLowPlayers=people.filter(p=>p.isLowPlayer);c.maleStandings=people.filter(p=>p.isMale).map(p=>({playerId:p.id,totalScore:100-p.id,playerName:p.firstName+' '+p.lastName}));c.lockedResults=false;c.locked=false;},players);}
  await setup();await component(c=>c.scramblePlayers());
  const result=await component(c=>({status:c.generationResult.status,ids:c.listOfTeams.flatMap(t=>t.players.map(p=>p.id)),retained:c.generationResult.retainedTopIds,demoted:c.generationResult.demotedTopIds,print:c.canPrintMatchups}));
  assert.equal(result.status,'success');assert.deepEqual(result.retained,[12,11,10,9,8,7,6,5,4,3]);assert.deepEqual(result.demoted,[2,1]);assert.equal(new Set(result.ids).size,40);assert.equal(result.print,false);
  assert.equal(calls.filter(c=>c.path.includes('/teammatehistory/')).length,0);
  checks.push('Ranked Top list overrides standings; 12 top/10 teams includes all40 and demotes correct2; new scramble remains unsaved; checkbox-off sends no league-history query.');
  await component(c=>c.saveKingQueenTeams());assert.equal(await component(c=>c.canPrintMatchups),true);
  await component(c=>{c.prioritizePreviousTeammates=true;c.listOfScrambleNumbers=[7];});await component(c=>c.scramblePlayers());
  assert.equal(await component(c=>c.generationResult.repeatedPairs.length),0);assert.equal(calls.filter(c=>c.path.includes('/teammatehistory/')).length,1);
  assert.equal(calls.filter(c=>c.path.includes('/getkingqueenteamsbyscramblenumbers/')).length,1);
  checks.push('Selected strict history and whole-league preference coexist; each fetched once with stable IDs; generated teams contain no selected historical pair.');
  // Preference works without manually selected history, and failures retain previous teams.
  await component(c=>c.listOfScrambleNumbers=[]);await component(c=>c.scramblePlayers());
  const before=await component(c=>JSON.stringify(c.listOfTeams));failHistory=true;const creates=calls.filter(c=>c.path.includes('/generatescramble/')).length;
  await component(c=>c.scramblePlayers());assert.equal(await component(c=>JSON.stringify(c.listOfTeams)),before);assert.equal(calls.filter(c=>c.path.includes('/generatescramble/')).length,creates);assert.match(await component(c=>c.generationFeedback),/unavailable|retained/);failHistory=false;
  failGenerate=true;await component(c=>c.scramblePlayers());assert.equal(await component(c=>JSON.stringify(c.listOfTeams)),before);failGenerate=false;
  checks.push('Whole-league checkbox works without selected scrambles; unavailable history is not zero history; failed history/generation keeps prior teams and inputs without downstream save.');
  delayHistory=150;const n=calls.filter(c=>c.path.includes('/generatescramble/')).length;await component(c=>Promise.all([c.scramblePlayers(),c.scramblePlayers()]));delayHistory=0;assert.equal(calls.filter(c=>c.path.includes('/generatescramble/')).length,n+1);
  await component(c=>c.applyTopPlayersFromMaleStandings());assert.deepEqual(await component(c=>c.displayTopPlayers.map(p=>p.id)),[12,11,10,9,8,7,6,5,4,3]);
  checks.push('Repeated generation clicks are guarded; automatic male standings Top selection uses the same configured priority and team capacity.');
  returnedHistory=[{kingQueenTeam:{id:800,leagueID:101,scrambleNumber:7,scrambleWithScoresToBeSaved:true},players:players.slice(0,4)}];
  await component(c=>{c.selectedList=c.selectedList.slice(0,4);c.numberOfTeams=2;c.prioritizePreviousTeammates=false;c.listOfScrambleNumbers=[7];c.allowMinimumRepeats=false;});
  const oldTeams=await component(c=>JSON.stringify(c.listOfTeams)),oldCreates=calls.filter(c=>c.path.includes('/generatescramble/')).length;
  await component(c=>c.scramblePlayers());assert.equal(await component(c=>JSON.stringify(c.listOfTeams)),oldTeams);assert.equal(calls.filter(c=>c.path.includes('/generatescramble/')).length,oldCreates);
  await component(c=>c.allowMinimumRepeats=true);await component(c=>c.scramblePlayers());assert.deepEqual(await component(c=>[c.generationResult.strictImpossible,c.generationResult.minimumRepeatsProven,c.generationResult.repeatedPairs.length]),[true,true,2]);
  await expect(page.locator('.generation-report')).toContainText('minimum 2 repeated teammate pairings');
  await page.locator('.generation-report').screenshot({path:path.join(out,'minimum-repeat-report.png')});
  checks.push('Strict impossible fixture creates no placeholder scramble; explicit fallback proves minimum2 repeats and exposes the actual pairs before Save.');
  returnedHistory=historical;await setup();await component(c=>{c.listOfScrambleNumbers=[];c.allowMinimumRepeats=false;c.prioritizePreviousTeammates=true;});await component(c=>c.scramblePlayers());
  delayHistory=200;const beforeSwitch=calls.filter(c=>c.path.includes('/generatescramble/')).length;
  await component(c=>{const pending=c.scramblePlayers();setTimeout(()=>{c.selectedLeague='Second League';c.onLeagueChanged();},30);return pending;});delayHistory=0;
  assert.equal(calls.filter(c=>c.path.includes('/generatescramble/')).length,beforeSwitch);assert.equal(await component(c=>c.generationResult),null);
  await component(c=>{c.selectedLeague='Synthetic League';c.onLeagueChanged();});await page.waitForTimeout(250);await setup();await component(c=>c.scramblePlayers());
  checks.push('League switch cancels the pending history/solver attempt; no stale generation POST or old result is committed to the new league.');
  const layout=[]; await component(c=>c.snackBar.dismiss()); await page.waitForTimeout(350);
  for(const width of [1366,1920,375,390,430]){
   await page.setViewportSize({width,height:950});await page.waitForTimeout(350);await page.locator('.scramble-rules').scrollIntoViewIfNeeded();
   const metrics=await page.evaluate(()=>{const es=Array.from(document.querySelectorAll('.history-rules,.generation-report,.generation-feedback'));const actual=document.documentElement.scrollWidth;es.forEach(e=>e.style.display='none');const baseline=document.documentElement.scrollWidth;es.forEach(e=>e.style.display='');return {actual,baseline,rules:document.querySelector('.history-rules').getBoundingClientRect().right};});
   assert(metrics.actual<=Math.max(width,metrics.baseline));assert(metrics.rules<=width);layout.push({width,...metrics});await page.screenshot({path:path.join(out,'rules-'+width+'.png')});
  }
  await component(c=>{c.openMatchups();});await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:path.join(out,'matchups-mobile.png')});await page.getByRole('button',{name:'Close matchups',exact:true}).click();
  checks.push('Desktop1366/1920 and mobile375/390/430 rendered rules and results: no additional page overflow (baseline widths recorded); existing Matchups modal opens/closes.');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,calls,errors,layout,mode:'synthetic intercepted APIs; no SQL/no real authentication'},null,2));console.log(checks.join('\n'));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});








// Presentation/integration checks only: every API intercepted, all writes/external URLs blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../score-links-evidence');fs.mkdirSync(out,{recursive:true});let browser;
const leagues=[{id:101,leagueName:'Synthetic A'},{id:202,leagueName:'Synthetic B'}];
const scores=[{scrambleNumber:12,roundId:1,score:30,roundWon:0,isSubScore:true,kingQueenTeamId:107,hasSavedScore:true},
 {scrambleNumber:12,roundId:2,score:0,roundWon:0,isSubScore:true,kingQueenTeamId:107,hasSavedScore:true},
 {scrambleNumber:39,roundId:1,score:0,roundWon:0,isSubScore:false,kingQueenTeamId:null,hasSavedScore:false}];
const roundResponse={maxRounds:3,playerScores:[{playerId:707,playerName:'Synthetic Woman',isMale:false,leagueDivisionId:8,leagueDivisionCode:'Gold',scores},
 {playerId:708,playerName:'Synthetic Man',isMale:true,leagueDivisionId:9,leagueDivisionCode:'Silver',scores:scores.map((s,i)=>({...s,score:i===0?21:0,kingQueenTeamId:s.hasSavedScore?108:null}))}]};
const matchupResponse={maxRounds:2,playerScores:roundResponse.playerScores.map(p=>({...p,scores:[
 {scrambleNumber:12,roundId:1,score:p.isMale?21:30,roundWon:0,isSubScore:true,kingQueenTeamId:p.isMale?108:107,hasSavedScore:true},
 {scrambleNumber:39,roundId:2,score:0,roundWon:0,isSubScore:false,kingQueenTeamId:null,hasSavedScore:false}]}))};
function teamResponse(scramble,malformed=false){
 const kingQueenTeams=Array.from({length:8},(_,i)=>{
  const id=101+i,playerId=i===6?707:i===7?708:501+i;
  return {kingQueenTeam:{id,leagueID:202,scrambleNumber:scramble,kingQueenPlayers:[{playerId,isSubScore:i===6}],kingQueenRoundScores:[
   {id:1000+i*10+1,kingQueenTeamId:id,roundId:1,roundScore:i===6?30:21,roundWon:i===7},
   {id:1000+i*10+2,kingQueenTeamId:id,roundId:2,roundScore:0,roundWon:false}]},
   players:[{id:playerId,firstName:'Synthetic',lastName:i===6?'Woman':i===7?'Man':'Player '+i,isMale:i!==6}]};
 });
 if(malformed)kingQueenTeams.pop();
 // Intentionally shuffled: a client pairing in response order would show the wrong opponent/Match#.
 return {kingQueenTeams:kingQueenTeams.reverse(),byePlayers:[{id:999,firstName:'Synthetic',lastName:'Bye'}]};
}
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 const writes=[],errors=[],checks=[];let malformed=false;
 await context.route('**/*',async route=>{
  let u;try{u=assertLocalUrl(route.request().url());}catch{await route.abort();return;}
  const p=u.pathname.toLowerCase();if(route.request().method()!=='GET'){if(p.startsWith('/api/'))writes.push(p);await route.abort();return;}
  if(!p.startsWith('/api/')){await route.continue();return;}
  let body=[],status=200;
  if(p==='/api/login/isauthenticated')body=true;
  else if(p==='/api/login/getusersrole')body={role:'Player'};
  else if(p==='/api/login/getusersplayer')body={userId:303,playerId:707};
  else if(p==='/api/login/getuserleagues'||p==='/api/scrambledata/getleagues')body=leagues;
  else if(u.searchParams.has('settingName'))body={settingValue:{numberOfSubsAllowed:'0',subScorePercent:'50',dropLowest:'1',standingsType:'round'}[u.searchParams.get('settingName')]};
  else if(p.startsWith('/api/scrambledata/getbyleaguematchup/'))body=matchupResponse;
  else if(p.startsWith('/api/scrambledata/getbyleague/'))body=roundResponse;
  else if(p.startsWith('/api/scrambledata/selectedleaguescrambles/')){
   await new Promise(r=>setTimeout(r,100));body=[{id:201,scrambleNumber:39,dateOfTeam:'2026-11-08T18:00:00'},{id:101,scrambleNumber:12,dateOfTeam:'2026-11-01T18:00:00'}];
  }else if(p.startsWith('/api/scrambledata/getkingqueenteamsbyscramblenumber/'))body=teamResponse(Number(p.split('/').pop()),malformed);
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const pane=()=>page.locator('app-league-standings .standings-card > mat-tab-group > .mat-tab-body-wrapper > mat-tab-body.mat-tab-body-active > .mat-tab-body-content > mat-tab-group > .mat-tab-body-wrapper > mat-tab-body.mat-tab-body-active > .mat-tab-body-content');
 async function standings(mode='round',division=8,gender='women'){
  await page.goto(BASE_URL+`/standings?leagueId=202&standingsMode=${mode}&divisionId=${division}&gender=${gender}`);
  await expect(pane().locator('.mobile-player-row')).toHaveCount(1);await page.waitForTimeout(550);
 }
 async function expand(){await pane().locator('.mobile-player-row').first().getByRole('button').click();return pane().locator('.mobile-player-details:visible');}
 async function single(round){
  await expect(page.locator('.match-row')).toHaveCount(1);await expect(page.locator('.match-header')).toHaveText('Match #4');
  await expect(page.locator('.team-card')).toHaveCount(2);await expect(page.locator('.team-card').first()).toContainText('Synthetic Woman');
  await expect(page.locator('.team-card').last()).toContainText('Synthetic Man');
  await expect(page.locator('mat-select')).toContainText('Week 1');await expect(page.locator('mat-select')).toContainText('11/1/26');
  const q=new URL(page.url()).searchParams;assert.equal(q.get('leagueId'),'202');assert.equal(q.get('scrambleNumber'),'12');
  await expect(page.locator('.team-card').first().locator('.score-item').first()).toContainText('30');
  await expect(page.locator('.sub-score-badge')).toHaveCount(1);await expect(page.locator('.won-badge')).toHaveCount(1);
  await expect(page.locator('.score-item.selected-score')).toHaveCount(round?1:0);
 }
 if(process.argv.includes('--league-change')){
  await page.goto(BASE_URL+'/kqmatchups?fromStandings=1&leagueId=202&scrambleNumber=12&kingQueenTeamId=107&playerId=707&roundId=1');await single(true);
  await page.evaluate(()=>{const d=window.ng.probe(document.querySelector('app-nav-menu'));d.injector.get(window.ng.coreTokens.NgZone).run(()=>d.componentInstance.onLeagueChange(101));});
  await page.waitForURL(u=>u.searchParams.get('leagueId')==='101'&&!u.searchParams.has('fromStandings'));
  await expect(page.locator('.match-row')).toHaveCount(0);await expect(page.getByRole('button',{name:'Back to Standings'})).toHaveCount(0);
  assert.equal(await page.evaluate(()=>window.ng.probe(document.querySelector('app-nav-menu')).componentInstance.selectedLeagueId),101);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'league-change.json'),JSON.stringify({passed:true,check:'Changing navigation league exits score focus and preserves the newly selected league',databaseAccess:false}));
  console.log('Focused navigation league-change check passed.');await browser.close();return;
 }
 await standings('round');let details=await expand();
 await expect(details.locator('a')).toHaveCount(2);await expect(details.locator('a').nth(1)).toHaveText('0');
 await expect(details.locator('.mobile-round-scores li').last().locator('a')).toHaveCount(0);
 assert.equal(await details.locator('a').first().innerText(),'15');
 await page.screenshot({path:path.join(out,'mobile-clickable-standings.png'),fullPage:true});
 await details.locator('a').first().click();await single(true);
 await expect(page.locator('.score-item.selected-score')).toContainText('Round 1');
 await page.screenshot({path:path.join(out,'mobile-single-matchup.png'),fullPage:true});
 checks.push('Mobile round link: adjusted 15 opens raw 30, correct league B/week scramble12, teams107/108, Match#4 and round highlight');
 await page.reload();await single(true);checks.push('Direct link refresh restores the same week and single matchup');
 await page.getByRole('button',{name:'Back to Standings',exact:true}).click();
 await expect(pane().locator('.mobile-player-row')).toHaveCount(1);
 assert.equal(new URL(page.url()).searchParams.get('divisionId'),'8');assert.equal(new URL(page.url()).searchParams.get('gender'),'women');
 await expect(pane()).toContainText('Synthetic Woman');checks.push('Back returns to league B, round mode, Gold and Women');
 details=await expand();await details.locator('a').nth(1).click();await single(true);
 await expect(page.locator('.score-item.selected-score')).toContainText('Round 2');checks.push('Legitimate saved zero remains linked; placeholder zero is not linked');
 await page.getByRole('button',{name:'View All Matchups',exact:true}).click();await expect(page.locator('.match-row')).toHaveCount(4);
 await expect(page.locator('.bye-players')).toContainText('Synthetic Bye');checks.push('View All restores all four original matchups and bye players');
 await standings('matchup');details=await expand();await details.locator('a').first().click();await single(false);
 checks.push('Mobile combined matchup link shows original individual rounds without a false round highlight');
 await page.locator('mat-select').click();await page.getByRole('option',{name:/Week 2/}).click();
 await expect(page.locator('.match-row')).toHaveCount(4);checks.push('Manual week change removes single-match filter');
 await standings('round');await pane().getByRole('button',{name:'View Full Table',exact:true}).click();
 await pane().locator('.standings-full-table a').first().click();await single(true);checks.push('Mobile full-table score link works');
 await page.setViewportSize({width:1366,height:768});await standings('round');
 await expect(pane().locator('tbody td').nth(2).locator('a')).toHaveCount(0);
 await pane().locator('.standings-full-table a').first().click();await single(true);checks.push('Desktop individual score links work; total columns remain plain');
 await page.screenshot({path:path.join(out,'desktop-single-matchup.png'),fullPage:true});
 for(const [division,gender,player] of [[0,'men',708],[0,'women',707],[9,'men',708]]){
  await standings('round',division,gender);await pane().locator('.standings-full-table a').first().click();await single(true);
  assert.equal(new URL(page.url()).searchParams.get('playerId'),String(player));
  await expect(page.locator('.score-item.selected-score').locator('..').locator('..')).toContainText(player===708?'Synthetic Man':'Synthetic Woman');
 }
 checks.push('Overall Men/Women and division Men/Women links retain the correct stable player/team association');
 for(const bad of ['leagueId=999&scrambleNumber=12&kingQueenTeamId=107&playerId=707',
  'leagueId=202&scrambleNumber=99&kingQueenTeamId=107&playerId=707',
  'leagueId=202&scrambleNumber=12&kingQueenTeamId=101&playerId=707',
  'leagueId=202&scrambleNumber=12&kingQueenTeamId=107&playerId=707&roundId=99',
  'leagueId=202&scrambleNumber=12']){
  await page.goto(BASE_URL+'/kqmatchups?fromStandings=1&'+bad);
  await expect(page.locator('[role=alert]')).toBeVisible();await expect(page.locator('.match-row')).toHaveCount(0);
 }
 malformed=true;await page.goto(BASE_URL+'/kqmatchups?fromStandings=1&leagueId=202&scrambleNumber=12&kingQueenTeamId=107&playerId=707');
 await expect(page.locator('[role=alert]')).toBeVisible();await expect(page.locator('.match-row')).toHaveCount(0);malformed=false;
 checks.push('Missing league/week/team/player/round, incomplete link and incomplete pairing never show an unrelated matchup');
 await page.goto(BASE_URL+'/kqmatchups');await expect(page.locator('mat-option')).toHaveCount(0);
 await page.waitForFunction(()=>window.ng.probe(document.querySelector('app-kqmatchups')).componentInstance.queriedScrambles.length===2);
 await page.locator('mat-select').click();await page.getByRole('option',{name:/Week 1/}).click();
 await expect(page.locator('.match-row')).toHaveCount(4);await expect(page.getByRole('button',{name:'Back to Standings'})).toHaveCount(0);
 await expect(page.locator('.bye-players')).toBeVisible();checks.push('Normal browsing retains week selection, all matchups and byes without extra back button');
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,pageErrors:errors,writes,databaseAccess:false,mode:'real Angular UI; browser-only synthetic API fixtures'},null,2));
 console.log(checks.length+' focused score navigation groups passed.');await browser.close();
})().catch(async error=>{console.error(error.stack);if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

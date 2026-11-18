// Read-only UI verification with browser-only synthetic display data.
// Every API is intercepted; every non-GET request is blocked. No SQL helper is used.
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('@playwright/test');
const {assertLocalUrl,BASE_URL}=require('../helpers/safety.cjs');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
  const page=await context.newPage();
  const output=path.resolve(__dirname,'../artifacts/team-scores/ui-preview');fs.mkdirSync(output,{recursive:true});
  const today=new Date();const day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  let scheduled=true;let deniedWrites=0;
  const teams=[{id:-11,leagueID:-101,teamName:'Harbor Aces',division:'Gold',totalWins:0,totalLosses:0},
    {id:-12,leagueID:-101,teamName:'Court Rockets',division:'Gold',totalWins:0,totalLosses:0},
    {id:-13,leagueID:-101,teamName:'Sideout Crew',division:'Silver',totalWins:0,totalLosses:0},
    {id:-14,leagueID:-101,teamName:'Net Results',division:'Silver',totalWins:0,totalLosses:0}];
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
    let url;try{url=assertLocalUrl(route.request().url());}catch{await route.abort();return;}
    if(route.request().method()!=='GET'){deniedWrites++;await route.abort('blockedbyclient');return;}
    if(!url.pathname.toLowerCase().startsWith('/api/')){await route.continue();return;}
    const p=url.pathname.toLowerCase();let body=[];
    if(p==='/api/login/isauthenticated')body=true;
    else if(p==='/api/login/isadminpasswordauthorized')body=false;
    else if(p==='/api/login/getusersrole')body={role:'Manager'};
    else if(p==='/api/login/getusersplayer')body={playerId:null};
    else if(p==='/api/login/getuserleagues')body=[{id:-101,leagueName:'Synthetic Preview League'}];
    else if(p.startsWith('/api/statistics/getteams/'))body=teams;
    else if(p.startsWith('/api/statistics/getleagueschedule/')&&scheduled)body=[{weekNumber:1,date:day+'T00:00:00',matches:[
      {scheduleId:-1,team1Id:-11,team2Id:-12,team1Name:teams[0].teamName,team2Name:teams[1].teamName,division:'Gold',matchDescription:'Court 1'},
      {scheduleId:-2,team1Id:-13,team2Id:-14,team1Name:teams[2].teamName,team2Name:teams[3].teamName,division:'Silver',matchDescription:'Court 2'}]}];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(BASE_URL+'/team-scores');
  await page.waitForSelector('app-team-scores h2');
  await page.evaluate(()=>{
    const debug=window.ng.probe(document.querySelector('app-team-scores'));
    debug.injector.get(window.ng.coreTokens.NgZone).run(()=>{
      const service=debug.componentInstance.leagueService;
      service.leaguesAvailable=[{id:-101,leagueName:'Synthetic Preview League'}];service.setSelectedLeague(-101);
    });
  });
  await page.waitForSelector('.matchup-card');
  assert.equal(await page.locator('.matchup-card').count(),2);
  assert.equal(await page.locator('.matchup-card').first().locator('.game-row').count(),3);
  assert.equal(await page.locator('.matchup-card').first().locator('mat-select').count(),1,'Scheduled teams must be fixed, with only game count selectable');
  for(const [name,width,height] of [['scheduled-desktop',1366,900],['scheduled-mobile',390,844]]){
    await page.setViewportSize({width,height});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
    assert(await page.evaluate(()=>{
      const fields=Array.from(document.querySelector('.game-row').querySelectorAll('mat-form-field')).map(e=>e.getBoundingClientRect());
      return fields.length===2 && fields[0].width>100 && Math.abs(fields[0].width-fields[1].width)<1 && Math.abs(fields[0].y-fields[1].y)<1;
    }),'Both score fields must occupy equal-width columns on the same row');
    await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  }
  await page.getByRole('button',{name:'Add Manual Matchup',exact:true}).click();
  assert.equal(await page.locator('.matchup-card').count(),3);
  scheduled=false;
  await page.getByRole('button',{name:'Reload date',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.matchup-card').length===1);
  assert(await page.getByText(/No games are scheduled for this date/).isVisible());
  for(const [name,width,height] of [['manual-desktop',1366,900],['manual-mobile',375,667]]){
    await page.setViewportSize({width,height});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
    await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  }
  assert.equal(deniedWrites,0,'Preview must not attempt any database write');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({mode:'browser-only synthetic display fixtures',serverOrDatabaseTests:false,
    assertions:['two scheduled matchups','stable team IDs rendered with fixed teams','three games by default','manual option with schedule',
      'no-schedule manual fallback','desktop and mobile without horizontal overflow','paired equal-width score fields on mobile'],deniedWrites,pageErrors:errors},null,2));
  await browser.close();console.log('Read-only Team Scores UI preview: all assertions passed; screenshots saved. No API or SQL mutation.');
})().catch(error=>{console.error(error.message);process.exit(1);});

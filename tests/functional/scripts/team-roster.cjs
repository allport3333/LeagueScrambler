// Read-only browser fixtures: identity is simulated, every API is intercepted, no database writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,expect}=require('@playwright/test');
const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../artifacts/team-roster');fs.mkdirSync(out,{recursive:true});
const teams=[{id:11,teamName:'Harbor Aces',division:'Gold',players:[{id:1001},{id:1002},{id:1002}]},{id:12,teamName:'Court Rockets',division:'Gold',players:[{id:2001}]},{id:13,teamName:'Empty Team',division:'Silver',players:[]}];
const players=[{id:1001,firstName:'Alexandra',lastName:'Long-Surname',isMale:false},{id:1002,firstName:'Same',lastName:'Name',isMale:true},{id:2001,firstName:'Same',lastName:'Name',isMale:true},{id:9001,firstName:'Unrelated',lastName:'Player'}];
const date=new Date();const today=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const schedule=[1,2,3,4,5,6].map((n)=>({weekNumber:n,date:today+'T00:00:00',matches:[{scheduleId:100+n,team1Id:11,team2Id:12,team1Name:teams[0].teamName,team2Name:teams[1].teamName,division:'Gold'},{scheduleId:200+n,team1Id:13,team2Id:12,team1Name:'Empty Team',team2Name:teams[1].teamName,division:'Silver'}]}));
let browser;
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1366,height:900}});const page=await context.newPage();
 let role='Player',mode='normal';const errors=[],checks=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url()),p=u.pathname.toLowerCase();
  if(request.method()!=='GET'){writes.push(p);return route.abort();}
  if(u.origin!==new URL(BASE_URL).origin){if(['fonts.googleapis.com','fonts.gstatic.com','use.fontawesome.com'].includes(u.hostname))return route.continue();return route.abort();}
  assertLocalUrl(u.href);if(!p.startsWith('/api/'))return route.continue();let data=[];
  if(p.endsWith('/isauthenticated'))data=true;
  else if(p.endsWith('/getusersrole'))data={role};
  else if(p.endsWith('/getusersplayer'))data={playerId:1001};
  else if(p.includes('/getuserleagues')||p.endsWith('/getleagues'))data=[{id:101,leagueName:'Roster Fixture League'},{id:102,leagueName:'Other Season'}];
  else if(p.includes('/getallteamswithplayers/')){
   if(mode==='error')return route.fulfill({status:503,body:'{}'});
   if(mode==='loading')await new Promise(r=>setTimeout(r,900));
   data=p.endsWith('/102')?[]:teams;
  }
  else if(p.includes('/scrambledata/getplayers/'))data=players;
  else if(p.includes('/getleagueschedule/'))data=schedule;
  else if(p.includes('/league-standings/'))data=teams.map(t=>({...t,teamId:t.id,wins:3,losses:2,totalPoints:42}));
  else if(p.includes('/playerattendance/'))data={visible:true,isOwnProfile:true,canSignIn:false,canRemove:false,isSignedIn:false,reason:'Sign in is available on Sunday only.'};
  else if(p.includes('/getdetailedperformancestats'))data={individualRounds:[],scrambleTotals:[]};
  else if(p.includes('/getbyleague'))data={maxRounds:1,playerScores:[]};
  else if(p.includes('/getsettingvalue'))data='matchup';
  else if(p.endsWith('/isadminpasswordauthorized'))data=false;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 async function go(url){await page.goto(BASE_URL+url);await expect(page.locator('app-team-roster-button').first()).toBeVisible();}
 const roster=()=>page.getByRole('dialog').filter({has:page.locator('app-team-roster-dialog')});
 async function close(){await roster().getByRole('button',{name:'Close team roster'}).click();await expect(roster()).toHaveCount(0);}
 await go('/league-dashboard?leagueId=101&tab=schedule&weekNumber=2');const root=page.locator('app-league-schedule');
 const own=root.getByRole('button',{name:'View roster for Harbor Aces'}).first();await own.click();await expect(roster()).toContainText('Alexandra');await expect(roster().locator('tbody tr')).toHaveCount(2);await expect(roster()).not.toContainText('Unrelated');await expect(roster()).toContainText('Current available roster');await page.keyboard.press('Escape');await expect(roster()).toHaveCount(0);await expect(own).toBeFocused();await expect(root.locator('mat-select')).toContainText('Week 2');
 await root.getByRole('button',{name:'View roster for Court Rockets'}).first().click();await expect(roster().locator('tbody tr')).toHaveCount(1);await expect(roster()).not.toContainText('Alexandra');await close();checks.push('Schedule IDs, separate people with same name, duplicate membership identity, unrelated-player exclusion, Escape/focus return and selected-week preservation.');
 await root.getByRole('button',{name:'View roster for Empty Team'}).first().click();await expect(roster()).toContainText('No players are currently available');await close();
 mode='error';await own.click();await expect(roster()).toContainText('Unable to load this team roster');await expect(roster().locator('tbody tr')).toHaveCount(0);await close();
 mode='loading';await own.click();await expect(roster()).toContainText('Loading roster');await expect(roster().locator('tbody tr')).toHaveCount(0);await expect(roster()).toContainText('Alexandra');await close();mode='normal';checks.push('Empty, failed and loading requests distinguish states without stale rows.');
 await root.getByRole('button',{name:'Full Schedule',exact:true}).click();const full=page.getByRole('dialog').filter({has:page.locator('.season-dialog-layout')});await full.locator('mat-dialog-content').evaluate(e=>e.scrollTop=180);const scroll=await full.locator('mat-dialog-content').evaluate(e=>e.scrollTop);
 const nestedButton=full.getByRole('button',{name:'View roster for Harbor Aces'}).last();await nestedButton.click();await expect(page.getByRole('dialog')).toHaveCount(2);await expect(roster()).toContainText('Alexandra');await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'full-schedule-roster-desktop.png')});
 // Focus stays in the upper dialog; Escape closes only that dialog.
 await page.keyboard.press('Tab');assert(await roster().evaluate(e=>e.contains(document.activeElement)));await page.keyboard.press('Escape');await expect(roster()).toHaveCount(0);await expect(full).toBeVisible();await expect(nestedButton).toBeFocused();assert((await full.locator('mat-dialog-content').evaluate(e=>e.scrollTop))>=scroll);
 for(const width of [375,390,430,1366]){await page.setViewportSize({width,height:844});await full.getByRole('button',{name:'View roster for Harbor Aces'}).first().click();await expect(roster()).toContainText('Long-Surname');assert.equal(await roster().evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'roster-'+width+'.png')});await close();}
 checks.push('Material stacked dialogs: Full Schedule remains open, focus containment/restoration, scroll retained, 375/390/430/1366px roster without overflow.');
 // Capture the existing print output without opening a system print dialog.
 const html=await page.evaluate(()=>{let html='';const el=document.querySelector('app-league-schedule'),debug=window.ng.probe(el),c=debug.componentInstance;const previous=window.open;window.open=()=>({document:{open(){},write(s){html=s},close(){}},print(){},close(){}});try{c.printFullSchedule()}finally{window.open=previous}return html;});const print=await context.newPage();await print.setContent(html);await expect(print.locator('button,app-team-roster-button')).toHaveCount(0);await expect(print.locator('.season-match')).toHaveCount(12);await expect(print.locator('body')).toContainText('Harbor Aces');await print.pdf({path:path.join(out,'full-schedule.pdf'),preferCSSPageSize:true,printBackground:true});await print.close();await full.getByRole('button',{name:'Close full schedule'}).click();checks.push('Full Schedule print retains all twelve fixture matchups and plain team labels; no roster controls printed.');
 for(const userRole of ['Player','Admin']){role=userRole;await go('/');const next=page.locator('app-player-next-game');await next.getByRole('button',{name:'View roster for Harbor Aces'}).first().click();await expect(roster()).toContainText('Alexandra');await close();await next.getByRole('button',{name:'View roster for Court Rockets'}).first().click();await expect(roster().locator('tbody tr')).toHaveCount(1);await close();await expect(page.locator('app-player-attendance')).toBeVisible();await page.screenshot({path:path.join(out,'home-'+userRole.toLowerCase()+'.png'),fullPage:true});}checks.push('Home own/opponent rosters work for Player and Admin client-role fixtures, without navigating or removing attendance. Not actual login tests.');
 await go('/league-dashboard?leagueId=102&tab=schedule&weekNumber=1');await page.getByRole('button',{name:'View roster for Harbor Aces'}).first().focus();await page.keyboard.press('Enter');await expect(roster()).toContainText('No players are currently available');await expect(roster().locator('tbody tr')).toHaveCount(0);await close();checks.push('Same team ID in unrelated league does not leak a roster; keyboard Enter activates the team button.');
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,writes,mode:'Synthetic browser-only API and identity fixtures; no authentication or persistence claims'},null,2));console.log(checks.join('\n'));await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser){const page=browser.contexts()[0].pages()[0];if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

// Existing development data only. Client identity fixtures are not real login verification.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,expect}=require('@playwright/test');
const {BASE_URL,assertLocalUrl,envSettings}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../artifacts/team-roster');let browser;
(async()=>{
 assert.equal(envSettings().database,'LeagueScramblerDev');
 browser=await chromium.launch();const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1366,height:900}});
 const get=async p=>{assertLocalUrl(BASE_URL+p);const response=await context.request.get(BASE_URL+p);assert.equal(response.status(),200,p);return response.json();};
 const teams=await get('/api/Statistics/GetAllTeamsWithPlayers/133');const players=await get('/api/ScrambleData/GetPlayers/133');const schedule=await get('/api/Statistics/GetLeagueSchedule/133');
 const team=teams.find(t=>t.players.some(p=>p.id===7414));assert(team,'Previously seeded test participant must exist');
 const ids=[...new Set(team.players.map(p=>p.id))];const members=players.filter(p=>ids.includes(p.id));assert.equal(members.length,ids.length);
 const week=schedule.find(w=>w.matches.some(m=>m.team1Id===team.id||m.team2Id===team.id));assert(week);
 const writes=[];await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url()),p=u.pathname.toLowerCase();if(r.method()!=='GET'){writes.push(p);return route.abort();}if(u.origin!==new URL(BASE_URL).origin){if(['fonts.googleapis.com','fonts.gstatic.com','use.fontawesome.com'].includes(u.hostname))return route.continue();return route.abort();}assertLocalUrl(u.href);let data;
 if(p.endsWith('/isauthenticated'))data=true;
 else if(p.endsWith('/getusersrole'))data={role:'Player'};
 else if(p.endsWith('/getusersplayer'))data={userId:97,playerId:7414};
 else if(p.endsWith('/getuserleagues'))data=[{id:133,leagueName:'WW Test League'}];
 if(data!==undefined)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 return route.continue();});
 const page=await context.newPage();await page.goto(BASE_URL+'/league-dashboard?leagueId=133&tab=schedule&weekNumber='+week.weekNumber);
 await page.getByRole('button',{name:'View roster for '+team.teamName,exact:true}).first().click();const dialog=page.getByRole('dialog');await expect(dialog.locator('tbody tr')).toHaveCount(ids.length);
 for(const p of members){await expect(dialog).toContainText(p.firstName);await expect(dialog).toContainText(p.lastName);}
 await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'live-seeded-roster-desktop.png')});await page.setViewportSize({width:390,height:844});assert.equal(await dialog.evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.screenshot({path:path.join(out,'live-seeded-roster-mobile.png')});await page.keyboard.press('Escape');
 await expect(page.locator('app-league-schedule mat-select')).toContainText('Week '+week.weekNumber);
 await page.getByRole('button',{name:'Full Schedule',exact:true}).click();const full=page.getByRole('dialog').filter({has:page.locator('.season-dialog-layout')});await expect(full.locator('.season-week')).toHaveCount(12);await full.getByRole('button',{name:'View roster for '+team.teamName,exact:true}).first().click();const roster=page.getByRole('dialog').filter({has:page.locator('app-team-roster-dialog')});await expect(roster.locator('tbody tr')).toHaveCount(ids.length);await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'live-seeded-full-schedule-roster.png')});await page.keyboard.press('Escape');await expect(roster).toHaveCount(0);await expect(full).toBeVisible();assert.deepEqual(writes,[]);
 fs.writeFileSync(path.join(out,'live-results.json'),JSON.stringify({leagueId:133,teamId:team.id,memberCount:ids.length,scheduleWeeks:schedule.length,passed:true,databaseWrites:0,identity:'Client identity fixtures only. All schedule/team/player responses came from live development read APIs. Real account login remains unverified.'},null,2));console.log('Live seeded league roster matches actual team membership IDs; desktop/mobile and stacked Full Schedule passed. No writes or real login.');await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser)await browser.close();process.exitCode=1;});

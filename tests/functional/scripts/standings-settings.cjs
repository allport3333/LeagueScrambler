// Local UI fixtures only. Every API intercepted; writes and external requests blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const before=process.argv.includes('--before'),out=path.resolve(__dirname,'../standings-settings-evidence');fs.mkdirSync(out,{recursive:true});let browser;
if(before&&fs.existsSync(path.join(out,'desktop-1366-before.png')))throw Error('Original desktop baseline already exists; refusing to overwrite it.');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const player={playerId:707,playerName:'Synthetic Player',isMale:true,leagueDivisionId:8,leagueDivisionCode:'Gold',scores:
 [100,90,0,172,78,90,82,94,88,80,96].map((score,i)=>({roundId:i+1,scrambleNumber:10+i*10,score,roundWon:0,isSubScore:i===3,
 kingQueenTeamId:201+i*10,hasSavedScore:true}))};
(async()=>{
 browser=await chromium.launch();const checks=[],errors=[],writes=[];let role='Admin';
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  let u;try{u=assertLocalUrl(route.request().url());}catch{await route.abort();return;}
  const p=u.pathname.toLowerCase();if(route.request().method()!=='GET'){if(p.startsWith('/api/'))writes.push(p);await route.abort();return;}
  if(!p.startsWith('/api/')){await route.continue();return;}
  let data=[];
  if(p==='/api/login/isauthenticated')data=role!=='Anonymous';
  else if(p==='/api/login/getusersrole')data={role:role==='Anonymous'?'None':role};
  else if(p==='/api/login/getusersplayer')data={playerId:707};
  else if(p==='/api/login/getuserleagues'||p==='/api/scrambledata/getleagues')data=[{id:101,leagueName:'Synthetic League'}];
  else if(u.searchParams.has('settingName'))data={settingValue:{numberOfSubsAllowed:'0',subScorePercent:'50',dropLowest:'1',standingsType:'matchup'}[u.searchParams.get('settingName')]};
  else if(p.includes('/getbyleague'))data={maxRounds:11,playerScores:[player]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const url=BASE_URL+'/standings?leagueId=101&standingsMode=matchup';
 async function open(width,height){await page.setViewportSize({width,height});await page.goto(url);await expect(page.locator('app-league-standings .compact-table').first()).toContainText('Synthetic Player');await page.waitForTimeout(550);}
 const pane=()=>page.locator('app-league-standings .standings-card > mat-tab-group > .mat-tab-body-wrapper > mat-tab-body.mat-tab-body-active > .mat-tab-body-content > mat-tab-group > .mat-tab-body-wrapper > mat-tab-body.mat-tab-body-active > .mat-tab-body-content');
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await open(width,height);await expect(page.locator('.dropdown-container')).toBeVisible();
  await page.screenshot({path:path.join(out,`desktop-${width}-${before?'before':'after'}.png`),fullPage:true});
  if(!before)assert.equal(hash(path.join(out,`desktop-${width}-before.png`)),hash(path.join(out,`desktop-${width}-after.png`)),'Desktop pixels must stay identical');
 }
 if(before){console.log('Desktop settings baseline captured.');await browser.close();return;}
 checks.push('Desktop 1366/1920 screenshots identical, existing settings remain visible');
 for(const [width,height] of [[375,667],[390,844],[430,932]]){
  role='Admin';await open(width,height);
  const toggle=page.getByRole('button',{name:'Standings Settings',exact:true});
  await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(page.locator('.dropdown-container')).toBeHidden();
  assert(await toggle.evaluate(e=>e.getBoundingClientRect().height>=44));
  await page.screenshot({path:path.join(out,`admin-${width}-collapsed.png`),fullPage:true});
  const initial=await page.evaluate(()=>{const c=window.ng.probe(document.querySelector('app-league-standings')).componentInstance;
   return JSON.stringify({subs:c.numberOfSubsAllowed,percent:c.subScorePercent,drop:c.dropLowest,scores:c.maleStandings});});
  await toggle.click();await expect(page.locator('.dropdown-container')).toBeVisible();
  await expect(page.locator('.dropdown-container mat-select')).toHaveText(['No Subs Allowed','50%','Drop 1 Score']);
  await page.screenshot({path:path.join(out,`admin-${width}-expanded-settings.png`),fullPage:true});
  await toggle.press('Enter');await expect(page.locator('.dropdown-container')).toBeHidden();
  assert.equal(await page.evaluate(()=>{const c=window.ng.probe(document.querySelector('app-league-standings')).componentInstance;return JSON.stringify({subs:c.numberOfSubsAllowed,percent:c.subScorePercent,drop:c.dropLowest,scores:c.maleStandings});}),initial);
  await pane().locator('.mobile-player-toggle').first().click();
  const entries=pane().locator('.mobile-player-details:visible .mobile-round-scores li');
  await expect(entries.locator('> span:first-child')).toHaveText(Array.from({length:11},(_,i)=>'Matchup '+(i+1)));
  await expect(entries.nth(2).locator('.mobile-score-indicators')).toHaveText('Dropped');
  await expect(entries.nth(3).locator('strong')).toHaveText('86');
  await expect(entries.nth(3).locator('.mobile-score-indicators')).toContainText('Substitute');
  assert.equal(await entries.nth(2).evaluate(e=>getComputedStyle(e).color),'rgb(255, 0, 0)');
  assert.equal(await entries.nth(3).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(216, 191, 216)');
  const grid=await entries.evaluateAll(nodes=>nodes.map(e=>{
   const row=e.getBoundingClientRect(),label=e.children[0].getBoundingClientRect(),score=e.children[1].getBoundingClientRect(),flags=e.children[2].getBoundingClientRect();
   return {rowCenter:row.left+row.width/2,scoreCenter:score.left+score.width/2,labelRight:label.right,scoreLeft:score.left,scoreRight:score.right,flagsLeft:flags.left,
    overflow:e.scrollWidth>e.clientWidth+1,align:getComputedStyle(e.children[2]).justifyContent,touch:e.querySelector('a').getBoundingClientRect().height};
  }));
  assert(grid.every(r=>Math.abs(r.scoreCenter-r.rowCenter)<1&&r.labelRight<=r.scoreLeft&&r.scoreRight<=r.flagsLeft&&!r.overflow&&r.align==='flex-end'&&r.touch>=44));
  const link=new URL(await entries.nth(3).locator('a').getAttribute('href'),BASE_URL);assert.equal(link.pathname,'/kqmatchups');assert.equal(link.searchParams.get('scrambleNumber'),'40');assert.equal(link.searchParams.get('kingQueenTeamId'),'231');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,`admin-${width}-score-details.png`),fullPage:true});
  checks.push(`${width}px: collapsed default, controls/values preserved, centered equal-column scores, right indicators/colors, ascending order, links and 44px touch targets`);
 }
 for(const value of ['Manager','Player','Anonymous']){
  role=value;await open(390,844);const toggle=page.getByRole('button',{name:'Standings Settings',exact:true});
  if(value==='Manager'){await expect(toggle).toBeVisible();await expect(toggle).toHaveAttribute('aria-expanded','false');await toggle.click();await expect(page.locator('.dropdown-container')).toBeVisible();}
  else{await expect(toggle).toHaveCount(0);await expect(page.locator('.dropdown-container')).toHaveCount(0);}
  checks.push(value+': correct settings-section visibility');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,pageErrors:errors,writes,databaseAccess:false,mode:'actual Angular UI; synthetic intercepted API data'},null,2));
 console.log(checks.length+' focused standings-settings groups passed.');await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

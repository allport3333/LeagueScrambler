// Local presentation only: intercept every API GET, block every write/external request.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const before=process.argv.includes('--before');const out=path.resolve(__dirname,'../standings-gap-evidence');fs.mkdirSync(out,{recursive:true});
const baselineFile=path.join(out,'baseline.json');if(before&&fs.existsSync(baselineFile))throw Error('Refusing to overwrite baseline.');
let browser;
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function measure(page){return page.evaluate(()=>{
  const nav=document.querySelector('app-nav-menu nav'),card=document.querySelector('app-league-standings > mat-card'),body=document.querySelector('.body-content');
  const n=nav.getBoundingClientRect(),c=card?.getBoundingClientRect();
  return {gap:c?c.top-n.bottom:null,padding:getComputedStyle(body).paddingTop,cardPadding:card?getComputedStyle(card).padding:null,
    cardMargin:card?getComputedStyle(card).marginTop:null,nav:{x:n.x,y:n.y,width:n.width,height:n.height,text:nav.textContent.trim()},
    overflow:document.documentElement.scrollWidth>innerWidth};
});}
(async()=>{
  browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});const writes=[],errors=[],checks=[];
  await context.route('**/*',async route=>{
    let u;try{u=assertLocalUrl(route.request().url());}catch{await route.abort();return;}
    if(route.request().method()!=='GET'){if(u.pathname.startsWith('/api/'))writes.push(u.pathname);await route.abort();return;}
    if(!u.pathname.toLowerCase().startsWith('/api/')){await route.continue();return;}
    let data=[];const p=u.pathname.toLowerCase();
    if(p==='/api/login/getusersrole')data={role:'Player'};
    else if(p==='/api/login/isauthenticated')data=false;
    else if(u.searchParams.has('settingName'))data={settingValue:{numberOfSubsAllowed:'100',subScorePercent:'100',dropLowest:'0',standingsType:'round'}[u.searchParams.get('settingName')]};
    else if(p.startsWith('/api/scrambledata/getbyleague/'))data={maxRounds:3,playerScores:[
      {playerId:-101,playerName:'Synthetic Player',isMale:true,leagueDivisionId:0,leagueDivisionCode:'Unassigned',scores:[21,18,25].map((score,i)=>({roundId:i+1,score,roundWon:1,isSubScore:false}))}]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  async function ready(){
    await expect(page.locator('app-league-standings > mat-card')).toBeVisible();
    await page.evaluate(()=>{const d=window.ng.probe(document.querySelector('app-league-standings'));d.injector.get(window.ng.coreTokens.NgZone).run(()=>{
      const s=d.componentInstance.leagueService;s.leaguesAvailable=[{id:-501,leagueName:'Synthetic Standings'}];s.setSelectedLeague(-501);
    });});
    await expect(page.locator('app-league-standings .compact-table').first()).toContainText('Synthetic Player');await page.waitForTimeout(550);
  }
  const measurements={};const baseline=before?null:JSON.parse(fs.readFileSync(baselineFile));
  for(const [width,height] of [[375,667],[390,844],[768,1024],[1366,768],[1920,1080]]){
    await page.setViewportSize({width,height});await page.goto(BASE_URL+'/standings');await ready();
    measurements[width]=await measure(page);
    await page.screenshot({path:path.join(out,`${width}-${before?'before':'after'}.png`),fullPage:true});
    if(!before){
      const m=measurements[width],b=baseline[width];assert.deepEqual(m.nav,b.nav,'Navigation must not change');
      assert.equal(m.cardPadding,b.cardPadding,'Card interior padding must not change');assert.equal(m.cardMargin,b.cardMargin);
      if(width<=767){
        assert(m.gap>=12&&m.gap<=16);assert.equal(m.padding,'6px');assert.equal(m.overflow,false);
        await page.reload();await ready();const refreshed=await measure(page);assert.equal(refreshed.gap,m.gap);
        await page.goto(BASE_URL+'/faq');await expect(page.locator('app-league-standings')).toHaveCount(0);
        assert.equal((await measure(page)).padding,'85px','Other mobile routes retain their existing padding');
        await page.evaluate(()=>{const d=window.ng.probe(document.querySelector('app-nav-menu'));d.injector.get(window.ng.coreTokens.NgZone).run(()=>d.componentInstance.router.navigateByUrl('/standings?from=faq#players'));});
        await ready();assert.equal((await measure(page)).gap,m.gap,'Route navigation/query/fragment must get the same gap');
        checks.push(`${width}px: direct load, refresh and FAQ-to-standings navigation give ${m.gap}px gap; other route unchanged`);
      }else{
        assert.deepEqual(m,b,'Tablet/desktop measurements unchanged');
        assert.equal(digest(path.join(out,`${width}-before.png`)),digest(path.join(out,`${width}-after.png`)),'Tablet/desktop screenshots unchanged');
        checks.push(`${width}px: screenshot and layout identical to baseline`);
      }
    }
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(before?baselineFile:path.join(out,'results.json'),JSON.stringify(before?measurements:{checks,measurements,writes,pageErrors:errors,databaseAccess:false,mode:'browser-only synthetic display fixtures'},null,2));
  console.log(before?'Before-change baseline captured.':`${checks.length} focused gap checks passed; no API writes or database access.`);
  await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

// Focused presentation checks: localhost only; ALL APIs mocked; ALL writes blocked.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium,expect}=require('@playwright/test');
const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const baseline=process.argv.includes('--baseline');
const captureSpacing=process.argv.includes('--capture-spacing');
let activeBrowser;
const out=path.resolve(__dirname,'../mobile-standings-refinements-evidence');fs.mkdirSync(out,{recursive:true});
if(baseline&&fs.existsSync(path.join(out,'desktop-baseline.json')))throw new Error('Original baseline already exists; refusing to overwrite before-change evidence.');
const scores=(numbers,sub=false)=>numbers.map((score,i)=>({roundId:i+1,score,roundWon:i%2===0,isSubScore:sub&&i<2,date:'2026-11-01T00:00:00'}));
const fixture={maxRounds:5,playerScores:[
  {playerId:-101,playerName:'Alex Riverstone',isMale:true,leagueDivisionId:11,leagueDivisionCode:'Gold',scores:scores([21,18,25,20,19],true)},
  {playerId:-102,playerName:'Blake Long-Player-Name',isMale:true,leagueDivisionId:12,leagueDivisionCode:'Silver',scores:scores([18,15,22,18,17])},
  {playerId:-103,playerName:'Casey Shore',isMale:true,leagueDivisionId:13,leagueDivisionCode:'Bronze',scores:scores([9,12,13,14,16])},
  {playerId:-104,playerName:'Dana Lake',isMale:false,leagueDivisionId:11,leagueDivisionCode:'Gold',scores:scores([21,19,22,25,20],true)},
  {playerId:-105,playerName:'Erin Meadow',isMale:false,leagueDivisionId:12,leagueDivisionCode:'Silver',scores:scores([13,12,18,20,21])},
  {playerId:-106,playerName:'Fran Willow',isMale:false,leagueDivisionId:13,leagueDivisionCode:'Bronze',scores:scores([10,11,12,13,14])}
]};
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
async function desktopState(page) {
  return page.locator('app-league-standings').evaluate(root=>{
    const table=Array.from(root.querySelectorAll('table.compact-table')).find(t=>t.getBoundingClientRect().width&&t.closest('.mat-tab-body-active'));
    const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100);};
    return {root:rect(root),table:rect(table),cells:Array.from(table.querySelectorAll('th,td')).map(e=>{
      const s=getComputedStyle(e);return {text:e.textContent.trim().replace(/\s+/g,' '),rect:rect(e),font:s.font,fontWeight:s.fontWeight,
        color:s.color,background:s.backgroundColor,padding:s.padding,textAlign:s.textAlign};
    }),tabs:Array.from(root.querySelectorAll('.mat-tab-label')).filter(e=>e.getBoundingClientRect().width).map(e=>e.textContent.trim())};
  });
}
(async()=>{
  const browser=activeBrowser=await chromium.launch();const errors=[];const writes=[];let apiReads=0;const checks=[];
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    let u;try{u=assertLocalUrl(route.request().url());}catch{await route.abort();return;}
    if(route.request().method()!=='GET'){if(u.pathname.toLowerCase().startsWith('/api/'))writes.push(u.pathname);await route.abort('blockedbyclient');return;}
    if(!u.pathname.toLowerCase().startsWith('/api/')){await route.continue();return;}
    apiReads++;const p=u.pathname.toLowerCase();let body=[];
    if(p==='/api/login/getusersrole')body={role:'Admin'};
    else if(p==='/api/login/isauthenticated')body=false;
    // Explicitly match the original captured desktop state; exercise reduction/drop settings below.
    else if(u.searchParams.has('settingName'))body={settingValue:{numberOfSubsAllowed:'100',subScorePercent:'100',dropLowest:'0',standingsType:'matchup'}[u.searchParams.get('settingName')]};
    else if(p.startsWith('/api/scrambledata/getbyleaguematchup/'))body={...fixture,playerScores:fixture.playerScores.map(p=>({...p,scores:p.scores.map((s,i)=>({...s,roundId:i+1,score:s.score+2}))}))};
    else if(p.startsWith('/api/scrambledata/getbyleague/'))body=fixture;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1366,height:768});await page.goto(BASE_URL+'/standings');
  await page.waitForSelector('app-league-standings');
  await page.evaluate(()=>{
    const debug=window.ng.probe(document.querySelector('app-league-standings'));
    debug.injector.get(window.ng.coreTokens.NgZone).run(()=>{
      const s=debug.componentInstance.leagueService;
      s.leaguesAvailable=[{id:-501,leagueName:'Synthetic Mobile Standings'}];s.setSelectedLeague(-501);
    });
  });
  await expect(page.locator('app-league-standings table.compact-table').first()).toContainText('Alex Riverstone');
  await page.waitForTimeout(400);
  const desktop={};
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    desktop[width]=await desktopState(page);
    await page.screenshot({path:path.join(out,`desktop-${width}x${height}-${baseline||captureSpacing?'before':'after'}.png`),fullPage:true});
  }
  if(captureSpacing){
    if(fs.existsSync(path.join(out,'refinement-baseline.json')))throw new Error('Refusing to overwrite pre-refinement baseline.');
    await page.evaluate(()=>{const d=window.ng.probe(document.querySelector('app-league-standings'));d.injector.get(window.ng.coreTokens.NgZone).run(()=>{d.componentInstance.userRole='Player';});});
    const spacing={};
    for(const [width,height] of [[375,667],[390,844]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(550);
      spacing[width]=await page.locator('.mobile-rankings:visible').evaluate(t=>({tableTop:t.getBoundingClientRect().top,tableWidth:t.getBoundingClientRect().width}));
      await page.screenshot({path:path.join(out,`mobile-${width}-before.png`),fullPage:true});
    }
    fs.writeFileSync(path.join(out,'refinement-baseline.json'),JSON.stringify({desktop,spacing},null,2));
    console.log('Pre-refinement desktop and mobile spacing baseline captured without API or SQL access.');
  }else if(baseline){
    fs.writeFileSync(path.join(out,'desktop-baseline.json'),JSON.stringify({fixture,desktop},null,2));
    console.log('Desktop baseline captured at both requested sizes; all API reads intercepted; no writes.');
  }else{
    const before=JSON.parse(fs.readFileSync(path.join(out,'refinement-baseline.json')));
    const expected=JSON.parse(JSON.stringify(before.desktop));
    // The sole desktop change is reversing the five previously descending score columns.
    for(const state of Object.values(expected)){
      const cells=state.cells;
      for(let row=0;row<cells.length;row+=9){
        const reversed=cells.slice(row+4,row+9).reverse();
        for(let i=0;i<5;i++)cells[row+4+i]={...reversed[i],rect:cells[row+4+i].rect};
      }
    }
    assert.deepEqual(desktop,expected,'Desktop geometry/styles/values must match baseline apart from ascending score columns');
    checks.push('Desktop at both sizes: preserved geometry/fonts/spacing/colors, with only requested ascending column order');
    console.log('Desktop preservation check passed, allowing only chronological column ordering.');
    // API-realistic round IDs repeat across scrambles. Chronological positions, not raw round IDs,
    // must label the 11 display columns. Matchup IDs, in contrast, are normalized sequentially.
    fixture.maxRounds=11;
    fixture.playerScores.forEach(p=>{
      p.scores.push(...scores([26,14,23,17,22,16]));
      p.scores=p.scores.map((s,i)=>({...s,roundId:i%3+1,scrambleNumber:100+Math.floor(i/3)*10}));
    });
    fixture.playerScores.push({playerId:-107,playerName:'Jamie No Division',isMale:true,leagueDivisionId:0,leagueDivisionCode:'Unassigned',scores:scores(Array(11).fill(0))});
    await page.getByRole('button',{name:'Show Standings by Round',exact:true}).click();
    const settings=page.locator('app-league-standings .dropdown-container mat-select');
    for(const [index,label] of [[0,'Allow 1 Sub'],[1,'50%'],[2,'Drop 1 Score']]){
      await settings.nth(index).click();await page.getByRole('option',{name:label,exact:true}).click();
    }
    // Player-facing screenshots omit the existing administrator-only settings.
    // Browser fixture state only: no authentication request or account/role change.
    await page.evaluate(()=>{
      const d=window.ng.probe(document.querySelector('app-league-standings'));
      d.injector.get(window.ng.coreTokens.NgZone).run(()=>{d.componentInstance.userRole='Player';});
    });
    const outerGroup=()=>page.locator('app-league-standings .standings-card > mat-tab-group');
    const outerPane=()=>outerGroup().locator('> .mat-tab-body-wrapper > mat-tab-body.mat-tab-body-active > .mat-tab-body-content');
    const activePane=()=>outerPane().locator('> mat-tab-group > .mat-tab-body-wrapper > mat-tab-body.mat-tab-body-active > .mat-tab-body-content');
    const mobile=()=>activePane().locator('.mobile-standings');
    const compact=()=>activePane().locator('.mobile-rankings');
    const full=()=>activePane().locator('.standings-full-table table.compact-table');
    async function parity(){
      const result=await compact().evaluate(table=>{
        const original=table.closest('.mat-tab-body-content').querySelector('table.compact-table');
        const text=e=>e.textContent.trim().replace(/\s+/g,' ');
        return {mobile:Array.from(table.querySelectorAll('.mobile-player-row')).map(r=>Array.from(r.children).map(text).map((s,i)=>i===1?s.replace(/[\u25b4\u25be]/g,'').trim():s)),
          original:Array.from(original.tBodies[0].rows).map(r=>Array.from(r.children).slice(0,4).map(text))};
      });
      assert.deepEqual(result.mobile,result.original,'Every compact cell must equal its original table cell');
    }
    async function verifyScoreAssociations(mode){
      const result=await full().evaluate(table=>({headers:Array.from(table.querySelectorAll('thead th')).map(e=>e.textContent.trim().replace(/\s+/g,'')),
        rows:Array.from(table.tBodies[0].rows).map(r=>Array.from(r.children).map(e=>e.textContent.trim()))}));
      const start=mode==='round'?5:4;
      assert.deepEqual(result.headers.slice(start),Array.from({length:11},(_,i)=>(mode==='round'?'Round':'Matchup')+(i+1)));
      for(const row of result.rows){
        const player=fixture.playerScores.find(p=>p.playerName===row[1]);
        let subs=0;
        const expected=player.scores.map(s=>{
          let value=s.score+(mode==='matchup'?2:0);
          if(s.isSubScore&&subs++>=1)value=value*.5;
          return String(value);
        });
        assert.deepEqual(row.slice(start),expected,'Displayed chronological columns must retain the API position-to-score association');
      }
    }
    async function division(label){
      const outer=outerGroup();
      const tab=outer.locator('> mat-tab-header').getByRole('tab',{name:label,exact:true});
      await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');await page.waitForTimeout(550);
    }
    async function gender(label){
      const tab=outerPane().locator('> mat-tab-group > mat-tab-header').getByRole('tab',{name:label,exact:true});
      await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');await page.waitForTimeout(550);
    }
    const spacing=[];
    for(const [width,height] of [[375,667],[390,844]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(350);await expect(compact()).toBeVisible();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Basic standings must not cause horizontal page scrolling');
      await expect(compact().locator('thead th')).toHaveText(['Place','Player Name','King Queen Score','Total Points']);
      await parity();
      await verifyScoreAssociations('round');
      const row=compact().locator('.mobile-player-row').first();
      await row.getByRole('button').click();await expect(row.getByRole('button')).toHaveAttribute('aria-expanded','true');
      const details=compact().locator('.mobile-player-details:visible');await expect(details).toHaveCount(1);
      await expect(details).not.toContainText('Total Wins:');await expect(details).toContainText('Division: Gold');
      await expect(details.locator('.mobile-round-scores li')).toHaveCount(11);
      await expect(details.locator('.mobile-round-scores li > span:first-child')).toHaveText(Array.from({length:11},(_,i)=>'Round '+(i+1)));
      const parityResult=await details.evaluate(tr=>{
        const original=tr.closest('.mat-tab-body-content').querySelector('table.compact-table');
        const cells=Array.from(original.tBodies[0].rows[0].children).slice(5);
        const entries=Array.from(tr.querySelectorAll('.mobile-round-scores li'));
        return entries.map((e,i)=>({score:e.querySelector('strong').textContent.trim(),original:cells[i].textContent.trim(),
          color:getComputedStyle(e).color,originalColor:getComputedStyle(cells[i]).color,
          background:getComputedStyle(e).backgroundColor,originalBackground:getComputedStyle(cells[i]).backgroundColor}));
      });
      for(const item of parityResult){assert.equal(item.score,item.original);assert.equal(item.color,item.originalColor,JSON.stringify(parityResult));
        if(item.originalBackground==='rgb(216, 191, 216)')assert.equal(item.background,item.originalBackground);}
      await expect(details.getByText('Dropped',{exact:true})).toBeVisible();
      await expect(details.getByText('Reduced',{exact:true})).toBeVisible();
      const colors=await row.evaluate(r=>[getComputedStyle(r.children[0]).backgroundColor,getComputedStyle(r.children[2]).backgroundColor]);
      assert.deepEqual(colors,['rgb(173, 216, 230)','rgb(144, 238, 144)']);
      const centers=await details.locator('.mobile-round-scores li > strong').evaluateAll(nodes=>nodes.map(e=>{
        const r=e.getBoundingClientRect(),row=e.parentElement.getBoundingClientRect();return {center:r.left+r.width/2,rowCenter:row.left+row.width/2,align:getComputedStyle(e).textAlign};
      }));
      assert(centers.every(c=>Math.abs(c.center-c.rowCenter)<1&&c.align==='center'),'Scores must occupy the centered middle column of each row');
      const tableMetrics=await compact().evaluate(t=>({tableTop:t.getBoundingClientRect().top,tableWidth:t.getBoundingClientRect().width}));
      const gains={width,before:before.spacing[width],after:tableMetrics,pixelsHigher:before.spacing[width].tableTop-tableMetrics.tableTop};
      assert(gains.pixelsHigher>=40,'Compact table must be measurably higher');assert(tableMetrics.tableWidth>before.spacing[width].tableWidth);
      spacing.push(gains);
      const targets=await mobile().locator('button,mat-form-field').evaluateAll(nodes=>nodes.map(e=>({text:e.textContent.trim(),height:e.getBoundingClientRect().height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth})));
      // A one-pixel scroll/client difference can be integer rounding on fractional grid tracks.
      assert(targets.every(t=>t.height>=44&&t.scrollWidth<=t.clientWidth+1),'Mobile controls must retain 44px targets and untruncated content: '+JSON.stringify(targets));
      await page.screenshot({path:path.join(out,`mobile-${width}x${height}-expanded.png`),fullPage:true});
      await row.getByRole('button').press('Enter');await expect(row.getByRole('button')).toHaveAttribute('aria-expanded','false');
      await row.locator('td').last().click();await expect(row.getByRole('button')).toHaveAttribute('aria-expanded','true');
      await row.getByRole('button').click();
      await page.screenshot({path:path.join(out,`mobile-${width}x${height}-compact.png`),fullPage:true});
      checks.push(`Mobile ${width}x${height}: no page overflow, four columns, original values/colors, tap/keyboard expansion and indicators`);
    }
    fs.writeFileSync(path.join(out,'spacing-comparison.json'),JSON.stringify(spacing,null,2));
    const unassigned=compact().locator('.mobile-player-row').filter({hasText:'Jamie No Division'});
    await unassigned.getByRole('button').click();
    const unassignedDetails=compact().locator('.mobile-player-details:visible');
    await expect(unassignedDetails).not.toContainText(/Division|Unassigned|Total Wins/);
    for(const variant of [{id:null,code:null},{id:0},{id:12,code:' '}]){
      await page.evaluate(v=>{const d=window.ng.probe(document.querySelector('app-league-standings'));d.injector.get(window.ng.coreTokens.NgZone).run(()=>{
        const p=d.componentInstance.maleStandings.find(p=>p.playerId===-107);p.leagueDivisionId=v.id;p.leagueDivisionCode=v.code;
      });},variant);
      await expect(unassignedDetails.locator('.mobile-player-summary')).toHaveCount(0);
    }
    await unassigned.getByRole('button').click();checks.push('Unassigned, null, missing and blank divisions omit the entire Division label/value; mobile Total Wins absent');
    for(const [label,key] of [['Player Name','playerName'],['King Queen Score','totalScore'],['Total Points','totalScoreBeforeReduction'],['Total Wins','totalWins']]){
      await mobile().locator('mat-select').click();await page.getByRole('option',{name:label,exact:true}).click();
      await parity();
      const state=await page.evaluate(key=>{const c=window.ng.probe(document.querySelector('app-league-standings')).componentInstance;
        return {column:c.sortColumn,direction:c.sortDirection,values:c.maleStandings.map(p=>p[key])};},key);
      assert.equal(state.column,key);assert.equal(state.direction,key==='playerName'?'asc':'desc');
      const sorted=[...state.values].sort((a,b)=>key==='playerName'?a.toLowerCase().localeCompare(b.toLowerCase()):b-a);
      assert.deepEqual(state.values,sorted);
      await mobile().getByRole('button',{name:/Sort direction/}).click();await parity();
    }
    checks.push('All four mobile sort keys and direction toggle match original tables');
    await gender("Women's Standings");await expect(compact()).toContainText('Dana Lake');await parity();
    await division('Gold');await expect(compact().locator('.mobile-player-row')).toHaveCount(1);await parity();
    await gender("Women's Standings");await expect(compact()).toContainText('Dana Lake');await parity();
    await division('Silver');await expect(compact()).toContainText('Blake Long-Player-Name');await parity();
    await division('Bronze');await expect(compact()).toContainText('Casey Shore');await parity();
    checks.push('Overall, Gold, Silver, configured Bronze and both gender tabs use correct filtered arrays');
    await division('Overall');
    await page.getByRole('button',{name:'Show Standings by Matchup',exact:true}).click();
    await expect(page.getByRole('button',{name:'Show Standings by Round',exact:true})).toBeVisible();await parity();
    await verifyScoreAssociations('matchup');
    await compact().locator('.mobile-player-row').first().getByRole('button').click();
    await expect(compact().locator('.mobile-player-details:visible .mobile-round-scores li > span:first-child')).toHaveText(Array.from({length:11},(_,i)=>'Matchup '+(i+1)));
    await page.screenshot({path:path.join(out,'mobile-matchup.png'),fullPage:true});
    await page.setViewportSize({width:1920,height:1080});
    await expect(full().locator('thead th').nth(4)).toHaveText('Matchup1');
    await expect(full().locator('thead th').last()).toHaveText('Matchup11');
    await page.screenshot({path:path.join(out,'desktop-1920x1080-matchup-ascending.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(550);
    await page.getByRole('button',{name:'Show Standings by Round',exact:true}).click();await parity();
    checks.push('Round/Matchup 1–11 chronology, including repeated raw round IDs across scrambles; values and flags preserved');
    await mobile().getByRole('button',{name:'View Full Table',exact:true}).click();
    await expect(full()).toBeVisible();
    const scroll=await activePane().locator('.standings-full-table.mobile-full-table-open').evaluate(el=>{
      const name=el.querySelector('tbody td:nth-child(2)');el.scrollLeft=150;const before=name.getBoundingClientRect().x;
      el.scrollLeft=300;return {overflow:el.scrollWidth>el.clientWidth,sticky:getComputedStyle(name).position,
        fixed:Math.abs(name.getBoundingClientRect().x-before)<1,pageOverflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.deepEqual(scroll,{overflow:true,sticky:'sticky',fixed:true,pageOverflow:false});
    await page.screenshot({path:path.join(out,'mobile-full-table.png'),fullPage:true});
    await mobile().getByRole('button',{name:'View Compact Table',exact:true}).click();await expect(compact()).toBeVisible();
    checks.push('Full-table opt-in scrolls within its own region, retains sticky player names and returns to compact mode');
    // Resizing back to desktop must show the original table even if mobile full-table state was previously used.
    await page.setViewportSize({width:1366,height:768});await expect(mobile()).toBeHidden();await expect(full()).toBeVisible();
    checks.push('Returning to desktop restores only the existing full-table presentation');
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,baseline?'baseline-provenance.json':'results.json'),JSON.stringify({mode:'browser-only synthetic display fixture',databaseAccess:false,
    baseline,apiReads,writes,pageErrors:errors,desktopVerified:Object.keys(desktop),checks,fixtureSha256:crypto.createHash('sha256').update(JSON.stringify(fixture)).digest('hex')},null,2));
  if(!baseline&&!captureSpacing)console.log(`${checks.length} focused presentation checks passed; no database or API writes.`);
  await browser.close();
})().catch(async error=>{
  console.error(error.stack);
  fs.writeFileSync(path.join(out,'last-failure.txt'),error.stack);
  if(activeBrowser){
    const page=activeBrowser.contexts()[0]?.pages()[0];
    if(page)await page.screenshot({path:path.join(out,'last-failure.png'),fullPage:true}).catch(()=>{});
    await activeBrowser.close();
  }
  process.exitCode=1;
});

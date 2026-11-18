// UI workflow + print verification. All API traffic intercepted; no real writes or SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const mode=process.argv[2]||'final',out=path.resolve(__dirname,mode==='corrections'?'../scrambler-corrections-evidence':mode.startsWith('polish')?'../scrambler-polish-evidence':'../scrambler-workspace-evidence');fs.mkdirSync(out,{recursive:true});let browser;
const players=Array.from({length:24},(_,i)=>({id:1001+i,firstName:'Synthetic',lastName:'Player'+String(i+1).padStart(2,'0'),isMale:i%2===0,gender:i%2===0?'Male':'Female',isSub:false,isTopPlayer:false,isLowPlayer:false,isByePlayer:false}));
const teams=()=>Array.from({length:12},(_,i)=>({players:players.slice(i*2,i*2+2).map(p=>({...p})),maleCount:1,femaleCount:1,sortingId:i+1,kingQueenTeamId:201+i,scrambleNumber:12,kingQueenRoundScores:[]}));
const hash=content=>crypto.createHash('sha256').update(content).digest('hex');
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1920,height:1080}});const errors=[],writes=[],checks=[];let failNextSave=false;
 await context.route('**/*',async route=>{
  let u;try{u=assertLocalUrl(route.request().url());}catch{
   const asset=new URL(route.request().url());
   if(['polish','corrections','visibility','fetch'].includes(mode)&&route.request().method()==='GET'&&['fonts.googleapis.com','fonts.gstatic.com','use.fontawesome.com'].includes(asset.hostname)&&['font','stylesheet'].includes(route.request().resourceType())){await route.continue();return;}
   await route.abort();return;
  }
  const p=u.pathname.toLowerCase();let body=[];
  if(p.startsWith('/sockjs-node/')){await route.abort();return;}
  if(route.request().method()!=='GET'){
   const data=route.request().postDataJSON();writes.push({path:p,mode:'intercepted fixture only'});
   if(p.includes('/generatescramble/'))body=(data.kingQueenTeams||[]).map((t,i)=>({id:201+i,scrambleNumber:12}));
   else if(p.includes('/savekingqueenteams/')){if(failNextSave){failNextSave=false;await route.fulfill({status:500,body:'Fixture save failure'});return;}body={kingQueenTeams:teams().map(t=>({kingQueenTeam:{id:t.kingQueenTeamId,scrambleNumber:12},players:t.players})),byePlayers:[]};}
   else if(p.includes('/savekingqueenroundscores/'))body={};
   else{await route.abort();return;}
  }else if(!p.startsWith('/api/')){await route.continue();return;}
  else if(p==='/api/login/isauthenticated')body=true;
  else if(p==='/api/login/getusersrole')body={role:'Admin'};
  else if(p==='/api/login/getusersplayer')body={playerId:1001};
  else if(p==='/api/login/isadminpasswordauthorized')body=false;
  else if(p==='/api/login/getuserleagues'||p==='/api/scrambledata/getleagues')body=[{id:101,leagueName:'Synthetic League'}];
  else if(u.searchParams.has('settingName'))body={settingValue:{dropLowest:'0',numberOfSubsAllowed:'100',subScorePercent:'100',standingsType:'round',dayOfLeague:'Monday'}[u.searchParams.get('settingName')]};
  else if(p.includes('/getbyleague'))body={maxRounds:2,playerScores:players.map(x=>({playerId:x.id,playerName:x.firstName+' '+x.lastName,isMale:x.isMale,scores:[{roundId:1,score:21,roundWon:true,isSubScore:false},{roundId:2,score:15,roundWon:false,isSubScore:false}]}))};
  else if(p.includes('/selectedleaguescrambles/'))body=[{id:201,scrambleNumber:12,dateOfTeam:'2026-11-01T18:00:00'}];
  else if(p.includes('/getkingqueenteamsbyscramblenumber/'))body={kingQueenTeams:teams().map(t=>({kingQueenTeam:{id:t.kingQueenTeamId,scrambleNumber:12,kingQueenPlayers:t.players.map(x=>({playerId:x.id,isSubScore:false})),kingQueenRoundScores:[{id:300+t.sortingId,kingQueenTeamId:t.kingQueenTeamId,roundId:1,roundScore:21,roundWon:true}]},players:t.players})),byePlayers:[]};
  else if(p.includes('getsignedinplayersasplayers'))body=players;
  else if(p.includes('getsignedinplayers'))body=players.map(x=>({playerId:x.id,firstName:x.firstName,lastName:x.lastName,isMale:x.isMale}));
  else if(p.includes('allmale'))body=players.filter(x=>x.isMale);
  else if(p.includes('allfemale'))body=players.filter(x=>!x.isMale);
  else if(p.includes('getplayers')||p.includes('selectleague')||p.includes('getallplayers'))body=players;
  else if(p.includes('topplayer'))body=players.slice(0,2);
  else if(p.includes('numberofbrackets'))body=4;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE_URL+'/scrambler');await expect(page.locator('app-scrambler-component')).toBeVisible();
 await page.waitForFunction(()=>{const c=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;return c.selectedLeague==='Synthetic League'&&c.malePlayers1.length===12;});await page.waitForTimeout(550);
 async function evaluate(fn,arg){return page.evaluate(({fn,arg})=>{const d=window.ng.probe(document.querySelector('app-scrambler-component'));return d.injector.get(window.ng.coreTokens.NgZone).run(()=>eval('('+fn+')')(d.componentInstance,arg));},{fn:fn.toString(),arg});}
 async function seed(results=true){await evaluate((c,arg)=>{c.selectedList=arg.useRoster?c.malePlayers1.concat(c.femalePlayers1):arg.players;c.teamSize=2;c.numberOfTeams=null;c.teamCount=12;c.isActionAllowed=true;c.selectedRounds=5;c.selectedMatchupsPerPage='2';c.rounds=[1,2,3,4,5];c.listOfTeams=arg.results?arg.teams:[];c.scrambleNumber=arg.results?12:null;c.__workspaceToken='retained';},{players,teams:teams(),results,useRoster:mode==='corrections'});await page.waitForTimeout(100);}
 async function shot(name){await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 async function printOutputs(label){const result={};await seed();await evaluate(c=>c.rememberSavedTeams()); // Explicitly model saved fixture teams, never infer from generated IDs.
  for(const count of ['2','4','6']){
   const html=await evaluate((c,count)=>{c.selectedMatchupsPerPage=count;let html='';const original=window.open;window.open=()=>({document:{open(){},write(value){html=value;},close(){}},set onload(fn){},print(){},close(){}});try{c.printMatchups();}finally{window.open=original;}return html;},count);
   const render=await context.newPage();await render.setViewportSize({width:800,height:1000});await render.emulateMedia({media:'print'});await render.setContent(html);
   await render.screenshot({path:path.join(out,`print-${count}-${label}.png`),fullPage:true});const pdf=await render.pdf({path:path.join(out,`print-${count}-${label}.pdf`),format:'A4',preferCSSPageSize:true,printBackground:true});
   result[count]={htmlHash:hash(html.replace(/ _ngcontent[^=\s]*=""/g,'')),pixels:hash(fs.readFileSync(path.join(out,`print-${count}-${label}.png`))),pages:(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length};await render.close();
  }return result;
 }
 if(mode==='fetch'){
  await seed(false);await evaluate(c=>{c.calculateTeamsNeeded();c.hasSignedInPlayersAvailable=true;c.fetchClicked=false;});
  const fetch=page.getByRole('button',{name:'Fetch Signed In Players',exact:true});await expect(fetch).toBeEnabled();await expect.poll(()=>fetch.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(152, 208, 167)');
  await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>document.fonts.ready);
  await page.locator('.scramble-setup').screenshot({path:path.join(out,'fetch-configuration-1366.png')});
  const previous=fs.readFileSync(path.resolve(__dirname,'../scrambler-polish-evidence/after-configuration-1366.png'));
  const unchanged=hash(previous)===hash(fs.readFileSync(path.join(out,'fetch-configuration-1366.png')));console.log('Team Configuration pixels match pre-last-build screenshot: '+unchanged);
  await evaluate(c=>{c.hasSignedInPlayersAvailable=false;});await expect(fetch).toBeDisabled();await expect.poll(()=>fetch.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgb(152, 208, 167)');
  checks.push('Available signed-in players: enabled Fetch uses original light green; unavailable: disabled neutral state; configuration comparison='+unchanged);
 }else if(mode==='visibility'){
  await expect(page.getByRole('button',{name:'Hide Player List',exact:true})).toBeHidden();
  await seed();
  for(const width of [1366,390,375]){
   await page.setViewportSize({width,height:844});
   const fetch=page.locator('.selection-actions button');assert.equal(await fetch.count(),1);assert(await fetch.evaluate(e=>e.getBoundingClientRect().width>=e.parentElement.clientWidth-40));
   const before=await evaluate(c=>JSON.stringify({selected:c.selectedList.map(p=>p.id),teams:c.listOfTeams,rounds:c.selectedRounds,print:c.selectedMatchupsPerPage}));
   await page.getByRole('button',{name:'Hide Player List',exact:true}).click();await expect(page.locator('#playerListHidden')).toBeHidden();
   await page.locator('.results-visibility-controls').screenshot({path:path.join(out,'roster-toggle-'+width+'.png')});
   await page.getByRole('button',{name:'Show Player List',exact:true}).click();await expect(page.locator('#playerListHidden')).toBeVisible();
   assert.equal(await evaluate(c=>JSON.stringify({selected:c.selectedList.map(p=>p.id),teams:c.listOfTeams,rounds:c.selectedRounds,print:c.selectedMatchupsPerPage})),before);
   await page.locator('.selection-actions').screenshot({path:path.join(out,'full-width-fetch-'+width+'.png')});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.getByRole('button',{name:'Hide Player List',exact:true}).click();await evaluate(c=>c.reset());await expect(page.getByRole('button',{name:'Show Player List',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Show Player List',exact:true}).click();await expect(page.locator('#playerListHidden')).toBeVisible();
  checks.push('Hide toggle appears only with results; full-width Fetch; desktop/mobile hide-show preserves selections/teams/print state; reset retains a recovery toggle; no overflow');
 }else if(mode==='buttons'){
  assert.equal(await page.getByRole('button',{name:'Reset Players',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),await page.getByRole('button',{name:'Deselect All',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor));
  await seed();const print=page.getByRole('button',{name:'Print Matchups',exact:true});await expect(print).toBeDisabled();
  assert.notEqual(await print.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(152, 208, 167)');
  await page.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(print).toBeEnabled();await expect.poll(()=>print.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(152, 208, 167)');
  const savedNotice=page.locator('snack-bar-container').getByRole('button',{name:'Close',exact:true});if(await savedNotice.isVisible())await savedNotice.click();await expect(page.locator('snack-bar-container')).toHaveCount(0);
  await page.getByRole('tab',{name:'Retrieve Scramble',exact:true}).click();
  for(const width of [375,390]){
   await page.setViewportSize({width,height:844});const b=page.locator('.no-duplicate-action');await b.scrollIntoViewIfNeeded();
   const box=await b.boundingBox();assert(box.width>=230&&box.height<=90,'Mobile button uses available width without a tall text stack');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await b.screenshot({path:path.join(out,'no-duplicate-mobile-'+width+'.png')});
  }
  checks.push('Enabled Print uses original light green; unsaved Print remains disabled/gray; no-duplicate button fits 375/390 without overflow or tall text stacking');
 }else if(mode==='corrections'){
  await page.getByRole('button',{name:'Select All',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),24);
  await page.getByRole('button',{name:'Deselect All',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),0);await expect(page.locator('.primary-action')).toBeDisabled();
  await seed();const print=page.getByRole('button',{name:'Print Matchups',exact:true});await expect(print).toBeDisabled();
  let opened=0;await page.exposeFunction('recordPrintAttempt',()=>opened++);
  await page.evaluate(()=>{window.open=()=>{window.recordPrintAttempt();return null;};});await evaluate(c=>c.printMatchups());assert.equal(opened,0);
  failNextSave=true;await page.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(page.locator('snack-bar-container').filter({hasText:'Error saving'})).toBeVisible();await expect(print).toBeDisabled();
  await page.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(print).toBeEnabled();
  await page.getByRole('button',{name:'Modify Teams',exact:true}).click();await page.locator('.generated-matchups select').first().selectOption('2');await expect(print).toBeDisabled();
  await page.getByRole('button',{name:'Cancel Changes',exact:true}).click();await expect(print).toBeEnabled();
  await page.locator('.scramble-results-toolbar').screenshot({path:path.join(out,'results-saved-1920.png')});
  checks.push('Unsaved and failed-save print blocked in UI and method; successful Save enables; staged edits disable and Cancel restores');
  await page.getByRole('tab',{name:'Retrieve Scramble',exact:true}).click();await page.locator('button[mattooltip="Retrieve Scramble"]').first().click();await expect(print).toBeEnabled();await page.getByRole('tab',{name:'Select Players',exact:true}).click();
  checks.push('Saved scramble retrieval restores print eligibility');
  await evaluate(c=>{c.addPlayerToTopPlayerList(c.malePlayers1[0]);c.addPlayerToByeList(c.malePlayers1[0]);c.addPlayerToLowPlayerList(c.femalePlayers1[0]);c.swapGender(c.malePlayers1[0]);});
  const closeNotice=page.locator('snack-bar-container').getByRole('button',{name:'Close',exact:true});if(await closeNotice.last().isVisible())await closeNotice.last().click();await expect(page.locator('snack-bar-container')).toHaveCount(0);
  for(const [width,height] of [[1920,1080],[1366,768],[390,844],[375,667]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
   const selection=page.locator('.selection-actions');await selection.screenshot({path:path.join(out,'selection-'+width+'.png')});
   await page.locator('.scramble-results-toolbar').screenshot({path:path.join(out,'results-'+width+'.png')});
   const layout=await selection.evaluate(e=>{const b=Array.from(e.querySelectorAll('button')).map(n=>n.getBoundingClientRect()),count=e.querySelector('.selection-summary').getBoundingClientRect();return {singleFullWidthFetch:b.length===1&&b[0].width>=e.clientWidth-40,countBelow:count.top>=Math.max(...b.map(r=>r.bottom))};});assert(Object.values(layout).every(Boolean));
   assert.equal(await page.locator('.primary-action').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(152, 208, 167)');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const rows=await page.locator('.scramble-results-toolbar').evaluate(e=>['.results-edit-controls','.results-print-action','.results-print-controls','.results-visibility-controls'].map(s=>{const r=e.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));assert(rows.slice(1).every((r,i)=>r.top>=rows[i].bottom),'Results follow the four requested rows');
   if(width<800){const row=page.locator('.league-roster mat-list-option').filter({hasText:'Player01'});await expect(row.locator('.status-top')).toBeVisible();await expect(row.locator('.status-bye')).toBeVisible();await expect(row.locator('.status-swapped')).toBeVisible();await expect(page.locator('.league-roster .status-low')).toBeVisible();await row.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'mobile-player-indicators-'+width+'.png')});await row.screenshot({path:path.join(out,'mobile-top-bye-swapped-'+width+'.png')});await page.locator('.league-roster mat-list-option').filter({hasText:'Player02'}).screenshot({path:path.join(out,'mobile-low-'+width+'.png')});}
  }
  checks.push('Select All/Deselect All; four sizes: full-width Fetch button, counts below, green primary action, ordered results rows, no overflow; mobile Top/Low/Bye/Gender-swapped badges');
  const originalGender=await evaluate(c=>c.malePlayers1[0].isMale);await evaluate(c=>c.swapGender(c.malePlayers1[0]));assert.equal(await evaluate(c=>c.isPlayerGenderSwapped(c.malePlayers1[0])),false);assert.notEqual(await evaluate(c=>c.malePlayers1[0].isMale),originalGender);
  await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'Reset Players',exact:true}).click();
  const beforeReset=await evaluate(c=>JSON.stringify({selected:c.selectedList.map(p=>p.id),teams:c.listOfTeams.map(t=>t.players.map(p=>p.id))}));let confirmation='';page.once('dialog',async d=>{confirmation=d.message();await d.dismiss();});await page.getByRole('menuitem',{name:'Reset All Players',exact:true}).click();assert(confirmation.includes('Checked roster players will stay selected'));
  assert.equal(await evaluate(c=>JSON.stringify({selected:c.selectedList.map(p=>p.id),teams:c.listOfTeams.map(t=>t.players.map(p=>p.id))})),beforeReset);
  await page.getByRole('button',{name:'Reset Players',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('menuitem',{name:'Reset All Players',exact:true}).click();assert.equal(await evaluate(c=>c.listOfTeams.length),0);assert.equal(await evaluate(c=>c.selectedList.length),24);assert.equal(await evaluate(c=>c.displayTopPlayers.length+c.displayLowPlayers.length+c.byePlayers.length),0);
  checks.push('Reset confirmation cancel preserves state; confirm retains original semantics: clears teams/preferences, retains roster checks; double gender toggle removes badge');
 }else if(mode.startsWith('polish')){
  const label=mode==='polish-before'?'before':'after',metrics=[];
  for(const [width,height] of [[1920,1080],[1366,768],[390,844],[375,667]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(300);
   await evaluate(c=>{c.selectedList=[];c.listOfTeams=[];c.teamCount=null;});await shot(label+'-setup-'+width);
   await expect(page.locator('.primary-action')).toBeDisabled();
   await seed(false);await evaluate(c=>c.calculateTeamsNeeded());await page.evaluate(()=>document.fonts.ready);await shot(label+'-selected-'+width);
   await page.locator('.scramble-setup').screenshot({path:path.join(out,label+'-configuration-'+width+'.png')});
   if(width<800){
    await page.locator('.selection-actions').screenshot({path:path.join(out,label+'-selection-controls-'+width+'.png')});
    await page.locator('.league-roster mat-list-option').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,label+'-roster-'+width+'.png')});
   }
   await expect(page.locator('.primary-action')).toBeEnabled();
   await page.locator('.primary-action').screenshot({path:path.join(out,label+'-primary-'+width+'.png')});
   await seed();await page.locator('.scramble-results-toolbar').screenshot({path:path.join(out,label+'-results-'+width+'.png')});
   if(width>=992)await page.locator('app-nav-menu').screenshot({path:path.join(out,label+'-navigation-'+width+'.png')});
   const m=await page.evaluate(()=>{const b=document.querySelector('.primary-action').getBoundingClientRect(),c=document.querySelector('.scramble-setup').getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,buttonWidth:b.width,buttonHeight:b.height,configurationWidth:c.width,configurationHeight:c.height};});metrics.push(m);
   if(mode==='polish'){
    if(m.overflow)console.log(await page.locator('.selection-actions').evaluate(e=>({grid:getComputedStyle(e).gridTemplateColumns,children:Array.from(e.children).map(n=>({tag:n.tagName,column:getComputedStyle(n).gridColumn,width:n.getBoundingClientRect().width,style:n.getAttribute('style')}))})));
    assert.equal(m.overflow,false,'Overflow at '+width);assert(m.buttonHeight>=60);assert(m.buttonWidth>=(width>800?350:width-80));assert(m.buttonWidth<=500||width<800);
    if(width>800)assert(m.configurationWidth<=1080);
    if(width>=992){const rows=await page.locator('#navbarNav > ul > li').evaluateAll(ns=>ns.filter(n=>n.getBoundingClientRect().height).map(n=>Math.round(n.getBoundingClientRect().top)));assert.equal(new Set(rows).size,1,'Main desktop links share an intentional row');}
    const roster=await page.locator('.league-roster mat-list-option').evaluateAll(ns=>ns.slice(0,5).map(n=>n.getBoundingClientRect().y));if(width>800)assert(roster.slice(0,4).every(y=>Math.abs(y-roster[0])<1)&&roster[4]>roster[0]);
   }
  }
  fs.writeFileSync(path.join(out,label+'-metrics.json'),JSON.stringify(metrics,null,2));checks.push('Four viewport visual captures; primary action enabled/disabled states'+(mode==='polish'?', large button, bounded configuration, four-column roster and no overflow':''));
 }else if(mode==='before'){
  await shot('before-empty');await seed(false);await shot('before-configured');await seed();await shot('before-generated');
  fs.writeFileSync(path.join(out,'print-baseline.json'),JSON.stringify(await printOutputs('before'),null,2));
  console.log('Before-layout and actual print-function HTML/rendered PDF baselines captured.');
 }else if(mode==='stage1'){
  await seed();const prior=await evaluate(c=>JSON.stringify({players:c.selectedList,teams:c.listOfTeams,size:c.teamSize,rounds:c.selectedRounds,print:c.selectedMatchupsPerPage}));
  await page.locator('app-nav-menu').getByRole('link',{name:'League Management',exact:true}).click();await expect(page.locator('.league-management-page')).toBeVisible();
  assert.equal(await evaluate(c=>c.__workspaceToken),'retained');assert.equal(await evaluate(c=>JSON.stringify({players:c.selectedList,teams:c.listOfTeams,size:c.teamSize,rounds:c.selectedRounds,print:c.selectedMatchupsPerPage})),prior);
  await shot('league-management');await page.locator('app-nav-menu').getByRole('link',{name:'Scrambler',exact:true}).click();assert.equal(await evaluate(c=>c.__workspaceToken),'retained');
  await expect(page.locator('app-scrambler-component').getByRole('tab',{name:'Standings',exact:true})).toHaveCount(0);checks.push('Management route and return preserve the same live Scrambler state; duplicate standings tab removed');
 }else if(mode==='setup'){
  await expect(page.locator('.scramble-empty-state')).toBeVisible();await expect(page.locator('.scrambler-results-shell')).toBeHidden();
  await expect(page.locator('.primary-action')).toBeDisabled();
  await shot('after-empty');await page.getByRole('button',{name:'Select All',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),24);
  const roster=await page.locator('.league-roster mat-list-option').evaluateAll(nodes=>nodes.slice(0,5).map(e=>({y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width})));
  assert(roster.slice(0,4).every(r=>Math.abs(r.y-roster[0].y)<1)&&roster[4].y>roster[0].y,'Desktop roster remains four columns');
  await page.locator('.scramble-setup mat-select').nth(0).click();await page.getByRole('option',{name:'2',exact:true}).click();assert.equal(await evaluate(c=>c.numberOfTeams),null);
  await page.locator('.scramble-setup mat-select').nth(1).click();await page.getByRole('option',{name:'6',exact:true}).click();assert.equal(await evaluate(c=>c.teamSize),null);
  await page.getByRole('tab',{name:'Retrieve Scramble',exact:true}).click();await page.getByRole('tab',{name:'Select Players',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),24);
  await shot('after-configured');await page.getByRole('button',{name:'Deselect All',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),0);
  await expect(page.locator('.primary-action')).toBeDisabled();checks.push('Setup: select/deselect, four-column roster, size/count exclusivity, tab state, disabled empty scramble and compact empty results');
 }else if(mode==='followup'){
  await seed();
  await page.locator('.results-rounds mat-select').click();await page.getByRole('option',{name:'3 Rounds',exact:true}).click();assert.equal(await evaluate(c=>c.selectedRounds),3);
  await page.locator('.results-print-controls mat-select').click();await page.getByRole('option',{name:'4 Matchups',exact:true}).click();assert.equal(await evaluate(c=>String(c.selectedMatchupsPerPage)),'4');
  checks.push('Existing Number of Rounds and Matchups Per Page selectors update their original state');
  await page.getByRole('button',{name:'Hide Setup',exact:true}).click();await expect(page.locator('.scramble-setup')).toBeHidden();
  await page.getByRole('button',{name:'Show Setup',exact:true}).click();await expect(page.locator('.scramble-setup')).toBeVisible();assert.equal(await evaluate(c=>c.selectedList.length),24);
  await page.getByRole('tab',{name:'Retrieve Scramble',exact:true}).click();await page.locator('button[mattooltip="Retrieve Scramble"]').first().click();
  await page.waitForFunction(()=>window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.retrievedListOfTeams.length===12);
  assert.deepEqual(await evaluate(c=>c.listOfRetrievedScrambleNumbers),[12]);assert.equal(await evaluate(c=>c.listOfTeams[0].kingQueenRoundScores[0].roundScore),21);
  await expect(page.locator('.results-heading')).toContainText('Retrieved Scramble: 12');
  await page.locator('.scrambler-results-shell').screenshot({path:path.join(out,'results-controls-and-matchups.png')});
  await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();await expect(page.getByRole('tab',{name:'Manage Scores',exact:true})).toHaveAttribute('aria-selected','true');
  checks.push('Hide/Show Setup retains selection; saved scramble retrieval restores teams, score and scramble number; Manage Scores remains available');
  await page.goto(BASE_URL+'/league-management');await expect(page.locator('.league-management-page')).toBeVisible();
  await evaluate(c=>{c.isActionAllowed=false;});await expect(page.getByRole('textbox',{name:'Administration Password',exact:true})).toBeVisible();
  await shot('league-management-unlock');assert.equal(writes.length,0,JSON.stringify(writes));
  checks.push('Direct League Management route works and preserves the existing locked administration form without password use or API writes');
 }else{
  await seed();await expect(page.locator('.scramble-results-toolbar')).toBeVisible();
  await shot('after-generated');
  const assignments=await evaluate(c=>JSON.stringify(c.listOfTeams.map(t=>t.players.map(p=>p.id))));
  const court=page.locator('.generated-matchups .col-1 input').first();await court.fill('7');
  await page.getByRole('button',{name:'Hide Results',exact:true}).click();await expect(page.locator('.generated-matchups')).toBeHidden();
  await page.getByRole('button',{name:'Show Results',exact:true}).click();await expect(court).toHaveValue('7');
  await page.getByRole('button',{name:'Modify Teams',exact:true}).click();await expect(page.locator('.editing-state')).toContainText('Editing Teams');
  await page.locator('.generated-matchups select').first().selectOption('2');assert.equal(await evaluate(c=>c.teamEditsPending),true);
  await shot('after-editing');await page.getByRole('button',{name:'Finish Editing',exact:true}).click();assert.equal(await evaluate(c=>c.teamEditsPending),true);
  await page.getByRole('button',{name:'Cancel Changes',exact:true}).click();assert.equal(await evaluate(c=>JSON.stringify(c.listOfTeams.map(t=>t.players.map(p=>p.id)))),assignments);
  checks.push('Results controls precede cards; hide/show preserves court input; team move is staged, hiding retains draft and Cancel restores assignments');
  await page.getByRole('button',{name:'Modify Teams',exact:true}).click();await page.locator('.generated-matchups select').first().selectOption('2');
  await page.getByRole('button',{name:'Save Changes / Teams',exact:true}).click();await page.waitForFunction(()=>!window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.canCancelTeamEditing);
  assert(writes.some(w=>w.path.includes('/savekingqueenteams/')));checks.push('Modified new-team assignments pass through the existing explicit Save Teams request (mocked transport)');
  // Exercise the existing algorithm rather than replacing it with fixture-generated teams.
  await seed(false);await evaluate(c=>{c.completeRandom=false;});await page.locator('.primary-action').click();
  await page.waitForFunction(()=>window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.scrambleNumber===12);
  const generated=await evaluate(c=>c.listOfTeams.map(t=>({ids:t.players.map(p=>p.id),male:t.players.filter(p=>p.isMale).length,female:t.players.filter(p=>!p.isMale).length})));
  assert.equal(generated.length,12);assert(generated.every(t=>t.ids.length===2&&t.male===1&&t.female===1));assert.equal(new Set(generated.flatMap(t=>t.ids)).size,24);
  checks.push('Actual balanced scramble algorithm keeps all 24 selected players exactly once in 12 balanced teams');
  await evaluate(c=>{c.isActionAllowed=false;});await expect(page.getByRole('button',{name:'Save Teams',exact:true})).toBeDisabled();await evaluate(c=>{c.isActionAllowed=true;});
  checks.push('Save remains unavailable without administration access; legacy unlock controls remain available without using a password');
  const printing=await printOutputs('after'),baseline=JSON.parse(fs.readFileSync(path.join(out,'print-baseline.json')));
  assert.deepEqual(printing,baseline,'Print markup, rendered pixels and PDF pagination must match original at 2/4/6 matchups/page');
  fs.writeFileSync(path.join(out,'print-comparison.json'),JSON.stringify(printing,null,2));checks.push('Actual print function: normalized HTML, rendered screenshots and PDF page counts match baseline for 2/4/6 matchups per page');
  const notice=page.locator('snack-bar-container').getByRole('button',{name:'Close',exact:true});if(await notice.isVisible())await notice.click();
  await expect(page.locator('snack-bar-container')).toHaveCount(0);
  for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844],[375,667]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(350);await shot('workspace-'+width);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   if(overflow)fs.writeFileSync(path.join(out,'overflow-'+width+'.json'),JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>{
    const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).visibility!=='hidden';
   }).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).slice(0,50)),null,2));
   if(overflow)fs.writeFileSync(path.join(out,'overflow-containers.json'),JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,class:e.className,client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflow,position:getComputedStyle(e).position}))),null,2));
   assert.equal(overflow,false,'No horizontal page overflow at '+width);
  }
  checks.push('Desktop 1920/1366, tablet768 and mobile390/375 render without horizontal overflow');
  // Existing preference actions remain live; use a fresh local selection, without persistence.
  await evaluate(c=>{c.addPlayerToTopPlayerList(c.selectedList[0]);c.addPlayerToLowPlayerList(c.selectedList[1]);c.addPlayerToByeList(c.selectedList[2]);});
  assert.equal(await evaluate(c=>c.displayTopPlayers.length),1);assert.equal(await evaluate(c=>c.displayLowPlayers.length),1);assert.equal(await evaluate(c=>c.byePlayers.length),1);
  checks.push('Top, Low and Bye preference actions still update the existing selected-player state');
  await evaluate(c=>{c.fetchSelectedList();});await page.waitForFunction(()=>window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.fetchClicked);
  assert.equal(await evaluate(c=>c.selectedList.length),24);
  await evaluate(c=>{c.clearTopPLayers();c.clearLowPlayers();c.clearByePlayers();c.applyTopPlayersFromMaleStandings();});assert((await evaluate(c=>c.displayTopPlayers.length))>0);
  const gender=await evaluate(c=>c.selectedList[0].isMale);await evaluate(c=>c.swapGender(c.selectedList[0]));assert.notEqual(await evaluate(c=>c.selectedList[0].isMale),gender);
  checks.push('Fetch signed-in roster, retained standings-driven top selection and temporary gender action execute existing methods');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,mode+'-results.json'),JSON.stringify({checks,pageErrors:errors,writes,databaseAccess:false,mode:'browser-only API fixtures; actual component/print function'},null,2));await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

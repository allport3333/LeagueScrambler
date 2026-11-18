// Actual Angular components, in-memory API fixtures only. No SQL or real API writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../management-consolidation-evidence');fs.mkdirSync(out,{recursive:true});
const catalog=Array.from({length:8},(_,i)=>({id:1001+i,firstName:'Synthetic',lastName:'Player'+String(i+1).padStart(2,'0'),isMale:i%2===0,gender:i%2===0?'Male':'Female',isSub:false}));
const leagues=[{id:101,leagueName:'Synthetic League A'},{id:102,leagueName:'Synthetic League B'}];
const memberships={101:[1001,1002,1003,1004],102:[1001,1007]};const divisions={101:[{id:11,code:'GM',name:'Gold',sortOrder:1},{id:12,code:'SM',name:'Silver',sortOrder:2}],102:[]};
const memberDivisions={1001:11};const requests=[],checks=[],errors=[];let browser,role='Admin',rosterFail=false,mutationFail=false;
function leagueId(u){const name=decodeURIComponent(u.pathname.split('/').pop());return (leagues.find(l=>l.leagueName===name)||{}).id||Number(name);}
function roster(id){return (memberships[id]||[]).map(id=>catalog.find(p=>p.id===id));}
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  const req=route.request();let u;try{u=assertLocalUrl(req.url());}catch{const a=new URL(req.url());if(req.method()==='GET'&&['fonts.googleapis.com','fonts.gstatic.com','use.fontawesome.com'].includes(a.hostname)&&['font','stylesheet'].includes(req.resourceType()))return route.continue();return route.abort();}
  const p=u.pathname.toLowerCase();if(p.startsWith('/sockjs-node'))return route.abort();if(!p.startsWith('/api/'))return req.method()==='GET'?route.continue():route.abort();
  let body=[];const id=leagueId(u);
  if(req.method()!=='GET'){
   const data=req.postDataJSON();requests.push({path:p,data,fixtureOnly:true});if(mutationFail){mutationFail=false;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Fixture denial'})});}
   if(p.includes('/addplayer/')){let player=catalog.find(x=>x.firstName===data.firstName&&x.lastName===data.lastName);if(!player){player={...data,id:9001};catalog.push(player);}if(!memberships[id].includes(player.id))memberships[id].push(player.id);const div=Number(u.searchParams.get('leagueDivisionId'));if(div)memberDivisions[player.id]=div;body=player;}
   else if(p.includes('/deleteplayer/')){const player=catalog.find(x=>x.firstName===data.firstName&&x.lastName===data.lastName);memberships[id]=memberships[id].filter(x=>x!==player.id);body=player;}
   else if(p==='/api/login/updatesetting')body={};
   else if(p.includes('/addnewleague/')){body={id:103,leagueName:decodeURIComponent(u.pathname.split('/').pop())};leagues.push(body);memberships[103]=[];divisions[103]=[];}
   else if(p==='/api/leaguedivision/add'){if(divisions[data.leagueId].some(d=>d.code===data.code))return route.fulfill({status:400,body:'Division code already exists'});divisions[data.leagueId].push({...data,id:13});body={message:'Division added.'};}
   else return route.abort();
  }else if(p==='/api/login/isauthenticated')body=true;
  else if(p==='/api/login/getusersrole')body={role};
  else if(p==='/api/login/getusersplayer')body={playerId:1001};
  else if(p==='/api/login/isadminpasswordauthorized')body=false;
  else if(p==='/api/login/getuserleagues'||p==='/api/scrambledata/getleagues')body=leagues;
  else if(u.searchParams.has('settingName'))body={settingValue:{dropLowest:'0',numberOfSubsAllowed:'3',subScorePercent:'80',standingsType:'round',dayOfLeague:'Thursday'}[u.searchParams.get('settingName')]};
  else if(p.startsWith('/api/leaguedivision/getbyleague/'))body=divisions[id]||[];
  else if(p.includes('/searchplayers'))body=catalog.filter(x=>(x.firstName+' '+x.lastName).toLowerCase().includes((u.searchParams.get('searchTerm')||'').toLowerCase()));
  else if(p.includes('/getplayers/')){if(rosterFail)return route.fulfill({status:500,body:'Fixture roster failure'});body=roster(id);}
  else if(p.includes('/selectleague/'))body=roster(id);
  else if(p.includes('/getbyleague'))body={maxRounds:1,playerScores:roster(id).slice(0,2).map(x=>({playerId:x.id,playerName:x.firstName+' '+x.lastName,isMale:x.isMale,leagueDivisionId:memberDivisions[x.id]||0,leagueDivisionCode:memberDivisions[x.id]===11?'GM':'Unassigned',leagueDivisionName:memberDivisions[x.id]===11?'Gold':'Unassigned',scores:[{roundId:1,score:21,roundWon:true,isSubScore:false}]}))};
  else if(p.includes('allmale'))body=roster(101).filter(x=>x.isMale);
  else if(p.includes('allfemale'))body=roster(101).filter(x=>!x.isMale);
  else if(p.endsWith('/getplayers'))body=catalog;
  else if(p.includes('has'))body=false;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Angular page error: '+e.message);});
 await page.goto(BASE_URL+'/league-management');const root=page.locator('.consolidated-management');await expect(root).toBeVisible();await page.waitForFunction(()=>{const c=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;return !c.managementRosterLoading&&c.managementRoster.length===4;});
 const component=fn=>page.evaluate(fn=>{const d=window.ng.probe(document.querySelector('app-scrambler-component'));return d.injector.get(window.ng.coreTokens.NgZone).run(()=>eval('('+fn+')')(d.componentInstance));},fn.toString());
 async function tab(name){await root.getByRole('tab',{name,exact:true}).click();await page.waitForTimeout(550);}
 async function notices(){const close=page.locator('snack-bar-container button');if(await close.last().isVisible())await close.last().click();await expect(page.locator('snack-bar-container')).toHaveCount(0);}
 async function shot(name){await page.evaluate(()=>document.fonts.ready);await root.screenshot({path:path.join(out,name+'.png')});}
 if(process.argv.includes('--search-only')){
  const search=root.getByRole('textbox',{name:'Search current league players',exact:true});
  for(const width of [1366,375,390]){
   await page.setViewportSize({width,height:844});await expect(root.locator('.management-roster li')).toHaveCount(0);await shot('roster-search-default-'+width);
   await search.fill('player01');await expect(root.locator('.management-roster li')).toHaveCount(1);await shot('roster-search-results-'+width);
   await search.fill('');await expect(root.locator('.management-roster li')).toHaveCount(0);await search.fill('   ');await expect(root.locator('.management-roster li')).toHaveCount(0);
   await search.fill('no match');await expect(root.getByText('No players match your search.',{exact:true})).toBeVisible();
   await root.getByRole('button',{name:'Show All Players',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(4);await expect(search).toHaveValue('');
   await search.fill('Player02');await expect(root.locator('.management-roster li')).toHaveCount(1);await search.fill('');await expect(root.locator('.management-roster li')).toHaveCount(0);
   await root.getByRole('button',{name:'Show All Players',exact:true}).click();await root.getByRole('button',{name:'Hide All Players',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   checks.push(width+': hidden default, live matching/no-results/clear, explicit Show All/Hide All and no overflow');
  }
  await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'Synthetic League A',exact:true}).click();await page.getByRole('menuitem',{name:'Synthetic League B',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(0);await search.fill('Player01');await expect(root.locator('.management-roster li')).toHaveCount(1);checks.push('League switching returns to search-first presentation and scopes matches');
  assert.equal(requests.length,0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'search-results.json'),JSON.stringify({checks,pageErrors:errors,requests,databaseAccess:false},null,2));await browser.close();return;
 }
 await root.getByRole('button',{name:'Show All Players',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(4);
 if(process.argv.includes('--visual-only')){
  for(const [width,height] of [[1366,768],[1920,1080],[375,667],[390,844]]){
   await page.setViewportSize({width,height});await tab('Manage Players');await shot('manage-players-'+width);
   await root.locator('.management-form-card').filter({has:page.getByRole('heading',{name:'Add Existing Player',exact:true})}).screenshot({path:path.join(out,'add-existing-'+width+'.png')});
   const overlap=await root.locator('.management-roster li').evaluateAll(ns=>ns.some(n=>n.querySelector('.roster-player-name').getBoundingClientRect().right>n.querySelector('button').getBoundingClientRect().left));assert.equal(overlap,false);
   await root.locator('.management-roster li').first().getByRole('button',{name:'Remove from League'}).click();const box=await page.getByRole('dialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width);await page.getByRole('dialog').screenshot({path:path.join(out,'remove-confirmation-'+width+'.png')});await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
   await root.getByRole('button',{name:'Create New Player',exact:true}).click();await component(c=>c.PlayerForm.patchValue({firstName:'SyntheticPreview',lastName:'Player',selectedGender:'Female',isSub:false}));await shot('create-new-player-expanded-'+width);await root.getByRole('button',{name:'Create New Player',exact:true}).click();
   await tab('League Settings');await shot('league-settings-'+width);await tab('League Setup');await shot('league-setup-'+width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width<800){const cards=await root.locator('.management-setup-grid .management-form-card').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().top));assert(cards[1]>cards[0]);}
   checks.push(width+': three tabs, roster actions do not overlap, dialog fits, creation expands and setup responds without overflow');
  }
  await page.setViewportSize({width:1366,height:768});await tab('Manage Players');await component(c=>{c.isActionAllowed=false;});await expect(root.locator('.management-roster button').first()).toBeDisabled();await expect(page.getByRole('textbox',{name:'Administration Password',exact:true})).toBeVisible();checks.push('Existing locked administration controls visible; removal disabled; no password supplied or unlock attempted');
  assert.equal(requests.length,0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'visual-results.json'),JSON.stringify({checks,pageErrors:errors,requests,databaseAccess:false},null,2));await browser.close();return;
 }
 assert.deepEqual(await root.getByRole('tab').allTextContents(),['Manage Players','League Settings','League Setup']);await expect(root.locator('.management-roster li').first()).toContainText('Gold');
 const search=root.getByRole('textbox',{name:'Search current league players',exact:true});await search.fill('Player01');await expect(root.locator('.management-roster li')).toHaveCount(1);await search.fill('nobody');await expect(root.getByText('No players match your search.',{exact:true})).toBeVisible();await search.fill('');await root.getByRole('button',{name:'Show All Players',exact:true}).click();checks.push('Three sections, scoped roster, available division, filtering/no results');
 const first=root.locator('.management-roster li').filter({hasText:'Player01'});await first.getByRole('button',{name:'Remove from League'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Synthetic Player01');await expect(dialog).toContainText('Synthetic League A');await dialog.screenshot({path:path.join(out,'remove-confirmation-desktop.png')});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(requests.length,0);await expect(root.locator('.management-roster li')).toHaveCount(4);
 await first.getByRole('button',{name:'Remove from League'}).click();await page.getByRole('dialog').getByRole('button',{name:'Remove from League',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(3);assert(catalog.some(p=>p.id===1001));assert(memberships[102].includes(1001));await notices();checks.push('Removal confirmation cancel/no POST; confirm reuses league-scoped endpoint; fixture global player and other league intact');
 const existing=root.getByRole('combobox',{name:'Search Player',exact:true});await existing.fill('Synthetic Player05');await page.getByRole('option',{name:'Synthetic Player05',exact:true}).click();
 await root.locator('mat-select[name="divisionSelect"]').click();await page.getByRole('option',{name:'Silver',exact:true}).click();await root.getByRole('button',{name:'Add Existing Player',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(4);assert.equal(catalog.length,8);assert.equal(memberDivisions[1005],12);await notices();
 await root.getByRole('button',{name:'Add Existing Player',exact:true}).click();await expect.poll(()=>requests.filter(r=>r.path.includes('/addplayer/')).length).toBe(2);assert.equal(memberships[101].filter(id=>id===1005).length,1);await notices();checks.push('Existing autocomplete/division selection, membership add and duplicate idempotence via existing contract; no fixture global creation');
 await root.getByRole('button',{name:'Create New Player',exact:true}).click();await root.locator('[formcontrolname="firstName"]').fill('SyntheticCreated');await root.locator('[formcontrolname="lastName"]').fill('Player99');await root.locator('mat-select[placeholder="Gender"]').click();await page.getByRole('option',{name:'Female',exact:true}).click();await shot('create-new-player-expanded');
 await root.getByRole('button',{name:'Submit',exact:true}).click();await expect(root.locator('.management-roster li').filter({hasText:'SyntheticCreated Player99'})).toHaveCount(1);await notices();checks.push('Original new-player form/creation handler updates refreshed roster with saved ID');
 await tab('League Settings');const settingsBefore=requests.length;await root.locator('.management-settings-grid mat-select').first().click();await page.getByRole('option',{name:'Drop 2 Scores',exact:true}).click();assert.equal(requests.length,settingsBefore);await root.getByRole('button',{name:'Save Settings',exact:true}).click();await expect.poll(()=>requests.filter(r=>r.path.includes('/updatesetting')).length).toBe(5);await notices();checks.push('Settings dropdown change remains local; explicit save uses original five requests');
 await tab('League Setup');await root.locator('[formcontrolname="newLeagueName"]').fill('Synthetic Created League');await root.getByRole('button',{name:'Add New League',exact:true}).click();await expect.poll(()=>requests.filter(r=>r.path.includes('/addnewleague/')).length).toBe(1);await notices();
 await root.locator('[formcontrolname="code"]').fill('TEST');await root.locator('[formcontrolname="name"]').fill('Synthetic Division');await root.getByRole('button',{name:'Add Division',exact:true}).click();await expect.poll(()=>requests.filter(r=>r.path==='/api/leaguedivision/add').length).toBe(1);assert.equal(divisions[101].slice(-1)[0].code,'TEST');await notices();checks.push('Original league and division forms/handlers use existing endpoints and selected league');
 for(const [width,height] of [[1366,768],[1920,1080],[375,667],[390,844]]){
  await page.setViewportSize({width,height});for(const section of ['Manage Players','League Settings','League Setup']){await tab(section);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(section.toLowerCase().replace(/ /g,'-')+'-'+width);}
  if(width<800){await tab('Manage Players');await root.locator('.management-roster li').first().getByRole('button',{name:'Remove from League'}).click();await page.getByRole('dialog').screenshot({path:path.join(out,'remove-confirmation-'+width+'.png')});await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();}
 }
 checks.push('Four desktop/phone sizes: all sections, expanded creation, stacked setup and dialogs; no horizontal overflow');
 await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'Synthetic League A',exact:true}).click();await page.getByRole('menuitem',{name:'Synthetic League B',exact:true}).click();await tab('Manage Players');await root.getByRole('button',{name:'Show All Players',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(2);await expect(root.locator('.management-roster li').filter({hasText:'Player01'})).toHaveCount(1);
 const saved=memberships[102].slice();memberships[102]=[];await component(c=>c.refreshManagementRoster());await expect(root.getByText('No players belong to this league yet.',{exact:true})).toBeVisible();memberships[102]=saved;rosterFail=true;await component(c=>c.refreshManagementRoster());await expect(root.getByRole('alert')).toContainText('Unable to load');rosterFail=false;await root.getByRole('button',{name:'Retry roster',exact:true}).click();await expect(root.locator('.management-roster li')).toHaveCount(2);checks.push('League switch scopes roster; empty and failure/retry states');
 await component(c=>{c.selectedList=c.malePlayers1.slice();c.__managementToken='preserved';});const selected=await component(c=>JSON.stringify(c.selectedList));await page.locator('app-nav-menu').getByRole('link',{name:'Scrambler',exact:true}).click();assert.equal(await component(c=>c.__managementToken),'preserved');assert.equal(await component(c=>JSON.stringify(c.selectedList)),selected);checks.push('Main navigation return keeps shared Scrambler instance and selection');
 role='Manager';await page.goto(BASE_URL+'/league-management');await expect(root).toBeVisible();role='Player';await page.reload();await expect(page).toHaveURL(BASE_URL+'/');checks.push('Manager allowed and Player direct route blocked by existing guard; no legacy password used');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,pageErrors:errors,requests,databaseAccess:false,realPersistenceVerified:false},null,2));await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

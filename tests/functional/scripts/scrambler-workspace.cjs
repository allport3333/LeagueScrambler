// UI workflow + print verification. All API traffic intercepted; no real writes or SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const mode=process.argv[2]||'final',useScoringFixtures=mode.startsWith('scoring')||mode==='matchups-modal'||mode.startsWith('results-refinements')||mode.startsWith('modal-polish')||mode==='modal-widths'||mode==='court-print',out=process.env.LEAGUE_TEST_OUT?path.resolve(process.env.LEAGUE_TEST_OUT):mode==='court-print'?path.resolve(__dirname,'../court-print-evidence'):mode==='modal-widths'?path.resolve(__dirname,'../modal-widths-evidence'):mode.startsWith('modal-polish')?path.resolve(__dirname,'../modal-polish-evidence'):mode==='button-contrast'?path.resolve(__dirname,'../button-contrast-evidence'):mode.startsWith('results-refinements')?path.resolve(__dirname,'../results-refinements-evidence'):mode==='matchups-modal'?path.resolve(__dirname,'../matchups-modal-evidence'):path.resolve(__dirname,useScoringFixtures?'../mobile-scoring-evidence':mode.startsWith('management-layout')?'../management-layout-evidence':mode==='navigation'?'../navigation-evidence':mode==='corrections'?'../scrambler-corrections-evidence':mode.startsWith('polish')?'../scrambler-polish-evidence':'../scrambler-workspace-evidence');fs.mkdirSync(out,{recursive:true});let browser;
const players=Array.from({length:24},(_,i)=>({id:1001+i,firstName:'Synthetic',lastName:'Player'+String(i+1).padStart(2,'0'),isMale:i%2===0,gender:i%2===0?'Male':'Female',isSub:false,isTopPlayer:false,isLowPlayer:false,isByePlayer:false}));
const teams=()=>Array.from({length:12},(_,i)=>({players:players.slice(i*2,i*2+2).map(p=>({...p})),maleCount:1,femaleCount:1,sortingId:i+1,kingQueenTeamId:201+i,scrambleNumber:12,kingQueenRoundScores:[]}));
const hash=content=>crypto.createHash('sha256').update(content).digest('hex');
const printBaselinePath=process.env.LEAGUE_PRINT_BASELINE?path.resolve(process.env.LEAGUE_PRINT_BASELINE):path.resolve(__dirname,'../scrambler-workspace-evidence/print-baseline.json');
(async()=>{
 browser=await chromium.launch(['scoring-defaults','navigation'].includes(mode) ? {channel:'msedge'} : {});const context=await browser.newContext({serviceWorkers:'block',hasTouch:mode==='navigation',viewport:{width:1920,height:1080}});const errors=[],writes=[],checks=[];let failNextSave=false,navigationRole='Admin',navigationSignedIn=true;let fixtureScoreFailure=false,fixtureSubFailure=false,fixtureReadFailure=false,fixtureOdd=false,fixtureEmpty=false;const savedScores=new Map(),savedSubs=new Map(),savedAssignments=new Map();let scoreSaveRequests=0;let defaultsSaved=false, defaultsSavedTeams=[], defaultsSecondEmpty=false, defaultsSecondDelay=false;let nextScoreId=9000;
 await context.route('**/*',async route=>{
  let u;try{u=assertLocalUrl(route.request().url());}catch{
   const asset=new URL(route.request().url());
   if((useScoringFixtures||['polish','corrections','visibility','fetch','navigation','management-layout-before','management-layout-after'].includes(mode))&&route.request().method()==='GET'&&['fonts.googleapis.com','fonts.gstatic.com','use.fontawesome.com'].includes(asset.hostname)&&['font','stylesheet'].includes(route.request().resourceType())){await route.continue();return;}
   await route.abort();return;
  }
  const p=u.pathname.toLowerCase();let body=[];
  if(p.startsWith('/sockjs-node/')){await route.abort();return;}
  if(route.request().method()!=='GET'){
   const data=route.request().postDataJSON();writes.push({path:p,mode:'intercepted fixture only'});
   if(mode==='management-layout-after'&&p.includes('/updatesetting')){body={};writes[writes.length-1].data=data;}
   else if(mode==='navigation'&&p==='/api/login/logout'){navigationSignedIn=false;body={};}
   else if(mode==='scoring-defaults'&&p.includes('/generatescramble/'))body=data.kingQueenTeams.map((_,i)=>({id:5200+i,scrambleNumber:15}));
   else if(mode==='scoring-defaults'&&p.includes('/savekingqueenteams/')){defaultsSaved=true;defaultsSavedTeams=data.kingQueenTeams.map(t=>({kingQueenTeam:{id:t.kingQueenTeam.id,scrambleNumber:15,kingQueenPlayers:[],kingQueenRoundScores:[]},players:t.players}));body={kingQueenTeams:defaultsSavedTeams,byePlayers:[]};}
   else if(p.includes('/generatescramble/'))body=(data.kingQueenTeams||[]).map((t,i)=>({id:((mode==='matchups-modal'||mode.startsWith('results-refinements'))?5001:201)+i,scrambleNumber:12}));
   else if(p.includes('/savekingqueenteams/')){if(failNextSave){failNextSave=false;await route.fulfill({status:500,body:'Fixture save failure'});return;}if(mode==='matchups-modal'||mode.startsWith('results-refinements')){writes[writes.length-1].data=data;data.kingQueenTeams.forEach(t=>savedAssignments.set(t.kingQueenTeam.id,JSON.parse(JSON.stringify(t.players))));body={kingQueenTeams:data.kingQueenTeams.map(t=>({kingQueenTeam:{id:t.kingQueenTeam.id,scrambleNumber:12},players:t.players})),byePlayers:data.byePlayers||[]};await new Promise(resolve=>setTimeout(resolve,180));}else body={kingQueenTeams:teams().map(t=>({kingQueenTeam:{id:t.kingQueenTeamId,scrambleNumber:12},players:t.players})),byePlayers:[]};}
   else if(p.includes('/savekingqueenroundscores/')){if(useScoringFixtures){scoreSaveRequests++;writes[writes.length-1].data=data;if(fixtureScoreFailure){fixtureScoreFailure=false;await route.fulfill({status:500,body:'Fixture score save failed'});return;}for(const row of data.roundScores){const found=savedScores.get(row.kingQueenTeamId);if(!found)throw Error('Unknown score team');const old=found.find(r=>row.id>0&&r.id===row.id);if(old)Object.assign(old,row);else found.push({...row,id:nextScoreId++});}await new Promise(resolve=>setTimeout(resolve,180));body={success:true,savedScores:data.roundScores};}else body={};}
   else if(useScoringFixtures&&p.includes('/updatekingqueenplayersubstatus')){writes[writes.length-1].data=data;if(fixtureSubFailure){fixtureSubFailure=false;await route.fulfill({status:500,body:'Fixture sub update failed'});return;}savedSubs.set(data.kingQueenTeamId+':'+data.playerId,data.isSubScore);body={};}
   else{await route.abort();return;}
  }else if(!p.startsWith('/api/')){
    if(!process.env.LEAGUE_TEST_DIST){await route.continue();return;}
    const dist=path.resolve(process.env.LEAGUE_TEST_DIST);let file=path.resolve(dist,'.'+decodeURIComponent(u.pathname));
    if(file!==dist&&!file.startsWith(dist+path.sep))return route.abort();
    if(!path.extname(file))file=path.join(dist,'index.html');if(!fs.existsSync(file))return route.abort();
    await route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});return;
   }
  else if(p==='/api/login/isauthenticated')body=navigationSignedIn;
  else if(p==='/api/login/getusersrole')body={role:navigationRole};
  else if(p==='/api/login/getusersplayer')body={playerId:1001};
  else if(p==='/api/login/isadminpasswordauthorized')body=false;
  else if(p==='/api/login/getuserleagues'||p==='/api/scrambledata/getleagues')body=(mode==='navigation'||useScoringFixtures)?[{id:101,leagueName:'Synthetic League'},{id:102,leagueName:'Second Synthetic League'}]:[{id:101,leagueName:'Synthetic League'}];
  else if(u.searchParams.has('settingName'))body={settingValue:{dropLowest:'0',numberOfSubsAllowed:'100',subScorePercent:'100',standingsType:'round',dayOfLeague:'Monday'}[u.searchParams.get('settingName')]};
  else if(p.includes('/getbyleague'))body={maxRounds:2,playerScores:players.map(x=>({playerId:x.id,playerName:x.firstName+' '+x.lastName,isMale:x.isMale,scores:[{roundId:1,score:21,roundWon:true,isSubScore:false},{roundId:2,score:15,roundWon:false,isSubScore:false}]}))};
  else if(p.includes('/getmanagementaccess')||p.includes('/leaguemanagementaccess'))body={role:'Admin',canManage:true};
  else if(mode==='scoring-defaults'&&p.includes('/selectedleaguescrambles/')){
   if(p.includes('second')){if(defaultsSecondDelay)await new Promise(resolve=>setTimeout(resolve,700));body=defaultsSecondEmpty?[]:[{id:88,scrambleNumber:88,dateOfTeam:'2026-11-14T10:00:00'}];}
   else body=[{id:211,scrambleNumber:12,dateOfTeam:'2026-11-17T18:00:00'},{id:1211,scrambleNumber:13,dateOfTeam:'2026-11-17T18:00:00'},{id:2211,scrambleNumber:14,dateOfTeam:'2026-11-17T16:00:00'},...(defaultsSaved?[{id:5200,scrambleNumber:15,dateOfTeam:'2026-11-18T18:00:00'}]:[])];
  }
  else if(useScoringFixtures&&p.includes('/selectedleaguescrambles/'))body=[{id:211,scrambleNumber:12,dateOfTeam:'2026-11-01T18:00:00'},{id:1211,scrambleNumber:13,dateOfTeam:'2026-11-08T18:00:00'},{id:2211,scrambleNumber:14,dateOfTeam:'2026-11-15T18:00:00'}];
  else if(mode==='scoring-defaults'&&p.includes('/getkingqueenteamsbyscramblenumber/')&&p.endsWith('/15'))body={kingQueenTeams:defaultsSavedTeams,byePlayers:[]};
  else if(useScoringFixtures&&p.includes('/getkingqueenteamsbyscramblenumber/')){if(fixtureReadFailure){fixtureReadFailure=false;await route.fulfill({status:500,body:'Fixture read failed'});return;}const number=Number(p.split('/').pop());const records=teams().slice(0,fixtureEmpty?0:fixtureOdd?11:12).map((t,index)=>{const id=211+index*7+((number-12)*1000);if(!savedScores.has(id))savedScores.set(id,(number===14?[]:[1,2,3]).filter(round=>index===0?round===1:!(index===11&&round===2)).map(round=>({id:id*10+round,kingQueenTeamId:id,roundId:round,roundScore:10+index+round,roundWon:round===1&&index%2===0})));return{kingQueenTeam:{id,scrambleNumber:number,kingQueenPlayers:t.players.map(x=>({playerId:x.id,isSubScore:savedSubs.get(id+':'+x.id)||false})),kingQueenRoundScores:JSON.parse(JSON.stringify(savedScores.get(id)))},players:savedAssignments.get(id)||t.players};});body={kingQueenTeams:records,byePlayers:[{id:1999,firstName:'Synthetic',lastName:'Bye'}]};}
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
 if (mode === 'scoring-defaults') {
  const selector = page.locator('.score-editor-card mat-select').first();
  const scoreTab = page.getByRole('tab',{name:'Manage Scores',exact:true});
  const rosterTab = page.getByRole('tab',{name:'Select Players',exact:true});
  async function league(name) {
   await page.locator('#leagueDropdown').click();
   await page.getByRole('menuitem',{name,exact:true}).click();
  }
  for (const [theme,width] of [['classic',1280],['navy',390],['charcoal',430]]) {
   defaultsSaved=false;defaultsSecondEmpty=false;
   await page.evaluate(value=>localStorage.setItem('league-hub-appearance',value),theme);
   await page.setViewportSize({width,height:900});
   await page.reload();
   await league('Synthetic League');
   await expect(page.getByText('No scramble has been generated yet.',{exact:false})).toHaveCount(0);
   await expect(page.locator('.scrambler-results-shell')).toBeHidden();
   await scoreTab.press('Enter');
   await expect(selector).toContainText('Scramble 13');
   await expect(page.locator('.score-editor-card mat-select').nth(1)).toContainText('3 Rounds');
   await selector.click();
   await page.getByRole('option',{name:/Scramble 12 /}).click();
   await expect(selector).toContainText('Scramble 12');
   await expect(page.locator('.scrambler-results-shell')).toBeHidden();
   const editor=page.locator('.score-editor-card');
   await editor.getByRole('switch').first().click();
   await expect(editor).toContainText('Substitute setting saved.');
   await editor.getByRole('spinbutton').first().fill('19');
   await editor.getByRole('button',{name:'Save Round Scores',exact:true}).click();
   await expect(editor).toContainText('Round scores saved successfully.');
   await expect(selector).toContainText('Scramble 12');
   await rosterTab.press('Enter');
   await scoreTab.press('Enter');
   await expect(selector).toContainText('Scramble 12');
   await league('Second Synthetic League');
   await expect(selector).toContainText('Scramble 88');
   await league('Synthetic League');
   await expect(selector).toContainText('Scramble 13');
   await page.locator('.score-editor-card').screenshot({path:path.join(out,theme+'-latest-scores.png')});
   defaultsSecondDelay=true;
   await league('Second Synthetic League');
   await league('Synthetic League');
   await expect(selector).toContainText('Scramble 13');
   await page.waitForTimeout(750);
   await expect(selector).toContainText('Scramble 13');
   defaultsSecondDelay=false;
   defaultsSecondEmpty=true;
   await league('Second Synthetic League');
   await expect(page.getByText('No saved scrambles for this league.')).toBeVisible();
   await league('Synthetic League');
   await expect(selector).toContainText('Scramble 13');
   await rosterTab.press('Enter');
   await page.getByRole('button',{name:'Select All',exact:true}).click();
   const generate=page.getByRole('button',{name:'Scramble Players',exact:true});
   await generate.click();
   const results=page.locator('.scrambler-results-shell');
   await expect(results).toBeVisible();
   await expect(results.getByRole('button',{name:'View Matchups'})).toBeVisible();
   await expect(results.getByRole('button',{name:'Modify Teams'})).toBeVisible();
   await results.getByRole('button',{name:'Save Scramble',exact:true}).click();
   await expect(results.getByRole('button',{name:'Print Matchups'})).toBeEnabled();
   await expect(page.getByText('No scramble has been generated yet.',{exact:false})).toHaveCount(0);
   await results.screenshot({path:path.join(out,theme+'-generated.png')});
   await results.locator('summary').click();
   const printRounds=results.locator('.results-print-controls mat-select').nth(1);
   await printRounds.click();
   await page.getByRole('option',{name:'2 Rounds',exact:true}).click();
   await expect(printRounds).toContainText('2 Rounds');
   await expect(page.locator('.mat-mdc-select-panel')).toHaveCount(0);
   await scoreTab.click();
   await expect(scoreTab).toHaveAttribute('aria-selected','true');
   await expect(selector).toContainText('Scramble 15');
   if (width < 600) await expect(page.locator('.mobile-score-navigation')).toContainText('Match 1 of 3');
   else await expect(page.locator('.desktop-matchup-editor')).toHaveCount(3);
   await expect(printRounds).toContainText('2 Rounds');
   await expect(results.getByRole('button',{name:'Print Matchups'})).toBeEnabled();
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'scoring-defaults-results.json'), JSON.stringify({
   passed:true, databaseAccess:false, fixtures:true, viewports:{classic:1280,navy:390,charcoal:430},
   checks:['creation time and ID ordering','manual selection and save','substitute toggle','tab and league changes',
    'stale list response','empty list','generated and saved scramble','preserved top results and print rounds']
  },null,2));
  await browser.close();
  console.log('Manage Scores defaults, manual selection, league switch, stale responses, empty and new saved scramble passed in three themes.');
  return;
 }
 if(mode!=='navigation'){await page.waitForFunction(()=>{const c=(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance);return c.selectedLeague==='Synthetic League'&&c.malePlayers1.length===12;});await page.waitForTimeout(550);}
 async function evaluate(fn,arg){return require('./angular-component.cjs')(page,'app-scrambler-component',fn,arg);}
 async function seed(results=true){await evaluate((c,arg)=>{c.selectedList=arg.useRoster?c.malePlayers1.concat(c.femalePlayers1):arg.players;c.teamSize=2;c.numberOfTeams=null;c.teamCount=12;c.isActionAllowed=true;c.selectedRounds=5;c.selectedMatchupsPerPage='2';c.rounds=[1,2,3,4,5];c.listOfTeams=arg.results?arg.teams:[];c.scrambleNumber=arg.results?12:null;c.__workspaceToken='retained';},{players,teams:teams(),results,useRoster:mode==='corrections'});await page.waitForTimeout(100);}
 async function shot(name){await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 async function printOutputs(label){const result={};await seed();await evaluate(c=>c.rememberSavedTeams()); // Explicitly model saved fixture teams, never infer from generated IDs.
  for(const count of ['2','4','6']){
   const html=await evaluate((c,count)=>{c.selectedMatchupsPerPage=count;let html='';const original=window.open;window.open=()=>({document:{open(){},write(value){html=value;},close(){}},set onload(fn){},print(){},close(){}});try{c.printMatchups();}finally{window.open=original;}return html;},count);
   const render=await context.newPage();await render.setViewportSize({width:800,height:1000});await render.emulateMedia({media:'print'});await render.setContent(html);
   await render.screenshot({path:path.join(out,`print-${count}-${label}.png`),fullPage:true});const pdf=await render.pdf({path:path.join(out,`print-${count}-${label}.pdf`),format:'A4',preferCSSPageSize:true,printBackground:true});
   result[count]={htmlHash:hash(html.replace(/ _ngcontent[^=\s]*=""/g,'')),pixels:hash(fs.readFileSync(path.join(out,`print-${count}-${label}.png`))),pages:(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length};await render.close();
  }fs.writeFileSync(path.join(out,'print-'+label+'-metadata.json'),JSON.stringify(result,null,2));return result;
 }
 if(mode==='court-print'){
  await seed();await evaluate(c=>c.rememberSavedTeams());const summary=page.locator('.compact-results');await summary.getByRole('button',{name:'View Matchups',exact:true}).click();const modal=page.getByRole('dialog'),courts=modal.getByRole('textbox',{name:'Court',exact:true});await courts.nth(0).fill('4');await courts.nth(1).fill('9');await courts.nth(2).fill('2');await expect(modal.getByRole('button',{name:'Print Matchups',exact:true})).toBeEnabled();await expect(modal.locator('.modal-print-button')).toHaveClass(/mat-raised-button/);await page.waitForTimeout(300);const style=await modal.locator('.modal-print-button').evaluate(e=>({border:getComputedStyle(e).borderStyle,height:e.getBoundingClientRect().height}));assert.equal(style.border,'solid');assert(style.height>=40);await modal.getByRole('button',{name:'Close matchups',exact:true}).click();await summary.getByRole('button',{name:'View Matchups',exact:true}).click();await expect(courts.first()).toHaveValue('4');
  for(const count of ['2','4','6']){await evaluate((c,n)=>{c.selectedMatchupsPerPage=n;c.selectedRounds=5;c.initializeRounds();},count);const html=await evaluate(c=>{let html='';const old=window.open;window.open=()=>({document:{open(){},write(v){html=v;},close(){}},set onload(fn){}});try{c.printMatchups();}finally{window.open=old;}return html;});const printed=await context.newPage();await printed.emulateMedia({media:'print'});await printed.setContent(html);assert(html.includes('Game 5'));assert(!html.includes('Game 6'));if(count==='6'){const boxes=printed.locator('.printed-court-value');await expect(boxes).toHaveCount(6);assert.deepEqual((await boxes.allTextContents()).map(v=>v.trim()),['4','9','2','','','']);assert.equal(await boxes.first().getAttribute('data-team-id'),'201');const box=await boxes.first().boundingBox();assert.equal(box.width,42);assert.equal(box.height,42);assert.equal(await boxes.first().evaluate(e=>getComputedStyle(e).justifyContent),'center');}else{assert(html.includes('Court 4'));assert(html.includes('Court 9'));assert(html.includes('Court 2'));}await printed.screenshot({path:path.join(out,'courts-print-'+count+'.png'),fullPage:true});await printed.pdf({path:path.join(out,'courts-print-'+count+'.pdf'),format:'A4',printBackground:true});await printed.close();}
  await page.setViewportSize({width:390,height:844});await modal.screenshot({path:path.join(out,'court-view-mobile.png')});await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await courts.first().fill('8');page.once('dialog',d=>d.accept());await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();await expect(courts.first()).toHaveValue('4');await modal.getByRole('button',{name:'Close matchups',exact:true}).click();await evaluate(c=>c.byePlayers=[]);const prior=JSON.parse(fs.readFileSync(printBaselinePath,'utf8')),current=await printOutputs('court-empty-baseline');for(const count of ['2','4','6']){assert.equal(current[count].pixels,prior[count].pixels,'Blank court print pixels '+count);assert.equal(current[count].pages,prior[count].pages);}fs.writeFileSync(path.join(out,'blank-court-print-comparison.json'),JSON.stringify({prior,current,pixelsIdentical:true},null,2));assert.equal(writes.length,0);checks.push('Temporary courts4/9/2 bind to correct print matchups for2/4/6, blank courts remain empty, existing40px box centered, five rounds unchanged; modal reopen/Edit Cancel preserved, raised Print button; blank baseline pixels/page counts identical; no writes');
 }else if(mode==='modal-widths'){

  await seed();await evaluate(c=>{c.listOfTeams[0].players[0].firstName='Christopher';c.listOfTeams[0].players[0].lastName='Montgomery-Smith';c.listOfTeams[0].players[1].firstName='Alexandria';c.listOfTeams[0].players[1].lastName='Sengstock';c.listOfTeams[1].players[0].firstName='Kristopher';c.listOfTeams[1].players[0].lastName='Long-HyphenatedName';c.byePlayers=[{id:1999,firstName:'Christopher',lastName:'Montgomery-Smith',isMale:true,isSub:false}];c.rememberSavedTeams();});await page.locator('.compact-results').getByRole('button',{name:'View Matchups',exact:true}).click();const modal=page.getByRole('dialog');await page.evaluate(()=>document.fonts.ready);const results=[];
  for(const width of [375,430,600,768,850,1024,1280,1600]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(180);
   for(const edit of [false,true]){
    if(edit)await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await page.waitForTimeout(150);
    const result=await modal.evaluate(root=>{const content=root.querySelector('mat-dialog-content'),cs=getComputedStyle(content),available=content.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),cards=Array.from(content.querySelectorAll('mat-card')),boxes=cards.map(c=>c.getBoundingClientRect()),badWords=[];for(const td of content.querySelectorAll('.viewer-player-row td,.viewer-bye-players td')){for(const node of td.childNodes){if(node.nodeType!==Node.TEXT_NODE)continue;const text=node.textContent,re=/[A-Za-z0-9]+/g;let word;while(word=re.exec(text)){const range=document.createRange();range.setStart(node,word.index);range.setEnd(node,word.index+word[0].length);const rects=Array.from(range.getClientRects()).filter(r=>r.width>0),cell=td.getBoundingClientRect();if(new Set(rects.map(r=>Math.round(r.top))).size>1||rects.some(r=>r.left<cell.left-1||r.right>cell.right+1))badWords.push(word[0]);}}}const pairs=cards.map(card=>{const columns=card.querySelector('div.row').children,teams=Array.from(columns).filter(n=>n.classList.contains('col-5')),court=card.querySelector('.viewer-court').getBoundingClientRect(),a=teams[0].getBoundingClientRect(),b=teams[1].getBoundingClientRect(),rows=Array.from(card.querySelectorAll('.viewer-player-row')).map(r=>r.getBoundingClientRect()),heads=teams.map(t=>t.querySelector('.viewer-name-headings').getBoundingClientRect().bottom);return {courtClear:a.right<=court.left+1&&court.right<=b.left+1,rowHeights:rows.map(r=>r.height),headAlignment:Math.abs(heads[0]-heads[1])};});const h=root.querySelector('header').getBoundingClientRect(),f=root.querySelector('mat-dialog-actions').getBoundingClientRect();return {viewport:innerWidth,available,minimum:parseFloat(cs.getPropertyValue('--matchup-min-width')),columns:boxes.filter(b=>Math.abs(b.top-boxes[0].top)<1).length,compact:root.querySelector('.matchups-dialog-layout').classList.contains('viewer-compact'),overflow:content.scrollWidth>content.clientWidth,badWords,pairs,headerVisible:h.top>=-1,footerVisible:f.bottom<=innerHeight+1};});result.edit=edit;results.push(result);
    assert.equal(result.columns,result.available>=result.minimum*2+12?2:1);assert.equal(result.compact,result.available<600);assert.equal(result.overflow,false);assert.deepEqual(result.badWords,[],'word overflow at '+width+' edit='+edit);assert(result.pairs.every(p=>p.courtClear&&p.headAlignment<=1&&Math.max(...p.rowHeights)-Math.min(...p.rowHeights)<=1));assert(result.headerVisible&&result.footerVisible);await modal.screenshot({path:path.join(out,width+'-'+(edit?'edit':'view')+'.png')});if(edit)await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();
   }
  }
  fs.writeFileSync(path.join(out,'layout-results.json'),JSON.stringify(results,null,2));assert.equal(writes.length,0);checks.push('Eight widths in View/Edit: content-driven card count and compact names, whole-word names, equal opposing row heights, reserved Court, header/footer visible and no overflow/writes');
 }else if(mode.startsWith('modal-polish')){

  await seed();await evaluate(c=>{c.listOfTeams[0].players[0].firstName='Alexandria';c.listOfTeams[0].players[0].lastName='Montgomery-Smith';c.listOfTeams[0].players[1].firstName='Christopher';c.listOfTeams[0].players[1].lastName='Long-HyphenatedName';c.rememberSavedTeams();});await page.locator('.compact-results').getByRole('button',{name:'View Matchups',exact:true}).click();const modal=page.getByRole('dialog');await page.waitForTimeout(300);const metrics=[];
  for(const width of [1366,1920]){await page.setViewportSize({width,height:900});const m=await modal.locator('mat-card').first().evaluate(card=>{const table=card.querySelector('.col-5 table'),row=table.querySelector('tbody tr'),heads=Array.from(table.querySelector('thead tr.d-flex').children),cells=Array.from(row.children),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,center:(r.left+r.right)/2}};return {width:innerWidth,cardHeight:card.getBoundingClientRect().height,table:rect(table),heads:heads.map(rect),cells:cells.map(rect),row:rect(row),background:getComputedStyle(row).backgroundColor,align:cells.map(e=>getComputedStyle(e).textAlign),columns:Array.from(card.parentElement.parentElement.children).filter(e=>e.getBoundingClientRect().width>0).length};});metrics.push(m);if(mode==='modal-polish'){assert(m.cells.every((cell,i)=>Math.abs(cell.center-m.heads[i].center)<1));assert(m.align.every(a=>a==='center'));const ratio=(m.cells[1].right-m.cells[0].left)/m.table.width;assert(ratio>=.75&&ratio<=.851);assert(Math.abs(m.row.width-m.table.width)<1);assert.equal(m.background,'rgb(173, 216, 230)');assert.equal(await modal.locator('mat-dialog-content').evaluate(e=>e.scrollWidth>e.clientWidth),false);await expect(modal.locator('.modal-print-hint')).toHaveText('Scramble saved');const footer=await modal.locator('mat-dialog-actions').boundingBox(),status=await modal.locator('.modal-print-hint').boundingBox(),print=await modal.getByRole('button',{name:'Print Matchups',exact:true}).boundingBox();assert(status.x<print.x);assert(print.x+print.width<=footer.x+footer.width+1);}await modal.screenshot({path:path.join(out,(mode==='modal-polish'?'after':'before')+'-desktop-'+width+'.png')});}
  if(mode==='modal-polish'){
   const court=modal.getByRole('textbox',{name:'Court',exact:true}).first();await expect(court).toBeEnabled();await court.fill('7');await expect(modal.getByRole('button',{name:'Print Matchups',exact:true})).toBeEnabled();await modal.getByRole('button',{name:'Close matchups',exact:true}).click();await page.locator('.compact-results').getByRole('button',{name:'View Matchups',exact:true}).click();await expect(court).toHaveValue('7');await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await court.fill('8');page.once('dialog',d=>d.accept());await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();await expect(court).toHaveValue('7');const print=await evaluate(c=>{let h='';const old=window.open;window.open=()=>({document:{open(){},write(v){h=v;},close(){}},set onload(fn){}});try{c.printMatchups();}finally{window.open=old;}return h;});assert(print.includes('Court 7'));
   for(const width of [375,390,430]){await page.setViewportSize({width,height:667});await expect(modal.locator('mat-card').first().getByText('First Name',{exact:true})).toHaveCount(0);await expect(modal.locator('mat-card').first().getByText('Name',{exact:true})).toHaveCount(2);assert.equal(await modal.locator('mat-dialog-content').evaluate(e=>e.scrollWidth>e.clientWidth),false);assert.equal(await modal.locator('.viewer-team-table .viewer-name-headings th,.viewer-team-table .viewer-player-row td').evaluateAll(nodes=>nodes.every(e=>getComputedStyle(e).textAlign==='center')),true);await expect(court).toBeEnabled();await modal.screenshot({path:path.join(out,'after-mobile-'+width+'.png')});}await evaluate(c=>c.savedPrintSignature=null);await expect(modal.locator('.modal-print-hint')).toHaveText('Save this scramble before printing.');await expect(modal.getByRole('button',{name:'Print Matchups',exact:true})).toBeDisabled();assert.equal(writes.length,0);checks.push('Desktop85% centered matching name columns/full-width backgrounds, centered mobile names, editable view-mode court retained on reopen/in print, edit cancel restores court, saved/unsaved footer state, no overflow or writes');}else checks.push('Baseline desktop name spacing/card dimensions captured');fs.writeFileSync(path.join(out,(mode==='modal-polish'?'after':'before')+'-metrics.json'),JSON.stringify(metrics,null,2));
 }else if(mode==='button-contrast'){

  const fetch=page.locator('.selection-actions button'),apply=page.locator('.balancing-actions .apply-top-button');
  const colors=[];
  for(const width of [1366,390]){
   await page.setViewportSize({width,height:844});
   for(const enabled of [false,true]){
    await evaluate((c,on)=>{c.hasSignedInPlayersAvailable=on;c.fetchClicked=false;c.selectedList=on?c.malePlayers1.concat(c.femalePlayers1):[];c.applyClicked=false;c.hasTopPlayersAvailable=on;c.maleStandings=on?[{playerId:1001,totalScore:21}]:[];},enabled);
    if(enabled){await expect(fetch).toBeEnabled();await expect(apply.nth(0)).toBeEnabled();await expect(apply.nth(1)).toBeEnabled();}else{await expect(fetch).toBeDisabled();await expect(apply.nth(0)).toBeDisabled();await expect(apply.nth(1)).toBeDisabled();}
    if(!enabled){const hint=page.locator('.fetch-availability-help');await hint.hover();await expect(page.locator(':is(.mat-tooltip,.mat-mdc-tooltip)')).toHaveText('No players are currently signed in.');await page.mouse.move(0,0);await hint.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(page.locator(':is(.mat-tooltip,.mat-mdc-tooltip)')).toHaveText('No players are currently signed in.');await page.keyboard.press('Tab');}
    // Park pointer outside the controls so measured colors are base states.
    await page.mouse.move(0,0);await expect.poll(()=>fetch.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(enabled?'rgb(152, 208, 167)':'rgb(237, 240, 244)');await expect.poll(()=>apply.first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(enabled?'rgb(82, 110, 159)':'rgb(237, 240, 244)');const state={width,enabled,fetch:await fetch.evaluate(e=>({background:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color})),apply:await apply.first().evaluate(e=>({background:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color}))};colors.push(state);
    assert.equal(state.fetch.background,enabled?'rgb(152, 208, 167)':'rgb(237, 240, 244)');assert.equal(state.apply.background,enabled?'rgb(82, 110, 159)':'rgb(237, 240, 244)');assert.equal(state.fetch.text,enabled?'rgb(32, 63, 42)':'rgb(100, 112, 128)');assert.equal(state.apply.text,enabled?'rgb(255, 255, 255)':'rgb(100, 112, 128)');const positions=await page.locator('.selection-actions').evaluate(e=>{const r=e.getBoundingClientRect(),h=e.querySelector('h2').getBoundingClientRect(),b=e.querySelector('button').getBoundingClientRect(),c=e.querySelector('.selection-summary').getBoundingClientRect();return {headingBottom:h.bottom,buttonTop:b.top,buttonBottom:b.bottom,countTop:c.top,buttonWidth:b.width,cardWidth:r.width};});assert(positions.buttonTop>=positions.headingBottom);assert(positions.countTop>=positions.buttonBottom);assert(positions.buttonWidth>=positions.cardWidth-34);await page.locator('.scramble-workflow-actions').screenshot({path:path.join(out,width+'-'+(enabled?'enabled':'disabled')+'.png')});
   }
  }
  await evaluate(c=>{c.fetchClicked=true;c.applyClicked=true;});await expect(fetch).toBeEnabled();await expect(apply.first()).toBeEnabled();await page.mouse.move(0,0);assert.equal(await fetch.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(152, 208, 167)');assert.equal(await apply.first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(82, 110, 159)');assert.equal(writes.length,0);fs.writeFileSync(path.join(out,'colors.json'),JSON.stringify(colors,null,2));checks.push('Desktop/mobile enabled Fetch green/dark text and Apply slate blue/white; disabled neutral; actual availability unchanged including clickable previously-applied states; no writes');
 }else if(mode==='results-refinements'){

  assert.equal(await evaluate(c=>c.selectedMatchupsPerPage),'6');assert.equal(await evaluate(c=>c.selectedRounds),5);
  // Instrument only scrolling, not generation/scoring logic.
  await page.evaluate(()=>{window.__resultScrollCalls=0;const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){if(this.matches('.compact-results'))window.__resultScrollCalls++;return original.call(this,options);};});
  await evaluate(c=>{c.selectedList=c.malePlayers1.concat(c.femalePlayers1);c.teamSize=2;c.numberOfTeams=null;c.teamCount=12;c.isActionAllowed=true;c.completeRandom=false;});
  await page.locator('.primary-action').click();await page.waitForFunction(()=>{const c=(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance);return c.scrambleNumber===12&&c.listOfTeams.every(t=>t.kingQueenTeamId>0);});await page.waitForTimeout(650);
  const summary=page.locator('.compact-results'),mainPrint=summary.locator('.results-print-button'),save=summary.getByRole('button',{name:'Save Scramble',exact:true});
  await expect(summary).toHaveCount(1);await expect(page.locator('.generated-matchups')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(save).toBeEnabled();await expect(mainPrint).toBeDisabled();await expect(summary).toContainText('Save this scramble before printing.');
  assert.equal(await summary.evaluate(e=>e.parentElement.previousElementSibling.classList.contains('progression-actions')),true);const placement=await summary.boundingBox(),button=await page.locator('.primary-action').boundingBox();assert(placement.y>=button.y+button.height);assert(placement.y-button.y-button.height<45);await summary.screenshot({path:path.join(out,'desktop-results-unsaved.png')});
  await summary.locator('summary').click();await expect(summary.locator('mat-select').first()).toContainText('6 Matchups');await expect(summary.locator('mat-select').nth(1)).toContainText('5 Rounds');await summary.locator('summary').click();
  await page.setViewportSize({width:390,height:844});await evaluate(c=>c.revealScrambleResults());await page.waitForTimeout(550);const rect=await summary.boundingBox();assert(rect.y>=0&&rect.y+rect.height<=844);const before=await page.evaluate(()=>window.__resultScrollCalls);await evaluate(c=>c.revealScrambleResults());await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__resultScrollCalls),before);await summary.screenshot({path:path.join(out,'mobile-results-unsaved.png')});checks.push('Single summary directly below generate; initial6/5 print settings, mobile results scroll into view only when needed and do not auto-open viewer');
  await summary.getByRole('button',{name:'View Matchups',exact:true}).click();let modal=page.getByRole('dialog');await expect(modal.getByRole('button',{name:'Print Matchups',exact:true})).toBeDisabled();await modal.getByRole('button',{name:'Close matchups',exact:true}).click();failNextSave=true;await save.click();await expect(summary).toContainText('Your changes are retained');await expect(mainPrint).toBeDisabled();await save.click();await expect(summary.getByRole('button',{name:'Saving...',exact:true})).toBeDisabled();await summary.getByRole('button',{name:'Saving...',exact:true}).evaluate(e=>e.click());await expect(summary).toContainText('Teams saved successfully.');await expect(mainPrint).toBeEnabled();await expect(save).toBeDisabled();assert.equal(writes.filter(w=>w.path.includes('/savekingqueenteams/')).length,2);await summary.screenshot({path:path.join(out,'mobile-results-saved.png')});
  await summary.getByRole('button',{name:'Modify Teams',exact:true}).click();modal=page.getByRole('dialog');await modal.locator('select').first().selectOption('2');await expect(mainPrint).toBeDisabled();page.once('dialog',d=>d.accept());await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();await expect(modal.getByRole('button',{name:'Print Matchups',exact:true})).toBeEnabled();await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await modal.locator('select').first().selectOption('2');failNextSave=true;await modal.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(modal).toContainText('Your changes are retained');await expect(mainPrint).toBeDisabled();await modal.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(modal).toContainText('Teams saved successfully.');await expect(modal.getByRole('button',{name:'Print Matchups',exact:true})).toBeEnabled();await modal.getByRole('button',{name:'Close matchups',exact:true}).click();checks.push('Main and modal share saved state: failure stays unsaved, repeated clicks post once, successful save enables print, assignment edits disable it, cancel restores known saved state, retry saves existing IDs');
  await evaluate(c=>c.requestRetrieveScramble({id:211,scrambleNumber:12}));await page.waitForFunction(()=>!(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).scoreEditorLoading);await page.waitForTimeout(500);await expect(mainPrint).toBeEnabled();await expect(summary).toContainText('Scramble saved. Ready to print.');
  // Exercise eight pairs, long names and a substitute using fixture-only objects.
  await evaluate(c=>{const extra=[13,14,15,16].map(number=>({players:[{id:3000+number*2,firstName:'Alexandria',lastName:'Long-Hyphenated-Synthetic',isMale:true,isSub:true},{id:3001+number*2,firstName:'Synthetic',lastName:'AnotherLongName',isMale:false,isSub:false}],maleCount:1,femaleCount:1,kingQueenTeamId:4000+number,sortingId:number,kingQueenRoundScores:[],scrambleNumber:12}));c.listOfTeams=c.listOfTeams.concat(extra);c.rememberSavedTeams();});
  await summary.getByRole('button',{name:'View Matchups',exact:true}).click();modal=page.getByRole('dialog');await expect(modal.locator('mat-card')).toHaveCount(8);await expect(modal).toContainText('Long-Hyphenated-Synthetic - Sub');
  const metrics=[];for(const [width,height] of [[375,667],[390,844],[430,700],[390,550]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);const m=await modal.evaluate(root=>{const content=root.querySelector('mat-dialog-content'),box=content.getBoundingClientRect(),header=root.querySelector('header').getBoundingClientRect(),footer=root.querySelector('mat-dialog-actions').getBoundingClientRect(),cards=Array.from(content.querySelectorAll('mat-card'));return {width:innerWidth,height:innerHeight,contentWidth:content.clientWidth,scrollWidth:content.scrollWidth,headerTop:header.top,footerBottom:footer.bottom,columns:cards.filter(card=>Math.abs(card.getBoundingClientRect().top-cards[0].getBoundingClientRect().top)<1).length,outside:Array.from(content.querySelectorAll('mat-card,.col-5,.col-1,table,td,select,input')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<box.left-1||r.right>box.right+1);}).map(e=>e.tagName),scrollable:Array.from(root.querySelectorAll('*')).filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1).map(e=>e.tagName)};});metrics.push(m);assert.equal(m.scrollWidth,m.contentWidth);assert.deepEqual(m.outside,[]);assert.equal(m.columns,1);assert(m.headerTop>=0&&m.footerBottom<=height+1);assert.deepEqual(m.scrollable,['MAT-DIALOG-CONTENT']);await modal.locator('.viewer-match-number').last().scrollIntoViewIfNeeded();await expect(modal.locator('.viewer-match-number').last()).toBeInViewport();await modal.locator('mat-dialog-content').evaluate(e=>e.scrollTop=e.scrollHeight);await expect(modal.locator('.viewer-bye-players')).toBeInViewport();await modal.locator('mat-dialog-content').evaluate(e=>e.scrollTop=0);if(height>550)await modal.screenshot({path:path.join(out,'mobile-view-'+width+'.png')});}
  await page.setViewportSize({width:375,height:667});await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await modal.locator('select').first().selectOption('2');assert.equal(await modal.locator('mat-dialog-content').evaluate(e=>e.scrollWidth>e.clientWidth),false);await modal.screenshot({path:path.join(out,'mobile-edit-375.png')});page.once('dialog',d=>d.accept());await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();
  for(const width of [1366,1920]){await page.setViewportSize({width,height:900});const cols=await modal.locator('mat-card').evaluateAll(cards=>cards.filter(c=>Math.abs(c.getBoundingClientRect().top-cards[0].getBoundingClientRect().top)<1).length);assert.equal(cols,2);await modal.screenshot({path:path.join(out,'desktop-view-'+width+'.png')});}await modal.getByRole('button',{name:'Close matchups',exact:true}).click();fs.writeFileSync(path.join(out,'after-layout.json'),JSON.stringify(metrics,null,2));checks.push('Eight pairs and long/substitute names remain side by side in one-column phone cards, no off-content descendants or horizontal scroll, only card content scrolls, header/footer fit smaller viewport; desktop retains two columns');
  await summary.locator('summary').click();await summary.locator('mat-select').first().click();await page.getByRole('option',{name:'4 Matchups',exact:true}).click();await summary.locator('mat-select').nth(1).click();await page.getByRole('option',{name:'7 Rounds',exact:true}).click();await summary.getByRole('button',{name:'View Matchups',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Close matchups',exact:true}).click();assert.equal(await evaluate(c=>c.selectedMatchupsPerPage),'4');assert.equal(await evaluate(c=>c.selectedRounds),7);
  const printed=await evaluate(c=>{let html='';const old=window.open;window.open=()=>({document:{open(){},write(v){html=v;},close(){}},set onload(fn){}});try{c.printMatchups();}finally{window.open=old;}return html;});assert(printed.includes('Game 7'));assert(!printed.includes('Game 8'));assert(printed.includes('Team A (Team 1)'));await summary.locator('summary').click();await page.getByRole('button',{name:'Hide Setup',exact:true}).click();await expect(page.locator('.scramble-setup')).toBeHidden();await expect(summary).toBeVisible();await page.getByRole('button',{name:'Show Setup',exact:true}).click();await page.getByRole('button',{name:'Hide Results',exact:true}).click();await expect(mainPrint).toBeHidden();await page.getByRole('button',{name:'Show Results',exact:true}).click();await expect(mainPrint).toBeVisible();checks.push('Retrieved state enables print, manual4/7 settings survive viewer use and drive print HTML; Setup/Results visibility controls preserve access to the one summary');
 }else if(mode==='results-refinements-before'){

  await seed();await page.setViewportSize({width:375,height:667});await page.locator('.compact-results').getByRole('button',{name:'View Matchups',exact:true}).click();await page.waitForTimeout(350);const modal=page.getByRole('dialog');
  const metrics=await modal.evaluate(root=>{const outer=root.getBoundingClientRect(),content=root.querySelector('mat-dialog-content'),cr=content.getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},dialog:{width:outer.width,left:outer.left,right:outer.right,height:outer.height,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth},content:{width:cr.width,left:cr.left,right:cr.right,scrollWidth:content.scrollWidth,clientWidth:content.clientWidth},outside:Array.from(content.querySelectorAll('*')).filter(e=>{const r=e.getBoundingClientRect();return r.width&& (r.left<cr.left-1||r.right>cr.right+1);}).slice(0,25).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,minWidth:getComputedStyle(e).minWidth,margin:getComputedStyle(e).margin}))};});fs.writeFileSync(path.join(out,'before-overflow.json'),JSON.stringify(metrics,null,2));await modal.screenshot({path:path.join(out,'mobile-before.png')});checks.push('Read-only original mobile overflow measurements');
 }else if(mode==='matchups-modal'){

  await seed(false);await evaluate(c=>{c.completeRandom=false;});await page.locator('.primary-action').click();
  await page.waitForFunction(()=>{const c=(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance);return c.scrambleNumber===12&&c.listOfTeams.every(t=>t.kingQueenTeamId>0);});
  const summary=page.locator('.compact-results');await expect(summary).toContainText('12 teams');await expect(summary).toContainText('6 matchups');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.generated-matchups')).toHaveCount(0);await expect(summary.getByRole('button',{name:'Print Matchups',exact:true})).toBeDisabled();await summary.screenshot({path:path.join(out,'compact-results-desktop.png')});
  const original=await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id)));const initialWrites=writes.length;
  const opener=summary.getByRole('button',{name:'View Matchups',exact:true});await opener.evaluate(b=>b.addEventListener('click',()=>window.__workspaceOpenerScroll=scrollY,{capture:true,once:true}));await opener.click();let modal=page.getByRole('dialog');await expect(modal).toBeVisible();await expect(modal.locator('.generated-matchups mat-card')).toHaveCount(6);await expect(modal.locator('select')).toHaveCount(0);await expect(modal.locator('.viewer-match-number')).toHaveText(['Match 1','Match 2','Match 3','Match 4','Match 5','Match 6']);assert.equal(writes.length,initialWrites);await page.waitForTimeout(300);await modal.getByRole('button',{name:'Modify Teams',exact:true}).focus();await page.keyboard.press('Shift+Tab');await expect(modal.getByRole('textbox',{name:'Court',exact:true}).last()).toBeFocused();await page.keyboard.press('Tab');await expect(modal.getByRole('button',{name:'Modify Teams',exact:true})).toBeFocused();
  for(const width of [1366,1920]){await page.setViewportSize({width,height:900});const boxes=await modal.locator('.generated-matchups mat-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width}}));assert.equal(boxes.filter(b=>b.y===boxes[0].y).length,2);assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);await modal.screenshot({path:path.join(out,'view-desktop-'+width+'.png')});}
  const scroll=await page.evaluate(()=>({atClick:window.__workspaceOpenerScroll,blockedCssTop:document.documentElement.style.top}));await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);fs.writeFileSync(path.join(out,'scroll-restoration.json'),JSON.stringify({...scroll,afterClose:await page.evaluate(()=>scrollY)},null,2));await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(scroll.atClick);await expect(summary.getByRole('button',{name:'View Matchups',exact:true})).toBeFocused();checks.push('Real generation produces compact summary without automatic modal/grid; viewer has all six original pairs, two columns on desktop, focus/scroll restoration and no viewing writes');
  await summary.getByRole('button',{name:'Modify Teams',exact:true}).click();modal=page.getByRole('dialog');await expect(modal.locator('select')).toHaveCount(24);await modal.locator('select').first().selectOption('2');assert.equal(await evaluate(c=>c.teamEditsPending),true);
  page.once('dialog',d=>d.dismiss());await modal.getByRole('button',{name:'Close matchups',exact:true}).click();await expect(modal).toBeVisible();assert.equal(await evaluate(c=>c.teamEditsPending),true);
  page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');await expect(modal).toBeVisible();
  page.once('dialog',d=>d.dismiss());await page.locator('.cdk-overlay-backdrop.cdk-overlay-backdrop-showing').last().click({position:{x:2,y:2}});await expect(modal).toBeVisible();
  page.once('dialog',d=>d.accept());await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();assert.deepEqual(await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id))),original);await expect(modal.locator('select')).toHaveCount(0);
  await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await modal.locator('select').first().selectOption('2');const modified=await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id)));const noDuplicateWrites=writes.length;await evaluate(c=>c.listOfTeams[1].players.push(c.listOfTeams[0].players[0]));await modal.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(modal).toContainText('A player cannot be assigned to more than one team.');assert.equal(writes.length,noDuplicateWrites);await evaluate(c=>c.listOfTeams[1].players.pop());failNextSave=true;await modal.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(modal).toContainText('Your changes are retained');await expect(modal.locator('select')).toHaveCount(24);assert.deepEqual(await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id))),modified);
  await modal.getByRole('textbox',{name:'Court',exact:true}).first().fill('7');const n=writes.filter(w=>w.path.includes('/savekingqueenteams/')).length;await modal.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(modal.getByRole('button',{name:'Saving Teams...',exact:true})).toBeDisabled();await modal.getByRole('button',{name:'Saving Teams...',exact:true}).evaluate(b=>b.click());await expect(modal).toContainText('Teams saved successfully.');await expect(modal.locator('select')).toHaveCount(0);await expect(modal.getByRole('textbox',{name:'Court',exact:true}).first()).toHaveValue('7');assert.equal(writes.filter(w=>w.path.includes('/savekingqueenteams/')).length,n+1);const posted=writes.filter(w=>w.path.includes('/savekingqueenteams/')).pop().data;assert(posted.kingQueenTeams.every(t=>t.kingQueenTeam.id>0));checks.push('Generated assignments use staged original state, cancel/close/Escape confirmations, save failure retains edit mode and one stable-ID save returns view mode');
  await modal.getByRole('button',{name:'Close matchups',exact:true}).click();await summary.getByRole('button',{name:'View Matchups',exact:true}).click();await expect(modal.getByRole('textbox',{name:'Court',exact:true}).first()).toHaveValue('7');await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await modal.getByRole('textbox',{name:'Court',exact:true}).first().fill('8');page.once('dialog',d=>d.accept());await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();await expect(modal.getByRole('textbox',{name:'Court',exact:true}).first()).toHaveValue('7');await modal.getByRole('button',{name:'Close matchups',exact:true}).click();
  await evaluate(c=>c.requestRetrieveScramble({id:211,scrambleNumber:12}));await page.waitForFunction(()=>!(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).scoreEditorLoading);await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(await evaluate(c=>c.listOfTeams[0].kingQueenTeamId),211);
  await summary.getByRole('button',{name:'Modify Teams',exact:true}).click();modal=page.getByRole('dialog');await modal.locator('select').first().selectOption('2');const retrievedDraft=await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id)));await modal.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(modal).toContainText('Teams saved successfully.');await modal.getByRole('button',{name:'Close matchups',exact:true}).click();await evaluate(c=>c.requestRetrieveScramble({id:211,scrambleNumber:12}));await page.waitForFunction(()=>!(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).scoreEditorLoading);assert.deepEqual(await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id))),retrievedDraft);
  await summary.getByRole('button',{name:'View Matchups',exact:true}).click();await evaluate(c=>c.requestRetrieveScramble({id:1211,scrambleNumber:13}));await page.waitForFunction(()=>{const c=(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance);return !c.scoreEditorLoading&&c.listOfTeams[0].kingQueenTeamId===1211;});await expect(page.getByRole('dialog')).toContainText('Scramble 13');checks.push('Retrieved stable-ID assignments save/reload through fixture; retrieving another scramble while viewing uses current objects, identifier and pairings without stale modal state');
  modal=page.getByRole('dialog');for(const width of [375,390,430]){await page.setViewportSize({width,height:844});await expect(modal.locator('mat-card')).toHaveCount(6);const boxes=await modal.locator('.generated-matchups mat-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y}}));assert(boxes[1].y>boxes[0].y);assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);await modal.screenshot({path:path.join(out,'view-mobile-'+width+'.png')});}
  await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await modal.locator('select').first().selectOption('2');await modal.screenshot({path:path.join(out,'edit-mobile-430.png')});const draft=await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id)));page.once('dialog',d=>d.dismiss());await evaluate(c=>c.requestRetrieveScramble({id:211,scrambleNumber:12}));assert.deepEqual(await evaluate(c=>c.listOfTeams.map(t=>t.players.map(p=>p.id))),draft);page.once('dialog',d=>d.accept());await modal.getByRole('button',{name:'Cancel Changes',exact:true}).click();await modal.getByRole('button',{name:'Close matchups',exact:true}).click();checks.push('Mobile one-card rows, usable assignment controls/no overflow at375/390/430, same modal modes and unsaved transition confirmation');
  await page.setViewportSize({width:1366,height:900});await summary.locator('summary').click();await expect(summary.locator('.results-print-controls')).toBeVisible();
  const prints={};for(const count of ['2','4','6']){await evaluate((c,n)=>{c.selectedMatchupsPerPage=n;c.selectedRounds=5;},count);let html=await evaluate(c=>{let h='';const old=window.open;window.open=()=>({document:{open(){},write(v){h=v;},close(){}},set onload(fn){}});try{c.printMatchups();}finally{window.open=old;}return h;});assert(html.includes('Synthetic'));assert(!html.includes('Modify Teams'));assert(!html.includes('Cancel Changes'));const rendered=await context.newPage();await rendered.emulateMedia({media:'print'});await rendered.setContent(html);await rendered.screenshot({path:path.join(out,'print-'+count+'.png'),fullPage:true});const pdf=await rendered.pdf({path:path.join(out,'print-'+count+'.pdf'),format:'A4',printBackground:true});prints[count]={pages:(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,htmlHash:hash(html)};await rendered.close();await summary.getByRole('button',{name:'View Matchups',exact:true}).click();const openHtml=await evaluate(c=>{let h='';const old=window.open;window.open=()=>({document:{open(){},write(v){h=v;},close(){}},set onload(fn){}});try{c.printMatchups();}finally{window.open=old;}return h;});assert.equal(openHtml,html);await page.getByRole('dialog').getByRole('button',{name:'Close matchups',exact:true}).click();}
  fs.writeFileSync(path.join(out,'print-results.json'),JSON.stringify(prints,null,2));checks.push('Actual print method renders all matchups at2/4/6 per page into PDF/screenshots; identical HTML with dialog closed/open, original round count and no modal controls');
  await page.getByRole('button',{name:'Hide Results',exact:true}).click();await expect(summary.getByRole('button',{name:'View Matchups',exact:true})).toBeHidden();await page.getByRole('button',{name:'Show Results',exact:true}).click();await page.getByRole('button',{name:'Hide Player List',exact:true}).click();await expect(page.locator('#playerListHidden')).toBeHidden();await page.getByRole('button',{name:'Show Player List',exact:true}).click();await expect(page.locator('.scramble-setup')).toBeVisible();await expect(page.getByRole('button',{name:/Hide Setup|Show Setup/})).toHaveCount(0);const rules=page.getByRole('button',{name:/Scramble Rules/});await rules.click();await expect(rules).toHaveAttribute('aria-expanded','true');await rules.click();await expect(rules).toHaveAttribute('aria-expanded','false');checks.push('Results and Player List disclosures retain state; setup stays visible and only Scramble Rules collapses.');
  await evaluate(c=>c.byePlayers=[]);const prior=JSON.parse(fs.readFileSync(printBaselinePath,'utf8')),current=await printOutputs('compatibility');for(const count of ['2','4','6']){assert.equal(current[count].pixels,prior[count].pixels,'Original print pixels '+count);assert.equal(current[count].pages,prior[count].pages,'Original print page count '+count);}fs.writeFileSync(path.join(out,'original-print-comparison.json'),JSON.stringify({prior,current,pixelsIdentical:true},null,2));checks.push('Original print baseline pixel and PDF page-count comparison passed for2/4/6 per page');
 }else if(mode==='scoring-auto-winners'){

  await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();
  const editor=page.locator('.score-editor-card');
  await editor.locator('mat-select').first().click();await page.getByRole('option',{name:/Scramble 12 /}).click();
  await expect(editor.locator('.desktop-matchup-editor')).toHaveCount(6);
  assert.equal(await evaluate(c=>c.getScore(211,1).roundWon),false);assert.equal(await evaluate(c=>c.getScore(218,1).roundWon),true);
  await expect(editor.locator('input[type=checkbox][aria-label$=" won"]')).toHaveCount(0);
  checks.push('Saved numeric scores override stale manual win flags on load; no manual Won checkboxes remain');
  const desktop=editor.locator('.desktop-score-editor'),mobile=editor.locator('.mobile-score-editor');
  const input=(root,id,round)=>root.getByRole('spinbutton',{name:'Team '+id+' Round '+round+' score',exact:true});
  await input(desktop,1,1).fill('20');await input(desktop,2,1).fill('13');
  await expect(input(desktop,1,1)).toHaveClass(/round-score-winner/);await expect(input(desktop,2,1)).not.toHaveClass(/round-score-winner/);
  assert.equal(await evaluate(c=>c.calculateTotalWins(211)),1);
  await input(desktop,2,1).fill('21');assert.equal(await evaluate(c=>c.getScore(211,1).roundWon),false);assert.equal(await evaluate(c=>c.getScore(218,1).roundWon),true);
  await input(desktop,1,1).fill('21');assert.equal(await evaluate(c=>c.getScore(211,1).roundWon||c.getScore(218,1).roundWon),false);
  await input(desktop,1,1).fill('');await input(desktop,2,1).fill('0');assert.equal(await evaluate(c=>c.getScore(211,1).roundScore),null);assert.equal(await evaluate(c=>c.getScore(211,1).roundWon||c.getScore(218,1).roundWon),false);
  await input(desktop,1,1).fill('1');assert.equal(await evaluate(c=>c.getScore(211,1).roundWon),true);
  await input(desktop,1,1).fill('0');assert.equal(await evaluate(c=>c.getScore(211,1).roundWon||c.getScore(218,1).roundWon),false);
  checks.push('Desktop edits update both winners/totals immediately; higher score wins, ties award neither, blanks differ from genuine zero');
  await page.setViewportSize({width:390,height:844});await input(mobile,1,1).fill('9');await input(mobile,2,1).fill('20');await expect(input(mobile,2,1)).toHaveClass(/round-score-winner/);
  await mobile.getByRole('button',{name:'Next Match',exact:true}).click();await mobile.getByRole('button',{name:'Previous Match',exact:true}).click();await expect(input(mobile,1,1)).toHaveValue('9');await expect(input(mobile,2,1)).toHaveValue('20');
  await mobile.screenshot({path:path.join(out,'automatic-winners-mobile-390.png')});
  await page.setViewportSize({width:1366,height:900});await expect(input(desktop,2,1)).toHaveValue('20');await expect(input(desktop,2,1)).toHaveClass(/round-score-winner/);
  checks.push('Mobile uses identical win state, highlights winners and preserves values through match navigation and desktop resize');
  await evaluate(c=>{c.selectedRounds=10;c.initializeRounds();c.listOfTeams.forEach((t,index)=>{for(let r=1;r<=10;r++)c.updateRoundScore(t.kingQueenTeamId,r,index%2===0?20:12);});});
  await expect(desktop.locator('input[type=number]')).toHaveCount(120);assert.equal(await evaluate(c=>c.calculateTotalWins(211)),10);assert.equal(await evaluate(c=>c.calculateTotalWins(218)),0);
  await desktop.screenshot({path:path.join(out,'automatic-winners-desktop-1366.png')});
  await evaluate(c=>c.kingQueenRoundScores.forEach(row=>row.roundWon=!row.roundWon)); // Save must recompute, never trust stale flags.
  const before=scoreSaveRequests;await editor.getByRole('button',{name:'Save Round Scores',exact:true}).click();await expect(editor.getByText('Round scores saved successfully.',{exact:true})).toBeVisible();assert.equal(scoreSaveRequests,before+1);
  const payload=writes.filter(w=>w.path.includes('/savekingqueenroundscores/')).pop().data.roundScores;assert.equal(payload.length,120);assert(payload.every(row=>row.roundWon===(((row.kingQueenTeamId-211)/7)%2===0)));
  await evaluate(c=>c.retrieveScramble(c.scoringScramble));await expect(editor.getByText('Round scores saved successfully.',{exact:true})).toHaveCount(0);await page.waitForFunction(()=>!(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).scoreEditorLoading);assert.equal(await evaluate(c=>c.calculateTotalWins(211)),10);
  checks.push('Ten rounds remain usable; one whole-scramble save recomputes all 120 existing winner fields and saved fixture reload restores winners');
  await evaluate(c=>{c.listOfTeams=c.listOfTeams.slice(0,11);c.recalculateRoundWinners();});assert.equal(await evaluate(c=>c.kingQueenRoundScores.filter(row=>row.kingQueenTeamId===281).some(row=>row.roundWon)),false);
  fixtureEmpty=false;page.once('dialog',dialog=>dialog.accept());await editor.locator('mat-select').first().click();await page.getByRole('option',{name:/Scramble 14 /}).click();await page.waitForFunction(()=>{const c=(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance);return c.scoringScramble&&c.scoringScramble.scrambleNumber===14&&!c.scoreEditorLoading;});
  assert.equal(await evaluate(c=>c.kingQueenRoundScores.every(row=>row.roundScore===null&&!row.roundWon)),true);
  checks.push('Unmatched teams get no invented win; completely unscored scrambles initialize blank with no winners');
 }else if(mode==='scoring-desktop'){

  await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();const editor=page.locator('.score-editor-card'),desktop=editor.locator('.desktop-score-editor'),picker=editor.locator('mat-select').first(),roundPicker=editor.locator('mat-select').nth(1);await picker.click();await page.getByRole('option',{name:/Scramble 12 /}).click();await expect(desktop.locator('.desktop-matchup-editor')).toHaveCount(6);const card=desktop.locator('.desktop-matchup-editor').first();
  const metrics=[];for(const width of [1366,1920]){await page.setViewportSize({width,height:1080});await page.evaluate(()=>document.fonts.ready);const boxes=await desktop.locator('.desktop-matchup-editor').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width}}));const columns=boxes.filter(box=>box.y===boxes[0].y).length;assert.equal(columns,width===1366?2:3);assert(boxes.every(box=>box.width>=460));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await expect(desktop.getByRole('button',{name:'Previous Match'})).toHaveCount(0);await expect(desktop.getByRole('button',{name:'Next Match'})).toHaveCount(0);await expect(editor.getByRole('button',{name:'Save Round Scores',exact:true})).toHaveCount(1);await editor.screenshot({path:path.join(out,'desktop-grid-'+width+'.png')});metrics.push({width,columns,cardWidths:boxes.map(box=>box.width)});}
  assert.deepEqual(await desktop.locator('h3').allTextContents(),['Match 1','Match 2','Match 3','Match 4','Match 5','Match 6']);assert.deepEqual(await card.locator('tbody tr').evaluateAll(rows=>rows.map(row=>Number(row.dataset.teamId))),[211,218]);await expect(desktop.locator('.desktop-score-player')).toHaveCount(24);await expect(desktop.locator('mat-slide-toggle')).toHaveCount(24);checks.push('Two cards per row at1366, three at1920; all six original pairs,24 names/sub controls, no desktop previous/next or overflow, one visible whole-scramble save');
  await roundPicker.click();await page.getByRole('option',{name:'10 Rounds',exact:true}).click();await expect(card.locator('table')).toHaveCount(2);assert.deepEqual(await card.locator('caption').allTextContents(),['Rounds 1 - 5','Rounds 6 - 10']);await expect(desktop.getByRole('spinbutton')).toHaveCount(120);
  for(const width of [1366,1920]){await page.setViewportSize({width,height:1080});const safe=await desktop.locator('.desktop-round-group').evaluateAll(groups=>groups.every(g=>g.scrollWidth<=g.clientWidth));assert(safe);const inputs=await desktop.locator('input[type=number]').evaluateAll(nodes=>nodes.every(e=>{const r=e.getBoundingClientRect(),cell=e.closest('td').getBoundingClientRect();return r.width>=50&&r.height>=32&&r.left>=cell.left&&r.right<=cell.right;}));if(!inputs)console.log(JSON.stringify(await desktop.locator('input[type=number]').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect(),cell=e.closest('td').getBoundingClientRect();return{label:e.getAttribute('aria-label'),width:r.width,height:r.height,left:r.left,right:r.right,cellLeft:cell.left,cellRight:cell.right};}).filter(r=>r.width<50||r.height<32||r.left<r.cellLeft||r.right>r.cellRight))));assert(inputs);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await editor.screenshot({path:path.join(out,'desktop-grid-10-rounds-'+width+'.png')});}checks.push('Ten rounds use two five-round groups per card,120 comfortable inputs and no overlapping cells/card/page overflow');
  const first=card.getByRole('spinbutton',{name:'Team 1 Round 1 score',exact:true});await first.focus();await page.keyboard.press('Tab');await expect(card.getByRole('spinbutton',{name:'Team 1 Round 2 score',exact:true})).toBeFocused();await first.fill('29');await card.getByRole('spinbutton',{name:'Team 2 Round 10 score',exact:true}).fill('27');await card.locator('mat-slide-toggle').first().click();await expect.poll(()=>savedSubs.get('211:1001')).toBe(true);
  await page.setViewportSize({width:390,height:844});const mobile=editor.locator('.mobile-score-editor');await expect(mobile.getByRole('spinbutton',{name:'Team 1 Round 1 score',exact:true})).toHaveValue('29');await expect(mobile.getByRole('spinbutton',{name:'Team 2 Round 10 score',exact:true})).toHaveValue('27');await expect(mobile.getByRole('spinbutton',{name:'Team 2 Round 10 score',exact:true})).not.toHaveClass(/round-score-winner/);await expect(mobile.locator('mat-slide-toggle').first().locator('input')).toBeChecked();await mobile.getByRole('spinbutton',{name:'Team 1 Round 1 score',exact:true}).fill('30');await page.setViewportSize({width:1920,height:1080});await expect(first).toHaveValue('30');checks.push('Keyboard Tab follows successive scores; desktop/mobile resizing preserves shared values, automatic win flags and immediate substitute setting');
  await desktop.locator('input[type=number]').evaluateAll(inputs=>inputs.forEach(input=>{if(input.value===''){input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));}}));await editor.getByRole('button',{name:'Save Round Scores',exact:true}).click();await expect(editor).toContainText('Round scores saved successfully');assert.equal(scoreSaveRequests,1);const payload=writes.find(write=>write.path.includes('/savekingqueenroundscores/')).data;assert.equal(payload.roundScores.length,120);assert.equal(new Set(payload.roundScores.map(row=>row.kingQueenTeamId)).size,12);assert.equal(await evaluate(c=>c.kingQueenRoundScores.every(row=>row.id>0)),true);checks.push('One desktop Save posts all120 round records for all12 teams using existing payload and confirms refreshed saved IDs');fs.writeFileSync(path.join(out,'desktop-grid-metrics.json'),JSON.stringify(metrics,null,2));
 }else if(mode==='scoring-capture'){
  await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();const editor=page.locator('.score-editor-card');await editor.locator('mat-select').first().click();await page.getByRole('option',{name:/Scramble 12 /}).click();const mobile=editor.locator('.mobile-score-editor');await expect(mobile.locator('.mobile-score-players')).toHaveAttribute('open','');await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);await editor.locator('mat-select').first().click();await page.locator(':is(.mat-select-panel,.mat-mdc-select-panel)').screenshot({path:path.join(out,'mobile-scramble-dropdown.png')});await page.keyboard.press('Escape');await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);await editor.locator('div.tab-content').first().screenshot({path:path.join(out,'mobile-scramble-selection.png')});await mobile.locator('.mobile-score-players').screenshot({path:path.join(out,'mobile-rosters-default-open.png')});await mobile.locator('.mobile-score-navigation').screenshot({path:path.join(out,'mobile-match-navigation.png')});await mobile.locator('.mobile-score-grid').screenshot({path:path.join(out,'mobile-comparative-grid.png')});await mobile.locator('.mobile-score-save').screenshot({path:path.join(out,'mobile-save-area.png')});await mobile.locator('summary').click();await expect(mobile.locator('.mobile-score-players')).not.toHaveAttribute('open','');await editor.screenshot({path:path.join(out,'mobile-rosters-collapsed.png')});checks.push('Read-only captures of selector, default-open rosters above scores, collapse, navigation, comparative grid and save action');assert.equal(writes.length,0);
 }else if(mode==='scoring-empty'){
  await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();const editor=page.locator('.score-editor-card'),mobile=editor.locator('.mobile-score-editor'),selector=editor.locator('mat-select').first();await selector.click();await page.getByRole('option',{name:/Scramble 14 /}).click();await expect(mobile.locator('.mobile-score-grid tbody tr')).toHaveCount(5);await expect(mobile.getByRole('spinbutton').first()).toHaveValue('');await evaluate(c=>c.listOfTeams.forEach(team=>c.rounds.forEach(round=>c.updateRoundScore(team.kingQueenTeamId,round,0))));await mobile.getByRole('button',{name:'Save Round Scores',exact:true}).click();await expect(editor).toContainText('Round scores saved successfully');assert.equal(scoreSaveRequests,1);assert.equal(await evaluate(c=>c.kingQueenRoundScores.length),60);assert.equal(await evaluate(c=>c.kingQueenRoundScores.every(row=>row.id>0)),true);fixtureEmpty=true;await selector.click();await page.getByRole('option',{name:/Scramble 13 /}).click();await expect(mobile).toContainText('No teams were returned');await expect(mobile.locator('.mobile-score-navigation')).toHaveCount(0);await expect(mobile.getByRole('button',{name:'Save Round Scores',exact:true})).toBeDisabled();checks.push('Unscored scramble starts blank and accepts explicit five-round zero/tie scores, saves all60 rows and refreshes IDs; empty saved-team response stays explicit and disables save');
 }else if(mode==='scoring-after'){
  await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();const editor=page.locator('.score-editor-card');const mobile=editor.locator('.mobile-score-editor');const selector=editor.locator('mat-select').first();const roundSelector=editor.locator('mat-select').nth(1);
  async function pick(number){await selector.click();await page.getByRole('option',{name:new RegExp('Scramble '+number+' ')}).click();}
  await pick(12);await expect(selector).toContainText('Scramble 12');assert.equal(await evaluate(c=>c.listOfTeams.length),12);assert.equal(await evaluate(c=>c.selectedRounds),3);
  for(const width of [1366,1920]){await page.setViewportSize({width,height:900});await expect(editor.locator('.desktop-score-editor')).toBeVisible();await expect(mobile).not.toBeVisible();await expect(editor.locator('.desktop-score-editor table')).toHaveCount(6);await expect(editor.locator('.desktop-matchup-editor')).toHaveCount(6);await editor.screenshot({path:path.join(out,'desktop-after-'+width+'.png')});}
  for(const width of [375,390,430]){await page.setViewportSize({width,height:844});await expect(mobile).toBeVisible();await expect(editor.locator('.desktop-score-editor')).not.toBeVisible();await expect(mobile.locator('.mobile-score-grid tbody tr')).toHaveCount(3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const image=await editor.screenshot({path:path.join(out,'mobile-editor-'+width+'.png')});}
  const score=(team,round)=>mobile.getByRole('spinbutton',{name:'Team '+team+' Round '+round+' score',exact:true});
  await expect(mobile.getByRole('button',{name:'Previous Match'})).toBeDisabled();await score(1,1).fill('17');await score(2,1).fill('23');await expect(score(1,2)).toHaveValue('');await score(1,2).fill('8');await expect(mobile.locator('.mobile-scoring-totals')).toContainText('25');const beforeWrites=writes.length;await mobile.getByRole('button',{name:'Next Match'}).click();await expect(mobile).toContainText('Match 2 of 6');await score(3,1).fill('31');await mobile.getByRole('button',{name:'Previous Match'}).click();await expect(score(1,1)).toHaveValue('17');await expect(score(1,2)).not.toHaveClass(/round-score-winner/);await expect(score(2,1)).toHaveValue('23');assert.equal(writes.length,beforeWrites);await editor.screenshot({path:path.join(out,'mobile-returned-unsaved.png')});await page.setViewportSize({width:1366,height:900});const desktopFirst=editor.locator('.desktop-score-editor table').first();await expect(desktopFirst.locator('input[type=number]').first()).toHaveValue('17');await desktopFirst.locator('input[type=number]').first().fill('18');await page.setViewportSize({width:390,height:844});await expect(score(1,1)).toHaveValue('18');await score(1,1).fill('17');assert.deepEqual(await mobile.locator('.mobile-score-grid tbody tr').first().locator('td').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.teamId))),[211,218]);checks.push('Saved response order/stable IDs form six original pairs; existing/blank rounds preserved, numeric/win editing and live totals share state with desktop, no navigation writes');
  await expect(mobile.locator('.mobile-score-players')).toHaveAttribute('open','');const rosterBox=await mobile.locator('.mobile-score-players').boundingBox(),gridBox=await mobile.locator('.mobile-score-grid').boundingBox();assert(rosterBox.y<gridBox.y);await mobile.locator('summary').click();await expect(mobile.locator('.mobile-score-players')).not.toHaveAttribute('open','');await mobile.locator('summary').click();const sub=mobile.locator('mat-slide-toggle').first();await sub.click();await expect(sub.locator('input')).toBeChecked();assert.equal(savedSubs.get('211:1001'),true);fixtureSubFailure=true;await sub.click();await expect(sub.locator('input')).toBeChecked();await expect(editor).toContainText('switch was restored');await editor.screenshot({path:path.join(out,'mobile-player-sub-settings.png')});checks.push('Original player order and per-team player Sub Score API persist immediately, with visible feedback and rollback on failure');
  await roundSelector.click();await page.getByRole('option',{name:'4 Rounds',exact:true}).click();await score(1,4).fill('5');await roundSelector.click();await page.getByRole('option',{name:'2 Rounds',exact:true}).click();await expect(editor).toContainText('hidden rounds are retained');await roundSelector.click();await page.getByRole('option',{name:'4 Rounds',exact:true}).click();await expect(score(1,4)).toHaveValue('5');await expect(score(1,1)).toHaveValue('17');checks.push('Changing displayed rounds retains entered values/flags and exposes hidden-round retention notice without deleting saved rounds');
  await evaluate(c=>c.listOfTeams.forEach(team=>c.rounds.forEach(round=>{const row=c.getScore(team.kingQueenTeamId,round);if(!row||row.roundScore===null)c.updateRoundScore(team.kingQueenTeamId,round,0);})));
  fixtureScoreFailure=true;await mobile.getByRole('button',{name:'Save Round Scores',exact:true}).click();await expect(editor).toContainText('Your entries are retained');await expect(score(1,1)).toHaveValue('17');await mobile.getByRole('button',{name:'Save Round Scores',exact:true}).click();await expect(mobile.getByRole('button',{name:'Saving...',exact:true})).toBeDisabled();await mobile.getByRole('button',{name:'Saving...',exact:true}).evaluate(button=>button.click());await expect(editor).toContainText('Round scores saved successfully');assert.equal(scoreSaveRequests,2);const submissions=writes.filter(w=>w.path.includes('savekingqueenroundscores'));assert.equal(new Set(submissions[1].data.roundScores.map(r=>r.kingQueenTeamId)).size,12);assert.equal(await evaluate(c=>c.kingQueenRoundScores.every(row=>row.id>0)),true);await expect(selector).toContainText('Scramble 12');await editor.screenshot({path:path.join(out,'mobile-save-success.png')});const storedCount=Array.from(savedScores.values()).reduce((total,rows)=>total+rows.length,0);await mobile.getByRole('button',{name:'Save Round Scores',exact:true}).click();await expect(editor).toContainText('Round scores saved successfully');await expect(mobile.getByRole('button',{name:'Save Round Scores',exact:true})).toBeEnabled();assert.equal(Array.from(savedScores.values()).reduce((total,rows)=>total+rows.length,0),storedCount);checks.push('Failure keeps edits, retry saves all12 teams with original payload, double click blocked, saved IDs refreshed, repeated save does not duplicate new fixture rows');
  fixtureReadFailure=true;await mobile.getByRole('button',{name:'Save Round Scores',exact:true}).click();await expect(editor).toContainText('saved records could not be refreshed');await expect(mobile.getByRole('button',{name:'Save Round Scores',exact:true})).toBeDisabled();const requestsBeforeRefresh=scoreSaveRequests;await editor.getByRole('button',{name:'Refresh Saved Records',exact:true}).click();await expect(mobile.getByRole('button',{name:'Save Round Scores',exact:true})).toBeEnabled();assert.equal(scoreSaveRequests,requestsBeforeRefresh);checks.push('Post-save read failure blocks unsafe resubmission; ID refresh recovers without another write');
  await score(1,1).fill('42');page.once('dialog',dialog=>dialog.dismiss());await pick(13);await expect(selector).toContainText('Scramble 12');await expect(score(1,1)).toHaveValue('42');page.once('dialog',dialog=>dialog.dismiss());await evaluate(c=>c.leagueService.setSelectedLeague(102));assert.equal(await evaluate(c=>c.leagueId),101);await expect(score(1,1)).toHaveValue('42');page.once('dialog',dialog=>dialog.dismiss());await evaluate(c=>c.scramblePlayers(false));await expect(score(1,1)).toHaveValue('42');checks.push('Canceling scramble, generation or league change preserves selected scramble and all unsaved entries');
  fixtureOdd=true;page.once('dialog',dialog=>dialog.accept());await pick(13);await expect(selector).toContainText('Scramble 13');for(let index=0;index<5;index++)await mobile.getByRole('button',{name:'Next Match'}).click();await expect(mobile).toContainText('Match 6 of 6');await expect(mobile.getByRole('button',{name:'Next Match'})).toBeDisabled();await expect(mobile).toContainText('no paired opponent');await expect(mobile).toContainText('Synthetic Bye');await expect(mobile.locator('.mobile-score-grid tbody tr').first().getByRole('spinbutton')).toHaveCount(1);await editor.screenshot({path:path.join(out,'mobile-unmatched-team.png')});checks.push('Confirmed scramble change loads new saved IDs; unmatched final team and bye data stay visible with no invented opponent');
  fixtureOdd=false;await pick(12);await expect(score(1,1)).toHaveValue('17');assert.equal(Number(await evaluate(c=>c.getScore(c.listOfTeams[2].kingQueenTeamId,1).roundScore)),31);await expect(mobile.locator('.mobile-score-players')).toHaveAttribute('open','');await expect(mobile.locator('mat-slide-toggle').first().locator('input')).toBeChecked();checks.push('Retrieving the saved scramble refreshes all persisted fixture scores/sub flags and preserves original stable associations');
  await score(1,1).fill('43');page.once('dialog',dialog=>dialog.accept());await evaluate(c=>c.leagueService.setSelectedLeague(102));assert.equal(await evaluate(c=>c.leagueId),102);await expect(mobile).toHaveCount(0);checks.push('Confirmed league change clears old scoring context without showing prior-league teams');
 }else if(mode==='scoring-before'){
  await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();const editor=page.getByText('Select Scramble to Retrieve',{exact:true}).locator('..').locator('..');await editor.locator('mat-select').first().click();await page.getByRole('option',{name:/Scramble 12 /}).click();await page.waitForFunction(()=>(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).listOfTeams.length===12);for(const width of [1366,1920]){await page.setViewportSize({width,height:900});await editor.screenshot({path:path.join(out,'desktop-before-'+width+'.png')});}checks.push('Desktop Manage Scores baseline captured using original tables and fixture retrieval');
 }else if(mode.startsWith('management-layout')){
  const before=mode.endsWith('before'),label=before?'before':'after',labels=['Modify Settings','Add Player','Delete Player','Add League','Add Division'];
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name:'League Management',exact:true}).click();await expect(page.locator('.league-management-page')).toBeVisible();
  await evaluate(c=>{c.dropLowest=2;c.numberOfSubsAllowed=3;c.subScorePercent=80;c.leagueDay='Thursday';c.standingsType='round';});await page.evaluate(()=>document.fonts.ready);
  const values=await evaluate(c=>JSON.stringify([c.dropLowest,c.numberOfSubsAllowed,c.subScorePercent,c.leagueDay,c.standingsType]));
  const root=page.locator('.league-management-page');
  for(const [width,height] of [[1366,768],[1920,1080],[375,667],[390,844]]){
   await page.setViewportSize({width,height});await root.getByRole('tab',{name:'Modify Settings',exact:true}).click();await page.waitForTimeout(600);await root.screenshot({path:path.join(out,label+'-settings-'+width+'.png')});
   if(!before){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(width>800){const card=await root.locator('.management-settings-card').boundingBox();assert(card.width>=800&&card.width<=900);const panel=await root.boundingBox();assert(Math.abs(card.x+card.width/2-panel.x-panel.width/2)<2);const tabs=await root.locator(':is(.mat-tab-label,.mat-mdc-tab)').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect()).map(r=>({x:r.x,y:r.y,right:r.right})));assert(tabs.every(t=>Math.abs(t.y-tabs[0].y)<1));assert(Math.abs((tabs[0].x+tabs[tabs.length-1].right)/2-panel.x-panel.width/2)<3);const fields=await root.locator('.management-settings-grid > mat-form-field').evaluateAll(ns=>ns.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));assert(fields[0].x<fields[1].x&&Math.abs(fields[0].y-fields[1].y)<1);}
    else {const a=fs.readFileSync(path.join(out,'before-settings-'+width+'.png')),b=fs.readFileSync(path.join(out,'after-settings-'+width+'.png'));assert.equal(a.readUInt32BE(16),b.readUInt32BE(16));assert.equal(a.readUInt32BE(20),b.readUInt32BE(20));const fields=await root.locator('.management-settings-grid > mat-form-field').evaluateAll(ns=>ns.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));assert(fields.every((f,i)=>Math.abs(f.x-fields[0].x)<1&&(i===0||f.y>fields[i-1].y)),'Mobile fields retain stacked alignment');}
   }
  }
  if(!before)await page.setViewportSize({width:1366,height:768});
  for(const name of labels){await root.getByRole('tab',{name,exact:true}).click();await expect(root.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');if(!before){await page.waitForTimeout(600);const card=await root.locator(':is(.mat-tab-body-active,.mat-mdc-tab-body-active) .management-form-card').boundingBox(),parent=await root.boundingBox();assert(card.width<=(name==='Modify Settings'?860:680)+1);assert(Math.abs(card.x+card.width/2-parent.x-parent.width/2)<2);await root.screenshot({path:path.join(out,'after-'+name.toLowerCase().replace(/ /g,'-')+'-1366.png')});}}
  assert.equal(await evaluate(c=>JSON.stringify([c.dropLowest,c.numberOfSubsAllowed,c.subScorePercent,c.leagueDay,c.standingsType])),values);
  if(!before){await root.getByRole('tab',{name:'Modify Settings',exact:true}).click();await root.getByRole('button',{name:'Save Settings',exact:true}).click();await expect.poll(()=>writes.length).toBe(5);assert(writes.every(w=>w.data.leagueId===101));assert.deepEqual(writes.map(w=>[w.data.settingName,w.data.settingValue]),[['dropLowest','2'],['numberOfSubsAllowed','3'],['subScorePercent','80'],['dayOfLeague','Thursday'],['standingsType','round']]);}
  checks.push('Four sizes; all five tabs/select values retained'+(before?' baseline':' desktop tabs/cards centered/two columns; mobile screenshot dimensions and stacked fields retained; original five Save Settings requests intercepted'));
 }else if(mode==='management-permissions'){
  for(const role of ['Admin','Manager','Player','Anonymous']){
   navigationRole=role;navigationSignedIn=role!=='Anonymous';await page.goto(BASE_URL+'/league-management');
   const allowed=role==='Admin'||role==='Manager';
   if(allowed){await expect(page.locator('.league-management-page')).toBeVisible();await expect(page).toHaveURL(/\/league-management$/);}
   else{await expect(page).toHaveURL(BASE_URL+'/access-denied');await expect(page.locator('.league-management-page')).toHaveCount(0);}
   await expect(page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'League Management',exact:true})).toHaveCount(allowed?1:0);
   await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(page.locator('#navigation-drawer').getByRole('link',{name:'League Management',exact:true})).toHaveCount(allowed?1:0);await page.getByRole('button',{name:'Close navigation',exact:true}).click();await page.setViewportSize({width:1920,height:1080});
   checks.push(role+': desktop/mobile management visibility and direct route '+(allowed?'allowed':'blocked'));
  }
  assert.equal(writes.length,0);
 }else if(mode==='navigation'){
  const nav=page.getByRole('navigation',{name:'Main navigation',exact:true});
  const drawer=page.locator('#navigation-drawer');
  const desktop=nav.locator('.desktop-navigation');
  const groups=drawer.locator('summary');
  const direct=['Home','League Dashboard','Players','Sign In Sheet'];
  const senior=['Home','Scrambler','Teams & Scores','League Dashboard','King & Queen','Players','Sign In Sheet','League Management','Install Locally','F.A.Q'];
  const regular=['Home','League Dashboard','King & Queen','Players','Sign In Sheet','Install Locally','F.A.Q'];
  const group=name=>groups.filter({has:page.getByText(name,{exact:true})});
  async function expandGroup(name){const summary=group(name);if(!await summary.evaluate(el=>el.parentElement.open))await summary.tap();}
  const link=(scope,name)=>scope.getByRole('link',{name,exact:true});
  const button=(scope,name)=>scope.getByRole('button',{name,exact:true});
  const tab=(scope,name)=>scope.getByRole('tab',{name,exact:true});
  async function openDrawer(){
   const toggle=button(nav,'Open navigation');await toggle.tap();
   await expect(drawer).toBeVisible();await expect(button(drawer,'Close navigation')).toBeFocused();
  }
  async function testDesktop(role,theme,width) {
   await expect(desktop).toBeVisible();
   const labels=await desktop.locator(':scope > a, :scope > button').allTextContents();
   const withoutIcons=labels.map(label=>label.replace(/^(?:home|shuffle|group|dashboard|event|emoji_events|people|how_to_reg|settings|get_app|help_outline)/,'').trim());
   assert.deepEqual(withoutIcons,role==='Player'?regular:senior);
   assert(await desktop.evaluate(e=>[...e.querySelectorAll(':scope > a, :scope > button')].every((item,i,items)=>!i||item.getBoundingClientRect().left>=items[i-1].getBoundingClientRect().right-1)));
   const [bar,league,center,account]=await Promise.all([nav.boundingBox(),nav.locator('#leagueDropdown').boundingBox(),desktop.boundingBox(),button(nav,'Account').boundingBox()]);
   assert(league.x-bar.x<=13 && bar.x+bar.width-account.x-account.width<=13);
   assert(league.x+league.width<=center.x && center.x+center.width<=account.x);
   if(width>=1920)assert(Math.abs(center.x+center.width/2-bar.x-bar.width/2)<2,'desktop primary links centered');
   await nav.screenshot({path:path.join(out,role+'-'+theme+'-desktop-'+width+'.png')});
   if(width===1920){
    await expect(link(nav,'Install Locally')).toHaveClass(/featured-link/);
    await expect(link(nav,'F.A.Q')).toBeVisible();
    await expect(button(nav,'More')).toHaveCount(0);
    await expect(button(nav,'Manage')).toHaveCount(0);
    await expect(link(nav,'League Management')).toHaveCount(role==='Player'?0:1);
    const accountButton=button(nav,'Account');await accountButton.focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem',{name:'Profile'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem',{name:'Appearance'})).toBeFocused();
    for(const name of ['Profile','Appearance','Change Email','Logout'])await expect(page.getByRole('menuitem',{name,exact:true})).toBeVisible();
    await expect(page.getByRole('menuitem',{name:'Recovery Review',exact:true})).toHaveCount(role==='Admin'?1:0);
    await page.locator('.mat-mdc-menu-panel').screenshot({path:path.join(out,role+'-'+theme+'-account.png')});
    await page.keyboard.press('Escape');await expect(accountButton).toBeFocused();
   }
  }
  async function testDrawer(role,theme,width){
   const toggle=button(nav,'Open navigation');await expect(toggle).toBeVisible();
   const before=await page.evaluate(()=>scrollY);
   await openDrawer();
   await expect.poll(async()=>{const box=await drawer.boundingBox();return box.x>=-1 && box.x+box.width<=width+1;}).toBe(true);
   const labels=await drawer.locator('.drawer-destinations > a, .drawer-destinations > details > summary').evaluateAll(items=>items.map(i=>i.querySelector('span').textContent.trim()));
   assert.deepEqual(labels,[...(role==='Player'?regular:senior),'Account']);
   for(const name of direct)await expect(link(drawer,name)).toBeVisible();
   await expandGroup('King & Queen');
   await expect(link(drawer,'Standings')).toBeVisible();await expect(link(drawer,'Matchups')).toBeVisible();
   await expect(link(drawer,'Install Locally')).toHaveClass(/featured-link/);
   await expect(link(drawer,'F.A.Q')).toBeVisible();
   await expandGroup('Account');
   for(const name of ['Profile','Change Email','Appearance','Logout']){
    const entry=name==='Profile'||name==='Change Email'?link(drawer,name):button(drawer,name);
    await expect(entry).toBeVisible();
    assert((await entry.boundingBox()).height>=44);
   }
   await expect(link(drawer,'Recovery Review')).toHaveCount(role==='Admin'?1:0);
   await expect(link(drawer,'League Management')).toHaveCount(role==='Player'?0:1);
   if([320,375,390,768,1024,1280].includes(width)){
    const scroller=drawer.locator('.mat-drawer-inner-container');
    await scroller.evaluate(e=>e.scrollTop=0);
    await page.screenshot({path:path.join(out,role+'-'+theme+'-mobile-'+width+'.png'),animations:'disabled'});
    if(width<=430){
     assert(await scroller.evaluate(e=>e.scrollHeight>e.clientHeight));
     await button(drawer,'Logout').scrollIntoViewIfNeeded();
     assert(await scroller.evaluate(e=>e.scrollTop>0));
     if(width===390)await page.screenshot({path:path.join(out,role+'-'+theme+'-mobile-account.png'),animations:'disabled'});
    }
   }
   await page.keyboard.press('Escape');
   await expect(drawer).toBeHidden();await expect(toggle).toBeFocused();
   assert.equal(await page.evaluate(()=>scrollY),before);
  }
  for(const role of ['Admin','Manager','Player']){
   navigationRole=role;
   for(const theme of ['classic','navy','charcoal']){
    await page.setViewportSize({width:1920,height:1000});
    await page.evaluate(value=>localStorage.setItem('league-hub-appearance',value),theme);
    await page.goto(BASE_URL+'/');
    await expect(nav.locator('#leagueDropdown')).toHaveText(/Synthetic League/);
    for(const width of [1920,2560,3440,1440,1280,1024,768,430,390,375,320]){
     await page.setViewportSize({width,height:width<=430?667:900});
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     if(width<=430)await expect(desktop).toHaveCount(0);
     if(width>=1920)await expect(desktop).toBeVisible();
     if(await desktop.isVisible())await testDesktop(role,theme,width);
     else await testDrawer(role,theme,width);
     assert(await nav.evaluate(el=>el.scrollWidth<=el.clientWidth),role+' '+theme+' navbar overflow '+width);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    if(role==='Admin'){
     await page.setViewportSize({width:1920,height:900});
     await link(nav,'King & Queen').click();
     const tabs=page.getByRole('tablist',{name:'King & Queen'});
     await tab(tabs,'Matchups').click();
     await expect(tab(tabs,'Matchups')).toHaveAttribute('aria-selected','true');
     await tabs.screenshot({path:path.join(out,theme+'-king-queen-tabs.png')});
     await link(nav,'Home').click();
    }
   }
   await page.setViewportSize({width:1920,height:900});
   await link(nav,'King & Queen').click();
   const tabs=page.getByRole('tablist',{name:'King & Queen'});
   await expect(page).toHaveURL(/\/standings$/);
   await expect(tab(tabs,'Standings')).toHaveAttribute('aria-selected','true');
   await tab(tabs,'Matchups').click();
   await expect(page).toHaveURL(/\/kqmatchups$/);
   await expect(tab(tabs,'Matchups')).toHaveAttribute('aria-selected','true');
   await expect(link(nav,'King & Queen')).toHaveAttribute('aria-current','page');
   await page.goBack();await expect(tab(tabs,'Standings')).toHaveAttribute('aria-selected','true');
   await page.goForward();await expect(tab(tabs,'Matchups')).toHaveAttribute('aria-selected','true');
   await page.reload();await expect(tab(tabs,'Matchups')).toHaveAttribute('aria-selected','true');
   await page.goto(BASE_URL+'/standings?leagueId=101');await expect(tab(tabs,'Standings')).toHaveAttribute('aria-selected','true');
   await expect(page).toHaveURL(/\/standings\?leagueId=101$/);
   await page.goto(BASE_URL+'/kqmatchups?leagueId=101&scrambleNumber=12');
   await expect(tab(tabs,'Matchups')).toHaveAttribute('aria-selected','true');
   await expect(page).toHaveURL(/\/kqmatchups\?leagueId=101&scrambleNumber=12$/);
   await expect(page.locator('app-kqmatchups')).toBeVisible();
   if(role!=='Player'){
    await link(nav,'Teams & Scores').click();
    await expect(link(nav,'Teams & Scores')).toHaveAttribute('aria-current','page');
    for(const name of ['Enter Team Scores','Team Management']){
     const entry=page.getByRole('tab',{name,exact:true});await entry.click();await expect(entry).toHaveAttribute('aria-selected','true');
    }
    await link(nav,'League Management').click();
    await expect(page).toHaveURL(/\/league-management$/);
    await expect(link(nav,'League Management')).toHaveAttribute('aria-current','page');
   }else{
    await page.goto(BASE_URL+'/league-management');
    await expect(page).toHaveURL(/\/access-denied$/);
   }
   await page.setViewportSize({width:390,height:740});
   await nav.locator('#leagueDropdown').tap();
   await page.getByRole('menuitem',{name:'Second Synthetic League'}).tap();
   await expect(button(nav,'Second Synthetic League')).toBeVisible();
   await openDrawer();await expandGroup('King & Queen');await link(drawer,'Matchups').tap();
   await expect(drawer).toBeHidden();await expect(tab(tabs,'Matchups')).toHaveAttribute('aria-selected','true');
   await expect(button(nav,'Second Synthetic League')).toBeVisible();
   await openDrawer();await expect(link(drawer,'Matchups')).toHaveAttribute('aria-current','page');
   await button(drawer,'Close navigation').tap();
   await page.reload();await expect(tab(tabs,'Matchups')).toHaveAttribute('aria-selected','true');
   await expect(button(nav,'Second Synthetic League')).toBeVisible();
   await openDrawer();await link(drawer,'F.A.Q').tap();
   await expect(drawer).toBeHidden();await expect(page).toHaveURL(/\/faq$/);
   await openDrawer();
   await page.setViewportSize({width:2560,height:900});await expect(drawer).toBeHidden();
   await expect(page).toHaveURL(/\/faq$/);
   await page.setViewportSize({width:1920,height:900});await expect(link(nav,'F.A.Q')).toHaveAttribute('aria-current','page');
   checks.push(role+': shared routes and groups in three themes; tablet and touch layouts; deep links, keyboard, history, refresh and league retention');
  }
  assert.equal(writes.length,0);
 }else if(mode==='fetch'){
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
  await page.getByRole('tab',{name:'Avoid Repeat Teammates',exact:true}).click();
  for(const width of [375,390]){
   await page.setViewportSize({width,height:844});const b=page.getByRole('button',{name:'Generate Teams Without Repeat Teammates'});await b.scrollIntoViewIfNeeded();
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
  await page.getByRole('tab',{name:'Avoid Repeat Teammates',exact:true}).click();await page.locator('button[mattooltip="View saved teams"]').first().click();
  await expect(page.getByRole('dialog',{name:'Saved Scramble 12'})).toContainText('Team 12');
  await page.getByRole('button',{name:'Close',exact:true}).click();await expect(print).toBeEnabled();await page.getByRole('tab',{name:'Select Players',exact:true}).click();
  checks.push('Saved scramble preview preserves generated print eligibility');
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
    if(width>=1280){const rows=await page.locator('.desktop-navigation > a').evaluateAll(ns=>ns.filter(n=>n.getBoundingClientRect().height).map(n=>Math.round(n.getBoundingClientRect().top)));assert.equal(new Set(rows).size,1,'Main desktop links share an intentional row');}
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
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name:'League Management',exact:true}).click();await expect(page.locator('.league-management-page')).toBeVisible();
  assert.equal(await evaluate(c=>c.__workspaceToken),'retained');assert.equal(await evaluate(c=>JSON.stringify({players:c.selectedList,teams:c.listOfTeams,size:c.teamSize,rounds:c.selectedRounds,print:c.selectedMatchupsPerPage})),prior);
  await shot('league-management');await page.locator('app-nav-menu').getByRole('link',{name:'Scrambler',exact:true}).click();assert.equal(await evaluate(c=>c.__workspaceToken),'retained');
  await expect(page.locator('app-scrambler-component').getByRole('tab',{name:'Standings',exact:true})).toHaveCount(0);checks.push('Management route and return preserve the same live Scrambler state; duplicate standings tab removed');
 }else if(mode==='setup'){
  await expect(page.locator('.scramble-empty-state')).toHaveCount(0);await expect(page.locator('.scrambler-results-shell')).toBeHidden();
  await expect(page.locator('.primary-action')).toBeDisabled();
  await shot('after-empty');await page.getByRole('button',{name:'Select All',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),24);
  const roster=await page.locator('.league-roster mat-list-option').evaluateAll(nodes=>nodes.slice(0,5).map(e=>({y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width})));
  assert(roster.slice(0,4).every(r=>Math.abs(r.y-roster[0].y)<1)&&roster[4].y>roster[0].y,'Desktop roster remains four columns');
  await page.locator('.scramble-setup mat-select').nth(0).click();await page.getByRole('option',{name:'2',exact:true}).click();assert.equal(await evaluate(c=>c.numberOfTeams),null);
  await page.locator('.scramble-setup mat-select').nth(1).click();await page.getByRole('option',{name:'6',exact:true}).click();assert.equal(await evaluate(c=>c.teamSize),null);
  await page.getByRole('tab',{name:'Avoid Repeat Teammates',exact:true}).click();await page.getByRole('tab',{name:'Select Players',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),24);
  await shot('after-configured');await page.getByRole('button',{name:'Deselect All',exact:true}).click();assert.equal(await evaluate(c=>c.selectedList.length),0);
  await expect(page.locator('.primary-action')).toBeDisabled();checks.push('Setup: select/deselect, four-column roster, size/count exclusivity, tab state, disabled empty scramble and compact empty results');
 }else if(mode==='followup'){
  await seed();
  await page.locator('.results-rounds mat-select').click();await page.getByRole('option',{name:'3 Rounds',exact:true}).click();assert.equal(await evaluate(c=>c.selectedRounds),3);
  await page.locator('.results-print-controls mat-select').click();await page.getByRole('option',{name:'4 Matchups',exact:true}).click();assert.equal(await evaluate(c=>String(c.selectedMatchupsPerPage)),'4');
  checks.push('Existing Number of Rounds and Matchups Per Page selectors update their original state');
  await page.getByRole('button',{name:'Hide Setup',exact:true}).click();await expect(page.locator('.scramble-setup')).toBeHidden();
  await page.getByRole('button',{name:'Show Setup',exact:true}).click();await expect(page.locator('.scramble-setup')).toBeVisible();assert.equal(await evaluate(c=>c.selectedList.length),24);
  await page.getByRole('tab',{name:'Avoid Repeat Teammates',exact:true}).click();await page.locator('button[mattooltip="View saved teams"]').first().click();
  const preview=page.getByRole('dialog',{name:'Saved Scramble 12'});
  await expect(preview.locator('.saved-team')).toHaveCount(12);
  await preview.getByRole('button',{name:'Close',exact:true}).click();
  assert.deepEqual(await evaluate(c=>c.listOfRetrievedScrambleNumbers),[]);
  await page.locator('.scrambler-results-shell').screenshot({path:path.join(out,'results-controls-and-matchups.png')});
  await page.getByRole('tab',{name:'Manage Scores',exact:true}).click();await expect(page.getByRole('tab',{name:'Manage Scores',exact:true})).toHaveAttribute('aria-selected','true');
  checks.push('Hide/Show Setup retains selection; saved scramble preview displays teams without replacing results; Manage Scores remains available');
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
  await page.getByRole('button',{name:'Save Changes / Teams',exact:true}).click();await page.waitForFunction(()=>!(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).canCancelTeamEditing);
  assert(writes.some(w=>w.path.includes('/savekingqueenteams/')));checks.push('Modified new-team assignments pass through the existing explicit Save Teams request (mocked transport)');
  // Exercise the existing algorithm rather than replacing it with fixture-generated teams.
  await seed(false);await evaluate(c=>{c.completeRandom=false;});await page.locator('.primary-action').click();
  await page.waitForFunction(()=>(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).scrambleNumber===12);
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
  await evaluate(c=>{c.fetchSelectedList();});await page.waitForFunction(()=>(window.ng.getComponent?window.ng.getComponent(document.querySelector('app-scrambler-component')):window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance).fetchClicked);
  assert.equal(await evaluate(c=>c.selectedList.length),24);
  await evaluate(c=>{c.clearTopPLayers();c.clearLowPlayers();c.clearByePlayers();c.applyTopPlayersFromMaleStandings();});assert((await evaluate(c=>c.displayTopPlayers.length))>0);
  const gender=await evaluate(c=>c.selectedList[0].isMale);await evaluate(c=>c.swapGender(c.selectedList[0]));assert.notEqual(await evaluate(c=>c.selectedList[0].isMale),gender);
  checks.push('Fetch signed-in roster, retained standings-driven top selection and temporary gender action execute existing methods');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,mode+'-results.json'),JSON.stringify({checks,pageErrors:errors,writes,databaseAccess:false,mode:'browser-only API fixtures; actual component/print function'},null,2));await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

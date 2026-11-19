// Read-only synthetic browser fixtures. Every application API request is intercepted.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../mobile-spacing-evidence');fs.mkdirSync(out,{recursive:true});
const before=process.argv[2]==='before';let browser;
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1366,height:900}}),page=await context.newPage();
 const errors=[],checks=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 let mode='matchup',variant='normal',accountPlayerId=1001,authenticated=true;
 const leagues=[{id:101,leagueName:'Synthetic League'},{id:102,leagueName:'Second Synthetic League'}];
 const teams=[{id:11,teamName:'Synthetic Harbor Aces with a very long full team name',division:'Gold',players:[{id:1001}]},{id:12,teamName:'Synthetic Court Rockets',division:'Gold',players:[{id:1002}]},{id:13,teamName:'Synthetic Silver Team with Another Long Name',division:'Silver',players:[]}];
 const base=new Date();base.setHours(0,0,0,0);const date=base.getFullYear()+'-'+String(base.getMonth()+1).padStart(2,'0')+'-'+String(base.getDate()).padStart(2,'0');
 const score=(value,won=false,sub=false)=>({score:value,roundWon:won,isSubScore:sub,roundId:1,hasSavedScore:true,scrambleNumber:7,kingQueenTeamId:701});
 const record=(id,scores,isMale=true,division=41)=>({playerId:id,playerName:id===1001||id===1002?'Synthetic Player':'Synthetic '+id,isMale,leagueDivisionId:division,leagueDivisionCode:division===41?'GM':division===42?'SM':null,scores});
 function standings(round){
  if(variant==='empty')return {maxRounds:3,playerScores:[]};
  const rows=[record(1001,variant==='zero'?[score(0),score(0),score(0)]:round?[score(10),score(25,true),score(20,true)]:[score(10),score(30,true,true),score(20,true)]),record(1002,[score(10),score(20),score(25,true)]),record(1003,[score(5),score(15),score(20,true)]),record(1004,[score(10),score(20),score(30)],true,42),record(1005,[score(0),score(0),score(0)],true,null),record(1006,[score(100),score(100),score(100)],false,42),record(1007,[score(90),score(90),score(90)],false,42)];
  rows.forEach(p=>p.scores.forEach((s,i)=>s.roundId=i+1));return {maxRounds:3,playerScores:rows};
 }
 await context.route('**/*',async route=>{
  const req=route.request();let url;try{url=assertLocalUrl(req.url());}catch{const u=new URL(req.url());if(req.method()==='GET'&&['fonts.googleapis.com','fonts.gstatic.com','use.fontawesome.com'].includes(u.hostname)&&['font','stylesheet'].includes(req.resourceType()))return route.continue();return route.abort();}
  const p=url.pathname.toLowerCase();if(!p.startsWith('/api/'))return route.continue();assert.equal(req.method(),'GET','No real or fixture writes required');calls.push(url.pathname+url.search);let data=[];
  if(p.endsWith('/isauthenticated'))data=authenticated;
  else if(p.endsWith('/getusersrole'))data={role:'Admin'};
  else if(p.endsWith('/getusersplayer'))data={playerId:accountPlayerId};
  else if(p.endsWith('/isadminpasswordauthorized'))data=true;
  else if(p.includes('/getuserleagues')||p.endsWith('/getleagues'))data=leagues;
  else if(p.endsWith('/getsettingvalue'))data={settingValue:{numberOfSubsAllowed:'0',dropLowest:'1',subScorePercent:'50',standingsType:mode}[url.searchParams.get('settingName')]};
  else if(p.includes('/getplayers/')||p.endsWith('/getplayers'))data=[{id:1001,playerID:1001,firstName:'Synthetic',lastName:'Player',isMale:true,gender:'Male',allPlayerScores:[]},{id:1002,playerID:1002,firstName:'Fixture',lastName:'Player',isMale:false,gender:'Female',allPlayerScores:[]}];
  else if(p.includes('/getlocksigninstatus'))data=true;
  else if(p.includes('/selectedleaguescrambles/'))data=[{id:701,scrambleNumber:7,dateOfTeam:date+'T00:00:00'}];
  else if(p.includes('/getkingqueenteamsbyscramblenumber/'))data={kingQueenTeams:[1,2].map((n)=>({kingQueenTeam:{id:700+n,scrambleNumber:7,kingQueenPlayers:[],kingQueenRoundScores:[{roundId:1,roundScore:n===1?20:15,roundWon:n===1}]},players:[{id:1000+n,firstName:'Synthetic',lastName:'Player '+n,isMale:n===1}]})),byePlayers:[]};
  else if(p.includes('/getbyleague')){
   if(variant==='failure'){await route.fulfill({status:503,contentType:'application/json',body:'{}'});return;}
   data=decodeURIComponent(p).includes('second synthetic')?{maxRounds:0,playerScores:[]}:standings(!p.includes('matchup'));
   if(variant==='delayed')await new Promise(r=>setTimeout(r,350));
  }
  else if(p.includes('/getleagueschedule/'))data=p.endsWith('/102')?[]:[{weekNumber:7,date:date+'T00:00:00',matches:[{scheduleId:300,team1Id:11,team2Id:12,team1Name:teams[0].teamName,team2Name:teams[1].teamName,division:'Gold',matchDescription:''}]}];
  else if(p.includes('/getallteamswithplayers/')||p.includes('/getteams/'))data=teams;
  else if(p.includes('/league-standings/'))data=teams.map((t,i)=>({...t,teamId:t.id,wins:9-i,losses:i,totalPoints:120-i}));
  else if(p.includes('/league-team-scores/'))data=[{date:date,opponentTeam:'Synthetic Rockets',teamScore:20,wonGame:true}];
  else if(p.includes('/getdetailedperformancestats'))data={individualRounds:[],scrambleTotals:[{scrambleNumber:7,dateOfTeam:date+'T00:00:00',totalScore:87,wins:3}]};
  else if(p.includes('/playerattendance/'))data={visible:true,isOwnProfile:true,canSignIn:false,canRemove:false,isSignedIn:false,reason:'Sign in is available on Sunday only.'};
  else if(p.includes('/getprofile'))data={id:accountPlayerId,firstName:'Synthetic',lastName:'Player',isMale:true};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 async function go(url,selector){await page.goto(BASE_URL+url);await expect(page.locator(selector)).toBeVisible();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);}
 async function component(selector,fn,arg){return page.evaluate(({selector,fn,arg})=>{const d=window.ng.probe(document.querySelector(selector));return d.injector.get(window.ng.coreTokens.NgZone).run(()=>eval('('+fn+')')(d.componentInstance,arg));},{selector,fn:fn.toString(),arg});}

 const routes=[
 ['home','/','app-player-home-dashboard'],['scrambler','/scrambler','app-scrambler-component'],['team-management','/team-scores','app-team-scores'],
 ['dashboard','/league-dashboard','app-league-dashboard'],['schedule-tab','/league-dashboard?tab=schedule','app-league-schedule'],['kq-standings','/standings','app-league-standings'],['kq-matchups','/kqmatchups','app-kqmatchups'],
 ['player-list','/fetch-data','app-fetch-data'],['sign-in','/sign-in','app-sign-in'],['league-management','/league-management','app-scrambler-component'],['faq','/faq','app-faq'],['profile','/player-stats-tabs/1001?leagueId=101&tab=kq','app-player-stats-tabs'],
 ['legacy-schedule','/schedule','app-schedule'],['legacy-scores','/player-scores','app-player-scores'],['reset-password','/resetpassword?token=fixture','app-reset-password'],['profile-redirect','/player-stats/1001?leagueId=101','app-player-stats-tabs']];
 const representative=new Set(['home','player-list','scrambler','dashboard','kq-standings','schedule-tab']);const measurements=[];
 async function measure(name,width){return page.evaluate(({name,width})=>{
  const body=document.querySelector('.body-content'),nav=document.querySelector('.league-navigation'),nb=nav.getBoundingClientRect().bottom;
  const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);const texts=[];let node;
  while(node=walker.nextNode()){if(!node.textContent.trim()||['SCRIPT','STYLE'].includes(node.parentElement.tagName))continue;const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();if(r.width>0&&r.height>0&&r.right>0&&r.left<innerWidth&&r.top>=nb-1&&getComputedStyle(node.parentElement).visibility!=='hidden')texts.push({top:r.top,text:node.textContent.trim().slice(0,70)});}
  texts.sort((a,b)=>a.top-b.top);const first=texts[0];return{name,width,padding:getComputedStyle(body).paddingTop,navPosition:getComputedStyle(nav).position,navBottom:nb,first,gap:first?first.top-nb:null,bodyTop:body.getBoundingClientRect().top,bodyWidth:body.clientWidth,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
 },{name,width});}

 if(process.argv[2]==='loading'){
  const loaders=[['player-list','/fetch-data','app-fetch-data'],['team-management','/team-scores','app-team-scores'],['legacy-scores','/player-scores','app-player-scores'],['legacy-schedule','/schedule','app-schedule']];const states=[];
  for(const [name,url,selector] of loaders)for(const width of [320,390,768,1366]){
   await page.setViewportSize({width,height:844});await go(url,selector);await component(selector,c=>c.loading=true);const loader=page.locator(selector+' .page-loading');await expect(loader).toBeVisible();const style=await loader.evaluate(e=>({position:getComputedStyle(e).position,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,transform:getComputedStyle(e).transform}));const m=await measure(name+'-loading',width);states.push({...m,style});
   if(width<=1023){assert.equal(style.position,'static');assert.equal(style.transform,'none');assert(style.height<300);assert(m.gap>=0&&m.gap<60);assert.equal(m.pageWidth>m.viewport,false);}else if(name==='player-list'){assert(style.height>=843);}else{assert.equal(style.position,'fixed');assert.equal(style.height,200);}
  }
  await page.setViewportSize({width:390,height:844});await go('/faq','app-faq');await page.evaluate(()=>window.scrollTo(0,200));assert(await page.evaluate(()=>scrollY>0));await page.evaluate(()=>window.scrollTo(0,0));
  fs.writeFileSync(path.join(out,'loading-results.json'),JSON.stringify({states,errors,checks:['Four loading presentations checked at320/390/768/1366; compact in-flow mobile loading, desktop full-height/fixed placement preserved; mobile page scroll works.']},null,2));assert.deepEqual(errors,[]);await browser.close();return;
 }
 for(const [name,url,selector] of routes){
  const widths=before?[390,768,1366]:representative.has(name)?[320,375,390,430,600,768,1366]:[320,390,600,768,1366];
  for(const width of widths){await page.setViewportSize({width,height:844});await go(url,selector);await page.waitForTimeout(100);const m=await measure(name,width);measurements.push(m);
   if(!before){assert.equal(m.pageWidth>m.viewport,false,name+' horizontal overflow at '+width);}
   if(!before){if(width<=1023){assert.equal(m.padding,'6px',name+' should use shared mobile padding');assert(m.gap!==null&&m.gap>=0&&m.gap<80,name+' unexpectedly large/overlapping mobile content gap: '+m.gap);}else{const old=JSON.parse(fs.readFileSync(path.join(out,'before-metrics.json'))).find(x=>x.name===name&&x.width===width);assert(Math.abs(m.gap-old.gap)<2,name+' desktop heading/control shifted');}}
   if((representative.has(name)&&(width===390||width===1366))||name==='reset-password'&&width===390)await page.screenshot({path:path.join(out,(before?'before':'after')+'-'+name+'-'+width+'.png'),fullPage:true});
  }
 }
 // Inspect the loading layout independently of network timing; only local component state is changed.
 await page.setViewportSize({width:390,height:844});await go('/fetch-data','app-fetch-data');await component('app-fetch-data',c=>c.loading=true);measurements.push(await measure('player-list-loading',390));if(!before){const m=measurements[measurements.length-1];assert(m.gap<60);assert.equal(m.pageWidth>m.viewport,false);}
 if(!before){
  // Main navigation remains an overlay and does not shift the document.
  await go('/','app-player-home-dashboard');const start=await page.locator('.home-dashboard h1').boundingBox();await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(page.getByRole('dialog',{name:'Navigation menu'})).toBeVisible();const opened=await page.locator('.home-dashboard h1').boundingBox();assert.equal(start.y,opened.y);await page.getByRole('button',{name:'Close navigation'}).click();await expect(page.getByRole('dialog',{name:'Navigation menu'})).not.toBeVisible();
  await page.locator('#leagueDropdown').click();await page.getByRole('menuitem').filter({hasText:'Second Synthetic League'}).click();await expect(page.locator('#leagueDropdown')).toContainText('Second Synthetic League');
  await go('/league-dashboard?leagueId=101&tab=schedule','app-league-schedule');await page.locator('app-league-schedule').getByRole('button',{name:'Full Schedule',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();const box=await dialog.boundingBox();assert(box.y>=0&&box.y+box.height<=844);await dialog.getByRole('button',{name:'Close full schedule'}).click();
  await go('/faq','app-faq');const q=page.locator('.faq-question').first();await q.click();await expect(q).toHaveAttribute('aria-expanded','true');await q.click();await expect(q).toHaveAttribute('aria-expanded','false');
  checks.push('Every registered route reviewed at mobile/intermediate/desktop widths; shared mobile gap bounded, desktop first meaningful content position unchanged; drawer overlay/close, league selection, full-schedule modal and FAQ expansion remain functional.');
 }
 fs.writeFileSync(path.join(out,(before?'before':'after')+'-metrics.json'),JSON.stringify(measurements,null,2));fs.writeFileSync(path.join(out,(before?'before':'after')+'-results.json'),JSON.stringify({checks,errors,calls,mode:'All API requests intercepted; no SQL or writes.'},null,2));assert.deepEqual(errors,[]);await browser.close();
})().catch(async error=>{console.error(error.stack);if(browser){const page=browser.contexts()[0].pages()[0];if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await browser.close();}process.exitCode=1;});

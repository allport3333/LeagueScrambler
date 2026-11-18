const fs=require('node:fs');
const path=require('node:path');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve(__dirname,'../functional/.tools/browsers');
const {chromium}=require('../functional/node_modules/playwright');
const root=__dirname;
const viewports=[{name:'desktop-1920x1080',width:1920,height:1080},{name:'laptop-1366x768',width:1366,height:768},{name:'tablet-768x1024',width:768,height:1024},{name:'mobile-390x844',width:390,height:844},{name:'mobile-375x667',width:375,height:667}];
const leagues=[{id:900001,leagueName:'UX Sample Tuesday League'},{id:900002,leagueName:'UX Sample Mixed Doubles'}];
const players=Array.from({length:16},(_,i)=>({id:910001+i,playerId:910001+i,firstName:'Sample',lastName:'Player '+String(i+1).padStart(2,'0'),gender:i%2?'Female':'Male',isMale:i%2===0,isSub:i===14,leagueDivisionId:i%2?2:1,leagueDivisionCode:i%2?'Silver':'Gold'}));
const stats=players.map((p,i)=>({...p,playerName:p.firstName+' '+p.lastName,totalScore:126-i*3,originalTotalScore:126-i*3,totalPoints:126-i*3,roundsPlayed:6,averageScore:21-i*.5,leagueDivisionName:p.leagueDivisionCode,isTopPlayer:i<4,subCount:i===14?1:0,scores:Array.from({length:6},(_,j)=>({roundId:j+1,score:21-i*.5,date:'2026-11-17',roundWon:i%2?0:1,isReduced:false,isSubScore:i===14?1:0}))}));
const teams=[{id:920001,teamName:'Sample Falcons',division:'Gold',totalWins:4,totalLosses:2,wins:4,losses:2,totalPoints:120},{id:920002,teamName:'Sample Otters',division:'Gold',totalWins:3,totalLosses:3,wins:3,losses:3,totalPoints:110},{id:920003,teamName:'Sample Comets',division:'Silver',totalWins:2,totalLosses:4,wins:2,losses:4,totalPoints:98}];
const kq=Array.from({length:4},(_,i)=>({kingQueenTeam:{id:930001+i,leagueID:900001,scrambleNumber:1,dateOfTeam:'2026-11-17',scrambleWithScoresToBeSaved:true,kingQueenPlayers:players.slice(i*4,i*4+4).map(p=>({playerId:p.id,isSubScore:0})),kingQueenRoundScores:Array.from({length:3},(_,j)=>({id:960001+i*3+j,roundId:j+1,roundScore:21-i,roundWon:i%2?0:1}))},players:players.slice(i*4,i*4+4)}));
const settings={subScorePercent:'50',numberOfSubsAllowed:'2',dropLowest:'1',dayOfLeague:'Tuesday',standingsType:'round'};
const events=fs.existsSync(path.join(root,'evidence/network-safety.json'))?JSON.parse(fs.readFileSync(path.join(root,'evidence/network-safety.json'),'utf8')).events:[];
const captures=fs.existsSync(path.join(root,'evidence/captures.json'))?JSON.parse(fs.readFileSync(path.join(root,'evidence/captures.json'),'utf8')):[];
function fixture(url,role){const p=url.pathname.toLowerCase();const auth=role!=='anonymous';
 if(p.endsWith('/isauthenticated'))return auth;
 if(p.endsWith('/isadminpasswordauthorized'))return false; // Never simulate successful legacy unlock.
 if(p.endsWith('/getusersrole'))return {role:role==='manager'?'Manager':role==='admin'?'Admin':'Player'};
 if(p.endsWith('/getusersplayer'))return {playerId:players[0].id};
 if(p.endsWith('/getuserinfo'))return {userId:990001,email:'sample@example.invalid',firstName:'Sample',lastName:'Player 01',role:role==='manager'?'Manager':'Player',playerId:players[0].id};
 if(p.endsWith('/getuserleagues')||p.endsWith('/getleagues')||p.endsWith('/getplayerleagues')||p.includes('/getleaguesforplayer'))return leagues;
 if(p.includes('/getsettingvalue'))return {settingValue:settings[url.searchParams.get('settingName')]||'0'};
 if(p.includes('/getlocksigninstatus'))return {isLocked:false,locked:false,signInLocked:false};
 if(p.includes('/selectedleaguescrambles/'))return kq.map(t=>t.kingQueenTeam);
 if(p.includes('/getkingqueenteamsbyscramblenumber/'))return {kingQueenTeams:kq,byePlayers:[]};
 if(p.includes('/leaguedivision/getbyleague'))return [{id:1,leagueID:900001,code:'Gold',name:'Gold',sortOrder:1},{id:2,leagueID:900001,code:'Silver',name:'Silver',sortOrder:2}];
 if(p.includes('/getbyleaguematchup/')||p.includes('/scrambledata/getbyleague/'))return {playerScores:stats,maxRounds:6};
 if(p.includes('/league-standings/'))return teams;
 if(p.includes('/getscramblenumbers'))return [1,2,3];
 if(p.includes('/gettopplayers'))return players.slice(0,4);
 if(p.includes('/getsignedinplayersasplayers'))return players.slice(0,12);
 if(p.includes('/getsignedinplayers'))return players.slice(0,12).map((p,i)=>({...p,playerSignInId:940001+i,dateTime:'2026-11-17T18:00:00',leagueId:900001}));
 if(p.includes('/getprofile'))return {...players[0],name:'Sample Player 01',totalGames:12,totalWins:8,totalLosses:4,winPercentage:66.7};
 if(p.includes('/getperformancestats'))return {totalScores:126,totalWins:4,averageScore:21,totalGames:6};
 if(p.includes('/getteams')&&!p.includes('getteamscores'))return teams;
 if(p.includes('/available-dates/'))return ['2026-11-17','2026-11-10'];
 if(p.includes('/getteamScores'.toLowerCase()))return [{id:950001,teamId:920001,teamName:teams[0].teamName,opponentsTeamId:920002,opponentTeamName:teams[1].teamName,teamScore:21,opponentScore:18,wonGame:true,date:'2026-11-17'}];
 if(p.includes('/getplayers')||p.includes('/searchplayers')||p.includes('/getplayerbyfirstlastname'))return players;
 return [];
}
async function context(browser,origin,role='anonymous',mode='fixture'){
 const c=await browser.newContext({viewport:{width:1366,height:768},ignoreHTTPSErrors:false,serviceWorkers:'block'});
 await c.route('**/*',async route=>{const req=route.request();const u=new URL(req.url());
  if(req.method()!=='GET'){events.push({kind:'blocked-write',method:req.method(),path:u.pathname});return route.abort('blockedbyclient');}
  if(u.origin===origin){
   if(u.pathname.toLowerCase().startsWith('/api/')){
    if(mode==='live-anonymous'&&['/api/login/isauthenticated','/api/login/isadminpasswordauthorized'].includes(u.pathname.toLowerCase()))return route.continue();
    const value=mode==='live-anonymous'?[]:fixture(u,role);
    events.push({kind:'display-fixture',path:u.pathname,role});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
   }
   return route.continue();
  }
  const allowed=['stackpath.bootstrapcdn.com','use.fontawesome.com','fonts.googleapis.com','fonts.gstatic.com','code.jquery.com','cdnjs.cloudflare.com'];
  if(allowed.includes(u.hostname))return route.continue();
  events.push({kind:'blocked-external',host:u.hostname});return route.abort('blockedbyclient');
 });return c;
}
async function measure(page){return page.evaluate(()=>{
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
 const label=e=>(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.id||e.tagName).trim().replace(/\s+/g,' ').slice(0,100);
 const controls=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,[role=button]')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {label:label(e),tag:e.tagName,width:Math.round(r.width),height:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),disabled:!!e.disabled,fontSize:getComputedStyle(e).fontSize,accessibleName:e.getAttribute('aria-label')||null};});
 const overflow=[...document.body.querySelectorAll('*')].filter(visible).map(e=>({e,r:e.getBoundingClientRect()})).filter(x=>x.r.right>innerWidth+2||x.r.left< -2).slice(0,18).map(x=>({tag:x.e.tagName,class:x.e.className?.toString().slice(0,80),label:label(x.e),left:Math.round(x.r.left),right:Math.round(x.r.right)}));
 return {title:document.title,viewport:{width:innerWidth,height:innerHeight},scrollY,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,headings:[...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map(e=>({level:e.tagName,text:label(e)})),controls,overflow,text:document.body.innerText.slice(0,11000)};
 });}
async function capture(page,name,meta={},fullPage=false){
 await page.waitForTimeout(350);
 const file=name+'.png';
 const privacyMasks=[page.locator('a[href^="mailto:"],a[href^="tel:"]')];
 if(meta.screen==='schedule')privacyMasks.push(page.locator('td'));
 await page.screenshot({path:path.join(root,'screenshots',file),fullPage,animations:'disabled',mask:privacyMasks});
 const metrics=await measure(page);let axe=null;
 try{if(meta.skipAxe)axe={notRun:'Intentionally changing/loading state; static scan not attributed to screenshot'};else{await page.addScriptTag({path:path.join(root,'tools/axe.min.js')});axe=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});return {version:r.testEngine.version,passes:r.passes.length,incomplete:r.incomplete.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,helpUrl:v.helpUrl,nodes:v.nodes.slice(0,12).map(n=>({target:n.target,html:n.html.slice(0,500),failureSummary:n.failureSummary}))}))};});}}catch(e){axe={error:e.message.slice(0,160)};}
 if(meta.screen==='schedule'){metrics.text='[Schedule cell text omitted for privacy]';if(axe.violations)for(const v of axe.violations)for(const n of v.nodes)n.html='[Schedule HTML omitted for privacy]';}
 const record={file,...meta,privacyMasked:meta.screen==='schedule',metrics,axe};const prior=captures.findIndex(c=>c.file===file);if(prior>=0)captures[prior]=record;else captures.push(record);
 fs.writeFileSync(path.join(root,'evidence/captures.json'),JSON.stringify(captures,null,2));
 fs.writeFileSync(path.join(root,'evidence/network-safety.json'),JSON.stringify({writesForwarded:0,realCredentialsUsed:false,databaseFixturesWritten:false,events},null,2));
 console.log(JSON.stringify({file,overflow:metrics.horizontalOverflow,axeViolations:axe.violations?.length,headings:metrics.headings.map(h=>h.text).slice(0,4)}));
}
async function initial(){const browser=await chromium.launch({headless:true});try{
 for(const v of viewports){const c=await context(browser,'https://allportsleaguehub.com','anonymous','live-anonymous');const p=await c.newPage();await p.setViewportSize(v);await p.goto('https://allportsleaguehub.com/',{waitUntil:'networkidle',timeout:45000});
  await capture(p,`home_visitor_${v.name}_production`,{screen:'home',role:'visitor',source:'production anonymous read-only',size:v.name});
  await p.getByRole('button',{name:'Login',exact:true}).click();await capture(p,`login_visitor_${v.name}_production`,{screen:'login',role:'visitor',source:'production anonymous read-only; no submission',size:v.name});
  await p.getByRole('button',{name:'Cancel',exact:true}).click();await p.getByRole('button',{name:'Register',exact:true}).click();await capture(p,`registration_visitor_${v.name}_production`,{screen:'registration',role:'visitor',source:'production anonymous read-only; no submission',size:v.name});
  if(v.width<800){await p.getByRole('button',{name:'Cancel',exact:true}).click();await p.getByRole('button',{name:'Toggle navigation'}).click();await capture(p,`navigation_visitor_${v.name}_production`,{screen:'navigation-open',role:'visitor',source:'production anonymous read-only',size:v.name});}
  await c.close();
 }
}finally{await browser.close();}}
module.exports={context,capture,measure,viewports,leagues,players,stats,teams,root,captures,events,chromium};
if(require.main===module)initial().catch(e=>{console.error(e.stack);process.exitCode=1;});

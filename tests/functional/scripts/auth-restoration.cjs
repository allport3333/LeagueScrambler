// Actual Angular browser flows, synthetic cookie/API transport only. No real login or database writes.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
const out=path.resolve(__dirname,'../auth-restoration-evidence');fs.mkdirSync(out,{recursive:true});
const leagues=[{id:-501,leagueName:'Synthetic League A'},{id:-502,leagueName:'Synthetic League B'}];
const checks=[],errors=[],writes=[];let browser;
(async()=>{
 browser=await chromium.launch();
 async function scenario(role='Player',authenticated=true,options={}){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1366,height:768}});
  const state={role,active:authenticated,delay:options.delay||0,invalid:0,metadataDelay:0,noPlayer:false,noLeagues:false,checks:0};
  if(authenticated)await context.addCookies([{name:'LSAuthFixture',value:'synthetic-session',url:BASE_URL,httpOnly:true,secure:true,sameSite:'Lax'}]);
  await context.route('**/*',async route=>{
   let u;try{u=assertLocalUrl(route.request().url());}catch{await route.abort();return;}
   const request=route.request(),p=u.pathname.toLowerCase();
   const signed=state.active&&(await request.allHeaders()).cookie?.includes('LSAuthFixture=synthetic-session');
   if(request.method()!=='GET'){
    if(p==='/api/login/login'){
     writes.push({path:p,mode:'mocked-only'});state.active=true;
     await route.fulfill({status:200,contentType:'application/json',headers:{'Set-Cookie':'LSAuthFixture=synthetic-session; Path=/; HttpOnly; Secure; SameSite=Lax'},body:'{}'});return;
    }
    if(p==='/api/login/logout'){
     writes.push({path:p,mode:'mocked-only'});state.active=false;
     await route.fulfill({status:200,contentType:'application/json',headers:{'Set-Cookie':'LSAuthFixture=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'},body:'{}'});return;
    }
    if(p.startsWith('/api/'))throw Error('Unexpected write blocked: '+p);
    await route.abort();return;
   }
   if(!p.startsWith('/api/')){await route.continue();return;}
   let body=[],status=200;
   if(p==='/api/login/isauthenticated'){
    state.checks++;const valid=!!signed,invalid=state.invalid;await new Promise(r=>setTimeout(r,state.delay));
    status=invalid||200;body=valid;
   }else if(p==='/api/login/getusersrole'){
    const response={role:state.role};await new Promise(r=>setTimeout(r,state.metadataDelay));status=signed?200:401;body=response;
   }else if(p==='/api/login/getusersplayer'){
    status=!signed?401:state.noPlayer?404:200;body={userId:-701,playerId:-801};
   }else if(p==='/api/login/getuserleagues'){status=signed?200:401;body=state.noLeagues?[]:leagues;}
   else if(p==='/api/login/isadminpasswordauthorized')body=false;
   else if(u.searchParams.has('settingName'))body={settingValue:{numberOfSubsAllowed:'100',subScorePercent:'100',dropLowest:'0',standingsType:'round'}[u.searchParams.get('settingName')]};
   else if(p.includes('getbyleague'))body={maxRounds:0,playerScores:[]};
   else if(p.includes('getplayerby')||p.includes('getplayer/'))body={id:-801,firstName:'Synthetic',lastName:'Player',isMale:true};
   else if(p.includes('combined-stats'))body={teammateStats:[],opponentStats:[],leagueStats:[]};
   else if(p.includes('getleagues'))body=leagues;
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push({role,message:error.message}));
  return {context,page,state};
 }
 async function ready(page,logged=true){
  await expect(page.locator('app-nav-menu [role=status]')).toHaveCount(0);
  if(logged)await expect(page.locator('app-nav-menu .d-lg-flex').getByRole('link',{name:'Logout',exact:true})).toBeVisible();
  else await expect(page.locator('app-nav-menu').getByRole('link',{name:'Home',exact:true})).toBeVisible();
 }
 async function navState(page){return page.evaluate(()=>{
  const n=window.ng.probe(document.querySelector('app-nav-menu')).componentInstance;
  return {loggedIn:n.loggedIn,role:n.userRole,player:n.playerId,league:n.selectedLeagueId,checked:n.authenticationChecked};
 });}
 async function recheck(page){await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));}
 for(const [role,route] of [['Player','/player-stats-tabs/-801'],['Manager','/scrambler'],['Admin','/standings']]){
  const {page,context,state}=await scenario(role,true,{delay:500});
  await page.goto(BASE_URL+route);
  await expect(page.locator('app-nav-menu').getByRole('link',{name:'Home',exact:true})).toHaveCount(0);
  await ready(page);assert.deepEqual(await navState(page),{loggedIn:true,role,player:-801,league:-501,checked:true});
  assert.equal(new URL(page.url()).pathname,route);
  const management=page.locator('app-nav-menu').getByRole('link',{name:'Team Management',exact:true});
  if(role==='Player')await expect(management).toHaveCount(0);else await expect(management).toBeVisible();
  await page.reload();await ready(page);assert.equal(new URL(page.url()).pathname,route);assert.equal((await navState(page)).role,role);
  assert(state.checks>=2);checks.push(role+': startup and refresh restore role/player/navigation and preserve '+route);
  await context.close();
 }
 {
  const {page,context,state}=await scenario('Manager',false);
  await page.goto(BASE_URL+'/');await ready(page,false);
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await page.locator('#loginEmail').fill('synthetic@example.invalid');await page.locator('#loginPassword').fill('Synthetic-fixture-only!');
  await page.getByRole('button',{name:'Submit',exact:true}).click();await ready(page);await page.waitForURL('**/scrambler');
  await page.reload();await ready(page);assert.equal((await navState(page)).role,'Manager');
  checks.push('Browser login with synthetic transport followed by refresh restores authentication');
  await page.goto('about:blank');await page.goBack();await ready(page);assert.equal((await navState(page)).loggedIn,true);
  checks.push('Navigate away to about:blank and back with the synthetic secure cookie retained');
  // Preserve an existing league B and avoid emitting a redundant selection on revalidation.
  await page.evaluate(()=>{
   const n=window.ng.probe(document.querySelector('app-nav-menu')).componentInstance;n.onLeagueChange(-502);
   window.fixtureSelectionEmissions=0;n.leagueService.selectedLeague$.subscribe(()=>window.fixtureSelectionEmissions++);
   window.fixtureSelectionEmissions=0;
  });
  await recheck(page);await ready(page);assert.equal((await navState(page)).league,-502);
  assert.equal(await page.evaluate(()=>window.fixtureSelectionEmissions),0);
  checks.push('Persisted-pageshow revalidation preserves existing league B without a redundant selection emission');
  await page.locator('app-nav-menu .d-lg-flex').getByRole('link',{name:'Logout',exact:true}).click();await ready(page,false);
  assert.equal(state.active,false);assert.equal((await navState(page)).player,null);
  await page.reload();await ready(page,false);assert.equal((await navState(page)).loggedIn,false);
  checks.push('Explicit browser logout invokes existing endpoint, clears synthetic server session/UI and remains logged out on refresh');
  await context.close();
 }
 for(const invalid of [0,401,503]){
  const {page,context,state}=await scenario('Player',false,{delay:300});state.invalid=invalid;
  await page.goto(BASE_URL+'/standings');await ready(page,false);
  assert.equal(new URL(page.url()).pathname,'/standings');assert.equal((await navState(page)).loggedIn,false);
  checks.push('False/invalid/check-failure session result '+invalid+' returns logged-out state without redirect');await context.close();
 }
 {
  const {page,context,state}=await scenario('Player',true);state.noPlayer=true;state.noLeagues=true;
  await page.goto(BASE_URL+'/standings');await ready(page);assert.equal(new URL(page.url()).pathname,'/standings');
  assert.equal((await navState(page)).player,null);checks.push('Valid unclaimed account with no leagues does not trigger a startup redirect');
  state.active=false;await recheck(page);await ready(page,false);assert.equal((await navState(page)).loggedIn,false);
  checks.push('Expired session on persisted pageshow clears cached navigation and user information');await context.close();
 }
 for(const [role,noLeagues] of [['Admin',false],['Manager',true]]){
  const {page,context,state}=await scenario(role,true);state.noPlayer=true;state.noLeagues=noLeagues;
  await page.goto(BASE_URL+'/scrambler');await ready(page);await page.reload();await ready(page);
  assert.equal(new URL(page.url()).pathname,'/scrambler');assert.equal((await navState(page)).role,role);
  checks.push(role+': no claimed player'+(noLeagues?' and no leagues':'')+' does not redirect on Scrambler refresh');await context.close();
 }
 {
  const {page,context,state}=await scenario('Admin',true);await page.goto(BASE_URL+'/standings');await ready(page);
  state.delay=400;await recheck(page);
  await page.evaluate(()=>window.ng.probe(document.querySelector('app-nav-menu')).componentInstance.authService.setLoggedIn(false));
  await page.waitForTimeout(500);assert.equal((await navState(page)).loggedIn,false);
  checks.push('Late startup/revalidation response cannot reverse a newer explicit logged-out state');await context.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,pageErrors:errors,writes,databaseAccess:false,realCookieExpiryTested:false,mode:'synthetic secure-cookie/API transport; real Angular UI'},null,2));
 assert.deepEqual(errors,[]);console.log(checks.length+' focused auth restoration groups passed; no real login/logout or database writes.');await browser.close();
})().catch(async e=>{console.error(e.stack);if(browser)await browser.close();process.exitCode=1;});

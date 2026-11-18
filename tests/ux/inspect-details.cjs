const fs=require('node:fs');const path=require('node:path');
const {context,capture,viewports,players,root,chromium}=require('./audit-browser.cjs');
const origin='https://localhost:5001';
async function modelPostLogin(page){await page.evaluate(()=>{const nav=window.ng.probe(document.querySelector('app-nav-menu')).componentInstance;nav.authService.setLoggedIn(true);});await page.waitForTimeout(350);}
async function snapSizes(page,screen,role,all=false){for(const v of viewports.filter(v=>all||[1366,768,375].includes(v.width))){await page.setViewportSize(v);await page.evaluate(()=>scrollTo(0,0));await capture(page,`${screen}_${role}_${v.name}_local-role-layout-preview`,{screen,role,size:v.name,source:'Actual local Angular components with synthetic display fixtures and in-memory post-login navigation state; NO server authentication or persistence'});}}
async function main(){const browser=await chromium.launch({headless:true});const observations=[];try{
 const scenarios=[['standings-populated','/standings','player'],['dashboard-populated','/league-dashboard','player'],['scrambler-populated','/scrambler','manager'],['scoring-populated','/team-scores','manager'],['sign-in-populated','/sign-in','player'],['kq-populated','/kqmatchups','player']];
 const start=process.argv[2]?Math.max(0,scenarios.findIndex(s=>s[0]===process.argv[2])):0;
 for(const [screen,route,role] of scenarios.slice(start)){
  const c=await context(browser,origin,role,'fixture');const p=await c.newPage();await p.goto(origin+route,{waitUntil:'networkidle'});await modelPostLogin(p);await snapSizes(p,screen,role,['standings-populated','scoring-populated'].includes(screen));
  if(screen==='kq-populated'){const select=p.locator('mat-select').first();await select.click();const option=p.getByRole('option').first();if(await option.isVisible())await option.click();await capture(p,'kq-results_player_mobile-375x667_local-role-layout-preview',{screen:'kq-results',role,size:'mobile-375x667',source:'Synthetic displayed round data; no score saved'},true);}
  if(screen==='scrambler-populated'){
   for(const tab of ['Add League','Add Division','Add Player']){const loc=p.getByRole('tab',{name:tab,exact:true});if(await loc.count()){try{await loc.scrollIntoViewIfNeeded();await loc.click({timeout:3000});await capture(p,`${tab.replace(/ /g,'-').toLowerCase()}_manager_mobile-375x667_local-role-layout-preview`,{screen:tab.toLowerCase(),role,size:'mobile-375x667',source:'Synthetic role layout, form not submitted'},true);}catch(e){observations.push({workflow:tab,limitation:'Tab required pagination/was outside viewport; not forced. Continued to other workflows.'});}}}
  }
  if(screen==='scoring-populated'){
   for(const tab of ['League Teams','Team Management']){await p.getByRole('tab',{name:tab,exact:true}).click();await capture(p,`${tab.replace(/ /g,'-').toLowerCase()}_manager_mobile-375x667_local-role-layout-preview`,{screen:tab.toLowerCase(),role,size:'mobile-375x667',source:'Synthetic role layout, no mutation'},true);}
  }
  if(screen==='dashboard-populated'){
   const menu=p.getByRole('button',{name:'Toggle navigation'});if(await menu.isVisible()){await menu.click();await capture(p,'navigation_player_mobile-375x667_local-role-layout-preview',{screen:'navigation-player',role,size:'mobile-375x667',source:'Synthetic post-login navigation preview'});}
  }
  await c.close();
 }
 // Review post-registration forms without registering an account.
 const claimContext=await context(browser,origin,'anonymous','fixture');const p=await claimContext.newPage();await p.setViewportSize({width:375,height:667});await p.goto(origin,{waitUntil:'networkidle'});
 await p.evaluate(()=>window.ng.probe(document.querySelector('app-home')).componentInstance.openClaimModal());
 await p.locator('input[placeholder="Start typing to search"]').fill('Sample');
 await capture(p,'claim-picker_new-player_mobile-375x667_local-form-preview',{screen:'claim-picker',role:'new-player',size:'mobile-375x667',source:'Post-registration display-only form opened via existing client method; registration NOT executed'});
 await p.getByRole('button',{name:'Create New Player',exact:true}).click();await capture(p,'player-create_new-player_mobile-375x667_local-form-preview',{screen:'player-create',role:'new-player',size:'mobile-375x667',source:'Display-only client form; Save not pressed'});
 await claimContext.close();
 // Local form validation/keyboard only. All writes are blocked by the context.
 const validation=await context(browser,origin,'anonymous','fixture');const q=await validation.newPage();await q.setViewportSize({width:375,height:667});await q.goto(origin,{waitUntil:'networkidle'});await q.getByRole('button',{name:'Login',exact:true}).click();await q.locator('#loginEmail').fill('sample@example.invalid');await q.locator('#loginPassword').focus();
 const before=await q.evaluate(()=>document.activeElement.id);await q.keyboard.press('Enter');await q.waitForTimeout(150);observations.push({workflow:'local login keyboard',passwordEntered:false,emailSynthetic:true,focusedBeforeEnter:before,submitEnabledWithBlankPassword:await q.getByRole('button',{name:'Submit',exact:true}).isEnabled(),pageStillLogin:await q.locator('#loginEmail').isVisible()});
 await capture(q,'login-validation_visitor_mobile-375x667_local',{screen:'login-validation',role:'visitor',size:'mobile-375x667',source:'Local synthetic email only, blank password; no login request forwarded'});
 await q.getByRole('button',{name:'Cancel',exact:true}).click();await q.getByRole('button',{name:'Register',exact:true}).click();await q.locator('#registerEmail').fill('not-an-email');await q.locator('#registerFirstName').click();await capture(q,'registration-validation_visitor_mobile-375x667_local',{screen:'registration-validation',role:'visitor',size:'mobile-375x667',source:'Local validation; no registration submitted'});
 await validation.close();
 // Actual client-only preview algorithm, unauthenticated, never save.
 const preview=await context(browser,origin,'anonymous','fixture');const r=await preview.newPage();await r.goto(origin+'/scrambler',{waitUntil:'networkidle'});await r.evaluate(({players})=>{const c=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;Object.assign(c,{selectedList:players.slice(0,12),selectedLeague:'UX Sample Tuesday League',selectedLeagueDto:{id:900001,leagueName:'UX Sample Tuesday League'},numberOfTeams:3,completeRandom:true,locked:false,lockedResults:false,hideInputOptions:false,hideEverything:false});if(c.isActionAllowed)throw new Error('Preview cannot have administration authority');c.cdr.detectChanges();},{players});await r.getByRole('button',{name:'Scramble Players',exact:true}).first().click();await snapSizes(r,'scramble-preview','visitor');await capture(r,'scramble-preview_visitor_mobile-375x667_full_local',{screen:'scramble-preview-full',role:'visitor',size:'mobile-375x667',source:'Actual public client algorithm with synthetic selection; no saved teams'},true);await preview.close();
}finally{fs.writeFileSync(path.join(root,'evidence/interaction-observations.json'),JSON.stringify(observations,null,2));await browser.close();}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

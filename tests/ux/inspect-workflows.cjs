const fs=require('node:fs');
const path=require('node:path');
const {context,capture,viewports,root,chromium}=require('./audit-browser.cjs');
const origin='https://localhost:5001';
async function chooseLeague(page){
 const dropdown=page.locator('#leagueDropdown');
 if(await dropdown.isVisible()){
  await dropdown.click();
  const choice=page.locator('.dropdown-menu a').filter({hasText:'UX Sample Tuesday League'}).first();
  if(await choice.isVisible())await choice.click();
 }
}
async function main(){const browser=await chromium.launch({headless:true});const errors=[];try{
 const scenarios=[
  {screen:'dashboard',route:'/league-dashboard',role:'player'},
  {screen:'standings',route:'/standings',role:'player'},
  {screen:'sign-in',route:'/sign-in',role:'player'},
  {screen:'scrambler',route:'/scrambler',role:'manager'},
  {screen:'team-scores',route:'/team-scores',role:'manager'},
  {screen:'players',route:'/fetch-data',role:'manager'},
  {screen:'profile',route:'/player-stats-tabs/910001',role:'player'},
  {screen:'kqmatchups',route:'/kqmatchups',role:'player'},
  {screen:'schedule',route:'/schedule',role:'anonymous'},
  {screen:'faq',route:'/faq',role:'anonymous'}
 ];
 for(const s of scenarios){
  const c=await context(browser,origin,s.role,'fixture');const p=await c.newPage();const pageErrors=[];p.on('pageerror',e=>pageErrors.push(e.message.slice(0,180)));
  try{
   await p.goto(origin+s.route,{waitUntil:'networkidle',timeout:60000});
   await chooseLeague(p);await p.waitForTimeout(300);
   for(const v of viewports){await p.setViewportSize(v);await p.evaluate(()=>scrollTo(0,0));await capture(p,`${s.screen}_${s.role}_${v.name}_local-display-fixture`,{screen:s.screen,role:s.role,source:'local actual Angular UI; browser-only synthetic display fixtures; NOT authenticated server workflow',size:v.name,pageErrors:[...new Set(pageErrors)]});}
   if(['scrambler','standings','team-scores','players'].includes(s.screen)){
    await capture(p,`${s.screen}_${s.role}_mobile-375x667_full_local-display-fixture`,{screen:s.screen+'-full',role:s.role,source:'local synthetic display fixtures; full page',size:'mobile-375x667'},true);
   }
   if(s.screen==='team-scores'){
    for(const tab of ['Create Teams','Team Standings','View Team Scores']){const t=p.getByRole('tab',{name:tab,exact:true});if(await t.count()){await t.click();await capture(p,`team-management_${s.role}_mobile-375x667_${tab.toLowerCase().replace(/ /g,'-')}_local-display-fixture`,{screen:'team-management-'+tab,role:s.role,source:'local display-only fixture',size:'mobile-375x667'});}}
   }
   if(s.screen==='players'){
    const add=p.getByRole('button',{name:/Add New Player|Add Player/i}).first();if(await add.isVisible()){await add.click();await capture(p,'player-form_manager_mobile-375x667_local-display-fixture',{screen:'player-form',role:'manager',source:'local display-only fixture; not submitted',size:'mobile-375x667'});}
   }
  }catch(e){errors.push({screen:s.screen,message:e.message.slice(0,220)});console.log('SCREEN LIMITED '+s.screen+' '+e.message.slice(0,100));}
  await c.close();
 }
 // Actual anonymous state: no successful legacy password/cookie is simulated.
 const c=await context(browser,origin,'anonymous','fixture');const p=await c.newPage();
 for(const route of ['/scrambler','/team-scores','/standings']){await p.goto(origin+route,{waitUntil:'networkidle'});await p.setViewportSize({width:390,height:844});await capture(p,`${route.slice(1)}_visitor_mobile-390x844_locked_local`,{screen:route.slice(1)+'-locked',role:'visitor',source:'local anonymous fixture, legacy authorization false; no password entered',size:'mobile-390x844'});}
 await c.close();
}finally{fs.writeFileSync(path.join(root,'evidence/workflow-limitations.json'),JSON.stringify(errors,null,2));await browser.close();}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
let browser;
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});const weekRequests=[],writes=[];
 await context.route('**/*',async route=>{
  let u;try{u=assertLocalUrl(route.request().url());}catch{await route.abort();return;}
  if(route.request().method()!=='GET'){if(u.pathname.startsWith('/api/'))writes.push(u.pathname);await route.abort();return;}
  if(!u.pathname.toLowerCase().startsWith('/api/')){await route.continue();return;}
  if(u.pathname.includes('/SelectedLeagueScrambles/'))weekRequests.push(u.href);
  const body=u.pathname.toLowerCase()==='/api/login/isauthenticated'?false:[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();await page.goto(BASE_URL+'/kqmatchups');await expect(page.locator('app-kqmatchups mat-select')).toBeVisible();
 const result=await page.evaluate(async()=>{
  const service=window.ng.probe(document.querySelector('app-kqmatchups')).componentInstance.playerService;
  const values=[];for(const value of [null,undefined,'','   ']){
   values.push(await new Promise((resolve,reject)=>service.SelectedLeagueScrambles(value).subscribe(resolve,reject)));
  }return values;
 });
 assert.deepEqual(result,[[],[],[],[]]);assert.deepEqual(weekRequests,[]);
 await page.evaluate(()=>new Promise((resolve,reject)=>window.ng.probe(document.querySelector('app-kqmatchups')).componentInstance.playerService.SelectedLeagueScrambles('Synthetic A & B #1').subscribe(resolve,reject)));
 assert.equal(weekRequests.length,1);assert(weekRequests[0].endsWith(encodeURIComponent('Synthetic A & B #1')));assert.deepEqual(writes,[]);
 const out=path.resolve(__dirname,'../score-links-evidence/null-league-client.json');fs.writeFileSync(out,JSON.stringify({passed:true,emptyInputsChecked:4,requestsForEmptyInputs:0,validNameEncoded:true,mode:'actual Angular service; intercepted API transport',databaseAccess:false},null,2));
 console.log('Angular guard passed: 4 empty inputs make no HTTP request; valid league still requests encoded URL.');await browser.close();
})().catch(async error=>{console.error(error.stack);if(browser)await browser.close();process.exitCode=1;});

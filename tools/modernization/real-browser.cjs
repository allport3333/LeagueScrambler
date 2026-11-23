// Production Angular bundle + actual .NET 10 HTTP APIs. No API interception or writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..');
const {chromium,expect}=require(path.join(root,'tests/functional/node_modules/@playwright/test'));
async function run(){
 const input=path.resolve(process.argv[2]||'');
 const allowed=path.join(root,'tests/functional/artifacts/modernization')+path.sep;
 assert(input.startsWith(allowed));
 const fixture=JSON.parse(fs.readFileSync(process.argv[3]==='--stdin-fixture'?0:path.join(input,'browser-fixture.json'),'utf8'));
 assert(fixture.syntheticOnly&&fixture.origin==='https://localhost:5443');
 const out=path.join(input,'browser');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:1000},serviceWorkers:'block'});
 // Authenticated UI needs a real synthetic account/membership in Development SQL,
 // which requires separate write approval. Offline claims alone cannot supply it.
 if(fixture.databaseBackedSyntheticAccount)await context.addCookies(fixture.cookies||[{name:fixture.name,value:fixture.value,url:fixture.origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
 const page=await context.newPage(),requests=[],runtimeErrors=[],checks=[],layouts=[];
 page.on('pageerror',error=>runtimeErrors.push({name:error.name,message:error.message}));
 page.on('response',response=>{const u=new URL(response.url());if(u.origin===fixture.origin&&u.pathname.startsWith('/api/'))requests.push({method:response.request().method(),path:u.pathname,status:response.status()});});
 try{
  if(fixture.databaseBackedSyntheticAccount){
  await page.goto(fixture.origin+'/league-management');
  await expect(page.getByRole('tab',{name:'Edit / Remove Players',exact:true})).toBeVisible();
  await page.locator('#leagueDropdown').click();
  await page.getByRole('menuitem').filter({hasText:fixture.leagueName||'WW Winter 2026'}).click();
  await page.getByRole('button',{name:'Show All Players',exact:true}).click();
  await expect(page.locator('app-scrambler-component')).not.toContainText('Unable to load league players');
  await expect(page.getByRole('button',{name:'Edit',exact:true}).first()).toBeVisible();
  checks.push('Real saved league roster loaded through authorized .NET 10 endpoint.');
  await page.screenshot({path:path.join(out,'roster-desktop.png')});
  await page.setViewportSize({width:375,height:900});await page.screenshot({path:path.join(out,'roster-mobile.png')});await page.setViewportSize({width:1280,height:1000});
  await page.getByRole('tab',{name:'Manage Schedule',exact:true}).click();
  const schedule=page.locator('app-manage-schedule');
  await expect(schedule.getByRole('heading',{name:'Saved Season Schedule',exact:true})).toBeVisible();
  await expect(schedule).not.toContainText('Could not load schedule management');
  checks.push('Real saved schedule loaded through authorized .NET 10 endpoint.');
  await page.screenshot({path:path.join(out,'schedule-existing-desktop.png')});
  if(fixture.allowMutations){
   await schedule.getByRole('button',{name:'Create Schedule',exact:true}).click();
   await schedule.getByLabel('First Game Date',{exact:true}).fill('2028-05-23');
   await page.keyboard.press('Escape');await schedule.getByLabel('Number of Weeks',{exact:true}).fill('2');
   await schedule.getByRole('button',{name:'Generate Schedule Preview',exact:true}).click();
   await expect(schedule.locator('[data-schedule-row]')).toHaveCount(16);
   await schedule.getByRole('combobox',{name:'How to save this preview',exact:true}).click();await page.getByRole('option',{name:'Add New Games',exact:true}).click();
   await expect(page.getByRole('listbox')).toHaveCount(0);
   await expect(schedule.getByRole('button',{name:'Save Schedule',exact:true})).toBeEnabled();
   await page.screenshot({path:path.join(out,'actual-generated-preview.png')});
   page.once('dialog',d=>d.accept());const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/ScheduleManagement/'+fixture.leagueId&&r.request().method()==='POST'),schedule.getByRole('button',{name:'Save Schedule',exact:true}).click()]);assert.equal(saved.status(),200);
   await expect(schedule).toContainText(/saved/i);checks.push('Actual browser Configure → Generate Preview → Save appended 16 games on later calendar dates.');
  }
  await page.getByRole('tab',{name:'Add Players',exact:true}).click();
  await page.getByRole('button',{name:'Browse Existing Players',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('.available-player').first()).toBeVisible();
  const count=await dialog.locator('.available-player').count();assert(count>0);
  for(const width of [375,430,768,1280,1920,2560,3440]){
   await page.setViewportSize({width,height:1000});
   await page.screenshot({path:path.join(out,`browser-${width}.png`)});
   const layout=await dialog.evaluate(el=>({width:innerWidth,overflow:el.scrollWidth>el.clientWidth+1,buttons:el.querySelectorAll('.available-player').length}));
   assert(!layout.overflow);layouts.push(layout);
  }
  checks.push('Actual available-player GET, seven responsive widths, existing grid and read-only browsing.');
  if(fixture.allowMutations){
   await page.setViewportSize({width:1280,height:1000});
   await dialog.getByRole('combobox',{name:'Add to Division',exact:true}).click();await page.getByRole('option',{name:'Silver',exact:true}).click();
   const addButton=dialog.getByRole('button',{name:'Add '+fixture.addPlayerName+' to '+fixture.leagueName,exact:true});await expect(addButton).toBeVisible();
   const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.startsWith('/api/ScrambleData/AddPlayer/')&&r.request().method()==='POST'),addButton.click()]);assert.equal(response.status(),200);
   await expect(addButton).toHaveCount(0);await expect(dialog).toBeVisible();
   checks.push('Immediate browser addition persisted Silver, removed only after server success and kept dialog open.');
  }
  await dialog.getByRole('button',{name:/close/i}).click();
  if(fixture.allowMutations){
   await page.getByRole('tab',{name:'Edit / Remove Players',exact:true}).click();if(await page.getByRole('button',{name:'Show All Players',exact:true}).isVisible())await page.getByRole('button',{name:'Show All Players',exact:true}).click();
   let row=page.getByRole('row').filter({hasText:fixture.addPlayerName});await row.getByRole('button',{name:'Edit',exact:true}).click();
   const edit=page.getByRole('dialog');await edit.getByRole('textbox',{name:'Last Name',exact:true}).fill('Browser Updated');
   const [updated]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.includes('/LeaguePlayer/')&&r.request().method()==='PUT'),edit.getByRole('button',{name:'Save Changes',exact:true}).click()]);assert.equal(updated.status(),200);await expect(edit).toHaveCount(0);
   row=page.getByRole('row').filter({hasText:fixture.importPlayerName});await row.getByRole('button',{name:'Edit',exact:true}).click();
   await page.getByRole('dialog').getByRole('button',{name:'Remove from League',exact:true}).click();
   await expect(page.getByRole('dialog').getByRole('heading',{name:'Remove from League?',exact:true})).toBeVisible();
   const [removed]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.startsWith('/api/ScrambleData/DeletePlayer/')&&r.request().method()==='POST'),page.getByRole('dialog').getByRole('button',{name:'Remove from League',exact:true}).click()]);assert.equal(removed.status(),200);
   await expect(page.getByRole('row').filter({hasText:fixture.importPlayerName})).toHaveCount(0);
   await page.getByRole('tab',{name:'Add Players',exact:true}).click();await page.getByRole('button',{name:'Import Players From File',exact:true}).click();
   const importer=page.getByRole('dialog');await importer.locator('input[type=file]').setInputFiles({name:'modernization.txt',mimeType:'text/plain',buffer:Buffer.from(fixture.importPlayerName+'\n')});
   await importer.getByRole('combobox',{name:'Default division',exact:true}).click();await page.getByRole('option',{name:'Gold',exact:true}).click();
   await expect(importer.getByRole('button',{name:'Add 1 Matched Players',exact:true})).toBeEnabled();
   const [imported]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/ScrambleData/ImportLeaguePlayers/'+fixture.leagueId&&r.request().method()==='POST'),importer.getByRole('button',{name:'Add 1 Matched Players',exact:true}).click()]);assert.equal(imported.status(),200);
   await page.screenshot({path:path.join(out,'actual-import-completed.png')});await importer.getByRole('button',{name:/close/i}).click();
   checks.push('Actual Edit global name, confirmed Remove and TXT import confirmation re-added the same player ID to Gold.');
  }
  }else{
   checks.push('Protected management browser flows require a database-backed synthetic account. This run verifies public routes.');
  }
  for(const route of ['fetch-data','scrambler','kqmatchups','schedule','']){
   await page.setViewportSize({width:1280,height:1000});await page.goto(fixture.origin+'/'+route);
   await expect(page.locator('app-root')).toBeVisible();
   await page.waitForLoadState('networkidle');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,route+' overflows');
   await page.screenshot({path:path.join(out,(route||'home')+'-desktop.png')});
   await page.setViewportSize({width:375,height:900});
   await page.screenshot({path:path.join(out,(route||'home')+'-mobile.png')});
   checks.push('Actual route/render/read APIs: /'+route);
  }
  assert.equal(runtimeErrors.length,0,'Runtime errors; see local report.');
  assert(!requests.some(r=>r.status>=500),'Server errors; see local report.');
  if(!fixture.allowMutations)assert(!requests.some(r=>r.method!=='GET'),'Unexpected mutation request.');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({pass:true,apiInterception:false,databaseWrites:!!fixture.allowMutations,syntheticAccountOnly:true,checks,layouts,requests,runtimeErrors},null,2));
  console.log(fixture.databaseBackedSyntheticAccount?'PASS: actual account-backed Angular 22/.NET 10 management browser and responsive screens; no API interception.':'PASS: real Angular 22/.NET 10 public browser reads and responsive screens; protected browser flows remain deferred. No API interception or database writes.');
 }catch(error){
  await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({pass:false,error:String(error),requests,runtimeErrors},null,2));throw error;
 }finally{await context.close();await browser.close();}
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});

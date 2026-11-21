const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{expect}=require('@playwright/test');
module.exports=async({page,component,out,checks})=>{
 const baseline=process.env.COMPACT_BASELINE==='1', metrics=[];
 await page.getByRole('button',{name:'Browse Existing Players',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.locator('.available-player')).toHaveCount(599);
 for(const width of [320,375,430,768,1280,1920,2560,3440]){
  await page.setViewportSize({width,height:width<500?900:1080});
  const v=await dialog.evaluate(el=>{const rect=s=>el.querySelector(s).getBoundingClientRect(),a=rect('.browser-search-row'),b=rect('.browser-filter-row'),g=rect('.available-player-grid'),button=rect('.available-player'),d=el.getBoundingClientRect();return {width:innerWidth,gridOffset:g.top-d.top,searchWidth:a.width,sameRow:Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<3,columns:Array.from(el.querySelectorAll('.available-player')).filter(e=>Math.abs(e.getBoundingClientRect().top-button.top)<2).length,buttonWidth:button.width,buttonHeight:button.height,overflow:el.scrollWidth>el.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,buttonOverflow:Array.from(el.querySelectorAll('.available-player')).some(e=>e.scrollWidth>e.clientWidth+2)};});
  assert(!v.overflow&&!v.pageOverflow&&!v.buttonOverflow,JSON.stringify(v));
  if(!baseline){assert(v.searchWidth<=521);if(width>=1280)assert(v.sameRow);if(width===375||width===430)assert.equal(v.columns,3);if(width===3440)assert(v.columns>=20);}
  metrics.push(v);await page.screenshot({animations:'disabled',path:path.join(out,'browser-'+width+'.png')});
 }
 if(!baseline){
  await expect(dialog.getByLabel('Add to Division',{exact:true})).toBeVisible();
  const top=await dialog.locator('.browser-controls').boundingBox();await dialog.locator('.browser-scroll').evaluate(e=>e.scrollTop=1000);assert.equal(Math.round((await dialog.locator('.browser-controls').boundingBox()).y),Math.round(top.y));await dialog.locator('.browser-scroll').evaluate(e=>e.scrollTop=0);
  await page.setViewportSize({width:1280,height:1000});const gridTop=(await dialog.locator('.browser-scroll').boundingBox()).y;
  await dialog.locator('[data-player-id="1004"]').click();await expect(dialog.locator('[data-player-id="1004"]')).toHaveCount(0);await expect(dialog.getByRole('status')).toContainText('Ben Chingono 004 added to Fixture League');await expect(dialog.locator('.browser-count')).toContainText('598 available');assert.equal((await dialog.locator('.browser-scroll').boundingBox()).y,gridTop);await expect(dialog).toBeVisible();
 }
 await dialog.getByRole('button',{name:'Close player browser'}).click();await expect(dialog).toHaveCount(0);
 await page.goto('https://localhost:5001/scrambler');const rules=page.locator('.scramble-rules'),summary=rules.locator('summary');await expect(summary).toBeVisible();await expect(rules).not.toHaveAttribute('open','');
 const original=await component(c=>({flags:[c.completeRandom,c.lockedResults,c.prioritizePreviousTeammates,c.allowMinimumRepeats],ids:c.selectedList.map(p=>p.id),size:c.teamSize}));const rulesMetrics=[];
 for(const width of [320,375,430,768,1280,1920,2560,3440]){
  await page.setViewportSize({width,height:width<500?950:1080});await rules.evaluate(e=>e.scrollIntoView({block:'center'}));
  const v=await rules.evaluate(el=>{const r=el.getBoundingClientRect(),card=document.querySelector('.scramble-setup').getBoundingClientRect(),workflow=document.querySelector('.scramble-workflow-actions').getBoundingClientRect();return {width:innerWidth,height:r.height,above:r.top-card.bottom,below:workflow.top-r.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,parent:el.parentElement.tagName};});
  if(!baseline){assert(v.height>=30&&v.height<=36,JSON.stringify(v));assert(v.above<=5&&v.below<=5,JSON.stringify(v));assert(!v.overflow);assert.notEqual(v.parent,'MAT-CARD');}
  rulesMetrics.push(v);await summary.evaluate(el=>el.blur());await page.screenshot({animations:'disabled',path:path.join(out,'rules-collapsed-'+width+'.png')});
  await summary.focus();await page.keyboard.press('Enter');await expect(rules).toHaveAttribute('open','');await expect(summary).toHaveAttribute('aria-expanded','true');assert.equal(await rules.getByRole('checkbox').count(),4);assert.equal(await rules.locator('.scramble-rules-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width<=700?1:2);if([375,1920].includes(width))await page.screenshot({animations:'disabled',path:path.join(out,'rules-expanded-'+width+'.png')});await page.keyboard.press('Space');await expect(rules).not.toHaveAttribute('open','');
 }
 assert.deepEqual(await component(c=>({flags:[c.completeRandom,c.lockedResults,c.prioritizePreviousTeammates,c.allowMinimumRepeats],ids:c.selectedList.map(p=>p.id),size:c.teamSize})),original);
 if(!baseline){await component(c=>{c.prioritizePreviousTeammates=true;c.allowMinimumRepeats=true;});await expect(summary).toContainText('2 options enabled');assert((await rules.boundingBox()).height<=36);await summary.click();await expect(rules.getByRole('checkbox',{name:'Prioritize fewer previous teammates',exact:true})).toBeChecked();await summary.click();await expect(summary).toContainText('2 options enabled');}
 fs.writeFileSync(path.join(out,'compact-layouts.json'),JSON.stringify({baseline,metrics,rulesMetrics,databaseWrites:false},null,2));
 checks.push('Eight widths: compact browser toolbar, unchanged responsive player buttons, fixed controls, count/name/league feedback without layout shift; 34px keyboard-accessible Rules disclosure, 4px gaps, no outer card, retained flags, two/one expanded columns and no overflow. Synthetic API fixtures only.');
};

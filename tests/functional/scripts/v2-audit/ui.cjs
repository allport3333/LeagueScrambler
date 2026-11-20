// Extend existing isolated Scrambler fixture checks; no real API or database writes.
const c=require('./common.cjs'),Module=require('module'),{fs,path,assert,write}=c;
const file=path.resolve(__dirname,'../scrambler-v2-browser.cjs');let source=fs.readFileSync(file,'utf8');
assert(source.includes('if(require.main===module)(async()=>{'));
source=source.replace('if(require.main===module)(async()=>{','if(true)(async()=>{');
const marker='  const layout=[];';assert(source.includes(marker));
source=source.replace(marker,`
  const lockedSnapshot=await component(c=>{c.lockedResults=true;c.locked=true;return JSON.stringify(c.listOfTeams);});const lockedCreates=calls.filter(c=>c.path.includes('/generatescramble/')).length;
  await component(c=>c.scramblePlayers());assert.equal(await component(c=>JSON.stringify(c.listOfTeams)),lockedSnapshot);assert.equal(calls.filter(c=>c.path.includes('/generatescramble/')).length,lockedCreates);
  await component(c=>{c.lockedResults=false;c.locked=false;c.completeRandom=true;c.prioritizePreviousTeammates=false;c.listOfScrambleNumbers=[];c.selectedList[c.selectedList.length-1].isByePlayer=true;c.numberOfTeams=10;c.teamSize=2;});
  const topReads=calls.filter(c=>c.path.includes('/gettopplayers')).length;
  await component(c=>c.scramblePlayers());assert.equal(calls.filter(c=>c.path.includes('/gettopplayers')).length,topReads);assert.deepEqual(await component(c=>c.generationResult.retainedTopIds),[]);assert.equal(await component(c=>c.listOfTeams.length),10);assert.equal(await component(c=>c.listOfTeams.reduce((n,t)=>n+t.players.length,0)),39);assert.equal(await component(c=>c.byePlayers[0].id),40);await component(c=>c.saveKingQueenTeams());assert.equal(await component(c=>c.canPrintMatchups),true);
  checks.push('Additional audit: Lock Results leaves teams unchanged without Generate POST; Completely Random ignores Top priority reads/roles, honors explicit team count over size, keeps bye40 separate, and saves the entire fixture.');
  await setup();await component(c=>{c.completeRandom=false;c.prioritizePreviousTeammates=true;});await component(c=>c.scramblePlayers());
`+marker);
const loaded=new Module(file,module);loaded.filename=file;loaded.paths=module.paths;loaded._compile(source,file);

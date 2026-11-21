// Regression snapshot of the real WW Test League Retrieve -> avoid teammates workflow.
// The fixture remaps IDs and omits names. This script never connects to a database.
const c=require('./common.cjs'),{e,assert,rng,pair,independentlyCheck,write,summary}=c;
const fixture=require('../../fixtures/ww-test-retrieve-v2.json');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads'),vm=require('vm');
const oldMethods=require('../../fixtures/scrambler-v1-methods.json');
function input(numbers,extra={}){
 const index=e.historyIndex(133,fixture.history.filter(t=>numbers.includes(t.scrambleNumber)));
 return {players:fixture.players.map(p=>({...p})),mode:'balanced',maxTeamSize:4,
  prohibitedPairs:index.frequencies.map(p=>pair(p.player1Id,p.player2Id)),...extra};
}
function inspect(config,result){
 const caps=e.capacitiesFor(config.players.filter(p=>!p.isByePlayer).length,config.maxTeamSize,config.numberOfTeams);
 independentlyCheck(config,result,caps);
 const composition=result.teams.map(t=>({male:t.filter(p=>p.isMale).length,female:t.filter(p=>!p.isMale).length}));
 return {composition,genderCost:composition.reduce((s,t)=>s+t.male*t.male+t.female*t.female,0),
  pairs:result.teams.flatMap(t=>t.flatMap((p,i)=>t.slice(i+1).map(q=>pair(p.id,q.id))))};
}
if(!isMainThread){
 (async()=>{
  const math=Object.create(Math),random=rng('real-legacy:'+workerData.seed);math.random=()=>random(16777216)/16777216;
  const source='class Legacy { calculateTeamsNeeded(){} '+Object.values(oldMethods.methods).join('\n')+' }; Legacy;';
  const code=c.ts.transpileModule(source,{compilerOptions:{target:c.ts.ScriptTarget.ES2017}}).outputText;
  const Legacy=vm.runInNewContext(code,{Math:math,console:{warn(){}}}),old=new Legacy();
  const P=fixture.players.map(p=>({...p,firstName:'Fixture',lastName:String(p.id)}));
  Object.assign(old,{selectedList:P,teamSize:4,numberOfTeams:16,completeRandom:false,totalPlayers:P.slice(),totalTopPlayers:[],totalLowPlayers:[],topPlayerCount:0,lowPlayerCount:0,listOfTeams:[],
   retrievedListOfTeams:fixture.history.filter(t=>(workerData.selected||[1]).includes(t.scrambleNumber)).map(t=>({players:t.playerIds.map(id=>P.find(p=>p.id===id))}))});
  old.fillPlayers();old.malePlayerCount=old.malePlayers.length;old.femalePlayerCount=old.femalePlayers.length;old.fillTeam();
  const start=performance.now(),ok=await old.selectPlayersWithRetries(true);
  parentPort.postMessage({ok,teams:old.listOfTeams.map(t=>t.players),milliseconds:performance.now()-start});
 })().catch(error=>parentPort.postMessage({error:error.message}));
}else(async()=>{
 const numbers=[...new Set(fixture.history.map(t=>t.scrambleNumber))],rows=[],times=[],legacy=[];
 assert.equal(fixture.players.length,64);assert.equal(fixture.players.filter(p=>p.isMale).length,47);
 // Every available saved scramble, singly selected; strict restrictions are not softened.
 for(const number of numbers)for(let seed=0;seed<6;seed++){
  const config=input([number]),r=await e.generateScramble(config,rng('real:'+number+':'+seed)),v=inspect(config,r);
  assert.equal(r.repeatedPairs.length,0);assert.equal(v.genderCost,158); // 15*(3^2+1^2)+(2^2+2^2), exact lower bound.
  assert.equal(v.composition.filter(t=>t.male===3&&t.female===1).length,15);
  assert.equal(v.composition.filter(t=>t.male===2&&t.female===2).length,1);
  assert.equal(r.balancingOptimal,true);times.push(r.elapsedMilliseconds);
  rows.push({numbers:[number],seed,nodes:r.nodes,milliseconds:r.elapsedMilliseconds,composition:v.composition,
   teams:number===1&&seed===0?r.teams.map(t=>t.map(p=>p.id)):undefined});
 }
 for(const selected of [[1,2],[1,3,6]])for(let seed=0;seed<6;seed++){
  const config=input(selected),r=await e.generateScramble(config,rng('multiple:'+selected+':'+seed)),v=inspect(config,r);
  assert.equal(r.repeatedPairs.length,0);assert.equal(v.genderCost,158);
  rows.push({numbers:selected,seed,status:r.status,genderCost:v.genderCost});
 }
 // Current attendance may differ from historical attendance; IDs and explicit byes govern eligibility.
 const byes=fixture.players.slice(0,2).map(p=>p.id);
 for(const variant of ['absent','byes','roles']){
  const config=input([1]);
  if(variant==='absent')config.players=config.players.slice(1);
  if(variant==='byes')config.players=config.players.map(p=>({...p,isByePlayer:byes.includes(p.id)}));
  if(variant==='roles'){
   config.topIds=config.players.slice(0,18).map(p=>p.id);config.lowIds=config.players.slice(0,1).concat(config.players.slice(-12)).map(p=>p.id);
   config.configuredTop=config.topIds.map((id,i)=>({playerId:id,rank:i+1}));
  }
  for(let seed=0;seed<6;seed++){
   const before=JSON.stringify(config),r=await e.generateScramble(config,rng(variant+':'+seed));inspect(config,r);assert.equal(JSON.stringify(config),before);
   if(variant==='roles'){assert.deepEqual(r.retainedTopIds,config.topIds.slice(0,16));assert.deepEqual(r.demotedTopIds,config.topIds.slice(16));}
  }
 }
 // Scope/selection oracle: only within-team pairs from the chosen saved scrambles count.
 const selected=e.historyIndex(133,fixture.history.filter(t=>t.scrambleNumber===1));assert.equal(selected.frequencies.length,96);
 const first=fixture.history.filter(t=>t.scrambleNumber===1),opponents=pair(first[0].playerIds[0],first[1].playerIds[0]);
 assert(!selected.frequencies.some(p=>pair(p.player1Id,p.player2Id)===opponents));
 const unrelated={...first[0],leagueId:999,teamId:999,playerIds:[1,64]};
 assert.deepEqual(e.historyIndex(133,first.concat([unrelated,{...unrelated,leagueId:133,saved:false}])).frequencies,selected.frequencies);
 // True impossibility and timeout remain separate, and fallback still requires proof.
 const P=Array.from({length:4},(_,i)=>({id:i+1,isMale:i<3,firstName:'Same',lastName:'Name'})),blocked=P.flatMap((p,i)=>P.slice(i+1).map(q=>pair(p.id,q.id)));
 const impossible={players:P,mode:'balanced',numberOfTeams:2,prohibitedPairs:blocked};
 assert.equal((await e.generateScramble(impossible,rng('impossible'))).status,'impossible');
 const relaxed=await e.generateScramble({...impossible,allowMinimumRepeats:true},rng('fallback'));
 assert.equal(relaxed.status,'success');assert(relaxed.strictImpossible&&relaxed.minimumRepeatsProven);assert.equal(relaxed.repeatedPairs.length,2);
 const exhausted=await e.generateScramble({...input([1]),maxNodes:0,allowMinimumRepeats:true},rng('budget'));
 assert.equal(exhausted.status,'budget-exhausted');assert.equal(exhausted.strictImpossible,false);assert.equal(exhausted.teams.length,0);
 // The original algorithm uses the exact same roster and historical memberships, independently validated by IDs.
 for(let seed=0;seed<3;seed++){
  const result=await new Promise(resolve=>{
   const worker=new Worker(__filename,{workerData:{seed}}),timer=setTimeout(()=>{worker.terminate();resolve({timedOut:true,limitMs:5000});},5000);
   worker.once('message',value=>{clearTimeout(timer);worker.terminate();resolve(value);});worker.once('error',error=>{clearTimeout(timer);resolve({error:error.message});});
  });
  if(result.ok){const config=input([1]),v=inspect(config,{status:'success',teams:result.teams,byes:[],retainedTopIds:[],repeatedPairs:[],historyCost:0});legacy.push({seed,valid:true,milliseconds:result.milliseconds,genderCost:v.genderCost,composition:v.composition});}
  else legacy.push({seed,...result});
 }
 assert(legacy.some(r=>r.valid),'Legacy comparison did not produce a validated witness');
 write('retrieve-history-regression',{pass:true,source:fixture.source,singleHistoricalRuns:numbers.length*6,multipleHistoricalRuns:12,attendanceAndRoleRuns:18,
  strictPairCount:96,assignmentWitness:rows[0],generationMilliseconds:summary(times),legacy,rows,
  actualDatabaseWrites:0,scopeAndIdentity:true,strictFallbackMinimum:2,budgetOutcome:exhausted.status});
 console.log(JSON.stringify({pass:true,singleHistoricalRuns:numbers.length*6,multipleHistoricalRuns:12,attendanceAndRoleRuns:18,generationMilliseconds:summary(times),legacy:legacy.map(({composition,...r})=>r)}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

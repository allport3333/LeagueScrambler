// Whole-arrangement gender optimality, including a reproducible real-history local minimum.
// No HTTP, authentication, or database writes. Fixture IDs are anonymized.
const c=require('./common.cjs'),{e,assert,rng,pair,allocations,independentlyCheck,write,summary,key}=c;
const fixture=require('../../fixtures/ww-test-retrieve-v2.json'),{Worker}=require('worker_threads');
const selected=[1,2,3,4,5,6,11,12],label='gender-counterexample:'+selected+':2';
const pool=(n,m)=>Array.from({length:n},(_,i)=>({id:i+1,isMale:i<m,firstName:'Same',lastName:'Name'}));
function config(numbers=selected,extra={}){const h=e.historyIndex(133,fixture.history.filter(t=>numbers.includes(t.scrambleNumber)));return {players:fixture.players.map(p=>({...p})),mode:'balanced',maxTeamSize:4,prohibitedPairs:h.frequencies.map(p=>pair(p.player1Id,p.player2Id)),...extra};}
const cost=teams=>teams.reduce((s,t)=>{const m=t.filter(p=>p.isMale).length;return s+m*m+(t.length-m)**2;},0);
const comps=r=>r.teams.map(t=>({male:t.filter(p=>p.isMale).length,female:t.filter(p=>!p.isMale).length}));
function check(input,r,expected,repeatLimit=0){const caps=e.capacitiesFor(input.players.filter(p=>!p.isByePlayer).length,input.maxTeamSize,input.numberOfTeams);independentlyCheck(input,r,caps,{repeatLimit});assert.equal(cost(r.teams),expected);return comps(r);}
(async()=>{
 const rows=[],legacy=[],timings=[],diversity=new Set(),base=config();assert.equal(base.prohibitedPairs.length,663);
 const witness=await e.generateScramble(base,rng(label));check(base,witness,158);assert(witness.teams.every(t=>t.some(p=>!p.isMale)));
 for(const [numbers,runs] of [[[],12],[[1],12],[selected,30]])for(let seed=0;seed<runs;seed++){
  const input=config(numbers),r=await e.generateScramble(input,rng('gender-fixed:'+numbers+':'+seed));assert.equal(r.status,'success',JSON.stringify({numbers,seed,status:r.status,reason:r.reason,nodes:r.nodes}));check(input,r,158);
  assert(r.teams.every(t=>t.some(p=>!p.isMale)));diversity.add(key(r.teams));timings.push(r.elapsedMilliseconds);rows.push({numbers,seed,status:r.status,nodes:r.nodes,milliseconds:r.elapsedMilliseconds,composition:comps(r)});
 }
 assert(diversity.size>40);
 const history=e.historyIndex(133,fixture.history).frequencies;
 for(const mode of ['preference','fallback','top-low','female-top','mixed-top'])for(let seed=0;seed<6;seed++){
  const input=config();
  if(mode==='preference'){input.prioritizeHistory=true;input.frequencies=history;}
  if(mode==='fallback')input.allowMinimumRepeats=true;
  if(mode==='top-low'){input.topIds=input.players.slice(0,18).map(p=>p.id);input.configuredTop=input.topIds.map((id,i)=>({playerId:id,rank:i+1}));input.lowIds=input.players.slice(0,1).concat(input.players.slice(-12)).map(p=>p.id);}
  if(mode==='female-top'||mode==='mixed-top'){
   const male=input.players.filter(p=>p.isMale),female=input.players.filter(p=>!p.isMale);
   input.topIds=(mode==='female-top'?female.slice(0,16):male.slice(0,9).concat(female.slice(0,9))).map(p=>p.id);
   input.configuredTop=input.topIds.map((id,i)=>({playerId:id,rank:i+1}));
  }
  const before=JSON.stringify(input),r=await e.generateScramble(input,rng(mode+':'+seed));check(input,r,158);assert.equal(JSON.stringify(input),before);
  assert.equal(r.strictImpossible,false);assert.equal(r.repeatedPairs.length,0);
  rows.push({mode,seed,status:r.status,milliseconds:r.elapsedMilliseconds,composition:comps(r)});
 }
 for(const [n,m,t] of [[64,47,16],[40,30,10],[40,34,10],[32,16,8],[16,13,4],[15,10,4]])for(let seed=0;seed<6;seed++){
  const input={players:pool(n,m),mode:'balanced',numberOfTeams:t},r=await e.generateScramble(input,rng('counts:'+n+':'+m+':'+seed));
  // Enumerate gender counts only, independently of the engine's lower bound/search.
  const caps=Array.from({length:t},(_,i)=>Math.floor(n/t)+(i<n%t?1:0));let dp=new Map([[0,0]]);
  for(const size of caps){const next=new Map();for(const [used,z] of dp)for(let male=0;male<=size&&used+male<=m;male++){const v=z+male*male+(size-male)**2,k=used+male;next.set(k,Math.min(next.has(k)?next.get(k):Infinity,v));}dp=next;}
  check(input,r,dp.get(m));if(n===40&&m===34)assert.equal(r.teams.filter(t=>t.every(p=>p.isMale)).length,4);
 }
 // Exhaustive independent allocation oracle: ideal gender balance can genuinely be
 // impossible, but that must not mean strict teammate avoidance is impossible.
 let oracleCases=0,compromises=0;
 const small=pool(4,2),smallAllocations=allocations(small.map(p=>p.id),[2,2]),smallEdges=small.flatMap((p,i)=>small.slice(i+1).map(q=>pair(p.id,q.id)));
 for(const topIds of [[],[1,3]])for(let mask=0;mask<64;mask++){
  const blocked=smallEdges.filter((_,i)=>mask&(1<<i)),set=new Set(blocked),candidates=smallAllocations.filter(ts=>ts.every(t=>t.filter(id=>topIds.includes(id)).length<=1)).map(ts=>({teams:ts,repeats:ts.filter(t=>set.has(pair(...t))).length,gender:cost(ts.map(t=>t.map(id=>small.find(p=>p.id===id))))}));
  const repeats=Math.min(...candidates.map(t=>t.repeats)),gender=Math.min(...candidates.filter(t=>t.repeats===repeats).map(t=>t.gender)),input={players:small,mode:'balanced',numberOfTeams:2,topIds,prohibitedPairs:blocked};
  const strict=await e.generateScramble(input,rng('all-graphs-strict:'+mask+':'+topIds));
  if(repeats)assert.equal(strict.status,'impossible');else check(input,strict,gender);
  const r=await e.generateScramble({...input,allowMinimumRepeats:true},rng('all-graphs-relaxed:'+mask+':'+topIds));check({...input,allowMinimumRepeats:true},r,gender,repeats);assert.equal(r.repeatedPairs.length,repeats);oracleCases++;
 }
 const P=pool(6,4),all=allocations(P.map(p=>p.id),[3,3]),edges=['1:2','1:5','1:6','2:5','2:6','3:4','3:5','3:6','4:5','4:6'];
 for(let seed=0;seed<80;seed++){
  const random=rng('gender-oracle:'+seed),blocked=edges.filter(()=>random(2)),topIds=seed%3===0?[1,5]:[],set=new Set(blocked);
  const candidates=all.filter(ts=>ts.every(t=>t.filter(id=>topIds.includes(id)).length<=1)).map(ts=>({ids:ts,repeats:ts.reduce((s,t)=>s+t.reduce((s,a,i)=>s+t.slice(i+1).filter(b=>set.has(pair(a,b))).length,0),0),gender:cost(ts.map(t=>t.map(id=>P.find(p=>p.id===id))))}));
  const minimumRepeats=Math.min(...candidates.map(t=>t.repeats)),gender=Math.min(...candidates.filter(t=>t.repeats===minimumRepeats).map(t=>t.gender));
  const input={players:P,mode:'balanced',numberOfTeams:2,topIds,prohibitedPairs:blocked,allowMinimumRepeats:true},r=await e.generateScramble(input,random);
  check(input,r,gender,minimumRepeats);assert.equal(r.repeatedPairs.length,minimumRepeats);assert.equal(r.strictImpossible,minimumRepeats>0);if(gender>10){compromises++;assert.match(r.reason,/Ideal gender balance is impossible/);}oracleCases++;
 }
 const forced=pool(8,6),cross=forced.slice(0,4).flatMap(p=>forced.slice(4).map(q=>pair(p.id,q.id))),forcedInput={players:forced,mode:'balanced',numberOfTeams:2,prohibitedPairs:cross};
 const required=await e.generateScramble(forcedInput,rng('forced-compromise'));check(forcedInput,required,24);assert.equal(required.strictImpossible,false);assert.match(required.reason,/best feasible balance/);
 // Budget exhaustion is not permission to return the first, four-man solution.
 const exhausted=await e.generateScramble({...base,maxNodes:65},rng(label));assert.equal(exhausted.status,'budget-exhausted');assert.equal(exhausted.strictImpossible,false);assert.equal(exhausted.teams.length,0);assert.match(exhausted.reason,/gender balance/);
 for(let seed=0;seed<3;seed++){
  const result=await new Promise(resolve=>{const worker=new Worker(require.resolve('./retrieve-history-regression.cjs'),{workerData:{seed,selected}}),timer=setTimeout(()=>{worker.terminate();resolve({timedOut:true,externalLimitMs:5000});},5000);worker.once('message',r=>{clearTimeout(timer);worker.terminate();resolve(r);});worker.once('error',error=>{clearTimeout(timer);resolve({error:error.message});});});
  if(result.ok){try{check(base,{status:'success',teams:result.teams,byes:[],retainedTopIds:[],repeatedPairs:[],historyCost:0},158);legacy.push({seed,valid:true,milliseconds:result.milliseconds,composition:result.teams.map(t=>t.filter(p=>p.isMale).length)});}catch(error){legacy.push({seed,valid:false,reason:error.message});}}
  else legacy.push({seed,...result});
 }
 write('gender-balance-regression',{pass:true,source:fixture.source,selectedHistoricalScrambles:selected,prohibitedPairs:663,roster:{players:64,male:47,female:17,teams:16,teamSize:4,top:[],low:[],byes:[]},
  counterexampleLabel:label,witness:witness.teams.map(t=>t.map(p=>p.id)),witnessComposition:comps(witness),witnessRepeats:witness.repeatedPairs.length,rows,
  ordinaryAndHistoryRuns:54,optionRuns:30,attendanceRuns:36,oracleCases,compromises,diversity:diversity.size,timing:summary(timings),budgetOutcome:exhausted.status,legacy,actualDatabaseWrites:0});
 console.log(JSON.stringify({pass:true,ordinaryAndHistoryRuns:54,optionRuns:30,attendanceRuns:36,oracleCases,compromises,diversity:diversity.size,timing:summary(timings),legacy}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

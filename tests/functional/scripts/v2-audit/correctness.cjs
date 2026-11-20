const c=require('./common.cjs'),{e,assert,rng,shuffle,pair,key,unlabeled,allocations,independentlyCheck,write,fit,summary}=c;
const people=(n,m=n)=>Array.from({length:n},(_,i)=>({id:i+1,isMale:i<m,firstName:'Same',lastName:'Name'}));
const allPairs=ids=>ids.flatMap((a,i)=>ids.slice(i+1).map(b=>pair(a,b)));
(async()=>{
 const started=performance.now(),counts={graphs:0,strictValid:0,strictImpossible:0,fallbackMinimum:0,uniqueSolutionGraphs:0},soft=[],topCases=[],ordering=[];
 // Independent combinatorial oracle: no engine allocator, validator or pair index is used.
 for(const n of [5,6])for(const tops of [[],[1,2]]){
  const caps=n===5?[3,2]:[2,2,2],P=people(n),edges=allPairs(P.map(p=>p.id)),all=allocations(P.map(p=>p.id),caps).filter(ts=>ts.every(t=>t.filter(id=>tops.includes(id)).length<=1));
  for(let graph=0;graph<(n===5?1024:256);graph++){
   const r=rng('graph:'+n+':'+graph+':'+tops.join(',')),bits=n===5?graph:r(1<<edges.length),blocked=edges.filter((_,i)=>bits&(1<<i)),set=new Set(blocked),cost=t=>t.reduce((s,team)=>s+allPairs(team).filter(p=>set.has(p)).length,0),min=Math.min(...all.map(cost)),valid=all.filter(t=>cost(t)===0),input={players:P,mode:'balanced',numberOfTeams:caps.length,topIds:tops,prohibitedPairs:blocked,improveSteps:0,maxMilliseconds:5000};
   const before=JSON.stringify(P),strict=await e.generateScramble(input,r);counts.graphs++;
   if(min===0){assert.equal(strict.status,'success');independentlyCheck(input,strict,caps);assert.equal(strict.strictImpossible,false);counts.strictValid++;if(new Set(valid.map(unlabeled)).size===1)counts.uniqueSolutionGraphs++;}
   else{assert.equal(strict.status,'impossible',JSON.stringify({n,tops,graph,min,reason:strict.reason}));assert.equal(strict.teams.length,0);assert.equal(strict.strictImpossible,true);counts.strictImpossible++;}
   const relaxed=await e.generateScramble({...input,allowMinimumRepeats:true},r);independentlyCheck(input,relaxed,caps,{repeatLimit:min});assert.equal(relaxed.repeatedPairs.length,min);assert.equal(relaxed.minimumRepeatsProven,true);assert.equal(relaxed.strictImpossible,min>0);counts.fallbackMinimum++;
   assert.equal(JSON.stringify(P),before);
  }
 }
 for(const [teams,tops] of [[10,12],[10,10],[10,8],[6,10]])for(const source of ['configured','standings'])for(const male of [16,24,32]){
  const players=people(40,male),candidateIds=players.slice(0,tops).map(p=>p.id),priority=candidateIds.slice().reverse(),input={players,mode:'balanced',numberOfTeams:teams,topIds:candidateIds,lowIds:[1,30,31,32,33,34,35,36,37,38,39,40],configuredTop:source==='configured'?priority.map((id,i)=>({playerId:id,rank:i+1})):[],standings:priority.map((id,i)=>({playerId:id,totalScore:1000-i,totalScoreBeforeReduction:1000-i,playerName:'Same Name'}))};
  // Deliberately conflicting standings: explicitly configured rank must win.
  if(source==='configured')input.standings=candidateIds.map((id,i)=>({playerId:id,totalScore:2000-i,playerName:'Same Name'}));
  const frozen=JSON.stringify(input),r=await e.generateScramble(input,rng('top:'+teams+':'+tops+':'+source+':'+male));independentlyCheck(input,r,Array.from({length:teams},(_,i)=>Math.floor(40/teams)+(i<40%teams?1:0)));assert.deepEqual(r.retainedTopIds,priority.slice(0,teams));assert.deepEqual(r.demotedTopIds,priority.slice(teams));assert.equal(JSON.stringify(input),frozen);topCases.push({teams,tops,source,male,retained:r.retainedTopIds,demoted:r.demotedTopIds,balancedOptimal:r.balancingOptimal});
 }
 assert.equal((await e.generateScramble({players:people(8),mode:'balanced',numberOfTeams:2,topIds:[1,2,3]},rng('missing'))).status,'invalid-configuration');
 const ties=await e.generateScramble({players:people(8),mode:'balanced',numberOfTeams:2,topIds:[4,3,2,1],configuredTop:[1,2,3,4].map(id=>({playerId:id,rank:1})),standings:[1,2,3,4].map(id=>({playerId:id,totalScore:20,totalScoreBeforeReduction:20,playerName:'Same Name'}))},rng('ties'));assert.deepEqual(ties.retainedTopIds,[1,2]);
 for(const n of [8,9,16,17,24,25,32,33,40,41,63,80])for(const max of [2,3,4,5]){
  const p=people(n,Math.floor(n*.63)),teams=2*Math.ceil(n/(2*max)),caps=Array.from({length:teams},(_,i)=>Math.floor(n/teams)+(i<n%teams?1:0));
  const input={players:shuffle(p,rng('uneven-input:'+n+':'+max)),mode:'balanced',maxTeamSize:max},r=await e.generateScramble(input,rng('uneven:'+n+':'+max));independentlyCheck(input,r,caps);assert.equal(r.balancingOptimal,true);ordering.push({n,max,teams,optimal:r.balancingOptimal});
 }
 // Compare whole-arrangement soft metrics to exact small oracles without claiming every local optimum is global.
 for(let seed=0;seed<100;seed++){
  const P=people(6,3),all=allocations(P.map(p=>p.id),[2,2,2]),random=rng('soft:'+seed),freq=allPairs(P.map(p=>p.id)).map(k=>({player1Id:+k.split(':')[0],player2Id:+k.split(':')[1],count:random(6)})),weights=new Map(freq.map(p=>[pair(p.player1Id,p.player2Id),p.count]));
  const metric=t=>[t.reduce((s,team)=>{const m=team.filter(id=>id<=3).length;return s+m*m+(team.length-m)**2;},0),t.reduce((s,team)=>s+allPairs(team).reduce((a,p)=>a+(weights.get(p)||0),0),0)];
  const best=all.map(metric).sort((a,b)=>a[0]-b[0]||a[1]-b[1])[0],input={players:P,mode:'balanced',numberOfTeams:3,prioritizeHistory:true,frequencies:freq},r=await e.generateScramble(input,random);independentlyCheck(input,r,[2,2,2]);const actual=metric(r.teams.map(t=>t.map(p=>p.id)));assert.equal(actual[0],best[0]);if(r.historyOptimal)assert.equal(actual[1],best[1]);soft.push({seed,exactHistoryMinimum:best[1],actualHistoryCost:actual[1],reportedHistoryOptimal:r.historyOptimal});
 }
 const saved=[{leagueId:1,teamId:1,scrambleNumber:1,saved:true,playerIds:[1,2,3,3]},{leagueId:1,teamId:1,scrambleNumber:1,saved:true,playerIds:[3,2,1]},{leagueId:1,teamId:2,scrambleNumber:2,saved:true,playerIds:[1,2]},{leagueId:2,teamId:3,scrambleNumber:1,saved:true,playerIds:[1,4]},{leagueId:1,teamId:4,scrambleNumber:3,saved:false,playerIds:[1,4]},{leagueId:1,teamId:5,scrambleNumber:3,saved:true,bye:true,playerIds:[1,4]}];
 assert.deepEqual(e.historyIndex(1,saved).frequencies.sort((a,b)=>a.player1Id-b.player1Id||a.player2Id-b.player2Id),[{player1Id:1,player2Id:2,count:2},{player1Id:1,player2Id:3,count:1},{player1Id:2,player2Id:3,count:1}]);
 const originalTeams=[[1,2,3],[4,5,6],[7,8,9],[10,11,12]].map(t=>t.map(id=>({id,isMale:id%3!==0}))),originalMembership=unlabeled(originalTeams),pairingCounts=new Map();for(let i=0;i<1000;i++){const ordered=e.pairByComposition(originalTeams,rng('pair-order:'+i));assert.equal(unlabeled(ordered),originalMembership);const k=key(ordered);pairingCounts.set(k,(pairingCounts.get(k)||0)+1);}assert.equal(pairingCounts.size,24);
 const constrained={players:people(8,4),mode:'balanced',numberOfTeams:4,prohibitedPairs:['1:2'],allowMinimumRepeats:true};
 const exhausted=await e.generateScramble({...constrained,maxNodes:0},rng('budget'));assert.equal(exhausted.status,'budget-exhausted');assert.equal(exhausted.strictImpossible,false);assert.equal(exhausted.teams.length,0);
 assert.equal((await e.generateScramble({...constrained,cancelled:()=>true},rng('cancel'))).status,'cancelled');assert.equal((await e.generateScramble(constrained,()=>{throw Error('injected');})).status,'unexpected-error');
 write('correctness',{pass:true,elapsedMs:performance.now()-started,exhaustive:counts,topCases,unevenConfigurations:ordering,softOracle:{caseCount:soft.length,achievedExact:soft.filter(x=>x.exactHistoryMinimum===x.actualHistoryCost).length,neverOverclaims:true,cases:soft},pairing:{runs:1000,equalCompositionPermutations:pairingCounts.size,fit:fit(Array.from(pairingCounts.values()))},budget:exhausted.status,sourceMutation:false});console.log('PASS',counts,'top cases',topCases.length,'uneven',ordering.length);
})().catch(error=>{write('correctness-failure',{message:error.message,stack:error.stack});console.error(error.stack);process.exitCode=1;});

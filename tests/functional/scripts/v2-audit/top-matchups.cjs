// Pure synthetic matchup and structured-report checks. No HTTP/database access.
const c=require('./common.cjs'),{e,assert,rng,shuffle,unlabeled,fit,write}=c;
const pool=(n,m)=>Array.from({length:n},(_,i)=>({id:i+1,isMale:i<m,firstName:'Same',lastName:'Name'}));
const makeTeams=counts=>counts.map((male,t)=>Array.from({length:4},(_,p)=>({id:4*t+p+1,isMale:p<male,isTopPlayer:true})));
const distance=(a,b)=>Math.abs(a.filter(p=>p.isMale).length-b.filter(p=>p.isMale).length)+Math.abs(a.filter(p=>!p.isMale).length-b.filter(p=>!p.isMale).length);
function metrics(teams,ids){let tt=0,cost=0;const tops=new Set(ids);for(let i=0;i+1<teams.length;i+=2){tt+=Number(teams[i].some(p=>tops.has(p.id))&&teams[i+1].some(p=>tops.has(p.id)));cost+=distance(teams[i],teams[i+1]);}return {tt,cost};}
function allMatchings(items){if(!items.length)return [[]];const result=[];for(let i=1;i<items.length;i++)for(const tail of allMatchings(items.slice(1).filter((_,j)=>j!==i-1)))result.push([[items[0],items[i]],...tail]);return result;}
(async()=>{
 const examples=[],oracle=[],partners=[0,0,0],oddLeft=[0,0,0],oddByes=Array(9).fill(0);
 for(let n=1;n<=12;n++)for(let topCount=0;topCount<=n;topCount++)for(let seed=0;seed<12;seed++){
  const teams=makeTeams(Array.from({length:n},(_,i)=>2+i%2)),ids=teams.slice(0,topCount).map(t=>t[0].id),before=JSON.stringify(teams),r=e.pairByComposition(teams,rng('pair:'+n+':'+topCount+':'+seed),ids);
  assert.equal(metrics(r,ids).tt,Math.floor(topCount/2));assert.equal(unlabeled(r),unlabeled(teams));assert.equal(JSON.stringify(teams),before);
  for(const team of r)for(const p of team)assert(teams.some(original=>original.includes(p)));
 }
 for(const count of [3,4,6,10]){
  const input={players:pool(40,24),mode:'balanced',numberOfTeams:10,topIds:Array.from({length:count},(_,i)=>i+1)},r=await e.generateScramble(input,rng('example:'+count));
  c.independentlyCheck(input,r,Array(10).fill(4));assert.equal(metrics(r.teams,r.retainedTopIds).tt,Math.floor(count/2));assert.deepEqual(r.issues,[]);
  examples.push({topPlayers:count,topMatches:metrics(r.teams,r.retainedTopIds).tt,issues:r.issues});
 }
 // Top-vs-Top has priority over a perfect opposing composition match.
 const conflict=makeTeams([3,2,3,2]),prioritized=e.pairByComposition(conflict,rng('priority'),[1,5]);
 assert.equal(metrics(prioritized,[1,5]).tt,1);assert.equal(metrics(prioritized,[1,5]).cost,4);
 // Exact minimum composition difference among maximum Top pairings for even,
 // equal-size small cases; enumerate every matching independently.
 for(let seed=0;seed<160;seed++){
  const random=rng('matching-oracle:'+seed),n=seed%2?6:8,teams=makeTeams(Array.from({length:n},()=>random(5))),topCount=2+random(n-1),ids=teams.slice(0,topCount).map(t=>t[0].id);
  const all=allMatchings(teams),scores=all.map(pairs=>metrics(pairs.flat(),ids)),bestTop=Math.max(...scores.map(s=>s.tt)),bestCost=Math.min(...scores.filter(s=>s.tt===bestTop).map(s=>s.cost));
  const r=e.pairByComposition(shuffle(teams,random),random,ids),actual=metrics(r,ids);assert.equal(actual.tt,bestTop);assert.equal(actual.cost,bestCost);oracle.push({seed,n,topCount,cost:actual.cost});
 }
 // Equivalent partners / odd unmatched Top identity vary, without index preference.
 for(let seed=0;seed<3000;seed++){
  const teams=makeTeams(Array(10).fill(3)),ids=teams.slice(0,4).map(t=>t[0].id),r=e.pairByComposition(teams,rng('partners:'+seed),ids),at=r.findIndex(t=>t.some(p=>p.id===1)),partner=r[at%2?at-1:at+1][0].id;
  partners[[5,9,13].indexOf(partner)]++;
  const oddIds=[1,5,9],odd=e.pairByComposition(teams,rng('odd:'+seed),oddIds);
  for(let i=0;i<odd.length;i+=2){const a=odd[i].find(p=>oddIds.includes(p.id)),b=odd[i+1].find(p=>oddIds.includes(p.id));if(!!a!==!!b)oddLeft[oddIds.indexOf((a||b).id)]++;}
  const byeTeams=makeTeams(Array(9).fill(3)),byeResult=e.pairByComposition(byeTeams,rng('byes:'+seed),[1,5,9]);oddByes[(byeResult[8][0].id-1)/4]++;
 }
 assert(fit(partners).chiSquare<28);assert(fit(oddLeft).chiSquare<28);assert(oddByes.every(n=>n>0));
 const ordinary=await e.generateScramble({players:pool(64,47),mode:'balanced',numberOfTeams:16,topIds:[1,2,3]},rng('odd-gender-top'));
 assert.equal(ordinary.status,'success');assert.deepEqual(ordinary.issues,[]);assert(ordinary.teams.every(t=>t.some(p=>!p.isMale)));
 const overflow=await e.generateScramble({players:pool(40,24),mode:'balanced',numberOfTeams:10,topIds:Array.from({length:12},(_,i)=>i+1),configuredTop:Array.from({length:12},(_,i)=>({playerId:i+1,rank:i+1}))},rng('overflow'));
 assert.equal(overflow.status,'success');assert.equal(overflow.demotedTopIds.length,2);assert.deepEqual(overflow.issues,[]);
 const people=pool(4,4),blocked=people.flatMap((p,i)=>people.slice(i+1).map(q=>e.pairKey(p.id,q.id))),base={players:people,mode:'balanced',numberOfTeams:2,prohibitedPairs:blocked};
 const impossible=await e.generateScramble(base,rng('impossible'));assert.equal(impossible.status,'impossible');assert(impossible.issues.some(i=>i.code==='impossible'));
 const fallback=await e.generateScramble({...base,allowMinimumRepeats:true},rng('fallback'));assert.equal(fallback.status,'success');assert.equal(fallback.repeatedPairs.length,2);assert(fallback.issues.some(i=>i.code==='repeated-teammates'));
 const budget=await e.generateScramble({...base,maxNodes:0},rng('budget'));assert.equal(budget.status,'budget-exhausted');assert(!budget.strictImpossible);assert(budget.issues.some(i=>i.code==='budget-exhausted'));
 const gender=await e.generateScramble({players:pool(4,2),mode:'balanced',numberOfTeams:2,prohibitedPairs:['1:3','1:4','2:3','2:4']},rng('compromise'));assert.equal(gender.status,'success');assert(gender.issues.some(i=>i.code==='gender-balance-compromise'));
 const low=await e.generateScramble({...base,prohibitedPairs:['1:3','1:4','2:3','2:4'],lowIds:[1,2]},rng('low'));assert.equal(low.status,'success');assert(low.issues.some(i=>i.code==='low-balance-unresolved'));
 const frequencies=people.flatMap((p,i)=>people.slice(i+1).map(q=>({player1Id:p.id,player2Id:q.id,count:1}))),history=await e.generateScramble({players:people,mode:'balanced',numberOfTeams:2,prioritizeHistory:true,frequencies},rng('soft-history'));
 assert(history.historyCost>0&&!history.historyOptimal);assert(history.warnings.length);assert.deepEqual(history.issues,[]);
 write('top-matchups',{pass:true,examples,pairingCases:12*12*0+Object.values(Array.from({length:12},(_,i)=>(i+2)*12)).reduce((s,n)=>s+n,0),exactMatchingOracleCases:oracle.length,oracle,
  equivalentPairingRuns:3000,partnerCounts:partners,partnerFit:fit(partners),oddTopLeftoverCounts:oddLeft,oddTopFit:fit(oddLeft),oddTeamByeCounts:oddByes,
  ordinaryIssues:ordinary.issues,overflowIssues:overflow.issues,failureIssues:impossible.issues,budgetIssues:budget.issues,compromiseIssues:gender.issues,fallbackIssues:fallback.issues,softPreferenceIssues:history.issues,databaseAccess:false});
 console.log(JSON.stringify({pass:true,examples,exactMatchingOracleCases:oracle.length,partnerCounts:partners,partnerChiSquare:fit(partners).chiSquare,oddTopCounts:oddLeft,oddTopChiSquare:fit(oddLeft).chiSquare,oddTeamByeCounts:oddByes}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

const c=require('./common.cjs'),{e,assert,rng,shuffle,pair,key,allocations,independentlyCheck,write,fit,homogeneity,holm,wilson,summary}=c;
const phase=process.argv[2]||'random',N=phase==='random'?120000:12000;
const ids=phase==='random'?[101,7,88,43,999,12]:[101,7,88,43,999,12,65,202],names=['Zeta','Able','Xenia','Mira','Dora','Quin','Belle','Una'];
const players=ids.map((id,i)=>({id,firstName:names[i],lastName:'Audit',isMale:i<ids.length/2}));
const byName=players.slice().sort((a,b)=>a.firstName.localeCompare(b.firstName)),byId=players.slice().sort((a,b)=>a.id-b.id);
const orders=[['alphabetical',byName],['reverse-alphabetical',byName.slice().reverse()],['id',byId],['reverse-id',byId.slice().reverse()],['ranking',players.slice().sort((a,b)=>ids.indexOf(b.id)-ids.indexOf(a.id))],['shuffled',shuffle(players,rng('input-order'))]];
const caps=Array(ids.length/2).fill(2),T=caps.length,all=allocations(ids.slice().sort((a,b)=>a-b),caps).filter(ts=>phase==='random'||ts.every(t=>t.filter(id=>players.find(p=>p.id===id).isMale).length===1)),arrangements=all.map(key).sort(),indices=new Map(arrangements.map((s,i)=>[s,i]));
const results=[],tests=[],started=performance.now();
(async()=>{
 if(phase==='random')global.window={crypto:c.crypto.webcrypto};
 for(const [name,ordered] of orders){
  const useCrypto=phase==='random'&&name==='alphabetical',r=useCrypto?undefined:rng(phase+':'+name),input={players:ordered,mode:phase==='random'?'random':'balanced',numberOfTeams:T};
  if(phase==='roles'){input.topIds=ids.slice(0,2);input.lowIds=ids.slice(4,6);}
  const counts=Array(arrangements.length).fill(0),placements=ids.map(()=>Array(T).fill(0)),pairs=new Map();let failures=0,optimal=0,firstLastJoint=Array.from({length:T},()=>Array(T).fill(0));
  for(let i=0;i<N;i++){
   const result=await e.generateScramble(input,r);independentlyCheck(input,result,caps);const k=key(result.teams),index=indices.get(k);assert.notEqual(index,undefined,k);counts[index]++;if(result.balancingOptimal)optimal++;
   result.teams.forEach((t,j)=>{t.forEach(p=>placements[ids.indexOf(p.id)][j]++);const k=pair(t[0].id,t[1].id);pairs.set(k,(pairs.get(k)||0)+1);});
   firstLastJoint[result.teams.findIndex(t=>t.some(p=>p.id===ids[0]))][result.teams.findIndex(t=>t.some(p=>p.id===ids[ids.length-1]))]++;
  }
  const placementFits=placements.map(fit),arrangementFit=fit(counts),pairFits=fit(Array.from(pairs.values()));tests.push({name:name+':arrangements',diagnostic:phase!=='random',...arrangementFit});placementFits.forEach((f,i)=>tests.push({name:name+':player:'+ids[i],...f}));
  const pairProbability=phase==='random'?1/(ids.length-1):1/(ids.length/2),pairIntervals=Array.from(pairs,([players,count])=>({players,count,...wilson(count,N)}));
  const row={name,inputIds:ordered.map(p=>p.id),rng:useCrypto?'production secureRandomInt with Node WebCrypto':'injected xoshiro128** named SHA256 seed',runs:N,counts,placements,pairIntervals,expectedPairProbability:pairProbability,arrangementFit,placementFits,pairFitDiagnostic:pairFits,firstLastJoint,optimal,failures};results.push(row);
  write(phase+'-partial',{runs:N,results,progress:name});console.log(phase,name,'joint p',arrangementFit.p,'TV',arrangementFit.totalVariation,'maxPlacementDelta',Math.max(...placementFits.map(f=>f.maxProbabilityDeviation)));
 }
 tests.push({name:'cross-order-arrangements',diagnostic:phase!=='random',...homogeneity(results.map(r=>r.counts))});for(let i=0;i<ids.length;i++)tests.push({name:'cross-order-player:'+ids[i],...homogeneity(results.map(r=>r.placements[i]))});
 const primary=holm(tests.filter(t=>!t.diagnostic)),diagnostic=tests.filter(t=>t.diagnostic),reject=primary.filter(t=>t.rejected),practical=results.every(r=>r.placementFits.every(f=>f.maxProbabilityDeviation<=.01)&&(phase!=='random'||r.arrangementFit.totalVariation<=.025));
 write(phase,{phase,totalRuns:N*orders.length,enumerableArrangements:arrangements.length,elapsedMs:performance.now()-started,primaryTests:primary,diagnosticTests:diagnostic,primaryRejections:reject,practicalTargetsPass:practical,results});console.log('COMPLETE',phase,'rejections',reject.length,'practical',practical);
})().catch(error=>{write(phase+'-failure',{message:error.message,stack:error.stack});console.error(error.stack);process.exitCode=1;});

const c=require('./common.cjs'),{e,assert,rng,shuffle,key,pair,independentlyCheck,write,summary}=c;
(async()=>{
 const P=Array.from({length:8},(_,i)=>({id:i+1,isMale:i<4,firstName:'Historical',lastName:String(i+1)})),freq=[5,3,2,1].map((count,i)=>({player1Id:i+1,player2Id:i+5,count}));
 const groups=[],costs=[],started=performance.now(),N=10000;
 for(const enabled of [false,true]){
  const values=[],diversity=new Set(),r=rng('history-'+enabled);let genderOptimal=0,validTop=0,validLow=0,zero=0;
  for(let i=0;i<N;i++){
   const input={players:P,mode:'balanced',numberOfTeams:4,topIds:[1,2],lowIds:[5,6],prioritizeHistory:enabled,...(enabled?{frequencies:freq}:{})},result=await e.generateScramble(input,r);independentlyCheck(input,result,[2,2,2,2]);assert(result.teams.every(t=>t.filter(p=>p.isMale).length===1));genderOptimal++;
   if(result.teams.every(t=>t.filter(p=>[1,2].includes(p.id)).length<=1))validTop++;if(result.teams.every(t=>t.filter(p=>[5,6].includes(p.id)).length<=1))validLow++;
   let cost=0;result.teams.forEach(t=>{const f=freq.find(f=>pair(f.player1Id,f.player2Id)===pair(t[0].id,t[1].id));if(f)cost+=f.count;});values.push(cost);if(cost===0)zero++;diversity.add(key(result.teams));
  }
  costs.push(values);groups.push({enabled,...summary(values),zeroCostFraction:zero/N,uniqueLabeledArrangements:diversity.size,genderOptimal,validTop,validLow,costHistogram:values.reduce((o,n)=>(o[n]=(o[n]||0)+1,o),{})});console.log('history',enabled,groups[groups.length-1].mean);
 }
 const [off,on]=groups,difference=off.mean-on.mean,se=Math.sqrt(off.variance/N+on.variance/N),normalCI=[difference-2.5758293035489004*se,difference+2.5758293035489004*se],random=rng('bootstrap-history'),boot=[];
 for(let b=0;b<2000;b++){let a=0,d=0;for(let i=0;i<N;i++){a+=costs[0][random(N)];d+=costs[1][random(N)];}boot.push((a-d)/N);}boot.sort((a,b)=>a-b);
 const pooled=costs[0].concat(costs[1]);let extreme=0;for(let b=0;b<2000;b++){const perm=shuffle(pooled,random),delta=(perm.slice(0,N).reduce((s,x)=>s+x,0)-perm.slice(N).reduce((s,x)=>s+x,0))/N;if(delta>=difference)extreme++;}
 assert(normalCI[0]>0);assert(on.mean<off.mean);const combined=[];
 for(let i=0;i<1000;i++){const input={players:P,mode:'balanced',numberOfTeams:4,topIds:[1,2],lowIds:[5,6],prohibitedPairs:['1:5','2:6'],allowMinimumRepeats:true,prioritizeHistory:true,frequencies:freq},r=await e.generateScramble(input,rng('combined:'+i));independentlyCheck(input,r,[2,2,2,2]);assert(!r.strictImpossible);combined.push(r.historyCost);}
 write('history',{pass:true,runsPerGroup:N,groups,meanReduction:difference,relativeReduction:difference/off.mean,normal99CI:normalCI,bootstrap99CI:[boot[10],boot[1989]],bootstrapReplicates:2000,permutationP:(extreme+1)/2001,permutations:2000,combinedStrictRuns:combined.length,combinedHistoryCost:summary(combined),elapsedMs:performance.now()-started});
})().catch(error=>{write('history-failure',{message:error.message,stack:error.stack});console.error(error.stack);process.exitCode=1;});

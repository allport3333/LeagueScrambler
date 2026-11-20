const c=require('./common.cjs'),{e,assert,rng,independentlyCheck,write,gammaQ,holm}=c;
(async()=>{
 const rows=[],tests=[],N=30000;
 for(const [n,requested,max] of [[9,4,null],[17,6,null],[8,null,3]]){
  const players=Array.from({length:n},(_,i)=>({id:i+1,isMale:i<Math.ceil(n/2),isTopPlayer:true,isLowPlayer:true})),teams=requested||2*Math.ceil(n/(2*max)),caps=Array.from({length:teams},(_,i)=>Math.floor(n/teams)+(i<n%teams?1:0)),placements=players.map(()=>Array(teams).fill(0)),slots=players.map(()=>Array(n).fill(0)),r=rng('uneven-random:'+n+':'+teams),input={players,mode:'random',numberOfTeams:requested,maxTeamSize:max};
  for(let sample=0;sample<N;sample++){const result=await e.generateScramble(input,r);independentlyCheck(input,result,caps);assert.deepEqual(result.retainedTopIds,[]);result.teams.forEach((t,j)=>t.forEach(p=>placements[p.id-1][j]++));result.teams.flat().forEach((p,j)=>slots[p.id-1][j]++);}
  const teamFits=placements.map((counts,i)=>{const chi=counts.reduce((s,count,j)=>s+(count-N*caps[j]/n)**2/(N*caps[j]/n),0);return {name:n+':teams:player'+(i+1),chiSquare:chi,df:teams-1,p:gammaQ((teams-1)/2,chi/2),maxProbabilityDeviation:Math.max(...counts.map((count,j)=>Math.abs(count/N-caps[j]/n)))};});
  const slotFits=slots.map((counts,i)=>({name:n+':slots:player'+(i+1),...c.fit(counts)}));tests.push(...teamFits,...slotFits);rows.push({players:n,teams,caps,runs:N,placements,slots,teamFits,slotFits});
 }
 holm(tests);const rejections=tests.filter(t=>t.rejected);assert.equal(rejections.length,0);write('random-uneven',{pass:true,totalRuns:N*rows.length,rows,primaryTests:tests,rejections,scope:'Unequal capacities use size-proportional team probabilities, not 1/teamCount. Every player is marked Top and Low; both are ignored in Complete Random. All flattened player positions are tested.'});console.log('PASS:90000 unequal-capacity/role-marked Complete Random runs; no corrected placement/slot rejection.');
})().catch(error=>{write('random-uneven-failure',{message:error.message,stack:error.stack});console.error(error.stack);process.exitCode=1;});

// Pure synthetic algorithm tests: no browser, HTTP, credentials or database access.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),Module=require('module');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,"Allport's League Scrambler/ClientApp/node_modules/typescript"));
const file=path.join(root,"Allport's League Scrambler/ClientApp/src/app/scrambler/scramble-engine.ts");
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS}}).outputText;
const compiled=new Module(file,module);compiled.filename=file;compiled.paths=module.paths;compiled._compile(code,file);const e=compiled.exports;
const out=process.env.LEAGUE_TEST_OUT?path.resolve(process.env.LEAGUE_TEST_OUT):path.resolve(__dirname,'../artifacts/scrambler-v2');fs.mkdirSync(out,{recursive:true});
function random(seed=1234567){let value=seed>>>0;return max=>{const limit=4294967296-(4294967296%max);let next;do{value^=value<<13;value^=value>>>17;value^=value<<5;next=value>>>0;}while(next>=limit);return next%max;};}
const pool=(n,male=Math.ceil(n/2))=>Array.from({length:n},(_,i)=>({id:i+1,isMale:i<male,firstName:'Player',lastName:String(i+1)}));
const signature=teams=>teams.map(t=>t.map(p=>p.id).sort((a,b)=>a-b).join(',')).join('|');
const input=(players,extra={})=>({players,mode:'balanced',maxTeamSize:4,maxMilliseconds:5000,...extra});
const checks=[];
function valid(config,r){assert.equal(r.status,'success',r.reason);const caps=e.capacitiesFor(config.players.filter(p=>!p.isByePlayer).length,config.maxTeamSize,config.numberOfTeams);assert.deepEqual(e.validateAllocation(config.players,caps,r.teams,r.retainedTopIds,new Set(config.prohibitedPairs||[]),r.repeatedPairs.length),[]);}
async function run(config,seed=1234567){const before=JSON.stringify(config.players);const r=await e.generateScramble(config,random(seed));assert.equal(JSON.stringify(config.players),before,'Source players/flags must not change');return r;}
(async()=>{
 let draws=0;global.window={crypto:{getRandomValues(array){array[0]=draws++===0?4294967295:4;return array;}}};assert.equal(e.secureRandomInt(3),1);assert.equal(draws,2);delete global.window;
 checks.push('Cryptographic integer sampling rejects the modulo-bias tail before Fisher-Yates selection.');
 for(const lowCount of [0,3,8,11,16]){const config=input(pool(32),{numberOfTeams:8,lowIds:pool(lowCount).map(p=>p.id)}),r=await run(config,lowCount+17);valid(config,r);const lows=r.teams.map(t=>t.filter(p=>config.lowIds.includes(p.id)).length);assert(Math.max(...lows)-Math.min(...lows)<=1);}
 checks.push('Low Player counts0/3/8/11/16 across8 teams spread evenly without index preference.');
 assert.equal((await run(input(pool(16),{numberOfTeams:4,topIds:[1,2,3,4,5,6]}))).status,'invalid-configuration');
 const unrestricted=input(pool(16),{mode:'random',topIds:pool(16).map(p=>p.id),lowIds:pool(16).map(p=>p.id)}),unrestrictedResult=await run(unrestricted);valid(unrestricted,unrestrictedResult);assert.deepEqual(unrestrictedResult.retainedTopIds,[]);
 for(const n of [8,16,24,32,40,63])for(const max of [2,3,4,5]){const config=input(pool(n),{maxTeamSize:max}),r=await run(config,n*max+5);valid(config,r);assert.equal(r.balancingOptimal,true,JSON.stringify({n,max,reason:r.reason,warnings:r.warnings}));}
 for(const count of [1,3,6,10]){const config=input(pool(40),{numberOfTeams:count}),r=await run(config,count+9);valid(config,r);}
 checks.push('Attendance8/16/24/32/40/63, sizes2/3/4/5 and explicit1/3/6/10 teams: unique complete assignments and balanced sizes/genders.');
 for(const [teams,tops] of [[10,10],[10,12],[10,8],[6,10]]){
  const players=pool(40),config=input(players,{numberOfTeams:teams,topIds:players.slice(0,tops).map(p=>p.id),configuredTop:players.slice(0,tops).map((p,i)=>({playerId:p.id,rank:i+1}))});
  config.topIds.forEach(id=>players[id-1].isTopPlayer=true);const r=await run(config,teams+tops);valid(config,r);assert.deepEqual(r.retainedTopIds,config.topIds.slice(0,teams));assert.deepEqual(r.demotedTopIds,config.topIds.slice(teams));assert.equal(r.teams.reduce((n,t)=>n+t.filter(p=>r.retainedTopIds.includes(p.id)).length,0),Math.min(teams,tops));
 }
 const people=pool(16);people[0].firstName=people[1].firstName='Same';people[0].lastName=people[1].lastName='Name';
 const ranked=e.rankTopPlayers(people.slice(0,6),[{playerId:6,rank:1},{playerId:5,rank:2}],people.slice(0,6).map((p,i)=>({playerId:p.id,totalScore:100-i,totalScoreBeforeReduction:100-i,playerName:p.firstName+' '+p.lastName})));
 assert.deepEqual(ranked.map(p=>p.id),[6,5,1,2,3,4]);
 assert.deepEqual(e.rankTopPlayers(people.slice(0,2),[{playerId:2,rank:0},{playerId:1,rank:0}],[]).map(p=>p.id),[1,2]);
 const mixed=pool(40,24);const mixedInput=input(mixed,{numberOfTeams:10,topIds:[1,2,3,4,5,6,25,26,27,28,29,30],lowIds:[1,7,8,9,10,11,12,31,32,33,34],configuredTop:[1,2,3,4,5,6,25,26,27,28,29,30].map((id,i)=>({playerId:id,rank:i+1}))});mixed[0].isLowPlayer=true;const mixedResult=await run(mixedInput,157);valid(mixedInput,mixedResult);assert(mixedResult.demotedTopIds.includes(29)&&mixedResult.demotedTopIds.includes(30));assert(mixedResult.teams.flat().some(p=>p.id===29&&!p.isMale));assert(mixedResult.warnings.some(w=>w.includes('precedence')));
 checks.push('10/10,10/12,10/8,6/10 top capacity; explicit rank overrides score, unset ranks ignore retrieval order, same names retain separate IDs, mixed genders/demoted women and Top/Low precedence.');
 const byes=pool(10);byes[8].isByePlayer=byes[9].isByePlayer=true;const byeInput=input(byes),byeResult=await run(byeInput);valid(byeInput,byeResult);assert.deepEqual(byeResult.byes.map(p=>p.id),[9,10]);
 const history=[{leagueId:1,teamId:10,scrambleNumber:1,saved:true,playerIds:[1,2,2,3]}, {leagueId:1,teamId:10,scrambleNumber:1,saved:true,playerIds:[1,2,3]}, {leagueId:1,teamId:11,scrambleNumber:2,saved:true,playerIds:[1,2]}, {leagueId:2,teamId:12,scrambleNumber:2,saved:true,playerIds:[1,2]}, {leagueId:1,teamId:13,scrambleNumber:3,saved:false,playerIds:[1,2]}, {leagueId:1,teamId:14,scrambleNumber:3,saved:true,bye:true,playerIds:[1,2]}];
 const h=e.historyIndex(1,history);assert.equal(h.frequencies.find(p=>p.player1Id===1&&p.player2Id===2).count,2);assert.equal(h.frequencies.length,3);
 assert.throws(()=>e.historyIndex(1,[{...history[0],playerIds:[1,0]}]));assert.throws(()=>e.historyIndex(1,[history[0],{...history[0],playerIds:[1,4]}]));
 const changed=e.historyIndex(1,[{...history[0],playerIds:[1,4]}]);assert(!changed.frequencies.some(p=>p.player2Id===2));
 checks.push('Byes separate; historical pairs use all unique IDs once per saved team, ignore other leagues/pending previews/byes, reject incomplete/conflicting snapshots and reflect edited assignments.');
 const restricted=input(pool(16),{numberOfTeams:4,prohibitedPairs:['1:2','1:3','2:3','4:5','9:10','11:12']});valid(restricted,await run(restricted,12));
 const completePairs=[];for(let a=1;a<=4;a++)for(let b=a+1;b<=4;b++)completePairs.push(e.pairKey(a,b));
 const impossible=input(pool(4),{numberOfTeams:2,prohibitedPairs:completePairs});assert.equal((await run(impossible)).status,'impossible');const fallback={...impossible,allowMinimumRepeats:true};const relaxed=await run(fallback);valid(fallback,relaxed);assert.equal(relaxed.repeatedPairs.length,2);assert(relaxed.minimumRepeatsProven&&relaxed.strictImpossible);
 const exhausted=await run({...fallback,maxNodes:0});assert.equal(exhausted.status,'budget-exhausted');assert(!exhausted.strictImpossible);assert.equal(exhausted.teams.length,0);
 let backtracked=false;for(let seed=1;seed<50&&!backtracked;seed++){const config=input(pool(8,8),{mode:'random',numberOfTeams:2,prohibitedPairs:['1:2','1:3','1:4','5:6','5:7','5:8']}),r=await run(config,seed);valid(config,r);backtracked=r.nodes>9;}assert(backtracked,'Greedy dead-end fixture must exercise backtracking');
 function oracle(pairs){let best=Infinity;for(let mask=0;mask<64;mask++){const a=[],b=[];for(let i=0;i<6;i++)((mask>>i)&1?a:b).push(i+1);if(a.length!==3)continue;let cost=0;for(const team of [a,b])for(let i=0;i<team.length;i++)for(let j=i+1;j<team.length;j++)if(pairs.has(e.pairKey(team[i],team[j])))cost++;best=Math.min(best,cost);}return best;}
 for(let seed=1;seed<=25;seed++){const rng=random(seed*991),pairs=[];for(let a=1;a<=6;a++)for(let b=a+1;b<=6;b++)if(rng(4)>0)pairs.push(e.pairKey(a,b));const config=input(pool(6),{mode:'random',numberOfTeams:2,prohibitedPairs:pairs,allowMinimumRepeats:true}),r=await run(config,seed);valid(config,r);assert.equal(r.repeatedPairs.length,oracle(new Set(pairs)));}
 checks.push('Strict feasible/impossible and fallback disabled/enabled; no fallback on exhausted budget; greedy dead-end backtracks;25 tiny fallback cases match independent exhaustive minimum-repeat oracle.');
 const frequencies=Array.from({length:4},(_,i)=>({player1Id:2*i+1,player2Id:2*i+2,count:5}));let baselineCost=0,preferredCost=0;
 for(let seed=1;seed<=100;seed++){const config=input(pool(8),{mode:'random',numberOfTeams:4});const old=await run(config,seed);baselineCost+=old.teams.reduce((sum,t)=>sum+(frequencies.some(p=>e.pairKey(p.player1Id,p.player2Id)===e.pairKey(t[0].id,t[1].id))?5:0),0);const pref=await run({...config,prioritizeHistory:true,frequencies},seed);valid(config,pref);preferredCost+=pref.historyCost;}
 assert(preferredCost<baselineCost*.4);
 const both=input(pool(8),{numberOfTeams:4,prohibitedPairs:['1:2'],prioritizeHistory:true,frequencies:pool(8).flatMap(p=>pool(8).filter(q=>p.id<q.id).map(q=>({player1Id:p.id,player2Id:q.id,count:e.pairKey(p.id,q.id)==='1:2'?0:5})))});const bothResult=await run(both);valid(both,bothResult);assert.equal(bothResult.repeatedPairs.length,0);
 assert.equal((await run(input(pool(8),{prioritizeHistory:true}))).status,'invalid-configuration');
 checks.push('Whole-league frequency preference lowers total arrangement cost without selected scrambles; selected strict exclusions outrank history preference; unavailable history is not zero history.');
 for(const extra of [{numberOfTeams:0},{numberOfTeams:9},{maxTeamSize:9},{players:[...pool(8),pool(1)[0]]},{players:[{id:0,isMale:true}]}])assert.equal((await run(input(pool(8),extra))).status,'invalid-configuration');
 assert.equal((await e.generateScramble(input(pool(8)),()=>{throw Error('Injected random failure')})).status,'unexpected-error');assert.equal((await run(input(pool(8),{cancelled:()=>true}))).status,'cancelled');
 checks.push('Invalid IDs/counts/configuration, cancellation and unexpected generation errors have distinct safe outcomes without source mutation.');
 // Exact small-case enumeration: every labeled 2+2 allocation occurs equally often (four internal permutations).
 const exact=new Map();for(let a=0;a<4;a++)for(let b=0;b<3;b++)for(let c=0;c<2;c++){const choices=[a,b,c];const r=await e.generateScramble(input(pool(4),{mode:'random',numberOfTeams:2}),()=>choices.shift());const key=signature(r.teams);exact.set(key,(exact.get(key)||0)+1);}assert.equal(exact.size,6);assert([...exact.values()].every(n=>n===4));
 const iterations=4000,counts=Array.from({length:16},()=>Array(4).fill(0)),unique=new Set(),rng=random(0x123abc);let balancedCount=0;const started=performance.now();
 for(let i=0;i<iterations;i++){const config=input(pool(16),{mode:i<2000?'random':'balanced',numberOfTeams:4,improveSteps:256});const r=await e.generateScramble(config,rng);valid(config,r);r.teams.forEach((t,index)=>t.forEach(p=>counts[p.id-1][index]++));unique.add(signature(r.teams));if(i>=2000&&r.balancingOptimal)balancedCount++;}
 const chi=counts.map(row=>row.reduce((sum,n)=>sum+(n-iterations/4)**2/(iterations/4),0));assert(Math.max(...chi)<28,'Unexpected index bias in equal-capacity/equal-composition fixture');assert(unique.size>iterations*.9);assert.equal(balancedCount,2000);
 const benchmarks=[];for(const n of [24,40,64,80]){const samples=[];for(let seed=1;seed<=10;seed++){const start=performance.now(),config=input(pool(n,Math.floor(n*.7)),{topIds:pool(Math.floor(n/4)).map(p=>p.id),lowIds:pool(Math.floor(n/5)).map(p=>n-p.id+1)}),r=await run(config,seed);valid(config,r);samples.push(performance.now()-start);}benchmarks.push({players:n,medianMs:samples.sort((a,b)=>a-b)[5],maxMs:Math.max(...samples)});}
 checks.push('Exact4-player Fisher-Yates allocation enumeration and4000 seeded random/balanced runs check diversity, index frequencies and mandatory invariants; not a uniformity proof for balanced complete solutions.');
 const statisticalElapsed=performance.now()-started,historyBenchmarks=[];
 for(let seed=1;seed<=3;seed++){
  const players=pool(40,26),historical=[],r=random(seed*321);
  for(let session=0;session<6;session++){const ids=e.shuffled(players.map(p=>p.id),r);for(let team=0;team<10;team++)historical.push({leagueId:1,teamId:session*10+team+1,scrambleNumber:session,saved:true,playerIds:ids.slice(team*4,team*4+4)});}
  const frequencies=e.historyIndex(1,historical).frequencies,prohibited=e.historyIndex(1,historical.filter(t=>t.scrambleNumber<2)).frequencies;
  const config=input(players,{topIds:pool(10).map(p=>p.id),lowIds:[33,34,35,36,37,38,39,40],prioritizeHistory:true,frequencies,prohibitedPairs:prohibited.map(p=>e.pairKey(p.player1Id,p.player2Id)),maxMilliseconds:2500});
  let ticks=0;const timer=setInterval(()=>ticks++,1),start=performance.now();const result=await run(config,seed*97);clearInterval(timer);valid(config,result);assert.equal(result.repeatedPairs.length,0);assert(ticks>0,'Cooperative search must allow event-loop work');historyBenchmarks.push({players:40,historySessions:6,strictSessions:2,status:result.status,elapsedMs:performance.now()-start,nodes:result.nodes,eventLoopTicks:ticks,historyCost:result.historyCost});
 }
 checks.push('Three40-player six-session history fixtures, two strictly excluded sessions, Top/Low balancing: complete repeat-free results; event-loop timers continue during optimization.');
 const report={checks,randomness:{iterations,uniqueLabeledResults:unique.size,maxPlayerIndexChiSquare:Math.max(...chi),balancedOptimal:balancedCount,elapsedMs:statisticalElapsed},history:{baselineCost,preferredCost},benchmarks,historyBenchmarks,databaseAccess:false};fs.writeFileSync(path.join(out,'engine-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});


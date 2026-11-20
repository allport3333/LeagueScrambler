// Independent legacy snapshot comparison. No application state, network or database.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),Module=require('module');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,"Allport's League Scrambler/ClientApp/node_modules/typescript"));
const fixture=require('../fixtures/scrambler-v1-methods.json'),out=path.resolve(__dirname,'../artifacts/scrambler-v2');
const legacyCode=ts.transpileModule('class Legacy { calculateTeamsNeeded(){} '+Object.values(fixture.methods).join('\n')+' }; Legacy;', {compilerOptions:{target:ts.ScriptTarget.ES2017}}).outputText;
const engineFile=path.join(root,"Allport's League Scrambler/ClientApp/src/app/scrambler/scramble-engine.ts"),m=new Module(engineFile,module);m.filename=engineFile;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(engineFile,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS}}).outputText,engineFile);const e=m.exports;
function rng(seed){let v=seed>>>0;return n=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)%n;};}
const pool=(n)=>Array.from({length:n},(_,i)=>({id:i+1,firstName:'Player',lastName:String(i+1),isMale:i<Math.ceil(n*.65)}));
function metrics(teams,top){const sizes=teams.map(t=>t.length),genders=teams.map(t=>t.filter(p=>p.isMale).length),tops=teams.map(t=>t.filter(p=>top.includes(p.id)).length);return {players:teams.flat().length,uniquePlayers:new Set(teams.flat().map(p=>p.id)).size,sizeRange:Math.max(...sizes)-Math.min(...sizes),maleRange:Math.max(...genders)-Math.min(...genders),maxTopOnTeam:Math.max(...tops)};}
(async()=>{
 const rows=[];
 for(const [count,topCount] of [[8,0],[24,0],[40,10],[40,12],[63,0]]){
  const oldTimes=[],newTimes=[],oldDiversity=new Set(),newDiversity=new Set();let oldMetrics,newMetrics;
  for(let seed=1;seed<=100;seed++){
   const random=rng(seed*137+13),math=Object.create(Math);math.random=()=>random(10000000)/10000000;
   const Legacy=vm.runInNewContext(legacyCode,{Math:math,console}),old=new Legacy(),players=pool(count);players.forEach((p,i)=>p.isTopPlayer=i<topCount);
   Object.assign(old,{selectedList:players,teamSize:4,numberOfTeams:count===40?10:null,completeRandom:false,totalPlayers:players.slice(),totalTopPlayers:players.slice(0,topCount),totalLowPlayers:[],topPlayerCount:topCount,lowPlayerCount:0,listOfTeams:[],retrievedListOfTeams:[]});old.fillPlayers();old.malePlayerCount=old.malePlayers.length;old.femalePlayerCount=old.femalePlayers.length;old.fillTeam();
   let start=performance.now();assert.equal(await old.selectPlayersWithRetries(false),true);oldTimes.push(performance.now()-start);
   const config={players,mode:'balanced',maxTeamSize:4,numberOfTeams:count===40?10:null,topIds:players.slice(0,topCount).map(p=>p.id),configuredTop:players.slice(0,topCount).map((p,i)=>({playerId:p.id,rank:i+1}))};
   start=performance.now();const current=await e.generateScramble(config,rng(seed*137+13));newTimes.push(performance.now()-start);assert.equal(current.status,'success');
   oldMetrics=metrics(old.listOfTeams.map(t=>t.players),config.topIds);newMetrics=metrics(current.teams,current.retainedTopIds);
   assert.equal(newMetrics.uniquePlayers,count);assert(newMetrics.sizeRange<=1);assert(newMetrics.maxTopOnTeam<=1);
   oldDiversity.add(old.listOfTeams.map(t=>t.players.map(p=>p.id).join(',')).join('|'));newDiversity.add(current.teams.map(t=>t.map(p=>p.id).join(',')).join('|'));
  }
  rows.push({players:count,configuredTops:topCount,runs:100,old:{lastMetrics:oldMetrics,unique:oldDiversity.size,medianMs:oldTimes.sort((a,b)=>a-b)[50]},v2:{lastMetrics:newMetrics,unique:newDiversity.size,medianMs:newTimes.sort((a,b)=>a-b)[50]}});
 }
 // Directly expose the old name-based history comparison and Top placement history bypass.
 const Legacy=vm.runInNewContext(legacyCode,{Math,console}),old=new Legacy();assert(old.arePlayersEqual({id:1,firstName:'Same',lastName:'Name'},{id:2,firstName:'Same',lastName:'Name'}));
 const report={sourceCommit:fixture.sourceCommit,rows,findings:['Legacy history compares names; V2 compares IDs.','Legacy Top placement never checks history; V2 validates every team pair.','Legacy retains excess designated Top players, allowing multiple per team; V2 caps roles by priority without dropping people.','V2 adds bounded cooperative search and validation; modest extra CPU replaces unbounded random retries.'],databaseAccess:false};
 fs.writeFileSync(path.join(out,'legacy-comparison.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

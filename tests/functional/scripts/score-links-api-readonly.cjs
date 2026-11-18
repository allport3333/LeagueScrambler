// Read-only checks of retained, exact synthetic league records. Never renews mutation approval.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),assert=require('node:assert/strict');
const {db}=require('../helpers/database.cjs');const {processIdentity}=require('../helpers/isolation.cjs');
const {BASE_URL,assertLocalUrl}=require('../helpers/safety.cjs');
function get(relative){const url=assertLocalUrl(BASE_URL+relative);return new Promise((resolve,reject)=>{
 const request=https.get(url,{timeout:10000},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>{
  try{assert.equal(response.statusCode,200,'Read-only API status');resolve(JSON.parse(text));}catch{reject(Error('Read-only API status/shape failed; response content withheld.'));}
 });});request.on('error',()=>reject(Error('Read-only localhost request failed.')));request.on('timeout',()=>request.destroy());
});}
(async()=>{
 const identity=processIdentity();const proof=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../.local/runtime-process-inspection.json')));
 assert.equal(proof.mode,'runtime-inspection');assert.equal(proof.database,'LeagueScramblerDev');assert.equal(proof.effectiveRuntimeEnvironmentVerified,true);
 for(const key of ['pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256'])assert.equal(identity[key],proof.identity[key],'Independent runtime inspection must match the current process');
 let name,snapshot;
 for(const file of fs.readdirSync(path.resolve(__dirname,'../artifacts/manifests')).filter(f=>f.endsWith('.json'))){
  const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../artifacts/manifests',file)));
  for(const entry of manifest.leagues||[]){
   if(!/^LSAuto_[a-f0-9]{24}_L[a-z0-9]+$/.test(entry.name)||!entry.snapshot?.kqScores?.length)continue;
   const current=db('leagueSnapshot',null,{leagueName:entry.name});
   if(current.kqScores?.length&&current.kqPlayers?.length){name=entry.name;snapshot=current;break;}
  }
  if(name)break;
 }
 assert(name,'No retained run-owned synthetic King/Queen scores are available.');
 let checked=0,linked=0;
 for(const mode of ['GetByLeague','GetByLeagueMatchup']){
  const result=await get('/api/ScrambleData/'+mode+'/'+name);assert(Array.isArray(result.playerScores));
  for(const player of result.playerScores)for(const score of player.scores){
   assert(Object.hasOwn(score,'hasSavedScore')&&Object.hasOwn(score,'kingQueenTeamId'));
   const teamIds=snapshot.kqTeams.filter(t=>t.ScrambleNumber===score.scrambleNumber).map(t=>t.Id);
   const sources=snapshot.kqPlayers.filter(p=>p.PlayerId===player.playerId&&teamIds.includes(p.KingQueenTeamId))
    .flatMap(p=>snapshot.kqScores.filter(s=>s.KingQueenTeamId===p.KingQueenTeamId&&(mode==='GetByLeagueMatchup'||s.RoundId===score.roundId)));
   const unique=[...new Set(sources.map(s=>s.KingQueenTeamId))];
   const saved=mode==='GetByLeague'?sources.length===1:unique.length===1;
   assert.equal(score.hasSavedScore,saved,'Saved/placeholder metadata must match actual development records');
   if(saved){assert.equal(score.kingQueenTeamId,unique[0]);linked++;}checked++;
  }
 }
 const weeks=await get('/api/ScrambleData/SelectedLeagueScrambles/'+name);
 assert.deepEqual(weeks.map(w=>w.scrambleNumber),weeks.map(w=>w.scrambleNumber).sort((a,b)=>a-b));
 const teams=await get('/api/ScrambleData/GetKingQueenTeamsByScrambleNumber/'+name+'/'+weeks[0].scrambleNumber);
 const ids=teams.kingQueenTeams.map(t=>t.kingQueenTeam.id);assert.deepEqual(ids,ids.slice().sort((a,b)=>a-b));
 // Regression: an unknown entity must not be dereferenced during EF parameter evaluation.
 const missing='LSAuto_'+require('node:crypto').randomBytes(12).toString('hex')+'_Lmissing';
 assert.deepEqual(db('leagueSnapshot',null,{leagueName:missing}),{league:[]});
 assert.deepEqual(await get('/api/ScrambleData/SelectedLeagueScrambles/'+missing),[]);
 assert.deepEqual(await get('/api/ScrambleData/SelectedLeagueScrambles/'+encodeURIComponent('   ')),[]);
 const after=processIdentity();for(const key of Object.keys(identity))assert.equal(after[key],identity[key]);
 const out=path.resolve(__dirname,'../score-links-evidence/api-readonly.json');
 fs.writeFileSync(out,JSON.stringify({database:'LeagueScramblerDev',mode:'independent runtime environment + retained synthetic record reads',
  automatedSessionCorrelationPassed:false,mutationAuthorizationGranted:false,checkedScores:checked,linkedScores:linked,
  endpointsChecked:4,missingAndBlankLeagueChecksPassed:2,metadataMatchesDatabase:true,weekAndTeamOrderVerified:true,databaseWrites:0},null,2));
 console.log('Read-only API checks passed: '+checked+' score associations; 4 endpoints plus 2 missing/blank league checks; no database writes.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});

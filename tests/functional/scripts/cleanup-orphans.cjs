const fs=require('node:fs');
const path=require('node:path');
const {db}=require('../helpers/database.cjs');
const {verifyIsolation}=require('../helpers/isolation.cjs');
const {BASE_URL}=require('../helpers/safety.cjs');
const execute=process.argv.includes('--execute');
if(execute) verifyIsolation('development-regression');
const directory=path.join(__dirname,'../artifacts/manifests');
const results=[];
for(const filename of fs.readdirSync(directory)){
  if(!/^[a-f0-9]{24}\.json$/.test(filename))continue;
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,filename),'utf8'));
  if(manifest.database!=='LeagueScramblerDev'||manifest.baseURL!==BASE_URL)throw new Error('Manifest database/origin rejected.');
  if((manifest.leagues||[]).length)continue; // Never remove league fixture owners.
  for(const identity of manifest.identities){
    if(identity.firstName!=='LSAuto_'+manifest.runId||!identity.email.startsWith('lsauto_'+manifest.runId+'_'))throw new Error('Manifest identity mismatch.');
    if((identity.userIds||[]).length!==1||(identity.playerIds||[]).length||(identity.linkIds||[]).length)continue;
    const snapshot=db('snapshot',identity);
    if(!snapshot.users.length)continue;
    if(snapshot.users.length!==1||snapshot.users[0].UserId!==identity.userIds[0]||snapshot.users[0].UserRoleId!==3||snapshot.players.length||snapshot.links.length)continue;
    const references=db('cleanupReferences',identity).references;
    if(references.some(r=>r.count!==0)) {results.push({userId:identity.userIds[0],status:'retained-referenced'});continue;}
    if(!execute){results.push({userId:identity.userIds[0],status:'safe-orphan-candidate'});continue;}
    verifyIsolation('development-regression');
    const result=db('cleanupOrphanUser',identity,{userId:identity.userIds[0]});
    results.push({...result,status:'deleted-exact-orphan'});
  }
}
const receipt=path.join(__dirname,'../artifacts/cleanup-orphans.json');
const ledger=path.join(__dirname,'../artifacts/cleanup-history.jsonl');
if(!fs.existsSync(ledger)&&fs.existsSync(receipt)){
    const previous=JSON.parse(fs.readFileSync(receipt,'utf8'));
    if(previous.execute)fs.appendFileSync(ledger,JSON.stringify({...previous,importedPreviousReceipt:true})+'\n');
}
if(execute){
  fs.appendFileSync(ledger,JSON.stringify({executedAt:new Date().toISOString(),execute,results})+'\n');
}
fs.writeFileSync(receipt,JSON.stringify({execute,results},null,2));
console.log(JSON.stringify({execute,results},null,2));

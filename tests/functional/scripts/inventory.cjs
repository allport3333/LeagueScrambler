const fs = require('node:fs');
const path = require('node:path');
const { db } = require('../helpers/database.cjs');
const { BASE_URL } = require('../helpers/safety.cjs');
const directory = path.join(__dirname, '../artifacts/manifests');
const records = [];
const leagues=[];
const cleanupHistory=path.join(__dirname,'../artifacts/cleanup-history.jsonl');
const cleanupReceipt=path.join(__dirname,'../artifacts/cleanup-orphans.json');
const cleanups=fs.existsSync(cleanupHistory)?fs.readFileSync(cleanupHistory,'utf8').trim().split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l)):[];
if(fs.existsSync(cleanupReceipt))cleanups.push(JSON.parse(fs.readFileSync(cleanupReceipt,'utf8')));
const deletedUserIds=[...new Set(cleanups.filter(c=>c.execute).flatMap(c=>(c.results||[]).filter(r=>r.status==='deleted-exact-orphan').map(r=>r.deletedUserId)))].sort((a,b)=>a-b);
for (const filename of fs.existsSync(directory) ? fs.readdirSync(directory) : []) {
  if (!/^[a-f0-9]{24}\.json$/.test(filename)) continue;
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));
  if (manifest.database !== 'LeagueScramblerDev' || manifest.baseURL !== BASE_URL) throw new Error('Manifest target rejected.');
  for (const identity of manifest.identities) {
    const snapshot = db('snapshot', identity);
    records.push({ runId: manifest.runId, test: manifest.test, email: identity.email,
      userIds: snapshot.users.map(u => u.UserId), playerIds: snapshot.players.map(p => p.Id),
      linkIds: snapshot.links.map(l => l.UsersPlayerId) });
  }
  for(const entry of manifest.leagues || []) leagues.push({runId:manifest.runId,name:entry.name,snapshot:db('leagueSnapshot',null,{leagueName:entry.name})});
}
const inventory = { database: 'LeagueScramblerDev', checkedAt: new Date().toISOString(),
  userCount: records.reduce((n,r) => n+r.userIds.length,0),
  playerCount: records.reduce((n,r) => n+r.playerIds.length,0),
  linkCount: records.reduce((n,r) => n+r.linkIds.length,0), records,
  leagues, leagueCount:leagues.filter(l=>l.snapshot.league.length).length,
  destructiveCleanupExecuted: deletedUserIds.length>0, safelyDeletedOrphanUserIds:deletedUserIds };
fs.writeFileSync(path.join(__dirname, '../artifacts/inventory.json'), JSON.stringify(inventory,null,2));
console.log(JSON.stringify({userCount:inventory.userCount,playerCount:inventory.playerCount,linkCount:inventory.linkCount,leagueCount:inventory.leagueCount,inventoryFile:'artifacts/inventory.json',safelyDeletedOrphanUserIds:deletedUserIds},null,2));

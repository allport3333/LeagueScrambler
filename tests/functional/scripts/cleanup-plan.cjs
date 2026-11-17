const fs = require('node:fs');
const path = require('node:path');
const { db } = require('../helpers/database.cjs');
const { BASE_URL } = require('../helpers/safety.cjs');
const filename = process.argv[2];
if (!filename) throw new Error('Supply an exact artifacts/manifests/<run-id>.json path. This command never deletes records.');
const root = path.resolve(__dirname, '../artifacts/manifests');
const resolved = path.resolve(filename);
if (!resolved.startsWith(root + path.sep)) throw new Error('Only local suite manifests are accepted.');
const manifest = JSON.parse(fs.readFileSync(resolved, 'utf8'));
if (manifest.database !== 'LeagueScramblerDev' || manifest.baseURL !== BASE_URL || !/^[a-f0-9]{24}$/.test(manifest.runId)) throw new Error('Manifest safety guard failed.');
const plan = { runId: manifest.runId, database: manifest.database, executable: false, records: [] };
for (const identity of manifest.identities) {
  if (!identity.email.startsWith('lsauto_' + manifest.runId + '_') || identity.firstName !== 'LSAuto_' + manifest.runId) throw new Error('Identity does not belong to manifest.');
  const snapshot = db('snapshot', identity);
  if (JSON.stringify(snapshot.users.map(u => u.UserId)) !== JSON.stringify(identity.userIds || []) ||
      JSON.stringify(snapshot.players.map(p => p.Id)) !== JSON.stringify(identity.playerIds || []) ||
      JSON.stringify(snapshot.links.map(l => l.UsersPlayerId)) !== JSON.stringify(identity.linkIds || [])) {
    throw new Error('Database IDs differ from recorded IDs. Manual review required; no deletion allowed.');
  }
  plan.records.push({ identity, current: snapshot, incomingReferences: db('cleanupReferences', identity).references });
}
console.log(JSON.stringify(plan, null, 2));
console.log('PREVIEW ONLY. Review all incoming foreign-key references and exact IDs before implementing transactional cleanup. No deletion code is enabled.');

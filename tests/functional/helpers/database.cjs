const path = require('node:path');
const { spawnSync } = require('node:child_process');
function db(operation, identity, extra = {}) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'database.ps1')], {
    input: JSON.stringify({ operation, identity, ...extra }), encoding: 'utf8', timeout: 30000,
    windowsHide: true
  });
  if (result.status !== 0 || result.error) throw new Error('Dev-only database helper failed. ' + (result.stderr || '').trim());
  return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
}
module.exports = { db };

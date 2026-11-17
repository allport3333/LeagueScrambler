const fs = require('node:fs');
const path = require('node:path');
const { processIdentity, verifyAutomatedIsolation, APPROVAL, validateManualBinding } = require('../helpers/isolation.cjs');
const { BASE_URL, mutationApproval } = require('../helpers/safety.cjs');
if (!process.argv.includes('--confirm-manual-dev-database')) throw new Error('Explicit user confirmation of the running development database is required.');
if (!mutationApproval()) throw new Error('Milestone mutation authorization is absent.');
const manual = JSON.parse(fs.readFileSync(path.join(__dirname, '../.local/manual-verification.json'), 'utf8'));
if (!manual.confirmed || manual.database !== 'LeagueScramblerDev' || manual.server !== 'localhost' || manual.baseURL !== BASE_URL) throw new Error('Matching user manual confirmation is absent.');
const identity = processIdentity();
let automatedFailure;
try { verifyAutomatedIsolation(); }
catch (error) { automatedFailure = error.message; }
if (!automatedFailure) throw new Error('Automated correlation passed; manual fallback is unnecessary. Use automated verification instead.');
const approval = {
  mode: 'manual', userConfirmed: true, scope: 'milestone-one', baseURL: BASE_URL,
  server: 'localhost', database: 'LeagueScramblerDev', identity,
  approvedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  automatedSessionCorrelationPassed: false, automatedFailure,
  destructiveCleanupApproved: false
};
// Reinspect before writing: never authorize a process that restarted mid-check.
validateManualBinding(approval, processIdentity());
fs.writeFileSync(APPROVAL, JSON.stringify(approval, null, 2));
console.log(JSON.stringify({ mode: 'manual', pid: identity.pid, processStartUtc: identity.processStartUtc,
  database: approval.database, expiresAt: approval.expiresAt, automatedSessionCorrelationPassed: false,
  automatedFailure }, null, 2));

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { envSettings, BASE_URL } = require('./safety.cjs');
const APPROVAL = path.join(__dirname, '../.local/manual-process-approval.json');
const RUNTIME_PROOF=path.join(__dirname,'../.local/runtime-process-verification.json');
function runHelper(filename) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, filename)], {
    encoding: 'utf8', timeout: 30000, windowsHide: true
  });
  if (result.status !== 0 || result.error) throw new Error((result.stderr || 'Isolation check could not execute.').trim());
  return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
}
function processIdentity() {
  envSettings();
  return runHelper('process-identity.ps1');
}
function verifyAutomatedIsolation() { envSettings(); return runHelper('isolation.ps1'); }
function validateProcessBinding(approval, identity) {
  if (approval.baseURL !== BASE_URL ||
      approval.server !== 'localhost' || approval.database !== 'LeagueScramblerDev' ||
      !approval.expiresAt || Date.now() >= Date.parse(approval.expiresAt) ||
      !Number.isFinite(Date.parse(approval.expiresAt))) throw new Error('Process authorization is absent, expired, or outside the approved development scope.');
  for (const field of ['pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256']) {
    if (!identity[field] || approval.identity[field] !== identity[field]) {
      throw new Error('Process authorization invalidated by application restart, identity change, or configuration change: ' + field);
    }
  }
  if (!identity.visualStudioDebug || !identity.loopbackOnly) throw new Error('Expected localhost Visual Studio Debug identity is absent.');
}
function validateManualBinding(approval,identity){
  if(approval.mode!=='manual'||approval.userConfirmed!==true||approval.scope!=='milestone-one') throw new Error('Explicit milestone-one manual confirmation is required.');
  validateProcessBinding(approval,identity);
}
function verifyIsolation(scope = 'milestone-one') {
  const identity = processIdentity();
  if(fs.existsSync(RUNTIME_PROOF)){
    const proof=JSON.parse(fs.readFileSync(RUNTIME_PROOF,'utf8'));
    if(proof.mode!=='runtime-environment'||proof.effectiveRuntimeEnvironmentVerified!==true||proof.automatedSessionCorrelationPassed!==false||!proof.authorizedScopes.includes(scope))throw new Error('Runtime environment proof is invalid for this scope.');
    // Reuse identical identity/hash/expiry checks; evidence remains explicitly non-manual.
    validateProcessBinding(proof,identity);
    return {mode:'runtime-environment',effectiveRuntimeEnvironmentVerified:true,automatedSessionCorrelationPassed:false,database:'LeagueScramblerDev',server:'localhost',pid:identity.pid,processStartUtc:identity.processStartUtc,checkedAt:new Date().toISOString()};
  }
  if (fs.existsSync(APPROVAL)) {
    const approval = JSON.parse(fs.readFileSync(APPROVAL, 'utf8'));
    try { validateManualBinding(approval, identity); }
    catch (error) {
      // Fail closed: a stale manual approval cannot silently fall back to auto mode.
      // Keep the stale binding in place: every later test/run must reject it
      // until an explicitly confirmed re-approval replaces it. Removing it
      // would permit a later invocation to fall back to automated mode.
      throw error;
    }
    if (scope !== 'milestone-one' && !(approval.authorizedScopes || []).includes(scope)) {
      throw new Error('The valid manual process binding is not authorized for this regression scope.');
    }
    return { mode: 'manual', manuallyVerified: true, automatedSessionCorrelationPassed: false,
      automatedFailure: approval.automatedFailure, database: 'LeagueScramblerDev', server: 'localhost',
      pid: identity.pid, processStartUtc: identity.processStartUtc, checkedAt: new Date().toISOString() };
  }
  const automated = verifyAutomatedIsolation();
  return { ...automated, mode: 'automated', automatedSessionCorrelationPassed: true };
}
module.exports = { verifyIsolation, verifyAutomatedIsolation, processIdentity, validateProcessBinding, validateManualBinding, APPROVAL };

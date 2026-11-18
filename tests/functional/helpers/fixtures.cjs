const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const { test: base, expect } = require('@playwright/test');
const { BASE_URL, assertLocalUrl, mutationApproval } = require('./safety.cjs');
const { verifyIsolation } = require('./isolation.cjs');
const { db } = require('./database.cjs');

const SAFE_READS = new Set([
  '/api/login/isauthenticated', '/api/login/getusersrole',
  '/api/login/getusersplayer', '/api/login/getuserinfo',
  '/api/login/isadminpasswordauthorized'
]);
const ALLOWED_WRITES = new Set([
  '/api/login/register', '/api/login/login', '/api/login/logout',
  '/api/scrambledata/addplayerwithoutleague', '/api/scrambledata/claimplayer'
]);
const REGRESSION_WRITES = /^(?:\/api\/Login\/(?:updatesetting|SetLockSignInStatus|VerifyAdminPassword)|\/api\/LeagueDivision\/Add|\/api\/Statistics\/(?:AddTeam|AddPlayerToLeagueTeam|SetTeamDivision|RecordLeagueTeamScore|RecordMatchupScores|UpdateTeamScores\/LSAuto_[a-f0-9]{24}_L[a-z0-9]+)|\/api\/ScrambleData\/(?:SignInPlayer(?:\/\d+)?|SaveCreatedTeamScores|UpdateKingQueenPlayerSubStatus|(?:AddNewLeague|AddPlayer|DeletePlayer|GenerateScramble|SaveKingQueenTeams|SaveKingQueenRoundScores)\/LSAuto_[a-f0-9]{24}_L[a-z0-9]+))$/i;
async function available() {
  return new Promise(resolve => {
    const req = https.get(BASE_URL + '/api/Login/isauthenticated', { timeout: 5000 }, res => {
      res.resume(); resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}
const test = base.extend({
  mutation: [false, { option: true }],
  regression: [false, { option: true }],
  approved: [async ({ mutation, regression }, use, testInfo) => {
    if (mutation) {
      if (!mutationApproval()) {
        testInfo.annotations.push({ type: 'blocked', description: 'Awaiting explicit first mutating-run approval and local approval file.' });
        test.skip(true, 'Mutation approval is absent.');
      }
      try {
        const evidence = verifyIsolation(regression ? 'development-regression' : 'milestone-one');
        testInfo.annotations.push({ type: 'isolation', description: evidence.mode === 'manual'
          ? 'MANUALLY VERIFIED; automated SQL session correlation did NOT pass.'
          : evidence.mode === 'runtime-environment' ? 'Effective running-process environment independently verified; automated SQL session correlation did NOT pass.'
          : 'Automated SQL session correlation passed.' });
        await testInfo.attach('isolation-evidence', { body: JSON.stringify(evidence), contentType: 'application/json' });
      } catch (error) {
        testInfo.annotations.push({ type: 'blocked', description: error.message });
        test.skip(true, error.message);
      }
    }
    await use(true);
  }, { auto: true }],
  context: async ({ context, mutation, regression }, use) => {
    await context.route('**/*', async route => {
      const request = route.request();
      try {
        const url = assertLocalUrl(request.url());
        if (mutation && request.method() !== 'GET') verifyIsolation(regression ? 'development-regression' : 'milestone-one');
        // Legacy roster GETs normalize stored Gender values on existing players.
        // Milestone one needs an empty picker, not access to real player records.
        if (/^\/api\/ScrambleData\/GetPlayers(?:\/|$)/i.test(url.pathname)) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return;
        }
        if (request.method() !== 'GET' && !ALLOWED_WRITES.has(url.pathname.toLowerCase()) && !(regression && REGRESSION_WRITES.test(url.pathname))) {
          await route.abort('blockedbyclient'); return;
        }
        if (!mutation && (request.method() !== 'GET' ||
            (url.pathname.toLowerCase().startsWith('/api/') && !SAFE_READS.has(url.pathname.toLowerCase())))) {
          await route.abort('blockedbyclient'); return;
        }
        await route.continue();
      } catch { await route.abort('blockedbyclient'); }
    });
    await use(context);
  },
  page: async ({ page }, use, testInfo) => {
    const diagnostics = [];
    page.on('pageerror', error => diagnostics.push({ kind: 'pageerror', message: error.message, stack: error.stack }));
    page.on('console', message => {
      // Browser console can print entire HTTP bodies. Keep location/type only.
      if (message.type() === 'error') diagnostics.push({ kind: 'console-error', location: message.location() });
    });
    page.on('response', response => {
      if (response.status() >= 400) diagnostics.push({ kind: 'http', method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() });
    });
    page.on('requestfailed', request => diagnostics.push({ kind: 'network', method: request.method(), path: new URL(request.url()).pathname, failure: request.failure() }));
    await use(page);
    await testInfo.attach('browser-diagnostics', { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' });
  },
  api: async ({ request, mutation, regression }, use, testInfo) => {
    const diagnostics = [];
    async function send(method, relative, data, headers) {
      const url = assertLocalUrl(new URL(relative, BASE_URL).href);
      if (!mutation && (method !== 'GET' || !SAFE_READS.has(url.pathname.toLowerCase()))) {
        throw new Error('Nonmutating request allowlist rejected this operation.');
      }
      if (method !== 'GET' && !ALLOWED_WRITES.has(url.pathname.toLowerCase()) && !(regression && REGRESSION_WRITES.test(url.pathname))) {
        throw new Error('Milestone-one mutation endpoint allowlist rejected this operation.');
      }
      if (mutation && method !== 'GET') verifyIsolation(regression ? 'development-regression' : 'milestone-one');
      const originHeaders = headers === null ? {} : Object.fromEntries(Object.entries({ Origin: BASE_URL, ...headers }).filter(([,value]) => value !== undefined));
      const response = await request.fetch(url.href, { method, data, headers: method === 'GET' ? headers : originHeaders, maxRedirects: 0 });
      diagnostics.push({ method, path: url.pathname, status: response.status() });
      if (response.status() >= 300 && response.status() < 400) throw new Error('Unexpected API redirect blocked.');
      return response;
    }
    await use({ get: route => send('GET', route), post: (route, data, headers) => send('POST', route, data, headers), delete: route => send('DELETE', route) });
    await testInfo.attach('api-diagnostics', { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' });
  },
  records: async ({}, use, testInfo) => {
    const runId = crypto.randomBytes(12).toString('hex');
    const directory = path.join(__dirname, '../artifacts/manifests');
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, runId + '.json');
    const manifest = { version: 1, runId, database: 'LeagueScramblerDev', baseURL: BASE_URL, test: testInfo.title, identities: [], leagues: [] };
    function save() { fs.writeFileSync(filename, JSON.stringify(manifest, null, 2)); }
    await use({
      runId,
      league(label) {
        if (!/^[a-z0-9]+$/.test(label)) throw new Error('Invalid league label.');
        const name = `LSAuto_${runId}_L${label}`;
        manifest.leagues.push({ name }); save(); return name;
      },
      captureLeague(name, snapshot) {
        const entry = manifest.leagues.find(l => l.name === name);
        if (!entry) throw new Error('League not reserved by this run.');
        entry.snapshot = snapshot; save();
      },
      create(label) {
        if (!/^[a-z0-9]+$/.test(label)) throw new Error('Invalid synthetic label.');
        const identity = { email: `lsauto_${runId}_${label}@example.invalid`, firstName: `LSAuto_${runId}`, lastName: `Test_${label}` };
        manifest.identities.push(identity); save();
        return { ...identity, password: crypto.randomBytes(18).toString('base64url') + '!aA1' };
      },
      capture(identity, snapshot) {
        const entry = manifest.identities.find(i => i.email === identity.email);
        entry.userIds = snapshot.users.map(u => u.UserId);
        entry.playerIds = snapshot.players.map(p => p.Id);
        entry.linkIds = snapshot.links.map(l => l.UsersPlayerId);
        save();
      }
    });
    for (const entry of manifest.identities) {
      try {
        const snapshot=db('snapshot',entry);
        entry.userIds=snapshot.users.map(u=>u.UserId);entry.playerIds=snapshot.players.map(p=>p.Id);entry.linkIds=snapshot.links.map(l=>l.UsersPlayerId);
      } catch(error) { (manifest.inventoryErrors ||= []).push(error.message); }
    }
    for (const entry of manifest.leagues) {
      try { entry.snapshot=db('leagueSnapshot',null,{leagueName:entry.name}); }
      catch(error) { (manifest.inventoryErrors ||= []).push(error.message); }
    }
    if (manifest.identities.length || manifest.leagues.length) save();
    if (manifest.identities.length) await testInfo.attach('synthetic-record-manifest', { path: filename, contentType: 'application/json' });
    // Deliberately no automatic deletion. Review cleanup-plan before any cleanup.
  }
});
module.exports = { test, expect, available };

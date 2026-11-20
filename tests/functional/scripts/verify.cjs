const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const { envSettings, assertLocalUrl, BASE_URL } = require('../helpers/safety.cjs');
assert.match(process.version, /^v22\./);
assert.equal(require('@playwright/test/package.json').version, '1.55.1');
assert.ok(fs.existsSync(chromium.executablePath()), 'Matching Chromium is missing.');
assert.deepEqual(envSettings(), { server: 'localhost', database: 'LeagueScramblerDev', windowsAuthentication: true });
assertLocalUrl(BASE_URL + '/api/Login/isauthenticated');
for (const url of ['https://allportsleaguehub.com', 'https://allportsleaguescrambler.com', 'http://localhost:5001', 'https://localhost:5001//api/x', BASE_URL + '/api/Login/forgotpassword']) {
  assert.throws(() => assertLocalUrl(url));
}
console.log('PASS: portable Node 22, pinned Playwright, Chromium, local SQL configuration, and URL/recovery safety guards.');

const assert = require('node:assert/strict');
const { db } = require('../helpers/database.cjs');
const target = db('target');
// PowerShell can serialize a single result row as either an object or array.
assert.equal((Array.isArray(target) ? target[0] : target).DatabaseName, 'LeagueScramblerDev');
const identity = { email: 'lsauto_000000000000000000000000_probe@example.invalid', firstName: 'LSAuto_000000000000000000000000', lastName: 'Test_probe' };
const snapshot = db('snapshot', identity);
for (const key of ['users', 'players', 'links']) assert.ok(Array.isArray(snapshot[key]), key + ' must be an array');
assert.throws(() => db('snapshot', { email: 'real@example.com', firstName: 'Real', lastName: 'Person' }));
assert.throws(() => db('delete', identity));
assert.ok(Array.isArray(db('cleanupReferences', identity).references));
console.log('PASS: Windows-authenticated dev-only SQL helper, snapshot shape, identity guard, and write-operation rejection. No records modified.');

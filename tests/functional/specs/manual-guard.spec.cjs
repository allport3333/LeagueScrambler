const { test, expect } = require('@playwright/test');
const { validateManualBinding,validateProcessBinding } = require('../helpers/isolation.cjs');
test('manual approval is limited to process identity, local configuration and expiry', () => {
  const identity = { pid: 12, processStartUtc: 'test-start', projectDll: 'repo-debug-dll', dllSha256: 'dll', envSha256: 'env', launchProfileSha256: 'profile', visualStudioDebug: true, loopbackOnly: true };
  const approval = { mode: 'manual', userConfirmed: true, scope: 'milestone-one', baseURL: 'https://localhost:5001', server: 'localhost', database: 'LeagueScramblerDev', expiresAt: new Date(Date.now()+60000).toISOString(), identity: { ...identity } };
  expect(() => validateManualBinding(approval, identity)).not.toThrow();
  for (const field of ['pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256']) {
    expect(() => validateManualBinding(approval, { ...identity, [field]: 'changed' })).toThrow();
  }
  for (const change of [{database:'LeagueScrambler'}, {baseURL:'https://allportsleaguehub.com'}, {server:'other'}, {expiresAt:'invalid'}, {expiresAt:'2000-01-01T00:00:00Z'}]) {
    expect(() => validateManualBinding({ ...approval, ...change }, identity)).toThrow();
  }
});
test('independent runtime proof preserves restart, configuration, database and deadline guards',()=>{
  const identity={pid:17,processStartUtc:'start',projectDll:'debug',dllSha256:'dll',envSha256:'env',launchProfileSha256:'profile',visualStudioDebug:true,loopbackOnly:true};
  const proof={mode:'runtime-environment',baseURL:'https://localhost:5001',server:'localhost',database:'LeagueScramblerDev',identity,expiresAt:new Date(Date.now()+60000).toISOString()};
  expect(()=>validateProcessBinding(proof,identity)).not.toThrow();
  expect(()=>validateManualBinding(proof,identity)).toThrow();
  for(const field of ['pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256'])expect(()=>validateProcessBinding(proof,{...identity,[field]:'different'})).toThrow();
  expect(()=>validateProcessBinding({...proof,database:'LeagueScrambler'},identity)).toThrow();
  expect(()=>validateProcessBinding({...proof,expiresAt:'2000-01-01T00:00:00Z'},identity)).toThrow();
  const {expiresAt,...inspection}=proof;
  expect(()=>validateProcessBinding({...inspection,mode:'runtime-inspection',mutationAuthorizationGranted:false},identity)).toThrow();
});

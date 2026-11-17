const fs=require('node:fs');
const path=require('node:path');
const {test,expect}=require('../helpers/fixtures.cjs');
const {account}=require('../helpers/regression.cjs');
test.use({mutation:true,regression:true,trace:'off'});

test('legacy administration unlock coexists with Player login and logout clears both',async({api,request,records},testInfo)=>{
  const file=path.join(__dirname,'../.local/legacy-test-credential.json');
  if(!fs.existsSync(file)){
    testInfo.annotations.push({type:'blocked',description:'Approved legacy test credential unavailable. The shared stored password is not read or overwritten.'});
    test.skip(true,'No approved test-only legacy credential.');
  }
  const credential=JSON.parse(fs.readFileSync(file,'utf8'));
  if(typeof credential.password!=='string'||!credential.password)throw new Error('Legacy credential file must provide a nonempty password; values are never logged.');
  await account(api,records,'legacyplayer',3);
  expect((await api.post('/api/Login/VerifyAdminPassword',{password:credential.password})).status()).toBe(200);
  expect(await(await api.get('/api/Login/IsAdminPasswordAuthorized')).json()).toBe(true);
  expect((await(await api.get('/api/Login/GetUsersRole')).json()).role).toBe('Player');
  const cookie=(await request.storageState()).cookies.find(c=>c.name==='LeagueScrambler.Admin');
  expect(cookie).toMatchObject({httpOnly:true,secure:true,sameSite:'Strict'});
  await api.post('/api/Login/logout',{});
  expect(await(await api.get('/api/Login/IsAdminPasswordAuthorized')).json()).toBe(false);
  expect(await(await api.get('/api/Login/isauthenticated')).json()).toBe(false);
});

test('server-side session ticket expiration and six-hour sliding renewal',async({},testInfo)=>{
  testInfo.annotations.push({type:'blocked',description:'Server-side ticket expiry/renewal requires a controlled server clock or extended-duration run; browser cookie deletion is tested separately and is not claimed as server expiry.'});
  test.skip(true,'No controlled server clock or six-hour run in this process-bound session.');
});

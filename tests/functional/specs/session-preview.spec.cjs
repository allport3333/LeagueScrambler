const { test, expect } = require('../helpers/fixtures.cjs');
const { account, league, roster, leagueSnapshot, capture } = require('../helpers/regression.cjs');
const { BASE_URL } = require('../helpers/safety.cjs');
const { verifyIsolation } = require('../helpers/isolation.cjs');
const { registerUi,dismissNotices } = require('../helpers/registration.cjs');
const { db } = require('../helpers/database.cjs');
test.use({ mutation: true, regression: true });

test('browser registration claims an existing synthetic player through matching-player confirmation',async({api,page,records})=>{
  await account(api,records,'admin',1);const target=await league(api,records,'claim');
  const player=await roster(api,records,target,'existing');const identity=player.fixtureIdentity;
  expect(db('snapshot',identity).users).toEqual([]);
  const userId=await registerUi(page,identity);
  await dismissNotices(page);
  await page.getByRole('button',{name:'Claim',exact:true}).click();
  const [claimed,logout]=await Promise.all([
    page.waitForResponse(r=>new URL(r.url()).pathname==='/api/ScrambleData/claimPlayer'&&r.request().method()==='POST'),
    page.waitForResponse(r=>new URL(r.url()).pathname==='/api/Login/logout'&&r.request().method()==='POST'),
    page.getByRole('button',{name:'Confirm',exact:true}).click()
  ]);
  expect(claimed.status()).toBe(200);expect(logout.status()).toBe(200);
  const snapshot=db('snapshot',identity);expect(snapshot.links).toHaveLength(1);expect(snapshot.links[0]).toMatchObject({UserId:userId,PlayerId:player.id});
  records.capture(identity,snapshot);capture(records,target);
});

test('session cookie flags, browser cookie expiry and logout remove client authorization', async ({ api, request, page, records }) => {
  await account(api,records,'admin',1);
  const target=await league(api,records,'session');
  const state=await request.storageState();
  const cookie=state.cookies.find(c=>c.name==='.AspNetCore.Cookies');
  expect(cookie).toBeTruthy();expect(cookie.httpOnly).toBe(true);expect(cookie.secure).toBe(true);expect(cookie.sameSite).toBe('Lax');
  await page.context().addCookies(state.cookies);
  expect(await (await page.request.get(BASE_URL+'/api/Login/isauthenticated',{maxRedirects:0})).json()).toBe(true);
  await page.context().addCookies([{...cookie,expires:Math.floor(Date.now()/1000)-10}]);
  expect(await (await page.request.get(BASE_URL+'/api/Login/isauthenticated',{maxRedirects:0})).json()).toBe(false);
  const before=leagueSnapshot(target.name);
  verifyIsolation('development-regression');
  expect((await page.request.post(BASE_URL+'/api/Login/updatesetting',{data:{leagueId:target.id,settingName:'dropLowest',settingValue:'900'},maxRedirects:0})).status()).toBe(401);
  expect(leagueSnapshot(target.name)).toEqual(before);
  expect((await api.post('/api/Login/logout',{})).status()).toBe(200);
  expect(await (await api.get('/api/Login/isauthenticated')).json()).toBe(false);
  expect((await request.storageState()).cookies.some(cookie => cookie.name === '.AspNetCore.Cookies')).toBe(false);
  capture(records,target);
});

test('public browser scramble preview runs client algorithm without SQL persistence', async ({ api, page, records }) => {
  await account(api,records,'admin',1);
  const target=await league(api,records,'preview');
  const players=[];
  for(let i=0;i<4;i++) players.push(await roster(api,records,target,'preview'+i,i%2===0));
  await api.post('/api/Login/logout',{});
  const before=leagueSnapshot(target.name);
  let persistenceRequests=0;
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/ScrambleData/GenerateScramble/')) persistenceRequests++;});
  await page.goto('/scrambler');
  await expect(page.locator('app-scrambler-component')).toBeVisible();
  // Inject only synthetic selection state through Angular's Development debug API.
  // The actual client algorithm and visible Scramble Players button are exercised.
  // League selection/picker UI is not claimed as covered by this fixture.
  await page.evaluate(({players,target})=>{
    const component=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;
    Object.assign(component,{selectedList:players,selectedLeague:target.name,selectedLeagueDto:{id:target.id,leagueName:target.name},numberOfTeams:2,completeRandom:true,locked:false,lockedResults:false,hideInputOptions:false,hideEverything:false});
    if(component.isActionAllowed) throw new Error('Preview must remain unauthenticated.');
    component.cdr.detectChanges();
  },{players,target});
  await page.getByRole('button',{name:'Scramble Players',exact:true}).first().click();
  await expect.poll(()=>page.evaluate(()=>{
    const c=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;
    return c.listOfTeams.reduce((n,t)=>n+t.players.length,0);
  })).toBe(4);
  const assigned=await page.evaluate(()=>window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.listOfTeams.flatMap(t=>t.players.map(p=>p.id)));
  expect(assigned.sort()).toEqual(players.map(p=>p.id).sort());
  expect(persistenceRequests).toBe(0);
  expect(leagueSnapshot(target.name)).toEqual(before);
  capture(records,target);
});

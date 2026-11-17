const { test, expect } = require('../helpers/fixtures.cjs');
const { db } = require('../helpers/database.cjs');
const { registerApi, createApi, registerUi, dismissNotices } = require('../helpers/registration.cjs');
const { BASE_URL } = require('../helpers/safety.cjs');
test.use({ mutation: true });

test('browser registration, player creation, automatic claim, login and logout', async ({ page, records }) => {
  const identity = records.create('browser');
  expect(db('snapshot', identity)).toEqual({ users: [], players: [], links: [] });
  try {
    const userId = await registerUi(page, identity);
    const registered = db('snapshot', identity);
    expect(registered.users).toEqual([{ UserId: userId, UserRoleId: 3 }]);
    records.capture(identity, registered);
    const pickerLink = page.getByRole('button', { name: 'Search or Add New Player To Claim', exact: true });
    const createPlayer = page.getByRole('button', { name: 'Create New Player', exact: true });
    await expect(pickerLink.or(createPlayer)).toBeVisible();
    await dismissNotices(page);
    if (await pickerLink.isVisible()) await pickerLink.click();
    await createPlayer.click();
    const form = page.locator('form').filter({ has: page.locator('input[formControlName="firstName"]') });
    await form.locator('input[formControlName="firstName"]').fill(identity.firstName);
    await form.locator('input[formControlName="lastName"]').fill(identity.lastName);
    await form.locator('mat-select[formControlName="gender"]').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();
    await dismissNotices(page);
    const [created, claimed, signedOut] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/AddPlayerWithoutLeague') && r.request().method() === 'POST'),
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/ScrambleData/claimPlayer' && r.request().method() === 'POST'),
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/Login/logout' && r.request().method() === 'POST'),
      form.getByRole('button', { name: 'Save Player', exact: true }).click()
    ]);
    expect(created.url()).toBe(BASE_URL + '/api/ScrambleData/AddPlayerWithoutLeague');
    expect(created.status()).toBe(200);
    expect(claimed.status()).toBe(200);
    expect(signedOut.status()).toBe(200);
    const playerId = (await created.json()).id;
    const snapshot = db('snapshot', identity);
    expect(snapshot.players).toEqual([{ Id: playerId }]);
    expect(snapshot.links).toHaveLength(1);
    expect(snapshot.links[0]).toMatchObject({ UserId: userId, PlayerId: playerId });
    records.capture(identity, snapshot);
    expect(await (await page.request.get(BASE_URL + '/api/Login/isauthenticated', { maxRedirects: 0 })).json()).toBe(false);
    await page.locator('#loginEmail').fill(identity.email);
    await page.locator('#loginPassword').fill(identity.password);
    const [login] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/Login/login' && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Submit', exact: true }).click()
    ]);
    expect(login.status()).toBe(200);
    expect(await (await page.request.get(BASE_URL + '/api/Login/isauthenticated', { maxRedirects: 0 })).json()).toBe(true);
    await dismissNotices(page);
    const [logout] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/Login/logout' && r.request().method() === 'POST'),
      page.locator('.d-lg-flex').getByRole('link', { name: 'Logout', exact: true }).click()
    ]);
    expect(logout.status()).toBe(200);
    expect(await (await page.request.get(BASE_URL + '/api/Login/isauthenticated', { maxRedirects: 0 })).json()).toBe(false);
  } finally { records.capture(identity, db('snapshot', identity)); }
});

test('API registration, player creation and claiming persist exact associations', async ({ api, records }) => {
  const identity = records.create('api');
  expect(db('snapshot', identity)).toEqual({ users: [], players: [], links: [] });
  try {
    const userId = await registerApi(api, identity);
    const playerId = await createApi(api, identity);
    const claim = await api.post('/api/ScrambleData/claimPlayer', { userId, playerId });
    expect(claim.status()).toBe(200);
    const snapshot = db('snapshot', identity);
    expect(snapshot.users).toEqual([{ UserId: userId, UserRoleId: 3 }]);
    expect(snapshot.players).toEqual([{ Id: playerId }]);
    expect(snapshot.links).toHaveLength(1);
    expect(snapshot.links[0]).toMatchObject({ UserId: userId, PlayerId: playerId });
    expect((await api.get('/api/Login/GetUsersRole')).status()).toBe(200);
    const role = await (await api.get('/api/Login/GetUsersRole')).json();
    expect(role.role).toBe('Player');
    expect((await api.post('/api/Login/logout', {})).status()).toBe(200);
    expect(await (await api.get('/api/Login/isauthenticated')).json()).toBe(false);
    expect((await api.post('/api/Login/login', { email: identity.email, password: identity.password, rememberMe: false })).status()).toBe(200);
    expect(await (await api.get('/api/Login/isauthenticated')).json()).toBe(true);
    expect((await api.post('/api/Login/logout', {})).status()).toBe(200);
  } finally { records.capture(identity, db('snapshot', identity)); }
});

test('duplicate and cross-account player claims return 409 without changing associations', async ({ api, records }) => {
  const owner = records.create('owner');
  const other = records.create('other');
  expect(db('snapshot', owner)).toEqual({ users: [], players: [], links: [] });
  expect(db('snapshot', other)).toEqual({ users: [], players: [], links: [] });
  try {
    const ownerId = await registerApi(api, owner);
    const playerId = await createApi(api, owner);
    expect((await api.post('/api/ScrambleData/claimPlayer', { userId: ownerId, playerId })).status()).toBe(200);
    const before = db('snapshot', owner);
    expect((await api.post('/api/ScrambleData/claimPlayer', { userId: ownerId, playerId })).status()).toBe(409);
    expect(db('snapshot', owner)).toEqual(before);
    await api.post('/api/Login/logout', {});
    const otherId = await registerApi(api, other);
    const otherBefore = db('snapshot', other);
    expect((await api.post('/api/ScrambleData/claimPlayer', { userId: otherId, playerId })).status()).toBe(409);
    expect(db('snapshot', owner)).toEqual(before);
    expect(db('snapshot', other)).toEqual(otherBefore);
    // Supplying another user's ID must fail independently of duplicate detection.
    expect((await api.post('/api/ScrambleData/claimPlayer', { userId: ownerId, playerId })).status()).toBe(403);
    expect(db('snapshot', owner)).toEqual(before);
    expect(db('snapshot', other)).toEqual(otherBefore);
  } finally {
    records.capture(owner, db('snapshot', owner));
    records.capture(other, db('snapshot', other));
  }
});

test('anonymous player creation is rejected with no new database records', async ({ api, records }) => {
  const identity = records.create('anonymous');
  const before = db('snapshot', identity);
  expect(before).toEqual({ users: [], players: [], links: [] });
  const response = await api.post('/api/ScrambleData/AddPlayerWithoutLeague', {
    firstName: identity.firstName, lastName: identity.lastName, gender: 'Male', isSub: false
  });
  expect(response.status()).toBe(401);
  const after = db('snapshot', identity);
  records.capture(identity, after);
  expect(after).toEqual(before);
});

test('registration cannot overpost an Admin role or administrator flag',async({api,records})=>{
  const identity=records.create('roleoverpost');
  expect(db('snapshot',identity)).toEqual({users:[],players:[],links:[]});
  try {
    const response=await api.post('/api/Login/register',{email:identity.email,password:identity.password,firstName:identity.firstName,lastName:identity.lastName,userRoleId:1,isAdmin:true});
    expect(response.status()).toBe(200);
    expect(db('snapshot',identity).users[0].UserRoleId).toBe(3);
    expect((await(await api.get('/api/Login/GetUsersRole')).json()).role).toBe('Player');
  } finally {records.capture(identity,db('snapshot',identity));}
});

test('invalid login issues no authenticated session or database records',async({api,records})=>{
  const identity=records.create('invalidlogin');const before=db('snapshot',identity);
  const response=await api.post('/api/Login/login',{email:identity.email,password:identity.password});
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toBe('Invalid email or password.');
  expect(await(await api.get('/api/Login/isauthenticated')).json()).toBe(false);
  expect(db('snapshot',identity)).toEqual(before);
});

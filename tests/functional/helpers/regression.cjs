const { expect } = require('@playwright/test');
const { db } = require('./database.cjs');
const { verifyIsolation } = require('./isolation.cjs');
const { registerApi } = require('./registration.cjs');
async function login(api, identity) {
  await api.post('/api/Login/logout', {});
  const response = await api.post('/api/Login/login', { email: identity.email, password: identity.password, rememberMe: false });
  expect(response.status(), 'Synthetic account login').toBe(200);
}
async function account(api, records, label, role = 3) {
  await api.post('/api/Login/logout', {});
  const identity = records.create(label);
  expect(db('snapshot', identity)).toEqual({ users: [], players: [], links: [] });
  identity.userId = await registerApi(api, identity);
  records.capture(identity, db('snapshot', identity));
  if (role !== 3) {
    verifyIsolation('development-regression');
    db('provisionRole', identity, { userId: identity.userId, roleId: role });
    await login(api, identity);
  }
  expect((await (await api.get('/api/Login/GetUsersRole')).json()).role).toBe({1:'Admin',2:'Manager',3:'Player'}[role]);
  return identity;
}
function leagueSnapshot(name) { return db('leagueSnapshot', null, { leagueName: name }); }
async function league(api, records, label) {
  const name = records.league(label);
  expect(leagueSnapshot(name)).toEqual({ league: [] });
  const response = await api.post('/api/ScrambleData/AddNewLeague/' + name, []);
  expect(response.status(), 'Synthetic league creation').toBe(200);
  const body = await response.json();
  records.captureLeague(name, leagueSnapshot(name));
  return { id: body.id, name };
}
async function roster(api, records, target, label, isMale = true, divisionId = 0) {
  const identity = records.create(label);
  expect(db('snapshot', identity)).toEqual({ users: [], players: [], links: [] });
  const player = { firstName: identity.firstName, lastName: identity.lastName, isMale, gender: isMale ? 'Male' : 'Female', isSub: false };
  const response = await api.post(`/api/ScrambleData/AddPlayer/${target.name}?leagueDivisionId=${divisionId}`, player);
  expect(response.status(), 'Synthetic roster player creation').toBe(200);
  Object.assign(player, await response.json());
  records.capture(identity, db('snapshot', identity));
  records.captureLeague(target.name, leagueSnapshot(target.name));
  Object.defineProperty(player,'fixtureIdentity',{value:identity,enumerable:false});
  return player;
}
async function deniedUnchanged(api, target, path, body, status) {
  const before = leagueSnapshot(target.name);
  const response = await api.post(path, body);
  expect(response.status(), path).toBe(status);
  expect(leagueSnapshot(target.name), 'Rejected request must not change league records').toEqual(before);
}
function capture(records, ...leagues) {
  for (const target of leagues) records.captureLeague(target.name, leagueSnapshot(target.name));
}
module.exports = { account, login, league, roster, leagueSnapshot, deniedUnchanged, capture };

const {test,expect}=require('../helpers/fixtures.cjs');
const {account}=require('../helpers/regression.cjs');
test.use({mutation:true,regression:true,trace:'off'});

test('Player login keeps a secure normal session and logout revokes it',async({api,request,records})=>{
  await account(api,records,'sessionplayer',3);
  const cookies=(await request.storageState()).cookies;
  expect(cookies.find(cookie=>cookie.name==='.AspNetCore.Cookies')).toMatchObject({httpOnly:true,secure:true,sameSite:'Lax'});
  expect(cookies.some(cookie=>cookie.name==='LeagueScrambler.Admin')).toBe(false);
  await api.post('/api/Login/logout',{});
  expect(await(await api.get('/api/Login/isauthenticated')).json()).toBe(false);
});

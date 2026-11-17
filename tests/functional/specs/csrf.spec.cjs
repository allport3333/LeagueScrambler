const {test,expect}=require('../helpers/fixtures.cjs');
const {db}=require('../helpers/database.cjs');
const {account,league,roster,leagueSnapshot}=require('../helpers/regression.cjs');
const {BASE_URL}=require('../helpers/safety.cjs');
test.use({mutation:true,regression:true});

test('CSRF registration rejects foreign opaque missing and malformed origins without records',async({api,records})=>{
  const identity=records.create('csrfregister');
  const body={...identity};
  const before=db('snapshot',identity);
  for(const headers of [{Origin:'https://attacker.invalid'},{Origin:'null'},null,{Origin:BASE_URL+'.attacker.invalid'},{Origin:BASE_URL+'/unexpected'}, {Origin:'http://localhost:5001'}]){
    expect((await api.post('/api/Login/register',body,headers)).status()).toBe(403);
    expect(db('snapshot',identity)).toEqual(before);
  }
  expect((await api.post('/api/Login/register',body,{Origin:undefined,Referer:BASE_URL+'/'})).status()).toBe(200);
  records.capture(identity,db('snapshot',identity));
});

test('CSRF login rejection preserves the current synthetic session',async({api,records})=>{
  const identity=await account(api,records,'csrflogin');
  const before=db('snapshot',identity);
  const prior=await(await api.get('/api/Login/GetUsersRole')).json();
  expect((await api.post('/api/Login/login',{email:identity.email,password:identity.password},{Origin:'https://attacker.invalid'})).status()).toBe(403);
  expect(await(await api.get('/api/Login/GetUsersRole')).json()).toEqual(prior);
  expect(db('snapshot',identity)).toEqual(before);
});

test('CSRF player creation claiming and public sign-in reject foreign origins without changes',async({api,records})=>{
  const owner=await account(api,records,'csrfmanager',2);
  const target=await league(api,records,'csrf');
  const player=await roster(api,records,target,'csrfplayer');
  const unused=records.create('csrfunused');
  const before=leagueSnapshot(target.name);
  const accountBefore=db('snapshot',owner);
  const foreign={Origin:'https://attacker.invalid'};
  expect((await api.post('/api/ScrambleData/AddPlayerWithoutLeague',{firstName:unused.firstName,lastName:unused.lastName,gender:'Male'},foreign)).status()).toBe(403);
  expect((await api.post('/api/ScrambleData/claimPlayer',{userId:owner.userId,playerId:player.id},foreign)).status()).toBe(403);
  expect((await api.post('/api/ScrambleData/SignInPlayer',{leagueId:target.id,playerId:player.id,dateTime:new Date().toISOString()},foreign)).status()).toBe(403);
  expect(leagueSnapshot(target.name)).toEqual(before);
  expect(db('snapshot',owner)).toEqual(accountBefore);
  expect(db('snapshot',unused)).toEqual({users:[],players:[],links:[]});
});

test('public league player GET normalizes display without persisting gender',async({api,records})=>{
  await account(api,records,'getmanager',2);
  const target=await league(api,records,'getreadonly');
  const identity=records.create('getdisplay');
  const response=await api.post('/api/ScrambleData/AddPlayer/'+target.name,{firstName:identity.firstName,lastName:identity.lastName,gender:'SyntheticStoredValue',isMale:false,isSub:false});
  expect(response.status()).toBe(200);
  records.capture(identity,db('snapshot',identity));
  const before=db('snapshot',identity,{includeDisplay:true});
  expect(before.players[0].Gender).toBe('SyntheticStoredValue');
  const listed=await api.get('/api/ScrambleData/GetPlayers/'+target.id);
  expect(listed.status()).toBe(200);
  expect((await listed.json()).find(p=>p.id===before.players[0].Id).gender).toBe('Female');
  expect(db('snapshot',identity,{includeDisplay:true})).toEqual(before);
});

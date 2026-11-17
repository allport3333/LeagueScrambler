const {test,expect}=require('../helpers/fixtures.cjs');
const {db}=require('../helpers/database.cjs');
const {account,league,roster,leagueSnapshot}=require('../helpers/regression.cjs');
const {BASE_URL}=require('../helpers/safety.cjs');
test.use({mutation:true,regression:true});

for(const [role,roleId] of [['Admin',1],['Manager',2]]){
  test(`management CSRF ${role}: rejected writes preserve SQL and real-browser same-origin writes succeed`,async({api,request,page,records})=>{
    await account(api,records,'management',roleId);
    // Transfer only this test's synthetic session to the browser. No real accounts.
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto('/');
    const browserPost=async(path,data)=>page.evaluate(async({path,data})=>{
      const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const text=await response.text();
      return {status:response.status,body:response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):text};
    },{path,data});
    const hostile=[{Origin:'https://attacker.invalid'},{Origin:'null'},null,
      {Origin:'https://attacker.invalid','X-Forwarded-Host':'attacker.invalid','X-Forwarded-Proto':'https'}];
    const deniedName=records.league('deniedcreation');
    for(const headers of hostile){
      expect((await api.post('/api/ScrambleData/AddNewLeague/'+deniedName,[],headers)).status()).toBe(403);
      expect(leagueSnapshot(deniedName)).toEqual({league:[]});
    }
    const name=records.league('browsermanagement');
    const created=await browserPost('/api/ScrambleData/AddNewLeague/'+name,[]);
    expect(created.status).toBe(200);
    const target={name,id:created.body.id};
    records.captureLeague(name,leagueSnapshot(name));
    const player=await roster(api,records,target,'teamcandidate');
    const teams=[];
    for(const teamName of ['Synthetic CSRF One','Synthetic CSRF Two']){
      const response=await api.post('/api/Statistics/AddTeam',{leagueId:target.id,teamName,division:'Gold'});
      expect(response.status()).toBe(200);teams.push(await response.json());
    }
    expect((await api.post('/api/Statistics/RecordLeagueTeamScore',{teamId:teams[0].id,opponentsTeamId:teams[1].id,teamScore:21,wonGame:true,date:new Date().toISOString()})).status()).toBe(200);
    const operations=[
      `/api/Statistics/AddPlayerToLeagueTeam?leagueTeamId=${teams[0].id}&playerId=${player.id}`,
      `/api/Statistics/SetTeamDivision?leagueTeamId=${teams[0].id}&division=Silver`,
      '/api/Statistics/UpdateTeamScores/'+name
    ];
    for(const path of operations){
      const before=leagueSnapshot(name);
      for(const headers of hostile){
        expect((await api.post(path,{},headers)).status()).toBe(403);
        expect(leagueSnapshot(name),'Cross-origin rejection must preserve the complete synthetic league graph').toEqual(before);
      }
      expect((await browserPost(path,{})).status).toBe(200);
    }
    const after=leagueSnapshot(name);
    expect(after.teamPlayers.some(row=>row.LeagueTeamId===teams[0].id&&row.PlayerId===player.id)).toBe(true);
    expect(after.teams.find(row=>row.ID===teams[0].id)).toMatchObject({Division:'Silver',TotalWins:1,TotalLosses:0});
    records.captureLeague(name,after);
  });
}

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

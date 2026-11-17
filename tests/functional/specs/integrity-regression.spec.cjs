const {test,expect}=require('../helpers/fixtures.cjs');
const {account,league,roster,leagueSnapshot,capture,deniedUnchanged}=require('../helpers/regression.cjs');
test.use({mutation:true,regression:true});

test('division assignment rejects a division owned by another synthetic league',async({api,records})=>{
  const admin=await account(api,records,'admin',1);
  const foreign=await league(api,records,'foreign');
  expect((await api.post('/api/LeagueDivision/Add',{leagueId:foreign.id,code:'FOREIGN',name:'Foreign',sortOrder:1})).status()).toBe(200);
  const division=leagueSnapshot(foreign.name).divisions[0];
  const own=await league(api,records,'own');
  const player=await roster(api,records,own,'member');
  try {
    await deniedUnchanged(api,own,`/api/ScrambleData/AddPlayer/${own.name}?leagueDivisionId=${division.Id}`,player,400);
  } finally {capture(records,foreign,own);}
});

test('new Create Teams batch shares one scramble number across its teams',async({api,records})=>{
  await account(api,records,'admin',1);const target=await league(api,records,'group');
  const one=await roster(api,records,target,'one');const two=await roster(api,records,target,'two',false);
  const payload=[one,two].map(player=>({kingQueenTeamId:0,leagueId:target.id,date:new Date().toISOString().slice(0,10),scrambleNumber:0,players:[{playerId:player.id,isSubScore:false}],roundScores:[{roundId:1,roundScore:21,roundWon:true}]}));
  try {
    expect((await api.post('/api/ScrambleData/SaveCreatedTeamScores',payload)).status()).toBe(200);
    const snapshot=leagueSnapshot(target.name);expect(snapshot.kqTeams).toHaveLength(2);
    expect([...new Set(snapshot.kqTeams.map(t=>t.ScrambleNumber))]).toEqual([1]);
    const standings=await(await api.get('/api/ScrambleData/GetByLeague/'+target.name)).json();expect(standings.maxRounds).toBe(1);
  } finally {capture(records,target);}
});

test('King/Queen standings expose distinct division code and display name',async({api,records})=>{
  await account(api,records,'admin',1);const target=await league(api,records,'labels');
  expect((await api.post('/api/LeagueDivision/Add',{leagueId:target.id,code:'GOLD',name:'Golden training division',sortOrder:1})).status()).toBe(200);
  const division=leagueSnapshot(target.name).divisions[0];
  const player=await roster(api,records,target,'member',true,division.Id);
  try {
    expect((await api.post('/api/ScrambleData/SaveCreatedTeamScores',[{kingQueenTeamId:0,leagueId:target.id,date:new Date().toISOString().slice(0,10),scrambleNumber:1,players:[{playerId:player.id,isSubScore:false}],roundScores:[{roundId:1,roundScore:21,roundWon:true}]}])).status()).toBe(200);
    const standings=await(await api.get('/api/ScrambleData/GetByLeague/'+target.name)).json();
    expect(standings.playerScores[0].leagueDivisionCode).toBe('GOLD');
    expect(standings.playerScores[0].leagueDivisionName).toBe('Golden training division');
    const matchup=await(await api.get('/api/ScrambleData/GetByLeagueMatchup/'+target.name)).json();
    expect(matchup.playerScores[0].leagueDivisionCode).toBe('GOLD');
    expect(matchup.playerScores[0].leagueDivisionName).toBe('Golden training division');
  } finally {capture(records,target);}
});

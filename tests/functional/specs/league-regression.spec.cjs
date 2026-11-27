const { test, expect } = require('../helpers/fixtures.cjs');
const { db } = require('../helpers/database.cjs');
const { account, login, league, roster, leagueSnapshot, deniedUnchanged, capture } = require('../helpers/regression.cjs');
test.use({ mutation: true, regression: true });

test('Admin and Manager authenticate; league ownership and default settings persist', async ({ api, records }) => {
  const admin = await account(api, records, 'admin', 1);
  const first = await league(api, records, 'admin');
  expect(leagueSnapshot(first.name).owners[0].UserId).toBe(admin.userId);
  expect(leagueSnapshot(first.name).settings.map(s => s.SettingName).sort()).toEqual(['dayOfLeague','dropLowest','numberOfSubsAllowed','subScorePercent'].sort());
  const manager = await account(api, records, 'manager', 2);
  const second = await league(api, records, 'manager');
  expect(leagueSnapshot(second.name).owners[0].UserId).toBe(manager.userId);
  expect((await (await api.get('/api/Login/getuserleagues')).json()).map(league => league.id)).toEqual([second.id]);
  await deniedUnchanged(api, first, '/api/ScrambleData/AddNewLeague/'+first.name, [], 403);
  expect((await api.post('/api/Login/updatesetting', { leagueId: second.id, settingName: 'dropLowest', settingValue: '1' })).status()).toBe(200);
  expect(leagueSnapshot(second.name).settings.find(s => s.SettingName==='dropLowest').SettingValue).toBe('1');
  await login(api, admin);
  expect((await api.post('/api/Login/updatesetting', { leagueId: second.id, settingName: 'dropLowest', settingValue: '2' })).status()).toBe(200);
  expect(leagueSnapshot(second.name).settings.find(s => s.SettingName==='dropLowest').SettingValue).toBe('2');
  capture(records, first, second);
});

test('only Admin can grant or revoke an existing Manager’s league assignments', async ({ api, records }) => {
  const admin = await account(api, records, 'admin', 1);
  const first = await league(api, records, 'first');
  const second = await league(api, records, 'second');
  const unrelated = await league(api, records, 'unrelated');
  const manager = await account(api, records, 'manager', 2);
  const player = await account(api, records, 'player', 3);
  const assignment = leagueId => '/api/Login/LeagueManager/' + leagueId;
  const update = league => ({ leagueId: league.id, settingName: 'dropLowest', settingValue: '1' });
  const change = { email: manager.email, assigned: true };
  expect((await api.put(assignment(first.id), change)).status()).toBe(403);
  await login(api, manager);
  expect((await api.put(assignment(first.id), change)).status()).toBe(403);
  await deniedUnchanged(api, first, '/api/Login/updatesetting', update(first), 403);

  await login(api, admin);
  expect((await api.put(assignment(first.id), { ...change, email: player.email })).status()).toBe(404);
  for (const target of [first, second, first]) {
    expect((await api.put(assignment(target.id), change)).status()).toBe(204);
    expect(leagueSnapshot(target.name).owners.filter(owner => owner.UserId === manager.userId)).toHaveLength(1);
  }
  await login(api, manager);
  const assigned = await (await api.get('/api/Login/getuserleagues')).json();
  expect(assigned.map(league => league.id).sort()).toEqual([first.id, second.id].sort());
  for (const target of [first, second]) {
    expect((await api.post('/api/Login/updatesetting', update(target))).status()).toBe(200);
  }
  await deniedUnchanged(api, unrelated, '/api/Login/updatesetting', update(unrelated), 403);

  await login(api, admin);
  expect((await api.put(assignment(first.id), { ...change, assigned: false })).status()).toBe(204);
  await login(api, manager);
  await deniedUnchanged(api, first, '/api/Login/updatesetting', update(first), 403);
  expect((await api.post('/api/Login/updatesetting', update(second))).status()).toBe(200);
  capture(records, first, second, unrelated);
});

test('divisions, player assignment, duplicate division rejection and roster removal', async ({ api, records }) => {
  await account(api, records, 'admin', 1);
  const target=await league(api, records, 'division');
  const division={leagueId:target.id,code:'GOLD',name:'Gold test division',sortOrder:1};
  expect((await api.post('/api/LeagueDivision/Add',division)).status()).toBe(200);
  const divisions=await (await api.get('/api/LeagueDivision/GetByLeague/'+target.name)).json();
  expect(divisions).toHaveLength(1);
  const player=await roster(api,records,target,'member',true,divisions[0].id);
  expect(leagueSnapshot(target.name).memberships[0]).toMatchObject({PlayerID:player.id,LeagueDivisionId:divisions[0].id});
  await deniedUnchanged(api,target,'/api/LeagueDivision/Add',division,400);
  expect((await api.post('/api/ScrambleData/DeletePlayer/'+target.name,player)).status()).toBe(200);
  expect(leagueSnapshot(target.name).memberships).toEqual([]);
  // Deleting league membership must preserve the synthetic global profile.
  expect(leagueSnapshot(target.name).divisions).toHaveLength(1);
  capture(records,target);
});

test('public sign-ins enforce membership, duplicate prevention and lock/unlock', async ({ api, records }) => {
  const admin=await account(api,records,'admin',1);
  const target=await league(api,records,'signin');
  const one=await roster(api,records,target,'one');
  const two=await roster(api,records,target,'two',false);
  const other=await league(api,records,'other');
  const outsider=await roster(api,records,other,'outsider');
  const request=player=>({playerId:player.id,leagueId:target.id,dateTime:new Date().toISOString(),lockedSignIn:true,playerSignInId:99999999});
  const availability = async id => (await api.get('/api/Login/LeagueAttendanceAvailability/'+id)).json();
  const setMode = mode => api.post('/api/Login/SetLockSignInStatus',{leagueId:target.id,mode});
  const otherState = await availability(other.id);
  const today = new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'America/New_York'}).format(new Date());
  const leagueDay = today === 'Sunday' ? 'Monday' : 'Sunday';
  expect((await api.post('/api/Login/updatesetting',{leagueId:target.id,settingName:'dayOfLeague',settingValue:leagueDay})).status()).toBe(200);
  expect(await availability(target.id)).toMatchObject({mode:'automatic',locked:true});
  const beforeLockRead=leagueSnapshot(target.name);
  expect(await(await api.get('/api/Login/GetLockSignInStatus/'+target.id)).json()).toBe(true);
  expect(leagueSnapshot(target.name)).toEqual(beforeLockRead);
  await api.post('/api/Login/logout',{});
  expect((await setMode('open')).status()).toBe(401);
  await deniedUnchanged(api,target,'/api/ScrambleData/SignInPlayer',request(one),423);
  await login(api,admin);
  expect(await (await setMode('open')).json()).toMatchObject({mode:'open',locked:false});
  await api.post('/api/Login/logout',{});
  const signIn=await api.post('/api/ScrambleData/SignInPlayer',request(one));
  expect(signIn.status()).toBe(200);
  expect(leagueSnapshot(target.name).signIns[0]).toMatchObject({PlayerId:one.id,LockedSignIn:false});
  await deniedUnchanged(api,target,'/api/ScrambleData/SignInPlayer',request(one),409);
  await deniedUnchanged(api,target,'/api/ScrambleData/SignInPlayer',request(outsider),400);
  await login(api,admin);
  expect((await api.post('/api/Login/SetLockSignInStatus',{leagueId:target.id,locked:true})).status()).toBe(200);
  await api.post('/api/Login/logout',{});
  await deniedUnchanged(api,target,'/api/ScrambleData/SignInPlayer',request(two),423);
  await login(api,admin);
  expect((await api.post('/api/Login/SetLockSignInStatus',{leagueId:target.id,locked:false})).status()).toBe(200);
  await api.post('/api/Login/logout',{});
  expect((await api.post('/api/ScrambleData/SignInPlayer',request(two))).status()).toBe(200);
  expect(leagueSnapshot(target.name).signIns).toHaveLength(2);
  const signInDate=(await signIn.json()).dateTime.slice(0,10);
  const listed=await(await api.get(`/api/ScrambleData/GetSignedInPlayers?leagueId=${target.id}&date=${signInDate}`)).json();
  expect(listed.map(p=>p.playerId).sort()).toEqual([one.id,two.id].sort());
  const self=await account(api,records,'self',3);
  expect((await api.post('/api/ScrambleData/claimPlayer',{userId:self.userId,playerId:one.id})).status()).toBe(200);
  const ownEntry=leagueSnapshot(target.name).signIns.find(s=>s.PlayerId===one.id);
  const otherEntry=leagueSnapshot(target.name).signIns.find(s=>s.PlayerId===two.id);
  expect((await api.delete('/api/ScrambleData/SignInPlayer/'+ownEntry.PlayerSignInId)).status()).toBe(204);
  const afterOwnRemoval=leagueSnapshot(target.name);
  expect(afterOwnRemoval.signIns).toHaveLength(1);
  expect((await api.delete('/api/ScrambleData/SignInPlayer/'+otherEntry.PlayerSignInId)).status()).toBe(403);
  expect(leagueSnapshot(target.name)).toEqual(afterOwnRemoval);
  await login(api,admin);
  expect(await (await setMode('automatic')).json()).toMatchObject({mode:'automatic',locked:true});
  expect(await availability(other.id)).toEqual(otherState);
  expect(leagueSnapshot(target.name).signIns).toEqual(afterOwnRemoval.signIns);
  capture(records,target,other);
});

test('team creation, membership, score entry, standings and recalculation', async ({ api, records }) => {
  await account(api,records,'admin',1);
  const target=await league(api,records,'teams');
  const player=await roster(api,records,target,'member');
  const create=async name=>{
    const response=await api.post('/api/Statistics/AddTeam',{leagueId:target.id,teamName:name,division:'Gold'});
    expect(response.status()).toBe(200);return response.json();
  };
  const one=await create('Synthetic One');const two=await create('Synthetic Two');
  expect((await api.post(`/api/Statistics/AddPlayerToLeagueTeam?leagueTeamId=${one.id}&playerId=${player.id}`,{})).status()).toBe(200);
  await deniedUnchanged(api,target,`/api/Statistics/AddPlayerToLeagueTeam?leagueTeamId=${one.id}&playerId=${player.id}`,{},400);
  expect((await api.post(`/api/Statistics/SetTeamDivision?leagueTeamId=${one.id}&division=Silver`,{})).status()).toBe(200);
  for(const [team,opponent,points,won] of [[one,two,21,true],[two,one,15,false]]){
    const response=await api.post('/api/Statistics/RecordLeagueTeamScore',{teamId:team.id,opponentsTeamId:opponent.id,teamScore:points,wonGame:won,date:new Date().toISOString()});
    expect(response.status()).toBe(200);
  }
  const standings=await (await api.get('/api/Statistics/league-standings/'+target.id)).json();
  expect(standings.find(t=>t.teamName===one.teamName)).toMatchObject({wins:1,losses:0,totalPoints:21,division:'Silver'});
  expect(standings.find(t=>t.teamName===two.teamName)).toMatchObject({wins:0,losses:1,totalPoints:15});
  expect((await api.post('/api/Statistics/UpdateTeamScores/'+target.name,{})).status()).toBe(200);
  const snapshot=leagueSnapshot(target.name);
  expect(snapshot.teams.find(t=>t.ID===one.id)).toMatchObject({TotalWins:1,TotalLosses:0});
  expect(snapshot.teams.find(t=>t.ID===two.id)).toMatchObject({TotalWins:0,TotalLosses:1});
  const other=await league(api,records,'cross');
  const cross=await (await api.post('/api/Statistics/AddTeam',{leagueId:other.id,teamName:'Synthetic Cross'})).json();
  await deniedUnchanged(api,target,'/api/Statistics/RecordLeagueTeamScore',{teamId:one.id,opponentsTeamId:cross.id,teamScore:10,wonGame:true,date:new Date().toISOString()},400);
  capture(records,target,other);
});

test('authorized scrambles persist, King/Queen scores update and standings reflect rounds', async ({ api, records }) => {
  const admin=await account(api,records,'admin',1);
  const target=await league(api,records,'scramble');
  const one=await roster(api,records,target,'one'); const two=await roster(api,records,target,'two',false);
  const bye=await roster(api,records,target,'bye');
  const request={kingQueenTeams:[{kingQueenTeam:{},players:[one,two]}],byePlayers:[bye]};
  await api.post('/api/Login/logout',{});
  await deniedUnchanged(api,target,'/api/ScrambleData/GenerateScramble/'+target.name,request,401);
  await login(api,admin);
  const generated=await api.post('/api/ScrambleData/GenerateScramble/'+target.name,request);
  expect(generated.status()).toBe(200);
  expect(leagueSnapshot(target.name).kqTeams).toHaveLength(1);
  expect(leagueSnapshot(target.name).kqTeams[0].ScrambleWithScoresToBeSaved).toBe(false);
  expect((await api.post('/api/ScrambleData/SaveKingQueenTeams/'+target.name,request)).status()).toBe(200);
  const saved=leagueSnapshot(target.name); const team=saved.kqTeams[0];
  expect(team.ScrambleWithScoresToBeSaved).toBe(true);
  expect(saved.kqPlayers.map(p=>p.PlayerId).sort()).toEqual([one.id,two.id].sort());
  expect(saved.byes).toHaveLength(1);
  const scores={roundScores:[{id:0,kingQueenTeamId:team.Id,roundId:1,roundScore:21,roundWon:true}],kingQueenPlayers:[]};
  expect((await api.post('/api/ScrambleData/SaveKingQueenRoundScores/'+target.name,scores)).status()).toBe(200);
  const row=leagueSnapshot(target.name).kqScores[0];
  expect(row).toMatchObject({RoundScore:21,RoundWon:true});
  scores.roundScores[0]={...scores.roundScores[0],id:row.Id,roundScore:18,roundWon:false};
  expect((await api.post('/api/ScrambleData/SaveKingQueenRoundScores/'+target.name,scores)).status()).toBe(200);
  const standings=await (await api.get('/api/ScrambleData/GetByLeague/'+target.name)).json();
  expect(standings.maxRounds).toBe(1);expect(standings.playerScores).toHaveLength(2);
  for(const player of standings.playerScores) expect(player.scores[0]).toMatchObject({score:18,roundWon:0});
  expect((await api.post('/api/ScrambleData/UpdateKingQueenPlayerSubStatus',{kingQueenTeamId:team.Id,playerId:one.id,isSubScore:true})).status()).toBe(204);
  expect(leagueSnapshot(target.name).kqPlayers.find(p=>p.PlayerId===one.id).isSubScore).toBe(true);
  const other=await league(api,records,'other');
  const otherBefore=leagueSnapshot(other.name);
  await deniedUnchanged(api,target,'/api/ScrambleData/SaveKingQueenRoundScores/'+other.name,scores,400);
  expect(leagueSnapshot(other.name)).toEqual(otherBefore);
  capture(records,target,other);
});

test('Create Teams saves new teams and updates existing King/Queen round scores', async ({ api, records }) => {
  await account(api,records,'admin',1);
  const target=await league(api,records,'created');const player=await roster(api,records,target,'member');
  const payload=[{kingQueenTeamId:0,leagueId:target.id,date:new Date().toISOString().slice(0,10),scrambleNumber:1,players:[{playerId:player.id,isSubScore:false}],roundScores:[{roundId:1,roundScore:21,roundWon:true}]}];
  const response=await api.post('/api/ScrambleData/SaveCreatedTeamScores',payload);
  expect(response.status()).toBe(200);
  const snapshot=leagueSnapshot(target.name);expect(snapshot.kqTeams).toHaveLength(1);expect(snapshot.kqScores[0].RoundScore).toBe(21);
  payload[0].kingQueenTeamId=snapshot.kqTeams[0].Id;payload[0].roundScores[0].roundScore=17;
  expect((await api.post('/api/ScrambleData/SaveCreatedTeamScores',payload)).status()).toBe(200);
  expect(leagueSnapshot(target.name).kqTeams).toHaveLength(1);expect(leagueSnapshot(target.name).kqScores[0].RoundScore).toBe(17);
  capture(records,target);
});

test('Manager assignment controls settings, divisions, locks, teams and scrambles', async ({ api, records }) => {
  await account(api,records,'admin',1);const foreign=await league(api,records,'foreign');
  const foreignPlayer=await roster(api,records,foreign,'foreignplayer');
  const teamOne=await (await api.post('/api/Statistics/AddTeam',{leagueId:foreign.id,teamName:'Foreign synthetic one'})).json();
  const teamTwo=await (await api.post('/api/Statistics/AddTeam',{leagueId:foreign.id,teamName:'Foreign synthetic two'})).json();
  await account(api,records,'manager',2);const assigned=await league(api,records,'assigned');
  const payload={kingQueenTeams:[],byePlayers:[]};
  const forbidden=[
    ['/api/Login/updatesetting',{leagueId:foreign.id,settingName:'dropLowest',settingValue:'9'}],
    ['/api/Login/SetLockSignInStatus',{leagueId:foreign.id,locked:true}],
    ['/api/LeagueDivision/Add',{leagueId:foreign.id,code:'NO',name:'Forbidden',sortOrder:1}],
    ['/api/Statistics/AddTeam',{leagueId:foreign.id,teamName:'Forbidden'}],
    ['/api/ScrambleData/DeletePlayer/'+foreign.name,foreignPlayer],
    ['/api/Statistics/RecordLeagueTeamScore',{teamId:teamOne.id,opponentsTeamId:teamTwo.id,teamScore:21,wonGame:true,date:new Date().toISOString()}],
    ['/api/ScrambleData/SaveCreatedTeamScores',[{kingQueenTeamId:0,leagueId:foreign.id,date:new Date().toISOString().slice(0,10),scrambleNumber:1,players:[],roundScores:[]}]],
    ['/api/ScrambleData/SaveKingQueenRoundScores/'+foreign.name,{roundScores:[{id:0,kingQueenTeamId:0,roundId:1,roundScore:1,roundWon:true}]}],
    ['/api/ScrambleData/GenerateScramble/'+foreign.name,payload],
    ['/api/ScrambleData/SaveKingQueenTeams/'+foreign.name,payload],
    ['/api/Statistics/UpdateTeamScores/'+foreign.name,{}]
  ];
  for(const [path,body] of forbidden) await deniedUnchanged(api,foreign,path,body,403);
  expect((await api.post('/api/LeagueDivision/Add',{leagueId:assigned.id,code:'YES',name:'Assigned',sortOrder:1})).status()).toBe(200);
  expect((await api.post('/api/Login/SetLockSignInStatus',{leagueId:assigned.id,locked:true})).status()).toBe(200);
  expect(await (await api.get('/api/Login/LeagueAttendanceAvailability/'+assigned.id)).json()).toMatchObject({mode:'locked',locked:true});
  expect((await api.post('/api/Statistics/AddTeam',{leagueId:assigned.id,teamName:'Assigned synthetic'})).status()).toBe(200);
  expect((await api.post('/api/ScrambleData/GenerateScramble/'+assigned.name,{kingQueenTeams:[{kingQueenTeam:{},players:[]}],byePlayers:[]})).status()).toBe(200);
  expect(leagueSnapshot(assigned.name).kqTeams).toHaveLength(1);
  capture(records,foreign,assigned);
});

test('anonymous and Player changes are rejected with unchanged league database snapshots', async ({ api, records }) => {
  await account(api,records,'admin',1);const target=await league(api,records,'protected');
  const operations=[
    ['/api/Login/updatesetting',{leagueId:target.id,settingName:'dropLowest',settingValue:'999'}],
    ['/api/Login/SetLockSignInStatus',{leagueId:target.id,locked:true}],
    ['/api/LeagueDivision/Add',{leagueId:target.id,code:'NO',name:'Forbidden',sortOrder:1}],
    ['/api/Statistics/AddTeam',{leagueId:target.id,teamName:'Forbidden'}],
    ['/api/ScrambleData/GenerateScramble/'+target.name,{kingQueenTeams:[],byePlayers:[]}],
    ['/api/Statistics/UpdateTeamScores/'+target.name,{}]
  ];
  await api.post('/api/Login/logout',{});
  for(const [path,body] of operations) await deniedUnchanged(api,target,path,body,401);
  await account(api,records,'player',3);
  for(const [path,body] of operations) await deniedUnchanged(api,target,path,body,403);
  capture(records,target);
});

test('legacy password disclosure is disabled and the retired cookie cannot unlock administration', async ({ api }) => {
  expect((await api.get('/api/ScrambleData/GetPassword')).status()).toBe(410);
  expect((await api.post('/api/Login/updatesetting',{leagueId:0,settingName:'dropLowest',settingValue:'0'}, {
    Cookie: 'LeagueScrambler.Admin=retired-cookie-placeholder'
  })).status()).toBe(401);
  expect(await (await api.get('/api/Login/isauthenticated')).json()).toBe(false);
});


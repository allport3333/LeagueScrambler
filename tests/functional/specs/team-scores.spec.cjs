const { test, expect } = require('../helpers/fixtures.cjs');
const { db } = require('../helpers/database.cjs');
const { verifyIsolation } = require('../helpers/isolation.cjs');
const { account, league, login, leagueSnapshot, capture } = require('../helpers/regression.cjs');
const { dismissNotices } = require('../helpers/registration.cjs');
const fs = require('node:fs');
const path = require('node:path');
test.use({ mutation: true, regression: true });
const endpoint = '/api/Statistics/RecordMatchupScores';
const dateKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
async function teams(api, target, count = 2) {
  const result=[];
  for(let i=1;i<=count;i++) {
    const response=await api.post('/api/Statistics/AddTeam',{leagueId:target.id,teamName:'Synthetic Team '+i,division:'Gold'});
    expect(response.status()).toBe(200); result.push(await response.json());
  }
  return result;
}
function schedule(target, one, two, date) {
  verifyIsolation('development-regression');
  return [].concat(db('seedSchedule',null,{leagueName:target.name,team1Id:one.id,team2Id:two.id,date}))[0].Id;
}
function payload(target, pair, date = dateKey()) {
  return {leagueId:target.id,team1Id:pair[0].id,team2Id:pair[1].id,date,
    games:[{team1Score:21,team2Score:15},{team1Score:12,team2Score:21},{team1Score:21,team2Score:21}]};
}
async function unchanged(api, target, body, status, headers) {
  const before=leagueSnapshot(target.name);
  expect((await api.post(endpoint,body,headers)).status()).toBe(status);
  expect(leagueSnapshot(target.name)).toEqual(before);
}
async function browserLogin(page, identity) {
  await page.goto('/'); await dismissNotices(page);
  await page.locator('#loginEmail').fill(identity.email);
  await page.locator('#loginPassword').fill(identity.password);
  const [response]=await Promise.all([
    page.waitForResponse(r=>new URL(r.url()).pathname==='/api/Login/login' && r.request().method()==='POST'),
    page.getByRole('button',{name:'Submit',exact:true}).click()
  ]);
  expect(response.status()).toBe(200);
  await dismissNotices(page);
  await page.getByRole('link',{name:'Team Management',exact:true}).click();
  await expect(page.locator('app-team-scores h2')).toHaveText('Enter Team Scores');
  await expect(page.getByText('Loading scheduled matchups and saved scores…')).toHaveCount(0);
}
async function fillGames(card, values) {
  for(let i=0;i<values.length;i++) {
    const inputs=card.locator('.game-row').nth(i).locator('input');
    await inputs.nth(0).fill(String(values[i][0])); await inputs.nth(1).fill(String(values[i][1]));
  }
}
async function save(page, card) {
  const [response]=await Promise.all([
    page.waitForResponse(r=>new URL(r.url()).pathname===endpoint && r.request().method()==='POST'),
    card.getByRole('button',{name:'Save matchup scores',exact:true}).click()
  ]);
  expect(response.status()).toBe(200);
  await expect(card.getByText('Scores saved and standings updated.',{exact:true})).toBeVisible();
}
async function screenshot(page,name) {
  const dir=path.resolve(__dirname,'../artifacts/team-scores/screenshots'); fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
}

test('Team Scores API: scheduled three-game atomic save, standings, duplicate and reversed-pair protection',async({api,records})=>{
  await account(api,records,'scoreadmin',1);
  const target=await league(api,records,'scores'); const pair=await teams(api,target);
  const body=payload(target,pair,'2040-06-09'); body.scheduleId=schedule(target,...pair,body.date);
  const weeks=await(await api.get('/api/Statistics/GetLeagueSchedule/'+target.id)).json();
  expect(weeks[0].matches[0]).toMatchObject({scheduleId:body.scheduleId,team1Id:pair[0].id,team2Id:pair[1].id});
  expect((await api.post(endpoint,body)).status()).toBe(200);
  const snapshot=leagueSnapshot(target.name);
  expect(snapshot.scores).toHaveLength(6);
  for(const team of snapshot.teams) expect(team).toMatchObject({TotalWins:1,TotalLosses:2});
  const saved=await(await api.get(`/api/Statistics/GetMatchupScores/${target.id}?date=${body.date}`)).json();
  expect(saved).toHaveLength(6);
  expect(await(await api.get(`/api/Statistics/GetMatchupScores/${target.id}?date=2040-06-10`)).json()).toEqual([]);
  await unchanged(api,target,body,409);
  await unchanged(api,target,{...body,scheduleId:null,team1Id:pair[1].id,team2Id:pair[0].id},409);
  // Repeat the same pair on another day: separate calendar dates remain supported.
  expect((await api.post(endpoint,{...body,scheduleId:null,date:'2040-06-10',games:[{team1Score:0,team2Score:7}]})).status()).toBe(200);
  expect(leagueSnapshot(target.name).scores).toHaveLength(8); capture(records,target);
});

test('Team Scores API: incomplete, cross-league, unauthorized, CSRF and partial historical saves leave SQL unchanged',async({api,records})=>{
  const owner=await account(api,records,'scoremanager',2);
  const target=await league(api,records,'validation'); const pair=await teams(api,target);
  const other=await league(api,records,'other'); const outside=await teams(api,other);
  const body=payload(target,pair);
  await unchanged(api,target,{...body,games:[{team1Score:21,team2Score:null}]},400);
  await unchanged(api,target,{...body,games:[{team1Score:-1,team2Score:5}]},400);
  await unchanged(api,target,{...body,games:[]},400);
  await unchanged(api,target,{...body,team2Id:body.team1Id},400);
  await unchanged(api,target,{...body,team2Id:outside[0].id},400);
  await unchanged(api,target,{...body,scheduleId:2147483647},400);
  await unchanged(api,target,body,403,{Origin:'https://attacker.invalid'});
  await unchanged(api,target,body,403,null);
  await account(api,records,'outsidemanager',2);
  await unchanged(api,target,body,403);
  await account(api,records,'scoreplayer',3);
  await unchanged(api,target,body,403);
  await api.post('/api/Login/logout',{}); await unchanged(api,target,body,401);
  await login(api,owner);
  expect((await api.post('/api/Statistics/RecordLeagueTeamScore',{teamId:pair[0].id,opponentsTeamId:pair[1].id,teamScore:21,wonGame:true,date:body.date+'T15:00:00'})).status()).toBe(200);
  await unchanged(api,target,body,409);
  capture(records,target,other);
});

test('Team Scores browser: scheduled matchups, independent multigame saves and saved record inspection',async({api,page,records})=>{
  const manager=await account(api,records,'browsermanager',2);
  const target=await league(api,records,'scheduled'); const all=await teams(api,target,4);
  schedule(target,all[0],all[1],dateKey()); schedule(target,all[2],all[3],dateKey());
  await browserLogin(page,manager);
  const cards=page.locator('.matchup-card'); await expect(cards).toHaveCount(2);
  await expect(cards.first().locator('.game-row')).toHaveCount(3);
  await expect(cards.first().locator('.team-names')).toContainText('Synthetic Team 1');
  await expect(cards.first().locator('.team-names')).toContainText('Synthetic Team 2');
  await expect(cards.first().locator('.matchup-detail')).toContainText('Gold');
  await screenshot(page,'scheduled-desktop');
  await fillGames(cards.nth(1),[[8,9],[10,11],[12,13]]);
  await fillGames(cards.first(),[[21,15],[12,21],[21,19]]);
  await save(page,cards.first());
  expect(leagueSnapshot(target.name).scores).toHaveLength(6);
  await expect(cards.nth(1).locator('.game-row').first().locator('input').first()).toHaveValue('8');
  await cards.first().locator('summary').click();
  await expect(cards.first().locator('.saved-results li')).toHaveCount(6);
  await expect(cards.first().getByRole('button',{name:'Save matchup scores',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Add Manual Matchup',exact:true}).click();
  await expect(cards).toHaveCount(3);
  await page.setViewportSize({width:390,height:844}); await screenshot(page,'scheduled-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  capture(records,target);
});

test('Team Scores browser: no-schedule manual fallback, changed date, one-game save and duplicate state',async({api,page,records})=>{
  const manager=await account(api,records,'manualmanager',2);
  const target=await league(api,records,'manual'); const pair=await teams(api,target);
  await browserLogin(page,manager);
  await expect(page.getByText(/No games are scheduled for this date/)).toBeVisible();
  const dateInput=page.locator('input[required]').first();
  await dateInput.fill('6/10/2040'); await dateInput.press('Tab');
  await expect(page.getByText('Loading scheduled matchups and saved scores…')).toHaveCount(0);
  const card=page.locator('.matchup-card').first();
  for(let i=0;i<2;i++) {
    await card.locator('.team-pair mat-select').nth(i).click();
    await page.getByRole('option',{name:'Synthetic Team '+(i+1),exact:true}).click();
  }
  await screenshot(page,'manual-desktop');
  await card.locator('.game-count mat-select').click(); await page.getByRole('option',{name:'1',exact:true}).click();
  await fillGames(card,[[21,16]]);
  await page.setViewportSize({width:375,height:667}); await screenshot(page,'manual-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await save(page,card);
  const saved=await(await api.get(`/api/Statistics/GetMatchupScores/${target.id}?date=2040-06-10`)).json();
  expect(saved).toHaveLength(2); expect(leagueSnapshot(target.name).scores).toHaveLength(2);
  await page.getByRole('button',{name:'Add Manual Matchup',exact:true}).click();
  const duplicate=page.locator('.matchup-card').last();
  for(let i=0;i<2;i++) {
    await duplicate.locator('.team-pair mat-select').nth(i).click();
    await page.getByRole('option',{name:'Synthetic Team '+(i+1),exact:true}).click();
  }
  await expect(duplicate.getByText(/Saved — existing results/)).toBeVisible();
  await expect(duplicate.getByRole('button',{name:'Save matchup scores',exact:true})).toHaveCount(0);
  capture(records,target);
});

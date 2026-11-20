// Uses the existing fail-closed localhost runtime/approval guards and synthetic identity manifest.
// No real account, credential, player, league, historical result or attendance is modified.
const {test,expect}=require('../helpers/fixtures.cjs');
const {account,league,roster,leagueSnapshot,capture}=require('../helpers/regression.cjs');
const c=require('../scripts/v2-audit/common.cjs');
test.use({mutation:true,regression:true});

test('Scrambler V2 persists a strict 40-player scramble with Top overflow through existing endpoints',async({api,records,page,context,request},testInfo)=>{
 test.setTimeout(600000);
 // Require a newly running V2-capable backend before creating any fixture records.
 expect((await api.get('/api/ScrambleData/TeammateHistory/0')).status(),'Restart the local V2 backend before persistence testing').toBe(400);
 await account(api,records,'v2admin',1);const target=await league(api,records,'v2persistence'),P=[];
 for(let i=0;i<41;i++)P.push(await roster(api,records,target,'v2p'+i,i<24));
 const before=leagueSnapshot(target.name);expect(before.kqTeams).toHaveLength(0);expect(before.kqPlayers).toHaveLength(0);expect(before.kqScores).toHaveLength(0);
 async function generateAndSave(teams,byes){
  const response=await api.post('/api/ScrambleData/GenerateScramble/'+target.name,{kingQueenTeams:teams.map(players=>({kingQueenTeam:{},players})),byePlayers:[]});expect(response.status()).toBe(200);const created=await response.json();expect(created).toHaveLength(teams.length);
  const payload={kingQueenTeams:teams.map((players,i)=>({kingQueenTeam:{id:created[i].id},players})),byePlayers:byes};
  const saved=await api.post('/api/ScrambleData/SaveKingQueenTeams/'+target.name,payload);expect(saved.status()).toBe(200);
  const same=await api.post('/api/ScrambleData/SaveKingQueenTeams/'+target.name,payload);expect(same.status(),'Idempotent stable-ID resave').toBe(200);
  capture(records,target);return {created,payload};
 }
 const original=Array.from({length:10},(_,i)=>P.slice(i*4,i*4+4));
 const first=await generateAndSave(original,[P[40]]),firstNumber=first.created[0].scrambleNumber;
 const retrieved=await(await api.get('/api/ScrambleData/GetKingQueenTeamsByScrambleNumber/'+target.name+'/'+firstNumber)).json();
 const blocked=retrieved.kingQueenTeams.flatMap(row=>row.players.flatMap((p,i)=>row.players.slice(i+1).map(q=>c.pair(p.id,q.id))));
 const configuredTop=P.slice(0,12).map((p,i)=>({playerId:p.id,rank:i+1})),input={players:P.map((p,i)=>({...p,isByePlayer:i===40})),mode:'balanced',numberOfTeams:10,topIds:P.slice(0,12).map(p=>p.id),lowIds:P.slice(30,40).map(p=>p.id),configuredTop,prohibitedPairs:blocked};
 const generated=await c.e.generateScramble(input,c.rng('real-dev-persistence'));c.independentlyCheck(input,generated,Array(10).fill(4));expect(generated.retainedTopIds).toEqual(P.slice(0,10).map(p=>p.id));expect(generated.demotedTopIds).toEqual(P.slice(10,12).map(p=>p.id));
 const actualTeams=generated.teams.map(t=>t.map(p=>P.find(x=>x.id===p.id))),second=await generateAndSave(actualTeams,[P[40]]),secondNumber=second.created[0].scrambleNumber;
 const reload=await(await api.get('/api/ScrambleData/GetKingQueenTeamsByScrambleNumber/'+target.name+'/'+secondNumber)).json();
 expect(reload.kingQueenTeams.map(t=>t.kingQueenTeam.id)).toEqual(second.created.map(t=>t.id));expect(reload.kingQueenTeams.map(t=>t.players.map(p=>p.id).sort((a,b)=>a-b))).toEqual(actualTeams.map(t=>t.map(p=>p.id).sort((a,b)=>a-b)));expect(reload.byePlayers.map(p=>p.id)).toEqual([P[40].id]);
 for(const row of reload.kingQueenTeams){expect(row.kingQueenTeam.leagueID).toBe(target.id);expect(row.kingQueenTeam.scrambleWithScoresToBeSaved).toBe(true);expect(row.players.filter(p=>generated.retainedTopIds.includes(p.id)).length).toBe(1);for(let i=0;i<row.players.length;i++)for(let j=i+1;j<row.players.length;j++)expect(blocked).not.toContain(c.pair(row.players[i].id,row.players[j].id));}
 const snapshot=leagueSnapshot(target.name);expect(snapshot.kqTeams).toHaveLength(20);expect(snapshot.kqPlayers).toHaveLength(80);expect(snapshot.kqScores).toHaveLength(0);capture(records,target);
 async function verifyHistory(teams){const expected=new Map();for(const team of teams)for(let i=0;i<team.length;i++)for(let j=i+1;j<team.length;j++){const key=c.pair(team[i].id,team[j].id);expected.set(key,(expected.get(key)||0)+1);}const response=await api.get('/api/ScrambleData/TeammateHistory/'+target.id);expect(response.status()).toBe(200);const body=await response.json();expect(body.leagueId).toBe(target.id);expect(body.pairs).toHaveLength(expected.size);for(const pair of body.pairs)expect(pair.count).toBe(expected.get(c.pair(pair.player1Id,pair.player2Id)));return {uniquePairs:expected.size,occurrences:Array.from(expected.values()).reduce((a,b)=>a+b,0)};}
 const initialHistory=await verifyHistory(original.concat(actualTeams));
 // Use cookies issued by the actual synthetic registration/login, never a fabricated principal.
 await context.addCookies((await request.storageState()).cookies);await page.goto('/scrambler');await expect(page.locator('app-scrambler-component')).toBeVisible();
 await page.waitForFunction(()=>window.ng&&window.ng.probe(document.querySelector('app-scrambler-component')));
 await page.evaluate(({id,name})=>{const d=window.ng.probe(document.querySelector('app-scrambler-component'));d.injector.get(window.ng.coreTokens.NgZone).run(()=>d.componentInstance.leagueService.setSelectedLeague(id));},{id:target.id,name:target.name});
 await page.waitForFunction(id=>window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.leagueId===id,target.id);
 await page.evaluate(scramble=>{const d=window.ng.probe(document.querySelector('app-scrambler-component'));d.injector.get(window.ng.coreTokens.NgZone).run(()=>d.componentInstance.requestRetrieveScramble(scramble));},second.created[0]);
 await page.waitForFunction(()=>{const x=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;return !x.scoreEditorLoading&&x.listOfTeams.length===10;});
 await page.getByRole('button',{name:'View Matchups',exact:true}).click();const modal=page.getByRole('dialog');await expect(modal.locator('mat-card')).toHaveCount(5);await expect(modal.getByRole('button',{name:'Print Matchups',exact:true})).toBeEnabled();
 async function component(fn,arg){return page.evaluate(({fn,arg})=>{const d=window.ng.probe(document.querySelector('app-scrambler-component'));return d.injector.get(window.ng.coreTokens.NgZone).run(()=>eval('('+fn+')')(d.componentInstance,arg));},{fn:String(fn),arg});}
 // Find a manual same-gender/same-role swap preserving every selected strict pair exclusion.
 let swap=null;for(let a=0;a<10&&!swap;a++)for(let b=a+1;b<10&&!swap;b++)for(const p of actualTeams[a])for(const q of actualTeams[b]){if(p.isMale!==q.isMale||generated.retainedTopIds.includes(p.id)!==generated.retainedTopIds.includes(q.id))continue;const left=actualTeams[a].filter(x=>x.id!==p.id).concat(q),right=actualTeams[b].filter(x=>x.id!==q.id).concat(p);const valid=[left,right].every(t=>t.every((x,i)=>t.slice(i+1).every(y=>!blocked.includes(c.pair(x.id,y.id)))));if(valid){swap={a,b,p:p.id,q:q.id};break;}}
 expect(swap).not.toBeNull();await modal.getByRole('button',{name:'Modify Teams',exact:true}).click();await component((x,s)=>{const a=x.listOfTeams[s.a],b=x.listOfTeams[s.b],p=a.players.find(p=>p.id===s.p),q=b.players.find(p=>p.id===s.q);x.switchPlayerTeam(p,String(b.sortingId),a.sortingId);x.switchPlayerTeam(q,String(a.sortingId),b.sortingId);},swap);
 await expect(modal.getByRole('button',{name:'Save Teams',exact:true})).toBeEnabled();await modal.getByRole('button',{name:'Save Teams',exact:true}).click();await expect(modal).toContainText('Teams saved successfully.');
 const modified=await(await api.get('/api/ScrambleData/GetKingQueenTeamsByScrambleNumber/'+target.name+'/'+secondNumber)).json(),expectedTeams=actualTeams.map(t=>t.slice());const a=expectedTeams[swap.a],b=expectedTeams[swap.b],p=a.find(x=>x.id===swap.p),q=b.find(x=>x.id===swap.q);expectedTeams[swap.a]=a.filter(x=>x.id!==p.id).concat(q);expectedTeams[swap.b]=b.filter(x=>x.id!==q.id).concat(p);
 expect(modified.kingQueenTeams.map(t=>t.players.map(p=>p.id).sort((a,b)=>a-b))).toEqual(expectedTeams.map(t=>t.map(p=>p.id).sort((a,b)=>a-b)));const afterModify=leagueSnapshot(target.name);expect(afterModify.kqPlayers.map(p=>p.Id)).toEqual(snapshot.kqPlayers.map(p=>p.Id));expect(afterModify.kqTeams).toHaveLength(20);const modifiedHistory=await verifyHistory(original.concat(expectedTeams));capture(records,target);
 await component(x=>x.setMatchCourt(x.listOfTeams[0],'4'));
 await modal.screenshot({path:c.path.join(c.out,'real-persistence-viewer.png')});await page.setViewportSize({width:390,height:844});await modal.screenshot({path:c.path.join(c.out,'real-persistence-mobile.png')});
 const printHtml=await component(x=>{let html='';const old=window.open;window.open=()=>({document:{open(){},write(s){html=s;},close(){}},set onload(fn){},print(){},close(){}});try{x.printMatchups();}finally{window.open=old;}return html;});expect(printHtml).toContain('Court');expect(printHtml).toContain('4');for(const player of P.slice(0,40))expect(printHtml).toContain(player.lastName);const printed=await context.newPage();await printed.setContent(printHtml);await printed.emulateMedia({media:'print'});await printed.pdf({path:c.path.join(c.out,'real-persistence-print.pdf'),format:'A4',printBackground:true});await printed.close();
 await modal.getByRole('button',{name:'Close matchups',exact:true}).click();
 await component(x=>{x.selectedRounds=5;x.initializeRounds();x.initializeScores();for(const row of x.kingQueenRoundScores){const index=x.listOfTeams.findIndex(t=>t.kingQueenTeamId===row.kingQueenTeamId);row.roundScore=index%2===0?20:10+row.roundId;}x.recalculateRoundWinners();x.saveKingQueenRoundScores();});
 await page.waitForFunction(()=>{const x=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;return !x.scoreSaveBusy&&x.scoreEditorFeedback==='Round scores saved successfully.';});
 const scored=leagueSnapshot(target.name);expect(scored.kqScores).toHaveLength(50);for(const row of scored.kqScores){const index=second.created.findIndex(t=>t.id===row.KingQueenTeamId);expect(row.RoundScore).toBe(index%2===0?20:10+row.RoundId);expect(row.RoundWon).toBe(index%2===0);expect(row.Id).toBeGreaterThan(0);}capture(records,target);
 await component(x=>x.saveKingQueenRoundScores());await page.waitForFunction(()=>!window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.scoreSaveBusy);expect(leagueSnapshot(target.name).kqScores).toHaveLength(50);
 await component(x=>x.requestRetrieveScramble(x.scoringScramble));await page.waitForFunction(()=>!window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance.scoreEditorLoading);expect(await component(x=>x.kingQueenRoundScores.length)).toBe(50);const finalHistory=await verifyHistory(original.concat(expectedTeams));capture(records,target);
 await api.post('/api/Login/logout',{});
 const result={league:target,teams:20,memberships:80,roundScores:50,selectedHistory:firstNumber,newScramble:secondNumber,ids:second.created.map(x=>x.id),retainedTopIds:generated.retainedTopIds,demotedTopIds:generated.demotedTopIds,swap,initialHistory,modifiedHistory,finalHistory,realApiPersistence:true,scoreResaveDidNotDuplicate:true,allHistoricalRestrictionsPreserved:true,courtLimitation:'Court4 displayed/printed as an existing transient note; no backend Court field.',cleanup:'Explicitly approved exact-ID transaction will run from the completed harness manifest.'};
 c.fs.writeFileSync(c.path.join(c.root,'tests/functional/artifacts/v2-integration/persistence-result.json'),JSON.stringify(result,null,2));await testInfo.attach('persistence',{body:JSON.stringify(result),contentType:'application/json'});
});

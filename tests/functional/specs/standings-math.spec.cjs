const {test,expect}=require('../helpers/fixtures.cjs');
async function openScrambler(page){
  await page.goto('/scrambler');await expect(page.locator('app-scrambler-component')).toBeVisible();
}
test('standings math applies substitute limits and drops after reduction without compounding',async({page})=>{
  await openScrambler(page);
  const result=await page.evaluate(()=>{
    const c=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;
    const input={maxRounds:3,playerScores:[{playerId:-101,playerName:'Synthetic Math',isMale:true,scores:[{roundId:1,score:30,roundWon:1,isSubScore:true},{roundId:2,score:20,roundWon:0,isSubScore:false},{roundId:3,score:10,roundWon:1,isSubScore:true}]}]};
    const original=JSON.stringify(input);
    c.originalStandings=null;c.lastResult=null;c.selectedRounds=3;
    c.processStandings(input,{dropLowestNumber:1,numberOfSubsAllowed:1,subScorePercent:50});
    const reduced=JSON.parse(JSON.stringify(c.maleStandings[0]));
    c.processStandings(input,{dropLowestNumber:0,numberOfSubsAllowed:99,subScorePercent:100});
    return {reduced,restored:c.maleStandings[0],inputUnchanged:JSON.stringify(input)===original};
  });
  expect(result.reduced).toMatchObject({totalScore:50,totalWins:1,totalScoreBeforeReduction:60});
  expect(result.reduced.scores[2]).toMatchObject({score:5,isReduced:true,isDropped:true});
  expect(result.restored).toMatchObject({totalScore:60,totalWins:2});
  expect(result.inputUnchanged).toBe(true);
});

test('standings math sorts equal final scores by original totals then player name',async({page})=>{
  await openScrambler(page);
  const result=await page.evaluate(()=>{
    const c=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;
    c.maleStandings=[{playerName:'Zed',totalScore:50,totalScoreBeforeReduction:80},{playerName:'Ada',totalScore:50,totalScoreBeforeReduction:80},{playerName:'Ben',totalScore:50,totalScoreBeforeReduction:70},{playerName:'Low',totalScore:40,totalScoreBeforeReduction:100}];
    c.sortDirection='desc';c.sortMaleStandings('totalScore');return c.maleStandings.map(p=>p.playerName);
  });
  expect(result).toEqual(['Ada','Zed','Ben','Low']);
});

test('standings math top-player selection uses score first and Gold priority for equal scores',async({page})=>{
  await openScrambler(page);
  const result=await page.evaluate(()=>{
    const c=window.ng.probe(document.querySelector('app-scrambler-component')).componentInstance;
    c.teamCount=2;c.selectedList=[{id:-101,firstName:'Silver',lastName:'Synthetic',isMale:true},{id:-102,firstName:'Gold',lastName:'Synthetic',isMale:true},{id:-103,firstName:'Higher',lastName:'Synthetic',isMale:true}];
    c.malePlayers1=c.selectedList;c.femalePlayers1=[];c.displayTopPlayers=[];
    c.maleStandings=[{playerId:-101,playerName:'Silver',totalScore:50,totalScoreBeforeReduction:100,leagueDivisionCode:'SILVER',leagueDivisionName:'Silver'},{playerId:-102,playerName:'Gold',totalScore:50,totalScoreBeforeReduction:90,leagueDivisionCode:'GM',leagueDivisionName:'Gold Male'},{playerId:-103,playerName:'Higher',totalScore:60,totalScoreBeforeReduction:70,leagueDivisionCode:'SILVER',leagueDivisionName:'Silver'}];
    c.applyTopPlayersFromMaleStandings();return c.displayTopPlayers.map(p=>p.id);
  });
  expect(result).toEqual([-103,-102]);
});

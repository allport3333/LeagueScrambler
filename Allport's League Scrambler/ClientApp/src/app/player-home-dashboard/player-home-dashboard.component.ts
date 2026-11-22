import {Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy} from '@angular/core';
import {Subscription,forkJoin,of,throwError} from 'rxjs';
import {catchError,switchMap,map} from 'rxjs/operators';
import {LeagueService} from '../services/league.service';
import {LoginService} from '../services/login.service';
import {StatisticsService} from '../services/statistics.service';
import {PlayerService} from '../services/player.service';
import {transformKingQueenStandings} from '../league-standings/king-queen-standings';
@Component({
    selector: 'app-player-home-dashboard', templateUrl: './player-home-dashboard.component.html', styleUrls: ['./player-home-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PlayerHomeDashboardComponent implements OnInit,OnDestroy {
 @Output() claimPlayer=new EventEmitter<void>();
 playerId:number=null;leagueId:number=null;leagueName='';role='';accountReady=false;accountError='';overviewLoading=false;
 standings:any[]=[];recent:any[]=[];upcoming:any[]=[];ownTeamIds:number[]=[];teamsReady=false;standingsError='';recentError='';
 latestKq:any=null;kqError='';currentStanding:any=null;standingLoading=false;standingError='';
 private standingRequest:Subscription;
 private subscriptions=new Subscription();private request:Subscription;private version=0;private key='';
 constructor(private leagues:LeagueService,private login:LoginService,private stats:StatisticsService,private players:PlayerService){}
 ngOnInit(){
  this.subscriptions.add(this.leagues.selectedLeague$.subscribe(league=>{this.leagueId=league.leagueId;this.leagueName=league.leagueName;this.loadOverview();}));
  this.subscriptions.add(this.login.getUsersRole().subscribe(value=>this.role=value.role,()=>{}));
  this.subscriptions.add(this.login.getUsersPlayer().subscribe(value=>{this.playerId=value&&value.playerId||null;this.accountReady=true;this.loadOverview();},error=>{this.accountReady=true;if(error.status!==404)this.accountError='Unable to load your player association. Please refresh or sign in again.';}));
 }
 get ownStandings():any[]{return this.standings.filter(row=>this.ownTeamIds.indexOf(row.teamId)>=0);}
 acceptGames(event:any){if(event.playerId!==this.playerId||event.leagueId!==this.leagueId)return;this.teamsReady=true;this.ownTeamIds=event.result.ownTeamIds||[];this.upcoming=event.result.upcoming||[];}
 loadOverview(force=false){const key=this.playerId+':'+this.leagueId;if(!force&&key===this.key)return;this.key=key;const version=++this.version;if(this.request)this.request.unsubscribe();if(this.standingRequest)this.standingRequest.unsubscribe();this.currentStanding=null;this.standingLoading=false;this.standingError='';this.latestKq=null;this.kqError='';this.standings=[];this.recent=[];this.upcoming=[];this.ownTeamIds=[];this.teamsReady=false;this.standingsError='';this.recentError='';this.overviewLoading=false;
  if(!(this.playerId>0&&this.leagueId>0))return;this.overviewLoading=true;this.loadCurrentStanding(version);
  this.request=forkJoin(this.stats.getLeagueStandings(this.leagueId).pipe(catchError(()=>of(null))),this.stats.getLeagueTeamScores(this.playerId,this.leagueId).pipe(catchError(()=>of(null))),this.stats.getDetailedPerformanceStats(this.playerId,this.leagueId).pipe(catchError(()=>of(null)))).subscribe(([standings,recent,kq])=>{if(version!==this.version)return;this.overviewLoading=false;
   if(kq && Array.isArray(kq.scrambleTotals)){
    const dated=kq.scrambleTotals.filter(game=>game.dateOfTeam && !String(game.dateOfTeam).startsWith('0001') && Number.isFinite(new Date(game.dateOfTeam).getTime()));
    this.latestKq=dated.slice().sort((a,b)=>new Date(b.dateOfTeam).getTime()-new Date(a.dateOfTeam).getTime() || b.scrambleNumber-a.scrambleNumber)[0]||null;
    if(kq.scrambleTotals.length && !this.latestKq)this.kqError='Recorded King/Queen scores have no available matchup date. View history for details.';
   }else this.kqError='Recent King/Queen results could not be loaded.';
   if(Array.isArray(standings))this.standings=standings;else this.standingsError='Standings could not be loaded.';if(Array.isArray(recent))this.recent=recent.slice().sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,3);else this.recentError='Recent results could not be loaded.';});
 }
 loadCurrentStanding(version:number){
  this.standingLoading=true;
  this.standingRequest=forkJoin(
   this.login.getSettingValue('numberOfSubsAllowed',this.leagueId),this.login.getSettingValue('dropLowest',this.leagueId),
   this.login.getSettingValue('subScorePercent',this.leagueId),this.login.getSettingValue('standingsType',this.leagueId)
  ).pipe(switchMap(([subs,drop,percent,mode])=>{
   if(mode!=='round'&&mode!=='matchup')return throwError(new Error('Standing mode unavailable'));
   const numeric=(value:any,fallback:number)=>typeof value==='number'?value:typeof value==='string'&&!isNaN(parseFloat(value))?parseFloat(value):fallback;
   const options={numberOfSubsAllowed:numeric(subs,100),dropLowestNumber:numeric(drop,0),subScorePercent:numeric(percent,100)};
   const request=mode==='matchup'?this.players.getStandingsByLeagueMatchup(this.leagueName):this.players.getStandingsByLeague(this.leagueName);
   const standingsMode=mode as 'round'|'matchup';
   return request.pipe(map(data=>({data,mode:standingsMode,options})));
  })).subscribe(response=>{
   if(version!==this.version)return;this.standingLoading=false;
   if(!response.data||!Array.isArray(response.data.playerScores)){this.standingError='Current standing could not be loaded.';return;}
   const player=response.data.playerScores.find(p=>p&&p.playerId===this.playerId);if(!player)return;
   const group=transformKingQueenStandings(response.data.playerScores.filter(p=>p&&(p.isMale===true)===(player.isMale===true)),response.options,response.mode);
   const index=group.findIndex(p=>p.playerId===this.playerId);if(index<0)return;
   const division=player.leagueDivisionId>0?group.filter(p=>p.leagueDivisionId===player.leagueDivisionId):[];
   this.currentStanding={rank:index+1,total:group.length,gender:player.isMale===true?"Men's":"Women's",genderKey:player.isMale===true?'men':'women',mode:response.mode,
    divisionLabel:division.length?(player.leagueDivisionCode||'Division '+player.leagueDivisionId):'',divisionRank:division.findIndex(p=>p.playerId===this.playerId)+1,divisionTotal:division.length};
  },()=>{if(version===this.version){this.standingLoading=false;this.standingError='Current standing could not be loaded.';}});
 }
 ordinal(value:number):string{const last=value%100;return value+(last>=11&&last<=13?'th':value%10===1?'st':value%10===2?'nd':value%10===3?'rd':'th');}
 gameDate(value:string):Date{const p=value.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
 ngOnDestroy(){this.version++;if(this.standingRequest)this.standingRequest.unsubscribe();this.subscriptions.unsubscribe();if(this.request)this.request.unsubscribe();}
}

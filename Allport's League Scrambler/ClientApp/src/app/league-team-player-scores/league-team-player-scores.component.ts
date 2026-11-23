import { onLeagueResume } from '../pwa/pending-work.service';
import { Component, Input, OnChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';
@Component({
    selector: 'app-league-team-player-scores', templateUrl: './league-team-player-scores.component.html', styleUrls: ['../player-stats-tabs/profile-statistics.shared.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LeagueTeamPlayerScoresComponent implements OnChanges, OnDestroy {
 @Input() playerId:number; @Input() leagueId:number;
 loading=false; error=''; leagueScores:any[]=null; groups:any[]=[]; performanceStats:any=null;
 private request:Subscription; private version=0;
 constructor(private statistics:StatisticsService){onLeagueResume(() => { if (!this.loading) this.loadLeagueScores(this.playerId, this.leagueId); });}
 ngOnChanges(){this.loadLeagueScores(this.playerId,this.leagueId);}
 loadLeagueScores(playerId:number,leagueId:number){
  if(this.request)this.request.unsubscribe();const version=++this.version;this.loading=false;this.error='';this.leagueScores=null;this.performanceStats=null;this.groups=[];
  if(!playerId||!leagueId)return;this.loading=true;
  this.request=this.statistics.getLeagueTeamScores(playerId,leagueId).subscribe(scores=>{
   if(version!==this.version)return;this.loading=false;if(!Array.isArray(scores)){this.error='The game history response is incomplete.';return;}
   this.leagueScores=scores;this.performanceStats={totalScores:scores.every(s=>typeof s.teamScore==='number')?scores.reduce((n,s)=>n+s.teamScore,0):null,totalWins:scores.every(s=>typeof s.wonGame==='boolean')?scores.filter(s=>s.wonGame).length:null,totalLosses:scores.every(s=>typeof s.wonGame==='boolean')?scores.filter(s=>!s.wonGame).length:null};
   const grouped=new Map<string,any>();scores.forEach(score=>{const date=score.date?new Date(score.date):null,key=date&&!isNaN(date.getTime())?date.toDateString():'Date unavailable';if(!grouped.has(key))grouped.set(key,{date:key,timestamp:key==='Date unavailable'?Infinity:date.getTime(),scores:[]});grouped.get(key).scores.push(score);});
   this.groups=Array.from(grouped.values()).sort((a,b)=>a.timestamp-b.timestamp).map(g=>({...g,wins:g.scores.filter(s=>s.wonGame===true).length,losses:g.scores.filter(s=>s.wonGame===false).length}));
  },()=>{if(version===this.version){this.loading=false;this.error='Unable to load league team history. Please retry.';}});
 }
 groupScoresByDate(){return this.groups;}
 ngOnDestroy(){this.version++;if(this.request)this.request.unsubscribe();}
}
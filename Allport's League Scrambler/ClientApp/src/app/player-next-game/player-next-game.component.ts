import {Component,Input,OnChanges,OnDestroy} from '@angular/core';
import {forkJoin,Subscription} from 'rxjs';
import {StatisticsService} from '../services/statistics.service';
import {selectNextGames} from './next-game-selection';
@Component({selector:'app-player-next-game',templateUrl:'./player-next-game.component.html',styleUrls:['./player-next-game.component.css']})
export class PlayerNextGameComponent implements OnChanges,OnDestroy {
 @Input() playerId:number;@Input() leagueId:number;
 loading=false;error='';result:any=null;private request:Subscription;private key='';private version=0;
 constructor(private stats:StatisticsService){}
 ngOnChanges(){this.load();}
 load(force=false){const key=this.playerId+':'+this.leagueId;if(!force&&key===this.key)return;this.key=key;
  if(this.request)this.request.unsubscribe();const version=++this.version;this.result=null;this.error='';this.loading=false;
  if(!(this.playerId>0&&this.leagueId>0))return;this.loading=true;
  this.request=forkJoin(this.stats.GetAllTeamsWithPlayers(this.leagueId),this.stats.getLeagueSchedule(this.leagueId)).subscribe(([teams,schedule])=>{
   if(version!==this.version)return;this.loading=false;
   if(!Array.isArray(teams)||!Array.isArray(schedule)){this.error='Unable to load upcoming games. Please retry.';return;}
   if(teams.some(team=>!Array.isArray(team.players))||schedule.some(week=>(week.matches||[]).some(match=>!(match.team1Id>0&&match.team2Id>0)))){this.error='Scheduled team information is incomplete. Please contact the administrator.';return;}
   this.result=selectNextGames(this.playerId,teams,schedule);
  },()=>{if(version===this.version){this.loading=false;this.error='Unable to load upcoming games. Please retry.';}});
 }
 dateLabel(date:string):Date {const p=date.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
 scheduleQuery(game?:any):any{return {leagueId:this.leagueId,tab:'schedule',weekNumber:game?game.weekNumber:null,scheduleDate:game?game.date:null};}
 ngOnDestroy(){this.version++;if(this.request)this.request.unsubscribe();}
}

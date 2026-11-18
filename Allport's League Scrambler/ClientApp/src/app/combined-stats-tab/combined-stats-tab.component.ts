import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';
@Component({selector:'app-combined-stats-tab',templateUrl:'./combined-stats-tab.component.html',styleUrls:['../player-stats-tabs/profile-statistics.shared.css']})
export class CombinedStatsTabComponent implements OnChanges, OnDestroy {
 @Input() playerId:number; @Input() leagueId:number;
 combinedStats:any=null; loading=false; error=''; opponents:any[]=[]; teammates:any[]=[];
 private request:Subscription;private version=0;
 constructor(private statistics:StatisticsService){}
 ngOnChanges(){this.loadCombinedStats();}
 loadCombinedStats(){
  if(this.request)this.request.unsubscribe();const version=++this.version;this.combinedStats=null;this.opponents=[];this.teammates=[];this.error='';this.loading=false;
  if(!this.playerId||!this.leagueId)return;this.loading=true;
  this.request=this.statistics.getCombinedStats(this.playerId,this.leagueId).subscribe(data=>{
   if(version!==this.version)return;this.loading=false;if(!data||!Array.isArray(data.teammateStats)||!Array.isArray(data.opponentStats)){this.error='The league statistics response is incomplete.';return;}
   this.combinedStats=data;this.opponents=data.opponentStats.slice();this.teammates=data.teammateStats.slice();
  },()=>{if(version===this.version){this.loading=false;this.error='Unable to load league player statistics. Please retry.';}});
 }
 sortTable(table:string,event:any){const source=table==='opponents'?this.combinedStats.opponentStats:this.combinedStats.teammateStats;const rows=source.slice();if(event.direction)rows.sort((a,b)=>{const x=a[event.active],y=b[event.active];if(x==null)return y==null?0:1;if(y==null)return -1;return(x<y?-1:x>y?1:0)*(event.direction==='asc'?1:-1);});if(table==='opponents')this.opponents=rows;else this.teammates=rows;}
 duplicateName(player:any):boolean{return this.teammates.some(p=>p.playerId!==player.playerId&&p.playerName===player.playerName);}
 ngOnDestroy(){this.version++;if(this.request)this.request.unsubscribe();}
}
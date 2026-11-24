import { injectConfirmation } from '../confirmation-dialog';
import { onLeagueResume, protectPendingWork } from '../pwa/pending-work.service';
import {Component, Input, OnInit, OnChanges, OnDestroy, ChangeDetectionStrategy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Subscription} from 'rxjs';
import {AuthService} from '../auth.service';
import {PlayerService} from '../services/player.service';
@Component({
    selector: 'app-player-attendance', templateUrl: './player-attendance.component.html', styleUrls: ['./player-attendance.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PlayerAttendanceComponent implements OnInit,OnChanges,OnDestroy {
 @Input() playerId:number;@Input() leagueId:number; @Input() tournament = false;
 authenticated:boolean=null;state:any=null;loading=false;busy=false;error='';
 private readonly confirmAction=injectConfirmation();
 private authSubscription:Subscription;private request:Subscription;private mutation:Subscription;private version=0;private key='';
 constructor(private auth:AuthService,private players:PlayerService, private http:HttpClient){ protectPendingWork(() => this.busy); onLeagueResume(() => { if (!this.loading && !this.busy) this.load(true); }); }
 get unavailableText():string {const reason=this.state&&this.state.reason||'Attendance is currently unavailable.';const day=/^Sign in is available on ([A-Za-z]+) only\.$/.exec(reason);return day?'League sign in opens '+day[1]:reason;}
 get unavailableIcon():string {return this.state&&this.state.reason&&this.state.reason.toLowerCase().indexOf('locked')>=0?'lock':'event';}
 ngOnInit(){this.authSubscription=this.auth.authenticationState$.subscribe(value=>{if(this.authenticated!==value){this.authenticated=value;this.load(true);}});}
 ngOnChanges(){this.load();}
 load(force=false){
  if(this.authenticated!==true){if(this.request)this.request.unsubscribe();if(this.mutation)this.mutation.unsubscribe();this.version++;this.key='';this.state=null;this.error='';this.busy=false;this.loading=false;return;}
  const key=this.playerId+':'+this.leagueId+':'+this.tournament;if(!force&&key===this.key)return;this.key=key;
  if(this.request)this.request.unsubscribe();if(this.mutation)this.mutation.unsubscribe();const version=++this.version;
  this.state=null;this.error='';this.busy=false;this.loading=false;if(!(this.playerId>0&&this.leagueId>0))return;this.loading=true;
  this.request=this.attendanceStatus().subscribe(state=>{if(version!==this.version)return;this.loading=false;
   if(!state||typeof state.visible!=='boolean'||typeof state.canSignIn!=='boolean'){this.error='Unable to verify attendance. Please retry.';return;}this.state=state;
  },error=>{if(version===this.version){this.loading=false;this.error=error.status===401?'Your session has expired. Sign in again.':'Unable to load attendance. Please retry.';}});
 }
 async change(remove=false){if(this.busy||this.loading||!this.state||!this.state.isOwnProfile||!(remove?this.state.canRemove:this.state.canSignIn))return;
  const contextVersion=this.version;
  if(remove&&(!await this.confirmAction({title:'Remove sign-in',message:this.tournament ? 'Remove your check-in for the selected tournament?' : 'Remove your league night sign-in for the selected league?',action:'Remove sign-in',tone:'danger'})||contextVersion!==this.version||this.busy||!this.state?.canRemove))return;
  this.busy=true;this.error='';const version=this.version;
  this.mutation=this.changeAttendance(remove).subscribe(()=>{if(version===this.version)this.load(true);},error=>{
   if(version!==this.version)return;this.busy=false;
   if(error.status===409||error.status===423){this.load(true);return;}
   this.state=null;this.error=error.status===401?'Your session has expired. Sign in again.':'Unable to update attendance. Please refresh its status and retry.';
  });
 }
 private get tournamentAttendanceUrl() { return '/api/tournament-attendance/' + this.leagueId; }
 private attendanceStatus() {
  if (!this.tournament) return this.players.getSelfAttendance(this.leagueId, this.playerId);
  return this.http.get<{ ownPlayerId: number | null; roster: { id: number; present: boolean }[] }>(this.tournamentAttendanceUrl).pipe(map(data => {
   const player = data.ownPlayerId === this.playerId ? data.roster.find(row => row.id === this.playerId) : undefined;
   return { visible: !!player, isOwnProfile: !!player, signedIn: !!player?.present,
    canSignIn: !!player && !player.present, canRemove: !!player && player.present,
    reason: null };
  }));
 }
 private changeAttendance(remove: boolean) {
  return this.tournament
   ? this.http.put(this.tournamentAttendanceUrl + '/players/' + this.playerId, { present: !remove })
   : this.players.changeSelfAttendance(this.leagueId, this.playerId, remove);
 }
 ngOnDestroy(){this.version++;if(this.authSubscription)this.authSubscription.unsubscribe();if(this.request)this.request.unsubscribe();if(this.mutation)this.mutation.unsubscribe();}
}

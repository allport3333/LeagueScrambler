import { protectPendingWork } from '../pwa/pending-work.service';
import {Component, Inject, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {forkJoin, Subscription} from 'rxjs';
import {timeout} from 'rxjs/operators';
import {PlayerService} from '../services/player.service';
import {LeagueService} from '../services/league.service';
import {normalName, importPlayerCandidates} from './player-import';

@Component({
    selector: 'app-league-player-edit', styleUrls: ['./player-management-dialogs.component.css'], template: `
 <h2 mat-dialog-title>Edit Player</h2>
 <div mat-dialog-content>@if (loading) {
   <p role="status">Loading current membership...</p>
   }@if (error) {
   <p role="alert">{{error}}</p>
 }
 @if (member) {
   <section class="edit-profile"><h3>Player Profile</h3><p class="secondary">Name changes update this global player profile in every league. Player ID {{member.player.id}} stays the same.</p>
   @if (!member.canEditProfile) {
     <p class="secondary">Profile names can only be changed by an application administrator. You can manage this league's membership.</p>
   }
   <mat-form-field appearance="outline"><mat-label>First Name</mat-label><input matInput [(ngModel)]="firstName" required maxlength="100" [readonly]="!member.canEditProfile || busy"></mat-form-field>
   <mat-form-field appearance="outline"><mat-label>Last Name</mat-label><input matInput [(ngModel)]="lastName" required maxlength="100" [readonly]="!member.canEditProfile || busy"></mat-form-field></section>
   <section class="edit-membership"><h3>League Membership</h3><p>{{data.leagueName}}</p><p>Current division: <strong>{{member.leagueDivisionName || 'No Division'}}</strong></p>
   <mat-form-field appearance="outline"><mat-label>Division</mat-label><mat-select [(ngModel)]="divisionId" [disabled]="busy"><mat-option [value]="0">No Division</mat-option>@for (d of divisions; track d) {
   <mat-option [value]="d.id">{{d.name || d.code}}</mat-option>
 }</mat-select></mat-form-field>
 @if (member.teams && member.teams.length) {
   <div class="team-note"><strong>Existing teams</strong>@for (t of member.teams; track t) {
   <p>{{t.teamName}} &middot; {{t.division || 'No Division'}}</p>
   }<p>Team assignments and team divisions are managed separately and stay unchanged.</p></div>
 }</section>
 }</div>
 <div mat-dialog-actions><button mat-button color="warn" type="button" (click)="remove()" [disabled]="busy || loading || !member">Remove from League</button><button mat-button type="button" [disabled]="busy" mat-dialog-close>Cancel</button><button mat-raised-button color="primary" type="button" (click)="save()" [disabled]="busy || loading || !member || !validNames() || !changed">{{busy?'Saving...':'Save Changes'}}</button></div>`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LeaguePlayerEditComponent implements OnInit,OnDestroy {
    loading=true;busy=false;error='';member:any;divisions:any[]=[];divisionId=0;firstName='';lastName='';private scope:Subscription;private read:Subscription;
    constructor(@Inject(MAT_DIALOG_DATA)public data:any,public ref:MatDialogRef<LeaguePlayerEditComponent>,private players:PlayerService,private leagues:LeagueService){ protectPendingWork(() => this.busy || !!this.member && this.changed);}
    ngOnInit():void {
        this.scope=this.leagues.selectedLeague$.subscribe(c=>{if(c.leagueId!==this.data.leagueId)this.ref.close();});
        this.read=forkJoin([this.players.leaguePlayerMembership(this.data.leagueId,this.data.player.id),this.players.leagueRosterContext(this.data.leagueId)]).pipe(timeout(20000)).subscribe(([member,context])=>{this.member=member;this.divisions=context.divisions;this.divisionId=member.leagueDivisionId;this.firstName=member.player.firstName||'';this.lastName=member.player.lastName||'';this.loading=false;},()=>{this.loading=false;this.error='Could not load this membership. Close and try Edit again.';});
    }
    validNames():boolean{return !!this.member&&(!this.member.canEditProfile||!!this.firstName.trim()&&!!this.lastName.trim()&&this.firstName.length<=100&&this.lastName.length<=100);}
    get changed():boolean{return !!this.member&&(this.divisionId!==this.member.leagueDivisionId||this.member.canEditProfile&&(this.firstName.trim()!==this.member.player.firstName||this.lastName.trim()!==this.member.player.lastName));}
    remove():void{if(!this.busy&&this.member)this.ref.close({remove:this.member.player});}
    save():void {
        if(this.busy||!this.member||!this.validNames()||!this.changed)return;
        this.busy=true;this.error='';this.ref.disableClose=true;
        const changes:any={divisionId:this.divisionId,expectedDivisionId:this.member.leagueDivisionId};
        if(this.member.canEditProfile)Object.assign(changes,{firstName:this.firstName,lastName:this.lastName,expectedFirstName:this.member.player.firstName,expectedLastName:this.member.player.lastName});
        this.players.updateLeaguePlayer(this.data.leagueId,this.data.player.id,changes).subscribe(result=>this.ref.close(result),error=>{this.busy=false;this.ref.disableClose=false;this.error=error.status===409?(error.error&&error.error.message||'This player changed. Close and reopen Edit to review the latest information.'):error.status===403?'You do not have permission to make this change.':'Could not save changes. Your entries are retained; verify the current player before retrying.';});
    }
    ngOnDestroy():void{if(this.scope)this.scope.unsubscribe();if(this.read)this.read.unsubscribe();}
}

@Component({
    selector: 'app-import-player-create', styleUrls: ['./player-management-dialogs.component.css'], template: `
 <h2 mat-dialog-title>Create New Player</h2><p class="uploaded-name">{{data.row.uploadedName}}</p>
 <form #form="ngForm" (ngSubmit)="create()"><div mat-dialog-content>
   <p class="secondary">Create a player profile only. Add them to {{data.leagueName}} later using the import confirmation.</p>
   @if (!data.row.firstName) {
     <p>The uploaded full name is not split automatically. Review both name fields.</p>
   }
   <mat-form-field appearance="outline"><mat-label>First Name</mat-label><input matInput name="firstName" [(ngModel)]="firstName" (ngModelChange)="checkDuplicates()" required maxlength="100" [disabled]="busy"></mat-form-field>
   <mat-form-field appearance="outline"><mat-label>Last Name</mat-label><input matInput name="lastName" [(ngModel)]="lastName" (ngModelChange)="checkDuplicates()" required maxlength="100" [disabled]="busy"></mat-form-field>
   <mat-form-field appearance="outline"><mat-label>Gender</mat-label><mat-select name="gender" [(ngModel)]="gender" required [disabled]="busy"><mat-option value="Male">Male</mat-option><mat-option value="Female">Female</mat-option></mat-select></mat-form-field>
   @if (suggestions.length) {
     <section class="duplicate-warning"><strong>{{exact?'Existing players already use this name. Choose the correct record.':'Possible existing players — review before creating a separate profile.'}}</strong>
     @for (p of suggestions; track p) {
       <button mat-stroked-button type="button" (click)="use(p)" [disabled]="busy">Use {{p.firstName}} {{p.lastName}} · ID {{p.id}} · {{p.isMale?'Men':'Women'}}</button>
     }
     @if (!exact) {
       <mat-checkbox name="reviewed" [(ngModel)]="reviewed" [disabled]="busy">I reviewed the possible matches and need a separate player profile.</mat-checkbox>
     }</section>
   }
   @if (error) {
     <p role="alert">{{error}}</p>
     }</div><div mat-dialog-actions><button mat-button type="button" mat-dialog-close [disabled]="busy">Cancel</button><button mat-raised-button color="primary" type="submit" [disabled]="busy || form.invalid || !validNames() || exact || (suggestions.length > 0 && !reviewed)">{{busy?'Creating...':'Create Player'}}</button></div></form>`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ImportPlayerCreateComponent implements OnInit {
    firstName='';lastName='';gender='';busy=false;error='';suggestions:any[]=[];exact=false;reviewed=false;
    constructor(@Inject(MAT_DIALOG_DATA)public data:any,public ref:MatDialogRef<ImportPlayerCreateComponent>,private players:PlayerService){}
    ngOnInit():void{this.firstName=this.data.row.firstName||this.data.row.uploadedName;this.lastName=this.data.row.lastName||'';this.checkDuplicates();}
    validNames():boolean{return !!normalName(this.firstName)&&!!normalName(this.lastName);}
    checkDuplicates():void {
        this.reviewed=false;const name=normalName(this.firstName+' '+this.lastName),exact=this.data.players.filter(p=>normalName(p.firstName+' '+p.lastName)===name);
        this.exact=exact.length>0;const ids=importPlayerCandidates(name,this.data.players);this.suggestions=exact.length?exact:this.data.players.filter(p=>ids.indexOf(p.id)>=0);
    }
    use(player:any):void{this.ref.close({player});}
    create():void {
        if(this.busy||!this.validNames()||!this.gender||this.exact||this.suggestions.length&&!this.reviewed)return;
        this.busy=true;this.error='';this.ref.disableClose=true;
        this.players.addPlayerWithoutLeague({firstName:this.firstName.trim(),lastName:this.lastName.trim(),gender:this.gender},this.data.leagueId).pipe(timeout(20000)).subscribe((player:any)=>{
            if(!player||!(player.id>0)){this.failed();return;}this.ref.close({player});
        },()=>this.failed());
    }
    private failed():void {
        this.busy=false;this.ref.disableClose=false;this.error='Could not confirm the player profile. Your entries are retained. Check existing matches before retrying.';
        this.players.leagueImportContext(this.data.leagueId).pipe(timeout(20000)).subscribe(c=>{if(c&&Array.isArray(c.players)){this.data.players=c.players;this.checkDuplicates();}},()=>{});
    }
}

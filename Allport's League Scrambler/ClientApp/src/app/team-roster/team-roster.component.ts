import { Component, Inject, Input, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material';
import { forkJoin, Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';
import { PlayerService } from '../services/player.service';

@Component({
 selector: 'app-team-roster-button',
 template: '<button type="button" class="team-roster-link" [disabled]="!(teamId > 0 && leagueId > 0)" [attr.aria-label]="\'View roster for \'+teamName" aria-haspopup="dialog" (click)="open($event)">{{ teamName }}</button>',
 styles: [':host{display:inline;min-width:0}.team-roster-link{font:inherit;font-weight:inherit;color:#285d91;background:none;border:0;border-radius:3px;padding:4px 2px;min-height:32px;max-width:100%;white-space:normal;overflow-wrap:break-word;text-decoration:underline;text-decoration-color:#91acc5;text-underline-offset:3px;cursor:pointer}.team-roster-link:hover{color:#17426c;background:#e9f1fa}.team-roster-link:focus-visible{outline:2px solid #285d91;outline-offset:2px}.team-roster-link:disabled{color:inherit;text-decoration:none;cursor:default}@media print{.team-roster-link{color:inherit;text-decoration:none;padding:0;min-height:0;background:none}}']
})
export class TeamRosterButtonComponent implements OnDestroy {
 @Input() teamId: number;
 @Input() leagueId: number;
 @Input() teamName = '';
 @Input() leagueName = '';
 private ref: MatDialogRef<TeamRosterDialogComponent>;
 constructor(private dialog: MatDialog) {}
 open(event: Event): void {
  event.stopPropagation();
  if (this.ref || !(this.teamId > 0 && this.leagueId > 0)) return;
  this.ref = this.dialog.open(TeamRosterDialogComponent, {
   width: '520px', maxWidth: '94vw', maxHeight: '92vh', restoreFocus: true,
   data: { teamId: this.teamId, leagueId: this.leagueId, teamName: this.teamName, leagueName: this.leagueName }
  });
  this.ref.afterClosed().subscribe(() => this.ref = null);
 }
 ngOnDestroy(): void { if (this.ref) this.ref.close(); }
}

@Component({
 selector: 'app-team-roster-dialog',
 templateUrl: './team-roster.component.html',
 styleUrls: ['./team-roster.component.css']
})
export class TeamRosterDialogComponent implements OnInit, OnDestroy {
 loading = true;
 error = '';
 teamName = '';
 division = '';
 players: any[] = [];
 private request: Subscription;
 constructor(@Inject(MAT_DIALOG_DATA) public data: any,
  public dialogRef: MatDialogRef<TeamRosterDialogComponent>,
  private stats: StatisticsService, private playerService: PlayerService) {}
 ngOnInit(): void {
  this.teamName = this.data.teamName;
  this.request = forkJoin(this.stats.GetAllTeamsWithPlayers(this.data.leagueId),
   this.playerService.GetPlayersByLeague(this.data.leagueId)).subscribe(([teams, players]) => {
   this.loading = false;
   if (!Array.isArray(teams) || !Array.isArray(players)) { this.fail(); return; }
   const team = teams.find(t => t.id === this.data.teamId);
   if (!team) return;
   if (!Array.isArray(team.players)) { this.fail(); return; }
   this.teamName = team.teamName;
   this.division = team.division;
   const records = new Map<number, any>();
   players.forEach(p => records.set(p.id, p));
   const seen = new Set<number>();
   this.players = team.players.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id); return true;
   }).map(member => records.get(member.id)).filter(p => !!p).map(p => ({
    id: p.id, firstName: p.firstName, lastName: p.lastName
   }));
   // Do not split display names or invent historical memberships when records are missing.
   if (this.players.length !== seen.size) this.fail();
  }, () => this.fail());
 }
 private fail(): void { this.loading = false; this.players = []; this.error = 'Unable to load this team roster. Please close and try again.'; }
 ngOnDestroy(): void { if (this.request) this.request.unsubscribe(); }
}

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PageLoadingComponent } from '../page-loading.component';
import { Component, ElementRef, Inject, Input, Optional, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, Subscription } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { PlayerService } from '../services/player.service';
import { StatisticsService } from '../services/statistics.service';
import { LeagueService } from '../services/league.service';

export interface PickupBrowserPlayer { id: number; firstName: string; lastName: string; isMale: boolean | null; alreadyAdded: boolean; }

export interface PickupPlayerBrowser {
    load: () => Observable<{players: PickupBrowserPlayer[]}>;
    add: (id: number) => Observable<unknown>;
}

@Component({
    selector: 'app-existing-player-browser',
    templateUrl: './existing-player-browser.component.html',
    styleUrls: ['./existing-player-browser.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, PageLoadingComponent]
})
export class ExistingPlayerBrowserComponent implements OnInit, OnDestroy {
    @Input() embeddedData?: {leagueId: number; leagueName: string; onAdded: (result: any, reconciled: boolean) => void};
    players: any[] = [];
    filteredPlayers: any[] = [];
    divisions: any[] = [];
    search = '';
    gender = 'all';
    divisionId = 0;
    loading = true;
    error = '';
    notice = '';
    blocked = false;
    pending = new Set<number>();
    private reader: Subscription;
    private contextReader: Subscription;
    private closed = false;
    private noticeTimer: any;
    private focusAfterAdd = new Map<number, number>();
    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: any,
        @Optional() public dialogRef: MatDialogRef<ExistingPlayerBrowserComponent>,
        private service: PlayerService, private statistics: StatisticsService, private leagueService: LeagueService, private element: ElementRef) {}

    ngOnInit(): void {
        this.data = this.embeddedData ?? this.data;
        this.divisionId = this.data.divisionId || 0;
        if (!this.embeddedData && !this.data.pickup) this.contextReader = this.leagueService.selectedLeague$.subscribe(context => {
            if (context.leagueId !== this.data.leagueId) this.dialogRef.close();
        });
        if (this.data.team) {
            this.players = this.data.team.players.slice();
            this.loading = false;
            this.filter();
        } else this.load();
    }
    load(): void {
        if (this.reader) this.reader.unsubscribe();
        this.loading = true; this.error = ''; this.players = []; this.filter();
        const pickup: PickupPlayerBrowser | undefined = this.data.pickup;
        if (pickup) {
            this.reader = pickup.load().pipe(timeout(20000)).subscribe(response => {
                this.players = response.players;
                this.loading = false;
                this.filter();
            }, () => this.loadFailed());
            return;
        }
        this.reader = this.service.availableLeaguePlayers(this.data.leagueId).pipe(timeout(20000)).subscribe(response => {
            if (!response || !Array.isArray(response.players) || !Array.isArray(response.divisions)) { this.loadFailed(); return; }
            this.players = response.players;
            this.divisions = response.divisions;
            if (this.divisionId && !this.divisions.some(d => d.id === this.divisionId)) this.divisionId = 0;
            this.loading = false; this.blocked = false; this.filter();
        }, () => this.loadFailed());
    }
    private loadFailed(): void { this.loading = false; this.error = 'Unable to load available players. Please try again.'; }
    filter(): void {
        const words = this.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        this.filteredPlayers = this.players.filter(p => {
            const name = ((p.firstName || '') + ' ' + (p.lastName || '')).toLocaleLowerCase();
            return (this.gender === 'all' || (this.gender === 'men' ? p.isMale === true : p.isMale === false)) && words.every(word => name.indexOf(word) >= 0);
        });
    }
    get availableCount(): number { return this.players.filter(player => !player.alreadyAdded).length; }
    setGender(gender: string): void { this.gender = gender; this.filter(); }
    trackPlayer(index: number, player: any): number { return player.id; }
    add(player: any): void {
        if (player.alreadyAdded || this.closed || this.blocked || this.loading || (this.data.team ? this.pending.size > 0 : this.pending.has(player.id)) || !this.players.some(p => p.id === player.id)) return;
        if (this.divisionId && !this.divisions.some(d => d.id === this.divisionId)) { this.error = 'Select an available division.'; return; }
        const divisionId = this.divisionId, leagueId = this.data.leagueId, leagueName = this.data.leagueName;
        const active = document.activeElement;
        if (active && active.getAttribute('data-player-id') === String(player.id))
            this.focusAfterAdd.set(player.id, Array.prototype.indexOf.call(this.element.nativeElement.querySelectorAll('.available-player'), active));
        this.pending.add(player.id); this.error = '';
        const pickup: PickupPlayerBrowser | undefined = this.data.pickup;
        if (pickup) {
            pickup.add(player.id).subscribe({
                next: () => this.confirm({player}),
                error: response => {
                    this.failed(player);
                    if (response.status < 500) this.error = response.error?.message || this.error;
                }
            });
            return;
        }
        // Writes intentionally finish even if the dialog closes. The callback updates
        // the owning league's roster only while that league is still selected.
        if (this.data.team) {
            this.statistics.AddPlayerToLeagueTeam(this.data.team.id, player.id, leagueId).subscribe({
                next: () => this.confirm({ player }),
                error: response => {
                    if (response.status === 401 || response.status === 403) {
                        this.blocked = true;
                        this.pending.delete(player.id);
                        this.error = 'Your management access is no longer available.';
                        return;
                    }
                    this.failed(player);
                    if (response.status === 409) this.refreshTeamEligibility();
                }
            });
            return;
        }
        this.service.addExistingLeaguePlayer(leagueId, leagueName, player.id, divisionId).subscribe(result => {
            if (!result || result.leagueId !== leagueId || !result.player || result.player.id !== player.id) { this.reconcile(player); return; }
            this.confirm(result);
        }, error => {
            if (error.status === 401 || error.status === 403) {
                this.pending.delete(player.id); this.blocked = true; this.error = 'Your management access is no longer available. Close this window and sign in again.';
            } else this.reconcile(player);
        });
    }
    private refreshTeamEligibility(): void {
        if (this.closed) return;
        this.loading = true;
        this.error = 'The roster changed. Checking available players.';
        this.reader?.unsubscribe();
        this.reader = this.data.team.refreshPlayers().pipe(timeout(15000)).subscribe({
            next: players => {
                this.loading = false;
                this.players = players;
                this.filter();
                this.error = 'The assignment was not saved by this request. The available list has been refreshed.';
            },
            error: () => {
                this.loading = false;
                this.blocked = true;
                this.error = 'Could not refresh the roster. Close and reopen the player browser.';
            }
        });
    }

    private confirm(result: any, reconciled = false): void {
        this.data.onAdded(result, reconciled);
        if (this.closed) return;
        this.pending.delete(result.player.id);
        if (this.data.pickup) result.player.alreadyAdded = true;
        else this.players = this.players.filter(p => p.id !== result.player.id);
        this.filter();
        if (!this.embeddedData && !this.data.pickup) {
            this.notice = result.player.firstName + ' ' + result.player.lastName + (result.alreadyMember ? ' is already in ' : ' added to ') + (this.data.team?.name || this.data.leagueName) + '.';
            clearTimeout(this.noticeTimer); this.noticeTimer = setTimeout(() => this.notice = '', 4000);
        }
        const index = this.focusAfterAdd.get(result.player.id); this.focusAfterAdd.delete(result.player.id);
        if (index !== undefined) setTimeout(() => {
            if (this.closed || document.activeElement !== document.body) return;
            const buttons = this.element.nativeElement.querySelectorAll('.available-player:not(:disabled)');
            const target = buttons[Math.min(index, buttons.length - 1)] || this.element.nativeElement.querySelector('input');
            if (target) target.focus();
        }, 0);
    }
    private reconcile(player: any): void {
        // A timeout/conflict can follow a committed write by this or another admin.
        // Confirm current membership by ID before removing a failed button.
        this.service.leaguePlayerMembership(this.data.leagueId, player.id).pipe(timeout(15000)).subscribe(result => {
            if (result && result.leagueId === this.data.leagueId && result.player && result.player.id === player.id) this.confirm(result, true);
            else this.failed(player);
        }, () => this.failed(player));
    }
    private failed(player: any): void {
        this.pending.delete(player.id);
        if (!this.closed) this.error = 'Could not add ' + player.firstName + ' ' + player.lastName + '. Please try again.';
    }
    ngOnDestroy(): void {
        this.closed = true; clearTimeout(this.noticeTimer);
        if (this.reader) this.reader.unsubscribe();
        if (this.contextReader) this.contextReader.unsubscribe();
    }
}

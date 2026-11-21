import { Component, ElementRef, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { Subscription } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { PlayerService } from '../services/player.service';
import { LeagueService } from '../services/league.service';

@Component({
    selector: 'app-existing-player-browser',
    templateUrl: './existing-player-browser.component.html',
    styleUrls: ['./existing-player-browser.component.css']
})
export class ExistingPlayerBrowserComponent implements OnInit, OnDestroy {
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
    constructor(@Inject(MAT_DIALOG_DATA) public data: any,
        public dialogRef: MatDialogRef<ExistingPlayerBrowserComponent>,
        private service: PlayerService, private leagueService: LeagueService, private element: ElementRef) {}

    ngOnInit(): void {
        this.divisionId = this.data.divisionId || 0;
        this.contextReader = this.leagueService.selectedLeague$.subscribe(context => {
            if (context.leagueId !== this.data.leagueId) this.dialogRef.close();
        });
        this.load();
    }
    load(): void {
        if (this.reader) this.reader.unsubscribe();
        this.loading = true; this.error = ''; this.players = []; this.filter();
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
    setGender(gender: string): void { this.gender = gender; this.filter(); }
    trackPlayer(index: number, player: any): number { return player.id; }
    add(player: any): void {
        if (this.closed || this.blocked || this.loading || this.pending.has(player.id) || !this.players.some(p => p.id === player.id)) return;
        if (this.divisionId && !this.divisions.some(d => d.id === this.divisionId)) { this.error = 'Select an available division.'; return; }
        const divisionId = this.divisionId, leagueId = this.data.leagueId, leagueName = this.data.leagueName;
        const active = document.activeElement;
        if (active && active.getAttribute('data-player-id') === String(player.id))
            this.focusAfterAdd.set(player.id, Array.prototype.indexOf.call(this.element.nativeElement.querySelectorAll('.available-player'), active));
        this.pending.add(player.id); this.error = '';
        // Writes intentionally finish even if the dialog closes. The callback updates
        // the owning league's roster only while that league is still selected.
        this.service.addExistingLeaguePlayer(leagueId, leagueName, player.id, divisionId).subscribe(result => {
            if (!result || result.leagueId !== leagueId || !result.player || result.player.id !== player.id) { this.reconcile(player); return; }
            this.confirm(result);
        }, error => {
            if (error.status === 401 || error.status === 403) {
                this.pending.delete(player.id); this.blocked = true; this.error = 'Your management access is no longer available. Close this window and sign in again.';
            } else this.reconcile(player);
        });
    }
    private confirm(result: any): void {
        this.data.onAdded(result);
        if (this.closed) return;
        this.pending.delete(result.player.id);
        this.players = this.players.filter(p => p.id !== result.player.id); this.filter();
        this.notice = result.player.firstName + ' ' + result.player.lastName + (result.alreadyMember ? ' is already in this league.' : ' added.');
        clearTimeout(this.noticeTimer); this.noticeTimer = setTimeout(() => this.notice = '', 4000);
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
            if (result && result.leagueId === this.data.leagueId && result.player && result.player.id === player.id) this.confirm(result);
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

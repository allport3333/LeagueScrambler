import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { Router } from '@angular/router';
import { FormGroup, FormControl } from '@angular/forms';
import { LeagueService } from '../services/league.service';

@Component({
    selector: 'app-fetch-data',
    templateUrl: './fetch-data.component.html',
    styleUrls: ['./fetch-data.component.less']
})
export class FetchDataComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    malePlayers: Player[] = [];
    femalePlayers: Player[] = [];
    otherPlayers: Player[] = [];
    genderFilter = 'all';
    error = '';
    private leagueReader: Subscription;
    private playerReader: Subscription;
    loading: boolean = false;
    player: Player;
    addedPlayer: Player;
    isMale1: boolean;
    leagueName: string;
    searchValue: string = '';
    selectedLeagueId: number;

    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl(),
        leagueName: new FormControl(),
        isSub: new FormControl()
    });

    constructor(
        private http: HttpClient,
        private router: Router,
        public playerService: PlayerService,
        public leagueService: LeagueService
    ) { }

    ngOnInit(): void {
        // Listen for league changes
        this.leagueReader = this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            const leagueId = selectedLeague && selectedLeague.leagueId;
            this.leagueName = selectedLeague && selectedLeague.leagueName;
            if (leagueId === this.selectedLeagueId) return;
            this.selectedLeagueId = leagueId;
            if (this.playerReader) this.playerReader.unsubscribe();
            if (leagueId > 0) this.loadPlayersByLeague(leagueId);
            else { this.loading = false; this.error = ''; this.players = []; this.applyFilter(this.searchValue); }
        });
    }

    // Retain the existing league-scoped endpoint; cancel stale league reads.
    private loadPlayersByLeague(leagueId: number): void {
        if (this.playerReader) this.playerReader.unsubscribe();
        this.loading = true; this.error = ''; this.players = []; this.applyFilter(this.searchValue);
        this.playerReader = this.playerService.GetPlayersByLeague(leagueId).subscribe(
            (result: Player[]) => {
                this.players = (result || []).slice().sort((a, b) =>
                    Number(a.firstName === 'Open') - Number(b.firstName === 'Open') ||
                    (a.firstName || '').localeCompare(b.firstName || '', undefined, {sensitivity: 'base'}) ||
                    (a.lastName || '').localeCompare(b.lastName || '', undefined, {sensitivity: 'base'}) || a.id - b.id);
                this.applyFilter(this.searchValue);
                this.loading = false;
            },
            () => {
                this.error = 'Unable to load players. Please try again.';
                this.loading = false;
            }
        );
    }

    applyFilter(filterValue: string): void {
        this.searchValue = filterValue || '';
        const words = this.searchValue.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const matches = this.players.filter(p => words.every(word =>
            ((p.firstName || '') + ' ' + (p.lastName || '')).toLocaleLowerCase().indexOf(word) >= 0));
        this.malePlayers = matches.filter(p => this.playerGender(p) === 'Male');
        this.femalePlayers = matches.filter(p => this.playerGender(p) === 'Female');
        this.otherPlayers = matches.filter(p => this.playerGender(p) === 'Other');
    }

    private playerGender(player: Player): string {
        if (player.gender) return player.gender === 'Male' || player.gender === 'Female' ? player.gender : 'Other';
        return player.isMale === true ? 'Male' : player.isMale === false ? 'Female' : 'Other';
    }
    setGender(gender: string): void { this.genderFilter = gender; }
    trackPlayer(index: number, player: Player): number { return player.id; }
    get visibleCount(): number {
        return this.genderFilter === 'men' ? this.malePlayers.length : this.genderFilter === 'women' ? this.femalePlayers.length :
            this.malePlayers.length + this.femalePlayers.length + this.otherPlayers.length;
    }
    retryLoad(): void { if (this.selectedLeagueId > 0) this.loadPlayersByLeague(this.selectedLeagueId); }
    ngOnDestroy(): void {
        if (this.leagueReader) this.leagueReader.unsubscribe();
        if (this.playerReader) this.playerReader.unsubscribe();
    }
    // Clear search filter
    clearSearch(): void {
        this.searchValue = '';
        this.applyFilter('');
    }

    // Submit a new player
    onSubmitClick(): void {
        if (this.PlayerForm.controls['isMale'].value === 'Female') {
            this.isMale1 = false;
        } else if (this.PlayerForm.controls['isMale'].value === 'Male') {
            this.isMale1 = true;
        }

        const newPlayer: Player = {
            id: 0,
            firstName: this.PlayerForm.controls['firstName'].value,
            lastName: this.PlayerForm.controls['lastName'].value,
            gender: this.PlayerForm.controls['isMale'].value,
            isMale: this.isMale1,
            isSub: this.PlayerForm.controls['isSub'].value
        };

        this.playerService.AddPlayer(newPlayer, this.PlayerForm.controls['leagueName'].value).subscribe(
            (result) => {
                this.player = result;
                this.players.push(result);

                this.applyFilter(this.searchValue);
                this.PlayerForm.reset();
            },
            (error) => console.error('Error adding player:', error)
        );
    }

    // Navigate to the player's stats page
    goToPlayerStats(playerId: number): void {
        this.router.navigate(['/player-stats-tabs', playerId]);
    }
}

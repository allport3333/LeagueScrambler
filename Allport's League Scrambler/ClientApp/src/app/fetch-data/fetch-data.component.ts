import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableDataSource, MatSort } from '@angular/material';
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
export class FetchDataComponent implements OnInit {
    players: Player[] = [];
    malePlayersDataSource = new MatTableDataSource<Player>();
    femalePlayersDataSource = new MatTableDataSource<Player>();
    loading: boolean = false;
    player: Player;
    addedPlayer: Player;
    isMale1: boolean;
    leagueName: string;
    searchValue: string = '';
    selectedLeagueId: number;
    displayedColumns: string[] = ['firstName', 'lastName'];

    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl(),
        leagueName: new FormControl(),
        isSub: new FormControl()
    });

    @ViewChild(MatSort) sort: MatSort;

    constructor(
        private http: HttpClient,
        private router: Router,
        public playerService: PlayerService,
        public leagueService: LeagueService
    ) { }

    ngOnInit(): void {
        this.loading = true;

        // Listen for league changes
        this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            if (selectedLeague) {
                this.selectedLeagueId = selectedLeague.leagueId;
                this.loadPlayersByLeague(selectedLeague.leagueId);
            }
        });
    }

    // Load players and separate into male and female tables
    private loadPlayersByLeague(leagueId: number): void {
        this.playerService.GetPlayersByLeague(leagueId).subscribe(
            (result: Player[]) => {
                this.players = result;

                // Split players by gender
                this.malePlayersDataSource = new MatTableDataSource(result.filter(player => player.gender === 'Male'));
                this.femalePlayersDataSource = new MatTableDataSource(result.filter(player => player.gender === 'Female'));

                this.malePlayersDataSource.sort = this.sort;
                this.femalePlayersDataSource.sort = this.sort;

                this.loading = false;
            },
            (error) => {
                console.error('Error loading players:', error);
                this.loading = false;
            }
        );
    }

    // Filter both tables
    applyFilter(filterValue: string): void {
        this.searchValue = filterValue.trim().toLowerCase();
        this.malePlayersDataSource.filter = this.searchValue;
        this.femalePlayersDataSource.filter = this.searchValue;
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

                // Add new player to the correct data source
                if (result.gender === 'Male') {
                    this.malePlayersDataSource.data = [...this.malePlayersDataSource.data, result];
                } else if (result.gender === 'Female') {
                    this.femalePlayersDataSource.data = [...this.femalePlayersDataSource.data, result];
                }

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

import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatSort } from '@angular/material';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PlayerService } from '../services/player.service';
import { PlayerSignIn } from '../data-models/playerSignIn.model';
import { Leagues } from '../data-models/leagues.model';
import { PlayerSignInResult } from '../data-models/playerSignInResult.model';
import { StatisticsService } from '../services/statistics.service';

@Component({
    selector: 'app-sign-in',
    templateUrl: './sign-in.component.html',
    styleUrls: ['./sign-in.component.css']
})
export class SignInComponent implements OnInit {
    leaguesAvailable: Leagues[] = []; // Available leagues
    selectedLeague: Leagues | null = null; // Selected league
    players: any[] = [];
    showAddPlayerForm: boolean = false;
    playerSignIn: any[] = []; 
    filteredPlayers: any[] = [];
    dataSource = new MatTableDataSource();
    signedInDataSource = new MatTableDataSource();

    displayedColumns: string[] = ['firstName', 'lastName'];
    signedInColumns: string[] = [ 'firstName', 'lastName'];

    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl('Male'),
        leagueName: new FormControl()
    });

    @ViewChild(MatSort) sort: MatSort;

    constructor(private playerService: PlayerService, private http: HttpClient) { }

    ngOnInit() {
        this.loadLeagues();
    }

    loadLeagues() {
        this.playerService.GetLeagues().subscribe(
            (result: Leagues[]) => {
                this.leaguesAvailable = result;
            },
            (error) => console.error('Error fetching leagues:', error)
        );
    }

    loadPlayers(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.playerService.GetPlayersByLeague(this.selectedLeague.id).subscribe(
                (players) => {
                    this.players = players.sort((a, b) => {
                        if (a.firstName.toLowerCase() < b.firstName.toLowerCase()) return -1;
                        if (a.firstName.toLowerCase() > b.firstName.toLowerCase()) return 1;
                        if (a.lastName.toLowerCase() < b.lastName.toLowerCase()) return -1;
                        if (a.lastName.toLowerCase() > b.lastName.toLowerCase()) return 1;
                        return 0;
                    });
                    this.dataSource.data = [...this.players];
                    this.filteredPlayers = [...this.players];
                    resolve(); // Resolve the promise when players are loaded
                },
                (error) => {
                    console.error('Error loading players:', error);
                    reject(error); // Reject the promise on error
                }
            );
        });
    }


    selectPlayer(player: any): void {
        // Add the player to the signed-in list
        this.signInPlayer(player);

        // Remove the player from the available players list
        this.players = this.players.filter(p => p.id !== player.id);
        this.filteredPlayers = this.filteredPlayers.filter(p => p.id !== player.id);
        this.dataSource.data = [...this.players];
    }

    unselectPlayer(player: any): void {
        // Make an API call to delete the player from PlayerSignIn
        this.playerService.deleteSignInPlayer(player.playerSignInId).subscribe(
            () => {
                // Remove the player from the signed-in list
                this.playerSignIn = this.playerSignIn.filter(p => p.playerSignInId !== player.playerSignInId);
                this.signedInDataSource.data = [...this.playerSignIn];

                // Add the player back to the available players list
                const restoredPlayer = {
                    id: player.playerId,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    gender: player.gender,
                };

                this.players.push(restoredPlayer);

                // Sort the available players list by firstName, then lastName
                this.players.sort((a, b) => {
                    if (a.firstName.toLowerCase() < b.firstName.toLowerCase()) return -1;
                    if (a.firstName.toLowerCase() > b.firstName.toLowerCase()) return 1;
                    if (a.lastName.toLowerCase() < b.lastName.toLowerCase()) return -1;
                    if (a.lastName.toLowerCase() > b.lastName.toLowerCase()) return 1;
                    return 0;
                });

                // Update the dataSource with the sorted list
                this.dataSource.data = [...this.players];
                this.filteredPlayers = [...this.players];
            },
            (error) => {
                console.error('Error removing player from PlayerSignIn:', error);
            }
        );
    }



    applyFilter(filterValue: string) {
        const trimmedValue = filterValue.trim().toLowerCase();
        this.filteredPlayers = this.players.filter(player =>
            player.firstName.toLowerCase().includes(trimmedValue) ||
            player.lastName.toLowerCase().includes(trimmedValue)
        );
    }

    onLeagueSelect(league: Leagues) {
        this.selectedLeague = league;
        this.players = [];
        this.playerSignIn = []; 
        this.signedInDataSource.data = this.playerSignIn;

        this.loadPlayers()
            .then(() => this.loadSignedInPlayers())
            .catch((error) => console.error('Error during league selection:', error));
    }

    loadSignedInPlayers(): Promise<void> {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0]; // Get current date without time

            this.playerService.getSignedInPlayers(this.selectedLeague.id, today).subscribe(
                (signedInPlayers) => {
                    this.playerSignIn = signedInPlayers;
                    this.signedInDataSource.data = [...this.playerSignIn];
                    const signedInPlayerIds = this.playerSignIn.map(player => player.playerId);
                    this.players = this.players.filter(player => !signedInPlayerIds.includes(player.id));
                    this.dataSource.data = [...this.players];
                    this.filteredPlayers = [...this.players];
                    resolve(); // Resolve the promise when signed-in players are loaded
                },
                (error) => {
                    console.error('Error loading signed-in players:', error);
                    reject(error); // Reject the promise on error
                }
            );
        });
    }



    signInPlayer(player: any) {
        if (!this.selectedLeague) {
            alert('Please select a league before signing in players.');
            return;
        }

        const playerSignIn: PlayerSignIn = {
            playerSignInId: 0, // New record, so ID is 0
            dateTime: new Date().toISOString().split('T')[0], // Current date without time
            playerId: player.id,
            leagueId: this.selectedLeague.id
        };

        this.playerService.signInPlayer(playerSignIn).subscribe(
            (result: PlayerSignInResult) => {
                this.playerSignIn.push({
                    playerSignInId: result.playerSignInId,
                    dateTime: result.dateTime,
                    leagueId: result.leagueId,
                    playerId: result.playerId,
                    firstName: result.firstName,
                    lastName: result.lastName,
                    gender: result.gender
                });

                this.signedInDataSource.data = [...this.playerSignIn]; // Update the dataSource
            },
            (error) => console.error('Error signing in player:', error)
        );
    }

    toggleAddPlayerForm() {
        this.showAddPlayerForm = !this.showAddPlayerForm;
    }

    addNewSignInPlayer() {
        const newPlayer = {
            id: 0,
            firstName: this.PlayerForm.value.firstName,
            lastName: this.PlayerForm.value.lastName,
            isMale: this.PlayerForm.value.isMale === 'Male',
            gender: this.PlayerForm.value.isMale,
            leagueId: this.selectedLeague ? this.selectedLeague.id : 0,

            isSub: false
        };
        
        // API call to add player
        this.playerService.AddPlayer(newPlayer, this.selectedLeague.leagueName).subscribe(
            (result) => {
                this.players.push(result);
                this.players.sort((a, b) => {
                    if (a.firstName.toLowerCase() < b.firstName.toLowerCase()) return -1;
                    if (a.firstName.toLowerCase() > b.firstName.toLowerCase()) return 1;
                    if (a.lastName.toLowerCase() < b.lastName.toLowerCase()) return -1;
                    if (a.lastName.toLowerCase() > b.lastName.toLowerCase()) return 1;
                    return 0;
                });
                this.dataSource.data = [...this.players];
                this.filteredPlayers = [...this.players];
            },
            (error) => console.error(error)
        );
    }
}

import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatSort, MatSnackBar } from '@angular/material';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PlayerService } from '../services/player.service';
import { PlayerSignIn } from '../data-models/playerSignIn.model';
import { Leagues } from '../data-models/leagues.model';
import { PlayerSignInResult } from '../data-models/playerSignInResult.model';
import { StatisticsService } from '../services/statistics.service';
import { Player } from '../data-models/player.model';
import { LoginService } from '../services/login.service';

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
    signedInDataSource = new MatTableDataSource<Player>();
    isSignInLocked: boolean = false; // Bind to the checkbox
    displayedColumns: string[] = ['firstName', 'lastName'];
    signedInColumns: string[] = ['firstName', 'lastName'];
    userRole: string; // To store the role of the user

    maleCount: number = 0;
    femaleCount: number = 0;

    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl('Male'),
        leagueName: new FormControl()
    });

    @ViewChild(MatSort) sort: MatSort;

    constructor(private playerService: PlayerService, private loginService: LoginService, private http: HttpClient, private snackBar: MatSnackBar) { }

    ngOnInit() {
        this.loadLeagues();
        this.loginService.getUsersRole().subscribe(
            (role) => {
                this.userRole = role.role;
            },
            (error) => {
                console.error('ngOnInit: Error fetching user role:', error);
            }
        );
        this.loadSignInLockStatus();
    }

    // Load initial lock status
    private loadSignInLockStatus(): void {
        this.playerService.getSignInLockStatus().subscribe(
            (status) => {
                this.isSignInLocked = status;
            },
            (error) => {
                console.error('Error loading sign-in lock status:', error);
            }
        );
    }

    onLockSignInChange(locked: boolean): void {
        this.playerService.setSignInLockStatus(locked).subscribe(
            (updatedStatus: boolean) => {
                this.isSignInLocked = updatedStatus;

                // Show Snackbar Notification
                const message = updatedStatus
                    ? 'Sign-in list has been locked.'
                    : 'Sign-in list has been unlocked.';
                this.snackBar.open(message, 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                });
            },
            (error) => {
                console.error('Error updating sign-in lock status:', error);

                // Error Snackbar
                this.snackBar.open('Error updating lock status.', 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                });
            }
        );
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

                // Update gender counts
                this.updateGenderCounts();
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

    updateGenderCounts(): void {
        const signedInPlayers = this.signedInDataSource.data;
        this.maleCount = signedInPlayers.filter((player: Player) => player.gender === 'Male').length;
        this.femaleCount = signedInPlayers.filter((player: Player) => player.gender === 'Female').length;
    }

    loadSignedInPlayers(): Promise<void> {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0]; // Get current date without time

            this.playerService.getSignedInPlayers(this.selectedLeague.id, today).subscribe(
                (signedInPlayers) => {
                    signedInPlayers.sort((a, b) => {
                        if (a.firstName.toLowerCase() < b.firstName.toLowerCase()) return -1;
                        if (a.firstName.toLowerCase() > b.firstName.toLowerCase()) return 1;
                        return 0;
                    });
                    this.playerSignIn = signedInPlayers;
                    this.signedInDataSource.data = [...this.playerSignIn];
                    const signedInPlayerIds = this.playerSignIn.map(player => player.playerId);
                    this.players = this.players.filter(player => !signedInPlayerIds.includes(player.id));
                    this.dataSource.data = [...this.players];
                    this.filteredPlayers = [...this.players];


                    this.updateGenderCounts();
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

                this.playerSignIn.sort((a, b) => {
                    if (a.firstName.toLowerCase() < b.firstName.toLowerCase()) return -1;
                    if (a.firstName.toLowerCase() > b.firstName.toLowerCase()) return 1;
                    return 0;
                });

                this.signedInDataSource.data = [...this.playerSignIn]; // Update the dataSource

                this.updateGenderCounts();
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

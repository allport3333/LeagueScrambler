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
import { LeagueService } from '../services/league.service';
import { AuthService } from '../auth.service';

@Component({
    selector: 'app-sign-in',
    templateUrl: './sign-in.component.html',
    styleUrls: ['./sign-in.component.css']
})
export class SignInComponent implements OnInit {
    playerId: number | null = null;
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
    isLoggedIn: boolean = false;
    maleCount: number = 0;
    femaleCount: number = 0;
    player: Player | null = null;
    isPlayerSignedIn: boolean = false;  // Track if the player is signed in
    currentPlayerId: number;  

    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl('Male'),
        leagueName: new FormControl()
    });

    @ViewChild(MatSort) sort: MatSort;

    constructor(private playerService: PlayerService, private loginService: LoginService, private authService: AuthService,
        private leagueService: LeagueService, private http: HttpClient, private snackBar: MatSnackBar) { }

    ngOnInit() {
        this.loadLeagues();
        this.authService.isLoggedIn$.subscribe((loggedIn) => {
            this.isLoggedIn = loggedIn;

            if (this.isLoggedIn) {
                this.loginService.getUsersRole().subscribe(
                    (role) => {
                        this.userRole = role.role;

                        if (this.userRole === 'Player') {

                            this.loadPlayerIdForUser();
                        }
                    },
                    (error) => {
                        console.error('ngOnInit: Error fetching user role:', error);
                    }
                );
            }

        });
        this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            if (selectedLeague) {
                this.selectedLeague = {
                    id: selectedLeague.leagueId,
                    leagueName: selectedLeague.leagueName
                };
                this.onLeagueSelect(this.selectedLeague);
            }
        });

        this.loadSignInLockStatus();
    }

    checkIfPlayerSignedIn(): void {
        this.isPlayerSignedIn = this.playerSignIn.some(
            (signedInPlayer) => signedInPlayer.playerId === this.currentPlayerId
        );
    }

    togglePlayerSignIn(): void {
        if (this.isPlayerSignedIn) {
            // Player is already signed in Remove them
            const signedInPlayer = this.playerSignIn.find(
                (p) => p.playerId === this.currentPlayerId
            );

            if (signedInPlayer) {
                this.unselectPlayer(signedInPlayer);
                this.isPlayerSignedIn = false;
            }
        } else {
            // Player is not signed in Add them
            this.signInPlayer(this.player);
            this.isPlayerSignedIn = true;
        }
    }

    private loadPlayerIdForUser(): void {
        this.loginService.getUsersPlayer().subscribe(
            (response) => {
                this.playerId = response.playerId;

                this.playerService.getPlayerByPlayerId().subscribe({
                    next: (player: Player) => {
                        this.currentPlayerId = player.id;
                        this.player = player;
                        this.loadSignedInPlayers();
                    },
                    error: (err) => {
                        console.error('Error fetching player details:', err);
                    }
                });
            },
            (error) => {
                console.error('Error fetching player ID:', error);
            }
        );
    }

    handlePlayerRemoval(player: any): void {
        if (this.isSignInLocked) {
            return;
        }

        // Allow only Admin/Manager or the Player themselves to unselect
        if (this.userRole === 'Admin' || this.userRole === 'Manager' || (this.player && player.playerId === this.player.id)) {
            this.unselectPlayer(player);

            // If the removed player is the logged-in player, update the button state
            if (this.player && player.playerId === this.player.id) {
                this.isPlayerSignedIn = false; // Reset the button to "Sign In"
            }
        } else {
            this.snackBar.open('You can only remove yourself from the sign-in list.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
            });
        }
    }

    // Load initial lock status
    private loadSignInLockStatus(): void {
        if (!this.selectedLeague) {
            console.error('No league selected. Cannot load sign-in lock status.');
            return;
        }

        this.playerService.getSignInLockStatus(this.selectedLeague.id).subscribe(
            (status) => {
                this.isSignInLocked = status;
            },
            (error) => {
                console.error('Error loading sign-in lock status:', error);
            }
        );
    }


    onLockSignInChange(locked: boolean): void {
        if (!this.selectedLeague) {
            console.error('No league selected. Cannot update sign-in lock status.');
            return;
        }

        this.playerService.setSignInLockStatus(locked, this.selectedLeague.id).subscribe(
            (updatedStatus: boolean) => {
                this.isSignInLocked = updatedStatus;

                // Snackbar Notification
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
        if (this.isSignInLocked) {
            this.snackBar.open('Sign-in is currently locked.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
            });
            return;
        }

        // Player can only sign in themselves
        if (this.userRole === 'Player' && player.id !== this.playerId) {
            this.snackBar.open('You can only sign in yourself.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
            });
            return;
        }

        // Proceed to sign in the player
        this.signInPlayer(player);

        // Remove player from the available list after signing in
        this.players = this.players.filter(p => p.id !== player.id);
        this.filteredPlayers = this.filteredPlayers.filter(p => p.id !== player.id);
        this.dataSource.data = [...this.players];
    }

    unselectPlayer(player: any): void {
        if (this.isSignInLocked) {
            this.snackBar.open('Sign-in is currently locked.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
            });
            return;
        }

        // Allow only Admin/Manager or the player themselves to unselect
        if (this.userRole === 'Player' && player.playerId !== this.playerId) {
            this.snackBar.open('You can only remove yourself from the sign-in list.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
            });
            return;
        }

        // Proceed with unselecting the player
        this.playerService.deleteSignInPlayer(player.playerSignInId).subscribe(
            () => {
                // Remove player from signed-in list
                this.playerSignIn = this.playerSignIn.filter(p => p.playerSignInId !== player.playerSignInId);
                this.signedInDataSource.data = [...this.playerSignIn];

                // Restore player back to the available list
                const restoredPlayer = {
                    id: player.playerId,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    gender: player.gender
                };

                this.players.push(restoredPlayer);

                // Sort available players alphabetically
                this.players.sort((a, b) => {
                    const nameA = `${a.firstName.toLowerCase()} ${a.lastName.toLowerCase()}`;
                    const nameB = `${b.firstName.toLowerCase()} ${b.lastName.toLowerCase()}`;
                    return nameA.localeCompare(nameB);
                });

                this.dataSource.data = [...this.players];
                this.filteredPlayers = [...this.players];

                // Update gender counts
                this.updateGenderCounts();

                this.snackBar.open(`${player.firstName} ${player.lastName} has been removed.`, 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                });
            },
            (error) => {
                console.error('Error removing player from PlayerSignIn:', error);
                this.snackBar.open('Error removing player from sign-in.', 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                });
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
        this.loadSignInLockStatus();
    }

    loadSignedInPlayers(): Promise<void> {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0]; // Get current date without time

            this.playerService.getSignedInPlayers(this.selectedLeague.id, today).subscribe(
                (signedInPlayers) => {
                    // Sort signed-in players alphabetically
                    signedInPlayers.sort((a, b) => {
                        if (a.firstName.toLowerCase() < b.firstName.toLowerCase()) return -1;
                        if (a.firstName.toLowerCase() > b.firstName.toLowerCase()) return 1;
                        return 0;
                    });

                    this.playerSignIn = signedInPlayers;
                    this.signedInDataSource.data = [...this.playerSignIn];

                    // Filter out signed-in players from the available players list
                    const signedInPlayerIds = this.playerSignIn.map(player => player.playerId);
                    this.players = this.players.filter(player => !signedInPlayerIds.includes(player.id));
                    this.dataSource.data = [...this.players];
                    this.filteredPlayers = [...this.players];

                    this.updateGenderCounts();

                    // Check if the current player is already signed in
                    if (this.userRole === 'Player' && this.currentPlayerId) {
                        this.isPlayerSignedIn = this.playerSignIn.some(
                            (player) => player.playerId === this.currentPlayerId
                        );
                    }

                    resolve(); // Resolve when done
                },
                (error) => {
                    console.error('Error loading signed-in players:', error);
                    reject(error);
                }
            );
        });
    }



    signInPlayer(player: any): void {
        if (!this.selectedLeague) {
            alert('Please select a league before signing in players.');
            return;
        }

        const playerSignIn: PlayerSignIn = {
            playerSignInId: 0, // New record
            dateTime: new Date().toISOString().split('T')[0], // Today's date
            playerId: player.id,
            leagueId: this.selectedLeague.id
        };

        this.playerService.signInPlayer(playerSignIn).subscribe(
            (result: PlayerSignInResult) => {
                // Add signed-in player to the list
                this.playerSignIn.push({
                    playerSignInId: result.playerSignInId,
                    dateTime: result.dateTime,
                    leagueId: result.leagueId,
                    playerId: result.playerId,
                    firstName: result.firstName,
                    lastName: result.lastName,
                    gender: result.gender
                });

                // Sort signed-in players alphabetically
                this.playerSignIn.sort((a, b) => {
                    const nameA = `${a.firstName.toLowerCase()} ${a.lastName.toLowerCase()}`;
                    const nameB = `${b.firstName.toLowerCase()} ${b.lastName.toLowerCase()}`;
                    return nameA.localeCompare(nameB);
                });

                // Update the table data
                this.signedInDataSource.data = [...this.playerSignIn];

                // Update gender counts
                this.updateGenderCounts();

                this.snackBar.open(`${player.firstName} ${player.lastName} signed in!`, 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                });
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

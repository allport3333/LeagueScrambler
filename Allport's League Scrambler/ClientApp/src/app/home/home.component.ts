import { Component, OnInit, HostListener } from '@angular/core';
import { LoginService } from '../services/login.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { MatSnackBarConfig, MatSnackBar, MatDialog, MatDialogRef } from '@angular/material';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';
import { ForgotPasswordDialogComponent } from '../forgot-password-dialog/forgot-password-dialog.component';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeagueService } from '../services/league.service';
import { PlayerService } from '../services/player.service';
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.less']
})
export class HomeComponent implements OnInit {
    loginUsername: string = '';
    loginPassword: string = '';
    registerUsername: string = '';
    registerEmail: string = '';
    registerPassword: string = '';
    confirmPassword: string = '';
    registerFirstName: string = '';
    registerLastName: string = '';
    showRegistrationForm: boolean = false;
    showLoginForm: boolean = false;
    userId: number;
    isLoggedIn: boolean = false;
    registerForm: FormGroup; 
    dialogRef: MatDialogRef<ForgotPasswordDialogComponent>; 
    showPlayerClaimModal = false;
    showSpecificPlayerClaimModal = false;
    players = [];
    filteredPlayers = [];
    searchTerm = '';
    selectedPlayer: any;
    showAddPlayerForm = false;

    constructor(private loginService: LoginService, private leagueService: LeagueService, public playerService: PlayerService, private snackBar: MatSnackBar, private dialog: MatDialog, private router: Router, private authService: AuthService, private route: ActivatedRoute,private fb: FormBuilder) {
        this.route.queryParams.subscribe((queryParams) => {
            if (queryParams.toggleLoginForm === 'true') {
                this.toggleLoginForm();
            }
        });
    }

    ngOnInit() {
        this.registerForm = this.fb.group({
            registerUsername: ['', Validators.required],
            registerEmail: ['', [Validators.required, Validators.email]],
            registerPassword: ['', Validators.required],
            confirmPassword: ['', Validators.required],
            registerFirstName: ['', Validators.required],
            registerLastName: ['', Validators.required]
        }, {
            validator: this.passwordMatchValidator // Add custom validation function
        });
        this.authService.isLoggedIn$.subscribe((loggedIn) => {
            this.isLoggedIn = loggedIn;
        });
    }

    passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
        const password = control.get('registerPassword').value;
        const confirmPassword = control.get('confirmPassword').value;

        if (password !== confirmPassword) {
            return { 'passwordMismatch': true };
        }

        return null;
    }

    logout() {
        this.authService.setLoggedIn(false);
    }

    openForgotPasswordDialog(): void {
        this.dialogRef = this.dialog.open(ForgotPasswordDialogComponent, {
            width: '300px',
        });

        this.dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                // User clicked "Submit" in the dialog
                // Pass the entered email to the forgotPassword method
            }
        });
    }



    showNotification(message: string): void {
        this.snackBar.open(message, 'Close', {
            duration: 5000, // Adjust the duration as needed
            panelClass: ['mat-snack-bar-container-custom'], // You can create a custom CSS class for the notification container
        });
    }

    login() {
        this.loginService.login(this.loginUsername, this.loginPassword).subscribe(
            (response) => {
                this.authService.setLoggedIn(true);

                // Fetch user's role
                this.loginService.getUsersRole().subscribe((roleResult) => {
                    const userRole = roleResult.role; // Assuming the API returns { role: 'Player' | 'Admin' | 'Manager' }

                    // Fetch user's leagues
                    this.loginService.getUserLeagues().subscribe((leagues) => {
                        if (leagues && leagues.length > 0) {
                            // Select the first league
                            const firstLeague = leagues[0];
                            this.leagueService.setSelectedLeague(firstLeague.id);

                            // Navigate based on the role
                            if (userRole === 'Player') {
                                // Fetch the player's ID for the user
                                this.loginService.getUsersPlayer().subscribe((playerData) => {
                                    if (playerData && playerData.playerId) {
                                        const playerProfileUrl = `/player-stats-tabs/${playerData.playerId}`;
                                        this.router.navigate([playerProfileUrl]);
                                    } else {
                                        console.error('Player ID not found for the user.');
                                        this.showSnackBar('Player ID not found. Please contact support.', true);
                                    }
                                }, error => {
                                    console.error('Error fetching player data:', error);
                                    this.showSnackBar('Error fetching player data. Please contact support.', true);
                                });
                            } else {
                                // Navigate to scrambler for Admin or Manager
                                this.router.navigate(['/scrambler']);
                            }
                        } else {
                            console.error('No leagues available for the user.');
                            this.showSnackBar('No leagues available. Please contact support.', true);
                        }
                    });
                });
            },
            (error) => {
                this.showSnackBar('Login Failed', true); // Show fail message
            }
        );
    }




    toggleRegistrationForm() {
        this.showRegistrationForm = true;
        this.showLoginForm = false;
    }

    toggleLoginForm() {
        this.showLoginForm = true;
        this.showRegistrationForm =false;
    }

    register() {
        if (this.registerForm.invalid) {
            // Form is invalid, show an error message and mark invalid fields as touched
            this.showSnackBar('Please fill in all required fields and make sure the email is valid.', true);
            this.markFormGroupTouched(this.registerForm);
            return;
        }

        const password = this.registerForm.get('registerPassword').value;
        const confirmPassword = this.registerForm.get('confirmPassword').value;

        if (password !== confirmPassword) {
            // Password and confirm password do not match, show an error message
            this.showSnackBar('Passwords do not match. Please make sure they match.', true);
            return;
        }

        // If the control reaches here, the form is valid, and passwords match
        // Proceed with registration
        this.loginService.register(
            this.registerForm.get('registerUsername').value,
            this.registerForm.get('registerEmail').value,
            password,
            this.registerForm.get('registerFirstName').value,
            this.registerForm.get('registerLastName').value
        ).subscribe(
            (response) => {
                // After a successful registration, show the snackbar.
                const username = this.registerForm.get('registerUsername').value;
                const snackbarMessage = `Registration successful for ${username}`;
                this.userId = response.userId;
                this.showLoginForm = true;
                this.showRegistrationForm = false;
                this.showSnackBar(snackbarMessage, false); // Show success message

                this.openSpecificPlayerClaimModal();
            },
            (error) => {
                // Handle registration error
                this.showSnackBar('Registration failed', true); // Show fail message
            }
        );
    }

    markFormGroupTouched(formGroup: FormGroup) {
        Object.values(formGroup.controls).forEach(control => {
            control.markAsTouched();
            if (control instanceof FormGroup) {
                this.markFormGroupTouched(control);
            }
        });
    }


    addPlayerForm = this.fb.group({
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        gender: ['', Validators.required],
        isSub: [false] // Default value for the checkbox
    });

    openAddPlayerForm() {
        this.showAddPlayerForm = true;
    }

    closeAddPlayerForm() {
        this.showAddPlayerForm = false;
    }

    addPlayer() {
        if (this.addPlayerForm.invalid) {
            this.showSnackBar('Please fill out all required fields.', true);
            return;
        }

        const playerData = this.addPlayerForm.value;
        this.playerService.addPlayerWithoutLeague(playerData).subscribe(
            (newPlayer) => {
                this.showSnackBar(`Player ${newPlayer.firstName} ${newPlayer.lastName} created successfully!`, false);
                this.filteredPlayers.push(newPlayer); // Add the new player to the dropdown
                this.selectedPlayer = newPlayer; // Auto-select the new player
                this.claimPlayer(newPlayer); // Claim the newly created player
                this.closeAddPlayerForm();
            },
            () => {
                this.showSnackBar('Failed to create player. Try again.', true);
            }
        );
    }

    openSpecificPlayerClaimModal() {
        const firstName = this.registerForm.get('registerFirstName').value;
        const lastName = this.registerForm.get('registerLastName').value;

        this.playerService.GetPlayerByFirstLastName(firstName, lastName).subscribe(
            (players) => {
                this.players = players || []; // Handle null or empty response
                this.filteredPlayers = this.players;
                this.showSpecificPlayerClaimModal = true; // Always show the specific claim modal
            },
            (error) => {
                console.error('Error fetching players:', error);
                this.showSnackBar('Failed to fetch players. Please try again.', true);
                this.openClaimModal(); // Fallback to generic claim modal on error
            }
        );
    }



    confirmClaimPlayer(player: any) {
        const snackBarRef = this.snackBar.open(
            `Claim ${player.firstName} ${player.lastName}?`,
            'Confirm',
            {
                horizontalPosition: 'center',
                verticalPosition: 'top',
                panelClass: ['custom-snackbar'],
            }
        );

        // Handle "Confirm" action
        snackBarRef.onAction().subscribe(() => {
            this.claimPlayer(player); // If the user clicks "Confirm," claim the player
        });

        // Handle snackbar dismissal
        snackBarRef.afterDismissed().subscribe((event) => {
            if (!event.dismissedByAction) {
                // If dismissed without clicking "Confirm," open the generic claim modal
                this.openClaimModal();
            }
        });
    }




    openClaimModal() {
        this.showSpecificPlayerClaimModal = false;
        this.showPlayerClaimModal = true;

        this.playerService.GetPlayers().subscribe(
            (players) => {
                this.players = players;
            },
            (error) => {
                console.error('Error fetching players:', error);
                this.showSnackBar('Unable to fetch players. Please try again later.', true);
            }
        );
    }

    filterPlayers() {
        if (!this.searchTerm) {
            this.filteredPlayers = [...this.players];
            return;
        }

        const lowerCaseSearch = this.searchTerm.toLowerCase();
        this.filteredPlayers = this.players.filter(player =>
            `${player.firstName} ${player.lastName}`.toLowerCase().includes(lowerCaseSearch)
        );
    }

    @HostListener('document:click', ['$event'])
    onClickOutside(event: MouseEvent) {
        const targetElement = event.target as HTMLElement;
        const isInsideInput = targetElement.closest('.typeahead-options') || targetElement.closest('mat-form-field');
        if (!isInsideInput) {
            this.filteredPlayers = []; // Clear dropdown if clicked outside
        }
    }

    closeDropdown() {
        this.filteredPlayers = []; // Clear the dropdown
    }



    claimPlayer(player: any) {
        this.playerService.claimPlayer({ userId: this.userId, playerId: player.id }).subscribe(
            () => {
                this.showSnackBar(`${player.firstName} ${player.lastName} has been claimed successfully!`, false);
                this.closeModal();
            },
            () => {
                this.showSnackBar('Failed to claim player. Try again.', true);
            }
        );
    }



    closeModal() {
        this.showPlayerClaimModal = false;
        this.showSpecificPlayerClaimModal = false;
        this.selectedPlayer = null;
    }

    selectPlayer(player: any) {
        this.selectedPlayer = player;
        this.searchTerm = `${player.firstName} ${player.lastName}`; // Display the selected player in the input
        this.filteredPlayers = []; // Clear the dropdown
        this.claimPlayer(player);
    }

    cancel() {
        this.showLoginForm = false;
        this.showRegistrationForm = false;
    }


    showSnackBar(message: string, error: boolean = false) {
        const config = new MatSnackBarConfig();
        config.verticalPosition = 'top'; // Set the vertical position to center
        config.horizontalPosition = 'center'; // Set the horizontal position to center

        if (error) {
            this.snackBar.open(message, 'Close', {
                verticalPosition: 'top',
                horizontalPosition: 'center',
                panelClass: ['red-snackbar'] // Apply custom CSS class for styling (for errors)
            });
        }
        else {
            this.snackBar.open(message, 'Close', config);
        }
    }
}

import { signal } from '@angular/core';
import { ProfileMatch } from '../data-models/profile-match';
import { Component, OnInit, DestroyRef, ViewChild, TemplateRef, ChangeDetectionStrategy } from '@angular/core';
import { LeagueService } from '../services/league.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoginService } from '../services/login.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBarConfig, MatSnackBar } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';
import { ForgotPasswordDialogComponent } from '../forgot-password-dialog/forgot-password-dialog.component';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.less'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class HomeComponent implements OnInit {
    @ViewChild('claimProfileDialog', { static: true }) claimProfileDialog: TemplateRef<unknown>;
    loginEmail: string = '';
    loginPassword: string = '';
    loginError = '';
    loginPending = false;
    registerEmail: string = '';
    registerPassword: string = '';
    confirmPassword: string = '';
    registerFirstName: string = '';
    registerLastName: string = '';
    showRegistrationForm: boolean = false;
    showLoginForm: boolean = false;
    userId: number;
    authenticationChecked = false;
    isLoggedIn: boolean = false;
    registerForm: UntypedFormGroup; 
    dialogRef: MatDialogRef<ForgotPasswordDialogComponent>; 
    readonly claimViewportLimit = signal<string | null>(null);
    private claimDialogRef: MatDialogRef<unknown>;
    private claimSearch: Subscription;
    private claimSearchTimer: ReturnType<typeof setTimeout>;
    searchTerm = '';
    claimResults: ProfileMatch[] = [];
    claimedProfiles: ProfileMatch[] = [];
    recoveryProfile: ProfileMatch | null = null;
    selectedPlayer: ProfileMatch;
    claimStep: 'search' | 'create' | 'recover' = 'search';
    claimedExactMatch = false;
    searchLoading = false;
    claimError = '';
    claimPending = false;
    registrationPending = false;
    isEmailValid: boolean = true;

    constructor(private loginService: LoginService, public playerService: PlayerService, private snackBar: MatSnackBar, private dialog: MatDialog, private router: Router, private authService: AuthService, private route: ActivatedRoute,private fb: UntypedFormBuilder, destroyRef: DestroyRef, leagues: LeagueService) {
        destroyRef.onDestroy(() => { this.cancelClaimSearch(); this.claimDialogRef?.close(); });
        this.route.queryParams.pipe(takeUntilDestroyed(destroyRef)).subscribe((queryParams) => {
            const leagueId = Number(queryParams.leagueId);
            if (this.route.snapshot.fragment === 'attendance' && Number.isSafeInteger(leagueId) && leagueId > 0) {
                leagues.selectNavigationLeague(leagueId).pipe(takeUntilDestroyed(destroyRef)).subscribe();
            }
            if (queryParams.toggleLoginForm === 'true') {
                this.toggleLoginForm();
            }
        });
    }

    validateEmail(): void {
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        this.isEmailValid = emailPattern.test(this.loginEmail);
    }

    ngOnInit() {
        this.registerForm = this.fb.group({
            registerEmail: ['', [Validators.required, Validators.email]],
            registerPassword: ['', Validators.required],
            confirmPassword: ['', Validators.required],
            registerFirstName: ['', Validators.required],
            registerLastName: ['', Validators.required]
        }, {
            validator: this.passwordMatchValidator // Add custom validation function
        });
        this.authService.authenticationState$.subscribe((state) => {
            this.authenticationChecked = state !== null;
            this.isLoggedIn = state === true;
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
            panelClass: ['custom-snackbar']
        });
    }

    login() {
        if (this.loginPending || !this.isEmailValid || !this.loginEmail || !this.loginPassword) return;
        this.loginError = '';
        this.loginPending = true;
        this.loginService.login(this.loginEmail, this.loginPassword).subscribe(
            (response) => {
                this.loginPending = false;
                this.authService.setLoggedIn(true);

                // Home already handles the unlinked Player state. Navigation loads
                // the authorized league list as part of the account session.
                this.loginService.getUsersRole().subscribe({
                    next: ({ role }) => {
                        if (role === 'Admin' || role === 'Manager') this.router.navigate(['/scrambler']);
                    },
                    error: () => this.showSnackBar('Unable to load account permissions. Please try again.', true)
                });
            },
            (error) => {
                this.loginPending = false;
                this.loginError = error.status === 429
                    ? 'Too many attempts. Please try again in 15 minutes.'
                    : error.status === 400 || error.status === 401
                        ? 'Invalid email or password.'
                        : 'Unable to sign in. Please try again.';
            }
        );
    }




    toggleRegistrationForm() {
        this.showRegistrationForm = true;
        this.showLoginForm = false;
    }

    toggleLoginForm() {
        this.loginError = '';
        this.showLoginForm = true;
        this.showRegistrationForm =false;
    }

    register() {
        if (this.registrationPending || this.claimDialogRef) return;
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
        this.registrationPending = true;
        this.loginService.register(
            this.registerForm.get('registerEmail').value,
            password,
            this.registerForm.get('registerFirstName').value,
            this.registerForm.get('registerLastName').value
        ).subscribe(
            (response) => {
                // After a successful registration, show the snackbar.
                this.registrationPending = false;
                this.userId = response.userId;
                this.showLoginForm = true;
                this.showRegistrationForm = false;

                this.openClaimModal(true);
            },
            (error) => {
                // Handle registration error
                this.registrationPending = false;
                this.showSnackBar('Unable to register. Check your details or use Forgot Password.', true); // Show fail message
            }
        );
    }

    markFormGroupTouched(formGroup: UntypedFormGroup) {
        Object.values(formGroup.controls).forEach(control => {
            control.markAsTouched();
            if (control instanceof UntypedFormGroup) {
                this.markFormGroupTouched(control);
            }
        });
    }


    addPlayerForm = this.fb.group({
        firstName: ['', [Validators.required, Validators.maxLength(100)]],
        lastName: ['', [Validators.required, Validators.maxLength(100)]],
        gender: ['', Validators.required]
    });

    openClaimModal(onboarding = false): void {
        if (this.claimDialogRef) return;
        const first = onboarding ? this.registerForm.get('registerFirstName').value : '';
        const last = onboarding ? this.registerForm.get('registerLastName').value : '';
        this.searchTerm = (first + ' ' + last).trim();
        this.addPlayerForm.reset({ firstName: first, lastName: last, gender: '' });
        this.claimStep = 'search';
        this.recoveryProfile = null;
        this.selectedPlayer = null;
        const ref = this.dialog.open(this.claimProfileDialog, { width: '470px', maxWidth: '94vw', restoreFocus: true });
        this.claimDialogRef = ref;
        const viewport = window.visualViewport;
        const resize = () => {
            const reduced = viewport && viewport.height < window.innerHeight - 60;
            this.claimViewportLimit.set(reduced ? Math.floor(viewport.height * .92) + 'px' : null);
            ref.updatePosition(reduced ? { top: Math.round(viewport.offsetTop + viewport.height * .04) + 'px' } : {});
        };
        viewport?.addEventListener('resize', resize);
        viewport?.addEventListener('scroll', resize);
        resize();
        ref.afterClosed().subscribe(() => {
            viewport?.removeEventListener('resize', resize);
            viewport?.removeEventListener('scroll', resize);
            this.cancelClaimSearch();
            this.claimDialogRef = null;
            if (onboarding) {
                this.userId = undefined;
                this.loginService.logout().subscribe({
                    next: () => this.authService.setLoggedIn(false),
                    error: () => this.showSnackBar('Sign out before signing in to a different account.', true)
                });
            }
        });
        this.loadClaimResults();
    }

    private cancelClaimSearch(): void {
        clearTimeout(this.claimSearchTimer);
        this.claimSearch?.unsubscribe();
    }

    queueClaimSearch(search: string): void {
        this.searchTerm = search;
        this.cancelClaimSearch();
        this.selectedPlayer = null;
        this.claimResults = [];
        this.claimedExactMatch = false;
        this.claimedProfiles = [];
        this.claimError = '';
        this.searchLoading = true;
        this.claimSearchTimer = setTimeout(() => this.loadClaimResults(), 250);
    }

    loadClaimResults(): void {
        this.cancelClaimSearch();
        this.claimError = '';
        this.selectedPlayer = null;
        this.claimResults = [];
        this.claimedExactMatch = false;
        this.claimedProfiles = [];
        this.searchLoading = true;
        this.claimSearch = this.playerService.claimablePlayers(this.searchTerm).subscribe({
            next: result => {
                this.claimResults = result.players;
                this.claimedExactMatch = result.claimedExactMatch;
                this.claimedProfiles = result.claimedProfiles ?? [];
                this.searchLoading = false;
            },
            error: () => {
                this.searchLoading = false;
                this.claimError = 'Unable to load player profiles. Try again.';
            }
        });
    }

    openRecovery(profile: ProfileMatch | null): void {
        this.recoveryProfile = profile;
        this.setClaimStep('recover');
    }

    setClaimStep(step: 'search' | 'create' | 'recover'): void {
        this.claimStep = step;
        this.claimError = '';
    }

    claimSelectedPlayer(): void {
        if (this.claimPending || !this.selectedPlayer) return;
        this.finishClaim(this.playerService.claimPlayer({ playerId: this.selectedPlayer.id }));
    }

    addPlayer(): void {
        if (this.claimPending || this.addPlayerForm.invalid) return;
        this.finishClaim(this.playerService.createAndClaimPlayer(this.addPlayerForm.value));
    }

    private finishClaim(request: import('rxjs').Observable<unknown>): void {
        this.claimPending = true;
        this.claimError = '';
        const ref = this.claimDialogRef;
        ref.disableClose = true;
        request.subscribe({
            next: () => {
                this.claimPending = false;
                ref.close();
                if (!this.userId) this.authService.restoreSession();
                this.showSnackBar('Player profile linked to your account.');
            },
            error: error => {
                this.claimPending = false;
                ref.disableClose = false;
                if (error.status === 409 && this.claimStep === 'search') this.loadClaimResults();
                this.claimError = error.status === 409 ? 'This profile is no longer available. Search again or use Account Recovery.' :
                    'Unable to link the profile. Check your details and try again.';
            }
        });
    }

    openClaimPasswordReset(): void {
        const ref = this.claimDialogRef;
        ref.afterClosed().subscribe(() => this.openForgotPasswordDialog());
        ref.close();
    }

    cancel() {
        this.loginError = '';
        this.loginPassword = '';
        this.showLoginForm = false;
        this.showRegistrationForm = false;
    }


    showSnackBar(message: string, error: boolean = false) {
        const config = new MatSnackBarConfig();
        config.verticalPosition = 'top'; // Set the vertical position to center
        config.horizontalPosition = 'center'; // Set the horizontal position to center
        config.duration = 3000;
        config.panelClass = 'custom-snackbar';
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

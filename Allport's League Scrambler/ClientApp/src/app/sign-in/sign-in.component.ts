import { Component, DestroyRef, OnInit, ViewChild, TemplateRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, forkJoin, interval, of, Subscription, switchMap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { UntypedFormGroup, UntypedFormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LeagueAttendanceAvailability, LeagueAttendanceMode, PlayerService } from '../services/player.service';
import { TournamentNotifications } from '../tournament-notifications.service';
import { PlayerSignIn } from '../data-models/playerSignIn.model';
import { Leagues } from '../data-models/leagues.model';
import { PlayerSignInResult } from '../data-models/playerSignInResult.model';
import { StatisticsService } from '../services/statistics.service';
import { Player } from '../data-models/player.model';
import { LoginService } from '../services/login.service';
import { LeagueService } from '../services/league.service';
import { AuthService } from '../auth.service';

interface BulkAttendancePreview {
    leagueName: string;
    date: string;
    signedIn: number;
    additional: number;
    records: number;
    lockedReason: string | null;
    version: string;
}

@Component({
    selector: 'app-sign-in',
    templateUrl: './sign-in.component.html',
    styleUrls: ['./sign-in.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SignInComponent implements OnInit {
    @ViewChild('bulkDialog', { static: true }) bulkDialog!: TemplateRef<unknown>;
    @ViewChild('confirmationDialog', { static: true }) confirmationDialog!: TemplateRef<any>;
    dialogRef!: MatDialogRef<any>;
    playerId: number | null = null;
    leaguesAvailable: Leagues[] = []; // Available leagues
    selectedLeague: Leagues | null = null; // Selected league
    players: any[] = [];
    showAddPlayerForm: boolean = false;
    playerSignIn: any[] = []; 
    filteredPlayers: any[] = [];
    isSignInLocked = true;
    availability: LeagueAttendanceAvailability;
    savingSignInMode = false;
    readonly playerMode = this.route.snapshot.data['playerMode'] === true;
    private readonly routeLeagueId = Number(this.route.snapshot.queryParamMap.get('leagueId'));
    private roster: Player[] = [];
    private readonly attendanceLeague = new BehaviorSubject<number | null>(null);
    search = '';
    signedInSearch = '';
    private availableSearch = '';
    bulkBusy = false;
    bulkError = '';
    bulkText = '';
    bulkOperation: 'sign-in' | 'remove';
    bulkPreview: BulkAttendancePreview;
    private bulkDialogRef: MatDialogRef<unknown>;
    visibleRoster: Player[] = [];
    signedInPlayers: PlayerSignInResult[] = [];
    signingIn = false;
    private playerIdentityReady = false;
    fullscreenAvailable = document.fullscreenEnabled;
    userRole: string; // To store the role of the user
    canManageAttendance = false;
    isLoggedIn: boolean = false;
    maleCount: number = 0;
    femaleCount: number = 0;
    player: Player | null = null;
    isPlayerSignedIn: boolean = false;  // Track if the player is signed in
    currentPlayerId: number;  
    private signInNotice: MatSnackBarRef<SimpleSnackBar>;
    attendanceLoading = false;
    attendanceError = '';
    private attendanceRequest: Subscription;
    private loadedLeague: number | null = null;
    PlayerForm = new UntypedFormGroup({
        firstName: new UntypedFormControl(),
        lastName: new UntypedFormControl(),
        isMale: new UntypedFormControl('Male'),
        leagueName: new UntypedFormControl()
    });


    constructor(private playerService: PlayerService, private loginService: LoginService, private authService: AuthService,
        private leagueService: LeagueService, private http: HttpClient, private snackBar: MatSnackBar, private dialog: MatDialog,
        private destroyRef: DestroyRef, private notifications: TournamentNotifications, private route: ActivatedRoute, private router: Router) {
        this.destroyRef.onDestroy(() => this.signInNotice?.dismiss());
    }

    ngOnInit() {
        this.loadLeagues();
        combineLatest([this.authService.isLoggedIn$, this.attendanceLeague]).pipe(
            switchMap(([loggedIn, leagueId]) => {
                this.isLoggedIn = loggedIn;
                this.playerIdentityReady = false;
                this.canManageAttendance = false;
                return loggedIn ? this.loginService.getManagementAccess(leagueId)
                    : of({ role: '', canManage: false });
            }),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(access => {
            const shouldLoadProfile = access.role === 'Player' && this.userRole !== 'Player';
            this.userRole = access.role;
            this.playerIdentityReady = !this.isLoggedIn || !!access.role;
            this.canManageAttendance = access.canManage;
            if (!access.canManage) this.showAddPlayerForm = false;
            if (shouldLoadProfile) this.loadPlayerIdForUser();
        });
        if (this.playerMode) {
            interval(10000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
                if (!this.signingIn && (!this.attendanceRequest || this.attendanceRequest.closed)) this.loadAttendance();
            });
        }
        this.leagueService.selectedLeague$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(selectedLeague => {
            if (selectedLeague.leagueId && !this.routeLeagueId) {
                this.selectedLeague = {
                    id: selectedLeague.leagueId,
                    leagueName: selectedLeague.leagueName
                };
                this.onLeagueSelect(this.selectedLeague);
            }
        });

    }

    togglePlayerSignIn(): void {
        if (this.isPlayerSignedIn) {
            const signedInPlayer = this.playerSignIn.find(
                (p) => p.playerId === this.currentPlayerId
            );

            if (signedInPlayer) {
                this.unselectPlayer(signedInPlayer, true);  // Pass `true` to skip confirmation
                this.isPlayerSignedIn = false;
            }
        } else {
            this.signInPlayer(this.player, true);
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
                        this.updatePlayerSignInStatus();
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

    setSignInMode(mode: LeagueAttendanceMode): void {
        const league = this.selectedLeague;
        if (!this.canManageAttendance || !league || this.savingSignInMode) return;
        this.savingSignInMode = true;
        this.playerService.setSignInMode(mode, league.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: state => {
                this.savingSignInMode = false;
                if (this.selectedLeague?.id !== league.id) return;
                this.applyAvailability(state);
                this.notifications.success(mode === 'automatic' ? 'Using the automatic sign-in schedule.'
                    : state.locked ? 'Sign in locked.' : 'Sign in unlocked.');
            },
            error: () => {
                this.savingSignInMode = false;
                this.notifications.error('Unable to update sign-in availability.');
            }
        });
    }

    private applyAvailability(state: LeagueAttendanceAvailability): void {
        this.availability = state;
        this.isSignInLocked = state.locked;
    }

    loadLeagues() {
        this.playerService.GetLeagues().subscribe(
            (result: Leagues[]) => {
                this.leaguesAvailable = result.filter(league => league.eventTypeId !== 2);
                const requested = this.leaguesAvailable.find(league => league.id === this.routeLeagueId);
                if (requested) this.onLeagueSelect(requested);
            },
            (error) => console.error('Error fetching leagues:', error)
        );
    }

    selectPlayer(player: any): void {
        if (this.isSignInLocked) {
            this.snackBar.open('Sign-in is currently locked.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
                panelClass: ['red-snackbar']
            });
            return;
        }

        // Player can only sign in themselves
        if (this.userRole === 'Player' && player.id !== this.playerId) {
            this.snackBar.open('You can only sign in yourself.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
                panelClass: ['red-snackbar']
            });
            return;
        }

        this.signInPlayer(player, this.playerMode);

    }

    unselectPlayer(player: any, isFromButton: boolean = false): void {
        if (this.isSignInLocked) {
            this.openDialog('Sign-in is currently locked.');
            return;
        }

        if (this.userRole === 'Player' && player.playerId !== this.playerId) {
            this.openDialog('You can only remove yourself from the sign-in list.');
            return;
        }

        if (!isFromButton) {
            this.openConfirmationDialog(
                `Remove ${player.firstName} ${player.lastName} from sign-in?`,
                () => this.removePlayerFromSignIn(player)
            );
        } else {
            this.removePlayerFromSignIn(player);
        }
    }

    private removePlayerFromSignIn(player: PlayerSignInResult): void {
        if (this.signingIn || this.bulkBusy || this.selectedLeague?.id !== player.leagueId) return;
        this.signingIn = true;
        if (this.playerMode) this.attendanceRequest?.unsubscribe();
        this.playerService.deleteSignInPlayer(player.playerSignInId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.signingIn = false;
                if (this.selectedLeague?.id !== player.leagueId) return;
                this.updateAttendance(this.playerSignIn.filter(p => p.playerSignInId !== player.playerSignInId));
                const message = `${player.firstName} ${player.lastName} has been removed.`;
                if (this.playerMode) this.notifications.success(message);
                else this.openDialog(message);
            },
            error: () => {
                this.signingIn = false;
                this.openDialog('Error removing player from sign-in.');
            }
        });
    }

    canRemoveFromTilePanel(player: PlayerSignInResult): boolean {
        return this.playerIdentityReady && (this.canManageAttendance ||
            (this.isLoggedIn && player.playerId === this.currentPlayerId));
    }

    applyFilter(filterValue: string) {
        this.availableSearch = filterValue;
        const trimmedValue = filterValue.trim().toLowerCase();
        this.filteredPlayers = this.players.filter(player =>
            player.firstName.toLowerCase().includes(trimmedValue) ||
            player.lastName.toLowerCase().includes(trimmedValue)
        );
    }

    onLeagueSelect(league: Leagues): void {
        this.selectedLeague = league;
        this.attendanceLeague.next(league.id);
        this.loadAttendance();
    }

    loadAttendance(): void {
        const league = this.selectedLeague;
        this.attendanceRequest?.unsubscribe();
        this.attendanceError = '';
        if (!league) return;
        this.attendanceLoading = this.loadedLeague !== league.id;
        this.attendanceRequest = this.playerService.getLeagueAttendanceAvailability(league.id).pipe(
            switchMap(state => forkJoin([
                of(state),
                this.playerService.GetPlayersByLeague(league.id),
                this.playerService.getSignedInPlayers(league.id, state.attendanceDate)
            ])),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: ([state, players, signedIn]) => {
                this.applyAvailability(state);
                this.roster = players.slice().sort((a, b) => a.firstName.localeCompare(b.firstName)
                    || a.lastName.localeCompare(b.lastName));
                this.updateAttendance(signedIn ?? []);
                this.loadedLeague = league.id;
                this.attendanceLoading = false;
            },
            error: () => {
                this.attendanceError = 'Unable to load the sign-in sheet.';
                this.attendanceLoading = false;
            }
        });
    }

    get hasCurrentAttendance(): boolean { return this.selectedLeague?.id === this.loadedLeague; }

    private updateAttendance(records: PlayerSignInResult[]): void {
        const signedIn = new Map<number, PlayerSignInResult>();
        for (const record of records) signedIn.set(record.playerId, record);
        this.playerSignIn = records.slice().sort((a, b) => a.firstName.localeCompare(b.firstName)
            || a.lastName.localeCompare(b.lastName));
        this.signedInPlayers = this.playerSignIn.filter(record => signedIn.get(record.playerId) === record);
        this.players = this.roster.filter(player => !signedIn.has(player.id));
        this.applyFilter(this.availableSearch);
        this.searchRoster(this.search);
        this.updatePlayerSignInStatus();
        this.updateGenderCounts();
    }

    updateGenderCounts(): void {
        const rosterIds = new Set(this.roster.map(player => player.id));
        const signedInPlayers = this.playerMode ? this.signedInPlayers
            : this.signedInPlayers.filter(record => rosterIds.has(record.playerId));
        this.maleCount = signedInPlayers.filter(player => player.gender === 'Male').length;
        this.femaleCount = signedInPlayers.filter(player => player.gender === 'Female').length;
    }

    private updatePlayerSignInStatus(): void {
        if (this.userRole === 'Player' && this.currentPlayerId) {
            // Check if the current player is in the signed-in list
            this.isPlayerSignedIn = this.playerSignIn.some(
                (player) => player.playerId === this.currentPlayerId
            );
        }
    }

    signInPlayer(player: any, isFromButton: boolean = false): void {
        if (!this.selectedLeague) {
            this.openDialog('Please select a league before signing in players.');
            return;
        }

        const now = new Date(); // Current local time
        const playerSignIn: PlayerSignIn = {
            playerSignInId: 0,
            dateTime: now, // Extract the local date part
            playerId: player.id,
            leagueId: this.selectedLeague.id
        };

        if (isFromButton) {
            this.executePlayerSignIn(playerSignIn, player);
        } else {
            this.openConfirmationDialog(
                `Sign in ${player.firstName} ${player.lastName}?`,
                () => this.executePlayerSignIn(playerSignIn, player)
            );
        }
    }

    private executePlayerSignIn(playerSignIn: PlayerSignIn, player: any): void {
        if (this.signingIn || this.bulkBusy || this.isSignInLocked) return;
        this.signingIn = true;
        if (this.playerMode) this.attendanceRequest?.unsubscribe();
        this.playerService.signInPlayer(playerSignIn).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
            (result: PlayerSignInResult) => {
                this.signingIn = false;
                if (this.selectedLeague?.id !== result.leagueId) return;
                this.updateAttendance([...this.playerSignIn, result]);
                if (this.playerMode) {
                    this.notifications.success(`${player.firstName} ${player.lastName} has been signed in.`);
                } else {
                    this.signInNotice?.dismiss();
                    this.signInNotice = this.snackBar.open(`${player.firstName} ${player.lastName} has been signed in.`, 'OK', {
                        duration: 3000, panelClass: ['custom-snackbar'], horizontalPosition: 'center'
                    });
                }
            },
            (error) => {
                this.signingIn = false;
                console.error('Error signing in player:', error);
                if (error.status === 423) {
                    this.isSignInLocked = true;
                    this.loadAttendance();
                    this.openDialog('Sign-in is currently locked for this league.');
                } else if (error.status === 409) {
                    this.openDialog('This player is already signed in for today.');
                    this.loadAttendance();
                } else if (error.status === 400) {
                    this.openDialog('This player is not assigned to the selected league.');
                } else {
                    this.openDialog('Unable to sign in this player. Please try again.');
                }
            }
        );
    }

    get rosterCount(): number { return this.roster.length; }
    get eligibleSignedInCount(): number { return this.roster.length - this.players.length; }

    get filteredSignedIn(): PlayerSignInResult[] {
        const terms = this.signedInSearch.trim().toLocaleLowerCase().split(/\s+/);
        return this.signedInSearch ? this.signedInPlayers.filter(player => {
            const name = `${player.firstName} ${player.lastName}`.toLocaleLowerCase();
            return terms.every(term => name.includes(term));
        }) : this.signedInPlayers;
    }

    reviewBulk(operation: 'sign-in' | 'remove'): void {
        const leagueId = this.selectedLeague?.id;
        if (!leagueId || !this.canManageAttendance || this.bulkBusy || this.signingIn) return;
        this.bulkBusy = true;
        this.http.get<BulkAttendancePreview>(`/api/LeagueAttendance/${leagueId}/bulk`)
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                next: preview => {
                    this.bulkBusy = false;
                    if (this.selectedLeague?.id !== leagueId) return;
                    this.bulkOperation = operation;
                    this.bulkPreview = preview;
                    this.bulkText = '';
                    this.bulkError = '';
                    this.bulkDialogRef = this.dialog.open(this.bulkDialog, {
                        data: leagueId, width: '32rem', autoFocus: 'first-header', disableClose: true
                    });
                },
                error: () => {
                    this.bulkBusy = false;
                    this.notifications.error('Could not load current attendance. Try again.');
                }
            });
    }

    confirmBulk(leagueId: number): void {
        if (this.bulkBusy || leagueId !== this.selectedLeague?.id || this.bulkError) return;
        this.bulkBusy = true;
        this.attendanceRequest?.unsubscribe();
        this.http.post<{ affected: number }>(`/api/LeagueAttendance/${leagueId}/bulk`, {
            operation: this.bulkOperation, version: this.bulkPreview.version, text: this.bulkText
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: result => {
                this.bulkBusy = false;
                this.bulkDialogRef.close();
                this.loadAttendance();
                this.notifications.success(this.bulkOperation === 'remove'
                    ? `Removed ${result.affected} sign-ins.` : `Signed in ${result.affected} players.`);
            },
            error: error => {
                this.bulkBusy = false;
                this.bulkError = error.error?.message || 'Could not update attendance. Try again.';
                this.loadAttendance();
            }
        });
    }

    searchRoster(value: string): void {
        this.search = value;
        const terms = value.trim().toLocaleLowerCase().split(/\s+/);
        this.visibleRoster = this.players.filter(player => {
            const name = `${player.firstName} ${player.lastName}`.toLocaleLowerCase();
            return terms.every(term => name.includes(term));
        });
    }

    canSignInFromTile(player: Player): boolean {
        return this.playerIdentityReady && !this.isSignInLocked && !this.attendanceError && !this.signingIn
            && (this.userRole !== 'Player' || player.id === this.playerId);
    }

    async enterFullscreen(): Promise<void> {
        try { await document.documentElement.requestFullscreen(); }
        catch { this.notifications.error('Fullscreen is unavailable in this browser.'); }
    }

    async exitPlayerMode(): Promise<void> {
        if (document.fullscreenElement === document.documentElement) await document.exitFullscreen();
        await this.router.navigate(['/sign-in'], { queryParams: this.isLoggedIn ? {} : { leagueId: this.selectedLeague?.id } });
    }

    openDialog(message: string): void {
        this.dialogRef = this.dialog.open(this.confirmationDialog, {
            width: '400px',
            data: { message: message, confirm: false },
            panelClass: 'custom-dialog'
        });

        this.dialogRef.afterClosed().subscribe(result => {
            // Optional: Handle post-dialog actions here if needed
        });
    }

    openConfirmationDialog(message: string, confirmCallback: () => void): void {
        this.dialogRef = this.dialog.open(this.confirmationDialog, {
            width: '400px',
            data: { message: message, confirm: true },
            panelClass: 'custom-dialog'
        });

        this.dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirm') {
                confirmCallback();
            }
        });
    }

    onConfirm(): void {
        this.dialogRef.close('confirm');
    }

    onCancel(): void {
        this.dialogRef.close('cancel');
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
            () => this.loadAttendance(),
            (error) => console.error(error)
        );
    }
}

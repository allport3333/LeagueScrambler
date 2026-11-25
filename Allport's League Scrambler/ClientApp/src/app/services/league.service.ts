import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer } from 'rxjs';
import { LoginService } from './login.service';
import { Leagues } from '../data-models/leagues.model';
import { map, catchError, finalize, shareReplay, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../auth.service';
import { PlayerService } from './player.service';

@Injectable({
    providedIn: 'root',
})
export class LeagueService {
    private readonly selectionKey = 'league-hub-selected-league';
    private selectedLeagueSource = new BehaviorSubject<{ leagueId: number | null; leagueName: string | null }>({
        leagueId: null,
        leagueName: null,
    }); // Selected league as a BehaviorSubject
    selectedLeague$ = this.selectedLeagueSource.asObservable(); // Observable for other components to subscribe to

    leaguesAvailable: Leagues[] = [];
    private readonly authorized = new BehaviorSubject<Leagues[] | null>(null);
    readonly authorizedLeagues$ = this.authorized.asObservable();
    private navigationRevision = 0;
    private accountRevision = 0;
    private pendingLeagues?: Observable<Leagues[]>;

    constructor(private loginService: LoginService, private playerService: PlayerService, private auth: AuthService) {
        this.auth.authenticationState$.subscribe(state => {
            this.accountRevision++;
            this.pendingLeagues = undefined;
            this.authorized.next(null);
            this.leaguesAvailable = [];
            if (state === false) {
                try { sessionStorage.removeItem(this.selectionKey); } catch { /* Optional storage. */ }
                this.selectedLeagueSource.next({ leagueId: null, leagueName: null });
            }
        });
    }

    // Resolve a read-only navigation context, including an anonymous direct link.
    selectNavigationLeague(leagueId: number): Observable<boolean> {
        return defer(() => {
            const navigation = ++this.navigationRevision;
            return this.auth.isLoggedIn$.pipe(take(1), switchMap(signedIn => {
                // Authentication resolution advances the account revision, so
                // capture it after the current session has been resolved.
                const revision = this.accountRevision;
                const authorized = this.authorized.value;
                const source = signedIn
                    ? authorized === null ? this.getLeagues() : of(authorized)
                    : this.leaguesAvailable.length ? of(this.leaguesAvailable) : this.playerService.GetLeagues();
                return source.pipe(map(leagues => {
                    if (navigation !== this.navigationRevision || revision !== this.accountRevision ||
                        !leagues?.some(league => league.id === leagueId)) return false;
                    if (!signedIn) this.leaguesAvailable = leagues;
                    this.setSelectedLeague(leagueId);
                    return true;
                }));
            }), catchError(() => of(false)));
        });
    }

    // Nonredirecting session restoration; retain a still-accessible current selection.
    restoreLeagues(leagues: Leagues[], preferred?: number): void {
        this.updateAvailable(leagues);
        const current = this.selectedLeagueSource.getValue();
        let remembered: number | null = null;
        try { remembered = Number(sessionStorage.getItem(this.selectionKey)) || null; }
        catch { /* Session storage is optional. */ }
        const selected = this.leaguesAvailable.find(league => league.id === preferred)
            || this.leaguesAvailable.find(league => league.id === current.leagueId)
            || this.leaguesAvailable.find(league => league.id === remembered)
            || this.leaguesAvailable[0];
        if (selected) {
            if (selected.id !== current.leagueId || selected.leagueName !== current.leagueName) {
                this.setSelectedLeague(selected.id);
            }
        } else if (current.leagueId !== null) {
            this.selectedLeagueSource.next({ leagueId: null, leagueName: null });
        }
    }

    // Data loading must not redirect the route during session restoration. A valid
    // Admin/Manager can have leagues without a claimed player profile.
    getLeagues(): Observable<Leagues[]> {
        return defer(() => {
            if (this.pendingLeagues) return this.pendingLeagues;
            const revision = this.accountRevision;
            const request = this.loginService.getUserLeagues().pipe(
                map(leagues => {
                    if (revision !== this.accountRevision) return [];
                    this.updateAvailable(leagues);
                    return this.leaguesAvailable;
                }),
                finalize(() => { if (this.pendingLeagues === request) this.pendingLeagues = undefined; }),
                shareReplay({ bufferSize: 1, refCount: false })
            );
            this.pendingLeagues = request;
            return request;
        });
    }

    private updateAvailable(leagues: Leagues[]): void {
        this.leaguesAvailable = leagues || [];
        this.authorized.next(this.leaguesAvailable);
    }

    removeDeletedTournament(id: number): void {
        const index = this.leaguesAvailable.findIndex(league => league.id === id);
        if (index !== -1) this.updateAvailable(this.leaguesAvailable.filter(league => league.id !== id));
        try {
            if (sessionStorage.getItem(this.selectionKey) === String(id)) sessionStorage.removeItem(this.selectionKey);
            sessionStorage.removeItem('league-hub-tournament-step:' + id);
            sessionStorage.removeItem('league-hub-tournament-score-round-' + id);
            sessionStorage.removeItem('league-hub-tournament-run-view-' + id);
            sessionStorage.removeItem('league-hub-tournament-expanded-rounds-' + id);
        } catch { /* Session storage is optional. */ }
        if (this.selectedLeagueSource.getValue().leagueId === id) {
            this.selectedLeagueSource.next({ leagueId: null, leagueName: null });
        }
    }
    // Set the selected league globally
    setSelectedLeague(leagueId: number) {

        if (!this.leaguesAvailable || this.leaguesAvailable.length === 0) {

            return;
        }

        const selectedLeague = this.leaguesAvailable.find((league) => league.id === leagueId);
        if (selectedLeague) {
            const current = this.selectedLeagueSource.getValue();
            if (current.leagueId === leagueId && current.leagueName === selectedLeague.leagueName) return;
            this.navigationRevision++;
            try { sessionStorage.setItem(this.selectionKey, String(leagueId)); }
            catch { /* Session storage is optional. */ }
            this.selectedLeagueSource.next({
                leagueId: selectedLeague.id,
                leagueName: selectedLeague.leagueName,
            });
        } else {
            console.error('No league found with id:', leagueId);
        }
    }

}

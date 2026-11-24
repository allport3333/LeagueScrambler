import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginService } from './login.service';
import { Leagues } from '../data-models/leagues.model';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
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

    leaguesAvailable: Leagues[] = []; // Store fetched leagues

    constructor(private loginService: LoginService, private playerService: PlayerService) { }

    // Resolve a read-only navigation context, including an anonymous direct link.
    selectNavigationLeague(leagueId: number): Observable<boolean> {
        if (this.leaguesAvailable.length) {
            if (!this.leaguesAvailable.some(l => l.id === leagueId)) { return of(false); }
            if (this.selectedLeagueSource.getValue().leagueId !== leagueId) { this.setSelectedLeague(leagueId); }
            return of(true);
        }
        return this.playerService.GetLeagues().pipe(map(leagues => {
            if (!leagues || !leagues.some(l => l.id === leagueId)) { return false; }
            this.leaguesAvailable = leagues;
            this.setSelectedLeague(leagueId);
            return true;
        }), catchError(() => of(false)));
    }

    // Nonredirecting session restoration; retain a still-accessible current selection.
    restoreLeagues(leagues: Leagues[]): void {
        this.leaguesAvailable = leagues || [];
        const current = this.selectedLeagueSource.getValue();
        let remembered: number | null = null;
        try { remembered = Number(sessionStorage.getItem(this.selectionKey)) || null; }
        catch { /* Session storage is optional. */ }
        const selected = this.leaguesAvailable.find(league => league.id === current.leagueId)
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
        return this.loginService.getUserLeagues().pipe(map(leagues => {
            this.leaguesAvailable = leagues || [];
            return this.leaguesAvailable;
        }));
    }
    // Set the selected league globally
    setSelectedLeague(leagueId: number) {

        if (!this.leaguesAvailable || this.leaguesAvailable.length === 0) {

            return;
        }

        const selectedLeague = this.leaguesAvailable.find((league) => league.id === leagueId);
        if (selectedLeague) {
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

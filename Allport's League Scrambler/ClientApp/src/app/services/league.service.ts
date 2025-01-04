import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginService } from './login.service';
import { Leagues } from '../data-models/leagues.model';

@Injectable({
    providedIn: 'root',
})
export class LeagueService {
    private selectedLeagueSource = new BehaviorSubject<{ leagueId: number | null; leagueName: string | null }>({
        leagueId: null,
        leagueName: null,
    }); // Selected league as a BehaviorSubject
    selectedLeague$ = this.selectedLeagueSource.asObservable(); // Observable for other components to subscribe to

    leaguesAvailable: Leagues[] = []; // Store fetched leagues

    constructor(private loginService: LoginService) { }

    // Fetch leagues for the logged-in user
    getLeagues(): Observable<{ id: number; leagueName: string }[]> {
        return new Observable((observer) => {
            this.loginService.getUserLeagues().subscribe((leagueResult) => {
                this.leaguesAvailable = leagueResult.map((league) => ({
                    id: league.id,
                    leagueName: league.leagueName,
                })); // Map leagues to the required structure
                observer.next(this.leaguesAvailable); // Pass the mapped leagues to the subscriber
                observer.complete();
            });
        });
    }

    // Set the selected league globally
    setSelectedLeague(leagueId: number) {
        console.log('setSelectedLeague called with leagueId:', leagueId);

        if (!this.leaguesAvailable || this.leaguesAvailable.length === 0) {
            console.error('leaguesAvailable is not initialized or empty');
            return;
        }

        const selectedLeague = this.leaguesAvailable.find((league) => league.id === leagueId);
        console.log('Found selectedLeague:', selectedLeague);

        if (selectedLeague) {
            this.selectedLeagueSource.next({
                leagueId: selectedLeague.id,
                leagueName: selectedLeague.leagueName,
            });
            console.log('selectedLeagueSource updated:', {
                leagueId: selectedLeague.id,
                leagueName: selectedLeague.leagueName,
            });
        } else {
            console.error('No league found with id:', leagueId);
        }
    }

}

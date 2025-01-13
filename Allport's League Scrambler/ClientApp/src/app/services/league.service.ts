import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginService } from './login.service';
import { Leagues } from '../data-models/leagues.model';
import { Router } from '@angular/router';

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

    constructor(private loginService: LoginService, private router: Router) { }

    // Fetch leagues for the logged-in user
    getLeagues(): Observable<{ id: number; leagueName: string }[]> {
        return new Observable((observer) => {
            this.loginService.getUsersPlayer().subscribe(
                (playerResult) => {
                    let playerId: number | null = null;

                    if (playerResult != null) {
                        playerId = playerResult.playerId;
                    }

                    // Fetch user leagues after player is resolved
                    this.loginService.getUserLeagues().subscribe(
                        (leagueResult) => {
                            if (!leagueResult || leagueResult.length === 0) {
                                console.warn('No leagues found. Redirecting to player stats.');
                                this.router.navigate(['/player-stats', playerId]);
                                observer.complete();
                                return;
                            }

                            // Map leagues to the required structure
                            this.leaguesAvailable = leagueResult.map((league) => ({
                                id: league.id,
                                leagueName: league.leagueName,
                            }));
                            observer.next(this.leaguesAvailable); // Pass the mapped leagues to the subscriber
                            observer.complete();
                        },
                        (error) => {
                            console.error('Error fetching leagues:', error);
                            this.router.navigate(['/player-stats', playerId]);
                            observer.complete();
                        }
                    );
                },
                (error) => {
                    console.error('Error fetching player:', error);
                    this.router.navigate(['/profile']); // Navigate to profile on player fetch error
                    observer.complete();
                }
            );
        });
    }

    // Set the selected league globally
    setSelectedLeague(leagueId: number) {

        if (!this.leaguesAvailable || this.leaguesAvailable.length === 0) {

            return;
        }

        const selectedLeague = this.leaguesAvailable.find((league) => league.id === leagueId);
        if (selectedLeague) {
            this.selectedLeagueSource.next({
                leagueId: selectedLeague.id,
                leagueName: selectedLeague.leagueName,
            });
        } else {
            console.error('No league found with id:', leagueId);
        }
    }

}

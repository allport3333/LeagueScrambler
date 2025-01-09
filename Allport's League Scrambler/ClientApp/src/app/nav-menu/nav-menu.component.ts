import { Component, OnInit } from '@angular/core';
import { LoginService } from '../services/login.service';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { LeagueService } from '../services/league.service';
import { Leagues } from '../data-models/leagues.model';

@Component({
    selector: 'app-nav-menu',
    templateUrl: './nav-menu.component.html',
    styleUrls: ['./nav-menu.component.css']
})
export class NavMenuComponent implements OnInit {
    isExpanded = false;
    loggedIn = false;
    userRole: string = '';
    playerId: number | null = null;
    leagues: Leagues[] = []; // List of available leagues
    selectedLeagueId: number | null = null; // Selected league ID
    selectedLeagueName: string | null = null;

    constructor(
        private loginService: LoginService,
        private router: Router,
        private authService: AuthService,
        private leagueService: LeagueService
    ) { }

    collapse() {
        this.isExpanded = false;
    }

    toggle() {
        this.isExpanded = !this.isExpanded;
    }

    ngOnInit() {
        // Check if the user is logged in
        this.authService.isLoggedIn$.subscribe((loggedIn) => {
            this.loggedIn = loggedIn;

            if (this.loggedIn) {
                // Fetch user role
                this.loginService.getUsersRole().subscribe((result) => {
                    this.userRole = result.role; // Example: 'Admin', 'Manager', 'Player'
                });

                // Fetch user player ID
                this.loginService.getUsersPlayer().subscribe((result) => {
                    this.playerId = result.playerId; // Associated player ID
                });

                // Fetch available leagues
                this.leagueService.getLeagues().subscribe((leagues) => {
                    this.leagues = leagues;

                    if (this.leagues.length > 0) {
                        // Set the default selected league to the first league
                        const defaultLeague = this.leagues[0];
                        this.selectedLeagueId = defaultLeague.id;

                        // Notify the app of the default league
                        this.leagueService.setSelectedLeague(defaultLeague.id);
                    }
                });

                // Subscribe to selectedLeague$ to update the dropdown label
                this.leagueService.selectedLeague$.subscribe((selectedLeague) => {
                    if (selectedLeague) {
                        this.selectedLeagueId = selectedLeague.leagueId;
                        this.selectedLeagueName = selectedLeague.leagueName;
                    }
                });
            }
        });
    }


    onLeagueChange(leagueId: number) {
        const selectedLeague = this.leagues.find((league) => league.id === leagueId);
        if (selectedLeague) {
            this.selectedLeagueId = leagueId; // Update the selected league ID
            this.selectedLeagueName = selectedLeague.leagueName; // Update the name to display
            this.leagueService.setSelectedLeague(leagueId); // Update globally
        } else {
            console.error('League not found with ID:', leagueId);
        }
    }

    propagateSelectedLeague() {
        if (this.selectedLeagueId !== null) {
            this.leagueService.setSelectedLeague(this.selectedLeagueId);
        }
    }

    logoutAndNavigate() {
        this.loginService.logout().subscribe(() => {
            this.playerId = null;
            this.leagues = null;
            this.userRole = null;
            this.authService.setLoggedIn(false);
            this.router.navigate(['/']);
        });
    }
}

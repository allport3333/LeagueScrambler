import { Component, OnInit } from '@angular/core';
import { LeagueService } from '../services/league.service';
import { Leagues } from '../data-models/leagues.model';
import { Observable } from 'rxjs';
import { LoginService } from '../services/login.service';

@Component({
    selector: 'app-league-dashboard',
    templateUrl: './league-dashboard.component.html',
    styleUrls: ['./league-dashboard.component.css']
})
export class LeagueDashboardComponent implements OnInit {
    leagues$: Observable<Leagues[]>;          // Observable of all leagues
    selectedLeagueId: number | null = null;  // The chosen league's ID (or null)
    selectedLeagueName: string | null = null;
    userRole: string;
    // Suppose we have a user object or role info that determines if user is admin/manager
    isAdminOrManager = false; // Just an example—replace with real auth logic

    constructor(private leagueService: LeagueService, private loginService: LoginService) { }

    ngOnInit(): void {
        // 1) Load the leagues (the LeagueService already fetches them)
        this.leagues$ = this.leagueService.getLeagues();

        // 2) Subscribe to the current "selected league" if you want
        this.leagueService.selectedLeague$.subscribe(selected => {
            this.selectedLeagueId = selected.leagueId;
            this.selectedLeagueName = selected.leagueName;
        });

        this.loginService.getUsersRole().subscribe((roleResult) => {
            this.userRole = roleResult.role; // Assuming the API returns { role: 'Admin' }
            if (this.userRole == "Admin" || this.userRole == "Manager") {
                this.isAdminOrManager = true;
            }
        });

    }

}

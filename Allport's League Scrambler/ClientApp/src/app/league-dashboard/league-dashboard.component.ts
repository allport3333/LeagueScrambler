import { Component, OnInit } from '@angular/core';
import { LeagueService } from '../services/league.service';
import { Leagues } from '../data-models/leagues.model';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-league-dashboard',
    templateUrl: './league-dashboard.component.html',
    styleUrls: ['./league-dashboard.component.css']
})
export class LeagueDashboardComponent implements OnInit {
    leagues$: Observable<Leagues[]>;          // Observable of all leagues
    selectedLeagueId: number | null = null;  // The chosen league's ID (or null)
    selectedLeagueName: string | null = null;

    // Suppose we have a user object or role info that determines if user is admin/manager
    isAdminOrManager = false; // Just an example—replace with real auth logic

    constructor(private leagueService: LeagueService) { }

    ngOnInit(): void {
        // 1) Load the leagues (the LeagueService already fetches them)
        this.leagues$ = this.leagueService.getLeagues();

        // 2) Subscribe to the current "selected league" if you want
        this.leagueService.selectedLeague$.subscribe(selected => {
            this.selectedLeagueId = selected.leagueId;
            this.selectedLeagueName = selected.leagueName;
        });

        // 3) Set isAdminOrManager based on your actual user auth
        // For demonstration:
        this.isAdminOrManager = /*some logic*/ true;
    }

}

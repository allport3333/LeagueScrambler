import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeagueService } from '../services/league.service';

@Component({
    selector: 'app-player-stats-tabs',
    templateUrl: './player-stats-tabs.component.html',
    styleUrls: ['./player-stats-tabs.component.css']
})
export class PlayerStatsTabsComponent implements OnInit {
    playerId: number | null = null;  // The player's ID (or null)
    selectedLeagueId: number | null = null;  // The chosen league's ID (or null)
    selectedLeagueName: string | null = null;

    constructor(
        private route: ActivatedRoute,
        private leagueService: LeagueService
    ) { }

    ngOnInit() {
        // Get playerId from the route parameters
        this.route.params.subscribe(params => {
            this.playerId = +params['playerId']; // Convert 'playerId' to a number
        });

        // Subscribe to the selected league from LeagueService
        this.leagueService.selectedLeague$.subscribe(selected => {
            this.selectedLeagueId = selected.leagueId;
            this.selectedLeagueName = selected.leagueName;
        });
    }
}

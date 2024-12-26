import { Component, OnInit } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-detailed-player-stats',
  templateUrl: './detailed-player-stats.component.html',
  styleUrls: ['./detailed-player-stats.component.css']
})
export class DetailedPlayerStatsComponent implements OnInit {
    playerId: number;
    playerStats: any;
    expandedMatchup: number | null = null;
    player: any;
    playerLeagues: any[] = [];
    performanceStats: any = {
        individualRounds: [],
        scrambleTotals: [],
        totalScores: 0,
        totalWins: 0
    };
    leagues: any[] = [];
    selectedLeagueId: number | null = null;

    constructor(private statisticsService: StatisticsService, private route: ActivatedRoute) { }

    ngOnInit() {
        this.playerId = +this.route.snapshot.paramMap.get('id'); // Get 'id' from the route
        this.route.params.subscribe(params => {            
            this.playerId = params['id'];
            this.getLeagues();
            this.loadPlayerStats(this.playerId); // Load data for the new playerId
            this.loadDetailedPerformanceStats(this.selectedLeagueId);
        });
        this.getLeagues();
        this.loadPlayerStats(this.playerId);

        this.processRoundsWithDividers();
    }

    getLeagues() {
        this.statisticsService.getLeaguesForPlayer(this.playerId).subscribe(data => {
            this.leagues = data;
        });
    }

    loadPlayerStats(playerId: number) {
        this.statisticsService.getPlayerProfile(playerId).subscribe(data => {
            this.player = data;
        });

        this.statisticsService.getPlayerLeagues(playerId).subscribe(data => {
            this.playerLeagues = data;
        });
    }

    isDataRow = (index: number, item: any): boolean => {
        // This is a data row if it has a scrambleNumber
        return !!item.scrambleNumber;
    };

    isDividerRow = (index: number, item: any): boolean => {
        // This is a divider row if it doesn't have a scrambleNumber
        const current = this.performanceStats.individualRounds[index];
        const next = this.performanceStats.individualRounds[index + 1];
        return next && current.scrambleNumber !== next.scrambleNumber;
    };

    loadDetailedPerformanceStats(leagueId: number) {
        if (!this.selectedLeagueId) return;

        this.statisticsService.getDetailedPerformanceStats(this.playerId, leagueId).subscribe(data => {
            this.performanceStats = data;
            this.processRoundsWithDividers();
        });
    }

    onLeagueChange(leagueId: number) {
        this.selectedLeagueId = leagueId;
        this.loadDetailedPerformanceStats(leagueId);
    }

    processRoundsWithDividers() {
        const rounds = this.performanceStats.individualRounds || [];
        const roundsWithDividers = [];

        for (let i = 0; i < rounds.length; i++) {
            // Add the current round as a regular row
            roundsWithDividers.push({ ...rounds[i], type: 'data' });

            // Add a divider row if the scrambleNumber changes
            if (i < rounds.length - 1 && rounds[i].scrambleNumber !== rounds[i + 1].scrambleNumber) {
                roundsWithDividers.push({ type: 'divider', scrambleNumber: rounds[i].scrambleNumber });
            }
        }

        // Assign the processed data
        this.performanceStats.individualRoundsWithDividers = roundsWithDividers;
    }

    toggleTeam(scrambleNumber: number): void {
        this.expandedMatchup = this.expandedMatchup === scrambleNumber ? null : scrambleNumber;
    }

    getTeamForMatchup(scrambleNumber: number): any[] {
        const matchup = this.performanceStats.scrambleTotals.find(m => m.scrambleNumber === scrambleNumber);

        return matchup ? matchup.team : [];
    }

}

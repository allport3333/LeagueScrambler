import { Component, OnInit, Input } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { LeagueService } from '../services/league.service';

@Component({
    selector: 'app-combined-stats-tab',
    templateUrl: './combined-stats-tab.component.html',
    styleUrls: ['./combined-stats-tab.component.css']
})
export class CombinedStatsTabComponent implements OnInit {
    @Input() playerId!: number;
    @Input() leagueId!: number;
    combinedStats: any = {
        totalGames: 0,
        totalScores: 0,
        totalWins: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        winPercentage: 0,
        mostFrequentOpponent: null,
        longestWinStreak: 0,
        longestLossStreak: 0,
        totalOpponents: 0,
        leagueStats: [],
        opponentStats: [],
        teammateStats: []
    };

    constructor(private statisticsService: StatisticsService, private leagueService: LeagueService) { }

    ngOnInit() {
        this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            if (selectedLeague) {
                this.leagueId = selectedLeague.leagueId;
                this.loadCombinedStats(); 
            }
        });
        this.loadCombinedStats();
    }

    loadCombinedStats() {
        this.statisticsService.getCombinedStats(this.playerId, this.leagueId).subscribe(data => {
            this.combinedStats = data;
        });
    }
}

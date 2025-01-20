import { Component, OnInit, Input } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { LeagueService } from '../services/league.service';
import { ActivatedRoute } from '@angular/router';
import { PlayerService } from '../services/player.service';

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
    playerName: string;

    constructor(private playerService: PlayerService, private statisticsService: StatisticsService, private leagueService: LeagueService, private route: ActivatedRoute) { }

    ngOnInit() {
        this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            if (selectedLeague) {
                this.leagueId = selectedLeague.leagueId;
                this.loadCombinedStats(); 
            }
        });
        this.loadCombinedStats();
        this.route.params.subscribe(params => {
            this.playerId = +params['playerId']; // Extract playerId from the route
            this.getPlayerName(); // Fetch and set the player's name
            this.loadCombinedStats();  // Reload data for the new player
        });
    }

    getPlayerName(): void {
        this.playerService.getPlayerByPlayerIdVariable(this.playerId).subscribe(
            (player: any) => {
                this.playerName = `${player.firstName} ${player.lastName}`; // Set the full name
            },
            error => {
                console.error('Error fetching player details:', error);
                this.playerName = 'Unknown Player'; // Default name in case of an error
            }
        );
    }

    loadCombinedStats() {
        this.statisticsService.getCombinedStats(this.playerId, this.leagueId).subscribe(data => {
            this.combinedStats = data;
        });
    }
}

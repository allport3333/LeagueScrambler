import { Component, Input, OnInit } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { MatTableDataSource } from '@angular/material/table';
import { LeagueService } from '../services/league.service';
import { ActivatedRoute } from '@angular/router';
import { PlayerService } from '../services/player.service';

@Component({
    selector: 'app-league-team-player-scores',
    templateUrl: './league-team-player-scores.component.html',
    styleUrls: ['./league-team-player-scores.component.css']
})
export class LeagueTeamPlayerScoresComponent implements OnInit {
    @Input() playerId!: number;
    @Input() leagueId!: number;
    playerName: string;
    leagueScores: any[] = [];
    displayedColumns: string[] = ['date', 'opponentTeam', 'teamScore', 'wonGame'];
    dataSource = new MatTableDataSource([]);
    performanceStats = {
        totalScores: 0,
        totalWins: 0,
        totalLosses: 0
    };

    constructor(private statisticsService: StatisticsService, private leagueService: LeagueService, private route: ActivatedRoute, private playerService: PlayerService) { }

    ngOnInit() {
        if (this.playerId && this.leagueId) {
            this.loadLeagueScores(this.playerId, this.leagueId);
        }

        this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            if (selectedLeague) {
                this.leagueId = selectedLeague.leagueId;
                this.loadLeagueScores(this.playerId, this.leagueId); // Load data for the selected league
            }
        });

        this.route.params.subscribe(params => {
            this.playerId = +params['playerId']; // Extract playerId from the route
            this.getPlayerName(); // Fetch and set the player's name
            this.loadLeagueScores(this.playerId, this.leagueId);  // Reload data for the new player
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

    groupScoresByDate() {
        if (!this.dataSource || this.dataSource.data.length === 0) {

            return [];
        }

        const groupedScores = this.dataSource.data.reduce((acc, score) => {
            const dateKey = new Date(score.date).toDateString();
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(score);
            return acc;
        }, {} as { [key: string]: any[] });

        // Convert object into array for *ngFor
        return Object.keys(groupedScores).map(date => ({
            date,
            scores: groupedScores[date]
        }));
    }


    loadLeagueScores(playerId: number, leagueId: number) {
        this.statisticsService.getLeagueTeamScores(playerId, leagueId).subscribe(scores => {
            this.leagueScores = scores;
            this.dataSource.data = scores;

            // Calculate Performance Stats
            this.performanceStats.totalScores = scores.reduce((sum, score) => sum + score.teamScore, 0);
            this.performanceStats.totalWins = scores.filter(score => score.wonGame).length;
            this.performanceStats.totalLosses = scores.filter(score => !score.wonGame).length;
        });
    }
}

import { Component, Input, OnInit } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { MatTableDataSource } from '@angular/material/table';
import { LeagueService } from '../services/league.service';

@Component({
    selector: 'app-league-team-player-scores',
    templateUrl: './league-team-player-scores.component.html',
    styleUrls: ['./league-team-player-scores.component.css']
})
export class LeagueTeamPlayerScoresComponent implements OnInit {
    @Input() playerId!: number;
    @Input() leagueId!: number;

    leagueScores: any[] = [];
    displayedColumns: string[] = ['date', 'opponentTeam', 'teamScore', 'wonGame'];
    dataSource = new MatTableDataSource([]);
    performanceStats = {
        totalScores: 0,
        totalWins: 0
    };

    constructor(private statisticsService: StatisticsService, private leagueService: LeagueService) { }

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
    }

    loadLeagueScores(playerId: number, leagueId: number) {
        this.statisticsService.getLeagueTeamScores(playerId, leagueId).subscribe(scores => {
            this.leagueScores = scores;
            this.dataSource.data = scores;

            // Calculate Performance Stats
            this.performanceStats.totalScores = scores.reduce((sum, score) => sum + score.teamScore, 0);
            this.performanceStats.totalWins = scores.filter(score => score.wonGame).length;
        });
    }
}

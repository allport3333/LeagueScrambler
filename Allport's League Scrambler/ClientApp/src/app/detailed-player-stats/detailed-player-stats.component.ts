import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { ActivatedRoute } from '@angular/router';
import { MatTableDataSource, MatSort } from '@angular/material';
import { LeagueService } from '../services/league.service';

@Component({
  selector: 'app-detailed-player-stats',
  templateUrl: './detailed-player-stats.component.html',
  styleUrls: ['./detailed-player-stats.component.css']
})
export class DetailedPlayerStatsComponent implements OnInit {
    @Input() playerId!: number;
    @Input() leagueId!: number;
    showTeammates = false;
    playerStats: any;
    displayedColumns: string[] = ['playerName', 'winsTogether', 'count'];
    expandedMatchup: number | null = null;
    weekNumber: number;
    player: any;
    playerLeagues: any[] = [];
    performanceStats: any = {
        individualRounds: [],
        scrambleTotals: [],
        totalScores: 0,
        totalWins: 0,
        teammateCounts: []
    };
    sortDirection: 'asc' | 'desc' = 'asc'; // Track current sort direction
    activeSort: string = ''; // Track active column being sorted
    leagues: any[] = [];
    selectedLeagueId: number | null = null;
    selectedLeagueName: string | null = null;
    dataSource = new MatTableDataSource([]);

    @ViewChild(MatSort) sort!: MatSort;
    constructor(private statisticsService: StatisticsService, public leagueService: LeagueService, private route: ActivatedRoute) { }

    onSortDebug(event: any) {
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;

    }

    ngOnInit() {
        // Subscribe to route parameters to handle changes in playerId
        this.route.params.subscribe(params => {
            this.playerId = +params['playerId']; // Get 'id' from the route
            this.loadPlayerStats(this.playerId); // Load data for the new playerId
            this.processRoundsWithDividers(); // Process rounds after updating playerId
        });

        // Subscribe to selectedLeague$ to update stats when the league changes
        this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            if (selectedLeague) {
                this.selectedLeagueId = selectedLeague.leagueId;
                this.selectedLeagueName = selectedLeague.leagueName;
                this.loadDetailedPerformanceStats(this.selectedLeagueId); // Load data for the selected league
            }
        });
        this.route.params.subscribe(params => {
            this.playerId = +params['playerId']; // Extract playerId from the route
            this.loadDetailedPerformanceStats(this.selectedLeagueId);
        });
        // Initial call to loadPlayerStats for the playerId in the route
        this.loadPlayerStats(this.playerId);
    }


    sortData(column: string) {
        // Toggle sort direction
        if (this.activeSort === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.activeSort = column;
            this.sortDirection = 'asc'; // Default to ascending when changing column
        }

        // Perform the sorting
        const sortedData = [...this.dataSource.data].sort((a, b) => {
            const valueA = a[column];
            const valueB = b[column];

            if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        this.dataSource.data = sortedData; // Update the data source
    }

    //getLeagues() {
    //    this.statisticsService.getLeaguesForPlayer(this.playerId).subscribe(data => {
    //        this.leagues = data;
    //    });
    //}

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

    toggleTeammates(): void {
        this.showTeammates = !this.showTeammates;
    }

    loadDetailedPerformanceStats(leagueId: number) {
        if (!this.selectedLeagueId) return;

        this.statisticsService.getDetailedPerformanceStats(this.playerId, leagueId).subscribe(data => {
            this.performanceStats = data;
            this.dataSource.data = this.performanceStats.teammateCounts; // Update dataSource with teammateCounts
            this.processRoundsWithDividers(); // Keep your existing logic
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

    toggleTeam(scrambleNumber: number, weekNumber: number): void {
        this.weekNumber = weekNumber;
        this.expandedMatchup = this.expandedMatchup === scrambleNumber ? null : scrambleNumber;
    }

    getTeamForMatchup(scrambleNumber: number): any[] {
        const matchup = this.performanceStats.scrambleTotals.find(m => m.scrambleNumber === scrambleNumber);

        return matchup ? matchup.team : [];
    }

}

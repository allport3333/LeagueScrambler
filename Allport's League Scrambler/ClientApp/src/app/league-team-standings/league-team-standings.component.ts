import { Component, Input, OnInit } from '@angular/core';
import { LeagueService } from '../services/league.service';
import { StatisticsService } from '../services/statistics.service';

@Component({
    selector: 'app-league-team-standings',
    templateUrl: './league-team-standings.component.html',
    styleUrls: ['./league-team-standings.component.css']
})
export class LeagueTeamStandingsComponent implements OnInit {
    @Input() leagueId!: number; // Input from the dashboard
    standings: any[] = [];
    divisions: { [key: string]: any[] } = {}; // To group standings by division

    constructor(private statisticsService: StatisticsService, private leagueService: LeagueService) { }

    ngOnInit() {
        this.leagueService.selectedLeague$.subscribe(selectedLeague => {
            if (selectedLeague) {
                this.leagueId = selectedLeague.leagueId;
                this.loadStandings(); 
            }
        });
        if (this.leagueId) {
            this.loadStandings();
        }
    }


    loadStandings() {
        this.statisticsService.getLeagueStandings(this.leagueId).subscribe(data => {
            this.standings = data;
            this.processDivisions();
        });
    }

    getDivisionHeaderClass(divisionName: string): string {
        if (divisionName.toLowerCase().includes('gold')) {
            return 'gold-division-header';
        } else if (divisionName.toLowerCase().includes('silver')) {
            return 'silver-division-header';
        } else if (divisionName.toLowerCase().includes('bronze')) {
            return 'bronze-division-header';
        } else {
            return 'default-header';
        }
    }


    processDivisions() {
        if (!this.standings.length) {
            this.divisions = { general: [] }; // Default to an empty "general" group if no data
            return;
        }

        // Group standings by division
        this.divisions = this.standings.reduce((result: { [key: string]: any[] }, team) => {
            const division = team.division ? team.division : 'General'; // Default to "general" if division is null or empty
            if (!result[division]) {
                result[division] = [];
            }
            result[division].push(team);
            return result;
        }, {});

        // Sort each division by wins (desc), then totalPoints (desc), and assign ranks
        Object.keys(this.divisions).forEach(division => {

            // Sorting logic: First by wins (desc), then by totalPoints (desc)
            this.divisions[division] = this.divisions[division]
                .sort((a, b) => {

                    if (b.wins !== a.wins) {
                        return b.wins - a.wins; // Primary sort by wins (desc)
                    }
                    if (b.totalPoints !== a.totalPoints) {
                        return b.totalPoints - a.totalPoints; // Secondary sort by totalPoints (desc)
                    }
                    return 0; // If wins and totalPoints are equal, maintain current order
                })
                .map((team, index) => {
                    return {
                        ...team,
                        rank: index + 1 // Assign rank based on sorted position
                    };
                });

        });

    }



}

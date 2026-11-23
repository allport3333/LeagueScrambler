import { onLeagueResume } from '../pwa/pending-work.service';
import { Component, Input, OnChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';

@Component({
    selector: 'app-league-team-standings',
    templateUrl: './league-team-standings.component.html',
    styleUrls: ['./league-team-standings.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LeagueTeamStandingsComponent implements OnChanges, OnDestroy {
    @Input() leagueId!: number; // Input from the dashboard
    standings: any[] = [];
    divisions: { [key: string]: any[] } = {}; // To group standings by division

    loading = false;
    error = '';
    private request: Subscription;
    private loadedLeague: number | null = null;
    constructor(private statisticsService: StatisticsService) {
        onLeagueResume(() => { if (this.leagueId && !this.loading) this.loadStandings(); });
    }

    ngOnChanges(): void { this.loadStandings(); }
    ngOnDestroy(): void { this.request?.unsubscribe(); }

    loadStandings(): void {
        this.request?.unsubscribe();
        if (this.loadedLeague !== this.leagueId) {
            this.standings = [];
            this.divisions = {};
        }
        this.loadedLeague = this.leagueId;
        this.error = '';
        this.loading = !!this.leagueId && !this.standings.length;
        if (!this.leagueId) return;
        const failed = () => {
            this.loading = false;
            this.error = 'Unable to load standings.';
        };
        this.request = this.statisticsService.getLeagueStandings(this.leagueId).subscribe({
            next: data => {
                if (!Array.isArray(data)) { failed(); return; }
                this.standings = data;
                this.processDivisions();
                this.loading = false;
            },
            error: failed
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

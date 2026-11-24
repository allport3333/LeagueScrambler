import { Component, Input, OnInit, OnChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';
import { TeamWithPlayersDto } from '../data-models/DTOs';
import { TeamUpdateService } from '../services/team-update.service';

interface TeamDivision {
    key: string;
    label: string;
    teams: TeamWithPlayersDto[];
}

@Component({
    selector: 'app-league-teams',
    templateUrl: './league-teams.component.html',
    styleUrls: ['./league-teams.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LeagueTeamsComponent implements OnInit, OnChanges, OnDestroy {
    @Input() leagueId: number | null = null;

    divisions: TeamDivision[] = [];
    loading = false;
    error = '';
    private request: Subscription;
    private updates: Subscription;
    private loadedLeague: number | null = null;

    constructor(private statsService: StatisticsService,
        private teamUpdateService: TeamUpdateService) { }

    ngOnInit(): void {
        this.updates = this.teamUpdateService.teamUpdated$.subscribe(() => this.loadTeamsWithPlayers());
    }

    ngOnChanges(): void { this.loadTeamsWithPlayers(); }
    ngOnDestroy(): void { this.request?.unsubscribe(); this.updates?.unsubscribe(); }

    loadTeamsWithPlayers(): void {
        this.request?.unsubscribe();
        this.error = '';
        if (this.loadedLeague !== this.leagueId) this.divisions = [];
        this.loading = !!this.leagueId && this.loadedLeague !== this.leagueId;
        if (!this.leagueId) return;

        const leagueId = this.leagueId;
        this.request = this.statsService.GetAllTeamsWithPlayers(leagueId).subscribe({
            next: (res) => {
                this.loadedLeague = leagueId;
                const grouped = new Map<string, TeamDivision>();
                for (const team of res) {
                    const division = team.division?.trim() || '';
                    const key = division.toLowerCase();
                    let group = grouped.get(key);
                    if (!group) {
                        group = { key, label: division ? division + ' Division' : 'Unassigned Teams', teams: [] };
                        grouped.set(key, group);
                    }
                    group.teams.push(team);
                }
                // The API already orders divisions; keep the returned order within each group.
                this.divisions = [...grouped.values()];
                this.loading = false;
            },
            error: () => {
                this.error = 'Unable to load the league teams.';
                this.loading = false;
            }
        });
    }
}

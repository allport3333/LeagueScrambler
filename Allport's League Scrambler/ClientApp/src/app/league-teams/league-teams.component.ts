import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { TeamWithPlayersDto } from '../data-models/DTOs';

@Component({
    selector: 'app-league-teams',
    templateUrl: './league-teams.component.html',
    styleUrls: ['./league-teams.component.css']
})
export class LeagueTeamsComponent implements OnInit {
    @Input() leagueId: number | null = null;

    teams: TeamWithPlayersDto[] = [];
    loading = false;

    constructor(private statsService: StatisticsService) { }

    ngOnInit(): void {
        if (this.leagueId) {
            this.loadTeamsWithPlayers();
        }
    }

    // If leagueId can change after init, handle it:
    ngOnChanges(changes: SimpleChanges) {
        if (changes['leagueId']) {
            const newLeagueId = changes['leagueId'].currentValue;
            if (newLeagueId) {
                this.loadTeamsWithPlayers();
            }
        }
    }

    loadTeamsWithPlayers(): void {
        if (!this.leagueId) return;

        this.loading = true;
        this.statsService.GetAllTeamsWithPlayers(this.leagueId).subscribe({
            next: (res) => {
                this.teams = res.map(team => ({
                    ...team,
                    players: team.players.map(player => ({
                        ...player,
                        backgroundColor: player.isMale ? 'lightblue' : 'lightpink'
                    }))
                }));
                this.loading = false;
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
            }
        });
    }
}

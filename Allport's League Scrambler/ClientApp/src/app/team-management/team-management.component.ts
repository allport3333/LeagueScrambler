import { Component, Input, OnDestroy, OnChanges, SimpleChanges, ViewChild, TemplateRef, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { forkJoin, map, Subscription } from 'rxjs';
import { onLeagueResume, protectPendingWork } from '../pwa/pending-work.service';
import { StatisticsService } from '../services/statistics.service';
import { PlayerService } from '../services/player.service';
import { TeamUpdateService } from '../services/team-update.service';
import { TeamWithPlayersDto } from '../data-models/DTOs';
import { Player } from '../data-models/player.model';
import { ExistingPlayerBrowserComponent } from '../league-management/existing-player-browser.component';

@Component({
    selector: 'app-team-management',
    templateUrl: './team-management.component.html',
    styleUrls: ['./team-management.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamManagementComponent implements OnChanges, OnDestroy {
    @Input() leagueId: number | null = null;
    @Input() leagueName = '';
    @ViewChild('newTeamDialog') newTeamDialog: TemplateRef<unknown>;

    teams: TeamWithPlayersDto[] = [];
    private players: Player[] = [];
    divisions: string[] = [];
    divisionFilter: string | null = null;
    selectedTeamId: number | null = null;
    newTeamName = '';
    newTeamDivision = '';
    creatingTeam = false;
    creationError = '';
    notice = '';
    loadingData = false;
    dataError = '';

    private loadedLeague: number | null = null;
    private request: Subscription;
    private browser: MatDialogRef<ExistingPlayerBrowserComponent>;
    private createDialog: MatDialogRef<unknown>;
    private destroyed = false;

    constructor(private stats: StatisticsService, private playersApi: PlayerService,
        private updates: TeamUpdateService, private dialog: MatDialog) {
        protectPendingWork(() => this.creatingTeam || !!(this.createDialog && this.newTeamName.trim()) ||
            !!this.browser?.componentInstance?.pending.size);
        onLeagueResume(() => {
            if (!this.creatingTeam && !this.browser && !this.loadingData && this.request?.closed) this.loadData();
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes.leagueId) return;
        this.browser?.close();
        this.createDialog?.close();
        this.selectedTeamId = null;
        this.divisionFilter = null;
        this.notice = '';
        this.loadedLeague = null;
        this.loadData();
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.request?.unsubscribe();
        this.browser?.close();
        this.createDialog?.close();
    }

    get visibleTeams(): TeamWithPlayersDto[] {
        return this.divisionFilter === null ? this.teams : this.teams.filter(team => (team.division || '') === this.divisionFilter);
    }

    get selectedTeam(): TeamWithPlayersDto | undefined { return this.teams.find(team => team.id === this.selectedTeamId); }
    get hasCurrentLeagueData(): boolean { return !!this.leagueId && this.loadedLeague === this.leagueId; }

    loadData(): void {
        this.request?.unsubscribe();
        const leagueId = this.leagueId;
        this.dataError = '';
        this.loadingData = !!leagueId && !this.hasCurrentLeagueData;
        if (!leagueId || this.destroyed) return;
        this.request = forkJoin([
            this.stats.GetAllTeamsWithPlayers(leagueId),
            this.playersApi.leagueRosterContext(leagueId)
        ]).subscribe({
            next: ([teams, context]) => {
                if (!Array.isArray(teams) || !Array.isArray(context?.players) ||
                    !Array.isArray(context?.members) || !Array.isArray(context?.divisions)) {
                    this.loadFailed();
                    return;
                }
                this.loadedLeague = leagueId;
                this.teams = teams;
                const enrolled = new Set(context.members.map(member => member.playerId));
                this.players = context.players.filter(player => enrolled.has(player.id));
                const names: string[] = context.divisions.map(division => division.name || division.code).filter(Boolean);
                this.divisions = [...new Set([...names, ...teams.map(team => team.division || '')])];
                this.loadingData = false;
                this.selectDivision(this.divisionFilter);
            },
            error: () => this.loadFailed()
        });
    }

    private loadFailed(): void {
        this.loadingData = false;
        this.dataError = 'Unable to load league teams and players.';
    }

    selectDivision(division: string | null): void {
        this.divisionFilter = division === null || this.divisions.includes(division) ? division : null;
        if (!this.visibleTeams.some(team => team.id === this.selectedTeamId)) {
            this.selectedTeamId = this.visibleTeams[0]?.id ?? null;
        }
    }

    get teamCreationDivisions(): string[] {
        return this.divisions.some(Boolean) ? this.divisions.filter(Boolean) : ['Gold', 'Silver', 'Bronze'];
    }

    openCreate(): void {
        if (this.createDialog || this.creatingTeam) return;
        this.newTeamName = '';
        const choices = this.teamCreationDivisions;
        this.newTeamDivision = this.divisionFilter || (choices.includes('Silver') ? 'Silver' : choices[0]);
        this.creationError = '';
        const ref = this.dialog.open(this.newTeamDialog, { width: '400px', maxWidth: '94vw' });
        this.createDialog = ref;
        ref.afterClosed().subscribe(() => { if (this.createDialog === ref) this.createDialog = null; });
    }

    createTeam(): void {
        const name = this.newTeamName.trim();
        const leagueId = this.leagueId;
        const division = this.newTeamDivision;
        if (!leagueId || !name || !division || this.creatingTeam) return;
        this.creatingTeam = true;
        this.creationError = '';
        const ref = this.createDialog;
        if (ref) ref.disableClose = true;
        this.stats.AddLeagueTeam(leagueId, name, division).subscribe({
            next: team => {
                this.creatingTeam = false;
                this.updates.notifyTeamUpdate();
                if (this.destroyed || this.leagueId !== leagueId) return;
                this.teams = [...this.teams.filter(row => row.id !== team.id), { ...team, players: [] }];
                if (!this.divisions.includes(team.division)) this.divisions = [...this.divisions, team.division];
                this.divisionFilter = team.division;
                this.selectedTeamId = team.id;
                this.notice = team.teamName + ' was created.';
                ref?.close();
                this.loadData();
            },
            error: error => {
                this.creatingTeam = false;
                if (ref) ref.disableClose = false;
                if (this.leagueId === leagueId) this.creationError = error.status === 409 ?
                    'A team with that name already exists in this division.' : 'Unable to create the team. Try again.';
            }
        });
    }

    private eligiblePlayers(teams: TeamWithPlayersDto[]): Player[] {
        const assigned = new Set(teams.flatMap(team => team.players.map(player => player.id)));
        return this.players.filter(player => !assigned.has(player.id));
    }

    openPlayers(team: TeamWithPlayersDto): void {
        const leagueId = this.leagueId;
        if (!leagueId || this.browser) return;
        this.request?.unsubscribe();
        const ref = this.dialog.open(ExistingPlayerBrowserComponent, {
            width: '94vw', maxWidth: '2200px', panelClass: ['existing-player-browser-panel', 'team-player-browser-panel'],
            data: {
                leagueId, leagueName: this.leagueName,
                team: { id: team.id, name: team.teamName, division: team.division,
                    players: this.eligiblePlayers(this.teams),
                    refreshPlayers: () => this.stats.GetAllTeamsWithPlayers(leagueId).pipe(map(teams => {
                        if (!this.destroyed && this.leagueId === leagueId) this.teams = teams;
                        return this.eligiblePlayers(teams);
                    })) },
                onAdded: ({ player }: { player: Player }) => {
                    if (!this.destroyed && this.leagueId === leagueId) {
                        const current = this.teams.find(row => row.id === team.id);
                        if (current && !current.players.some(row => row.id === player.id)) {
                            this.request?.unsubscribe();
                            current.players = [...current.players, {
                                id: player.id, fullName: player.firstName + ' ' + player.lastName, isMale: player.isMale
                            }];
                        }
                    }
                    this.updates.notifyTeamUpdate();
                }
            }
        });
        this.browser = ref;
        ref.afterClosed().subscribe(() => {
            if (this.browser === ref) this.browser = null;
            if (!this.destroyed && this.leagueId === leagueId) this.loadData();
        });
    }
}

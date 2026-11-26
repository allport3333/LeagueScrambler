import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { PageLoadingComponent } from '../page-loading.component';
import { onLeagueResume } from '../pwa/pending-work.service';
/* league-standings.component.ts */

import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlayerScoresResponse, PlayerScoreGroup } from '../data-models/playerScoresResponse';
import { PlayerService } from '../services/player.service';
import { Leagues } from '../data-models/leagues.model';
import { LeagueService } from '../services/league.service';
import { LoginService } from '../services/login.service';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { transformKingQueenStandings } from './king-queen-standings';

@Component({
    selector: 'app-league-standings',
    templateUrl: './league-standings.component.html',
    styleUrls: ['../responsive-standings.css', './league-standings.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatTabsModule, PageLoadingComponent]
})
export class LeagueStandingsComponent implements OnInit {
    @Input() fixedLeagueId?: number;
    @Input() leagueName: string | null = null;

    maleStandings: PlayerScoreGroup[] | null = [];
    femaleStandings: PlayerScoreGroup[] | null = [];
    standingsRounds: number[] = [];
    standings: PlayerScoreGroup[] | null = [];
    retrievedStandingsType: string;

    sortColumn: string = '';
    readonly mobileStatistics = [
        { key: 'totalScore', label: 'King Queen Score' },
        { key: 'totalScoreBeforeReduction', label: 'Total Points' },
        { key: 'totalWins', label: 'Total Wins' }
    ] as const;

    get mobileColumns() {
        const selected = this.mobileStatistics.find(column => column.key === this.sortColumn) ?? this.mobileStatistics[0];
        return [selected, ...this.mobileStatistics.filter(column => column.key !== selected.key)];
    }

    private authorizedTournament?: Leagues;

    get returnTournament() {
        if (this.fixedLeagueId) return null;
        const event = this.authorizedTournament ?? this.leagueService.leaguesAvailable.find(item => item.id === this.selectedLeagueId && item.eventTypeId === 2);
        if (!event) return null;
        const manager = event.canManageTournament || this.userRole === 'Admin';
        if (!manager && !event.canViewTournamentRounds && this.userRole !== 'Player') return null;
        const name = /\btournament\b/i.test(event.leagueName) ? event.leagueName : event.leagueName + ' Tournament';
        const scoreRound = Number(this.route.snapshot.queryParamMap.get('returnRound'));
        const step = Number(this.route.snapshot.queryParamMap.get('returnStep'));
        const runView = this.route.snapshot.queryParamMap.get('returnView');
        return { query: manager ? { scoreRound: scoreRound > 0 ? scoreRound : undefined,
            step: step > 0 ? step : undefined, runView: ['rounds', 'scores', 'management', 'complete'].includes(runView) ? runView : undefined } : undefined, label: 'Back to ' + name + (manager ? '' : ' Matchups'),
            route: manager ? ['/tournament', event.id] : ['/tournament', event.id, 'rounds'] };
    }
    sortDirection: 'asc' | 'desc' = 'asc';

    standingsType: 'round' | 'matchup' = 'round';

    numberOfSubsAllowed: number = 100;
    subScorePercent: number = 100;
    dropLowest: number = 0;

    lastResult: PlayerScoresResponse | null = null;
    originalStandings: PlayerScoreGroup[] | null = null;
    playerLoading = false;
    standingsError = '';
    private settingsRequest: Subscription;
    private standingsRequest: Subscription;
    selectedLeagueId: number;
    userRole: string;

    // Division support
    divisions: { leagueDivisionId: number; leagueDivisionCode: string }[] = [];
    selectedDivisionId: number = 0; // 0 means "Overall" tab
    mainTabIndex: number = 0;       // 0 = Overall, 1+ = a division tab

    divisionMaleStandings: { [divisionId: number]: PlayerScoreGroup[] } = {};
    divisionFemaleStandings: { [divisionId: number]: PlayerScoreGroup[] } = {};

    // Presentation state only; desktop markup and all score calculations are unchanged.
    mobileFullTable = false;
    mobileSettingsOpen = false;
    mobileExpandedPlayers: { [key: string]: boolean } = {};
    returnGenderIndex = 0;
    private returnModeApplied = false;
    private returnTabsApplied = false;
    private navigationLeagueResolved = false;
    private navigationSubscriptions = new Subscription();

    hasSubAdjustment(score: any): boolean {
        return !!score && score.isReduced === true && score.isSubScore === true &&
            Number.isFinite(Number(score.unadjustedScore)) && Number(score.score) < Number(score.unadjustedScore);
    }
    subAdjustmentLabel(): string { return Number(this.subScorePercent) === 50 ? '½' : this.subScorePercent + '%'; }
    profileQuery(player: PlayerScoreGroup): any {
        return {leagueId:this.selectedLeagueId,tab:'kq',fromStandings:'1',standingsMode:this.standingsType,
            divisionId:this.selectedDivisionId,gender:player.isMale?'men':'women',mobileFullTable:this.mobileFullTable?'1':'0'};
    }
    scoreQuery(player: PlayerScoreGroup, score: any): any {
        return { fromStandings: '1', leagueId: this.selectedLeagueId, playerId: player.playerId,
            kingQueenTeamId: score.kingQueenTeamId, scrambleNumber: score.scrambleNumber,
            roundId: this.standingsType === 'round' ? score.roundId : null,
            standingsMode: this.standingsType, divisionId: this.selectedDivisionId,
            gender: player.isMale ? 'men' : 'women' };
    }
    canOpenScore(score: any): boolean {
        return score.hasSavedScore === true && score.kingQueenTeamId > 0 && score.scrambleNumber > 0;
    }
    ngOnDestroy() { this.navigationSubscriptions.unsubscribe(); this.settingsRequest?.unsubscribe(); this.standingsRequest?.unsubscribe(); }

    mobilePlayerKey(group: string, playerId: number): string {
        return group + '-' + playerId;
    }

    toggleMobilePlayer(group: string, playerId: number): void {
        const key = this.mobilePlayerKey(group, playerId);
        this.mobileExpandedPlayers[key] = !this.mobileExpandedPlayers[key];
    }

    sortMobileStandings(column: string): void {
        this.sortColumn = column;
        this.sortDirection = column === 'playerName' ? 'asc' : 'desc';
        this.applySort(column);
    }

    constructor(
        private playerService: PlayerService,
        private snackBar: MatSnackBar,
        public leagueService: LeagueService,
        public loginService: LoginService,
        private route: ActivatedRoute
    ) { onLeagueResume(() => { if (this.lastResult && !this.playerLoading) this.initializeStandings(); }); }

    ngOnInit(): void {
        const requestedLeague = this.fixedLeagueId ?? Number(this.route.snapshot.queryParamMap.get('leagueId'));
        const tournamentContext = this.route.snapshot.queryParamMap.get('tournament') === '1';
        if (tournamentContext && !this.fixedLeagueId && requestedLeague > 0) {
            this.navigationSubscriptions.add(this.loginService.getUserLeagues().subscribe({
                next: leagues => {
                    this.authorizedTournament = leagues.find(event => event.id === requestedLeague && event.eventTypeId === 2);
                },
                error: () => { /* Anonymous standings retain their public context. */ }
            }));
        }
        this.mobileFullTable = this.route.snapshot.queryParamMap.get('mobileFullTable') === '1';
        this.returnGenderIndex = this.route.snapshot.queryParamMap.get('gender') === 'women' ? 1 : 0;
        if (Number.isInteger(requestedLeague) && requestedLeague > 0) {
            this.navigationSubscriptions.add(this.leagueService.selectNavigationLeague(requestedLeague).subscribe(found => { if (!found) this.showStandingsError(); }));
        }
        this.loginService.getUsersRole().subscribe(
            (role) => {
                this.userRole = role.role;
            },
            (error) => {
                console.error('ngOnInit: Error fetching user role:', error);
            }
        );

        this.navigationSubscriptions.add(this.leagueService.selectedLeague$.subscribe((selectedLeague) => {
            const requestedTournament = this.leagueService.leaguesAvailable.some(event => event.id === requestedLeague && event.eventTypeId === 2);
            if ((this.fixedLeagueId || tournamentContext || requestedTournament || !this.navigationLeagueResolved) && requestedLeague > 0 && selectedLeague.leagueId !== requestedLeague) { return; }
            if (selectedLeague.leagueId) { this.navigationLeagueResolved = true; }
            this.settingsRequest?.unsubscribe();
            this.standingsRequest?.unsubscribe();
            this.standingsError = '';
            this.playerLoading = false;
            this.selectedLeagueId = selectedLeague.leagueId;
            this.standings = null;
            this.originalStandings = null;
            this.maleStandings = null;
            this.femaleStandings = null;
            this.lastResult = null;

            this.divisions = [];
            this.selectedDivisionId = 0;
            this.mainTabIndex = 0;
            this.divisionMaleStandings = {};
            this.divisionFemaleStandings = {};

            if (selectedLeague && selectedLeague.leagueId) {
                this.selectedLeagueId = selectedLeague.leagueId;
                this.leagueName = selectedLeague.leagueName;
                this.initializeSettings();
            } else {
                console.warn('No league selected.');
            }
        }));
    }

    initializeStandings(): void {
        this.standingsRequest?.unsubscribe();
        this.playerLoading = !this.lastResult;
        this.standingsError = '';
        const request = this.standingsType === 'matchup'
            ? this.playerService.getStandingsByLeagueMatchup(this.leagueName)
            : this.playerService.getStandingsByLeague(this.leagueName);
        this.standingsRequest = request.subscribe({
            next: result => {
                this.playerLoading = false;
                if (!result || !Array.isArray(result.playerScores)) {
                    this.showStandingsError();
                    return;
                }
                this.lastResult = result;
                this.processStandings(result, this.getCurrentOptions());
                this.sortStandingsWithUpdates('totalScore');
            },
            error: () => this.showStandingsError()
        });
    }

    private showStandingsError(): void {
        this.playerLoading = false;
        this.standingsError = 'Unable to load player standings.';
    }

    initializeSettings(): void {
        this.settingsRequest?.unsubscribe();
        this.standingsRequest?.unsubscribe();
        this.playerLoading = !this.lastResult;
        this.standingsError = '';
        const id = this.selectedLeagueId;
        this.settingsRequest = forkJoin([
            this.loginService.getSettingValue('numberOfSubsAllowed', id),
            this.loginService.getSettingValue('dropLowest', id),
            this.loginService.getSettingValue('subScorePercent', id),
            this.loginService.getSettingValue('standingsType', id)
        ]).subscribe({
            next: ([subs, drop, percent, mode]) => {
                this.numberOfSubsAllowed = this.parseValueAsNumber(subs, 100);
                this.dropLowest = this.parseValueAsNumber(drop, 0);
                this.subScorePercent = this.parseValueAsNumber(percent, 100);
                this.retrievedStandingsType = mode;
                const returnMode = this.route.snapshot.queryParamMap.get('standingsMode');
                if (!this.returnModeApplied && (returnMode === 'round' || returnMode === 'matchup')) {
                    this.returnModeApplied = true;
                    this.standingsType = returnMode;
                } else {
                    this.standingsType = mode === 'matchup' ? 'matchup' : 'round';
                }
                this.initializeStandings();
            },
            error: () => this.showStandingsError()
        });
    }

    private parseValueAsNumber(value: any, defaultValue: number): number {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string' && !isNaN(parseFloat(value))) {
            return parseFloat(value);
        }
        console.warn(`Value "${value}" could not be parsed as a number. Using default: ${defaultValue}`);
        return defaultValue;
    }

    toggleStandingsType(): void {
        this.standingsType = this.standingsType === 'round' ? 'matchup' : 'round';
        this.initializeStandings();
    }

    onNumberOfSubsChange(value: number): void {
        this.numberOfSubsAllowed = value;
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    onSubScorePercentChange(value: number): void {
        this.subScorePercent = value;
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    onDropLowestChange(value: number): void {
        this.dropLowest = value;
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    private getCurrentOptions(): {
        dropLowestNumber: number;
        numberOfSubsAllowed: number;
        subScorePercent: number;
    } {
        return {
            dropLowestNumber: this.dropLowest,
            numberOfSubsAllowed: this.numberOfSubsAllowed,
            subScorePercent: this.subScorePercent,
        };
    }

    private processStandings(
        result: PlayerScoresResponse | null,
        options: { dropLowestNumber: number; numberOfSubsAllowed: number; subScorePercent: number }
    ): void {
        if (result == null || result.playerScores == null) {
            this.standings = null;
            this.originalStandings = null;
            this.maleStandings = null;
            this.femaleStandings = null;

            this.divisions = [];
            this.selectedDivisionId = 0;
            this.mainTabIndex = 0;
            this.divisionMaleStandings = {};
            this.divisionFemaleStandings = {};
            return;
        }

        if (this.originalStandings == null) {
            this.originalStandings = JSON.parse(JSON.stringify(result.playerScores));
        }

        this.standings = JSON.parse(JSON.stringify(result.playerScores));

        if (this.standings == null || this.standings.length === 0) {
            this.maleStandings = [];
            this.femaleStandings = [];
            this.divisions = [];
            this.selectedDivisionId = 0;
            this.mainTabIndex = 0;
            this.divisionMaleStandings = {};
            this.divisionFemaleStandings = {};
            return;
        }

        const allPlayers = this.standings;

        const male: PlayerScoreGroup[] = [];
        const female: PlayerScoreGroup[] = [];

        for (let i = 0; i < allPlayers.length; i++) {
            const p = allPlayers[i];
            if (p != null) {
                if (p.isMale === true) {
                    male.push(p);
                } else {
                    female.push(p);
                }
            }
        }

        const transformStandings = (input: PlayerScoreGroup[]) => transformKingQueenStandings(input, options, this.standingsType, result.matchupWins);

        this.maleStandings = transformStandings(male);
        this.femaleStandings = transformStandings(female);

        // Rebuild combined standings (used for division extraction)
        const combined: PlayerScoreGroup[] = [];
        if (this.maleStandings != null) {
            for (let i = 0; i < this.maleStandings.length; i++) {
                combined.push(this.maleStandings[i]);
            }
        }
        if (this.femaleStandings != null) {
            for (let i = 0; i < this.femaleStandings.length; i++) {
                combined.push(this.femaleStandings[i]);
            }
        }
        this.standings = combined;

        this.standingsRounds = [];
        for (let i = 0; i < result.maxRounds; i++) {
            this.standingsRounds.push(i + 1);
        }

        // Build only ASSIGNED divisions (no "Unassigned" tab)
        this.buildDivisionsFromStandings();
        this.buildDivisionStandings();

        if (!this.returnTabsApplied) {
            const divisionId = Number(this.route.snapshot.queryParamMap.get('divisionId'));
            const index = this.divisions.findIndex(d => d.leagueDivisionId === divisionId);
            if (index >= 0) { this.mainTabIndex = index + 1; }
            this.returnTabsApplied = true;
        }

        // Keep whatever tab you were on, but make sure selectedDivisionId matches it
        if (this.mainTabIndex === 0) {
            this.selectedDivisionId = 0;
        } else {
            const divisionIndex = this.mainTabIndex - 1;
            if (divisionIndex >= 0 && divisionIndex < this.divisions.length) {
                this.selectedDivisionId = this.divisions[divisionIndex].leagueDivisionId;
            } else {
                this.mainTabIndex = 0;
                this.selectedDivisionId = 0;
            }
        }
    }

    private buildDivisionsFromStandings(): void {
        this.divisions = [];

        if (this.standings == null) {
            return;
        }

        const seen: { [id: number]: boolean } = {};

        for (let i = 0; i < this.standings.length; i++) {
            const player: any = this.standings[i];

            if (player != null) {
                const divisionId = player.leagueDivisionId;
                const divisionCode = player.leagueDivisionCode;

                // Ignore unassigned or missing division ids
                if (divisionId == null) {
                    continue;
                }
                if (divisionId === 0) {
                    continue;
                }

                if (seen[divisionId] === true) {
                    continue;
                }

                seen[divisionId] = true;

                let label = '';
                if (divisionCode != null && divisionCode !== '') {
                    label = divisionCode;
                } else {
                    label = 'Division ' + divisionId;
                }

                this.divisions.push({
                    leagueDivisionId: divisionId,
                    leagueDivisionCode: label
                });
            }
        }

        // Optional: stable sort by label
        this.divisions = this.divisions.slice().sort((a, b) => {
            const aVal = a.leagueDivisionCode.toLowerCase();
            const bVal = b.leagueDivisionCode.toLowerCase();
            if (aVal > bVal) { return 1; }
            if (aVal < bVal) { return -1; }
            return 0;
        });
    }

    private buildDivisionStandings(): void {
        this.divisionMaleStandings = {};
        this.divisionFemaleStandings = {};

        if (this.standings == null) {
            return;
        }

        for (let i = 0; i < this.divisions.length; i++) {
            const divisionId = this.divisions[i].leagueDivisionId;

            const divisionPlayers: PlayerScoreGroup[] = [];

            for (let j = 0; j < this.standings.length; j++) {
                const player: any = this.standings[j];

                if (player != null) {
                    if (player.leagueDivisionId === divisionId) {
                        divisionPlayers.push(this.standings[j]);
                    }
                }
            }

            const male: PlayerScoreGroup[] = [];
            const female: PlayerScoreGroup[] = [];

            for (let k = 0; k < divisionPlayers.length; k++) {
                const p = divisionPlayers[k];
                if (p != null) {
                    if (p.isMale === true) {
                        male.push(p);
                    } else {
                        female.push(p);
                    }
                }
            }

            this.divisionMaleStandings[divisionId] = male;
            this.divisionFemaleStandings[divisionId] = female;
        }
    }

    // Outer tab group: Overall + Divisions
    onMainTabChange(event: any): void {
        if (event == null) {
            return;
        }

        const index = event.index;
        if (index == null) {
            return;
        }

        this.mainTabIndex = index;

        // Overall tab
        if (index === 0) {
            this.selectedDivisionId = 0;

            if (this.sortColumn != null && this.sortColumn !== '') {
                this.sortStandingsWithUpdates(this.sortColumn);
            } else {
                this.sortStandingsWithUpdates('totalScore');
            }

            return;
        }

        // Division tab
        const divisionIndex = index - 1;

        if (divisionIndex < 0) {
            this.mainTabIndex = 0;
            this.selectedDivisionId = 0;
            return;
        }

        if (this.divisions == null) {
            this.mainTabIndex = 0;
            this.selectedDivisionId = 0;
            return;
        }

        if (divisionIndex >= this.divisions.length) {
            this.mainTabIndex = 0;
            this.selectedDivisionId = 0;
            return;
        }

        this.selectedDivisionId = this.divisions[divisionIndex].leagueDivisionId;

        if (this.sortColumn != null && this.sortColumn !== '') {
            this.sortStandingsWithUpdates(this.sortColumn);
        } else {
            this.sortStandingsWithUpdates('totalScore');
        }
    }

    // Sorting (applies to Overall tab OR currently selected division tab)
    sortStandings(column: string) {
        if (this.sortColumn === column) {
            if (this.sortDirection === 'asc') {
                this.sortDirection = 'desc';
            } else {
                this.sortDirection = 'asc';
            }
        } else {
            this.sortColumn = column;
            this.sortDirection = 'desc';
        }

        this.applySort(column);
    }

    sortStandingsWithUpdates(column: string) {
        this.sortColumn = column;
        this.sortDirection = 'desc';
        this.applySort(column);
    }

    private applySort(column: string): void {
        // Overall
        if (this.selectedDivisionId === 0) {
            this.sortOverallMale(column);
            this.sortOverallFemale(column);
            return;
        }

        // Division
        this.sortSelectedDivisionMale(column);
        this.sortSelectedDivisionFemale(column);
    }

    private sortOverallMale(column: string) {
        if (this.maleStandings == null) {
            return;
        }

        this.maleStandings = [...this.maleStandings].sort((a: any, b: any) => {
            let valueA: any = a[column];
            let valueB: any = b[column];

            if (column === 'playerName') {
                valueA = a[column].toLowerCase();
                valueB = b[column].toLowerCase();
            }

            if (this.sortDirection === 'asc') {
                if (valueA > valueB) { return 1; }
                if (valueA < valueB) { return -1; }
                return 0;
            } else {
                if (valueA < valueB) { return 1; }
                if (valueA > valueB) { return -1; }
                return 0;
            }
        });
    }

    private sortOverallFemale(column: string) {
        if (this.femaleStandings == null) {
            return;
        }

        this.femaleStandings = [...this.femaleStandings].sort((a: any, b: any) => {
            let valueA: any = a[column];
            let valueB: any = b[column];

            if (column === 'playerName') {
                valueA = a[column].toLowerCase();
                valueB = b[column].toLowerCase();
            }

            if (this.sortDirection === 'asc') {
                if (valueA > valueB) { return 1; }
                if (valueA < valueB) { return -1; }
                return 0;
            } else {
                if (valueA < valueB) { return 1; }
                if (valueA > valueB) { return -1; }
                return 0;
            }
        });
    }

    private sortSelectedDivisionMale(column: string) {
        const divisionId = this.selectedDivisionId;

        if (divisionId == null) {
            return;
        }

        if (divisionId === 0) {
            return;
        }

        if (this.divisionMaleStandings == null) {
            return;
        }

        const list = this.divisionMaleStandings[divisionId];
        if (list == null) {
            return;
        }

        this.divisionMaleStandings[divisionId] = [...list].sort((a: any, b: any) => {
            let valueA: any = a[column];
            let valueB: any = b[column];

            if (column === 'playerName') {
                valueA = a[column].toLowerCase();
                valueB = b[column].toLowerCase();
            }

            if (this.sortDirection === 'asc') {
                if (valueA > valueB) { return 1; }
                if (valueA < valueB) { return -1; }
                return 0;
            } else {
                if (valueA < valueB) { return 1; }
                if (valueA > valueB) { return -1; }
                return 0;
            }
        });
    }

    private sortSelectedDivisionFemale(column: string) {
        const divisionId = this.selectedDivisionId;

        if (divisionId == null) {
            return;
        }

        if (divisionId === 0) {
            return;
        }

        if (this.divisionFemaleStandings == null) {
            return;
        }

        const list = this.divisionFemaleStandings[divisionId];
        if (list == null) {
            return;
        }

        this.divisionFemaleStandings[divisionId] = [...list].sort((a: any, b: any) => {
            let valueA: any = a[column];
            let valueB: any = b[column];

            if (column === 'playerName') {
                valueA = a[column].toLowerCase();
                valueB = b[column].toLowerCase();
            }

            if (this.sortDirection === 'asc') {
                if (valueA > valueB) { return 1; }
                if (valueA < valueB) { return -1; }
                return 0;
            } else {
                if (valueA < valueB) { return 1; }
                if (valueA > valueB) { return -1; }
                return 0;
            }
        });
    }
}

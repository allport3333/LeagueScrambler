/* league-standings.component.ts */

import { Component, Input, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlayerScoresResponse, PlayerScoreGroup } from '../data-models/playerScoresResponse';
import { PlayerService } from '../services/player.service';
import { LeagueService } from '../services/league.service';
import { LoginService } from '../services/login.service';

@Component({
    selector: 'app-league-standings',
    templateUrl: './league-standings.component.html',
    styleUrls: ['./league-standings.component.css']
})
export class LeagueStandingsComponent implements OnInit {
    @Input() leagueName: string | null = null;

    maleStandings: PlayerScoreGroup[] | null = [];
    femaleStandings: PlayerScoreGroup[] | null = [];
    standingsRounds: number[] = [];
    standings: PlayerScoreGroup[] | null = [];
    retrievedStandingsType: string;

    sortColumn: string = '';
    sortDirection: 'asc' | 'desc' = 'asc';

    standingsType: 'round' | 'matchup' = 'round';

    numberOfSubsAllowed: number = 100;
    subScorePercent: number = 100;
    dropLowest: number = 0;

    lastResult: PlayerScoresResponse | null = null;
    originalStandings: PlayerScoreGroup[] | null = null;
    playerLoading: boolean = false;
    selectedLeagueId: number;
    userRole: string;

    // Division support
    divisions: { leagueDivisionId: number; leagueDivisionCode: string }[] = [];
    selectedDivisionId: number = 0; // 0 means "Overall" tab
    mainTabIndex: number = 0;       // 0 = Overall, 1+ = a division tab

    divisionMaleStandings: { [divisionId: number]: PlayerScoreGroup[] } = {};
    divisionFemaleStandings: { [divisionId: number]: PlayerScoreGroup[] } = {};

    constructor(
        private playerService: PlayerService,
        private snackBar: MatSnackBar,
        public leagueService: LeagueService,
        public loginService: LoginService
    ) { }

    ngOnInit(): void {
        this.loginService.getUsersRole().subscribe(
            (role) => {
                this.userRole = role.role;
            },
            (error) => {
                console.error('ngOnInit: Error fetching user role:', error);
            }
        );

        this.leagueService.selectedLeague$.subscribe((selectedLeague) => {
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

            if (selectedLeague) {
                this.selectedLeagueId = selectedLeague.leagueId;
                this.leagueName = selectedLeague.leagueName;
                this.initializeSettings();
            } else {
                console.warn('No league selected.');
            }
        });
    }

    initializeStandings(): void {
        this.playerLoading = true;

        this.playerService.getStandingsByLeague(this.leagueName).subscribe(
            (result: PlayerScoresResponse) => {
                if (result != null) {
                    this.lastResult = result;

                    this.processStandings(result, this.getCurrentOptions());

                    // Default sort
                    this.sortStandingsWithUpdates('totalScore');

                    this.playerLoading = false;
                } else {
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

                    this.playerLoading = false;
                }
            },
            error => {
                console.error('initializeStandings: Error fetching standings:', error);
                this.playerLoading = false;
            }
        );
    }

    private initializeSettings(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.loginService.getSettingValue('numberOfSubsAllowed', this.selectedLeagueId).subscribe(
                (numberOfSubsAllowedValue) => {
                    this.numberOfSubsAllowed = this.parseValueAsNumber(numberOfSubsAllowedValue, 100);

                    this.loginService.getSettingValue('dropLowest', this.selectedLeagueId).subscribe(
                        (dropLowestValue) => {
                            this.dropLowest = this.parseValueAsNumber(dropLowestValue, 0);

                            this.loginService.getSettingValue('subScorePercent', this.selectedLeagueId).subscribe(
                                (subScorePercentValue) => {
                                    this.subScorePercent = this.parseValueAsNumber(subScorePercentValue, 100);

                                    this.loginService.getSettingValue('standingsType', this.selectedLeagueId).subscribe(
                                        (newStandingsType) => {
                                            this.retrievedStandingsType = newStandingsType;

                                            if (this.retrievedStandingsType !== this.standingsType) {
                                                this.toggleStandingsType();
                                            } else {
                                                if (this.lastResult != null) {
                                                    this.processStandings(this.lastResult, this.getCurrentOptions());
                                                } else {
                                                    this.initializeStandings();
                                                }
                                            }

                                            resolve();
                                        },
                                        (error) => {
                                            console.error('Error fetching standingsType:', error);
                                            resolve();
                                        }
                                    );
                                },
                                (error) => {
                                    console.error('Error fetching subScorePercent:', error);
                                    resolve();
                                }
                            );
                        },
                        (error) => {
                            console.error('Error fetching dropLowest:', error);
                            resolve();
                        }
                    );
                },
                (error) => {
                    console.error('Error fetching numberOfSubsAllowed:', error);
                    resolve();
                }
            );
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
        if (this.standingsType === 'round') {
            this.standingsType = 'matchup';

            this.playerService.getStandingsByLeagueMatchup(this.leagueName).subscribe(
                (result: PlayerScoresResponse) => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions());
                    this.sortStandingsWithUpdates('totalScore');
                },
                error => console.error('Error fetching matchup standings:', error)
            );
        } else {
            this.standingsType = 'round';

            this.playerService.getStandingsByLeague(this.leagueName).subscribe(
                (result: PlayerScoresResponse) => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions());
                    this.sortStandingsWithUpdates('totalScore');
                },
                error => console.error('Error fetching round standings:', error)
            );
        }
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

        const transformStandings = (input: PlayerScoreGroup[]) => {
            const output: PlayerScoreGroup[] = [];

            for (let i = 0; i < input.length; i++) {
                const player = input[i];

                const updatedScores: any[] = [];
                for (let j = 0; j < player.scores.length; j++) {
                    const s: any = player.scores[j];
                    const copy = { ...s, isDropped: false, isReduced: false };
                    updatedScores.push(copy);
                }

                const subScores: any[] = [];
                for (let j = 0; j < updatedScores.length; j++) {
                    const s: any = updatedScores[j];
                    if (s.isSubScore === true) {
                        subScores.push(s);
                    }
                }

                for (let j = 0; j < subScores.length; j++) {
                    const subScore = subScores[j];

                    let isReduced = false;
                    if (j >= options.numberOfSubsAllowed) {
                        isReduced = true;
                    }

                    let index = -1;
                    for (let k = 0; k < updatedScores.length; k++) {
                        if (updatedScores[k] === subScore) {
                            index = k;
                            break;
                        }
                    }

                    if (index !== -1) {
                        let newScore = updatedScores[index].score;

                        if (isReduced === true) {
                            newScore = (updatedScores[index].score * options.subScorePercent) / 100;
                        }

                        updatedScores[index] = {
                            ...updatedScores[index],
                            score: newScore,
                            isReduced: isReduced
                        };
                    }
                }

                const sortedByScore = [...updatedScores].sort((a, b) => a.score - b.score);

                const toDrop = sortedByScore.slice(0, options.dropLowestNumber);
                for (let j = 0; j < toDrop.length; j++) {
                    const dropItem = toDrop[j];

                    let dropIndex = -1;
                    for (let k = 0; k < updatedScores.length; k++) {
                        if (updatedScores[k] === dropItem) {
                            dropIndex = k;
                            break;
                        }
                    }

                    if (dropIndex !== -1) {
                        updatedScores[dropIndex] = { ...updatedScores[dropIndex], isDropped: true };
                    }
                }

                let totalScore = 0;
                let totalWins = 0;

                for (let j = 0; j < updatedScores.length; j++) {
                    const s: any = updatedScores[j];
                    if (s.isDropped !== true) {
                        totalScore = totalScore + s.score;

                        if (s.roundWon === true) {
                            totalWins = totalWins + 1;
                        }
                    }
                }

                let totalScoreBeforeReduction = 0;
                for (let j = 0; j < player.scores.length; j++) {
                    totalScoreBeforeReduction = totalScoreBeforeReduction + (player.scores[j] as any).score;
                }

                const updatedPlayer: any = {
                    ...player,
                    scores: updatedScores,
                    totalScore: totalScore,
                    totalWins: totalWins,
                    totalScoreBeforeReduction: totalScoreBeforeReduction
                };

                output.push(updatedPlayer);
            }

            output.sort((a: any, b: any) => {
                if (this.standingsType === 'matchup') {
                    if (b.totalScore !== a.totalScore) {
                        return b.totalScore - a.totalScore;
                    }

                    if (b.totalScoreBeforeReduction !== a.totalScoreBeforeReduction) {
                        return b.totalScoreBeforeReduction - a.totalScoreBeforeReduction;
                    }

                    return b.totalWins - a.totalWins;
                } else {
                    if (b.totalScore !== a.totalScore) {
                        return b.totalScore - a.totalScore;
                    }

                    return b.totalWins - a.totalWins;
                }
            });

            return output;
        };

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

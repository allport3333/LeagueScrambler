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
    @Input() leagueName: string | null = null;  // or leagueId: number
    maleStandings: PlayerScoreGroup[] = [];
    femaleStandings: PlayerScoreGroup[] = [];
    standingsRounds: number[] = [];
    standings: PlayerScoreGroup[] = [];
    retrievedStandingsType: string;

    // Sorting
    sortColumn: string = '';
    sortDirection: 'asc' | 'desc' = 'asc';

    // Type Options
    standingsType: 'round' | 'matchup' = 'round';

    // Sub / Score Options
    numberOfSubsAllowed: number = 100;  // default
    subScorePercent: number = 100;      // default
    dropLowest: number = 0;            // default

    // Internal tracking
    lastResult: PlayerScoresResponse | null = null;
    originalStandings: PlayerScoreGroup[] | null = null;
    playerLoading: boolean = false;
    selectedLeagueId: number;
    userRole: string; // To store the role of the user
    constructor(
        private playerService: PlayerService,
        private snackBar: MatSnackBar,
        public leagueService: LeagueService,
        public loginService: LoginService
    ) { }

    ngOnInit(): void {
        // Fetch user role
        this.loginService.getUsersRole().subscribe(
            (role) => {
                this.userRole = role.role;
                // Fetch settings and standings only if leagueName is provided
                if (this.leagueName) {
                    this.awaitSettingsAndInitialize();
                }
            },
            (error) => {
                console.error('ngOnInit: Error fetching user role:', error);
            }
        );

        // Subscribe to selected league changes
        this.leagueService.selectedLeague$.subscribe((selectedLeague) => {
            this.standings = null;
            this.originalStandings = null;
            this.maleStandings = null;
            this.femaleStandings = null;
            this.lastResult = null;
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
                    this.sortStandingsWithUpdates('totalScoreBeforeReduction');
                    this.playerLoading = false;
                }
                else {
                    this.standings = null;
                    this.originalStandings = null;
                    this.maleStandings = null;
                    this.femaleStandings = null;
                    this.lastResult = null;
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
                                                this.toggleStandingsType(); // Call toggleStandingsType if it changed
                                            } else {
                                                if (this.lastResult != null) {
                                                    this.processStandings(this.lastResult, this.getCurrentOptions());
                                                }
                                                else {
                                                    this.initializeStandings();
                                                } // Call processStandings otherwise
                                            }

                                            resolve(); // All settings fetched, resolve promise
                                        },
                                        (error) => {
                                            console.error('Error fetching standingsType:', error);
                                            resolve(); // Resolve even if error occurs
                                        }
                                    );
                                },
                                (error) => {
                                    console.error('Error fetching subScorePercent:', error);
                                    resolve(); // Resolve even if error occurs
                                }
                            );
                        },
                        (error) => {
                            console.error('Error fetching dropLowest:', error);
                            resolve(); // Resolve even if error occurs
                        }
                    );
                },
                (error) => {
                    console.error('Error fetching numberOfSubsAllowed:', error);
                    resolve(); // Resolve even if error occurs
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

    private async awaitSettingsAndInitialize(): Promise<void> {
        await this.initializeSettings(); // Wait for settings initialization
    }


    toggleStandingsType(): void {
        if (this.standingsType === 'round') {
            this.standingsType = 'matchup';
            // Fetch matchup-based standings
            this.playerService.getStandingsByLeagueMatchup(this.leagueName).subscribe(
                (result: PlayerScoresResponse) => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions());
                },
                error => console.error('Error fetching matchup standings:', error)
            );
        } else {
            this.standingsType = 'round';
            // Fetch round-based standings
            this.playerService.getStandingsByLeague(this.leagueName).subscribe(
                (result: PlayerScoresResponse) => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions());
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

    // Provide current scoreboard settings
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
        if (!result || !result.playerScores) {
            this.standings = null;
            this.originalStandings = null;
            this.maleStandings = null;
            this.femaleStandings = null;
            return;
        }

        // Save original data for reference
        if (!this.originalStandings) {
            this.originalStandings = JSON.parse(JSON.stringify(result.playerScores));
        }

        this.standings = JSON.parse(JSON.stringify(result.playerScores)); // fresh copy each time
        if (this.standings && this.standings.length > 0) {
            this.maleStandings = this.standings.filter(player => player.isMale);
            this.femaleStandings = this.standings.filter(player => !player.isMale);

            // Transform each subset
            const transformStandings = (standings: PlayerScoreGroup[]) =>
                standings.map(player => {
                    const updatedScores = player.scores.map(s => ({ ...s, isDropped: false, isReduced: false }));

                    // #1: Sort subScores so only [numberOfSubsAllowed] remain full, rest get reduced
                    const subScores = updatedScores.filter(score => score.isSubScore);
                    // Sort subScores by e.g. roundId or any logic you desire
                    subScores.forEach((subScore, i) => {
                        const isReduced = i >= options.numberOfSubsAllowed;
                        const index = updatedScores.findIndex(s => s === subScore);
                        if (index !== -1) {
                            const newScore = isReduced
                                ? (updatedScores[index].score * options.subScorePercent) / 100
                                : updatedScores[index].score;
                            updatedScores[index] = {
                                ...updatedScores[index],
                                score: newScore,
                                isReduced
                            };
                        }
                    });

                    // #2: Drop the lowest [dropLowestNumber] scores
                    const sortedByScore = [...updatedScores].sort((a, b) => a.score - b.score);
                    if (sortedByScore != null) {
                        const toDrop = sortedByScore.slice(0, options.dropLowestNumber);
                        toDrop.forEach(dropItem => {
                            const dropIndex = updatedScores.findIndex(s => s === dropItem);
                            if (dropIndex !== -1) {
                                updatedScores[dropIndex] = { ...updatedScores[dropIndex], isDropped: true };
                            }
                        });
                    


                    // #3: Recompute totals
                    const totalScore = updatedScores
                        .filter(s => !s.isDropped)
                        .reduce((acc, s) => acc + s.score, 0);

                    const totalWins = updatedScores
                        .filter(s => !s.isDropped)
                        .reduce((acc, s) => acc + (s.roundWon ? 1 : 0), 0);

                    const totalScoreBeforeReduction = player.scores.reduce((acc, s) => acc + s.score, 0);

                    return {
                        ...player,
                        scores: updatedScores,
                        totalScore,
                        totalWins,
                        totalScoreBeforeReduction,
                        };
                    }
                    else {
                        return;
                    }
                }).sort((a, b) => {
                    // Sort by total wins descending, then by total score descending
                    if (b.totalWins !== a.totalWins) {
                        return b.totalWins - a.totalWins;
                    }
                    return b.totalScore - a.totalScore;
                });

            this.maleStandings = transformStandings(this.maleStandings);
            this.femaleStandings = transformStandings(this.femaleStandings);

            // Build array of round numbers
            this.standingsRounds = [];
            for (let i = 0; i < result.maxRounds; i++) {
                this.standingsRounds.push(i + 1);
            }
        }
    }

    // Sorting
    sortStandings(column: string) {
        if (this.sortColumn === column) {
            // toggle direction
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'desc';
        }
        this.sortMaleStandings(column);
        this.sortFemaleStandings(column);
    }

    sortStandingsWithUpdates(column: string) {
        this.sortDirection = 'desc';
        this.sortMaleStandings(column);
        this.sortFemaleStandings(column);
    }

    private sortMaleStandings(column: string) {
        if (this.maleStandings) {
            this.maleStandings = [...this.maleStandings].sort((a, b) => {
                const valueA = column === 'playerName' ? a[column].toLowerCase() : a[column];
                const valueB = column === 'playerName' ? b[column].toLowerCase() : b[column];
                if (this.sortDirection === 'asc') {
                    return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
                } else {
                    return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
                }
            });
        }
 
    }

    private sortFemaleStandings(column: string) {
        if (this.femaleStandings) {
            this.femaleStandings = [...this.femaleStandings].sort((a, b) => {
                const valueA = column === 'playerName' ? a[column].toLowerCase() : a[column];
                const valueB = column === 'playerName' ? b[column].toLowerCase() : b[column];
                if (this.sortDirection === 'asc') {
                    return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
                } else {
                    return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
                }
            });
        }
    }
}

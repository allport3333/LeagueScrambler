import { Component, Inject, OnInit, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteSelectedEvent, MatSelectionListChange, MatTabGroup, MatTabChangeEvent } from '@angular/material';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';
import { forEach } from '@angular/router/src/utils/collection';
import { Team } from '../data-models/teams.model';
import { Leagues } from '../data-models/leagues.model';
import { Gender } from '../data-models/gender.model';
import { Password } from '../data-models/password.model';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';
import { KingQueenTeamWithPlayers } from '../data-models/KingQueenTeamWithPlayers.model';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { LoginService } from '../services/login.service';
import { KingQueenRoundScoresResponse } from '../data-models/kingQueenRoundScoresResponse';
import { KingQueenRoundScore } from '../data-models/KingQueenRoundScore';
import { KingQueenRoundScoresRequest } from '../data-models/kingQueenRoundScoresRequest';
import { PlayerScoreGroup, PlayerScoresResponse } from '../data-models/playerScoresResponse';
import { KingQueenPlayer } from '../data-models/kingQueenPlayer.model';
import { LeagueService } from '../services/league.service';
import { KingQueenTeamsResponse } from '../data-models/kingQueenTeamsResponse';
@Component({
    selector: 'app-scrambler-component',
    templateUrl: './scrambler.component.html',
    styleUrls: ['./scrambler.component.less']
})
export class ScramblerComponent implements OnInit {
    @ViewChild('matchupDiv') matchupDiv!: ElementRef;
    @ViewChild('saveTeamsDiv') saveTeamsDiv!: ElementRef;
    @ViewChild('tabGroup') tabGroup: MatTabGroup; // ViewChild reference
    selectedRounds: number = 5; // Default to 5 rounds
    processedStandings: { playerName: string; scores: { roundId: number; score: number | string }[] }[] = [];
    rounds: number[] = [];
    searchTerm: string = '';
    searchedPlayers: any[] = [];
    selectedPlayer: any = null;
    searchTermDelete: string = '';
    leagueDay: string = 'Monday'; 
    searchedPlayersToDelete: any[] = [];
    selectedPlayerToDelete: any = null;
    private originalStandings: PlayerScoreGroup[] | null = null;
    standingsRounds: number[] = [];
    roundScores: { [teamId: number]: { RoundScore: number; RoundWon: boolean }[] } = {};
    kingQueenRoundScores: KingQueenRoundScore[] = [];
    selectedMatchupsPerPage: string = '2';
    showSaveRoundScores: boolean = false;
    allowScrambleWithNoDuplicates: boolean = false;
    retrievedPlayersBefore: boolean = false;
    scrambleSelected: boolean = false;
    showPlayerTeams = false; // Controls the visibility of the player teams section
    showTeamFormation = false; // Controls the visibility of the team formation section
    hideEverything: boolean;
    userRole: string;
    numberOfSubsAllowed: number = 100; // Default value
    dropLowest: number = 0; // Default value
    subScorePercent: number = 100; // Default value
    totalPlayers: Player[];
    players: Player[];
    selectedMalePlayers: Player[];
    byePlayers: Player[] = new Array();
    malePlayers: Player[] = new Array();
    femalePlayers: Player[] = new Array();
    malePlayersDisplayCount: Player[] = new Array();
    femalePlayersDisplayCount: Player[] = new Array();
    totalRandomPlayers: Player[] = new Array();
    displayTopPlayers: Player[] = new Array();
    totalTopPlayers: Player[] = new Array();
    totalTopPlayersTemp: Player[] = new Array();
    displayLowPlayers: Player[] = new Array();
    totalLowPlayers: Player[] = new Array();
    totalLowPlayersTemp: Player[] = new Array();
    totalPlayersTemp: Player[] = new Array();
    listOfTeams: Team[] = new Array();
    retrievedListOfTeams: Team[] = new Array();
    uniqueScrambleNumbers: number[] = [];
    matchups: Team[] = new Array();
    selectedList: Player[] = new Array();
    selectedRetrieveScrambleList: KingQueenTeam[] = new Array();
    malePlayers1: Player[] = new Array();
    femalePlayers1: Player[] = new Array();;
    queriedPlayers: Player[] = new Array();;
    queriedScrambles: KingQueenTeam[] = new Array();;
    leaguesAvailable: Leagues[] = [];
    leagueId: number;
    selectedLeagueDto: Leagues;
    gendersPossible: Gender[] = [{ value: 'Female', isMale: false }, { value: 'Male', isMale: true }];
    isSub: boolean;
    loggedIn: boolean = false;
    selectedGender: Gender;
    player: Player;
    randomMalePlayer: Player;
    randomFemalePlayer: Player;
    randomPlayer: Player;
    randomTopPlayer: Player;
    randomLowPlayer: Player;
    addedPlayer: Player;
    isActionAllowed: boolean = false;
    userInputPassword: string = '';
    password: Password;
    passwordLeague: Password;
    passwordDelete: Password;
    teamsNeededTwo: number = 0;
    teamsNeededThree: number = 0;
    teamsNeededFour: number = 0;
    remainderTwo: number = 0;
    remainderThree: number = 0;
    remainderFour: number = 0;
    listOfScrambleNumbers: number[] = [];
    listOfRetrievedScrambleNumbers: number[] = [];
    listOfByePlayers: Player[] = [];
    teamSizePossible: number[] = [2, 3, 4, 5];
    maxNumberOfTeams: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
    femalePlayerCount: number;
    malePlayerCount: number;
    topPlayerCount: number;
    lowPlayerCount: number;
    randomPlayerCount: number;
    numberOfPlayersNeededTwo: number;
    numberOfPlayersNeededThree: number;
    numberOfPlayersNeededFour: number;
    brackets: number;
    teamCount: number;
    teamSize: number;
    numberOfTeams: number;
    innerTabIndex: number = 0;
    scrambleNumber: number;
    containsMale: boolean = false;
    numberOfTeamsSelected: boolean = false;
    teamSizeSelected: boolean = true;
    containsFemale: boolean = false;
    lockedResults: boolean = false;
    locked: boolean = false;
    hidePlayers: boolean = false;
    containsLeague: boolean = false;
    showNewPlayerForm: boolean = false;
    isSmallScreen = false;
    hideListOptions: boolean;
    hideInputOptions: boolean;
    selectedOption: boolean = false;
    isMale1: boolean;
    completeRandom: false;
    playerLoading: boolean;
    lastResult: PlayerScoresResponse;
    leagueName: string;
    selectedLeague: string;
    standings: PlayerScoreGroup[];
    femaleStandings: PlayerScoreGroup[];
    maleStandings: PlayerScoreGroup[];
    retrievedStandingsType: string;
    showTeamSorting: boolean = false;
    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl(),
        leagueName: new FormControl(),
        password: new FormControl(),
        isSub: new FormControl(),
        selectedGender: new FormControl()
    });
    deletePlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        passwordDelete: new FormControl(),
    });
    LeagueForm = new FormGroup({
        newLeagueName: new FormControl(),
        passwordLeague: new FormControl()
    });

    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService, public leagueService: LeagueService, public loginService: LoginService, private snackBar: MatSnackBar) {
        this.teamSize = 4;

    }




    toggleTeamSorting(): void {
        this.showTeamSorting = !this.showTeamSorting;
    }

    switchPlayerTeam(player: any, selectedSortingId: string, currentSortingId: number): void {
        const currentTeam = this.listOfTeams.find(team => team.sortingId === currentSortingId);
        if (currentTeam) {
            currentTeam.players = currentTeam.players.filter(p => p.id !== player.id);
        }

        const newTeam = this.listOfTeams.find(team => team.sortingId === Number(selectedSortingId));
        if (newTeam) {
            newTeam.players.push(player);
        }
    }

    private initializeSettings(): void {
        this.loginService.getSettingValue('numberOfSubsAllowed', this.leagueId).subscribe(
            (numberOfSubsAllowedValue) => {
                this.numberOfSubsAllowed = this.parseValueAsNumber(numberOfSubsAllowedValue, 100); // Default is 100

                this.loginService.getSettingValue('dropLowest', this.leagueId).subscribe(
                    (dropLowestValue) => {
                        this.dropLowest = this.parseValueAsNumber(dropLowestValue, 0); // Default is 0

                        this.loginService.getSettingValue('subScorePercent', this.leagueId).subscribe(
                            (subScorePercentValue) => {
                                this.subScorePercent = this.parseValueAsNumber(subScorePercentValue, 100); // Default is 100

                                this.loginService.getSettingValue('standingsType', this.leagueId).subscribe(
                                    (newStandingsType) => {
                                        this.retrievedStandingsType = newStandingsType;
                                        if (this.retrievedStandingsType !== this.standingsType) {
                                            this.toggleStandingsType(); // Call toggleStandingsType if it changed
                                        } else {
                                            this.processStandings(this.lastResult, this.getCurrentOptions()); // Call processStandings otherwise
                                        }
                                    },
                                    (error) => console.error('Error fetching standingsType:', error)
                                );
                            },
                            (error) => console.error('Error fetching subScorePercent:', error)
                        );
                    },
                    (error) => console.error('Error fetching dropLowest:', error)
                );
            },
            (error) => console.error('Error fetching numberOfSubsAllowed:', error)
        );
    }

    private parseValueAsNumber(value: any, defaultValue: number): number {
        if (typeof value === 'number') {
            return value; // Already a number
        }
        if (typeof value === 'string' && !isNaN(parseFloat(value))) {
            return parseFloat(value); // Convert string to number
        }
        console.warn(`Value "${value}" could not be parsed as a number. Using default: ${defaultValue}`);
        return defaultValue; // Fallback to default
    }


    private async awaitSettingsAndInitialize(): Promise<void> {
        await this.initializeSettings();
    }


    swapGender(player: any): void {
        player.isMale = !player.isMale; // Toggles the value
    }

    toggleNewPlayerForm(): void {
        this.showNewPlayerForm = !this.showNewPlayerForm;
    }

    onPasswordInput(inputPassword: string): void {
        this.userInputPassword = inputPassword;
        if (
            this.passwordLeague &&
            this.userInputPassword === this.passwordLeague.password
        ) {
            this.isActionAllowed = true; // Enable button if password matches
        } else if (!this.loggedIn) {
            this.isActionAllowed = false; // Disable button if password is incorrect
        }
    }

    onSearchPlayer(event: any) {
        const value = event.target.value;
        if (value.length > 2) {
            this.playerService.searchPlayers(value).subscribe(
                (results) => (this.searchedPlayers = results),
                (error) => console.error(error)
            );
        } else {
            this.searchedPlayers = [];
        }
    }

    onPlayerSelected(player: any) {
        this.selectedPlayer = player;
    }

    onBlurPlayerInput(): void {
        if (!this.searchTerm || !this.searchedPlayers || this.searchedPlayers.length === 0) {
            this.selectedPlayer = null;
            return;
        }

        const typedText = this.searchTerm.trim().toLowerCase();

        // Find exact match in the searchedPlayers
        const matchedPlayer = this.searchedPlayers.find(player => {
            const fullName = (player.firstName + ' ' + player.lastName).toLowerCase();
            return fullName === typedText;
        });

        if (matchedPlayer) {
            this.selectedPlayer = matchedPlayer;
        } else {
            // No exact match
            this.selectedPlayer = null;
        }
    }

    onBlurDeletePlayerInput(): void {
        if (!this.searchTermDelete || !this.searchedPlayersToDelete || this.searchedPlayersToDelete.length === 0) {
            this.selectedPlayerToDelete = null;
            return;
        }

        const typedText = this.searchTermDelete.trim().toLowerCase();

        const matchedPlayer = this.searchedPlayersToDelete.find(player => {
            const fullName = (player.firstName + ' ' + player.lastName).toLowerCase();
            return fullName === typedText;
        });

        if (matchedPlayer) {
            this.selectedPlayerToDelete = matchedPlayer;
        } else {
            this.selectedPlayerToDelete = null;
        }
    }

    addExistingPlayer() {
        if (this.selectedPlayer && this.selectedLeague) {
            this.playerService
                .AddPlayer(this.selectedPlayer, this.selectedLeague)
                .subscribe(
                    (result) => {
                        this.player = result;
                        this.containsFemale = false;
                        this.containsMale = false;

                        // Check if the player already exists
                        for (var i = 0; i < this.malePlayers1.length; i++) {
                            if (
                                this.malePlayers1[i].firstName === result.firstName &&
                                this.malePlayers1[i].lastName === result.lastName
                            ) {
                                this.containsMale = true;
                                break;
                            }
                        }
                        for (var i = 0; i < this.femalePlayers1.length; i++) {
                            if (
                                this.femalePlayers1[i].firstName === result.firstName &&
                                this.femalePlayers1[i].lastName === result.lastName
                            ) {
                                this.containsFemale = true;
                                break;
                            }
                        }

                        if (this.containsMale || this.containsFemale) {
                            this.showSnackBar("Player already in the list.");
                        } else {
                            if (result.isMale) {
                                this.malePlayers1.push(result);
                                this.malePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            } else {
                                this.femalePlayers1.push(result);
                                this.femalePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            }
                            // Show success message
                            this.showSnackBar("Player added successfully!");
                        }
                    },
                    (error) => {
                        console.error(error);
                        this.showSnackBar("An error occurred while adding the player.");
                    }
                );
        } else {
            this.showSnackBar("Please select a player and a league.");
        }
    }

    displayPlayer(player: any): string {
        return player ? `${player.firstName} ${player.lastName}` : '';
    }

    onSearchPlayerToDelete(event: any) {
        const value = event.target.value;
        if (value.length > 2) {
            this.playerService.searchPlayersInLeague(value, this.selectedLeague).subscribe(
                (results) => (this.searchedPlayersToDelete = results),
                (error) => console.error(error)
            );
        } else {
            this.searchedPlayersToDelete = [];
        }
    }

    // Set the selected player to delete
    onDeletePlayerSelected(player: any) {
        this.selectedPlayerToDelete = player;
    }

    // Delete the selected player from the league
    deleteSelectedPlayer() {
        if (this.selectedPlayerToDelete && this.selectedLeague) {
            this.playerService
                .DeletePlayer(this.selectedPlayerToDelete, this.selectedLeague)
                .subscribe(
                    (result) => {
                        if (result) {
                            // Remove player from the local lists
                            const maleIndex = this.malePlayers1.findIndex(
                                (p) =>
                                    p.firstName === this.selectedPlayerToDelete.firstName &&
                                    p.lastName === this.selectedPlayerToDelete.lastName
                            );

                            if (maleIndex !== -1) {
                                this.malePlayers1.splice(maleIndex, 1);
                            }

                            const femaleIndex = this.femalePlayers1.findIndex(
                                (p) =>
                                    p.firstName === this.selectedPlayerToDelete.firstName &&
                                    p.lastName === this.selectedPlayerToDelete.lastName
                            );

                            if (femaleIndex !== -1) {
                                this.femalePlayers1.splice(femaleIndex, 1);
                            }

                            this.snackBar.open('Player deleted successfully!', 'Close', { duration: 3000 });
                        } else {
                            this.snackBar.open('Player not found in the league.', 'Close', { duration: 3000 });
                        }
                    },
                    (error) => {
                        console.error(error);
                        this.snackBar.open('An error occurred while deleting the player.', 'Close', { duration: 3000 });
                    }
                );
        } else {
            this.snackBar.open('Please select a player to delete.', 'Close', { duration: 3000 });
        }
    }


    initializeRounds(): void {
        this.rounds = Array.from({ length: this.selectedRounds }, (_, index) => index + 1);
    }

    handleDropdownChange(player: any, event: any): void {
        switch (event.value) {
            case 'setTopPlayer':
                this.addPlayerToTopPlayerList(player);
                break;
            case 'removeTopPlayer':
                this.removePlayerFromTopPlayerList(player);
                break;
            case 'setLowPlayer':
                this.addPlayerToLowPlayerList(player);
                break;
            case 'removeLowPlayer':
                this.removePlayerFromLowPlayerList(player);
                break;
            case 'setByePlayer':
                this.addPlayerToByeList(player);
                break;
            case 'removeByePlayer':
                this.removePlayerFromByeList(player);
                break;
            case 'swapGender':
                this.swapGender(player);
                break;
        }
    }

    initializeStandingsRounds(): void {
        // Flatten all scores manually and sort by roundId
        const allScores: { roundId: number; score: number }[] = [];
        this.standings.forEach(playerGroup => {
            playerGroup.scores.forEach(score => {
                allScores.push(score);
            });
        });
        const sortedRounds = Array.from(new Set(allScores.map(score => score.roundId))).sort((a, b) => a - b);

        // Determine the total rounds based on selectedRounds or maximum roundId
        const totalRounds = this.selectedRounds || Math.max(...sortedRounds);
        const rounds = [];
        for (let i = 1; i <= totalRounds; i++) {
            rounds.push(i);
        }

        // Process standings for each player
        this.processedStandings = this.standings.map(playerGroup => {
            const scores = [];
            rounds.forEach(round => {
                const matchingScore = playerGroup.scores.find(s => s.roundId === round);
                scores.push({
                    roundId: round,
                    score: matchingScore ? matchingScore.score : '-' // Default to '-' if no score exists for the round
                });
            });
            return { playerName: playerGroup.playerName, scores };
        });
        this.sortStandingsWithUpdates('totalScore');
    }


    initializeScores(): void {
        this.kingQueenRoundScores = []; // Reset the array

        for (const team of this.retrievedListOfTeams) {

            if (team.kingQueenRoundScores && team.kingQueenRoundScores.length > 0) {
                // Use existing scores if they exist
                for (let kingQueenRoundScore of team.kingQueenRoundScores) {
                    this.kingQueenRoundScores.push({
                        id: kingQueenRoundScore.id,
                        roundId: kingQueenRoundScore.roundId,
                        kingQueenTeamId: kingQueenRoundScore.kingQueenTeamId,
                        roundScore: kingQueenRoundScore.roundScore,
                        roundWon: kingQueenRoundScore.roundWon
                    });
                }
            } else {
                // Create new scores if none exist
                for (let roundIndex = 0; roundIndex < this.selectedRounds; roundIndex++) {
                    this.kingQueenRoundScores.push({
                        id: 0, // Default for new scores
                        roundId: roundIndex + 1,
                        kingQueenTeamId: team.kingQueenTeamId,
                        roundScore: 0,
                        roundWon: false
                    });
                }
            }
        }

    }


    getScore(teamId: number, roundId: number): any {
        return this.kingQueenRoundScores.find(score => score.kingQueenTeamId === teamId && score.roundId === roundId);
    }


    ngOnInit() {
        this.completeRandom = false;
        this.displayTopPlayers = [];
        this.displayLowPlayers = [];
        this.hideInputOptions = false;
        this.hideListOptions = false;
        this.hideEverything = false;
        this.checkScreenSize();

        // Subscribe to window resize events to update isSmallScreen
        window.addEventListener('resize', () => {
            this.checkScreenSize();
        });

        this.playerLoading = false;

        this.leagueService.selectedLeague$.subscribe((selectedLeague) => {
            if (selectedLeague.leagueId !== null && selectedLeague.leagueName !== null) {
                this.leagueId = selectedLeague.leagueId;                
                this.selectedLeague = selectedLeague.leagueName; // Use leagueName as needed
                this.selectedLeagueDto = {
                    id: selectedLeague.leagueId,
                    leagueName: selectedLeague.leagueName
                };


                this.onLeagueChanged();
            }
        });

        // Fetch all male players
        this.playerService.GetAllMalePlayers().subscribe(
            (result) => {
                this.malePlayers1 = result;
                this.malePlayerCount = result.length;
            },
            (error) => console.error(error)
        );

        // Fetch all female players
        this.playerService.GetAllFemalePlayers().subscribe(
            (result) => {
                this.femalePlayers1 = result;
                this.femalePlayerCount = result.length;
            },
            (error) => console.error(error)
        );

        // Fetch number of brackets
        this.playerService.GetNumberOfBrackets().subscribe(
            (result) => {
                this.brackets = result;
            },
            (error) => console.error(error)
        );

        // Fetch all players
        this.playerService.GetPlayers().subscribe(
            (result) => {
                this.totalPlayers = result;
            },
            (error) => console.error(error)
        );

        // Check login status
        this.loginService.isLoggedIn().subscribe((result) => {
            this.loggedIn = result;

            if (result) {
                // User is logged in
                this.isActionAllowed = true; // Enable action for logged-in users

                // Fetch user role
                this.loginService.getUsersRole().subscribe((roleResult) => {
                    this.userRole = roleResult.role; // Assuming the API returns { role: 'Admin' }

                });

                // Fetch user leagues
                this.leagueService.getLeagues().subscribe((leagueResult) => {
                    this.leaguesAvailable = leagueResult;
                });
            } else {
                // User is not logged in

                // Fetch password for non-logged-in users
                this.playerService.GetPassword().subscribe(
                    (passwordResult) => {
                        this.passwordLeague = passwordResult;
                    },
                    (error) => console.error(error)
                );

                // Fetch leagues for non-logged-in users
                this.playerService.GetLeagues().subscribe(
                    (leagueResult) => {
                        this.leaguesAvailable = leagueResult;
                    },
                    (error) => console.error(error)
                );
            }
        });

    }

    ngAfterViewInit() {
        // At this point, targetDiv is guaranteed to be initialized
    }

    clearStandings() {
        this.standings = [];
        this.maleStandings = [];
        this.femaleStandings = [];
        this.standingsRounds = [];
    }

    onLeagueChanged() {
        if (!this.selectedLeague) {
            return;
        }

        this.playerLoading = true;

        // Clear and reset relevant properties
        this.clearStandings();
        this.reset();

        const selectedLeague = this.leaguesAvailable.find((league) => league.leagueName === this.selectedLeague);

        if (selectedLeague) {
            this.selectedLeagueDto = selectedLeague;
            this.leagueId = selectedLeague.id;
        }

        // Fetch players for the selected league
        this.playerService.SelectLeague(this.selectedLeague).subscribe((result) => {
            this.queriedPlayers = result;
            this.malePlayers1 = result.filter((player) => player.isMale);
            this.femalePlayers1 = result.filter((player) => !player.isMale);
            this.malePlayerCount = this.malePlayers1.length;
            this.femalePlayerCount = this.femalePlayers1.length;

            this.playerLoading = false;
            this.awaitSettingsAndInitialize();
        });

        // Fetch scrambles for the selected league
        this.playerService.SelectedLeagueScrambles(this.selectedLeague).subscribe((result) => {
            this.queriedScrambles = result;
            this.playerLoading = false;
        });

        // Initialize standings
        this.initializeStandings();
    }

    selectLeague() {
        if (!this.selectedLeague) {
            return;
        }

        this.playerLoading = true;
        this.clearStandings();
        this.reset();

        const selectedLeague = this.leaguesAvailable.find((league) => league.leagueName === this.selectedLeague);

        if (selectedLeague) {
            this.selectedLeagueDto = selectedLeague;
            this.leagueId = selectedLeague.id;
        }

        this.playerService.SelectLeague(this.selectedLeague).subscribe((result) => {
            this.queriedPlayers = result;
            this.malePlayers1 = result.filter((player) => player.isMale);
            this.femalePlayers1 = result.filter((player) => !player.isMale);
            this.malePlayerCount = this.malePlayers1.length;
            this.femalePlayerCount = this.femalePlayers1.length;

            this.playerLoading = false;
            this.awaitSettingsAndInitialize();
        });

        this.playerService.SelectedLeagueScrambles(this.selectedLeague).subscribe((result) => {
            this.queriedScrambles = result;
            this.playerLoading = false;
        });

        this.initializeStandings();
    }

    getTooltipText(): string {
        if (this.allowScrambleWithNoDuplicates) {
            return ''; // Tooltip disabled when scrambling with no duplicates is allowed
        }
        if (!this.selectedList || this.selectedList.length === 0) {
            return 'Button is disabled because no players are selected.';
        }
        if (!this.retrievedPlayersBefore) {
            return 'Retrieve players first to enable this action.';
        }
        return 'Retrieve players again to re-enable this action.'; // Tooltip for re-enable state
    }

    initializeStandings(): void {
        this.playerService.getStandingsByLeague(this.selectedLeague).subscribe(
            result => {
                this.lastResult = result;

                this.processStandings(result, this.getCurrentOptions());
            },
            error => {
                console.error("Error fetching standings:", error); // Log any errors
                this.playerLoading = false; // Ensure loading state is reset
            }
        );
    }

    onTabChange(event: MatTabChangeEvent): void {
        // Check which tab was selected
        if (event.tab.textLabel === 'Manage Scores') {
            // Fetch data for Manage Scores
            this.playerService.SelectedLeagueScrambles(this.selectedLeague).subscribe(result => {
                this.queriedScrambles = result;
                this.playerLoading = false;
            });
        } else if (event.tab.textLabel === 'Standings') {
            // Initialize standings for the Standings tab
            this.innerTabIndex = 0;
            if (this.retrievedStandingsType !== this.standingsType) {
                this.toggleStandingsType(); // Call toggleStandingsType if it changed
            } else {
                this.processStandings(this.lastResult, this.getCurrentOptions()); // Call processStandings otherwise
            }
        }
    }

    standingsType: 'round' | 'matchup' = 'round'; // Default to 'round'

    toggleStandingsType(): void {
        if (this.standingsType === 'round') {
            this.standingsType = 'matchup';
            this.playerService.getStandingsByLeagueMatchup(this.selectedLeague).subscribe(
                result => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions()); // Reuse processStandings logic
                },
                error => {
                    console.error("Error fetching matchup standings:", error);
                    this.playerLoading = false;
                }
            );
        } else {
            this.standingsType = 'round';
            this.playerService.getStandingsByLeague(this.selectedLeague).subscribe(
                result => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions()); // Reuse processStandings logic
                },
                error => {
                    console.error("Error fetching round standings:", error);
                    this.playerLoading = false;
                }
            );
        }
    }

    // Method to toggle visibility
    togglePlayersVisibility(): void {
        this.showPlayerTeams = !this.showPlayerTeams;
    }

    toggleTeamFormationVisibility(): void {
        this.showTeamFormation = !this.showTeamFormation;
    }

    // Helper method to get the current options
    private getCurrentOptions(): { dropLowestNumber: number; numberOfSubsAllowed: number; subScorePercent: number } {
        return {
            dropLowestNumber: this.dropLowest,
            numberOfSubsAllowed: this.numberOfSubsAllowed,
            subScorePercent: this.subScorePercent
        };
    }

    // Handle Drop Lowest Scores change
    onDropLowestChange(selectedDrop: string): void {
        this.dropLowest = parseInt(selectedDrop, 10); // Convert the string to a number
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    // Handle Number of Subs Allowed change
    onNumberOfSubsChange(value: number): void {
        this.numberOfSubsAllowed = value;
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    // Handle Percent of Score for Subs change
    onSubScorePercentChange(value: number): void {
        this.subScorePercent = value;
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    saveSettings(): void {
        const settings = [
            { settingName: 'dropLowest', settingValue: this.dropLowest },
            { settingName: 'numberOfSubsAllowed', settingValue: this.numberOfSubsAllowed },
            { settingName: 'subScorePercent', settingValue: this.subScorePercent },
            { settingName: 'dayOfLeague', settingValue: this.leagueDay },
        ];

        // Create an array of promises for each setting update
        const updatePromises = settings.map(setting =>
            this.loginService.updateSetting(setting.settingName, setting.settingValue.toString(), this.leagueId).toPromise()
        );

        // Wait for all updates to complete
        Promise.all(updatePromises)
            .then(() => {
                this.snackBar.open('Standings have been saved.', 'OK', {
                    duration: 5000, // Optional: Auto-close after 5 seconds
                    verticalPosition: 'top',
                    horizontalPosition: 'center',
                });
            })
            .catch(error => {
                console.error('Error saving settings:', error);
            });
    }



    private processStandings(
        result: any,
        options: { dropLowestNumber?: number; numberOfSubsAllowed?: number; subScorePercent?: number } = {}
    ): void {
        if (result != null && result.message != 'No valid rounds found in the league.') {
            // Save the original scores only once
            if (!this.originalStandings) {
                if (result.playerScores != null) {
                    this.originalStandings = JSON.parse(JSON.stringify(result.playerScores)); // Deep copy to preserve original data
                }
            }

            // Reset standings to the original scores
            if (this.lastResult == null) {
                this.standings = JSON.parse(JSON.stringify(this.originalStandings));
            }
            else {
                this.standings = this.lastResult.playerScores;
            }

            if (this.standings && this.standings.length > 0) {
                // Separate standings by gender
                this.maleStandings = this.standings.filter(player => player.isMale);
                this.femaleStandings = this.standings.filter(player => !player.isMale);

                const calculateStandings = (standings: PlayerScoreGroup[]) =>
                    standings.map(player => {
                        // Create a copy of the original scores for modification
                        const updatedScores = player.scores.map(score => ({ ...score, isDropped: false, isReduced: false }));

                        const totalScoreBeforeReduction = updatedScores
                            .filter(score => !score.isDropped) // Exclude dropped scores
                            .reduce((sum, score) => sum + score.score, 0);


                        // Filter sub-scores from the updated scores
                        const subScores = updatedScores.filter(score => score.isSubScore);

                        const sortedSubScores = subScores;//subScores.slice().sort((a, b) => b.roundId - a.roundId);

                        // Adjust sub-scores beyond the allowed limit
                        sortedSubScores.forEach((subScore, subIndex) => {
                            const isReduced = subIndex >= options.numberOfSubsAllowed;
                            // Find and update the matching score in updatedScores
                            const matchingScoreIndex = updatedScores.findIndex(score => score === subScore);
                            if (matchingScoreIndex !== -1) {
                                updatedScores[matchingScoreIndex] = {
                                    ...updatedScores[matchingScoreIndex],
                                    score: isReduced
                                        ? (updatedScores[matchingScoreIndex].score * options.subScorePercent) / 100
                                        : updatedScores[matchingScoreIndex].score,
                                    isReduced: isReduced
                                };
                            }
                        });

                        // Sort scores in ascending order (after reduction) for dropping the lowest ones
                        const sortedScores = updatedScores.slice().sort((a, b) => a.score - b.score);

                        // Mark the lowest scores to drop
                        sortedScores.slice(0, options.dropLowestNumber).forEach(droppedScore => {
                            const matchingScoreIndex = updatedScores.findIndex(score => score === droppedScore);
                            if (matchingScoreIndex !== -1) {
                                updatedScores[matchingScoreIndex] = {
                                    ...updatedScores[matchingScoreIndex],
                                    isDropped: true
                                };
                            }
                        });

                        // Calculate total score
                        const totalScore = updatedScores
                            .filter(score => !score.isDropped)
                            .reduce((sum, score) => sum + score.score, 0);

                        // Calculate total wins
                        const totalWins = updatedScores
                            .filter(score => !score.isDropped)
                            .reduce((sum, score) => sum + score.roundWon, 0);

                        // Return updated player
                        return {
                            ...player,
                            scores: updatedScores, // Include updated scores with `isDropped` and `isReduced`
                            totalScore: totalScore,
                            totalWins: totalWins,
                            totalScoreBeforeReduction: totalScoreBeforeReduction
                        };
                    }).sort((a, b) => {
                        // Sort by total wins descending, then by total score descending
                        if (b.totalWins !== a.totalWins) {
                            return b.totalWins - a.totalWins;
                        }
                        return b.totalScore - a.totalScore;
                    });


                this.maleStandings = calculateStandings(this.maleStandings);
                this.femaleStandings = calculateStandings(this.femaleStandings);

                // Generate standingsRounds array
                this.standingsRounds = [];
                for (let i = 0; i < result.maxRounds; i++) {
                    this.standingsRounds.push(i + 1);
                }

                this.initializeStandingsRounds(); // Initialize rounds for standings
            }
        }
        this.playerLoading = false;
    }

    // This method should be called whenever a new `result` is received
    setNewStandings(result: any): void {
        this.originalStandings = JSON.parse(JSON.stringify(result.playerScores)); // Deep copy of initial standings
        this.processStandings(result, this.getCurrentOptions());
    }

    sortStandings(column: string) {
        if (this.sortColumn === column) {
            // Toggle sort direction if the same column is clicked
            this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
            // Set new column and default to ascending
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

    sortColumn: string = ''; // Currently sorted column
    sortDirection: 'asc' | 'desc' = 'asc'; // Track sort direction

    // Sorting for male standings
    sortMaleStandings(column: string) {


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

    // Sorting for female standings
    sortFemaleStandings(column: string) {
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



    onRoundsChange(newRounds: number): void {

        this.selectedRounds = newRounds; // Update the selected number of rounds
        this.updateRounds(); // Adjust the rounds dynamically
        this.initializeScores();
    }

    updateRounds(): void {
        // Update rounds array
        this.rounds = Array.from({ length: this.selectedRounds }, (_, index) => index + 1);

        const team = (this.retrievedListOfTeams && this.retrievedListOfTeams.length > 0)
            ? this.retrievedListOfTeams
            : this.listOfTeams;

        // Ensure `team` is defined and has elements
        if (!team || team.length === 0) {
            console.warn('No teams available to update round scores.');
            return;
        }

        team.forEach(team => {
            // Ensure `roundScores[team.kingQueenTeamId]` is initialized
            if (!this.roundScores[team.kingQueenTeamId]) {
                this.roundScores[team.kingQueenTeamId] = [];
            }

            const existingScores = this.roundScores[team.kingQueenTeamId];
            const existingRounds = existingScores.length;

            if (existingRounds > this.selectedRounds) {
                // Trim excess rounds

                this.roundScores[team.kingQueenTeamId] = existingScores.slice(0, this.selectedRounds);

            } else if (existingRounds < this.selectedRounds) {
                // Add missing rounds, preserving existing scores

                for (let i = existingRounds; i < this.selectedRounds; i++) {
                    this.roundScores[team.kingQueenTeamId].push({ RoundScore: 0, RoundWon: false });
                }

            } else {

            }
        });

    }

    // Method to calculate teams based on selected players
    calculateTeamsNeeded(): void {
        let totalPlayers = this.selectedList.length - this.byePlayers.length;

        // Calculate the number of teams and remainder for each team size
        this.teamsNeededTwo = Math.floor(totalPlayers / 2);
        this.remainderTwo = totalPlayers % 2;

        this.teamsNeededThree = Math.floor(totalPlayers / 3);
        this.remainderThree = totalPlayers % 3;

        this.teamsNeededFour = Math.floor(totalPlayers / 4);
        this.remainderFour = totalPlayers % 4;
    }


    addPlayer(player) {
        this.malePlayersDisplayCount = new Array();
        this.femalePlayersDisplayCount = new Array();
        for (let player of this.selectedList) {
            if (player.isMale) {
                this.malePlayersDisplayCount.push(player);

            }
            else {
                this.femalePlayersDisplayCount.push(player);
            }
        }

        this.malePlayerCount = this.malePlayersDisplayCount.length;
        this.femalePlayerCount = this.femalePlayersDisplayCount.length;
        this.calculateTeamsNeeded();
    }

    updateScrambleNumbers(selectedItems: any[]) {
        // Clear the existing list and add selected items
        this.listOfScrambleNumbers.length = 0; // Clear the array
        selectedItems.forEach(selected => {
            this.listOfScrambleNumbers.push(selected.scrambleNumber);
        });


    }

    addLeagueLogic() {
        if (this.LeagueForm.controls["newLeagueName"].value == "") {
            this.showSnackBar("Please enter a league name.")
        }
        else {
            this.containsLeague = false;
            if (this.leaguesAvailable && this.leaguesAvailable.length > 0) {
                this.containsLeague = false;
                for (let i = 0; i < this.leaguesAvailable.length; i++) {
                    if (this.leaguesAvailable[i].leagueName == this.LeagueForm.controls["newLeagueName"].value) {
                        this.containsLeague = true;
                        break;
                    }
                }
            } else {
                // Handle the case where this.leaguesAvailable is undefined or empty
                this.containsLeague = false; // Or any other handling you need
            }
            if (this.containsLeague) {
                this.showSnackBar('League name already exists.')
            }
            else {
                this.playerService.AddNewLeague(this.LeagueForm.controls["newLeagueName"].value).subscribe(result => {

                    if (result.leagueName == null) {
                        this.showSnackBar('Error creating league.', true);
                    }
                    else {
                        this.showSnackBar('Succesfully created league.');
                        this.leaguesAvailable.push(result);
                    }

                }, error => console.error(error));
            }


        }
    }

    addLeague() {
        if (this.loggedIn) {
            this.addLeagueLogic();
        }
        else {
            this.playerService.GetPassword().subscribe(result => {

                this.passwordLeague = result;
                if (this.LeagueForm.controls["passwordLeague"].value == "" || this.LeagueForm.controls["passwordLeague"].value != this.passwordLeague.password) {
                    this.showSnackBar("Password is not correct.")
                }
                else {
                    this.addLeagueLogic();
                }
            });
        }
    }

    hidePlayerList() {
        this.hidePlayers = !this.hidePlayers;

        var x = document.getElementById("playerListHidden");

        // Check if the element with ID "playerListHidden" exists
        if (x) {
            // Toggle the display property directly
            x.style.display = this.hidePlayers ? "none" : "block";
        }
    }


    //hideOptions() {
    //    this.hideInputOptions = !this.hideInputOptions;
    //    this.hideListOptions = !this.hideListOptions;
    //    var x = document.getElementById("hideInputOptions");
    //    if (x.style.display === "none") {
    //        x.style.display = "block";
    //    } else {
    //        x.style.display = "none";
    //    }
    //    var y = document.getElementById("hideListOptions");
    //    if (y.style.display === "none") {
    //        y.style.display = "block";
    //    } else {
    //        y.style.display = "none";
    //    }
    //}

    getTotalMaleSelectedPlayers() {
        return this.selectedList.filter(player => player.isMale).length;
    }

    getTotalFemaleSelectedPlayers() {
        return this.selectedList.filter(player => !player.isMale).length;
    }

    hideShowEverything() {
        this.hideEverything = !this.hideEverything;

        var z = document.getElementById("hideEverything");

        // Check if the element with ID "hideEverything" exists
        if (z) {
            // Toggle the display property
            z.style.display = this.hideEverything ? "none" : "block";
        }
    }


    deselectAllPlayers() {
        this.selectedList = [];
        this.calculateTeamsNeeded();
    }

    fetchSelectedList(): void {
        if (!this.selectedLeague) {
            console.error('No league selected. Cannot fetch selected players.');
            return;
        }

        this.selectedList = [];

        const today = new Date().toISOString().split('T')[0]; // Get current date without time

        this.playerService.getSelectedPlayersAsPlayers(this.leagueId, today).subscribe(
            (fetchedPlayers: Player[]) => {

                fetchedPlayers.forEach(fetchedPlayer => {

                    let isAdded = false;

                    // Check in malePlayers1
                    for (let i = 0; i < this.malePlayers1.length; i++) {
                        const player = this.malePlayers1[i];
                        if (player.id === fetchedPlayer.id) {
                            this.selectedList.push(player);
                            this.addPlayer(player);
                            isAdded = true;
                            break; // Stop further checks in malePlayers1
                        }
                    }

                    // Check in femalePlayers1
                    if (!isAdded) {
                        for (let i = 0; i < this.femalePlayers1.length; i++) {
                            const player = this.femalePlayers1[i];
                            if (player.id === fetchedPlayer.id) {
                                this.selectedList.push(player);
                                this.addPlayer(player);
                                isAdded = true;
                                break; // Stop further checks in femalePlayers1
                            }
                        }
                    }

                    // If not found in either list, add directly to `selectedList`
                    if (!isAdded) {
                        this.selectedList.push(fetchedPlayer);
                    }
                });

                // Trigger Angular change detection to refresh UI
                this.selectedList = [...this.selectedList];
            },
            (error) => {
                console.error('Error fetching selected players:', error);
            }
        );
    }



    selectAllPlayers() {
        // Clear the selected list first
        this.selectedList = [];

        // Add all male players to the selected list (excluding players with first name "open" or "Open")
        this.malePlayers1.forEach(player => {
            if (!/open/i.test(player.firstName)) {
                this.selectedList.push(player);
            }
        });

        // Add all female players to the selected list (excluding players with first name "open" or "Open")
        this.femalePlayers1.forEach(player => {
            if (!/open/i.test(player.firstName)) {
                this.selectedList.push(player);
            }
        });

        // Update the male and female player counts
        this.malePlayerCount = this.malePlayers1.filter(player => !/open/i.test(player.firstName)).length;
        this.femalePlayerCount = this.femalePlayers1.filter(player => !/open/i.test(player.firstName)).length;

        this.calculateTeamsNeeded();
    }

    onLeagueDayChange(selectedDay: string): void {
        this.leagueDay = selectedDay;
    }

    deletePlayerLogic() {
        // Get the selected player's first and last name from the form controls
        const firstNameToDelete = this.deletePlayerForm.controls["firstName"].value;
        const lastNameToDelete = this.deletePlayerForm.controls["lastName"].value;

        if (!firstNameToDelete || !lastNameToDelete || !this.selectedLeague) {
            this.showSnackBar("Please select both a player and a league to delete the player.");
            return;
        }

        let deletingPlayer: Player = {
            id: 0,
            firstName: firstNameToDelete,
            lastName: lastNameToDelete,
            gender: 'male',
            isMale: true,
            isSub: false
        };

        this.playerService.DeletePlayer(deletingPlayer, this.selectedLeague).subscribe(result => {

            let test = result;

            if (result) {
                const maleIndex = this.malePlayers1.findIndex(
                    player => player.firstName === firstNameToDelete && player.lastName === lastNameToDelete
                );

                if (maleIndex !== -1) {
                    this.malePlayers1.splice(maleIndex, 1);
                }

                // Find the player in the femalePlayers1 array and remove it
                const femaleIndex = this.femalePlayers1.findIndex(
                    player => player.firstName === firstNameToDelete && player.lastName === lastNameToDelete
                );

                if (femaleIndex !== -1) {
                    this.femalePlayers1.splice(femaleIndex, 1);
                }

                // Clear the form and display a success message
                this.deletePlayerForm.reset();
                this.showSnackBar("Player deleted successfully.");
            }
            // Find the player in the malePlayers1 array and remove it


        }, error => console.error(error));
    }


    onDeletePlayerClick() {
        if (this.loggedIn) {
            this.deletePlayerLogic();
        }
        else {
            this.playerService.GetPassword().subscribe(result => {
                this.password = result;
                if (this.deletePlayerForm.controls["passwordDelete"].value == "" || this.deletePlayerForm.controls["passwordDelete"].value != this.password.password) {
                    this.showSnackBar("Password is not correct.")
                }
                else {
                    this.deletePlayerLogic();

                }
            });
        }
    }

    addPlayerLogic() {
        const selectedGenderValue = this.PlayerForm.get("selectedGender").value;
        const isMale = selectedGenderValue === "Male";

        if (
            this.PlayerForm.controls["firstName"].value == "" ||
            this.PlayerForm.controls["lastName"].value == "" ||
            !selectedGenderValue
        ) {
            this.showSnackBar(
                "Please ensure that both first and last name fields are filled in as well as the gender field."
            );
        } else {
            let newPlayer: Player = {
                id: 0,
                firstName: this.PlayerForm.controls["firstName"].value,
                lastName: this.PlayerForm.controls["lastName"].value,
                gender: selectedGenderValue,
                isMale: isMale,
                isSub: this.PlayerForm.controls["isSub"].value,
            };

            if (this.selectedLeague != null) {
                this.playerService.AddPlayer(newPlayer, this.selectedLeague).subscribe(
                    (result) => {
                        this.player = result;
                        this.containsFemale = false;
                        this.containsMale = false;

                        // Check if the player already exists
                        for (var i = 0; i < this.malePlayers1.length; i++) {
                            if (
                                this.malePlayers1[i].firstName == result.firstName &&
                                this.malePlayers1[i].lastName == result.lastName
                            ) {
                                this.containsMale = true;
                                break;
                            }
                        }
                        for (var i = 0; i < this.femalePlayers1.length; i++) {
                            if (
                                this.femalePlayers1[i].firstName == result.firstName &&
                                this.femalePlayers1[i].lastName == result.lastName
                            ) {
                                this.containsFemale = true;
                                break;
                            }
                        }
                        if (this.containsMale || this.containsFemale) {
                            this.showSnackBar("Player already in the list.");
                        } else {
                            if (newPlayer.isMale) {
                                this.malePlayers1.push(newPlayer);
                                this.malePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            } else {
                                this.femalePlayers1.push(newPlayer);
                                this.femalePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            }
                            // Show success message
                            this.showSnackBar("Player added successfully!");
                        }
                    },
                    (error) => console.error(error)
                );
            } else {
                this.showSnackBar("Please Select A League From The Dropdown");
            }
        }
    }


    onSubmitClick() {
        if (this.loggedIn) {
            this.addPlayerLogic();
        }
        else {
            this.playerService.GetPassword().subscribe(result => {
                this.password = result;
                if (
                    this.PlayerForm.controls["password"].value == "" ||
                    this.PlayerForm.controls["password"].value != this.password.password
                ) {
                    this.showSnackBar("Password is not correct.");
                } else {
                    this.addPlayerLogic();
                }
            });
        }
    }



    showSnackBar(message: string, error: boolean = false) {
        const config = new MatSnackBarConfig();
        config.verticalPosition = 'top'; // Set the vertical position to center
        config.horizontalPosition = 'center'; // Set the horizontal position to center
        config.duration = 5000;
        if (error) {
            this.snackBar.open(message, 'Close', {
                duration: 5000,
                verticalPosition: 'top',
                horizontalPosition: 'center',
                panelClass: ['red-snackbar']
            });
        }
        else {
            this.snackBar.open(message, 'Close', config);
        }
    }

    maleScramble(bracketTeamPlayers) {
        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
        bracketTeamPlayers.push(this.randomMalePlayer);
        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
        return true;
    }


    maleScramble2(bracketTeamPlayers) {
        let randomMalePlayer;
        let players;
        let maxIterations = 1000; // Set a reasonable maximum number of iterations
        let iterations = 0;

        while (iterations < maxIterations) {
            if (this.malePlayers.length > 0) {
                randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                players = this.getPlayersInSameTeam(randomMalePlayer, this.retrievedListOfTeams);
                if (!players.some(player => bracketTeamPlayers.some(bp => this.arePlayersEqual(player, bp)))) {
                    // Found a valid player
                    this.randomMalePlayer = randomMalePlayer;
                    bracketTeamPlayers.push(this.randomMalePlayer);
                    this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                    this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                    return true; // Exit the function
                }
            }
            else {
                return true;
            }


            iterations++;
        }
        // If the loop reaches the maximum number of iterations without finding a valid player, consider handling this case (e.g., returning false or throwing an exception).
        return false;
    }


    getPlayersInSameTeam(targetPlayer: Player, teams: Team[]): Player[] {
        const playersInSameTeam: Player[] = [];

        teams.forEach((team) => {
            if (team.players.some((player) => this.arePlayersEqual(player, targetPlayer))) {
                // If the targetPlayer is found in this team, add all players from this team
                playersInSameTeam.push(...team.players);
            }
        });

        return playersInSameTeam;
    }

    arePlayersEqual(playerA: Player, playerB: Player): boolean {
        // Compare players based on criteria like first name and last name
        return playerA.firstName === playerB.firstName && playerA.lastName === playerB.lastName;
    }


    femaleScramble(bracketTeamPlayers) {
        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
        bracketTeamPlayers.push(this.randomFemalePlayer);
        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
        return true;
    }

    femaleScramble2(bracketTeamPlayers) {
        let randomFemalePlayer;
        let players;
        let maxIterations = 500; // Set a reasonable maximum number of iterations
        let iterations = 0;

        while (iterations < maxIterations) {
            if (this.femalePlayers.length > 0) {
                randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                players = this.getPlayersInSameTeam(randomFemalePlayer, this.retrievedListOfTeams);

                if (!players.some(player => bracketTeamPlayers.some(bp => this.arePlayersEqual(player, bp)))) {
                    // Found a valid player
                    this.randomFemalePlayer = randomFemalePlayer;
                    bracketTeamPlayers.push(this.randomFemalePlayer);
                    this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                    this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                    return true; // Exit the function
                }
            }
            else {
                return true;
            }
            iterations++;
        }
        return false;
    }


    updateUniqueScrambleNumbers() {
        this.uniqueScrambleNumbers = Array.from(new Set(this.listOfScrambleNumbers));
    }

    topPlayerScramble(bracketTeamPlayers) {
        // Select a random top player
        this.randomTopPlayer = this.totalTopPlayers[Math.floor(Math.random() * this.totalTopPlayers.length)];

        // Check if the randomTopPlayer exists in the malePlayers or femalePlayers list
        const isMaleValid = this.malePlayers.includes(this.randomTopPlayer);
        const isFemaleValid = this.femalePlayers.includes(this.randomTopPlayer);

        // Only push the player if they are valid
        if (!isMaleValid && !isFemaleValid) {
            console.warn("Invalid Top Player! Player does not exist in malePlayers or femalePlayers.");
            return; // Exit early without adding the player
        }

        // Push the player to the bracket team
        bracketTeamPlayers.push(this.randomTopPlayer);

        // Remove the player from totalTopPlayers
        this.totalTopPlayers = this.totalTopPlayers.filter(x => x !== this.randomTopPlayer);

        // Remove the player from malePlayers or femalePlayers and update counts
        if (this.randomTopPlayer.isMale) {
            this.malePlayers = this.malePlayers.filter(x => x !== this.randomTopPlayer);
            this.malePlayerCount = this.malePlayers.length;
        } else {
            this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomTopPlayer);
            this.femalePlayerCount = this.femalePlayers.length;
        }

        // Remove the player from totalPlayers
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomTopPlayer);

    }

    lowPlayerScramble(bracketTeamPlayers) {
        // Select a random low player
        this.randomLowPlayer = this.totalLowPlayers[Math.floor(Math.random() * this.totalLowPlayers.length)];

        // Check if the randomLowPlayer exists in the malePlayers or femalePlayers list
        const isMaleValid = this.malePlayers.includes(this.randomLowPlayer);
        const isFemaleValid = this.femalePlayers.includes(this.randomLowPlayer);

        // Only push the player if they are valid
        if (!isMaleValid && !isFemaleValid) {
            console.warn("Invalid Low Player! Player does not exist in malePlayers or femalePlayers.");
            return; // Exit early without adding the player
        }

        // Push the player to the bracket team
        bracketTeamPlayers.push(this.randomLowPlayer);

        // Remove the player from totalLowPlayers
        this.totalLowPlayers = this.totalLowPlayers.filter(x => x !== this.randomLowPlayer);

        // Remove the player from malePlayers or femalePlayers and update counts
        if (this.randomLowPlayer.isMale) {
            this.malePlayers = this.malePlayers.filter(x => x !== this.randomLowPlayer);
            this.malePlayerCount = this.malePlayers.length;
        } else {
            this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomLowPlayer);
            this.femalePlayerCount = this.femalePlayers.length;
        }

        // Remove the player from totalPlayers
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomLowPlayer);
    }



    randomScramble(bracketTeamPlayers) {
        this.randomPlayer = this.totalRandomPlayers[Math.floor(Math.random() * this.totalRandomPlayers.length)];
        bracketTeamPlayers.push(this.randomPlayer);
        this.totalRandomPlayers = this.totalRandomPlayers.filter(x => x !== this.randomPlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomPlayer);
    }

    reset() {
        if (this.locked) {
            this.showSnackBar('Can not reset while results are locked. Please uncheck lock results and scramble again.');
        }
        else {
            this.listOfTeams = [];
            this.clearTopPLayers();
            this.clearLowPlayers();
            this.clearByePlayers();
        }
    }

    resetTopPlayers() {
        this.clearTopPLayers();
    }

    resetByePlayers() {
        this.clearByePlayers();
    }

    resetLowPlayers() {
        this.clearLowPlayers();
    }



    updateNumberOfPlayersNeeded(): void {
        const maxPlayers = Math.max(this.displayTopPlayers.length, this.displayLowPlayers.length);

        this.numberOfPlayersNeededTwo = maxPlayers * 2;
        this.numberOfPlayersNeededThree = maxPlayers * 3;
        this.numberOfPlayersNeededFour = maxPlayers * 4;
    }


    addPlayerToTopPlayerList(player: Player) {

        if (player.isLowPlayer) {
            // Deselect Low Player if already selected
            this.removePlayerFromLowPlayerList(player);
        }
        // Check if the player already exists in the totalTopPlayers array
        const playerExists = this.totalTopPlayers.some(existingPlayer => existingPlayer === player);

        if (!playerExists) {
            // If the player doesn't exist, add them to the totalTopPlayers array
            if (this.totalTopPlayers.length === 0 && this.totalTopPlayersTemp.length !== 0) {
                this.totalTopPlayers = this.totalTopPlayersTemp.filter(player => player.isTopPlayer);
            }

            this.totalTopPlayers.push(player);
            player.isTopPlayer = true;

            // Update other variables as needed.
            this.displayTopPlayers = this.totalTopPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts
        }
        else {
            player.isTopPlayer = true;
        }
    }


    removePlayerFromTopPlayerList(player: Player) {
        // Find all indices of the player in the totalTopPlayers array
        const playerIndices = this.totalTopPlayers.reduce((indices, current, index) => {
            if (current === player) {
                indices.push(index);
            }
            return indices;
        }, []);

        if (playerIndices.length > 0) {
            // Remove all occurrences of the player from the totalTopPlayers array
            for (const index of playerIndices.reverse()) {
                this.totalTopPlayers.splice(index, 1);
            }

            // Update the isTopPlayer status for all occurrences of the player
            player.isTopPlayer = false;

            this.displayTopPlayers = this.totalTopPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts

        } else {
            player.isTopPlayer = false;
        }
        this.totalTopPlayers = this.totalTopPlayers.filter(player => player.isTopPlayer);
    }

    addPlayerToLowPlayerList(player: Player) {
        if (player.isTopPlayer) {
            this.removePlayerFromTopPlayerList(player);
        }
        // Check if the player already exists in the totalLowPlayers array
        const playerExists = this.totalLowPlayers.some(existingPlayer => existingPlayer === player);

        if (!playerExists) {
            // If the player doesn't exist, add them to the totalLowPlayers array
            if (this.totalLowPlayers.length === 0 && this.totalLowPlayersTemp.length !== 0) {
                this.totalLowPlayers = this.totalLowPlayersTemp.filter(player => player.isLowPlayer);
            }

            this.totalLowPlayers.push(player);
            player.isLowPlayer = true;

            // Update other variables as needed.
            this.displayLowPlayers = this.totalLowPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts
        }
        else {
            player.isLowPlayer = true;
        }
    }

    updateIsSubScore(kingQueenTeamId: number, playerId: number, isSub: boolean): void {

        // Call the API to persist the change
        this.playerService.updateKingQueenPlayerSubStatus(kingQueenTeamId, playerId, isSub).subscribe({
            next: () => console.log(''),
            error: (err) => console.error('Error updating sub status:', err)
        });
    }


    removePlayerFromLowPlayerList(player: Player) {
        // Find all indices of the player in the totalLowPlayers array
        const playerIndices = this.totalLowPlayers.reduce((indices, current, index) => {
            if (current === player) {
                indices.push(index);
            }
            return indices;
        }, []);

        if (playerIndices.length > 0) {
            // Remove all occurrences of the player from the totalLowPlayers array
            for (const index of playerIndices.reverse()) {
                this.totalLowPlayers.splice(index, 1);
            }

            // Update the isLowPlayer status for all occurrences of the player
            player.isLowPlayer = false;

            this.displayLowPlayers = this.totalLowPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts

        } else {
            player.isLowPlayer = false;
        }
        this.totalLowPlayers = this.totalLowPlayers.filter(player => player.isLowPlayer);
    }



    updateRoundScore(teamId: number, roundIndex: number, value: number): void {
        // Ensure `roundScores[teamId]` is initialized
        if (!this.roundScores[teamId]) {
            this.roundScores[teamId] = [];
        }

        // Ensure `roundScores[teamId]` has enough rounds
        while (this.roundScores[teamId].length <= roundIndex) {
            this.roundScores[teamId].push({ RoundScore: 0, RoundWon: false });
        }

        // Update the specified round score
        this.roundScores[teamId][roundIndex].RoundScore = value;

        // Update the corresponding `kingQueenRoundScores` if it exists
        const score = this.kingQueenRoundScores.find(
            s => s.kingQueenTeamId === teamId && s.roundId === roundIndex // Assume roundId matches the round index + 1
        );

        if (score) {
            score.roundScore = value;
        } else {
            // Add a new score to `kingQueenRoundScores` if not found
            const newScore = {
                id: 0, // Assuming ID is managed elsewhere
                kingQueenTeamId: teamId,
                roundId: roundIndex, // Match round index to roundId
                roundScore: value,
                roundWon: false // Default value
            };
            this.kingQueenRoundScores.push(newScore);
        }
    }




    updateRoundWon(teamId: number, roundId: number, value: boolean): void {
        const score = this.getScore(teamId, roundId);
        if (score) {
            score.roundWon = value;
        }
    }




    retrieveScramble(scramble: KingQueenTeam) {
        this.scrambleSelected = true;
        this.retrievedPlayersBefore = true;
        this.allowScrambleWithNoDuplicates = true;
        this.showSaveRoundScores = true;
        this.retrievedListOfTeams = [];

        this.playerService.getKingQueenTeamsByScrambleNumber(this.selectedLeague, scramble.scrambleNumber).subscribe(
            (response) => {
                // Initialize your list of teams
                this.listOfTeams = [];
                this.listOfRetrievedScrambleNumbers = [];
                let matchups = response.kingQueenTeams;
                if (matchups.length > 0 && matchups[0].kingQueenTeam.kingQueenRoundScores) {
                    this.selectedRounds = matchups[0].kingQueenTeam.kingQueenRoundScores.length;
                }
                // Map the retrieved matchups into listOfTeams
                matchups.forEach((matchup) => {
                    matchup.players.forEach((player) => {
                        // kingQueenPlayers might be null/undefined, so default to empty array
                        const kqPlayers = matchup.kingQueenTeam.kingQueenPlayers || [];

                        let matchingKQPlayer: KingQueenPlayer | null = null;
                        for (const kqp of kqPlayers) {
                            if (kqp.playerId === player.id) {
                                matchingKQPlayer = kqp;
                                break; // Stop once we find the match
                            }
                        }

                        if (matchingKQPlayer) {
                            player.isSubScore = matchingKQPlayer.isSubScore;
                        }
                    });

                    // 2. Build your Team object now that each Player is updated
                    const team: Team = {
                        players: matchup.players,
                        maleCount: matchup.players.filter((player) => player.isMale).length,
                        femaleCount: matchup.players.filter((player) => !player.isMale).length,
                        kingQueenRoundScores: matchup.kingQueenTeam.kingQueenRoundScores,
                        kingQueenTeamId: matchup.kingQueenTeam.id,
                        scrambleNumber: null,
                        sortingId: null
                    };

                    // 3. Push the team into your list
                    this.listOfTeams.push(team);
                    this.retrievedListOfTeams.push(team);
                });
                this.byePlayers = response.byePlayers;

                this.listOfRetrievedScrambleNumbers.push(scramble.scrambleNumber);
                // Initialize rounds and scores after data is fully loaded
                this.initializeRounds();
                this.initializeScores();
            },
            (error) => {
                // Handle any errors
                console.error('Error retrieving matchups:', error);
            }
        );
    }

    saveKingQueenRoundScores(): void {
        this.playerService.saveKingQueenRoundScores(
            this.kingQueenRoundScores, // Array of round scores
            this.selectedLeague        // Selected league name
        ).subscribe(
            result => {
                this.snackBar
                    .open('Standings have been saved.', 'OK', {
                        duration: 5000, // Optional: Auto-close after 5 seconds
                        verticalPosition: 'top',
                        horizontalPosition: 'center',
                    });

                this.initializeStandings(); // This will run immediately after showing the snackbar

            },
            error => {
                // Handle error response
                console.error('Error saving round scores:', error);
            }
        );
    }

    calculateTotalScore(teamId: number): number {
        let total = 0;

        // Iterate through all rounds and sum their scores for the given team
        this.rounds.forEach(round => {
            const score = this.getScore(teamId, round); // Use getScore to fetch the round data
            if (score && score.roundScore) {
                total += parseFloat(score.roundScore) || 0; // Ensure the score is treated as a number
            }
        });

        return total; // Return the computed total score
    }

    calculateTotalWins(teamId: number): number {
        let totalWins = 0;

        // Iterate through all rounds and count wins for the given team
        this.rounds.forEach(round => {
            const score = this.getScore(teamId, round); // Use getScore to fetch the round data
            if (score && score.roundWon) {
                totalWins += 1; // Increment total wins if the round is won
            }
        });

        return totalWins; // Return the computed total wins
    }



    retrieveMultipleScrambles() {
        this.retrievedPlayersBefore = true;
        this.allowScrambleWithNoDuplicates = true;
        this.showSaveRoundScores = false;
        this.playerService.getMultipleKingQueenTeamsByScrambleNumbers(this.selectedLeague, this.listOfScrambleNumbers).subscribe(
            (response) => {
                // Initialize your list of teams
                this.listOfRetrievedScrambleNumbers = [];
                this.listOfTeams = [];
                this.retrievedListOfTeams = [];
                let matchups = response.kingQueenTeams
                // Map the retrieved matchups into listOfTeams
                matchups.forEach((matchup) => {
                    const team: Team = {
                        players: matchup.players,
                        maleCount: matchup.players.filter(player => player.isMale).length,
                        femaleCount: matchup.players.filter(player => !player.isMale).length,
                        kingQueenTeamId: matchup.kingQueenTeam.id,
                        kingQueenRoundScores: matchup.kingQueenTeam.kingQueenRoundScores,
                        sortingId: null,
                        scrambleNumber: null
                    };
                    this.listOfTeams.push(team);
                    this.retrievedListOfTeams.push(team);
                });
                this.listOfRetrievedScrambleNumbers = [...this.listOfScrambleNumbers];
                this.byePlayers = response.byePlayers;
            },
            (error) => {
                // Handle any errors
                console.error('Error retrieving matchups:', error);
            }
        );
    }

    clearTopPLayers() {
        this.totalTopPlayers = new Array();
        this.displayTopPlayers = new Array();
        for (let player of this.malePlayers1) {
            player.isTopPlayer = false;
        }
        for (let player of this.femalePlayers1) {
            player.isTopPlayer = false;
        }
    }

    clearLowPlayers() {
        this.totalLowPlayers = new Array();
        this.displayLowPlayers = new Array();
        for (let player of this.malePlayers1) {
            player.isLowPlayer = false;
        }
        for (let player of this.femalePlayers1) {
            player.isLowPlayer = false;
        }
    }


    clearByePlayers() {
        this.byePlayers = [];
        for (let player of this.malePlayers1) {
            player.isByePlayer = false;
        }
        for (let player of this.femalePlayers1) {
            player.isByePlayer = false;
        }
    }


    updateNumberOfTeams(selectedTeamSize: number): void {
        this.numberOfTeamsSelected = true;
        this.teamSizeSelected = false;
        // Deselect the other mat-select when one is selected
        if (selectedTeamSize) {
            this.numberOfTeams = null;
        }
    }


    getListItemWidth(scrambleCount: number): number {
        if (!this.isSmallScreen && scrambleCount > 1) {
            return 49;
        } else
            if (!this.isSmallScreen && scrambleCount == 1) {
                return 100;
            } else
                if (this.isSmallScreen) {
                    return 100;
                } else
                    if (!this.isSmallScreen) {
                        return 49;
                    }
    }


    updateTeamSize(selectedNumberOfTeams: number): void {
        // Deselect the other mat-select when one is selected
        this.teamSizeSelected = true;
        this.numberOfTeamsSelected = false;
        if (selectedNumberOfTeams) {
            this.teamSize = null;
        }
    }


    async saveKingQueenTeams() {
        // Transform Team[] into KingQueenTeamWithPlayers[]
        const kingQueenTeamsWithPlayers: KingQueenTeamWithPlayers[] = this.listOfTeams.map(team => {
            return {
                kingQueenTeam: {
                    id: 0, // Assign a default value for id or adjust it as needed
                    leagueID: 0, // Assign a default value for leagueID or adjust it as needed
                    dateOfTeam: new Date(), // Assign the current date or adjust it as needed
                    scrambleNumber: 0, // Assign a default value for scrambleNumber or adjust it as needed
                    kingQueenPlayers: [], // You can initialize this as an empty array
                    kingQueenRoundScores: []
                },
                players: team.players,
            };
        });

        try {
            // Call the service and await the result
            const result = await this.playerService.saveKingQueenTeams(
                kingQueenTeamsWithPlayers,
                this.selectedLeague,
                this.byePlayers
            ).toPromise();

            // Check if the response is valid
            if (result) {
                // Get the scramble number from the first team, if available
                if (result.kingQueenTeams.length > 0 && result.kingQueenTeams[0].kingQueenTeam) {
                    this.scrambleNumber = result.kingQueenTeams[0].kingQueenTeam.scrambleNumber;
                }

                this.showSnackBar('All KingQueenTeams and Bye Players saved successfully!');

                // Update the queried scrambles
                this.playerService.SelectedLeagueScrambles(this.selectedLeague).subscribe(result => {
                    this.queriedScrambles = result;
                });
            } else {
                // Handle the case where there was an issue with saving or no data returned
                this.showSnackBar('Error saving KingQueenTeams or no data returned!');
            }
        } catch (error) {
            // Handle errors, if any
            console.error('Error saving KingQueenTeams: ', error);
            this.showSnackBar('Error saving KingQueenTeams!');
        }
    }


    onSelectionChange(event: any): void {
        this.selectedMatchupsPerPage = event.value;
    }

    printMatchups(): void {
        let printContent = '';

        if (this.selectedMatchupsPerPage == '2') {
            const printSection2 = document.getElementById('printSection2');
            if (printSection2) {
                printContent = printSection2.innerHTML;
            }
        } else if (this.selectedMatchupsPerPage == '4') {
            const printSection4 = document.getElementById('printSection4');
            if (printSection4) {
                printContent = printSection4.innerHTML;
            }
        } else if (this.selectedMatchupsPerPage == '6') {
            const printSection6 = document.getElementById('printSection6');
            if (printSection6) {
                printContent = printSection6.innerHTML;
            }
        }

        // Check if content is empty and log a warning if necessary
        if (!printContent) {
            console.warn('Print Content is empty. Verify that the printSection elements exist and have content.');
        }

        if (printContent) {
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(`
                <html>
                    <head>
                        <title>Print Matchups</title>
                        <style>
                            @media print {
                                @page { size: portrait; margin: 1cm; }
                                body {
                                    font-family: Arial, sans-serif;
                                    padding: 20px;
                                }
                                table {
                                    width: 100%;
                                    border-collapse: collapse;
                                }
                                th, td {
                                    border: 1px solid #000;
                                    padding: 5px;
                                    text-align: center;
                                }
                            }
                        </style>
                    </head>
                    <body>${printContent}</body>
                </html>
            `);
                printWindow.document.close();
                printWindow.onload = () => {
                    printWindow.print();
                    printWindow.close();
                };
            }
        }
    }




    //retrieveMatchups() {
    //    this.playerService.getKingQueenTeamsByScrambleNumber(this.selectedLeague, this.scrambleNumber).subscribe(
    //        (response) => {
    //            // Initialize your list of teams
    //            this.listOfTeams = [];
    //            let matchups = response.kingQueenTeams;
    //            if (matchups.length > 0 && matchups[0].kingQueenTeam.kingQueenRoundScores) {
    //                this.selectedRounds = matchups[0].kingQueenTeam.kingQueenRoundScores.length;
    //            } 
    //            // Map the retrieved matchups into listOfTeams
    //            matchups.forEach((matchup) => {
    //                const team: Team = {
    //                    players: matchup.players,
    //                    maleCount: matchup.players.filter(player => player.isMale).length,
    //                    femaleCount: matchup.players.filter(player => !player.isMale).length,
    //                    kingQueenTeamId: matchup.kingQueenTeam.id,
    //                    kingQueenRoundScores: matchup.kingQueenTeam.kingQueenRoundScores
    //                };

    //                this.listOfTeams.push(team);
    //                this.retrievedListOfTeams.push(team);

    //            });
    //            this.updateRounds();
    //            this.byePlayers = response.byePlayers;
    //        },
    //        (error) => {
    //            // Handle any errors
    //            console.error('Error retrieving matchups:', error);
    //        }
    //    );
    //}






    // Check screen size and update isSmallScreen
    checkScreenSize() {
        this.isSmallScreen = window.innerWidth <= 1200; // Adjust the screen size threshold as needed
    }

    selectPlayers(playerCount: number, isMale: boolean, nonDuplicates: boolean): boolean {
        for (var i = 0; i < playerCount; i++) {
            let bestTeam: Team = null;

            // Step 1: Identify the team with the fewest total players
            const smallestTeamSize = Math.min(...this.listOfTeams.map(team => team.players.length));
            const smallestTeams = this.listOfTeams.filter(team => team.players.length === smallestTeamSize);

            // Step 2: Among the smallest teams, prioritize those with an imbalance
            let maxImbalance = Number.NEGATIVE_INFINITY;
            for (let team of smallestTeams) {
                const maleCount = team.players.filter(player => player.isMale).length;
                const femaleCount = team.players.length - maleCount;

                // Calculate imbalance (negative means more males, positive means more females)
                const imbalance = isMale ? femaleCount - maleCount : maleCount - femaleCount;

                // Select the team with the greatest imbalance
                if (imbalance > maxImbalance) {
                    maxImbalance = imbalance;
                    bestTeam = team;
                } else if (imbalance === maxImbalance && bestTeam !== null) {
                    // If imbalance is equal, prioritize the team with fewer total players
                    if (team.players.length < bestTeam.players.length) {
                        bestTeam = team;
                    }
                }
            }

            // Step 3: If all teams are balanced, add the player to the smallest teams at random
            if (bestTeam == null) {
                const randomIndex = Math.floor(Math.random() * smallestTeams.length);
                bestTeam = smallestTeams[randomIndex];
            }
            // Step 4: Add the player to the selected team
            if (nonDuplicates) {
                if (isMale) {
                    if (!this.maleScramble2(bestTeam.players)) {
                        return false; // If maleScramble2 fails, return false
                    }
                } else {
                    if (!this.femaleScramble2(bestTeam.players)) {
                        return false; // If femaleScramble2 fails, return false
                    }
                }
            } else {
                if (isMale) {
                    if (!this.maleScramble(bestTeam.players)) {
                        return false; // If maleScramble fails, return false
                    }
                } else {
                    if (!this.femaleScramble(bestTeam.players)) {
                        return false; // If femaleScramble fails, return false
                    }
                }
            }
        }

        // Step 5: Rebalance team sizes after all players are added
        //this.rebalanceTeams();

        return true; // Return true if selection was successful
    }

    //This will break my nonduplicate players scramble
    //rebalanceTeams(): void {
    //    const maxTeamSize = Math.max(...this.listOfTeams.map(team => team.players.length));
    //    const minTeamSize = Math.min(...this.listOfTeams.map(team => team.players.length));

    //    // Track already moved players to avoid duplicates
    //    const movedPlayers = new Set<number>(); // Assume player has a unique `id` property

    //    // While the difference between the largest and smallest teams is greater than 1
    //    while (maxTeamSize - minTeamSize > 1) {
    //        // Find the largest and smallest teams
    //        const largestTeam = this.listOfTeams.find(team => team.players.length === maxTeamSize);
    //        const smallestTeam = this.listOfTeams.find(team => team.players.length === minTeamSize);

    //        if (largestTeam && smallestTeam) {
    //            // Find a player to move who hasn't been moved before
    //            const playerToMove = largestTeam.players.find(player => !movedPlayers.has(player.id));

    //            // Add the player to the smallest team if it's not a duplicate
    //            if (playerToMove) {
    //                const isDuplicate = smallestTeam.players.some(player => player.id === playerToMove.id);

    //                if (!isDuplicate) {
    //                    smallestTeam.players.push(playerToMove);
    //                    movedPlayers.add(playerToMove.id); // Mark the player as moved
    //                    largestTeam.players = largestTeam.players.filter(player => player.id !== playerToMove.id);
    //                }
    //            }
    //        }

    //        // Recalculate the max and min team sizes
    //        const updatedMaxTeamSize = Math.max(...this.listOfTeams.map(team => team.players.length));
    //        const updatedMinTeamSize = Math.min(...this.listOfTeams.map(team => team.players.length));

    //        if (updatedMaxTeamSize === maxTeamSize && updatedMinTeamSize === minTeamSize) {
    //            break; // Break out of the loop if no changes were made
    //        }
    //    }
    //}


    reorderMatchups(): void {
        // Group teams by gender composition
        const groupedTeams = this.listOfTeams.map(team => {
            const maleCount = team.players.filter(p => p.isMale).length;
            const femaleCount = team.players.length - maleCount;
            return { team, maleCount, femaleCount };
        });

        // Sort teams by male-to-female ratio
        groupedTeams.sort((a, b) => {
            if (a.maleCount === b.maleCount) {
                return b.femaleCount - a.femaleCount;
            }
            return b.maleCount - a.maleCount;
        });

        // Reassign matchups to pair similar teams
        const reorderedTeams: Team[] = [];
        for (let i = 0; i < groupedTeams.length; i += 2) {
            const team1 = i < groupedTeams.length ? groupedTeams[i].team : null;
            const team2 = i + 1 < groupedTeams.length ? groupedTeams[i + 1].team : null;

            // Reorder players within each team (men at the top, women at the bottom)
            if (team1) {
                team1.players = team1.players.sort((a, b) => Number(b.isMale) - Number(a.isMale));
            }
            if (team2) {
                team2.players = team2.players.sort((a, b) => Number(b.isMale) - Number(a.isMale));
            }

            if (team1 && team2) {
                reorderedTeams.push(team1, team2);
            } else if (team1) {
                reorderedTeams.push(team1);
            }
        }

        this.listOfTeams = reorderedTeams;
        this.listOfTeams = this.listOfTeams.map((team, index) => ({
            ...team,
            sortingId: index + 1, // Sorting ID based on order
        }));
    }




    fillTopPlayers() {
        if (this.totalTopPlayers != null) {
            for (var i = 0; i < this.topPlayerCount; i++) {

                let bestTeam: Team = null;
                for (let i = 0; i < this.listOfTeams.length - 1; i++) {
                    if (this.listOfTeams[i].players.length > this.listOfTeams[i + 1].players.length) {
                        bestTeam = this.listOfTeams[i + 1];
                    }
                    else if (this.listOfTeams[i].players.length < this.listOfTeams[i + 1].players.length) {
                        bestTeam = this.listOfTeams[i];
                    }
                }
                if (bestTeam == null) {
                    bestTeam = this.listOfTeams[0];
                }
                this.topPlayerScramble(bestTeam.players);

            }
        }
    }

    fillLowPlayers() {
        if (this.totalLowPlayers != null) {
            for (var i = 0; i < this.lowPlayerCount; i++) {
                let bestTeam: Team = null;

                // Step 1: Create a list of candidate teams
                const candidateTeams = this.listOfTeams.filter(team => {
                    const lowPlayerCount = team.players.filter(player => player.isLowPlayer).length;
                    // Allow adding to any team, but prioritize teams with fewer low players
                    return lowPlayerCount <= Math.min(...this.listOfTeams.map(t => t.players.filter(p => p.isLowPlayer).length));
                });

                // Step 2: Randomize selection from candidate teams to avoid predictable assignments
                if (candidateTeams.length > 0) {
                    bestTeam = candidateTeams[Math.floor(Math.random() * candidateTeams.length)];
                }

                // Step 3: Fallback to the first team if no candidates are found
                if (bestTeam == null) {
                    bestTeam = this.listOfTeams[0];
                }

                // Step 4: Add the low player to the selected team
                this.lowPlayerScramble(bestTeam.players);
            }
        }
    }



    async selectPlayersWithRetries(
        nonDuplicates: boolean
    ): Promise<boolean> {
        this.totalTopPlayersTemp = [...this.totalTopPlayers];
        this.totalLowPlayersTemp = [...this.totalLowPlayers];
        this.totalPlayersTemp = [...this.totalPlayers];
        const maxRetries = 101; // Set a maximum number of retries
        for (let retry = 0; retry < maxRetries; retry++) {
            await this.fillTopPlayers();
            await this.fillLowPlayers();
            let maleSuccess = this.selectPlayers(this.malePlayerCount, true, nonDuplicates);
            let femaleSuccess = this.selectPlayers(this.femalePlayerCount, false, nonDuplicates);

            if (maleSuccess && femaleSuccess) {
                this.totalTopPlayers = [...this.totalTopPlayersTemp];
                this.totalLowPlayers = [...this.totalLowPlayersTemp];
                this.totalPlayers = [...this.totalPlayersTemp];
                this.reorderMatchups();
                // Player selection was successful, break out of the loop
                return true;
            }
            this.listOfTeams = [];
            this.malePlayers = [];
            this.femalePlayers = [];
            this.totalTopPlayers = [...this.totalTopPlayersTemp];
            this.totalLowPlayers = [...this.totalLowPlayersTemp];
            this.totalPlayers = [...this.totalPlayersTemp];
            if (retry != 100) {
                this.fillPlayers();
                if (this.listOfTeams.length === 0) {
                    this.fillTeam()
                }
            }

        }
        this.malePlayers = [];
        this.femalePlayers = [];
        this.retrievedListOfTeams = [];
        this.totalTopPlayers = [...this.totalTopPlayersTemp];
        this.totalLowPlayers = [...this.totalLowPlayersTemp];
        return false; // All retries failed
    }

    addPlayerToByeList(player: Player) {
        player.isByePlayer = true;
        this.byePlayers.push(player);
        this.calculateTeamsNeeded();
    }

    removePlayerFromByeList(player: Player) {
        player.isByePlayer = false;
        this.byePlayers = this.byePlayers.filter(p => p !== player);
        this.calculateTeamsNeeded();
    }


    fillPlayers() {
        // Separate bye players
        this.byePlayers = this.selectedList.filter(player => player.isByePlayer);

        // Separate remaining players based on the randomization flag
        if (this.completeRandom) {
            this.totalRandomPlayers = this.selectedList.filter(player => !player.isByePlayer);
        } else {
            this.malePlayers = this.selectedList.filter(player => !player.isByePlayer && player.isMale);
            this.femalePlayers = this.selectedList.filter(player => !player.isByePlayer && !player.isMale);
        }
    }

    fillTeam() {
        if (this.numberOfTeams) {
            this.teamCount = this.numberOfTeams;
        }
        else {
            this.setTeamCount();
        }
        for (let i = 0; i < this.teamCount; i++) {
            let team = {
                players: [],
                femaleCount: 0,
                maleCount: 0,
                kingQueenTeamId: 0,
                kingQueenRoundScores: [],
                scrambleNumber: null,
                sortingId: null
            };
            this.listOfTeams.push(team);
        }

    }

    setTeamCount() {
        let listLength = (this.selectedList.length - this.byePlayers.length);
        if (this.teamSize == 5) {
            if ((listLength / 10) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 10) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 10) * 2) + 2;

            }
        }
        else if (this.teamSize == 4) {
            if ((listLength / 8) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 8) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 8) * 2) + 2;

            }
        }
        else if (this.teamSize == 3) {
            if ((listLength / 6) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 6) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 6) * 2) + 2;

            }
        }
        else if (this.teamSize == 2) {
            if ((listLength / 4) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 4) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 4) * 2) + 2;

            }
        }
    }

    getPlayerClass(player: Player): string {
        const playerClass = this.isPlayerInSelectedList(player)
            ? (player.isMale ? 'extended-background-blue' : 'extended-background-pink')
            : (player.isMale ? 'not-selected-blue' : 'not-selected-pink');

        return playerClass;
    }


    isPlayerInSelectedList(player: Player): boolean {
        const result = this.selectedList.some(selectedPlayer => {
            const match = selectedPlayer.id === player.id;
            return match;
        });

        return result;
    }


    async scramblePlayers(nonDuplicates: boolean = false) {
        this.scrambleSelected = false;
        if (nonDuplicates) {
            this.allowScrambleWithNoDuplicates = false;
        }
        this.showSaveRoundScores = false;
        this.totalTopPlayers = this.displayTopPlayers;
        this.totalLowPlayers = this.displayLowPlayers;
        if (!this.lockedResults) {
            this.locked = false;

        }
        if (this.locked) {
            this.showSnackBar('Results are currently locked. Please uncheck lock results to rescramble.')
        }
        else {

            this.listOfTeams = [];
            this.fillPlayers();
            this.malePlayerCount = this.malePlayers.length;
            this.femalePlayerCount = this.femalePlayers.length;
            this.randomPlayerCount = this.totalRandomPlayers.length;
            this.topPlayerCount = this.totalTopPlayers.length;
            this.lowPlayerCount = this.totalLowPlayers.length;
            if (this.numberOfTeams != null) {
                this.teamCount = this.numberOfTeams;
            }
            else {
                await this.setTeamCount();
            }
            for (var i = 0; i < this.teamCount; i++) {
                let team = {
                    players: [],
                    femaleCount: 0,
                    maleCount: 0,
                    kingQueenTeamId: 0,
                    kingQueenRoundScores: [],
                    scrambleNumber: null,
                    sortingId: null
                }
                this.listOfTeams.push(team)
            }

            if (this.completeRandom) {
                for (var i = 0; i < this.randomPlayerCount; i++) {
                    let bestTeam: Team = null;
                    for (let i = 0; i < this.listOfTeams.length - 1; i++) {
                        if (this.listOfTeams[i].players.length > this.listOfTeams[i + 1].players.length) {
                            bestTeam = this.listOfTeams[i + 1];
                        }
                        else if (this.listOfTeams[i].players.length < this.listOfTeams[i + 1].players.length) {
                            bestTeam = this.listOfTeams[i];
                        }
                    }
                    if (bestTeam == null) {
                        bestTeam = this.listOfTeams[0];
                    }
                    this.randomScramble(bestTeam.players);
                }
            }
            else {

                try {

                    let result = await this.selectPlayersWithRetries(nonDuplicates);

                    // Use the function to select players for both males and females with retries
                    if (result) {
                        if (nonDuplicates) {
                            this.showSnackBar("Scramble with no duplicates completed successfully.");
                        }
                        else {
                            this.showSnackBar("Scramble Succesful.");
                        }
                    }
                    else {
                        this.showSnackBar("Not enough players to complete non-duplicate scramble.", true);
                    }
                } catch (e) {

                }

            }
            if (this.lockedResults) {
                this.locked = true;
            }
            else {
                this.locked = false;
            }
            if (this.saveTeamsDiv) {
                // Set focus on the div element
                this.saveTeamsDiv.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                this.saveTeamsDiv.nativeElement.focus();
            }


            const requestBody: KingQueenTeamsResponse = {
                kingQueenTeams: this.listOfTeams.map(team => {
                    return {
                        kingQueenTeam: {
                            id: 0,
                            leagueID: 0,
                            dateOfTeam: new Date(),            // or new Date().toISOString()
                            kingQueenPlayers: [],
                            scrambleNumber: 0,                 // Will be assigned by server
                            scrambleWithScoresToBeSaved: false,
                            kingQueenRoundScores: []
                        },
                        players: team.players // The array of players for this "team"
                    };
                }),
                byePlayers: [] // If you have no ByePlayers right now, just keep it empty
            };

            // 2) Call generateScramble
            try {
                const createdTeams: KingQueenTeam[] = await this.playerService
                    .generateScramble(this.selectedLeague, requestBody)
                    .toPromise();

                if (createdTeams && createdTeams.length > 0) {
                    // The server returns an array of newly created KingQueenTeams
                    this.scrambleNumber = createdTeams[0].scrambleNumber;
                } else {
                    console.error('Error: No teams returned from server');
                }
            } catch (error) {
                console.error('Error generating scramble:', error);
            }
        }
    }
}


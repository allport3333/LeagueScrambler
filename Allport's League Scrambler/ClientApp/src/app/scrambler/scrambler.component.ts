import { Component, Inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteSelectedEvent, MatSelectionListChange } from '@angular/material';
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
@Component({
    selector: 'app-scrambler-component',
    templateUrl: './scrambler.component.html',
    styleUrls: ['./scrambler.component.less']
})
export class ScramblerComponent implements OnInit {
    hideEverything: boolean;
    totalPlayers: Player[];
    players: Player[];
    selectedMalePlayers: Player[];
    malePlayers: Player[] = new Array();
    femalePlayers: Player[] = new Array();
    malePlayersDisplayCount: Player[] = new Array();
    femalePlayersDisplayCount: Player[] = new Array();
    totalRandomPlayers: Player[] = new Array();
    displayTopPlayers: Player[] = new Array();
    totalTopPlayers: Player[] = new Array();
    totalTopPlayersTemp: Player[] = new Array();
    totalPlayersTemp: Player[] = new Array();
    listOfTeams: Team[] = new Array();
    retrievedListOfTeams: Team[] = new Array();
    matchups: Team[] = new Array();
    selectedList: Player[] = new Array();
    selectedRetrieveScrambleList: KingQueenTeam[] = new Array();
    malePlayers1: Player[];
    femalePlayers1: Player[];
    queriedPlayers: Player[];
    queriedScrambles: KingQueenTeam[];
    leaguesAvailable: Leagues[];
    gendersPossible: Gender[] = [{ value: 'Female', isMale: false }, { value: 'Male', isMale: true }];
    isSub: boolean;
    selectedGender: Gender;
    player: Player;
    randomMalePlayer: Player;
    randomFemalePlayer: Player;
    randomPlayer: Player;
    randomTopPlayer: Player;
    addedPlayer: Player;
    password: Password;
    passwordLeague: Password;
    passwordDelete: Password;
    listOfScrambleNumbers: number[] = [];
    teamSizePossible: number[] = [2, 3, 4, 5];
    maxNumberOfTeams: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    femalePlayerCount: number;
    malePlayerCount: number;
    topPlayerCount: number;
    randomPlayerCount: number;
    numberOfPlayersNeededTwo: number;
    numberOfPlayersNeededThree: number;
    numberOfPlayersNeededFour: number;
    brackets: number;
    teamCount: number;
    teamSize: number;
    numberOfTeams: number;
    scrambleNumber: number;
    containsMale: boolean = false;
    containsFemale: boolean = false;
    lockedResults: boolean = false;
    locked: boolean = false;
    hidePlayers: boolean = false;
    containsLeague: boolean = false;
    isSmallScreen = false;
    hideListOptions: boolean;
    hideInputOptions: boolean;
    selectedOption: boolean = false;
    isMale1: boolean;
    completeRandom: false;
    playerLoading: boolean;
    leagueName: string;
    selectedLeague: string;
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

    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService, private snackBar: MatSnackBar) {
        this.teamSize = 4;

    }

    ngOnInit() {
        this.completeRandom = false;
        this.displayTopPlayers = new Array();
        this.hideInputOptions = false;
        this.hideListOptions = false;
        this.hideEverything = false;
        this.checkScreenSize();
        // Subscribe to window resize events to update isSmallScreen
        window.addEventListener('resize', () => {
            this.checkScreenSize();
        });
        this.playerLoading = false;
        this.playerService.GetAllMalePlayers().subscribe(result => {
            this.malePlayers1 = result;
            this.malePlayerCount = result.length;
        }, error => console.error(error));

        this.playerService.GetAllFemalePlayers().subscribe(result => {
            this.femalePlayers1 = result;
            this.femalePlayerCount = result.length;
        }, error => console.error(error));

        this.playerService.GetNumberOfBrackets().subscribe(result => {
            this.brackets = result;
        }, error => console.error(error));
        this.playerService.GetPlayers().subscribe(result => {
            this.totalPlayers = result;
        }, error => console.error(error));
        this.playerService.GetLeagues().subscribe(result => {
            this.leaguesAvailable = result;

        }, error => console.error(error));
    }

    selectLeague() {
        this.playerLoading = true;
        this.playerService.SelectLeague(this.selectedLeague).subscribe(result => {
            this.queriedPlayers = result;
            this.malePlayerCount = result.length;
            this.femalePlayerCount = result.length;
            this.malePlayers1 = [];
            this.femalePlayers1 = [];
            for (let player of this.queriedPlayers) {

                if (player.isMale) {
                    this.malePlayers1.push(player);
                }
                else {
                    this.femalePlayers1.push(player);
                }
            }
            this.malePlayerCount = this.malePlayers1.length;
            this.femalePlayerCount = this.femalePlayers1.length;

            this.playerLoading = false;
        });
        this.playerService.SelectedLeagueScrambles(this.selectedLeague).subscribe(result => {
            this.queriedScrambles = result;

            this.playerLoading = false;
        });
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
    }

    updateScrambleNumbers(selectedItems: any[]) {
        // Clear the existing list and add selected items
        this.listOfScrambleNumbers.length = 0; // Clear the array
        selectedItems.forEach(selected => {
            this.listOfScrambleNumbers.push(selected.scrambleNumber);
        });
    }

    addLeague() {
        this.playerService.GetPassword().subscribe(result => {

            this.passwordLeague = result;
            if (this.LeagueForm.controls["passwordLeague"].value == "" || this.LeagueForm.controls["passwordLeague"].value != this.passwordLeague.password) {
                this.showSnackBar("Password is not correct.")
            }
            else {
                if (this.LeagueForm.controls["newLeagueName"].value == "") {
                    this.showSnackBar("Please enter a league name.")
                }
                else {
                    this.containsLeague = false;
                    for (var i = 0; i < this.leaguesAvailable.length; i++) {
                        if (this.leaguesAvailable[i].leagueName == this.LeagueForm.controls["newLeagueName"].value) {
                            this.containsLeague = true;
                            break;
                        }
                    }
                    if (this.containsLeague) {
                        this.showSnackBar('League name already exists.')
                    }
                    else {
                        this.playerService.AddNewLeague(this.LeagueForm.controls["newLeagueName"].value).subscribe(result => {

                            if (result.leagueName == null) {
                                this.showSnackBar('Error creating league.')
                            }
                            else {
                                this.leaguesAvailable.push(result);
                            }

                        }, error => console.error(error));
                    }


                }
            }
        });

    }

    hidePlayerList() {
        this.hidePlayers = !this.hidePlayers;
        var x = document.getElementById("playerListHidden");
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
    }

    hideOptions() {
        this.hideInputOptions = !this.hideInputOptions;
        this.hideListOptions = !this.hideListOptions;
        var x = document.getElementById("hideInputOptions");
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
        var y = document.getElementById("hideListOptions");
        if (y.style.display === "none") {
            y.style.display = "block";
        } else {
            y.style.display = "none";
        }
    }

    getTotalMaleSelectedPlayers() {
        return this.selectedList.filter(player => player.isMale).length;
    }

    getTotalFemaleSelectedPlayers() {
        return this.selectedList.filter(player => !player.isMale).length;
    }

    hideShowEverything() {
        this.hideEverything = !this.hideEverything;
        var z = document.getElementById("hideEverything");
        if (z.style.display === "none") {
            z.style.display = "block";
        } else {
            z.style.display = "none";
        }
    }

    deselectAllPlayers() {
        this.selectedList = [];
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


    }





    onDeletePlayerClick() {
        this.playerService.GetPassword().subscribe(result => {
            this.password = result;
            if (this.deletePlayerForm.controls["passwordDelete"].value == "" || this.deletePlayerForm.controls["passwordDelete"].value != this.password.password) {
                this.showSnackBar("Password is not correct.")
            }
            else {

                // Get the selected player's first and last name from the form controls
                const firstNameToDelete = this.deletePlayerForm.controls["firstName"].value;
                const lastNameToDelete = this.deletePlayerForm.controls["lastName"].value;

                if (!firstNameToDelete || !lastNameToDelete || !this.selectedLeague) {
                    this.showSnackBar("Please select both a player and a league to delete the player.");
                    return;
                }

                let deletingPlayer: Player = {

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
        });
    }
    onSubmitClick() {
        this.playerService.GetPassword().subscribe(result => {
            this.password = result;
            if (
                this.PlayerForm.controls["password"].value == "" ||
                this.PlayerForm.controls["password"].value != this.password.password
            ) {
                this.showSnackBar("Password is not correct.");
            } else {
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
        });
    }



    showSnackBar(message: string, error: boolean = false) {
        const config = new MatSnackBarConfig();
        config.verticalPosition = 'top'; // Set the vertical position to center
        config.horizontalPosition = 'center'; // Set the horizontal position to center

        if (error) {
            this.snackBar.open(message, 'Close', {
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



    topPlayerScramble(bracketTeamPlayers) {
        this.randomTopPlayer = this.totalTopPlayers[Math.floor(Math.random() * this.totalTopPlayers.length)];
        bracketTeamPlayers.push(this.randomTopPlayer);
        this.totalTopPlayers = this.totalTopPlayers.filter(x => x !== this.randomTopPlayer);
        if (this.randomTopPlayer.isMale) {
            this.malePlayers = this.malePlayers.filter(x => x !== this.randomTopPlayer);
            this.malePlayerCount = this.malePlayers.length;
        }
        if (!this.randomTopPlayer.isMale) {
            this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomTopPlayer);
            this.femalePlayerCount = this.femalePlayers.length;
        }
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomTopPlayer);
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
        }
    }

    addTopPlayers() {
        var c = confirm("Are you sure you want to add these players to top players?");
        if (c) {
            this.totalTopPlayers = new Array();
            for (let player of this.selectedList) {
                this.totalTopPlayers.push(player);
            }
            this.displayTopPlayers = this.totalTopPlayers;

            this.numberOfPlayersNeededTwo = this.displayTopPlayers.length * 2;
            this.numberOfPlayersNeededThree = this.displayTopPlayers.length * 3;
            this.numberOfPlayersNeededFour = this.displayTopPlayers.length * 4;
        }
    }

    addPlayerToTopPlayerList(player: Player) {
        this.totalTopPlayers.push(player);
        player.isTopPlayer = true;
        // Implement your logic here to add the player to a list or perform any desired action.
        // For example, you can add the player to an array:
        this.displayTopPlayers = this.totalTopPlayers;
        this.numberOfPlayersNeededTwo = this.displayTopPlayers.length * 2;
        this.numberOfPlayersNeededThree = this.displayTopPlayers.length * 3;
        this.numberOfPlayersNeededFour = this.displayTopPlayers.length * 4;
    }

    removePlayerFromTopPlayerList(player: Player) {
        // Find the index of the player in the totalTopPlayers array
        const playerIndex = this.totalTopPlayers.indexOf(player);

        if (playerIndex !== -1) {
            // Remove the player from the totalTopPlayers array
            this.totalTopPlayers.splice(playerIndex, 1);

            // Update the player's isTopPlayer status
            player.isTopPlayer = false;

            // Implement your logic here to update other variables as needed.
            this.displayTopPlayers = this.totalTopPlayers;
            this.numberOfPlayersNeededTwo = this.displayTopPlayers.length * 2;
            this.numberOfPlayersNeededThree = this.displayTopPlayers.length * 3;
            this.numberOfPlayersNeededFour = this.displayTopPlayers.length * 4;
        }
    }

    retrieveScramble(scramble: KingQueenTeam) {
        this.retrievedListOfTeams = [];
        this.playerService.getKingQueenTeamsByScrambleNumber(this.selectedLeague, scramble.scrambleNumber).subscribe(
            (matchups) => {
                // Initialize your list of teams
                this.listOfTeams = [];

                // Map the retrieved matchups into listOfTeams
                matchups.forEach((matchup) => {
                    const team: Team = {
                        players: matchup.players,
                        maleCount: matchup.players.filter(player => player.isMale).length,
                        femaleCount: matchup.players.filter(player => !player.isMale).length
                    };
                    this.listOfTeams.push(team);
                    this.retrievedListOfTeams.push(team);
                });
            },
            (error) => {
                // Handle any errors
                console.error('Error retrieving matchups:', error);
            }
        );
    }

    retrieveMultipleScrambles() {
        this.playerService.getMultipleKingQueenTeamsByScrambleNumbers(this.selectedLeague, this.listOfScrambleNumbers).subscribe(
            (matchups) => {
                // Initialize your list of teams
                this.listOfTeams = [];
                this.retrievedListOfTeams = [];
                // Map the retrieved matchups into listOfTeams
                matchups.forEach((matchup) => {
                    const team: Team = {
                        players: matchup.players,
                        maleCount: matchup.players.filter(player => player.isMale).length,
                        femaleCount: matchup.players.filter(player => !player.isMale).length
                    };
                    this.listOfTeams.push(team);
                    this.retrievedListOfTeams.push(team);
                });
            },
            (error) => {
                // Handle any errors
                console.error('Error retrieving matchups:', error);
            }
        );
    }

    clearTopPLayers() {
        this.totalTopPlayers = new Array();
        this.totalTopPlayers = new Array();
        this.displayTopPlayers = new Array();
        for (let player of this.malePlayers1) {
            player.isTopPlayer = false;
        }
        for (let player of this.femalePlayers1) {
            player.isTopPlayer = false;
        }
    }

    updateNumberOfTeams(selectedTeamSize: number): void {
        // Deselect the other mat-select when one is selected
        if (selectedTeamSize) {
            this.numberOfTeams = null;
        }
    }

    updateTeamSize(selectedNumberOfTeams: number): void {
        // Deselect the other mat-select when one is selected
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
                    kingQueenPlayers: team.players // You can initialize this as an empty array
                },
                players: team.players,
            };
        });

        try {
            const result = await this.playerService.saveKingQueenTeams(kingQueenTeamsWithPlayers, this.selectedLeague).toPromise();
            if (result && result.length > 0 && result[0].kingQueenTeam) {
                // Get the scramble number from the first team
                this.scrambleNumber = result[0].kingQueenTeam.scrambleNumber;
                this.showSnackBar('All KingQueenTeams saved successfully!');
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


    retrieveMatchups() {
        this.playerService.getKingQueenTeamsByScrambleNumber(this.selectedLeague, this.scrambleNumber).subscribe(
            (matchups) => {
                // Initialize your list of teams
                this.listOfTeams = [];

                // Map the retrieved matchups into listOfTeams
                matchups.forEach((matchup) => {
                    const team: Team = {
                        players: matchup.players,
                        maleCount: matchup.players.filter(player => player.isMale).length,
                        femaleCount: matchup.players.filter(player => !player.isMale).length
                    };
                    this.listOfTeams.push(team);
                    this.retrievedListOfTeams.push(team);
                });
            },
            (error) => {
                // Handle any errors
                console.error('Error retrieving matchups:', error);
            }
        );
    }






    // Check screen size and update isSmallScreen
    checkScreenSize() {
        this.isSmallScreen = window.innerWidth <= 768; // Adjust the screen size threshold as needed
    }

    selectPlayers(playerCount: number, isMale: boolean, nonDuplicates: boolean): boolean {
        for (var i = 0; i < playerCount; i++) {
            let bestTeam: Team = null;
            for (let i = 0; i < this.listOfTeams.length - 1; i++) {
                if (this.listOfTeams[i].players.length > this.listOfTeams[i + 1].players.length) {
                    bestTeam = this.listOfTeams[i + 1];
                } else if (this.listOfTeams[i].players.length < this.listOfTeams[i + 1].players.length) {
                    bestTeam = this.listOfTeams[i];
                }
            }
            if (bestTeam == null) {
                bestTeam = this.listOfTeams[0];
            }

            if (nonDuplicates) {
                if (isMale) {
                    if (!this.maleScramble2(bestTeam.players)) {
                        return false; // If maleScramble2 returns false, return false
                    }
                } else {
                    if (!this.femaleScramble2(bestTeam.players)) {
                        return false; // If femaleScramble2 returns false, return false
                    }
                }
            } else {
                if (isMale) {
                    if (!this.maleScramble(bestTeam.players)) {
                        return false; // If maleScramble returns false, return false
                    }
                } else {
                    if (!this.femaleScramble(bestTeam.players)) {
                        return false; // If femaleScramble returns false, return false
                    }
                }
            }
        }
        return true; // Return true if the selection was successful for all players
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

    selectPlayersWithRetries(
        nonDuplicates: boolean
    ): boolean {
        this.totalTopPlayersTemp = [...this.totalTopPlayers];
        this.totalPlayersTemp = [...this.totalPlayers];
        const maxRetries = 101; // Set a maximum number of retries
        for (let retry = 0; retry < maxRetries; retry++) {
            this.fillTopPlayers();
            
            let maleSuccess = this.selectPlayers(this.malePlayerCount, true, nonDuplicates);
            let femaleSuccess = this.selectPlayers(this.femalePlayerCount, false, nonDuplicates);
            if (maleSuccess && femaleSuccess) {

                // Player selection was successful, break out of the loop
                return true;
            }

            this.listOfTeams = [];
            this.malePlayers = [];
            this.femalePlayers = [];
            this.totalTopPlayers = [...this.totalTopPlayersTemp];
            this.totalPlayers = [...this.totalPlayersTemp];
            if (retry != 100 ) {
                this.fillPlayers();
                if (this.listOfTeams.length === 0) {
                    this.fillTeam()
                }
            }
            
            

            // You can add a delay between retries if needed
        }
        this.malePlayers = [];
        this.femalePlayers = [];
        this.retrievedListOfTeams = [];
        return false; // All retries failed
    }

    fillPlayers() {
        if (this.completeRandom) {
            for (let player of this.selectedList) {
                this.totalRandomPlayers.push(player);
            }
        }
        else {
            for (let player of this.selectedList) {
                if (player.isMale) {
                    this.malePlayers.push(player);
                }
                else {
                    this.femalePlayers.push(player);
                }
            }
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
                    maleCount: 0
                };
                this.listOfTeams.push(team);
            }
        
    }

    setTeamCount() {
        if (this.teamSize == 5) {
            if ((this.selectedList.length / 10) % 1 == 0) {
                this.teamCount = (Math.floor(this.selectedList.length / 10) * 2);
            }
            else {

                this.teamCount = (Math.floor(this.selectedList.length / 10) * 2) + 2;

            }
        }
        else if (this.teamSize == 4) {
            if ((this.selectedList.length / 8) % 1 == 0) {
                this.teamCount = (Math.floor(this.selectedList.length / 8) * 2);
            }
            else {

                this.teamCount = (Math.floor(this.selectedList.length / 8) * 2) + 2;

            }
        }
        else if (this.teamSize == 3) {
            if ((this.selectedList.length / 6) % 1 == 0) {
                this.teamCount = (Math.floor(this.selectedList.length / 6) * 2);
            }
            else {

                this.teamCount = (Math.floor(this.selectedList.length / 6) * 2) + 2;

            }
        }
        else if (this.teamSize == 2) {
            if ((this.selectedList.length / 4) % 1 == 0) {
                this.teamCount = (Math.floor(this.selectedList.length / 4) * 2);
            }
            else {

                this.teamCount = (Math.floor(this.selectedList.length / 4) * 2) + 2;

            }
        }
    }

    scramblePlayers(nonDuplicates: boolean = false) {
        this.totalTopPlayers = this.displayTopPlayers;
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
            if (this.numberOfTeams != null) {
                this.teamCount = this.numberOfTeams;
            }
            else {
                this.setTeamCount();
            }

            for (var i = 0; i < this.teamCount; i++) {
                let team = {
                    players: [],
                    femaleCount: 0,
                    maleCount: 0
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

                
                // Use the function to select players for both males and females with retries
                if (this.selectPlayersWithRetries(nonDuplicates)) {
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
            if (this.hideInputOptions == false) {
                this.hideOptions();
            }
        }
    }
}


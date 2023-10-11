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
    listOfTeams: Team[] = new Array();
    matchups: Team[] = new Array();
    selectedList: Player[] = new Array();
    malePlayers1: Player[];
    femalePlayers1: Player[];
    queriedPlayers: Player[];
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
        isSub: new FormControl()
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

    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService) {
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

    addLeague() {
        this.playerService.GetPassword().subscribe(result => {

            this.passwordLeague = result;
            if (this.LeagueForm.controls["passwordLeague"].value == "" || this.LeagueForm.controls["passwordLeague"].value != this.passwordLeague.password) {
                alert("Password is not correct.")
            }
            else {
                if (this.LeagueForm.controls["newLeagueName"].value == "") {
                    alert("Please enter a league name.")
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
                        alert('League name already exists.')
                    }
                    else {
                        this.playerService.AddNewLeague(this.LeagueForm.controls["newLeagueName"].value).subscribe(result => {

                            if (result.leagueName == null) {
                                alert('Error creating league.')
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
                alert("Password is not correct.")
            }
            else {

                // Get the selected player's first and last name from the form controls
                const firstNameToDelete = this.deletePlayerForm.controls["firstName"].value;
                const lastNameToDelete = this.deletePlayerForm.controls["lastName"].value;

                if (!firstNameToDelete || !lastNameToDelete || !this.selectedLeague) {
                    alert("Please select both a player and a league to delete the player.");
                    return;
                }

                let deletingPlayer: Player = {

                    firstName: firstNameToDelete,
                    lastName: lastNameToDelete,
                    gender: 'male',
                    isMale: true,
                    isSub: false,
                    id: null
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
                        alert("Player deleted successfully.");
                    }
                    // Find the player in the malePlayers1 array and remove it


                }, error => console.error(error));
            }
        });
    }

    onSubmitClick() {
        this.playerService.GetPassword().subscribe(result => {

            this.password = result;
            if (this.PlayerForm.controls["password"].value == "" || this.PlayerForm.controls["password"].value != this.password.password) {
                alert("Password is not correct.")
            }
            else {
                if (this.PlayerForm.controls["firstName"].value == "" || this.PlayerForm.controls["lastName"].value == "" || this.selectedGender == null) {
                    alert("Please ensure that both first and last name fields are filled in as well as the gender field.")
                }
                else {
                    let newPlayer: Player = {

                        firstName: this.PlayerForm.controls["firstName"].value,
                        lastName: this.PlayerForm.controls["lastName"].value,
                        gender: this.selectedGender.value,
                        isMale: this.selectedGender.isMale,
                        isSub: this.PlayerForm.controls["isSub"].value,
                        id: null
                    };

                    if (this.selectedLeague != null) {
                        this.playerService.AddPlayer(newPlayer, this.selectedLeague).subscribe(result => {
                            this.player = result;
                            this.containsFemale = false;
                            this.containsMale = false;
                            for (var i = 0; i < this.malePlayers1.length; i++) {
                                if (this.malePlayers1[i].firstName == result.firstName && this.malePlayers1[i].lastName == result.lastName) {
                                    this.containsMale = true;
                                    break;
                                }
                            }
                            for (var i = 0; i < this.femalePlayers1.length; i++) {
                                if (this.femalePlayers1[i].firstName == result.firstName && this.femalePlayers1[i].lastName == result.lastName) {
                                    this.containsFemale = true;
                                    break;
                                }
                            }
                            if (this.containsMale || this.containsFemale) {
                                alert('Player already in list.');
                            }
                            else {
                                if (newPlayer.isMale == true) {
                                    this.malePlayers1.push(newPlayer);
                                    this.malePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                                }

                                else {
                                    this.femalePlayers1.push(newPlayer);
                                    this.femalePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                                }
                            }
                        }
                            , error => console.error(error));
                    }
                    else {
                        alert("Please Select A League From The Dropdown");
                    }
                }
            }
        });
    }

    maleScramble(bracketTeamPlayers) {
        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
        bracketTeamPlayers.push(this.randomMalePlayer);
        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
    }

    femaleScramble(bracketTeamPlayers) {
        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
        bracketTeamPlayers.push(this.randomFemalePlayer);
        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);

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
            alert('Can not reset while results are locked. Please uncheck lock results and scramble again.');
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
        console.log('in league ', this.selectedLeague);

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
                alert('All KingQueenTeams saved successfully!');
            } else {
                // Handle the case where there was an issue with saving or no data returned
                alert('Error saving KingQueenTeams or no data returned!');
            }
        } catch (error) {
            // Handle errors, if any
            console.error('Error saving KingQueenTeams: ', error);
            alert('Error saving KingQueenTeams!');
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
                });
            },
            (error) => {
                // Handle any errors
                console.error('Error retrieving matchups:', error);
            }
        );
    }

    scrambleWithNoDuplicates() {
        // Add your logic to scramble teams here
        // Ensure there are no duplicate teams in the result
    }




    // Check screen size and update isSmallScreen
    checkScreenSize() {
        this.isSmallScreen = window.innerWidth <= 768; // Adjust the screen size threshold as needed
    }
    scramblePlayers() {
        this.totalTopPlayers = this.displayTopPlayers;
        if (!this.lockedResults) {
            this.locked = false;

        }
        if (this.locked) {
            alert('Results are currently locked. Please uncheck lock results to rescramble.')
        }
        else {

            this.listOfTeams = [];
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
            this.malePlayerCount = this.malePlayers.length;
            this.femalePlayerCount = this.femalePlayers.length;
            this.randomPlayerCount = this.totalRandomPlayers.length;
            this.topPlayerCount = this.totalTopPlayers.length;
            if (this.numberOfTeams != null) {
                this.teamCount = this.numberOfTeams;
            }
            else {
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
                for (var i = 0; i < this.malePlayerCount; i++) {

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
                    this.maleScramble(bestTeam.players);

                }

                for (var i = 0; i < this.femalePlayerCount; i++) {

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
                    this.femaleScramble(bestTeam.players);

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


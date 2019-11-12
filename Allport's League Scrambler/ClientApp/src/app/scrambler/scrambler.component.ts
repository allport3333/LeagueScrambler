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
@Component({
    selector: 'app-scrambler-component',
    templateUrl: './scrambler.component.html'
})
export class ScramblerComponent implements OnInit {
    totalPlayers: Player[];
    malePlayers: Player[] = new Array();
    femalePlayers: Player[] = new Array();
    totalRandomPlayers: Player[] = new Array();
    malePlayers1: Player[];
    femalePlayers1: Player[];
    femalePlayerCount: number;
    malePlayerCount: number;
    selectedMalePlayers: Player[];
    brackets: number;
    teamCount: number;
    hidePlayers: boolean = false;
    listOfTeams: Team[] = new Array();
    selectedList: Player[];
    randomMalePlayer: Player;
    randomFemalePlayer: Player;
    randomPlayer: Player;
    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl(),
        leagueName: new FormControl(),
        password: new FormControl()
    });
    players: Player[];
    player: Player;
    password: Password;
    addedPlayer: Player;
    completeRandom: false;
    lockedResults: boolean = false;
    locked: boolean = false;
    isMale1: boolean;
    leagueName: string;
    hideListOptions: boolean;
    hideInputOptions: boolean;
    queriedPlayers: Player[];
    leaguesAvailable: Leagues[];
    selectedLeague: string;
    gendersPossible: Gender[] = [{ value: 'Female', isMale: false }, { value: 'Male', isMale: true }];
    selectedGender: Gender;
    teamSizePossible: number[] = [2, 3, 4];
    teamSize: number;
    deepcCopyPlayersSelected: Player[];
    randomPlayerCount: number;
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService) {
        this.teamSize = 4;
    }

    selectLeague() {
        this.playerService.SelectLeague(this.selectedLeague).subscribe(result => {
            this.queriedPlayers = result;
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
        });
    }

    selectGender(gender) {

    }

    ngOnInit() {
        this.completeRandom = false;
        this.hideInputOptions = false;
        this.hideListOptions = false;
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

    addPlayer(player) {
        console.log(this.selectedList);
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

    maleScramble(bracketTeamPlayers) {
        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
        bracketTeamPlayers.push(this.randomMalePlayer);
        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);


    }

    onSubmitClick() {
        this.playerService.GetPassword().subscribe(result => {

            this.password = result;
            console.log(this.PlayerForm.controls["password"].value)
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
                        isMale: this.selectedGender.isMale
                    };

                    if (this.selectedLeague != null) {
                        this.playerService.AddPlayer(newPlayer, this.selectedLeague).subscribe(result => {
                            this.player = result;


                            if (newPlayer.isMale == true) {
                                this.malePlayers1.push(newPlayer);
                                this.malePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            }
                            else {
                                this.femalePlayers1.push(newPlayer);
                                this.femalePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            }

                        }, error => console.error(error));
                    }
                    else {
                        alert("Please Select A League From The Dropdown");
                    }
                }
            }
        });
    }

    femaleScramble(bracketTeamPlayers) {
        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
        bracketTeamPlayers.push(this.randomFemalePlayer);
        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);

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
        }
    }

    scramblePlayers() {
        if (!this.lockedResults) {
            this.locked = false;

        }
        if (this.locked) {
            alert('Results are currently locked. Please uncheck lock results to rescramble.')
        }
        else {

            this.reset();
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

            if (this.teamSize == 4) {
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


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
@Component({
    selector: 'app-scrambler-component',
    templateUrl: './scrambler.component.html'
})
export class ScramblerComponent implements OnInit {
    totalPlayers: Player[];
    malePlayers: Player[] = new Array();
    femalePlayers: Player[] = new Array();
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
    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl(),
        leagueName: new FormControl()

    });
    players: Player[];
    player: Player;
    addedPlayer: Player;
    isMale1: boolean;
    leagueName: string;
    hideInputOptions: boolean;
    queriedPlayers: Player[];
    leaguesAvailable: Leagues[];
    selectedLeague: string;
    gendersPossible: Gender[] = [{ value: 'Female', isMale: false }, { value: 'Male', isMale: true }];
    selectedGender: Gender;

    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService) {

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
        var x = document.getElementById("hideInputOptions");
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
    }

    maleScramble(bracketTeamPlayers) {
        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
        bracketTeamPlayers.push(this.randomMalePlayer);
        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);


    }

    onSubmitClick() {
        if (this.PlayerForm.controls["firstName"].value == "" || this.PlayerForm.controls["lastName"].value == "" || this.selectedGender == null) {
            alert("Please ensure that both first and last name fields are filled in as well as the gender field.")
        }
        else {
            let newplayer: Player = {

                firstName: this.PlayerForm.controls["firstName"].value,
                lastName: this.PlayerForm.controls["lastName"].value,
                gender: this.selectedGender.value,
                isMale: this.selectedGender.isMale
            };

            if (this.selectedLeague != null) {
                this.playerService.AddPlayer(newplayer, this.selectedLeague).subscribe(result => {
                    this.player = result;
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
                }, error => console.error(error));
            }
            else {
                alert("Please Select A League From The Dropdown");
            }
        }
    }

    femaleScramble(bracketTeamPlayers) {
        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
        bracketTeamPlayers.push(this.randomFemalePlayer);
        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);

    }

    reset() {
        this.listOfTeams = [];
    }

    scramblePlayers() {
        this.reset();
        for (let player of this.selectedList) {
            if (player.isMale) {
                this.malePlayers.push(player);

            }
            else {
                this.femalePlayers.push(player);
            }
        }
        this.malePlayerCount = this.malePlayers.length;
        this.femalePlayerCount = this.femalePlayers.length;
        if ((this.selectedList.length / 8) % 1 == 0) {
            this.teamCount = (Math.floor(this.selectedList.length / 8) * 2);
        }
        else {

            this.teamCount = (Math.floor(this.selectedList.length / 8) * 2) + 2;

        }
        for (var i = 0; i < this.teamCount; i++) {
            let team = {
                players: [],
                femaleCount: 0,
                maleCount: 0
            }
            this.listOfTeams.push(team)
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
}

       
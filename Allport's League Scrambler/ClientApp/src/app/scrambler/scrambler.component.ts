import { Component, Inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteSelectedEvent, MatSelectionListChange } from '@angular/material';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';
import { forEach } from '@angular/router/src/utils/collection';
import { Team } from '../data-models/teams.model';
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
    twoBracketsTeam1: Player[] = [];
    twoBracketsTeam2: Player[] = [];
    twoBracketsTeam3: Player[] = [];
    twoBracketsTeam4: Player[] = [];
    twoBracketsMaleCountTeam1: number = 0;
    twoBracketsFemaleCountTeam1: number = 0;
    selectedList: Player[];
    twoBracketsMaleCountTeam2: number = 0;
    twoBracketsFemaleCountTeam2: number = 0;
    twoBracketsMaleCountTeam3: number = 0;
    twoBracketsFemaleCountTeam3: number = 0;
    twoBracketsMaleCountTeam4: number = 0;
    twoBracketsFemaleCountTeam4: number = 0;
    randomMalePlayer: Player;
    randomFemalePlayer: Player;
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService) {

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
    }

    addPlayer(player) {
        console.log(this.selectedList);
        //this.totalPlayers.push(player.option._value);
        //this.selectedMalePlayers = player._value;
        //if (player.option._value.isMale) {
        //    this.malePlayers.push(player.option._value);
        //}
        //else {
        //    this.femalePlayers.push(player.option._value);
        //}
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

    maleScramble(bracketTeam) {
        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
        bracketTeam.push(this.randomMalePlayer);
        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);


    }

    femaleScramble(bracketTeam) {
        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
        bracketTeam.push(this.randomFemalePlayer);
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
        this.teamCount = (Math.floor(this.selectedList.length / 8) * 2) + 2;

        for (var i = 0; i < this.teamCount; i++){
            let team = {
                players: [],
                femaleCount: 0,
                maleCount: 0
            }
            this.listOfTeams.push(team)
        }

        // if (this.selectedList.length <= 8) {
        //     this.brackets = 1;
        //     for (var i = 0; i < 2; i++) {
        //         let team = {
        //             players: [],
        //             femaleCount: 0,
        //             maleCount: 0
        //         }
        //         this.listOfTeams.push(team)
        //     }


        // }
        // else if (this.selectedList.length > 8 && this.selectedList.length <= 16) {
        //     for (var i = 0; i < 4; i++) {
        //         let team = {
        //             players: [],
        //             femaleCount: 0,
        //             maleCount: 0
        //         }
        //         this.listOfTeams.push(team)
        //     }
        // }
        // else if (this.selectedList.length > 16 && this.selectedList.length <= 24) {
        //     for (var i = 0; i < 6; i++) {
        //         let team = {
        //             players: [],
        //             femaleCount: 0,
        //             maleCount: 0
        //         }
        //         this.listOfTeams.push(team)
        //     }
        // }
        // else if (this.selectedList.length > 24 && this.selectedList.length <= 36) {
        //     for (var i = 0; i < 8; i++) {
        //         let team = {
        //             players: [],
        //             femaleCount: 0,
        //             maleCount: 0
        //         }
        //         this.listOfTeams.push(team)
        //     }
        // }
        // else if (this.selectedList.length > 36 && this.selectedList.length <= 42) {
        //     for (var i = 0; i < 10; i++) {
        //         let team = {
        //             players: [],
        //             femaleCount: 0,
        //             maleCount: 0
        //         }
        //         this.listOfTeams.push(team)
        //     }
        // }
        // else if (this.selectedList.length > 50 && this.selectedList.length <= 58) {
        //     for (var i = 0; i < 12; i++) {
        //         let team = {
        //             players: [],
        //             femaleCount: 0,
        //             maleCount: 0
        //         }
        //         this.listOfTeams.push(team)
        //     }
        // }

        
        for (var i = 0; i < this.malePlayerCount; i++) {


            let bestTeam: Team = null;
            bestTeam = this.listOfTeams.sort((x, y) => x.players.length > y.players.length ? 1 : -1)[0];
            this.maleScramble(bestTeam.players);

        }

        for (var i = 0; i < this.femalePlayerCount; i++) {


            let bestTeam: Team = null;
            bestTeam = this.listOfTeams.sort((x, y) => x.players.length > y.players.length ? 1 : -1)[0];
            this.femaleScramble(bestTeam.players);

        }
    }
}
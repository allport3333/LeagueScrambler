import { Component, Inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteSelectedEvent } from '@angular/material';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';
import { forEach } from '@angular/router/src/utils/collection';
@Component({
    selector: 'app-scrambler-component',
    templateUrl: './scrambler.component.html'
})
export class ScramblerComponent implements OnInit {
    totalPlayers: Player[];
    malePlayers: Player[];
    femalePlayers: Player[];
    femalePlayerCount: number;
    malePlayerCount: number;
    brackets: number;
    twoBracketsTeam1: Player[] = new Array();
    twoBracketsTeam2: Player[] = new Array();
    twoBracketsTeam3: Player[] = new Array();
    twoBracketsTeam4: Player[] = new Array();
    twoBracketsMaleCountTeam1: number = 0;
    twoBracketsFemaleCountTeam1: number = 0;

    twoBracketsMaleCountTeam2: number= 0;
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
            this.malePlayers = result;
            this.malePlayerCount = result.length;
        }, error => console.error(error));

        this.playerService.GetAllFemalePlayers().subscribe(result => {
            this.femalePlayers = result;
            this.femalePlayerCount = result.length;
        }, error => console.error(error));

        this.playerService.GetNumberOfBrackets().subscribe(result => {
            this.brackets = result;
        }, error => console.error(error));
        this.playerService.GetPlayers().subscribe(result => {
            this.totalPlayers = result;
        }, error => console.error(error));
    }


    scramblePlayers() {
        if (this.brackets == 1) {
            for (let player of this.totalPlayers) {
                if (this.twoBracketsTeam1.length <= this.twoBracketsTeam2.length) {


                    if (this.twoBracketsMaleCountTeam1 <= this.twoBracketsFemaleCountTeam1 && this.malePlayers.length != 0) {
                        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                        this.twoBracketsTeam1.push(this.randomMalePlayer);
                        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                        this.malePlayerCount = this.malePlayerCount - 1;
                        this.twoBracketsMaleCountTeam1 = this.twoBracketsMaleCountTeam1 + 1;
                    }
                    else if (this.femalePlayers.length != 0) {
                        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                        this.twoBracketsTeam1.push(this.randomFemalePlayer);
                        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                        this.femalePlayerCount = this.femalePlayerCount - 1;
                        this.twoBracketsFemaleCountTeam1 = this.twoBracketsFemaleCountTeam1 + 1;
                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam2.length) {
                    if (this.twoBracketsMaleCountTeam2 <= this.twoBracketsFemaleCountTeam2 && this.malePlayers.length != 0) {
                        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                        this.twoBracketsTeam2.push(this.randomMalePlayer);
                        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                        this.malePlayerCount = this.malePlayerCount - 1;
                        this.twoBracketsMaleCountTeam2 = this.twoBracketsMaleCountTeam2 + 1;
                    }
                    else if (this.femalePlayers.length != 0) {
                        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                        this.twoBracketsTeam2.push(this.randomFemalePlayer);
                        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                        this.femalePlayerCount = this.femalePlayerCount - 1;
                        this.twoBracketsFemaleCountTeam2 = this.twoBracketsFemaleCountTeam2 + 1;
                    }
                }
            }
        }
        else if (this.brackets == 2) {
            for (let malePlayer of this.totalPlayers) {
                if (this.twoBracketsTeam1.length <= this.twoBracketsTeam2.length && this.twoBracketsTeam1.length <= this.twoBracketsTeam3.length && this.twoBracketsTeam1.length <= this.twoBracketsTeam4.length) {


                    if (this.twoBracketsMaleCountTeam1 <= this.twoBracketsFemaleCountTeam1 && this.malePlayers.length != 0) {
                        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                        this.twoBracketsTeam1.push(this.randomMalePlayer);
                        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                        this.malePlayerCount = this.malePlayerCount - 1;
                        this.twoBracketsMaleCountTeam1 = this.twoBracketsMaleCountTeam1 + 1;
                    }
                    else if (this.femalePlayers.length != 0) {
                        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                        this.twoBracketsTeam1.push(this.randomFemalePlayer);
                        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                        this.femalePlayerCount = this.femalePlayerCount - 1;
                        this.twoBracketsFemaleCountTeam1 = this.twoBracketsFemaleCountTeam1 + 1;
                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam2.length && this.twoBracketsTeam2.length <= this.twoBracketsTeam3.length && this.twoBracketsTeam2.length <= this.twoBracketsTeam4.length) {
                    if (this.twoBracketsMaleCountTeam2 <= this.twoBracketsFemaleCountTeam2 && this.malePlayers.length != 0) {
                        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                        this.twoBracketsTeam2.push(this.randomMalePlayer);
                        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                        this.malePlayerCount = this.malePlayerCount - 1;
                        this.twoBracketsMaleCountTeam2 = this.twoBracketsMaleCountTeam2 + 1;
                    }
                    else if (this.femalePlayers.length != 0) {
                        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                        this.twoBracketsTeam2.push(this.randomFemalePlayer);
                        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                        this.femalePlayerCount = this.femalePlayerCount - 1;
                        this.twoBracketsFemaleCountTeam2 = this.twoBracketsFemaleCountTeam2 + 1;
                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam3.length && this.twoBracketsTeam2.length > this.twoBracketsTeam3.length && this.twoBracketsTeam3.length <= this.twoBracketsTeam4.length) {
                    if (this.twoBracketsMaleCountTeam3 <= this.twoBracketsFemaleCountTeam3 && this.malePlayers.length != 0) {
                        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                        this.twoBracketsTeam3.push(this.randomMalePlayer);
                        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                        this.malePlayerCount = this.malePlayerCount - 1;
                        this.twoBracketsMaleCountTeam3 = this.twoBracketsMaleCountTeam3 + 1;
                    }
                    else if (this.femalePlayers.length != 0) {
                        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                        this.twoBracketsTeam3.push(this.randomFemalePlayer);
                        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                        this.femalePlayerCount = this.femalePlayerCount - 1;
                        this.twoBracketsFemaleCountTeam3 = this.twoBracketsFemaleCountTeam3 + 1;
                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam4.length && this.twoBracketsTeam2.length > this.twoBracketsTeam4.length && this.twoBracketsTeam3.length > this.twoBracketsTeam4.length) {
                    if (this.twoBracketsMaleCountTeam4 <= this.twoBracketsFemaleCountTeam4 && this.malePlayers.length != 0) {
                        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                        this.twoBracketsTeam4.push(this.randomMalePlayer);
                        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                        this.malePlayerCount = this.malePlayerCount - 1;
                        this.twoBracketsMaleCountTeam4 = this.twoBracketsMaleCountTeam4 + 1;
                    }
                    else if (this.femalePlayers.length != 0) {
                        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                        this.twoBracketsTeam4.push(this.randomFemalePlayer);
                        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                        this.femalePlayerCount = this.femalePlayerCount - 1;
                        this.twoBracketsFemaleCountTeam4 = this.twoBracketsFemaleCountTeam4 + 1;
                    }
                }
            }
        }
    }
}
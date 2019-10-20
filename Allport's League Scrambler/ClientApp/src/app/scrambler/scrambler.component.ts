import { Component, Inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteSelectedEvent, MatSelectionListChange } from '@angular/material';
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
    malePlayers: Player[] = new Array();
    femalePlayers: Player[] = new Array();
    malePlayers1: Player[];
    femalePlayers1: Player[];
    femalePlayerCount: number;
    malePlayerCount: number;
    selectedMalePlayers: Player[];
    brackets: number;
    hidePlayers: boolean = false;
    twoBracketsTeam1: Player[] = new Array();
    twoBracketsTeam2: Player[] = new Array();
    twoBracketsTeam3: Player[] = new Array();
    twoBracketsTeam4: Player[] = new Array();
    twoBracketsMaleCountTeam1: number = 0;
    twoBracketsFemaleCountTeam1: number = 0;
    selectedList: Player[];
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
        this.malePlayerCount = this.malePlayerCount - 1;

    }

    femaleScramble(bracketTeam) {
        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
        bracketTeam.push(this.randomFemalePlayer);
        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
        this.femalePlayerCount = this.femalePlayerCount - 1;
    }

    reset() {
        this.twoBracketsTeam1 = [];
        this.twoBracketsTeam2 = [];
        this.twoBracketsTeam3 = [];
        this.twoBracketsTeam4 = [];
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
        if (this.selectedList.length <= 8) {
            this.brackets = 1;
            for (let player of this.selectedList) {
                if (this.twoBracketsTeam1.length <= this.twoBracketsTeam2.length) {


                    if (this.twoBracketsMaleCountTeam1 <= this.twoBracketsFemaleCountTeam1 && this.malePlayers.length != 0) {
                        this.maleScramble(this.twoBracketsTeam1);
 
                    }
                    else if (this.femalePlayers.length != 0) {
                        this.femaleScramble(this.twoBracketsTeam1);

                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam2.length) {
                    if (this.twoBracketsMaleCountTeam2 <= this.twoBracketsFemaleCountTeam2 && this.malePlayers.length != 0) {
                        this.maleScramble(this.twoBracketsTeam2);

                    }
                    else if (this.femalePlayers.length != 0) {
                        this.femaleScramble(this.twoBracketsTeam2);

                    }
                }
            }
        }
        else if (this.selectedList.length > 8 && this.selectedList.length <= 16) {
            this.brackets = 2;
            for (let malePlayer of this.totalPlayers) {
                if (this.twoBracketsTeam1.length <= this.twoBracketsTeam2.length && this.twoBracketsTeam1.length <= this.twoBracketsTeam3.length && this.twoBracketsTeam1.length <= this.twoBracketsTeam4.length) {

                    if (this.twoBracketsMaleCountTeam1 <= this.twoBracketsFemaleCountTeam1 && this.malePlayers.length != 0) {
                        this.maleScramble(this.twoBracketsTeam1);

                    }
                    else if (this.femalePlayers.length != 0) {
                        this.femaleScramble(this.twoBracketsTeam1);

                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam2.length && this.twoBracketsTeam2.length <= this.twoBracketsTeam3.length && this.twoBracketsTeam2.length <= this.twoBracketsTeam4.length) {
                    if (this.twoBracketsMaleCountTeam2 <= this.twoBracketsFemaleCountTeam2 && this.malePlayers.length != 0) {
                        this.maleScramble(this.twoBracketsTeam2);

                    }
                    else if (this.femalePlayers.length != 0) {
                        this.femaleScramble(this.twoBracketsTeam2);

                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam3.length && this.twoBracketsTeam2.length > this.twoBracketsTeam3.length && this.twoBracketsTeam3.length <= this.twoBracketsTeam4.length) {
                    if (this.twoBracketsMaleCountTeam3 <= this.twoBracketsFemaleCountTeam3 && this.malePlayers.length != 0) {
                        this.maleScramble(this.twoBracketsTeam3);

                    }
                    else if (this.femalePlayers.length != 0) {
                        this.femaleScramble(this.twoBracketsTeam3);

                    }
                }
                else if (this.twoBracketsTeam1.length > this.twoBracketsTeam4.length && this.twoBracketsTeam2.length > this.twoBracketsTeam4.length && this.twoBracketsTeam3.length > this.twoBracketsTeam4.length) {
                    if (this.twoBracketsMaleCountTeam4 <= this.twoBracketsFemaleCountTeam4 && this.malePlayers.length != 0) {
                        this.maleScramble(this.twoBracketsTeam4);

                    }
                    else if (this.femalePlayers.length != 0) {
                        this.femaleScramble(this.twoBracketsTeam4);

                    }
                }
            }
        }
    }
}
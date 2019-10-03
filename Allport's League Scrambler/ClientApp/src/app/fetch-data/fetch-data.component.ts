import { Component, Inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteSelectedEvent } from '@angular/material';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';

@Component({
  selector: 'app-fetch-data',
  templateUrl: './fetch-data.component.html'
})
export class FetchDataComponent implements OnInit {
   players: Player[];
    player: Player;
    addedPlayer: Player;
    isMale1: boolean;
    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl()

    });

    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService) {

    }

    ngOnInit() {
        this.playerService.GetPlayers().subscribe(result => {
            this.players = result;
        }, error => console.error(error));

    }



    onSubmitClick() {
        
        if (this.PlayerForm.controls["isMale"].value == "Female") {
            this.isMale1 = false;
        }
        else if (this.PlayerForm.controls["isMale"].value == "Male") {
            this.isMale1 = true;
        }
        let newplayer: Player = {
            
            firstName: this.PlayerForm.controls["firstName"].value,
            lastName: this.PlayerForm.controls["lastName"].value,
            gender: this.PlayerForm.controls["isMale"].value,
            isMale: this.isMale1
        };
        

        this.playerService.AddPlayer(newplayer).subscribe(result => {
            this.player = result;
            this.players.push(newplayer);
        }, error => console.error(error));
    }



}



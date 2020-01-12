import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteSelectedEvent, MatTableDataSource, MatSort } from '@angular/material';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';

@Component({
  selector: 'app-fetch-data',
    templateUrl: './fetch-data.component.html',
    styleUrls: ['./fetch-data.component.less']
})
export class FetchDataComponent implements OnInit {
    players: Player[];
    loading: boolean;
    player: Player;
    addedPlayer: Player;
    isMale1: boolean;
    leagueName: string;
    dataSource = new MatTableDataSource();
    displayedColumns: string[] = ['firstName', 'lastName', 'gender']
    PlayerForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        isMale: new FormControl(),
        leagueName: new FormControl()

    });
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatSort) set matSort(ms: MatSort) {
        this.sort = ms;
        this.setDataSourceAttributes();
    }
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService) {

    }
    setDataSourceAttributes() {
        this.dataSource.sort = this.sort;
    }
    ngOnInit() {
        this.loading = true;
        this.dataSource.sort = this.sort;
        this.playerService.GetPlayers().subscribe(result => {
            this.players = result;
            this.dataSource = new MatTableDataSource(result);;
            this.loading = false;
        }, error => console.error(error));

    }

    applyFilter(filterValue: string) {
        this.dataSource.filter = filterValue.trim().toLowerCase();
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
        

        this.playerService.AddPlayer(newplayer, this.PlayerForm.controls["leagueName"].value).subscribe(result => {
            this.player = result;
            this.players.push(newplayer);
        }, error => console.error(error));
    }



}



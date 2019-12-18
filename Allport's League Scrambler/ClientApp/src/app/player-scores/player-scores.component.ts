import { Component, Inject, OnInit } from '@angular/core';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StatisticsService } from '../services/statistics.service';
import { Team } from '../data-models/teams.model';
import { PlayerScores } from '../data-models/playerScores.model';
import { PlayerInformation } from '../data-models/playerInformation';
@Component({
    selector: 'app-player-scores',
    templateUrl: './player-scores.component.html',
    styleUrls: ['./player-scores.component.less']
})
export class PlayerScoresComponent implements OnInit{
    players: PlayerInformation[];
    player: PlayerInformation;
    leagueID: number = 1;
    loading: boolean = true;
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService, public statisticsService: StatisticsService) {
        
    }

    ngOnInit() {
        this.loading = true;
        this.statisticsService.GetPlayers(this.leagueID).subscribe(result => {
            this.players = result;
            this.loading = false;
        }, error => console.error(error));

    }
}

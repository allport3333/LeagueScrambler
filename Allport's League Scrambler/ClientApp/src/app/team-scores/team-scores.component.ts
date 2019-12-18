import { Component, Inject, OnInit } from '@angular/core';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StatisticsService } from '../services/statistics.service';
import { Team } from '../data-models/teams.model';
@Component({
    selector: 'app-team-scores',
    templateUrl: './team-scores.component.html',
    styleUrls: ['./team-scores.component.less']
})
export class TeamScoresComponent implements OnInit{
    teams: Team[];
    team: Team;
    leagueID: number = 1;
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService, public statisticsService: StatisticsService) {
        
    }

    ngOnInit() {
        this.statisticsService.GetTeams(this.leagueID).subscribe(result => {
            this.teams = result;
        }, error => console.error(error));

    }
}

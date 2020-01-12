import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StatisticsService } from '../services/statistics.service';
import { Team } from '../data-models/teams.model';
import { Leagues } from '../data-models/leagues.model';
import { NewCreatedTeam } from '../data-models/newCreatedTeam.model';
import { LeagueTeams } from '../data-models/leagueTeams.model';
import { TeamScores } from '../data-models/teamScores.model';
import { Schedule } from '../data-models/schedule.model';
import { forEach } from '@angular/router/src/utils/collection';

@Component({
    selector: 'app-schedule',
    templateUrl: './schedule.component.html',
    styleUrls: ['./schedule.component.less']
})
export class ScheduleComponent implements OnInit {
    loading: boolean;
    leagueSchedule: Schedule;
    leagueSchedules: Schedule[];
    teams: LeagueTeams[];
    selectedLeague: string;
    weeks: number;
    leagueID: number;
    leaguesAvailable: Leagues[];
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService, public statisticsService: StatisticsService) {

    }
    ngOnInit() {
        this.loading = true;
        this.playerService.GetLeagues().subscribe(result => {
            this.leaguesAvailable = result;
            this.loading = false;
        }, error => console.error(error));
        this.weeks = 12;


    }

    onSubmitClick() {

    }



    getTeams() {
        this.statisticsService.GetTeams(this.selectedLeague).subscribe(result => {
            this.teams = result;
            for (let team of this.teams) {
                this.leagueID = team.leagueID
            }
        }, error => console.error(error));
    }
}

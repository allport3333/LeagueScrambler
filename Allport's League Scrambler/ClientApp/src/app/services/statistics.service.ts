import { Component, Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Player } from '../data-models/player.model';
import { Leagues } from '../data-models/leagues.model';
import { TeamScores } from '../data-models/teamScores.model';
import { PlayerScores } from '../data-models/playerScores.model';
import { Team } from '../data-models/teams.model';
import { Password } from '../data-models/password.model';
import { PlayerInformation } from '../data-models/playerInformation';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {

    constructor(http: HttpClient, @Inject('BASE_URL') public baseUrl: string, public httpClient: HttpClient) {
    }

    public GetPlayers(leagueID: number) {
        return this.httpClient.get<PlayerInformation[]>(this.baseUrl + 'api/Statistics/GetPlayers/' + leagueID);
    }


    public GetTeams(leagueID: number) {
        return this.httpClient.get<Team[]>(this.baseUrl + 'api/Statistics/GetTeams/' + leagueID);
    }

}



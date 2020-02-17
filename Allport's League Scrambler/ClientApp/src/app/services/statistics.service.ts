import { Component, Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Player } from '../data-models/player.model';
import { Leagues } from '../data-models/leagues.model';
import { TeamScores } from '../data-models/teamScores.model';
import { PlayerScores } from '../data-models/playerScores.model';
import { Team } from '../data-models/teams.model';
import { Password } from '../data-models/password.model';
import { PlayerInformation } from '../data-models/playerInformation';
import { LeagueTeams } from '../data-models/leagueTeams.model';
import { NewCreatedTeam } from '../data-models/newCreatedTeam.model';
import { LeagueTeamScores } from '../data-models/leagueTeamScores.model';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {

    constructor(http: HttpClient, @Inject('BASE_URL') public baseUrl: string, public httpClient: HttpClient) {
    }

    public GetPlayers(leagueID: number) {
        return this.httpClient.get<PlayerInformation[]>(this.baseUrl + 'api/Statistics/GetPlayers/' + leagueID);
    }

    public AddScore(newScore: TeamScores[]) {
        return this.httpClient.post<TeamScores[]>(this.baseUrl + 'api/Statistics/AddScore/', newScore);
    }

    public GetTeams(leagueName: string) {
        return this.httpClient.get<LeagueTeams[]>(this.baseUrl + 'api/Statistics/GetTeams/' + leagueName);
    }

    public GetTeamScores(date: Date, leagueName: string) {
        return this.httpClient.get<LeagueTeamScores[]>(this.baseUrl + 'api/Statistics/GetTeamScores/' + date.toUTCString() + '/' + leagueName);
    }

    public UpdateTeamScores(leagueName: string) {
        return this.httpClient.get<LeagueTeams[]>(this.baseUrl + 'api/Statistics/UpdateTeamScores/' + leagueName);
    }

    public AddTeam(team: NewCreatedTeam) {
        return this.httpClient.post<LeagueTeams>(this.baseUrl + 'api/Statistics/AddTeam/', team);
    }

}



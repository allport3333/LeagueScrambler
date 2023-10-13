import { Component, Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Player } from '../data-models/player.model';
import { Leagues } from '../data-models/leagues.model';
import { Password } from '../data-models/password.model';
import { KingQueenTeamWithPlayers } from '../data-models/KingQueenTeamWithPlayers.model';
import { Observable } from 'rxjs';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';

@Injectable({
    providedIn: 'root'
})
export class PlayerService {
    players: Player[];

    constructor(http: HttpClient, @Inject('BASE_URL') public baseUrl: string, public httpClient: HttpClient) {
    }

    public GetPlayers() {
        return this.httpClient.get<Player[]>(this.baseUrl + 'api/ScrambleData/GetPlayers');
    }

    public GetLeagues() {
        return this.httpClient.get<Leagues[]>(this.baseUrl + 'api/ScrambleData/GetLeagues');
    }

    public GetPassword() {
        return this.httpClient.get<Password>(this.baseUrl + 'api/ScrambleData/GetPassword');
    }

    public GetAllMalePlayers() {
        return this.httpClient.get<Player[]>(this.baseUrl + 'api/ScrambleData/GetAllMalePlayers');
    }

    public SelectLeague(leagueName: string) {
        return this.httpClient.get<Player[]>(this.baseUrl + 'api/ScrambleData/SelectLeague/' + leagueName);
    }

    public GetAllFemalePlayers() {
        return this.httpClient.get<Player[]>(this.baseUrl + 'api/ScrambleData/GetAllFemalePlayers');
    }

    public GetNumberOfBrackets() {
        return this.httpClient.get<number>(this.baseUrl + 'api/ScrambleData/GetNumberOfBrackets');
    }

    public AddPlayer(player: Player, leagueName: string) {
        return this.httpClient.post<Player>(this.baseUrl + 'api/ScrambleData/AddPlayer/' + leagueName, player);
    }

    public saveKingQueenTeams(teamsWithPlayers: KingQueenTeamWithPlayers[], leagueName: string): Observable<KingQueenTeamWithPlayers[]> {
        // Make a POST request to your controller with leagueName appended to the URL
        return this.httpClient.post<KingQueenTeamWithPlayers[]>(
            `${this.baseUrl}api/ScrambleData/SaveKingQueenTeams/${leagueName}`,
            teamsWithPlayers
        );
    }

    // New method to retrieve KingQueenTeams by ScrambleNumber
    getKingQueenTeamsByScrambleNumber(leagueName: string, scrambleNumber: number): Observable<KingQueenTeamWithPlayers[]> {
        return this.httpClient.get<KingQueenTeamWithPlayers[]>(
            `${this.baseUrl}api/ScrambleData/GetKingQueenTeamsByScrambleNumber/${leagueName}/${scrambleNumber}`
        );
    }


    public DeletePlayer(player: Player, leagueName: string) {
        return this.httpClient.post<Player>(this.baseUrl + 'api/ScrambleData/DeletePlayer/' + leagueName, player);
    }


    public AddNewLeague(leagueName: string) {
        return this.httpClient.post<Leagues>(this.baseUrl + 'api/ScrambleData/AddNewLeague/' + leagueName, []);
    }

}



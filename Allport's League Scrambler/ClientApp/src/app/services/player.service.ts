import { Component, Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';

import { Player } from '../data-models/player.model';
import { Leagues } from '../data-models/leagues.model';
import { Password } from '../data-models/password.model';
import { KingQueenTeamWithPlayers } from '../data-models/KingQueenTeamWithPlayers.model';
import { Observable } from 'rxjs';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';
import { KingQueenTeamsResponse } from '../data-models/kingQueenTeamsResponse';
import { KingQueenRoundScoresResponse } from '../data-models/kingQueenRoundScoresResponse';
import { KingQueenRoundScore } from '../data-models/KingQueenRoundScore';
import { KingQueenRoundScoresRequest } from '../data-models/kingQueenRoundScoresRequest';
import { PlayerScoresResponse, PlayerScoreGroup, RoundScore } from '../data-models/playerScoresResponse';

@Injectable({
    providedIn: 'root'
})
export class PlayerService {
    players: Player[];

    constructor(@Inject('BASE_URL') public baseUrl: string, public httpClient: HttpClient) {
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

    public SelectedLeagueScrambles(leagueName: string) {
        return this.httpClient.get<KingQueenTeam[]>(this.baseUrl + 'api/ScrambleData/SelectedLeagueScrambles/' + leagueName);
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

    public saveKingQueenTeams(
        teamsWithPlayers: KingQueenTeamWithPlayers[],
        leagueName: string,
        byePlayers: Player[]
    ): Observable<KingQueenTeamsResponse> {
        // Prepare the request using the SaveKingQueenTeamsResponse model
        const request: KingQueenTeamsResponse = {
            kingQueenTeams: teamsWithPlayers,
            byePlayers: byePlayers
        };
        // Send the request and expect a response of type SaveKingQueenTeamsResponse
        return this.httpClient.post<KingQueenTeamsResponse>(
            `${this.baseUrl}api/ScrambleData/SaveKingQueenTeams/${leagueName}`,
            request
        );
    }

    getStandingsByLeague(leagueName: string): Observable<PlayerScoresResponse> {
        return this.httpClient.get<PlayerScoresResponse>(
            `${this.baseUrl}api/ScrambleData/GetByLeague/${leagueName}`
        );
    }

    getStandingsByLeagueMatchup(leagueName: string): Observable<PlayerScoresResponse> {
        return this.httpClient.get<PlayerScoresResponse>(
            `${this.baseUrl}api/ScrambleData/GetByLeagueMatchup/${leagueName}`
        );
    }

    // New method to retrieve KingQueenTeams by ScrambleNumber
    getKingQueenTeamsByScrambleNumber(leagueName: string, scrambleNumber: number): Observable<KingQueenTeamsResponse> {
        return this.httpClient.get<KingQueenTeamsResponse>(
            `${this.baseUrl}api/ScrambleData/GetKingQueenTeamsByScrambleNumber/${leagueName}/${scrambleNumber}`
        );
    }

    getMultipleKingQueenTeamsByScrambleNumbers(leagueName: string, scrambleNumbers: number[]): Observable<KingQueenTeamsResponse> {
        const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
        const options = { headers: headers };
        return this.httpClient.post<KingQueenTeamsResponse>(
            `${this.baseUrl}api/ScrambleData/GetKingQueenTeamsByScrambleNumbers/${leagueName}`, scrambleNumbers, options
            
        );
    }

    public saveKingQueenRoundScores(
        roundScores: KingQueenRoundScore[],
        leagueName: string
    ): Observable<KingQueenRoundScoresResponse> {
        // Prepare the request object
        const request: KingQueenRoundScoresRequest = {
            roundScores: roundScores
        };

        console.log('request', request);
        // Send the request and expect a response of type KingQueenRoundScoresResponse
        return this.httpClient.post<KingQueenRoundScoresResponse>(
            `${this.baseUrl}api/ScrambleData/SaveKingQueenRoundScores/${leagueName}`,
            request
        );
    }



    public DeletePlayer(player: Player, leagueName: string) {
        return this.httpClient.post<Player>(this.baseUrl + 'api/ScrambleData/DeletePlayer/' + leagueName, player);
    }


    public AddNewLeague(leagueName: string) {
        return this.httpClient.post<Leagues>(this.baseUrl + 'api/ScrambleData/AddNewLeague/' + leagueName, []);
    }

}



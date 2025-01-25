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
import { PlayerSignIn } from '../data-models/playerSignIn.model';
import { PlayerSignInResult } from '../data-models/playerSignInResult.model';
import { Team } from '../data-models/teams.model';

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

    public GetPlayerByFirstLastName(firstName: string, lastName: string): Observable<Player[]> {
        const params = new HttpParams().set('firstName', firstName).set('lastName', lastName);
        return this.httpClient.get<Player[]>(`${this.baseUrl}api/ScrambleData/GetPlayerByFirstLastName`, { params });
    }

    public getSignInLockStatus(leagueId: number): Observable<boolean> {
        return this.httpClient.get<boolean>(`${this.baseUrl}api/Login/GetLockSignInStatus/${leagueId}`);
    }

    public getPlayerByPlayerId(): Observable<Player> {
        return this.httpClient.get<Player>(`${this.baseUrl}api/Login/GetPlayerByPlayerId`);
    }

    public getPlayerByPlayerIdVariable(playerId: number): Observable<Player> {
        return this.httpClient.get<Player>(`${this.baseUrl}api/Login/GetPlayerByPlayerIdVariable/${playerId}`);
    }

    public setSignInLockStatus(locked: boolean, leagueId: number): Observable<boolean> {
        return this.httpClient.post<boolean>(`${this.baseUrl}api/Login/SetLockSignInStatus`, {
            locked: locked,
            leagueId: leagueId
        });
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

    getScrambleNumbers(leagueId: number): Observable<number[]> {
        return this.httpClient.get<number[]>(this.baseUrl + `api/ScrambleData/GetScrambleNumbers?leagueId=${leagueId}`);
    }

    public saveTeamScores(scores: any[]): Observable<any> {
        return this.httpClient.post(`${this.baseUrl}api/ScrambleData/SaveCreatedTeamScores`, scores);
    }

    getTeamsByScrambleNumber(leagueId: number, scrambleNumber: number): Observable<Team[]> {
        return this.httpClient.get<Team[]>(`${this.baseUrl}api/ScrambleData/GetTeamsByScrambleNumber?leagueId=${leagueId}&scrambleNumber=${scrambleNumber}`);
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

    public searchPlayers(searchTerm: string) {
        return this.httpClient.get<any[]>(this.baseUrl + `api/ScrambleData/SearchPlayers?searchTerm=${searchTerm}`);
    }

    public claimPlayer(data: { userId: number; playerId: number }): Observable<any> {
        return this.httpClient.post(this.baseUrl + `api/ScrambleData/claimPlayer`, data);
    }

    public addPlayerWithoutLeague(player: any): Observable<any> {
        return this.httpClient.post(this.baseUrl + '/api/ScrambleData/AddPlayerWithoutLeague', player);
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

    public getStandingsByLeague(leagueName: string): Observable<PlayerScoresResponse> {
        return this.httpClient.get<PlayerScoresResponse>(
            `${this.baseUrl}api/ScrambleData/GetByLeague/${leagueName}`
        );
    }

    public getStandingsByLeagueMatchup(leagueName: string): Observable<PlayerScoresResponse> {
        return this.httpClient.get<PlayerScoresResponse>(
            `${this.baseUrl}api/ScrambleData/GetByLeagueMatchup/${leagueName}`
        );
    }

    public getSignedInPlayers(leagueId: number, date: string): Observable<PlayerSignInResult[]> {
        const params = new HttpParams()
            .set('leagueId', leagueId.toString())
            .set('date', date);

        return this.httpClient.get<PlayerSignInResult[]>(this.baseUrl + 'api/ScrambleData/GetSignedInPlayers', { params });
    }

    public getSelectedPlayersAsPlayers(leagueId: number, date: Date): Observable<Player[]> {
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`; // Format as MM/dd/yyyy
        const url = `${this.baseUrl}api/ScrambleData/GetSignedInPlayersAsPlayers?leagueId=${leagueId}&date=${formattedDate}`;
        return this.httpClient.get<Player[]>(url);
    }
    public getTopPlayersForLeague(leagueId: number, maxPlayers: number): Observable<Player[]> {
        const url = `${this.baseUrl}api/ScrambleData/GetTopPlayers?leagueId=${leagueId}&maxPlayers=${maxPlayers}`;
        return this.httpClient.get<Player[]>(url);
    }

    public GetPlayersByLeague(leagueID: number) {
        return this.httpClient.get<any[]>(this.baseUrl + 'api/ScrambleData/GetPlayers/' + leagueID);
    }

    // New method to retrieve KingQueenTeams by ScrambleNumber
    public getKingQueenTeamsByScrambleNumber(leagueName: string, scrambleNumber: number): Observable<KingQueenTeamsResponse> {
        return this.httpClient.get<KingQueenTeamsResponse>(
            `${this.baseUrl}api/ScrambleData/GetKingQueenTeamsByScrambleNumber/${leagueName}/${scrambleNumber}`
        );
    }

    public getMultipleKingQueenTeamsByScrambleNumbers(leagueName: string, scrambleNumbers: number[]): Observable<KingQueenTeamsResponse> {
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

        // Send the request and expect a response of type KingQueenRoundScoresResponse
        return this.httpClient.post<KingQueenRoundScoresResponse>(
            `${this.baseUrl}api/ScrambleData/SaveKingQueenRoundScores/${leagueName}`,
            request
        );
    }

    public searchPlayersInLeague(searchTerm: string, leagueName: string) {
        return this.httpClient.get<any[]>(
            this.baseUrl + `api/ScrambleData/SearchPlayersInLeague?searchTerm=${searchTerm}&leagueName=${leagueName}`
        );
    }

    public DeletePlayer(player: Player, leagueName: string) {
        return this.httpClient.post<Player>(this.baseUrl + 'api/ScrambleData/DeletePlayer/' + leagueName, player);
    }

    public updateKingQueenPlayerSubStatus(
        kingQueenTeamId: number,
        playerId: number,
        isSubScore: boolean
    ): Observable<void> {
        // Prepare the request payload
        const payload = {
            kingQueenTeamId: kingQueenTeamId,
            playerId: playerId,
            isSubScore: isSubScore
        };

        // Send the request and expect no return data
        return this.httpClient.post<void>(
            `${this.baseUrl}api/ScrambleData/UpdateKingQueenPlayerSubStatus`,
            payload
        );
    }

    public getKingQueenTeamDetails(teamId: number, playerId: number): Observable<KingQueenTeam> {
        return this.httpClient.get<KingQueenTeam>(`/api/kingqueenteam/${teamId}/player/${playerId}`);
    }


    public AddNewLeague(leagueName: string) {
        return this.httpClient.post<Leagues>(this.baseUrl + 'api/ScrambleData/AddNewLeague/' + leagueName, []);
    }

    public signInPlayer(playerSignIn: PlayerSignIn): Observable<any> {
        return this.httpClient.post<PlayerSignIn>(this.baseUrl + 'api/ScrambleData/SignInPlayer', playerSignIn);
    }

    public deleteSignInPlayer(playerSignInId: number): Observable<void> {
        return this.httpClient.delete<void>(this.baseUrl + `api/ScrambleData/SignInPlayer/${playerSignInId}`);
    }

    generateScramble(
        leagueName: string,
        request: KingQueenTeamsResponse
    ): Observable<KingQueenTeam[]> {
        const url = `${this.baseUrl}api/ScrambleData/GenerateScramble/${leagueName}`;
        const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

        // Because the endpoint returns List<KingQueenTeam>,
        // we expect an array of KingQueenTeam in the response.
        return this.httpClient.post<KingQueenTeam[]>(url, request, { headers });
    }
}



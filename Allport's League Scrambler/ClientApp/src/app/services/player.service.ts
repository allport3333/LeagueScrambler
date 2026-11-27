import { Component, Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';

import { Player } from '../data-models/player.model';
import { ProfileMatch } from '../data-models/profile-match';
import { Leagues } from '../data-models/leagues.model';
import { KingQueenTeamWithPlayers } from '../data-models/KingQueenTeamWithPlayers.model';
import { Observable, of } from 'rxjs';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';
import { KingQueenTeamsResponse } from '../data-models/kingQueenTeamsResponse';
import { KingQueenRoundScoresResponse } from '../data-models/kingQueenRoundScoresResponse';
import { KingQueenRoundScore } from '../data-models/KingQueenRoundScore';
import { KingQueenRoundScoresRequest } from '../data-models/kingQueenRoundScoresRequest';
import { PlayerScoresResponse, PlayerScoreGroup, RoundScore } from '../data-models/playerScoresResponse';
import { PlayerSignIn } from '../data-models/playerSignIn.model';
import { PlayerSignInResult } from '../data-models/playerSignInResult.model';
import { Team } from '../data-models/teams.model';
import { map, catchError, finalize, shareReplay, timeout } from 'rxjs/operators';

export type LeagueAttendanceMode = 'automatic' | 'open' | 'locked';

export interface LeagueAttendanceAvailability {
    mode: LeagueAttendanceMode;
    locked: boolean;
    reason: string | null;
    period: string;
    attendanceDate: string;
}

@Injectable({
    providedIn: 'root'
})
export class PlayerService {
    players: Player[];
    private existingMembershipRequests = new Map<string, Observable<any>>();

    availableLeaguePlayers(leagueId: number): Observable<any> {
        return this.httpClient.get<any>(this.baseUrl + 'api/ScrambleData/AvailableLeaguePlayers/' + leagueId);
    }
    leagueImportContext(leagueId: number): Observable<any> {
        return this.httpClient.get<any>(this.baseUrl + 'api/ScrambleData/AvailableLeaguePlayers/' + leagueId + '?includeMembers=true');
    }
    leagueRosterContext(leagueId: number): Observable<any> {
        return this.httpClient.get<any>(this.baseUrl + 'api/ScrambleData/AvailableLeaguePlayers/' + leagueId + '?includeMembers=true&membersOnly=true');
    }
    updateLeaguePlayerDivision(leagueId:number, playerId:number, divisionId:number, expectedDivisionId:number):Observable<any> {
        return this.httpClient.put<any>(this.baseUrl+'api/ScrambleData/LeaguePlayerDivision/'+leagueId+'/'+playerId,{divisionId,expectedDivisionId}).pipe(timeout(20000));
    }
    updateLeaguePlayer(leagueId:number,playerId:number,changes:any):Observable<any>{
        return this.httpClient.put<any>(this.baseUrl+'api/ScrambleData/LeaguePlayer/'+leagueId+'/'+playerId,changes).pipe(timeout(20000));
    }
    importLeaguePlayers(leagueId: number, players: { playerId: number; divisionId: number }[]): Observable<any> {
        return this.httpClient.post<any>(this.baseUrl + 'api/ScrambleData/ImportLeaguePlayers/' + leagueId, { players })
            .pipe(timeout(30000), shareReplay(1));
    }
    leaguePlayerMembership(leagueId: number, playerId: number): Observable<any> {
        return this.httpClient.get<any>(this.baseUrl + 'api/ScrambleData/AvailableLeaguePlayers/' + leagueId + '?memberPlayerId=' + playerId);
    }
    addExistingLeaguePlayer(leagueId: number, leagueName: string, playerId: number, divisionId: number): Observable<any> {
        const key = leagueId + ':' + playerId;
        if (this.existingMembershipRequests.has(key)) return this.existingMembershipRequests.get(key);
        const request = this.httpClient.post<any>(this.baseUrl + 'api/ScrambleData/AddPlayer/' + encodeURIComponent(leagueName) +
            '?existingOnly=true&expectedLeagueId=' + leagueId + '&leagueDivisionId=' + divisionId, { id: playerId }).pipe(
                timeout(20000), finalize(() => this.existingMembershipRequests.delete(key)), shareReplay(1));
        this.existingMembershipRequests.set(key, request);
        return request;
    }

    constructor(@Inject('BASE_URL') public baseUrl: string, public httpClient: HttpClient) {
    }

    getSelfAttendance(leagueId:number,playerId:number){return this.httpClient.get<any>(this.baseUrl+'api/PlayerAttendance/'+leagueId+'/'+playerId);}
    changeSelfAttendance(leagueId:number,playerId:number,remove:boolean){const url=this.baseUrl+'api/PlayerAttendance/'+leagueId+'/'+playerId;return remove?this.httpClient.delete<any>(url):this.httpClient.post<any>(url,{});}
    public GetPlayers() {
        return this.httpClient.get<Player[]>(this.baseUrl + 'api/ScrambleData/GetPlayers');
    }

    public GetPlayerByFirstLastName(firstName: string, lastName: string): Observable<Player[]> {
        const params = new HttpParams().set('firstName', firstName).set('lastName', lastName);
        return this.httpClient.get<Player[]>(`${this.baseUrl}api/ScrambleData/GetPlayerByFirstLastName`, { params });
    }

    public getLeagueAttendanceAvailability(leagueId: number): Observable<LeagueAttendanceAvailability> {
        return this.httpClient.get<LeagueAttendanceAvailability>(`${this.baseUrl}api/Login/LeagueAttendanceAvailability/${leagueId}`);
    }

    public getPlayerByPlayerId(): Observable<Player> {
        return this.httpClient.get<Player>(`${this.baseUrl}api/Login/GetPlayerByPlayerId`);
    }

    public getPlayerByPlayerIdVariable(playerId: number): Observable<Player> {
        return this.httpClient.get<Player>(`${this.baseUrl}api/Login/GetPlayerByPlayerIdVariable/${playerId}`);
    }

    public setSignInMode(mode: LeagueAttendanceMode, leagueId: number): Observable<LeagueAttendanceAvailability> {
        return this.httpClient.post<LeagueAttendanceAvailability>(`${this.baseUrl}api/Login/SetLockSignInStatus`, { mode, leagueId });
    }


    public GetLeagues() {
        return this.httpClient.get<Leagues[]>(this.baseUrl + 'api/ScrambleData/GetLeagues');
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
        // Tabs can initialize before the shared league selection has arrived.
        if (typeof leagueName !== 'string' || !leagueName.trim()) {
            return of<KingQueenTeam[]>([]);
        }
        return this.httpClient.get<KingQueenTeam[]>(this.baseUrl + 'api/ScrambleData/SelectedLeagueScrambles/' + encodeURIComponent(leagueName));
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

    public claimPlayer(data: { userId?: number; playerId: number }): Observable<any> {
        return this.httpClient.post(this.baseUrl + `api/ScrambleData/claimPlayer`, data);
    }

    public claimablePlayers(search: string) {
        return this.httpClient.get<{ players: ProfileMatch[]; claimedProfiles: ProfileMatch[]; claimedExactMatch: boolean }>(
            this.baseUrl + 'api/ScrambleData/ClaimablePlayers', { params: { search } });
    }

    public createAndClaimPlayer(input: { firstName: string; lastName: string; gender: string }) {
        return this.httpClient.post(this.baseUrl + 'api/ScrambleData/CreateAndClaimPlayer', input);
    }

    public addPlayerWithoutLeague(player: any, importLeagueId?:number): Observable<any> {
        return this.httpClient.post(this.baseUrl + 'api/ScrambleData/AddPlayerWithoutLeague'+(importLeagueId?'?importLeagueId='+importLeagueId:''), player);
    }

    public AddPlayer(player: any, leagueName: string, leagueDivisionId?: number): Observable<any> {
        let divisionId = 0;
        if (leagueDivisionId != null) {
            divisionId = leagueDivisionId;
        }
        return this.httpClient.post<any>(
            `${this.baseUrl}api/ScrambleData/AddPlayer/${leagueName}?leagueDivisionId=${divisionId}`,
            player
        );
    }


    public getLeagueDivisions(leagueName: string): Observable<any[]> {
        return this.httpClient.get<any[]>(`${this.baseUrl}api/LeagueDivision/GetByLeague/${leagueName}`);
    }

    public addLeagueDivision(payload: any): Observable<any> {
        return this.httpClient.post<any>(`${this.baseUrl}api/LeagueDivision/Add`, payload);
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

    public getSignedInPlayers(leagueId: number, date: Date | string): Observable<PlayerSignInResult[]> {
        // Format the date in local time zone as 'YYYY-MM-DD'
        const formattedDateTime = typeof date === "string" ? date : `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ` +
            `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        const params = new HttpParams()
            .set('leagueId', leagueId.toString())
            .set('date', formattedDateTime); // Use the locally formatted date

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
    public hasTopPlayers(leagueId: number): Observable<boolean> {
        return this.getTopPlayersForLeague(leagueId, 1).pipe(
            map(players => Array.isArray(players) && players.length > 0),
            catchError((err) => {
                console.error('hasTopPlayers error', err);
                return of(false);
            })
        );
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

    public getTeammateHistory(leagueId: number): Observable<any> {
        return this.httpClient.get<any>(`${this.baseUrl}api/ScrambleData/TeammateHistory/${leagueId}`);
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


    public AddNewLeague(leagueName: string, eventTypeId = 1, eventDate?: string, venueId?: number | null) {
        const params = {eventTypeId, ...(eventDate ? {eventDate} : {}), ...(venueId ? {venueId} : {})};
        return this.httpClient.post<Leagues>(this.baseUrl + 'api/ScrambleData/AddNewLeague/' + encodeURIComponent(leagueName), [], { params });
    }

    public signInPlayer(playerSignIn: PlayerSignIn): Observable<any> {
        console.log('playerSignIn', playerSignIn);
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



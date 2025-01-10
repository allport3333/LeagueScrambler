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
import { LeagueTeamScoreDto } from '../data-models/leagueTeamScore.model';
import { Observable } from 'rxjs';
import { TeamWithPlayersDto, WeekSchedule } from '../data-models/DTOs';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {

    constructor(http: HttpClient, @Inject('BASE_URL') public baseUrl: string, public httpClient: HttpClient) {
    }

    public GetPlayers(leagueID: number) {
        return this.httpClient.get<PlayerInformation[]>(this.baseUrl + 'api/Statistics/GetPlayers/' + leagueID);
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        // Month/Day with leading zeros
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    public getTeamScores(leagueName: string, date: string): Observable<LeagueTeamScoreDto[]> {
        const url = `${this.baseUrl}api/Statistics/GetTeamScores/${date}/${leagueName}`;
        return this.httpClient.get<LeagueTeamScoreDto[]>(url);
    }

    getLeagues() {
        return this.httpClient.get<any[]>(`${this.baseUrl}api/Statistics/GetLeagues`);
    }

    getPlayerProfile(playerId: number) {
        return this.httpClient.get<any>(`${this.baseUrl}api/Statistics/GetProfile?playerId=${playerId}`);
    }

    getPlayerLeagues(playerId: number) {
        return this.httpClient.get<any[]>(`${this.baseUrl}api/Statistics/GetPlayerLeagues?playerId=${playerId}`);
    }

    getLeaguesForPlayer(playerId: number) {
        return this.httpClient.get<any[]>(`${this.baseUrl}api/Statistics/GetLeaguesForPlayer?playerId=${playerId}`);
    }


    getPerformanceStats(playerId: number) {
        return this.httpClient.get<any>(`${this.baseUrl}api/Statistics/GetPerformanceStats?playerId=${playerId}`);
    }

    getByeRounds(playerId: number) {
        return this.httpClient.get<any[]>(`${this.baseUrl}api/Statistics/GetByeRounds?playerId=${playerId}`);
    }

    getDetailedPerformanceStats(playerId: number, leagueId: number) {
        return this.httpClient.get<any>(
            `${this.baseUrl}api/Statistics/GetDetailedPerformanceStats?playerId=${playerId}&leagueId=${leagueId}`
        );
    }

    public AddLeagueTeam(
        leagueId: number,
        teamName: string,
        division: string
    ): Observable<LeagueTeams> {
        const url = `${this.baseUrl}api/Statistics/AddTeam`;
        return this.httpClient.post<LeagueTeams>(url, {
            leagueId,
            teamName,
            division,
        });
    }

    public AddPlayerToLeagueTeam(leagueTeamId: number, playerId: number): Observable<any> {
        const url = `${this.baseUrl}api/Statistics/AddPlayerToLeagueTeam?leagueTeamId=${leagueTeamId}&playerId=${playerId}`;
        return this.httpClient.post<any>(url, {});
    }

    public SetTeamDivision(leagueTeamId: number, division: string): Observable<any> {
        return this.httpClient.post<any>(
            `${this.baseUrl}api/Statistics/SetTeamDivision?leagueTeamId=${leagueTeamId}&division=${division}`,
            {}
        );
    }

    public RecordLeagueTeamScore(dto: LeagueTeamScoreDto): Observable<LeagueTeamScoreDto> {
        const url = `${this.baseUrl}api/Statistics/RecordLeagueTeamScore`;
        return this.httpClient.post<LeagueTeamScoreDto>(url, dto);
    }

    public GetTeamScores(date: Date, leagueName: string): Observable<LeagueTeamScoreDto[]> {
        const dateString = this.formatDate(date);
        const url = `${this.baseUrl}api/Statistics/GetTeamScores/${dateString}/${leagueName}`;
        return this.httpClient.get<LeagueTeamScoreDto[]>(url);
    }

    public UpdateTeamScores(leagueName: string): Observable<LeagueTeams[]> {
        const url = `${this.baseUrl}api/Statistics/UpdateTeamScores/${leagueName}`;
        return this.httpClient.get<LeagueTeams[]>(url);
    }

    public GetTeams(leagueName: string): Observable<LeagueTeams[]> {
        return this.httpClient.get<LeagueTeams[]>(`${this.baseUrl}api/Statistics/GetTeams/${leagueName}`);
    }

    public GetTeamsByLeagueId(leagueId: number): Observable<LeagueTeams[]> {
        return this.httpClient.get<LeagueTeams[]>(
            `${this.baseUrl}api/Statistics/GetTeamsByLeagueId/${leagueId}`
        );
    }

    getLeagueTeamScores(playerId: number, leagueId: number) {
        return this.httpClient.get<any[]>(`${this.baseUrl}api/Statistics/league-team-scores/${playerId}/${leagueId}`);
    }


    getCombinedStats(playerId: number, leagueId: number) {
        return this.httpClient.get<any>(`${this.baseUrl}api/Statistics/combined-stats/${playerId}/${leagueId}`);
    }

    getLeagueStandings(leagueId: number) {
        return this.httpClient.get<any[]>(`${this.baseUrl}api/Statistics/league-standings/${leagueId}`);
    }

    getLeagueSchedule(leagueId: number): Observable<WeekSchedule[]> {
        return this.httpClient.get<WeekSchedule[]>(
            `${this.baseUrl}api/Statistics/GetLeagueSchedule/${leagueId}`
        );
    }

    public GetAllTeamsWithPlayers(leagueId: number): Observable<TeamWithPlayersDto[]> {
        const url = `${this.baseUrl}api/Statistics/GetAllTeamsWithPlayers/${leagueId}`;
        return this.httpClient.get<TeamWithPlayersDto[]>(url);
    }

    public AddTeam(team: NewCreatedTeam) {
        return this.httpClient.post<LeagueTeams>(this.baseUrl + 'api/Statistics/AddTeam/', team);
    }
}



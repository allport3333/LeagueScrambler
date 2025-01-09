import { Component } from '@angular/core';


export interface LeagueTeams {
    id: number;
    teamName: string;
    totalWins: number;
    totalLosses: number;
    leagueID: number;
    division: string;
}
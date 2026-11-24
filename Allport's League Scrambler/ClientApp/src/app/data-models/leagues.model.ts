import { Component } from '@angular/core';

export interface Leagues {
    id: number;
    leagueName: string;
    eventTypeId?: number;
    canManageTournament?: boolean;
    canViewTournamentRounds?: boolean;
}

import { Component } from '@angular/core';

export interface Leagues {
    id: number;
    leagueName: string;
    eventTypeId?: number;
    isActive?: boolean;
    eventDate?: string;
    eventTimeZone?: string;
    season?: string;
    canManageTournament?: boolean;
    canViewTournamentRounds?: boolean;
}

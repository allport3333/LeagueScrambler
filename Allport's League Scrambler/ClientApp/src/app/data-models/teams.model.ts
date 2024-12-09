import { Component } from '@angular/core';
import { Player } from '../data-models/player.model';
import { KingQueenRoundScore } from './kingQueenRoundScore';


export interface Team {
    players: Player[];
    maleCount: number;
    femaleCount: number;
    kingQueenTeamId: number;
    kingQueenRoundScores: KingQueenRoundScore[];
}


import { Component } from '@angular/core';
import { Player } from '../data-models/player.model';


export interface Team {
    players: Player[];
    maleCount: number;
    femaleCount: number;

}
import { Component } from '@angular/core';

export interface Player {
    id: number;
    firstName: string;
    lastName: string;
    isMale: boolean;
    gender: string;
    isSub: boolean;
    isTopPlayer?: boolean;
}
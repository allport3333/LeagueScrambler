import { Player } from "./player.model";
import { Leagues } from "./leagues.model";
export interface PlayerSignIn {
    playerSignInId: number; // Corresponds to PlayerSignInId in C#
    dateTime: string; // Use string for dates in Angular to handle ISO strings
    leagueId: number; // Corresponds to LeagueId in C#
    playerId: number; // Corresponds to PlayerId in C#
    league?: Leagues; // Optional foreign key relationship
    player?: Player; // Optional foreign key relationship
}
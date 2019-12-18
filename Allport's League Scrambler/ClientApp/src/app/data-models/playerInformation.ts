import { PlayerScores } from '../data-models/playerScores.model';

export interface PlayerInformation {
    firstName: string;
    lastName: string;
    allPlayerScores: PlayerScores[];
    playerID: number;

}
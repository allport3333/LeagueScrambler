import { KingQueenTeam } from './kingQueenTeam.model';
export interface KingQueenRoundScore {
    id: number;
    roundId: number;
    kingQueenTeamId: number;
    roundScore: number;
    roundWon: boolean;
}
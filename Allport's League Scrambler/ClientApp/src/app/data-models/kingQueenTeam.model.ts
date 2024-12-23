
import { KingQueenRoundScore } from './kingQueenRoundScore';
import { KingQueenPlayer } from './kingQueenPlayer.model';
export class KingQueenTeam {
    id: number;
    leagueID: number;
    dateOfTeam: Date;
    scrambleNumber: number;
    kingQueenPlayers: KingQueenPlayer[];
    kingQueenRoundScores: KingQueenRoundScore[];
}
import { KingQueenRoundScore } from "./KingQueenRoundScore";

export interface KingQueenRoundScoresResponse {
    success: boolean;
    message: string;
    savedScores: KingQueenRoundScore[];
}
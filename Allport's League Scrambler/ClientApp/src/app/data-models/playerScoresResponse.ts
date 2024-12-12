export interface PlayerScoresResponse {
    playerScores: PlayerScoreGroup[];
    maxRounds: number;
}

export interface PlayerScoreGroup {
    playerId: number;
    isMale: boolean;
    playerName: string;
    scores: RoundScore[];
}

export interface RoundScore {
    roundId: number;
    score: number;
    date: Date;
}
export interface PlayerScoresResponse {
    playerScores: PlayerScoreGroup[];
    maxRounds: number;
}

export interface PlayerScoreGroup {
    playerId: number;
    isMale: boolean;
    playerName: string;
    scores: RoundScore[];
    totalScore: number;
    leagueDivisionId: number;
    leagueDivisionCode: string;
}

export interface RoundScore {
    roundId: number;
    score: number;
    date: Date;
    roundWon: number;
    isReduced: boolean;
    isSubScore: number;
}

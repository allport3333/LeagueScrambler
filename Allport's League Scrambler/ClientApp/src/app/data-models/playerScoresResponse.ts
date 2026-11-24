export interface PlayerScoresResponse {
    playerScores: PlayerScoreGroup[];
    maxRounds: number;
    matchupWins?: Record<number, number>;
    tournamentProgress?: { completed: number; total: number; status: string };
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
    scrambleNumber?: number;
    kingQueenTeamId?: number;
    hasSavedScore?: boolean;
    roundId: number;
    score: number;
    date: Date;
    roundWon: number;
    isReduced: boolean;
    isSubScore: number;
}

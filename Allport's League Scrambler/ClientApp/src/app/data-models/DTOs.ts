export interface PlayerDto {
    id: number;
    fullName: string;
    isMale: boolean;
}

export interface TeamWithPlayersDto {
    id: number;
    teamName: string;
    totalWins: number;
    totalLosses: number;
    players: PlayerDto[];
}

export interface Match {
    courtNumber: number;
    team1Name: string;
    team2Name: string;
    matchDescription: string;
}

export interface WeekSchedule {
    weekNumber: number;
    date: string;
    matches: Match[];
}
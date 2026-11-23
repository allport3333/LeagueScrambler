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
    division: string;
}

export interface Match {
    scheduleId?: number;
    team1Id?: number;
    team2Id?: number;
    courtNumber: number;
    team1Name: string;
    team2Name: string;
    team1Division?: string;
    team2Division?: string;
    matchDescription: string;
    division: string;
}

export interface WeekSchedule {
    events?: any[];
    weekNumber: number;
    date: string;
    matches: Match[];
}

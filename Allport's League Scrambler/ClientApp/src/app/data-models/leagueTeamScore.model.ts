export interface LeagueTeamScoreDto {
    id: number;
    teamId: number;
    opponentsTeamId: number;
    teamScore: number;
    wonGame: boolean;
    date: string; 
    teamName: string;
    opponentsTeamName: string;
}

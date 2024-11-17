import { KingQueenTeamWithPlayers } from "./KingQueenTeamWithPlayers.model";
import { Player } from "./player.model";

export interface SaveKingQueenTeamsResponse {
    kingQueenTeams: KingQueenTeamWithPlayers[];
    byePlayers: Player[];
}
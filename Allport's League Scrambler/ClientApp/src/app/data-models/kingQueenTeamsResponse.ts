import { KingQueenTeamWithPlayers } from "./KingQueenTeamWithPlayers.model";
import { Player } from "./player.model";

export interface KingQueenTeamsResponse {
    kingQueenTeams: KingQueenTeamWithPlayers[];
    byePlayers: Player[];
}
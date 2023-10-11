import { Player } from './player.model';
import { KingQueenTeam } from './kingQueenTeam.model';

export class KingQueenTeamWithPlayers {
    kingQueenTeam: KingQueenTeam;
    players: Player[]; // Assuming you have a Player data model as well
}
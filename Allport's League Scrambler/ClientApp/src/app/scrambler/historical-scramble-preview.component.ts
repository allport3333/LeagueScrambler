import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { catchError, map, of, timeout } from 'rxjs';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';
import { PlayerService } from '../services/player.service';

export interface HistoricalScramblePreviewData {
    leagueName: string;
    scrambles: KingQueenTeam[];
}

@Component({
    selector: 'app-historical-scramble-preview',
    imports: [AsyncPipe, DatePipe, NgTemplateOutlet, MatButtonModule, MatDialogModule],
    templateUrl: './historical-scramble-preview.component.html',
    styleUrl: './historical-scramble-preview.component.css'
})
export class HistoricalScramblePreviewComponent {
    readonly data = inject<HistoricalScramblePreviewData>(MAT_DIALOG_DATA);
    private readonly players = inject(PlayerService);
    readonly multiple = this.data.scrambles.length > 1;
    readonly preview = this.load();

    private load() {
        const { leagueName, scrambles } = this.data;
        const numbers = scrambles.map(scramble => scramble.scrambleNumber);
        const request = this.multiple
            ? this.players.getMultipleKingQueenTeamsByScrambleNumbers(leagueName, numbers)
            : this.players.getKingQueenTeamsByScrambleNumber(leagueName, numbers[0]);

        return request.pipe(
            timeout(15000),
            map(response => {
                if (!Array.isArray(response?.kingQueenTeams)) {
                    throw new Error('Invalid saved teams response');
                }
                return {
                    groups: scrambles.map(scramble => ({
                        scramble,
                        teams: response.kingQueenTeams
                            .filter(row => row.kingQueenTeam.scrambleNumber === scramble.scrambleNumber)
                            // Saved team labels use the position in team ID order.
                            .sort((a, b) => a.kingQueenTeam.id - b.kingQueenTeam.id)
                            .map(row => ({
                                id: row.kingQueenTeam.id,
                                players: row.players || [],
                                substitutes: new Set(row.kingQueenTeam.kingQueenPlayers
                                    ?.filter(link => link.isSubScore).map(link => link.playerId))
                            }))
                    })),
                    // The bulk endpoint returns a combined list of byes without scramble numbers.
                    byes: this.multiple ? [] : response.byePlayers || [],
                    error: false
                };
            }),
            catchError(() => of({ groups: [], byes: [], error: true }))
        );
    }
}

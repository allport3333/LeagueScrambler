import { Component, input, OnInit, output } from '@angular/core';
import { transferTeamPlayer } from './scrambler/team-assignment';

interface EditablePlayer { id: number; firstName: string; lastName: string; }
export interface EditableMatchupTeam { id: number; players: EditablePlayer[]; }

@Component({
    selector: 'app-tournament-team-editor',
    template: `
        <p>Use Assigned team to move a player, or select players on two different teams to swap them. Byes stay as assigned.</p>
        <div class="teams">
            @for (team of draft; track team.id; let index = $index) {
                <section>
                    <h3>Team {{ index + 1 }} <small>Matchup {{ matchup(index) }} ? {{ team.players.length }} players</small></h3>
                    @for (player of team.players; track player.id) {
                        <div class="player">
                            <span>{{ player.firstName }} {{ player.lastName }}</span>
                            <select class="form-select" [attr.aria-label]="'Assigned team for ' + player.firstName + ' ' + player.lastName"
                                [disabled]="busy()" (change)="move(team, player.id, +$any($event.target).value)">
                                @for (target of draft; track target.id; let targetIndex = $index) {
                                    <option [value]="target.id" [selected]="target.id === team.id">Team {{ targetIndex + 1 }}</option>
                                }
                            </select>
                            <button type="button" [disabled]="busy()" [attr.aria-pressed]="selected?.playerId === player.id"
                                (click)="swap(team, player.id)">Swap</button>
                        </div>
                    } @empty { <p>Move a player to this team before saving.</p> }
                </section>
            }
        </div>
        @if (selected) { <p role="status">Select a player on another team to complete the swap.</p> }
        @if (invalid) { <p role="status">Every matchup needs two nonempty teams. Move a player to each empty team before saving.</p> }
        <div class="actions">
            <button type="button" [disabled]="!undoHistory.length || busy()" (click)="undo()">Undo</button>
            <button type="button" [disabled]="busy()" (click)="cancelled.emit()">Cancel</button>
            <button type="button" class="primary" [disabled]="busy() || invalid || !changed" (click)="saved.emit(draft)">
                {{ preview() ? 'Apply to Preview' : 'Save Team Changes' }}
            </button>
        </div>
    `,
    styles: [`
        .teams { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); gap: .75rem; }
        section { min-width: 0; border: 1px solid var(--hub-border, #bcc6d2); border-radius: .45rem; padding: .6rem; }
        h3 { font-size: 1rem; margin: 0 0 .5rem; } small { color: var(--hub-muted, #475569); }
        .player { display: grid; grid-template-columns: minmax(0, 1fr) 5.7rem auto; align-items: center;
            gap: .25rem; padding: .2rem; margin-block: .2rem; background: var(--hub-section, #eef3f8); border-radius: .3rem; }
        .player span { grid-column: 1 / -1; overflow-wrap: anywhere; }
        .player select { grid-column: 1 / 3; width: 100%; }
        button, select { min-height: 44px; }
        button { border: 1px solid var(--hub-border, #bcc6d2); border-radius: .35rem; background: var(--hub-surface, #fff); color: inherit; padding: .35rem .55rem; }
        button[aria-pressed="true"], .primary { background: var(--hub-primary-action, #30577e); color: var(--hub-action-text, #fff); }
        button:disabled { opacity: .55; }
        .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; margin-top: 1rem; }
    `]
})
export class TournamentTeamEditorComponent implements OnInit {
    readonly teams = input.required<EditableMatchupTeam[]>();
    readonly preview = input(false);
    readonly busy = input(false);
    readonly saved = output<EditableMatchupTeam[]>();
    readonly cancelled = output<void>();
    draft: EditableMatchupTeam[] = [];
    readonly undoHistory: EditableMatchupTeam[][] = [];
    selected?: { team: EditableMatchupTeam; playerId: number };

    ngOnInit(): void { this.draft = this.copy(this.teams()); }
    matchup(index: number): number { return Math.floor(index / 2) + 1; }
    get changed(): boolean {
        const original = this.teams();
        return this.draft.some((team, index) => {
            const playerIds = new Set(original[index].players.map(player => player.id));
            return team.players.length !== playerIds.size || team.players.some(player => !playerIds.has(player.id));
        });
    }
    get invalid(): boolean {
        return this.draft.some(team => !team.players.length);
    }
    move(team: EditableMatchupTeam, playerId: number, destinationId: number): void {
        const destination = this.draft.find(item => item.id === destinationId);
        if (destination && destination !== team) this.transfer(team, destination, playerId);
    }
    swap(team: EditableMatchupTeam, playerId: number): void {
        if (!this.selected || this.selected.team === team) {
            this.selected = this.selected?.playerId === playerId ? undefined : { team, playerId };
            return;
        }
        this.transfer(this.selected.team, team, this.selected.playerId, playerId);
    }
    undo(): void {
        const previous = this.undoHistory.pop();
        if (previous) this.draft = previous;
        this.selected = undefined;
    }
    private transfer(source: EditableMatchupTeam, destination: EditableMatchupTeam, playerId: number, swapId?: number): void {
        const previous = this.copy(this.draft);
        if (transferTeamPlayer(source, destination, playerId, swapId)) this.undoHistory.push(previous);
        this.selected = undefined;
    }
    private copy(teams: EditableMatchupTeam[]): EditableMatchupTeam[] {
        return teams.map(team => ({ ...team, players: team.players.slice() }));
    }
}

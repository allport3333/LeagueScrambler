import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LeagueService } from './services/league.service';

@Component({
    selector: 'app-tournament-navigation',
    imports: [RouterLink, NgTemplateOutlet],
    styles: [`
        nav { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 14px; margin: .5rem 0 1rem; }
        a, span { display: inline-flex; align-items: center; min-height: 44px; }
        span { color: var(--hub-muted, #536478); }
        details { display: none; margin: .5rem 0 1rem; }
        summary { cursor: pointer; min-height: 44px; padding: .55rem; text-align: center; border: 1px solid var(--hub-border, #bcc6d2); border-radius: .4rem; }
        @media (max-width: 720px) {
            nav.desktop { display: none; }
            details { display: block; }
            details nav { flex-direction: column; gap: 0; padding-inline: .6rem; }
        }
    `],
    template: `
        <nav class="desktop" aria-label="Tournament Center views">
            <ng-container *ngTemplateOutlet="links"></ng-container>
        </nav>
        <details #menu>
            <summary>Tournament menu</summary>
            <nav aria-label="Tournament Center views" (click)="menu.open = false">
                <ng-container *ngTemplateOutlet="links"></ng-container>
            </nav>
        </details>
        <ng-template #links>
            @if (currentTournamentId; as id) { <a [routerLink]="['/tournament', id]">Current Tournament</a> }
            @else { <span aria-disabled="true">Current Tournament</span> }
            <a routerLink="/tournament">Manage Tournaments</a>
            <a routerLink="/tournament" [queryParams]="{view: 'create'}">Create Tournament</a>
        </ng-template>
    `
})
export class TournamentNavigationComponent {
    readonly leagueId = input<number>();
    private readonly leagues = inject(LeagueService);
    private readonly selected = toSignal(this.leagues.selectedLeague$);
    get currentTournamentId(): number | undefined {
        return this.leagueId() ?? this.leagues.leaguesAvailable.find(
            event => event.id === this.selected()?.leagueId && event.canManageTournament)?.id;
    }
}

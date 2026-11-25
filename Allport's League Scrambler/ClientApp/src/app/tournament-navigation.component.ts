import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
    selector: 'app-tournament-navigation',
    imports: [RouterLink, RouterLinkActive],
    styles: [`
        nav { display: flex; justify-content: center; flex-wrap: wrap; gap: .35rem; margin: .6rem 0 1rem; }
        a { display: inline-flex; align-items: center; min-height: 44px; padding: .35rem .7rem; border: 1px solid var(--hub-border, #bcc6d2); border-radius: .45rem; text-align: center; }
        a { color: var(--hub-text, #26354a); background: var(--hub-surface, #fff); text-decoration: none; }
        a:hover { text-decoration: underline; }
        a:focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
        a.active { color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); border-color: transparent; }
    `],
    template: `
        <nav aria-label="Tournament Center views">
            <a routerLink="/tournament" [queryParams]="{view: 'current'}" routerLinkActive="active"
                [routerLinkActiveOptions]="{exact: true}" ariaCurrentWhenActive="page">Current Tournament</a>
            <a routerLink="/tournament" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"
                ariaCurrentWhenActive="page">Manage Tournaments</a>
            <a routerLink="/tournament" [queryParams]="{view: 'create'}" routerLinkActive="active"
                [routerLinkActiveOptions]="{exact: true}" ariaCurrentWhenActive="page">Create Tournament</a>
        </nav>
    `
})
export class TournamentNavigationComponent {}

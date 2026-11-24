import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Leagues } from './data-models/leagues.model';
import { LeagueService } from './services/league.service';
import { PlayerService } from './services/player.service';

@Component({
    selector: 'app-tournament-landing',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, RouterLink],
    styles: [`
        main { max-width: 66rem; margin: 1rem auto; padding: 16px; }
        h1 { text-align: center; }
        .sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 25rem), 1fr)); gap: 16px; }
        section { min-width: 0; padding: 16px; border-radius: 6px; border: 1px solid var(--hub-border, #bcc6d2); background: var(--hub-surface, #fff); }
        form, label { display: grid; gap: 8px; }
        button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--hub-border, #527098); border-radius: 5px; color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); }
        button:disabled { opacity: .65; }
        ul { list-style: none; margin: 0; padding: 0; }
        li + li { border-top: 1px solid var(--hub-border, #bcc6d2); }
        a { display: block; padding: 12px 4px; overflow-wrap: anywhere; }
        :is(button, a, input):focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
    `],
    template: `
        <main>
            <h1>Tournament Center</h1>
            <div class="sections">
                <section aria-labelledby="create-heading">
                    <h2 id="create-heading">Create a Tournament</h2>
                    <form #form="ngForm" (ngSubmit)="create()">
                        <label>Tournament Name
                            <input class="form-control" name="name" maxlength="50" required [(ngModel)]="name">
                        </label>
                        <label>Tournament Date
                            <input class="form-control" name="date" type="date" required [(ngModel)]="date">
                        </label>
                        <button type="submit" [disabled]="form.invalid || !name.trim() || creating || !!createdId">Create Tournament</button>
                    </form>
                    @if (creationError) { <p role="alert">{{ creationError }}</p> }
                    @if (createdId && !creating) {
                        <a [routerLink]="['/tournament', createdId]">Open your new tournament</a>
                    }
                </section>
                <section aria-labelledby="existing-heading">
                    <h2 id="existing-heading">Manage Tournaments</h2>
                    @if (loading) { <p role="status">Loading tournaments…</p> }
                    @else if (listError) {
                        <p role="alert">Could not load your tournaments.</p>
                        <button type="button" (click)="load()">Retry</button>
                    } @else {
                        <ul>
                            @for (event of tournaments; track event.id) {
                                <li><a [routerLink]="['/tournament', event.id]">{{ event.leagueName }}</a></li>
                            } @empty { <li>You have no tournaments to manage yet.</li> }
                        </ul>
                    }
                </section>
            </div>
        </main>
    `
})
export class TournamentLandingComponent {
    private readonly leagues = inject(LeagueService);
    private readonly players = inject(PlayerService);
    private readonly router = inject(Router);
    private readonly destroy = inject(DestroyRef);
    tournaments: Leagues[] = [];
    name = '';
    date = '';
    createdId?: number;
    creating = false;
    loading = false;
    listError = false;
    creationError = '';

    constructor() { this.load(); }

    load(): void {
        this.loading = true;
        this.listError = false;
        this.leagues.getLeagues().pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: events => {
                this.tournaments = events.filter(event => event.eventTypeId === 2);
                this.loading = false;
            },
            error: () => { this.loading = false; this.listError = true; }
        });
    }

    create(): void {
        const name = this.name.trim();
        if (!name || !this.date || this.creating || this.createdId) return;
        this.creating = true;
        this.creationError = '';
        this.players.AddNewLeague(name, 2, this.date).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: created => {
                this.createdId = created.id;
                this.leagues.getLeagues().pipe(takeUntilDestroyed(this.destroy)).subscribe({
                    next: events => {
                        this.creating = false;
                        this.tournaments = events.filter(event => event.eventTypeId === 2);
                        this.router.navigate(['/tournament', created.id]);
                    },
                    error: () => {
                        this.creating = false;
                        this.creationError = 'The tournament was created. Reload this page to refresh your event list.';
                    }
                });
            },
            error: error => {
                this.creating = false;
                this.creationError = error.error?.message || 'Could not create the tournament. Try again.';
            }
        });
    }
}

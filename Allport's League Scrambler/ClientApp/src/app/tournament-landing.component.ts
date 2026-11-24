import { TournamentDatePipe } from './tournament-date.pipe';
import { TournamentNavigationComponent } from './tournament-navigation.component';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
interface ManagedTournament extends Leagues { eventDate?: string; participants: number; total: number; generated: number; completed: number; status: string; }
import { Leagues } from './data-models/leagues.model';
import { LeagueService } from './services/league.service';
import { PlayerService } from './services/player.service';

@Component({
    selector: 'app-tournament-landing',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, RouterLink, TournamentNavigationComponent, TournamentDatePipe],
    styles: [`
        main { max-width: 85rem; margin: 1rem auto; padding: 16px; }
        h1 { text-align: center; }
        .sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 25rem), 1fr)); gap: 16px; }
        section { min-width: 0; padding: 16px; border-radius: 6px; border: 1px solid var(--hub-border, #bcc6d2); background: var(--hub-surface, #fff); }
        form, label { display: grid; gap: 8px; }
        button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--hub-border, #527098); border-radius: 5px; color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); }
        button:disabled { opacity: .65; }
        ul { list-style: none; margin: 0; padding: 0; }
        .search { max-width: 24rem; margin: .75rem 0 1rem; }
        .tournament-cards { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); }
        .tournament-card { display: grid; align-content: start; gap: .5rem; padding: 1rem; background: var(--hub-surface, #fff); border: 1px solid var(--hub-border, #bcc6d2); border-radius: .55rem; }
        .tournament-card h3 { font-size: 1.2rem; margin: 0; overflow-wrap: anywhere; }
        .tournament-card p { margin: 0; color: var(--hub-muted, #536478); }
        .tournament-card .open { justify-self: start; padding: .55rem .75rem; border-radius: .4rem; color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); }
        .badge-status { justify-self: start; padding: .2rem .55rem; border-radius: .4rem; border: 1px solid var(--hub-border, #bcc6d2); font-size: .86rem; }
        .badge-status.done { background: var(--hub-win-surface, #e6f5ec); color: var(--hub-win-text, #20543e); }
        .listing { padding: 0; border: 0; background: transparent; }

        a { display: block; padding: 12px 4px; overflow-wrap: anywhere; }
        :is(button, a, input):focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
    `],
    template: `
        <main>
            <h1>Tournament Center</h1>
            <app-tournament-navigation />
            <div class="sections">
                @if (creatingView) {
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
                } @else {
                <section class="listing" aria-labelledby="existing-heading">
                    <h2 id="existing-heading">Manage Tournaments</h2>
                    @if (loading) { <p role="status">Loading tournaments…</p> }
                    @else if (listError) {
                        <p role="alert">Could not load your tournaments.</p>
                        <button type="button" (click)="load()">Retry</button>
                    } @else {
                        @if (tournaments.length > 3) {
                            <label class="search">Find a tournament
                                <input class="form-control" type="search" [(ngModel)]="query" />
                            </label>
                        }
                        <ul class="tournament-cards">
                            @for (event of visibleTournaments; track event.id) {
                                <li class="tournament-card">
                                    <h3>{{ event.leagueName }}</h3>
                                    @if (event.status) { <span class="badge-status" [class.done]="event.status === 'Completed'">{{ event.status }}</span> }
                                    @if (event.eventDate | tournamentDate; as date) { <p><time [attr.datetime]="event.eventDate">{{ date }}</time></p> }
                                    @if (event.participants != null) { <p>{{ event.participants }} registered</p> }
                                    @if (event.total > 0 && event.completed != null) { <p>{{ event.completed }} of {{ event.total }} rounds completed</p> }
                                    <a class="open" [routerLink]="['/tournament', event.id]" [attr.aria-label]="'Open Tournament: ' + event.leagueName">Open Tournament</a>
                                </li>
                            } @empty { <li>{{ query ? 'No tournaments match your search.' : 'You have no tournaments to manage yet.' }}</li> }
                        </ul>
                    }
                </section>
                }
            </div>
        </main>
    `
})
export class TournamentLandingComponent {
    private readonly http = inject(HttpClient);
    private readonly leagues = inject(LeagueService);
    private readonly players = inject(PlayerService);
    private readonly router = inject(Router);
    private readonly destroy = inject(DestroyRef);
    private readonly route = inject(ActivatedRoute);
    get creatingView() { return this.route.snapshot.queryParamMap.get('view') === 'create'; }
    tournaments: ManagedTournament[] = [];
    query = '';
    get visibleTournaments() {
        const query = this.query.trim().toLowerCase();
        return this.tournaments.filter(event => event.leagueName.toLowerCase().includes(query));
    }
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
        this.http.get<ManagedTournament[]>('/api/tournaments/managed').pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: events => {
                this.tournaments = events.slice().sort((a, b) =>
                    Number(a.status === 'Completed') - Number(b.status === 'Completed') ||
                    (b.eventDate ?? '').localeCompare(a.eventDate ?? '') ||
                    a.leagueName.localeCompare(b.leagueName));
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

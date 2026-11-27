import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, interval, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { Leagues } from './data-models/leagues.model';
import { eventDestination, isHistoricalEvent } from './event-selection';
import { LeagueService } from './services/league.service';

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, DatePipe, RouterLink],
    template: `
      <section class="history">
        <h1>Past {{ tournaments ? 'Tournaments' : 'Leagues' }}</h1>
        @if (authenticated === false) {
          <p class="text-center"><a routerLink="/login">Sign in</a> to see events you can access.</p>
        } @else if (error) {
          <p role="alert">Could not load your events. <button type="button" (click)="load()">Retry</button></p>
        } @else if (loading) {
          <p role="status">Loading events&hellip;</p>
        } @else {
          <div class="filters">
            <label>Search {{ tournaments ? 'tournaments' : 'leagues' }}
              <input type="search" [(ngModel)]="query">
            </label>
            @if (tournaments) {
              <label>Sort by <select [(ngModel)]="sort"><option value="newest">Newest date</option>
                <option value="oldest">Oldest date</option><option value="name">Name</option></select></label>
            }
          </div>
          <ul>
            @for (event of events; track event.id) {
              <li>
                <div><strong>{{ event.leagueName }}</strong><br>
                  <small>{{ event.isActive === false ? 'Inactive' : 'Active' }}
                    @if (tournaments) { &middot; {{ event.eventDate ? (event.eventDate | date:'mediumDate') : 'Undated' }} }
                    @else if (event.season) { &middot; {{ event.season }} }
                  </small>
                </div>
                <a [routerLink]="destination(event)" [attr.aria-label]="'Open ' + event.leagueName">Open</a>
              </li>
            } @empty { <li>No matching past events.</li> }
          </ul>
        }
      </section>
    `,
    styles: `
      .history { width: min(100% - 1rem, 52rem); margin: 1.5rem auto; }
      h1 { text-align: center; }
      .filters { display: flex; flex-wrap: wrap; gap: .75rem; margin-block: .75rem; }
      label { display: grid; min-width: 0; }
      input, select { padding: .4rem; color: var(--hub-text, #263849); background: var(--hub-surface, #fff);
        border: 1px solid var(--hub-border, #718197); border-radius: .25rem; max-width: 100%; }
      ul { list-style: none; padding: 0; }
      li { display: flex; align-items: center; justify-content: space-between; gap: .75rem; overflow-wrap: anywhere;
        padding: .55rem .85rem; border: 1px solid var(--hub-border, #718197); background: var(--hub-surface, #fff); }
      li + li { border-top: 0; }
      a { color: var(--hub-link, #315e8a); }
    `
})
export class EventHistoryComponent {
    private readonly leagues = inject(LeagueService);
    private readonly router = inject(Router);
    private readonly destroy = inject(DestroyRef);
    readonly tournaments = inject(ActivatedRoute).snapshot.data['tournaments'] === true;
    private available: Leagues[] = [];
    private now = new Date();
    query = '';
    sort = 'newest';
    loading = true;
    error = false;
    authenticated: boolean | null = null;

    constructor() {
        inject(AuthService).authenticationState$.pipe(switchMap(authenticated => {
            this.authenticated = authenticated;
            this.error = false;
            this.loading = authenticated !== false;
            return authenticated ? this.leagues.getLeagues().pipe(catchError(() => {
                this.error = true;
                return of([]);
            })) : of([]);
        }), takeUntilDestroyed(this.destroy)).subscribe(() => { this.loading = this.authenticated === null; });
        this.leagues.authorizedLeagues$.pipe(takeUntilDestroyed(this.destroy)).subscribe(events => { this.available = events ?? []; });
        interval(60000).pipe(takeUntilDestroyed(this.destroy)).subscribe(() => { this.now = new Date(); });
    }

    load(): void {
        if (!this.authenticated) return;
        this.loading = true;
        this.error = false;
        this.leagues.getLeagues().pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: () => { this.loading = false; },
            error: () => { this.loading = false; this.error = true; }
        });
    }

    get events(): Leagues[] {
        const query = this.query.trim().toLocaleLowerCase();
        return this.available.filter(event => (this.tournaments ? event.eventTypeId === 2 : event.eventTypeId !== 2)
            && isHistoricalEvent(event, this.now) && event.leagueName.toLocaleLowerCase().includes(query))
            .sort((a, b) => {
                if (this.tournaments && this.sort !== 'name') {
                    if (!!a.eventDate !== !!b.eventDate) return a.eventDate ? -1 : 1;
                    if (a.eventDate && b.eventDate) {
                        const order = a.eventDate.localeCompare(b.eventDate);
                        if (order) return this.sort === 'oldest' ? order : -order;
                    }
                }
                return a.leagueName.localeCompare(b.leagueName);
            });
    }

    destination(event: Leagues) { return eventDestination(this.router, event); }
}

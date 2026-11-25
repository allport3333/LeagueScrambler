import { TournamentDatePipe } from './tournament-date.pipe';
import { TournamentNavigationComponent } from './tournament-navigation.component';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TournamentNotifications } from './tournament-notifications.service';
import { firstValueFrom } from 'rxjs';
import { injectConfirmation } from './confirmation-dialog';
import { Leagues } from './data-models/leagues.model';
import { LeagueService } from './services/league.service';
import { PlayerService } from './services/player.service';
import { LoginService } from './services/login.service';

interface ManagedTournament extends Leagues { eventDate?: string; participants: number; total: number; generated: number; completed: number; status: string; workflowStep: number; legacyScrambles?: number; }
interface DeletionPreview { name: string; eventDate?: string; participants: number; generated: number; hasScores: boolean; revision: string; }

@Component({
    selector: 'app-tournament-landing',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, RouterLink, TournamentNavigationComponent, TournamentDatePipe],
    providers: [TournamentDatePipe],
    styles: [`
        main { max-width: 76rem; margin: .5rem auto; padding: .75rem 1rem; }
        header { text-align: center; }
        h1 { margin: 0 0 .25rem; }
        header p, .empty p { color: var(--hub-muted, #536478); margin: 0; }
        .create { max-width: 32rem; margin-inline: auto; }
        section { min-width: 0; padding: 16px; border-radius: 6px; border: 1px solid var(--hub-border, #bcc6d2); background: var(--hub-surface, #fff); }
        form, label { display: grid; gap: 8px; }
        button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--hub-border, #527098); border-radius: 5px; color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); }
        button:disabled { opacity: .65; }
        ul { list-style: none; margin: 0; padding: 0; }
        .search { max-width: 24rem; margin: .75rem 0 1rem; }
        .tournament-cards { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); }
        .tournament-card { display: flex; flex-direction: column; gap: .45rem; padding: .8rem; background: var(--hub-surface, #fff); border: 1px solid var(--hub-border, #bcc6d2); border-radius: .55rem; }
        .tournament-card h3 { font-size: 1.2rem; margin: 0; overflow-wrap: anywhere; }
        .tournament-card p { margin: 0; color: var(--hub-muted, #536478); }
        .actions, .metadata { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .65rem; }
        .actions { margin-top: auto; padding-top: .2rem; }
        .primary { display: inline-flex; align-items: center; min-height: 44px; padding: .4rem .7rem; border-radius: .4rem; color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); text-decoration: none; }
        .primary:hover { text-decoration: underline; }
        .delete { background: transparent; color: var(--hub-loss-text, #8d2935); border-color: transparent; font-size: .9rem; }
        .delete:hover { text-decoration: underline; }
        .badge-status { align-self: flex-start; padding: .15rem .45rem; border-radius: .4rem; border: 1px solid var(--hub-border, #bcc6d2); font-size: .86rem; }
        .badge-status.done { background: var(--hub-win-surface, #e6f5ec); color: var(--hub-win-text, #20543e); }
        .listing { padding: 0; border: 0; background: transparent; }
        .list-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: .35rem .75rem; }
        .list-heading h2 { margin: 0; }
        .list-heading span { color: var(--hub-muted, #536478); }
        .empty { max-width: 31rem; margin: .75rem auto 0; text-align: center; padding: clamp(1rem, 4vw, 1.65rem); }
        .empty h2 { font-size: 1.35rem; margin: .35rem 0; }
        .empty .primary { margin-top: 1rem; }
        .trophy { font-size: 1.8rem; }

        :is(button, a, input):focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
    `],
    template: `
        <main>
            <header>
                <h1>Tournament Center</h1>
                <p>Create, manage, and run your tournaments.</p>
            </header>
            <app-tournament-navigation />
            <div>
                @if (creatingView) {
                <section class="create" aria-labelledby="create-heading">
                    <h2 id="create-heading">Create a Tournament</h2>
                    @if (role && !isAdmin && ownedCount !== undefined) { <p>{{ ownedCount }} of 3 tournaments created</p> }
                    @if (atLimit) { <p>You have reached your limit of 3 tournaments. Contact an administrator if you need an existing tournament removed.</p> }
                    @if (listError) { <button type="button" (click)="load()">Retry allowance check</button> }
                    <form #form="ngForm" (ngSubmit)="create()">
                        <label>Tournament Name
                            <input class="form-control" name="name" maxlength="50" required [(ngModel)]="name">
                        </label>
                        <label>Tournament Date
                            <input class="form-control" name="date" type="date" required [(ngModel)]="date">
                        </label>
                        <button type="submit" [disabled]="form.invalid || !name.trim() || !canCreate || creating || !!createdId">Create Tournament</button>
                    </form>
                    @if (createdId && !creating) {
                        <a [routerLink]="['/tournament', createdId]">Open your new tournament</a>
                    }
                </section>
                } @else if (currentView) {
                    @if (loading) { <p role="status">Loading tournaments…</p> }
                    @else if (listError) {
                        <p role="alert">Could not load your tournaments.</p>
                        <button type="button" (click)="load()">Retry</button>
                    } @else if (currentTournament; as event) {
                        <section class="tournament-card create" aria-labelledby="current-title">
                            <h2 id="current-title">{{ event.leagueName }}</h2>
                            @if (event.eventDate | tournamentDate; as date) { <p><time [attr.datetime]="event.eventDate">{{ date }}</time></p> }
                            <span class="badge-status" [class.done]="event.status === 'Completed'">{{ event.status }}</span>
                            <div class="metadata">
                                <p>{{ event.participants }} registered</p>
                                <p>{{ event.generated }} rounds generated</p>
                                <p>{{ event.completed }} rounds completed</p>
                                @if (event.legacyScrambles) { <p>{{ event.legacyScrambles }} historical scrambles saved</p> }
                            </div>
                            <p>{{ suggestedAction(event) }}</p>
                            <div class="actions"><a class="primary" [routerLink]="['/tournament', event.id]">Continue Tournament</a></div>
                        </section>
                    } @else {
                        <section class="empty">
                            <h2>No current tournament</h2>
                            <p>Open a tournament you manage or create a new one.</p>
                            <a class="primary" routerLink="/tournament">Manage Tournaments</a>
                            <a class="primary" routerLink="/tournament" [queryParams]="{view: 'create'}">Create Tournament</a>
                        </section>
                    }
                } @else {
                <section class="listing" aria-label="Manage Tournaments">
                    @if (loading) { <p role="status">Loading tournaments…</p> }
                    @else if (listError) {
                        <p role="alert">Could not load your tournaments.</p>
                        <button type="button" (click)="load()">Retry</button>
                    } @else if (!tournaments.length) {
                        <section class="empty" aria-labelledby="empty-heading">
                            <span class="trophy" aria-hidden="true">🏆</span>
                            <h2 id="empty-heading">{{ tournamentsExist ? 'No tournaments to manage' : 'No tournaments yet' }}</h2>
                            <p>{{ tournamentsExist ? 'There are no tournaments within your management permissions.' : 'Create a tournament to manage participants, generate rounds, record scores, and track standings.' }}</p>
                            @if (canCreate) {
                                <a class="primary" routerLink="/tournament" [queryParams]="{view: 'create'}">Create Tournament</a>
                            }
                        </section>
                    } @else {
                        <div class="list-heading"><h2>Manage Tournaments</h2><span>{{ tournaments.length }} {{ tournaments.length === 1 ? 'tournament' : 'tournaments' }}</span></div>
                        @if (tournaments.length > 3 || query) {
                            <label class="search">Find a tournament
                                <input class="form-control" type="search" [(ngModel)]="query" />
                            </label>
                        }
                        <ul class="tournament-cards">
                            @for (event of visibleTournaments; track event.id) {
                                <li class="tournament-card">
                                    <h3>{{ event.leagueName }}</h3>
                                    @if (event.status) { <span class="badge-status" [class.done]="event.status === 'Completed'">{{ event.status }}</span> }
                                    <div class="metadata">
                                        @if (event.eventDate | tournamentDate; as date) { <p><time [attr.datetime]="event.eventDate">{{ date }}</time></p> }
                                        <p>{{ event.participants }} registered</p>
                                        @if (event.total > 0) { <p>{{ event.completed }} of {{ event.total }} rounds completed</p> }
                                        @if (event.legacyScrambles) { <p>{{ event.legacyScrambles }} historical scrambles saved</p> }
                                    </div>
                                    <div class="actions">
                                        <a class="primary" [routerLink]="['/tournament', event.id]" [attr.aria-label]="'Open Tournament: ' + event.leagueName">Open Tournament</a>
                                        @if (isAdmin) {
                                            <button class="delete" type="button" [disabled]="deletingId !== undefined" (click)="deleteTournament(event.id)"
                                                [attr.aria-label]="'Delete Tournament: ' + event.leagueName">Delete Tournament</button>
                                        }
                                    </div>
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
    private readonly login = inject(LoginService);
    private readonly confirm = injectConfirmation();
    private readonly notifications = inject(TournamentNotifications);
    private readonly datePipe = inject(TournamentDatePipe);
    private readonly selection = toSignal(this.leagues.selectedLeague$);
    role = '';
    ownedCount?: number;
    get isAdmin() { return this.role === 'Admin'; }
    get atLimit() { return !this.isAdmin && this.ownedCount >= 3; }
    get canCreate() { return !!this.role && !this.loading && !this.listError && !this.atLimit; }
    get creatingView() { return this.route.snapshot.queryParamMap.get('view') === 'create'; }
    get currentView() { return this.route.snapshot.queryParamMap.get('view') === 'current'; }
    get currentTournament() { return this.tournaments.find(event => event.id === this.selection()?.leagueId); }
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
    deletingId?: number;
    tournamentsExist = false;

    suggestedAction(event: ManagedTournament): string {
        if (event.status === 'Completed') return 'Next: review the results.';
        if (event.generated) return 'Next: review matchups or record scores.';
        if (event.legacyScrambles) return 'Next: open the workspace to review historical standings.';
        const actions = ['confirm the tournament details', 'add participants', 'set up teams and rounds',
            'review priorities and byes', 'confirm participants', 'preview the rounds'];
        return 'Next: ' + (actions[(event.workflowStep || 1) - 1] ?? 'open the workspace') + '.';
    }

    constructor() {
        this.login.getUsersRole().pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: ({ role }) => this.role = role,
            error: () => this.role = ''
        });
        this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.load());
    }

    load(): void {
        this.loading = true;
        this.listError = false;
        this.http.get<ManagedTournament[]>('/api/tournaments/managed', { observe: 'response' }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: response => {
                this.tournamentsExist = response.headers.get('X-Tournaments-Exist') === 'true';
                this.ownedCount = Number(response.headers.get('X-Owned-Tournament-Count') ?? response.body?.length ?? 0);
                this.tournaments = (response.body ?? []).slice().sort((a, b) =>
                    Number(a.status === 'Completed') - Number(b.status === 'Completed') ||
                    (b.eventDate ?? '').localeCompare(a.eventDate ?? '') ||
                    a.leagueName.localeCompare(b.leagueName));
                this.loading = false;
            },
            error: () => { this.loading = false; this.listError = true; }
        });
    }

    async deleteTournament(id: number): Promise<void> {
        if (!this.isAdmin || this.deletingId !== undefined) return;
        this.deletingId = id;
        const url = '/api/tournaments/' + id;
        try {
            const preview = await firstValueFrom(this.http.get<DeletionPreview>(url + '/deletion-preview')
                .pipe(takeUntilDestroyed(this.destroy)));
            const eventDate = this.datePipe.transform(preview.eventDate, 'mediumDate');
            const confirmed = await this.confirm({
                title: 'Delete Tournament',
                message: 'This permanently removes the tournament, its participants and rounds, and all recorded results and history for this event.',
                action: 'Permanently Delete',
                tone: 'danger',
                confirmName: preview.name,
                tournament: { name: preview.name, date: eventDate, participants: preview.participants,
                    rounds: preview.generated, hasScores: preview.hasScores }
            });
            if (!confirmed) return;
            await firstValueFrom(this.http.delete(url, { body: { name: preview.name, revision: preview.revision } })
                .pipe(takeUntilDestroyed(this.destroy)));
            this.leagues.removeDeletedTournament(id);
            this.tournaments = this.tournaments.filter(event => event.id !== id);
            this.tournamentsExist = this.tournaments.length > 0;
            this.notifications.success('Tournament deleted.');
        } catch (error) {
            if (this.destroy.destroyed) return;
            const message = error.error?.message || 'Could not delete the tournament. Try again.';
            if (error.status === 404 || error.status === 409) this.load();
            if (error.status === 409) void this.confirm({ title: 'Tournament could not be deleted', message });
            else this.notifications.error(message);
        } finally {
            this.deletingId = undefined;
        }
    }

    create(): void {
        const name = this.name.trim();
        if (!this.canCreate || !name || !this.date || this.creating || this.createdId) return;
        this.creating = true;
        this.players.AddNewLeague(name, 2, this.date).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: created => {
                this.createdId = created.id;
                this.leagues.getLeagues().pipe(takeUntilDestroyed(this.destroy)).subscribe({
                    next: events => {
                        this.creating = false;

                        this.leagues.setSelectedLeague(created.id);
                        this.notifications.success('Tournament created.');
                        this.router.navigate(['/tournament', created.id], { queryParams: { step: 1 } });
                    },
                    error: () => {
                        this.creating = false;
                        this.notifications.error('The tournament was created. Reload this page to refresh your event list.');
                    }
                });
            },
            error: error => {
                this.creating = false;
                this.notifications.error(error.error?.message || 'Could not create the tournament. Try again.');
                if (error.status === 409) this.load();
            }
        });
    }
}

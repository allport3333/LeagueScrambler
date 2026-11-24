import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LeagueService } from './services/league.service';
import { TournamentCheckInComponent } from './tournament-check-in.component';
import { TournamentParticipantsComponent } from './tournament-participants.component';
import { TournamentRoundsComponent } from './tournament-rounds.component';

interface TournamentDetails {
    eventDate: string;
    description: string;
    location: string;
    version: string;
    workflowStep: number;
}

@Component({
    selector: 'app-tournament-center',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, RouterLink, TournamentParticipantsComponent, TournamentCheckInComponent, TournamentRoundsComponent],
    styles: [`
        main { padding: 16px; max-width: 100rem; margin: auto; }
        header { text-align: center; margin-bottom: 16px; }
        .workflow { display: grid; grid-template-columns: minmax(170px, 220px) minmax(0, 1fr); gap: 20px; }
        ol { list-style: none; margin: 0; padding: 0; }
        ol button { width: 100%; text-align: start; margin-bottom: 6px; }
        button { min-height: 44px; padding: 8px 12px; border-radius: 5px; color: inherit; background: var(--hub-surface, #fff); border: 1px solid var(--hub-border, #bcc6d2); }
        button[aria-current], button.primary { color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); }
        button:disabled { opacity: .65; }
        small { display: block; }

        form, label { display: grid; gap: 8px; }
        .mobile-step { display: none; margin-bottom: 12px; }
        form { max-width: 44rem; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
        :is(button, input, textarea, a):focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
        @media(max-width: 720px) {
            .workflow { display: block; }
            .wizard-steps { display: none; }
            .mobile-step { display: grid; }
        }
    `],
    template: `
        <main>
            <header>
                <h1>{{ name || 'Tournament Center' }}</h1>
                @if (details.eventDate) { <p>{{ details.eventDate }}</p> }
                @if (name) { <a routerLink="/standings" [queryParams]="{leagueId}">View Standings</a> }
            </header>
            @if (loading) { <p role="status">Loading tournament…</p> }
            @if (error) { <p role="alert">{{ error }}</p> }
            @if (name) {
                <div class="workflow">
                    <nav class="wizard-steps" aria-label="Tournament setup steps">
                        <ol>
                            @for (label of labels; track label; let index = $index) {
                                <li><button type="button" [attr.aria-current]="step === index + 1 ? 'step' : null"
                                    [disabled]="index + 1 > reached || saving" (click)="goTo(index + 1)">
                                    {{ index + 1 }}. {{ label }}
                                    <small>{{ step === index + 1 ? 'Current step' : index + 1 < reached ? 'Completed' : index + 1 === reached ? 'Ready' : 'Upcoming' }}</small>
                                </button></li>
                            }
                        </ol>
                    </nav>
                    <section>
                        <label class="mobile-step">Step {{ step }} of {{ labels.length }}
                            <select class="form-control" aria-label="Tournament setup step" [value]="step" [disabled]="saving"
                                (change)="goTo(+$any($event.target).value)">
                                @for (label of labels; track label; let index = $index) {
                                    <option [value]="index + 1" [disabled]="index + 1 > reached">{{ label }}</option>
                                }
                            </select>
                        </label>
                        @if (hasRounds && step < 7) {
                            <p>Setup changes apply to future generation. Saved assignments and scores stay in place. Use a replacement preview to change an unscored round.</p>
                        }
                        @if (step === 1) {
                            <h2>Tournament Details</h2>
                            <form #form="ngForm" (ngSubmit)="advance()">
                                <label>Tournament Name <input class="form-control" name="name" maxlength="50" required [(ngModel)]="draftName"></label>
                                <label>Tournament Date <input class="form-control" name="date" type="date" required [(ngModel)]="details.eventDate"></label>
                                <label>Location <input class="form-control" name="location" maxlength="120" [(ngModel)]="details.location"></label>
                                <label>Description <textarea class="form-control" name="description" maxlength="500" [(ngModel)]="details.description"></textarea></label>
                                <button class="primary" type="submit" [disabled]="form.invalid || saving">Save & Continue</button>
                            </form>
                        }
                        @if (step === 2) {
                            <app-tournament-participants [leagueId]="leagueId" [tournamentName]="name" />
                            @if (reached >= 5) { <button type="button" (click)="goTo(5)">Manage Check In</button> }
                        }
                        @if (step === 5) {
                            <p>You can prepare this tournament in advance and return here on tournament day to establish the eligible roster.</p>
                            <app-tournament-check-in [embedded]="true" />
                        }
                        @if (step === 3 || step === 4 || step >= 6) {
                            <app-tournament-rounds [leagueId]="leagueId" [tournamentName]="name" [wizardStep]="step"
                                (versionChanged)="details.version = $event" (roundsSaved)="runTournament()" />
                        }
                        <div class="actions">
                            @if (step > 1 && step < 7) { <button type="button" [disabled]="saving" (click)="goTo(step - 1)">Back</button> }
                            @if (step > 1 && step <= 5) {
                                <button type="button" class="primary" [disabled]="saving" (click)="advance()">Save & Continue</button>
                            }
                            @if (step === 7) {
                                <button type="button" (click)="goTo(1)">Manage Tournament Setup</button>
                            } @else if (hasRounds) {
                                <button type="button" (click)="goTo(7)">Return to Run Tournament</button>
                            }
                        </div>
                    </section>
                </div>
            }
        </main>
    `
})
export class TournamentCenterComponent {
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    private readonly leagueService = inject(LeagueService);
    private readonly rounds = viewChild(TournamentRoundsComponent);
    readonly leagueId = Number(inject(ActivatedRoute).snapshot.paramMap.get('leagueId'));
    private readonly url = '/api/tournaments/' + this.leagueId;
    readonly labels = ['Tournament Details', 'Manage Participants', 'Team & Round Setup', 'Player Priorities & Byes',
        'Player Check In', 'Generate & Preview Tournament', 'Run Tournament'];
    name = '';
    draftName = '';
    details: TournamentDetails = { eventDate: '', description: '', location: '', version: null, workflowStep: 1 };
    loading = true;
    saving = false;
    hasRounds = false;
    reached = 1;
    step = 1;
    error = '';

    constructor() {
        this.request(this.http.get<{ name: string; details: TournamentDetails; hasRounds: boolean }>(this.url)).then(response => {
            this.name = this.draftName = response.name;
            if (response.details) this.details = response.details;
            this.hasRounds = response.hasRounds;
            this.step = this.reached = this.hasRounds ? 7 : (this.details.workflowStep || 1);
            this.leagueService.selectNavigationLeague(this.leagueId).pipe(takeUntilDestroyed(this.destroy)).subscribe();
        }).catch(() => this.error = 'This tournament is unavailable to your account.')
            .finally(() => this.loading = false);
    }

    private request<T>(observable: import('rxjs').Observable<T>) {
        return firstValueFrom(observable.pipe(takeUntilDestroyed(this.destroy)));
    }

    goTo(step: number) {
        if (step < 1 || step > this.reached) return;
        this.error = '';
        this.step = step;
    }

    runTournament() {
        this.hasRounds = true;
        this.reached = this.step = 7;
    }

    async advance() {
        if (this.saving) return;
        this.saving = true;
        this.error = '';
        try {
            if (this.step === 1) {
                if (!this.details.eventDate || !this.draftName.trim()) throw new Error('Enter a tournament name and date.');
                const saved = await this.request(this.http.put<{name: string; details: TournamentDetails}>(this.url + '/details',
                    { ...this.details, name: this.draftName }));
                const renamed = this.name !== saved.name;
                this.name = this.draftName = saved.name;
                this.details = saved.details;
                if (renamed) this.leagueService.getLeagues().pipe(takeUntilDestroyed(this.destroy))
                    .subscribe({ next: () => this.leagueService.setSelectedLeague(this.leagueId), error: () => {} });
            }
            if ((this.step === 3 || this.step === 4) && !(await this.rounds()?.saveSettings())) return;
            const result = await this.request(this.http.put<{step: number}>(this.url + '/workflow', { step: this.step }));
            this.reached = Math.max(this.reached, result.step);
            this.step++;
        } catch (error) {
            this.error = error.error?.message || (error.status ? 'Could not save this step. Reload the tournament and try again.' : error.message);
        } finally { this.saving = false; }
    }
}

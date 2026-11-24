import { TournamentDatePipe } from './tournament-date.pipe';
import { TournamentNavigationComponent } from './tournament-navigation.component';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
    imports: [FormsModule, TournamentParticipantsComponent, TournamentCheckInComponent, TournamentRoundsComponent, TournamentNavigationComponent, TournamentDatePipe],
    styles: [`
        main { padding: 16px; max-width: 100rem; margin: auto; }
        header { text-align: center; margin-bottom: 16px; overflow-wrap: anywhere; }
        .workflow { display: grid; grid-template-columns: minmax(145px, 178px) minmax(0, 1fr); gap: 16px; }
        .step-content { min-width: 0; width: 100%; margin-inline: auto; }
        .step-content.compact { max-width: 50rem; }
        .step-content.configuration { max-width: 65rem; }
        .step-content > h2, .generation-note { text-align: center; }
        .header-meta { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: .5rem .75rem; }
        .tournament-status { border-radius: 1rem; padding: .15rem .55rem; border: 1px solid var(--hub-border, #bcc6d2); font-size: .9rem; }
        .step-label { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr); gap: .4rem; align-items: start; }
        .step-mark { font-size: .9rem; }
        ol { list-style: none; margin: 0; padding: 0; }
        ol button { width: 100%; text-align: start; margin-bottom: 6px; }
        button { min-height: 44px; padding: 8px 12px; border-radius: 5px; color: inherit; background: var(--hub-surface, #fff); border: 1px solid var(--hub-border, #bcc6d2); }
        button[aria-current], button.primary { color: var(--hub-action-text, #fff); background: var(--hub-primary-action, #30577e); }
        button:disabled { opacity: .65; }
        small { display: block; }

        form, label { display: grid; gap: 8px; }
        .mobile-step { display: none; margin-bottom: 12px; }
        .actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr); align-items: center; gap: 12px; margin-top: 18px; }
        .actions .back { grid-column: 1; justify-self: start; }
        .actions .save { grid-column: 2; justify-self: center; }
        .actions .run { grid-column: 3; justify-self: end; }
        .standings-link { color: var(--hub-link, #245587); background: transparent; border: 0; text-decoration: underline; }
        :is(button, input, textarea, a):focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
        @media(max-width: 720px) {
            .workflow { display: block; }
            .wizard-steps { display: none; }
            .mobile-step { display: grid; }
            .actions { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .45rem; }
            .actions .save { grid-column: 1 / -1; grid-row: 1; width: 100%; }
            .actions .back { grid-row: 2; }
            .actions .run { grid-column: 2; grid-row: 2; }
        }
    `],
    template: `
        <main>
            <header>
                <h1>{{ name || 'Tournament Center' }}</h1>
                <div class="header-meta">
                @if (details.eventDate) { <time [attr.datetime]="details.eventDate">{{ details.eventDate | tournamentDate }}</time> }
                @if (status) { <span class="tournament-status">{{ completed ? 'Completed' : status }}</span> }
                @if (name) { <button type="button" class="standings-link" [disabled]="navigationBusy" (click)="openStandings()">View Standings</button> }
                </div>
                <app-tournament-navigation [leagueId]="name ? leagueId : undefined" />
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
                                    <span class="step-label">
                                        <span class="step-mark" aria-hidden="true">{{ index + 1 < reached && step !== index + 1 ? '✓' : index + 1 }}</span>
                                        <span>{{ label }}<span class="sr-only">{{ index + 1 < reached ? ', completed' : '' }}</span></span>
                                    </span>
                                </button></li>
                            }
                        </ol>
                    </nav>
                    <section class="step-content" [class.compact]="step === 1" [class.configuration]="step === 3">
                        <label class="mobile-step">Step {{ step }} of {{ labels.length }}
                            <select class="form-control" aria-label="Tournament setup step" #stepPicker="ngModel" [ngModel]="step" [disabled]="saving"
                                (ngModelChange)="goTo($event); stepPicker.control.setValue(step, {emitEvent: false})">
                                @for (label of labels; track label; let index = $index) {
                                    <option [ngValue]="index + 1" [disabled]="index + 1 > reached">{{ label }}</option>
                                }
                            </select>
                        </label>
                        @if (hasRounds && step === 3) {
                            <p class="generation-note">Changes apply to future generation. Saved rounds and scores stay in place.</p>
                        }
                        @if (step === 1) {
                            <h2>Tournament Details</h2>
                            <form id="tournament-details" #form="ngForm" (ngSubmit)="advance()">
                                <label>Tournament Name <input class="form-control" name="name" maxlength="50" required [(ngModel)]="draftName"></label>
                                <label>Tournament Date <input class="form-control" name="date" type="date" required [(ngModel)]="details.eventDate"></label>
                                <label>Location <input class="form-control" name="location" maxlength="120" [(ngModel)]="details.location"></label>
                                <label>Description <textarea class="form-control" name="description" maxlength="500" [(ngModel)]="details.description"></textarea></label>

                            </form>
                        }
                        @if (step === 2) {
                            <app-tournament-participants [leagueId]="leagueId" [tournamentName]="name" />
                        }
                        @if (step === 5) {
                            <app-tournament-check-in [leagueId]="leagueId" [hasRounds]="hasRounds" (versionChanged)="details.version = $event" />
                        }
                        @if (step === 3 || step === 4 || step >= 6) {
                            <app-tournament-rounds [leagueId]="leagueId" [tournamentName]="name" [wizardStep]="step" [initialScoreRound]="initialScoreRound" [initialRunView]="initialRunView"
                                (versionChanged)="details.version = $event" (roundsSaved)="runTournament()" (runRequested)="runTournament()" (standingsRequested)="openStandings()" (completionChanged)="completed = $event" />
                        }
                        <div class="actions">
                            @if (step > 1 && step < 7) { <button type="button" class="back" [disabled]="saving" (click)="goTo(step - 1)">Back</button> }
                            @if (step === 1) {
                                <button class="primary save" type="submit" form="tournament-details"
                                    [disabled]="saving || !draftName.trim() || !details.eventDate">Save & Continue</button>
                            } @else if (step <= 5) {
                                <button type="button" class="primary save" [disabled]="navigationBusy" (click)="advance()">Save & Continue</button>
                            }
                            @if (step === 7) {
                                <button type="button" class="run" (click)="goTo(1)">Manage Tournament Setup</button>
                            } @else if (hasRounds) {
                                <button type="button" class="run" (click)="returnToRun()">Return to Run Tournament</button>
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
    private readonly router = inject(Router);
    private readonly participants = viewChild(TournamentParticipantsComponent);
    private readonly checkIn = viewChild(TournamentCheckInComponent);
    private savedDetails?: TournamentDetails;
    private readonly rounds = viewChild(TournamentRoundsComponent);
    private readonly route = inject(ActivatedRoute);
    readonly leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
    readonly initialRunView = this.route.snapshot.queryParamMap.get('runView') ?? undefined;
    readonly initialScoreRound = Number(this.route.snapshot.queryParamMap.get('scoreRound')) || undefined;
    private readonly url = '/api/tournaments/' + this.leagueId;
    readonly labels = ['Tournament Details', 'Manage Participants', 'Team & Round Setup', 'Player Priorities & Byes',
        'Confirm Participants', 'Generate & Preview Tournament', 'Run Tournament'];
    name = '';
    draftName = '';
    details: TournamentDetails = { eventDate: '', description: '', location: '', version: null, workflowStep: 1 };
    loading = true;
    saving = false;
    hasRounds = false;
    status = '';
    completed = false;
    reached = 1;
    step = 1;
    error = '';

    get standingsQuery() {
        const rounds = this.rounds();
        const round = rounds?.view === 'scores' ? rounds.scoreRound?.roundNumber : undefined;
        return { leagueId: this.leagueId, tournament: 1, returnStep: this.step, returnRound: round,
            returnView: this.step === 7 ? rounds?.view : undefined };
    }

    constructor() {
        this.request(this.http.get<{ name: string; details: TournamentDetails; hasRounds: boolean; status: string }>(this.url)).then(response => {
            this.name = this.draftName = response.name;
            if (response.details) this.details = response.details;
            this.savedDetails = { ...this.details };
            this.hasRounds = response.hasRounds;
            this.status = response.status;
            this.reached = this.hasRounds ? 7 : (this.details.workflowStep || 1);
            const requestedStep = Number(this.route.snapshot.queryParamMap.get('step') ?? this.rememberedStep());
            this.step = Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= this.reached
                ? requestedStep : this.reached;
            this.rememberStep();
            this.leagueService.selectNavigationLeague(this.leagueId).pipe(takeUntilDestroyed(this.destroy)).subscribe();
        }).catch(() => this.error = 'This tournament is unavailable to your account.')
            .finally(() => this.loading = false);
    }

    private request<T>(observable: import('rxjs').Observable<T>) {
        return firstValueFrom(observable.pipe(takeUntilDestroyed(this.destroy)));
    }

    openStandings() {
        void this.router.navigate(['/standings'], { queryParams: this.standingsQuery });
    }

    get navigationBusy() {
        return this.saving || this.rounds()?.busy || this.checkIn()?.busy || this.checkIn()?.loading || this.participants()?.busy;
    }

    private get hasUnsavedChanges() {
        return !!((this.step === 1 && this.detailsChanged) || this.rounds()?.hasUnsavedChanges || this.participants()?.hasUnsavedChanges);
    }

    private get detailsChanged() {
        const original = this.savedDetails;
        return this.draftName !== this.name || original?.eventDate !== this.details.eventDate ||
            original?.location !== this.details.location || original?.description !== this.details.description;
    }

    @HostListener('window:beforeunload', ['$event'])
    confirmReload(event: BeforeUnloadEvent) {
        if (this.navigationBusy || this.hasUnsavedChanges) {
            event.preventDefault();
            event.returnValue = '';
        }
    }

    canLeave(): boolean {
        return !this.navigationBusy &&
            (!this.hasUnsavedChanges || window.confirm('Discard unsaved tournament changes?'));
    }

    private get stepStorageKey() { return 'league-hub-tournament-step:' + this.leagueId; }
    private rememberedStep(): string | null {
        try { return sessionStorage.getItem(this.stepStorageKey); }
        catch { return null; }
    }
    private rememberStep() {
        try { sessionStorage.setItem(this.stepStorageKey, String(this.step)); }
        catch { /* Session storage is optional. */ }
    }

    goTo(step: number) {
        if (step === this.step || step < 1 || step > this.reached || !this.canLeave()) return;
        if (this.step === 1 && this.savedDetails) {
            this.draftName = this.name;
            this.details = { ...this.savedDetails, version: this.details.version };
        }
        this.rounds()?.discardUnsavedChanges();
        this.error = '';
        this.step = step;
        this.rememberStep();
        this.clearReturnContext();
    }

    returnToRun() {
        this.goTo(7);
        if (this.step === 7) {
            const workspace = this.rounds();
            workspace?.changeRunView(workspace.tournamentComplete ? 'complete' : 'rounds');
        }
    }

    runTournament() {
        this.hasRounds = true;
        this.status = 'In Progress';
        this.reached = this.step = 7;
        this.rememberStep();
        this.clearReturnContext();
    }

    private clearReturnContext() {
        const params = this.route.snapshot.queryParamMap;
        if (!params.has('step') && !params.has('runView') && !params.has('scoreRound')) return;
        void this.router.navigate([], {
            relativeTo: this.route, queryParams: { step: null, runView: null, scoreRound: null },
            queryParamsHandling: 'merge', replaceUrl: true
        });
    }

    async advance() {
        if (this.saving || this.participants()?.busy) return;
        if (this.step === 2 && this.participants()?.hasUnsavedChanges &&
            !window.confirm('Discard the unfinished player registration?')) return;
        this.saving = true;
        this.error = '';
        try {
            if (this.step === 1 && (!this.details.eventDate || !this.draftName.trim())) {
                throw new Error('Enter a tournament name and date.');
            }
            if (this.step === 1 && (this.detailsChanged || !this.details.version)) {
                const saved = await this.request(this.http.put<{name: string; details: TournamentDetails}>(this.url + '/details',
                    { ...this.details, name: this.draftName }));
                const renamed = this.name !== saved.name;
                this.name = this.draftName = saved.name;
                this.details = saved.details;
                this.savedDetails = { ...saved.details };
                if (renamed) this.leagueService.getLeagues().pipe(takeUntilDestroyed(this.destroy))
                    .subscribe({ next: () => this.leagueService.setSelectedLeague(this.leagueId), error: () => {} });
            }
            if ((this.step === 3 || this.step === 4) && !(await this.rounds()?.saveSettings())) return;
            if (this.step === 5 && !(await this.checkIn()?.saveEligibility())) return;
            const result = await this.request(this.http.put<{step: number}>(this.url + '/workflow', { step: this.step }));
            this.reached = Math.max(this.reached, result.step);
            this.step++;
            this.rememberStep();
            this.clearReturnContext();
            if (!this.hasRounds && this.step === 6) this.status = 'Ready';
        } catch (error) {
            this.error = error.error?.message || (error.status ? 'Could not save this step. Reload the tournament and try again.' : error.message);
        } finally { this.saving = false; }
    }
}

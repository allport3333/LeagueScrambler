import { TournamentDatePipe } from './tournament-date.pipe';
import { EventFacilityComponent } from './facilities/event-facility.component';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LeagueService } from './services/league.service';
import { TournamentCheckInComponent } from './tournament-check-in.component';
import { TournamentParticipantsComponent } from './tournament-participants.component';
import { TournamentRoundsComponent } from './tournament-rounds.component';
import { TournamentNotifications } from './tournament-notifications.service';
import { injectConfirmation } from './confirmation-dialog';

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
    imports: [FormsModule, RouterLink, TournamentParticipantsComponent, TournamentCheckInComponent, TournamentRoundsComponent, TournamentDatePipe, EventFacilityComponent],
    styles: [`
        main { padding: 0 clamp(.5rem, 1.5vw, 1.5rem); max-width: 110rem; margin: .75rem auto; }
        .workspace { --workspace-padding: clamp(.75rem, 1.4vw, 1.5rem); border: 1px solid var(--hub-border, #bcc6d2);
            border-radius: .85rem; background: var(--hub-surface, #fff); }
        header { text-align: center; padding: var(--workspace-padding) var(--workspace-padding) .3rem;
            overflow-wrap: anywhere; border-bottom: 1px solid var(--hub-border, #bcc6d2); }
        h1 { margin: 0 0 .35rem; }
        .workspace-links { display: flex; flex-wrap: wrap; justify-content: center; column-gap: .85rem; }
        .center-return { display: inline-flex; align-items: center; min-height: 44px; color: var(--hub-link, #245587); text-decoration: underline; }
        .workflow { display: grid; grid-template-columns: minmax(145px, 178px) minmax(0, 1fr);
            gap: var(--workspace-padding); padding: var(--workspace-padding); align-items: start; }
        .wizard-steps { align-self: stretch; padding-inline-end: .65rem; border-inline-end: 1px solid var(--hub-border, #bcc6d2); }
        .workspace-message { padding-inline: var(--workspace-padding); }
        .step-content { min-width: 0; width: 100%; margin-inline: auto; }
        .step-content.compact { max-width: 50rem; }
        .step-content.configuration { max-width: 65rem; }
        .step-content > h2, .generation-note { text-align: center; }
        .step-content > h2 { margin-top: 0; }
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
            main { margin-block: .45rem; }
            .workspace { --workspace-padding: .65rem; }
            h1 { font-size: clamp(1.55rem, 6.5vw, 2rem); }
            .workspace-links { gap: 0 .6rem; }
            .center-return, .standings-link { padding-inline: .15rem; font-size: .875rem; }
            .workflow { display: block; padding-inline: .5rem; }
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
          <div class="workspace">
            <header>
                <h1>{{ name || 'Tournament Center' }}</h1>
                <div class="header-meta">
                @if (details.eventDate) { <time [attr.datetime]="details.eventDate">{{ details.eventDate | tournamentDate }}</time> }
                @if (status) { <span class="tournament-status">{{ completed ? 'Completed' : status }}</span> }
                </div>
                <div class="workspace-links">
                    <a class="center-return" routerLink="/tournament" [queryParams]="{view: 'current'}">Back to Tournament Center</a>
                    @if (name && !(step === 7 && completed)) {
                        <button type="button" class="standings-link" [disabled]="navigationBusy" (click)="openStandings()">View Standings</button>
                    }
                </div>
            </header>
            @if (loading) { <p role="status">Loading tournament…</p> }
            @if (error) { <p class="workspace-message" role="alert">{{ error }}</p> }
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
                                @if (!hasAssignedFacility) { <label>Location <input class="form-control" name="location" maxlength="120" [(ngModel)]="details.location"></label> }
                                <label>Description <textarea class="form-control" name="description" maxlength="500" [(ngModel)]="details.description"></textarea></label>

                            </form>
                            <app-event-facility [eventId]="leagueId" [manage]="true" (facilitySelected)="hasAssignedFacility = $event" />
                        }
                        @if (step === 2) {
                            <app-tournament-participants [leagueId]="leagueId" [tournamentName]="name" />
                        }
                        @if (step === 5) {
                            @if (pendingRegenerationRound) {
                                <button type="button" [disabled]="checkIn()?.busy" (click)="goTo(7)">Back to Round {{ pendingRegenerationRound }} Regeneration</button>
                            }
                            <app-tournament-check-in [leagueId]="leagueId" [hasRounds]="hasRounds" (versionChanged)="details.version = $event" />
                        }
                        @if (step === 3 || step === 4 || step >= 6) {
                            <app-tournament-rounds [leagueId]="leagueId" [tournamentName]="name" [wizardStep]="step" [initialScoreRound]="initialScoreRound" [initialRunView]="initialRunView" [initialRegenerationRound]="pendingRegenerationRound"
                                (attendanceRequested)="editAttendanceForRound($event)" (regenerationResumed)="pendingRegenerationRound = undefined"
                                (versionChanged)="details.version = $event" (roundsSaved)="runTournament()" (roundsCleared)="resetRoundWorkflow()" (runRequested)="runTournament()" (standingsRequested)="openStandings()" (completionChanged)="updateCompletion($event)" />
                        }
                        <div class="actions">
                            @if (step > 1 && step < 7) { <button type="button" class="back" [disabled]="saving" (click)="goTo(step - 1)">Back</button> }
                            @if (step === 1) {
                                <button class="primary save" type="submit" form="tournament-details"
                                    [disabled]="saving || !draftName.trim() || !details.eventDate">Save & Continue</button>
                            } @else if (step <= 5 && !rounds()?.additionalSettings && !rounds()?.managementOpen) {
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
          </div>
        </main>
    `
})
export class TournamentCenterComponent {
    private readonly http = inject(HttpClient);
    private readonly notifications = inject(TournamentNotifications);
    private readonly confirm = injectConfirmation();
    private readonly destroy = inject(DestroyRef);
    hasAssignedFacility = false;
    private readonly leagueService = inject(LeagueService);
    private readonly router = inject(Router);
    private readonly participants = viewChild(TournamentParticipantsComponent);
    private readonly checkIn = viewChild(TournamentCheckInComponent);
    private savedDetails?: TournamentDetails;
    private readonly rounds = viewChild(TournamentRoundsComponent);
    private readonly route = inject(ActivatedRoute);
    readonly leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
    readonly initialRunView = this.route.snapshot.queryParamMap.get('runView') ?? this.readRunView();
    pendingRegenerationRound?: number;
    readonly initialScoreRound = Number(this.route.snapshot.queryParamMap.get('scoreRound')) ||
        (this.initialRunView === 'scores' ? this.readScoreRound() : undefined);
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
            returnView: this.step === 7 ? rounds?.resumeView : undefined };
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
        }).catch(error => this.error = error.status === 404
            ? 'Tournament not found. It may have been deleted.'
            : 'This tournament is unavailable to your account.')
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

    async canLeave(): Promise<boolean> {
        if (this.navigationBusy) return false;
        if (this.hasUnsavedChanges && !await this.confirm({
            title: 'Unsaved changes', message: 'Discard unsaved tournament changes?', action: 'Discard', tone: 'danger'
        })) return false;
        if (this.step === 7 && this.rounds()) {
            try { sessionStorage.setItem(this.runViewStorageKey, this.rounds().resumeView); }
            catch { /* Session storage is optional. */ }
        }
        return true;
    }

    private get runViewStorageKey() { return 'league-hub-tournament-run-view-' + this.leagueId; }
    private readRunView(): string | undefined {
        try { return sessionStorage.getItem(this.runViewStorageKey) ?? undefined; }
        catch { return undefined; }
    }
    private readScoreRound(): number | undefined {
        try { return Number(sessionStorage.getItem('league-hub-tournament-score-round-' + this.leagueId)) || undefined; }
        catch { return undefined; }
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

    async editAttendanceForRound(round: number): Promise<void> {
        await this.goTo(5);
        if (this.step === 5) this.pendingRegenerationRound = round;
    }

    async goTo(step: number) {
        if (step === this.step || step < 1 || step > this.reached || !await this.canLeave()) return;
        this.notifications.dismissSuccess();
        if (this.step === 1 && this.savedDetails) {
            this.draftName = this.name;
            this.details = { ...this.savedDetails, version: this.details.version };
        }
        this.rounds()?.discardUnsavedChanges();
        this.error = '';
        this.step = step;
        if (step !== 5 && step !== 7) this.pendingRegenerationRound = undefined;
        this.rememberStep();
        this.clearReturnContext();
    }

    async returnToRun() {
        await this.goTo(7);
        if (this.step === 7) this.rounds()?.closeScores();
    }

    updateCompletion(complete: boolean) {
        this.completed = complete;
        if (this.hasRounds) this.status = this.rounds()?.activeRounds.length ? "In Progress" : "Ready";
    }

    resetRoundWorkflow() {
        this.hasRounds = this.completed = false;
        this.reached = this.step === 7 ? 7 : 6;
        this.status = "Ready";
        this.rememberStep();
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
            !await this.confirm({ title: 'Unfinished registration', message: 'Discard the unfinished player registration?',
                action: 'Discard', tone: 'danger' })) return;
        this.saving = true;
        this.error = '';
        try {
            if (this.step === 1 && (!this.details.eventDate || !this.draftName.trim())) {
                this.error = 'Enter a tournament name and date.';
                return;
            }
            if (this.step === 1 && (this.detailsChanged || !this.details.version)) {
                const saved = await this.request(this.http.put<{name: string; details: TournamentDetails}>(this.url + '/details',
                    { ...this.details, name: this.draftName }));
                this.name = this.draftName = saved.name;
                this.details = saved.details;
                this.savedDetails = { ...saved.details };
                this.leagueService.getLeagues().pipe(takeUntilDestroyed(this.destroy))
                    .subscribe({ next: () => this.leagueService.setSelectedLeague(this.leagueId), error: () => {} });
            }
            if ((this.step === 3 || this.step === 4) && !(await this.rounds()?.saveSettings(false))) return;
            if (this.step === 5 && !(await this.checkIn()?.saveEligibility())) return;
            const result = await this.request(this.http.put<{step: number}>(this.url + '/workflow', { step: this.step }));
            const messages = ['Tournament details saved.', 'Tournament roster confirmed.', 'Tournament settings saved.',
                'Player priorities and byes saved.', 'Participant eligibility confirmed.'];
            const message = messages[this.step - 1];
            if (message) this.notifications.success(message);
            this.reached = Math.max(this.reached, result.step);
            this.step++;
            this.rememberStep();
            this.clearReturnContext();
            if (!this.hasRounds && this.step === 6) this.status = 'Ready';
        } catch (error) {
            if (!this.destroy.destroyed)
                this.notifications.error(error.error?.message || 'Could not save this step. Reload the tournament and try again.');
        } finally { this.saving = false; }
    }
}

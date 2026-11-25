import { MatchupPrintSheetComponent, MatchupPrintSixComponent } from './matchup-print-sheet.component';
import { renderMatchupPrint } from './matchup-print';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, Injector, input, OnInit, output, TemplateRef, viewChild } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { EditableMatchupTeam, TournamentTeamEditorComponent } from './tournament-team-editor.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { generateTournament, TournamentAllocation, TournamentSettings } from './tournament-generation';
import { pairKey, ScramblePlayer } from './scrambler/scramble-engine';
import { TournamentNotifications } from './tournament-notifications.service';
import { injectConfirmation } from './confirmation-dialog';

interface Player { id: number; firstName: string; lastName: string; }
interface SettingsState {
    version: string; mode: number; roster: (Player & ScramblePlayer)[]; presentIds: number[];
    history: {scrambleNumber: number; dateOfTeam: string; playerIds: number[]}[];
    settings: TournamentSettings;
    additionalDefaults?: TournamentSettings;
}
interface SavedRound {
    roundNumber: number; status: 'unplayed' | 'partial' | 'completed' | 'voided'; gamesPerMatchup: number;
    teams: {id: number; players: Player[]; scores: {game: number; points: number}[]}[];
    byes: Player[];
    voidedAtUtc?: string;
    voidedByUserId?: number;
    manualByeIds?: number[] | null;
}
interface ScoreEdit {
    teamId: number; opponentId: number; game: number; points: number | null; opponentPoints: number | null;
    matchup: number;
}

@Component({
    selector: 'app-tournament-rounds',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, NgTemplateOutlet, MatDialogModule, TournamentTeamEditorComponent, MatchupPrintSheetComponent, MatchupPrintSixComponent],
    templateUrl: './tournament-rounds.component.html',
    styleUrl: './tournament-rounds.component.css'
})
export class TournamentRoundsComponent implements OnInit {
    readonly leagueId = input.required<number>();
    readonly tournamentName = input('');
    readonly readOnly = input(false);
    readonly wizardStep = input(0);
    readonly initialRegenerationRound = input<number>();
    readonly regenerationResumed = output<void>();
    readonly attendanceRequested = output<number>();
    readonly initialScoreRound = input<number>();
    readonly initialRunView = input<string>();
    readonly standingsRequested = output<void>();
    readonly roundsSaved = output<void>();
    readonly roundsCleared = output<void>();
    readonly runRequested = output<void>();
    readonly completionChanged = output<boolean>();
    matchupPrintLayout: 2 | 6 = 6;
    publicName = '';
    readonly versionChanged = output<string>();
    teamBySize = true;
    private readonly http = inject(HttpClient);
    private readonly notifications = inject(TournamentNotifications);
    private readonly dialogs = inject(MatDialog);
    private readonly manageTemplate = viewChild<TemplateRef<unknown>>('manageRoundDialog');
    private manageDialog?: MatDialogRef<unknown>;
    managedRound?: SavedRound;
    teamEditor?: { teams: EditableMatchupTeam[]; preview: boolean; version?: string };
    private manuallyEditedPreview = false;
    regeneratingFuture = false;
    private get keepSavedByes() { return this.wizardStep() !== 4 && this.replacingRounds.size > 0; }
    private readonly confirm = injectConfirmation();
    private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
    private readonly injector = inject(Injector);
    private readonly changeDetector = inject(ChangeDetectorRef);
    private readonly destroy = inject(DestroyRef);
    state?: SettingsState;
    rounds: SavedRound[] = [];
    managementOpen = false;
    showRegeneration = false;
    get selectedRemovalNumbers() { return [...this.removalSelection].sort((a, b) => a - b); }
    playingCount(round: SavedRound) { return round.teams.reduce((count, team) => count + team.players.length, 0); }
    removalSelection = new Set<number>();
    removeRequest?: { numbers: number[]; voidScored: boolean };
    canVoid = false;
    get activeRounds() { return this.rounds.filter(round => round.status !== "voided"); }
    get unplayedRounds() { return this.rounds.filter(round => round.status === "unplayed"); }
    get eligible() {
        if (!this.state?.mode) return [];
        return this.state.mode === 3 ? this.state.roster : this.state.roster.filter(player => this.state.presentIds.includes(player.id));
    }
    preview: TournamentAllocation[] = [];
    redrawRound?: number;
    redrawTrigger?: EventTarget | null;
    private redrawAnimations: Animation[] = [];
    private scrollFrame?: number;
    private scoreGuidance?: { scroller: HTMLElement; start: number; release: () => void };
    private roundHighlight?: Animation;
    readonly replacingRounds = new Set<number>();
    readonly inlinePreviews = new Map<number, SavedRound>();
    redrawState: 'idle' | 'loading' | 'fading' | 'shuffling' | 'revealing' | 'ready' = 'idle';
    get redrawTransitionPending(): boolean {
        return this.redrawState !== 'idle' && this.redrawState !== 'ready';
    }
    additionalSettings?: TournamentSettings;
    readonly tournamentRoundLimit = 30;
    get editSettings() { return this.additionalSettings ?? this.state?.settings; }
    get lastSavedRound() { return this.rounds.at(-1)?.roundNumber ?? 0; }
    get remainingRounds() { return this.tournamentRoundLimit - this.lastSavedRound; }
    get additionalRoundNumbers() {
        const count = this.additionalSettings?.numberOfRounds;
        return Number.isInteger(count) && count > 0 && count <= this.remainingRounds
            ? this.sequence(count).map(number => number + this.lastSavedRound) : [];
    }
    get byeRoundNumbers() { return this.additionalSettings ? this.additionalRoundNumbers : this.rounds.length ? this.activeRounds.map(round => round.roundNumber) : this.sequence(this.state.settings.numberOfRounds); }
    get gamesPerMatchupSummary() {
        return [...new Set(this.activeRounds.map(round => round.gamesPerMatchup))].sort((a, b) => a - b).join(", ");
    }
    private savedSettings?: TournamentSettings;
    error = '';
    busy = false;
    dirty = false;
    settingsSaved = false;
    fallback = false;
    previewVersion = '';
    repeats = 0;
    relaxedRounds: number[] = [];
    sharedTopRounds: number[] = [];
    step = 'rounds';
    readonly expandedRounds = new Set<number>();
    printingOpen = false;
    updateExpanded(round: number, open: boolean): void {
        if (open) this.expandedRounds.add(round);
        else this.expandedRounds.delete(round);
        try { sessionStorage.setItem(this.expandedRoundsKey, [...this.expandedRounds].join(',')); }
        catch { /* Session storage is optional. */ }
    }
    private get expandedRoundsKey() { return 'league-hub-tournament-expanded-rounds-' + this.leagueId(); }
    get resumeView(): string { return this.managementOpen ? 'management' : this.step; }
    get view(): string {
        if (this.additionalSettings) return 'configuration';
        switch (this.wizardStep()) {
            case 3: return 'configuration';
            case 4: return 'priorities';
            case 6: return 'rounds';
            default: return this.step;
        }
    }
    filter = '';
    priorityView: 'priorities' | 'byes' = 'priorities';
    priorityFilters = ['All', 'Top', 'Regular', 'Low'];
    priorityFilter = 'All';
    printRoundNumber?: number;
    get currentPrintRound() {
        return this.activeRounds.find(round => round.roundNumber === this.printRoundNumber) ?? this.scoreRound ?? this.nextRound ?? this.activeRounds[0];
    }

    priorityFor(id: number) {
        const settings = this.editSettings;
        return settings?.topPlayerIds.includes(id) ? 'top' : settings?.lowPlayerIds.includes(id) ? 'low' : 'regular';
    }

    get manualByeCount() { return this.editSettings?.manualByes.filter(item => item.roundNumber === this.byeRound).length ?? 0; }
    get selectedByeRound() { return this.rounds.find(round => round.roundNumber === this.byeRound); }
    get savedByeSummary() {
        const round = this.selectedByeRound;
        if (!round) return null;
        const manual = round.manualByeIds == null ? null : round.byes.filter(player => round.manualByeIds.includes(player.id)).length;
        return { manual, automatic: manual === null ? null : round.byes.length - manual,
            playing: round.teams.reduce((count, team) => count + team.players.length, 0), totalByes: round.byes.length };
    }

    async previewByeReplacement(trigger: EventTarget | null) {
        const round = this.selectedByeRound;
        if (round?.status !== 'unplayed' || this.busy) return;
        if (this.dirty && !(await this.saveSettings())) return;
        await this.propose(round.roundNumber, trigger);
        if (this.preview.length) {
            this.step = 'rounds';
            this.runRequested.emit();
        }
    }

    get hasUnsavedChanges() {
        return !!this.additionalSettings || this.dirty || this.preview.length > 0 || this.hasUnsavedScores;
    }

    private get hasUnsavedScores() {
        return this.scoreEdits.some(edit => {
            const first = this.scoreRound?.teams.find(team => team.id === edit.teamId);
            const second = this.scoreRound?.teams.find(team => team.id === edit.opponentId);
            return edit.points !== (first?.scores.find(score => score.game === edit.game)?.points ?? null) ||
                edit.opponentPoints !== (second?.scores.find(score => score.game === edit.game)?.points ?? null);
        });
    }

    discardUnsavedChanges() {
        this.stopScoreGuidance();
        if (this.additionalSettings) this.cancelAdditionalRounds();
        this.closeManagement();
        if (this.dirty && this.savedSettings && this.state) {
            this.state.settings = structuredClone(this.savedSettings);
            this.teamBySize = this.state.settings.maximumTeamSize !== null;
        }
        if (this.scoreRound) {
            const view = this.step;
            this.initializeScores(this.scoreRound);
            this.step = view;
        }
        this.dirty = false;
        this.cancelPreview();
    }

    roundStatus(round: SavedRound) {
        return round.status === 'voided' ? 'Voided' : round.status === 'completed' ? 'Completed' : round.status === 'partial' ? 'Partially Scored' : 'Not Started';
    }
    byeRound = 1;
    scoreRound?: SavedRound;
    private scoreVersion?: string;
    scoreEdits: ScoreEdit[] = [];
    scoreValidation = '';
    private get activeRoundKey() { return 'league-hub-tournament-score-round-' + this.leagueId(); }
    get tournamentComplete() {
        return this.activeRounds.length > 0 && this.completed === this.activeRounds.length;
    }

    printSelection = new Set<number>();
    printRounds: SavedRound[] = [];

    private get url(): string { return '/api/tournaments/' + this.leagueId(); }

    get filteredPlayers(): (Player & ScramblePlayer)[] {
        const query = this.filter.trim().toLowerCase();
        return (this.additionalSettings ? this.eligible : (this.state?.roster ?? [])).filter(player => this.playerName(player).toLowerCase().includes(query) &&
            (this.priorityView === 'byes' || this.priorityFilter === 'All' || this.priorityFor(player.id) === this.priorityFilter.toLowerCase()));
    }

    get history() {
        const rows = this.state?.history ?? [];
        return rows.filter((row, index) => rows.findIndex(test => test.scrambleNumber === row.scrambleNumber) === index);
    }

    get roundsForPrinting(): SavedRound[] { return this.activeRounds.filter(round => this.printSelection.has(round.roundNumber)); }
    matchupCount(teamCount: number): number { return Math.floor(teamCount / 2); }
    matchupFor(index: number): number { return Math.floor(index / 2) + 1; }

    get completed(): number { return this.rounds.filter(round => round.status === 'completed').length; }
    get nextRound(): SavedRound | undefined { return this.activeRounds.find(round => round.status !== 'completed'); }
    get hasUnplayed(): boolean { return this.rounds.some(round => round.status === 'unplayed'); }

    async ngOnInit(): Promise<void> {
        this.destroy.onDestroy(() => { this.clearRedrawAnimations(); this.stopScoreGuidance(); });
        this.destroy.onDestroy(() => this.manageDialog?.close());
        if (!this.readOnly()) {
            try {
                for (const value of (sessionStorage.getItem(this.expandedRoundsKey) ?? '').split(',')) {
                    const round = Number(value);
                    if (Number.isInteger(round) && round > 0) this.expandedRounds.add(round);
                }
            } catch { /* Session storage is optional. */ }
        }
        await this.perform(async () => {
            if (this.readOnly()) {
                const result = await this.request(this.http.get<{name: string; rounds: SavedRound[]}>(this.url + '/rounds'));
                this.publicName = result.name;
                this.rounds = result.rounds;
            } else {
                await this.reload();
                const requestedRound = this.activeRounds.find(round => round.roundNumber === this.initialScoreRound());
                if (requestedRound && this.wizardStep() === 7) {
                    this.updateExpanded(requestedRound.roundNumber, true);
                    this.initializeScores(requestedRound);
                }
            }
        }, true);
        const resume = this.unplayedRounds.find(round => round.roundNumber === this.initialRegenerationRound());
        if (this.initialRegenerationRound() && this.wizardStep() === 7) {
            this.regenerationResumed.emit();
            if (resume) {
                this.openRoundManager(resume);
                this.showRegeneration = true;
            }
        }
    }

    private request<T>(value: import('rxjs').Observable<T>): Promise<T> {
        return firstValueFrom(value.pipe(takeUntilDestroyed(this.destroy)));
    }

    private async reload(): Promise<void> {
        const [state, result] = await Promise.all([
            this.request(this.http.get<SettingsState>(this.url + '/round-settings')),
            this.request(this.http.get<{version: string; settingsSaved: boolean; canVoid?: boolean; rounds: SavedRound[]}>(this.url + '/rounds'))
        ]);
        if (state.version !== result.version) throw new Error('Tournament state changed while loading. Refresh and try again.');
        this.state = state;
        this.savedSettings = structuredClone(state.settings);
        this.teamBySize = state.settings.maximumTeamSize !== null;
        this.rounds = result.rounds;
        this.settingsSaved = result.settingsSaved;
        this.canVoid = !!result.canVoid;
        this.printSelection = new Set(this.activeRounds.filter(round => this.printSelection.has(round.roundNumber)).map(round => round.roundNumber));
        this.completionChanged.emit(this.tournamentComplete);
        this.dirty = false;
    }

    private async perform(action: () => Promise<void>, inlineError = false): Promise<void> {
        if (this.busy) return;
        this.busy = true;
        this.error = '';
        try { await action(); }
        catch (error) {
            if (this.destroy.destroyed) return;
            const message = error.error?.message || error.message || 'The tournament request could not be completed.';
            if (inlineError) this.error = message;
            else this.notifications.error(message);
        }
        finally { this.busy = false; }
    }

    setTeamMode(size: boolean): void {
        this.teamBySize = size;
        Object.assign(this.editSettings, size ?
            { maximumTeamSize: 4, numberOfTeams: null } : { maximumTeamSize: null, numberOfTeams: 4, activeTeamLimit: null });
        this.markEdited();
    }

    markEdited(): void {
        if (!this.additionalSettings) this.dirty = true;
        this.cancelPreview();
    }

    setPriority(id: number, priority: string): void {
        const settings = this.editSettings;
        const set = (ids: number[], active: boolean) => ids.includes(id) ?
            (active ? ids : ids.filter(saved => saved !== id)) : (active ? [...ids, id] : ids);
        settings.topPlayerIds = set(settings.topPlayerIds, priority === 'top');
        settings.lowPlayerIds = set(settings.lowPlayerIds, priority === 'low');
        this.markEdited();
    }

    toggleHistory(number: number, checked: boolean): void {
        const settings = this.editSettings;
        settings.historicalScrambleNumbers = checked ? [...settings.historicalScrambleNumbers, number] :
            settings.historicalScrambleNumbers.filter(saved => saved !== number);
        this.markEdited();
    }

    setBye(playerId: number, checked: boolean): void {
        const settings = this.editSettings;
        settings.manualByes = settings.manualByes.filter(bye => bye.playerId !== playerId || bye.roundNumber !== this.byeRound);
        if (checked) settings.manualByes.push({ roundNumber: this.byeRound, playerId });
        this.markEdited();
    }

    manualBye(id: number): boolean {
        return this.editSettings.manualByes.some(bye => bye.playerId === id && bye.roundNumber === this.byeRound);
    }

    async saveSettings(notify = true): Promise<boolean> {
        if (this.busy || !this.state || this.additionalSettings) return false;
        let success = false;
        await this.perform(async () => {
            const state = this.state!;
            const saved = await this.request(this.http.put<{version: string}>(this.url + '/round-settings',
                { version: state.version, settings: state.settings }));
            state.version = saved.version;
            this.versionChanged.emit(saved.version);
            this.settingsSaved = true;
            this.savedSettings = structuredClone(state.settings);
            this.dirty = false;
            if (notify) this.notifications.success(this.wizardStep() === 4 ? 'Player priorities and byes saved.' : 'Tournament settings saved.');
            success = true;
        });
        return success;
    }

    async openAdditionalRounds(): Promise<void> {
        if (this.dirty || this.additionalSettings || this.remainingRounds < 1) return;
        await this.perform(async () => {
            await this.reload();
            if (!this.rounds.length || this.remainingRounds < 1) return;
            this.closeManagement();
            const seed = this.state.additionalDefaults ?? this.state.settings;
            const rosterIds = new Set(this.state.roster.map(player => player.id));
            const historyIds = new Set(this.history.map(row => row.scrambleNumber));
            this.additionalSettings = { ...structuredClone(seed), numberOfRounds: 1, manualByes: [],
                topPlayerIds: this.state.settings.topPlayerIds.filter(id => rosterIds.has(id)),
                lowPlayerIds: this.state.settings.lowPlayerIds.filter(id => rosterIds.has(id)),
                historicalScrambleNumbers: seed.historicalScrambleNumbers.filter(id => historyIds.has(id)) };
            this.teamBySize = this.additionalSettings.maximumTeamSize !== null;
            this.byeRound = this.lastSavedRound + 1;
            this.priorityView = "priorities";
            this.priorityFilter = "All";
            this.filter = "";
            this.fallback = false;
        });
    }

    additionalCountEdited() {
        if (!this.additionalRoundNumbers.includes(this.byeRound)) this.byeRound = this.lastSavedRound + 1;
        this.markEdited();
    }

    cancelAdditionalRounds() {
        this.additionalSettings = undefined;
        this.cancelPreview();
        this.error = "";
        this.fallback = false;
        this.byeRound = 1;
        this.teamBySize = this.state.settings.maximumTeamSize !== null;
    }

    async propose(single?: number, trigger?: EventTarget | null, fromRound?: number): Promise<void> {
        if (this.busy || this.redrawTransitionPending || this.hasUnsavedScores) return;
        this.clearRedrawAnimations();
        this.redrawState = single === undefined ? 'idle' : 'loading';

        this.redrawTrigger = trigger instanceof EventTarget ? trigger : undefined;
        await this.perform(async () => {
            if (!this.additionalSettings && (!this.settingsSaved || this.dirty)) throw new Error('Save your tournament settings before generating rounds.');
            await this.refreshEligibility();
            const state = this.state!;
            let settings = this.editSettings;
            this.preview = [];
            this.manuallyEditedPreview = false;
            this.regeneratingFuture = fromRound !== undefined;
            this.redrawRound = undefined;
            this.inlinePreviews.clear();
            this.replacingRounds.clear();
            if (this.scoreRound) this.returnFromScoring();
            if (single !== undefined && !this.unplayedRounds.some(round => round.roundNumber === single))
                throw new Error('Only an unplayed round can be redrawn.');
            if (this.additionalSettings && (!this.additionalRoundNumbers.length ||
                !Number.isInteger(settings.gamesPerMatchup) || settings.gamesPerMatchup < 1 || settings.gamesPerMatchup > 9))
                throw new Error("Choose a supported additional round count and 1 to 9 games per matchup.");
            const pending = this.additionalSettings ? this.additionalRoundNumbers : single ? [single] :
                this.rounds.length ? this.unplayedRounds.filter(round => fromRound === undefined || round.roundNumber >= fromRound)
                    .map(round => round.roundNumber) : this.sequence(settings.numberOfRounds);
            if (!this.additionalSettings && this.rounds.length) {
                this.redrawState = 'loading';
                for (const number of pending) this.replacingRounds.add(number);
                if (!pending.some(number => this.expandedRounds.has(number)) && pending.length)
                    this.updateExpanded(pending[0], true);
            }
            const eligibleIds = new Set(this.eligible.map(player => player.id));
            const configured = settings.manualByes.filter(bye => pending.includes(bye.roundNumber));
            const saved = this.keepSavedByes ? this.unplayedRounds.filter(round => pending.includes(round.roundNumber)).flatMap(round =>
                (round.manualByeIds ?? []).map(playerId => ({ roundNumber: round.roundNumber, playerId }))) : [];
            settings = { ...settings, manualByes: [...configured, ...saved].filter((bye, index, all) =>
                eligibleIds.has(bye.playerId) && all.findIndex(other => other.roundNumber === bye.roundNumber && other.playerId === bye.playerId) === index) };
            const preserved = this.activeRounds.filter(round => !pending.includes(round.roundNumber)).map(round => ({
                roundNumber: round.roundNumber, teams: round.teams.map(team => team.players.map(p => p.id)),
                byes: round.byes.map(p => p.id)
            }));
            const prohibited = new Set<string>();
            for (const team of state.history.filter(team => settings.historicalScrambleNumbers.includes(team.scrambleNumber)))
                team.playerIds.forEach((id, index) => team.playerIds.slice(index + 1).forEach(other => prohibited.add(pairKey(id, other))));
            if (trigger && window.requestAnimationFrame) {
                await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
                if (this.destroy.destroyed) return;
            }
            const result = await generateTournament(settings, this.eligible, pending, preserved, [...prohibited], this.fallback);
            if (this.destroy.destroyed) return;
            this.preview = result.rounds;
            this.repeats = result.repeats;
            this.relaxedRounds = result.relaxedRounds;
            this.sharedTopRounds = result.sharedTopRounds;
            this.previewVersion = state.version;
            this.redrawRound = single;
            if (this.replacingRounds.size) {
                await this.revealRedrawnMatchups();
                if (!this.destroy.destroyed && this.replacingRounds.size) this.redrawState = 'ready';
            }
        });
        this.redrawTrigger = undefined;
        if (this.redrawTransitionPending) {
            this.redrawState = 'idle';
            this.replacingRounds.clear();
        }
    }

    private async revealRedrawnMatchups(): Promise<void> {
        this.changeDetector.detectChanges();
        const containers = this.matchupContainers();
        if (!containers.length || !containers[0].animate || this.reducedMotion()) {
            this.updateInlinePreviews();
            return;
        }
        const rosters = () => containers.flatMap(container => [...container.querySelectorAll<HTMLElement>('.opponents')]);
        const original = rosters();
        this.redrawState = 'fading';
        await this.animateMatchups(original,
            [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.98)' }], 320, 'ease-in');
        if (this.destroy.destroyed || !this.replacingRounds.size) return;
        this.redrawState = 'shuffling';
        for (const container of containers) {
            const bounds = container.getBoundingClientRect();
            const visibleStart = Math.max(bounds.top, 0);
            const visibleEnd = Math.min(bounds.bottom, window.innerHeight);
            if (visibleEnd > visibleStart)
                container.style.setProperty('--shuffle-offset', (visibleStart + (visibleEnd - visibleStart) / 2 - bounds.top) + 'px');
        }
        this.changeDetector.detectChanges();
        await this.animateMatchups(containers, [{ opacity: 1 }, { opacity: 1 }], 420, 'linear');
        if (this.destroy.destroyed || !this.replacingRounds.size) return;
        this.redrawState = 'revealing';
        this.coverMatchups(containers, true);
        this.updateInlinePreviews();
        this.changeDetector.detectChanges();
        const reveal = this.animateMatchups(rosters(),
            [{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'scale(1)' }], 440, 'ease-out');
        this.coverMatchups(containers, false);
        this.redrawAnimations.splice(0, original.length + containers.length).forEach(animation => animation.cancel());
        await reveal;
        this.clearRedrawAnimations();
        if (!this.destroy.destroyed)
            this.highlightRound(containers[0].closest('details, .saved-bye-matchups'));
    }

    private matchupContainers(): HTMLElement[] {
        return [...this.host.nativeElement.querySelectorAll<HTMLElement>('.round-matchups')]
            .filter(container => this.replacingRounds.has(Number(container.dataset.round)) &&
                (container.closest('details')?.open ?? true) && container.getClientRects().length > 0);
    }

    private coverMatchups(containers: HTMLElement[], covered: boolean): void {
        for (const container of containers)
            container.querySelector('.matchup-grid')?.classList.toggle('redraw-cover', covered);
    }

    private animateMatchups(elements: HTMLElement[], keyframes: Keyframe[], duration: number, easing: string): Promise<unknown> {
        const animations = elements.map(element => element.animate(keyframes, { duration, easing, fill: 'forwards' }));
        this.redrawAnimations.push(...animations);
        return Promise.allSettled(animations.map(animation => animation.finished));
    }

    private clearRedrawAnimations(): void {
        this.redrawAnimations.splice(0).forEach(animation => animation.cancel());
        for (const grid of this.host.nativeElement.querySelectorAll('.redraw-cover')) grid.classList.remove('redraw-cover');
        for (const container of this.host.nativeElement.querySelectorAll<HTMLElement>('.round-matchups'))
            container.style.removeProperty('--shuffle-offset');
    }

    private reducedMotion(): boolean { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

    private updateInlinePreviews(): void {
        const roster = new Map(this.state.roster.map(player => [player.id, player]));
        for (const proposed of this.preview) {
            const saved = this.rounds.find(round => round.roundNumber === proposed.roundNumber)!;
            this.inlinePreviews.set(proposed.roundNumber, { ...saved,
                teams: proposed.teams.map((ids, index) => ({
                    id: saved.teams[index]?.id ?? -(index + 1), players: ids.map(id => roster.get(id)), scores: []
                })),
                byes: proposed.byes.map(id => roster.get(id))
            });
        }
    }

    async cancelInlinePreview(): Promise<void> {
        const containers = this.matchupContainers();
        if (!containers.length || !containers[0].animate || this.reducedMotion()) { this.cancelPreview(); return; }
        const rosters = () => containers.flatMap(panel => [...panel.querySelectorAll<HTMLElement>('.opponents')]);
        this.redrawState = 'fading';
        await this.animateMatchups(rosters(), [{ opacity: 1 }, { opacity: 0 }], 130, 'ease-in');
        if (this.destroy.destroyed || !this.replacingRounds.size) return;
        this.coverMatchups(containers, true);
        this.preview = [];
        this.inlinePreviews.clear();
        this.changeDetector.detectChanges();
        const revert = this.animateMatchups(rosters(), [{ opacity: 0 }, { opacity: 1 }], 180, 'ease-out');
        this.coverMatchups(containers, false);
        await revert;
        if (!this.destroy.destroyed && this.replacingRounds.size) this.cancelPreview();
    }

    cancelPreview(): void {
        this.clearRedrawAnimations();
        this.redrawState = 'idle';
        this.inlinePreviews.clear();
        this.replacingRounds.clear();
        this.preview = [];
        this.manuallyEditedPreview = false;
        this.regeneratingFuture = false;
        this.redrawRound = undefined;
    }

    async saveRounds(): Promise<void> {
        if (this.redrawTransitionPending) return;
        this.clearRedrawAnimations();
        await this.perform(async () => {
            const count = this.preview.length;
            const redrawRound = this.redrawRound;
            const updating = this.rounds.length > 0;
            const additionalSettings = this.additionalSettings && { ...this.additionalSettings,
                manualByes: this.additionalSettings.manualByes.filter(bye => this.additionalRoundNumbers.includes(bye.roundNumber)) };
            await this.request(this.http.put(this.url + '/rounds',
                { version: this.previewVersion, allowHistoricalFallback: this.fallback, rounds: this.preview, additionalSettings,
                    preserveSavedByes: this.keepSavedByes, manuallyEdited: this.manuallyEditedPreview }));
            this.cancelPreview();
            if (additionalSettings) {
                this.cancelAdditionalRounds();
                this.step = 'rounds';
            }
            await this.reload();
            this.versionChanged.emit(this.state!.version);
            this.notifications.success(additionalSettings ? (count === 1 ? 'One additional round added.' : count + ' additional rounds added.')
                : redrawRound !== undefined ? 'Round ' + redrawRound + ' teams updated successfully.'
                : updating ? 'Upcoming tournament rounds updated.' : 'Tournament rounds generated successfully.');
            if (!updating || additionalSettings) this.roundsSaved.emit();
        });
    }

    openManagement() {
        if (this.hasUnsavedChanges || this.busy) return;
        this.managementOpen = true;
        this.error = "";
    }

    openRoundManager(round: SavedRound): void {
        if (this.busy || this.hasUnsavedChanges || this.manageDialog) return;
        this.managedRound = round;
        this.updateExpanded(round.roundNumber, true);
        this.openRoundDialog();
    }

    private openRoundDialog(): void {
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        this.manageDialog = this.dialogs.open(this.manageTemplate(), {
            width: this.teamEditor ? '960px' : '580px', maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100dvh - 24px)', disableClose: true, restoreFocus: false
        });
        this.manageDialog.keydownEvents().subscribe(event => {
            if (event.key !== 'Escape' || this.busy) return;
            event.preventDefault();
            if (this.teamEditor) this.cancelTeamEditor();
            else void this.closeRoundDialog();
        });
        this.manageDialog.afterClosed().subscribe(() => {
            this.manageDialog = undefined;
            this.managedRound = undefined;
            this.teamEditor = undefined;
            this.removeRequest = undefined;
            this.showRegeneration = false;
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        });
    }

    async closeRoundDialog(): Promise<void> {
        if (!this.manageDialog) return;
        const closed = firstValueFrom(this.manageDialog.afterClosed());
        this.manageDialog.close();
        await closed;
    }

    async redrawManagedRound(): Promise<void> {
        const number = this.managedRound?.roundNumber;
        if (!number) return;
        await this.closeRoundDialog();
        if (!this.destroy.destroyed) await this.propose(number);
    }

    async regenerateManagedRounds(): Promise<void> {
        const number = this.managedRound?.roundNumber;
        if (!number) return;
        await this.closeRoundDialog();
        if (!this.destroy.destroyed) await this.propose(undefined, undefined, number);
    }

    editSavedTeams(round: SavedRound): void {
        this.teamEditor = { teams: round.teams, preview: false, version: this.state.version };
        this.manageDialog?.updateSize('960px');
    }

    editPreviewTeams(): void {
        if (!this.redrawRound || this.redrawTransitionPending || this.manageDialog) return;
        const roster = new Map(this.state.roster.map(player => [player.id, player]));
        this.teamEditor = { teams: this.preview[0].teams.map((players, index) =>
            ({ id: index + 1, players: players.map(id => roster.get(id)) })),
            preview: true };
        this.openRoundDialog();
    }

    cancelTeamEditor(): void {
        if (this.teamEditor?.preview) void this.closeRoundDialog();
        else {
            this.teamEditor = undefined;
            this.manageDialog?.updateSize('580px');
        }
    }

    async saveTeamEdits(teams: EditableMatchupTeam[]): Promise<void> {
        if (this.teamEditor?.preview) {
            this.preview = [{ ...this.preview[0], teams: teams.map(team => team.players.map(player => player.id)) }];
            this.manuallyEditedPreview = true;
            if (this.inlinePreviews.size) this.updateInlinePreviews();
            await this.closeRoundDialog();
            return;
        }
        const round = this.managedRound;
        if (!round) return;
        const version = this.teamEditor?.version;
        await this.perform(async () => {
            await this.request(this.http.put(this.url + '/rounds/' + round.roundNumber + '/teams', { version,
                teams: teams.map(team => ({ teamId: team.id, playerIds: team.players.map(player => player.id) })) }));
            await this.reload();
            this.versionChanged.emit(this.state.version);
            await this.closeRoundDialog();
            this.notifications.success('Round ' + round.roundNumber + ' teams updated successfully.');
        });
    }

    closeManagement() {
        if (!this.managementOpen) return;
        this.managementOpen = false;
        this.cancelPreview();
        this.removeRequest = undefined;
        this.removalSelection.clear();
    }

    async openRegeneration(): Promise<void> {
        await this.perform(async () => {
            await this.refreshEligibility();
            this.showRegeneration = true;
        });
    }

    async goToConfirmParticipants(): Promise<void> {
        const round = this.managedRound?.roundNumber;
        if (round === undefined) return;
        await this.closeRoundDialog();
        this.attendanceRequested.emit(round);
    }

    private async refreshEligibility(): Promise<void> {
        const fresh = await this.request(this.http.get<SettingsState>(this.url + '/round-settings'));
        if (fresh.version !== this.state?.version) await this.reload();
        else this.state = fresh;
    }

    async removeSelectedRounds() {
        if (!this.removeRequest) return;
        await this.perform(async () => {
            const { numbers, voidScored } = this.removeRequest;
            await this.request(this.http.post(this.url + "/rounds/remove", { version: this.state.version, roundNumbers: numbers, voidScored }));
            this.removeRequest = undefined;
            this.removalSelection.clear();
            await this.reload();
            for (const number of numbers) this.updateExpanded(number, false);
            this.versionChanged.emit(this.state.version);
            await this.closeRoundDialog();
            if (!this.rounds.length) { this.closeManagement(); this.roundsCleared.emit(); }
            this.step = 'rounds';
            this.notifications.success(voidScored ? 'Round ' + numbers[0] + ' voided. Scores retained for review.'
                : numbers.length === 1 ? 'Round ' + numbers[0] + ' deleted.' : numbers.length + ' rounds deleted.');
        });
    }

    roundAction(round: SavedRound): string {
        return round.status === 'completed' ? 'Edit Scores' : round.status === 'partial' ? 'Continue Scoring' : 'Enter Scores';
    }

    async closeScores() {
        if (this.busy || !await this.confirmDiscardScores()) return;
        this.returnFromScoring();
    }

    private returnFromScoring() {
        const number = this.scoreRound?.roundNumber;
        this.stopScoreGuidance();
        this.scoreEdits = [];
        this.scoreRound = undefined;
        this.step = 'rounds';
        if (number !== undefined) {
            this.updateExpanded(number, true);
            afterNextRender(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#run-round-' + number)?.focus({ preventScroll: true }),
                { injector: this.injector });
        }
    }

    async openScores(round: SavedRound, guide = false): Promise<void> {
        if (this.busy || this.preview.length || this.redrawTransitionPending) return;
        if (this.scoreRound?.roundNumber !== round.roundNumber && !await this.confirmDiscardScores()) return;
        this.stopScoreGuidance();
        if (this.managementOpen) this.closeManagement();
        if (this.wizardStep() !== 7) this.runRequested.emit();
        const guidance = guide ? this.prepareScoreGuidance() : undefined;
        this.updateExpanded(round.roundNumber, true);
        if (this.scoreRound?.roundNumber !== round.roundNumber) this.initializeScores(round);
        afterNextRender(() => {
            if (guidance && this.scoreGuidance === guidance)
                this.scrollFrame = requestAnimationFrame(() => this.guideToScoreField(round.roundNumber, guidance));
            else if (!guide) this.host.nativeElement.querySelector<HTMLElement>('#round-score-' + round.roundNumber)?.focus({ preventScroll: true });
        }, { injector: this.injector });
    }

    continueScoring(round: SavedRound): void { void this.openScores(round, true); }

    private prepareScoreGuidance(): NonNullable<TournamentRoundsComponent['scoreGuidance']> | undefined {
        const scroller = document.scrollingElement as HTMLElement | null;
        if (!scroller) return;
        const start = scroller.scrollTop;
        const anchor = scroller.style.getPropertyValue('overflow-anchor');
        const priority = scroller.style.getPropertyPriority('overflow-anchor');
        // Expanding a card above the footer changes the document height. Keep the
        // browser from moving the viewport to follow its old scroll anchor.
        scroller.style.setProperty('overflow-anchor', 'none');
        const interruption = new AbortController();
        const cancel = () => this.stopScoreGuidance();
        for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'resize'])
            window.addEventListener(type, cancel, { signal: interruption.signal, passive: true, capture: true });
        const guidance = { scroller, start, release: () => {
            interruption.abort();
            if (anchor) scroller.style.setProperty('overflow-anchor', anchor, priority);
            else scroller.style.removeProperty('overflow-anchor');
        } };
        this.scoreGuidance = guidance;
        return guidance;
    }

    private guideToScoreField(number: number, guidance: NonNullable<TournamentRoundsComponent['scoreGuidance']>): void {
        const panel = this.host.nativeElement.querySelector<HTMLElement>('#matchups-' + number);
        const card = panel?.closest('details');
        const fields = [...(panel?.querySelectorAll<HTMLInputElement>('.score-inputs input') ?? [])];
        const field = fields.find(input => input.value === '') ?? fields[0];
        if (!field || !card?.open) { this.stopScoreGuidance(); return; }

        const { scroller, start } = guidance;
        const scrollTo = (top: number) => scroller.scrollTo({ top, behavior: 'instant' });
        const navbar = document.querySelector<HTMLElement>('.league-navigation');
        const visibleTop = (navbar?.getBoundingClientRect().height ?? 0) + 18;
        const visibleBottom = scroller.clientHeight - 20;
        const bounds = field.getBoundingClientRect();
        const headerTop = card.querySelector('summary')?.getBoundingClientRect().top ?? panel.getBoundingClientRect().top;
        const relativeTop = bounds.bottom - headerTop <= visibleBottom - visibleTop
            ? headerTop : bounds.top - 20;
        const target = Math.max(0, Math.min(scroller.scrollTop + relativeTop - visibleTop,
            scroller.scrollHeight - scroller.clientHeight));
        const finish = () => {
            if (this.scoreGuidance !== guidance) return;
            this.stopScoreGuidance();
            field.focus({ preventScroll: true });
            this.highlightRound(card);
        };
        if (Math.abs(target - start) <= 4) { finish(); return; }
        if (this.reducedMotion()) {
            scrollTo(target);
            finish();
            return;
        }

        const duration = 1200;
        const started = performance.now();
        const scroll = (now: number) => {
            if (this.scoreGuidance !== guidance || !field.isConnected || !card.open) {
                this.stopScoreGuidance();
                return;
            }
            const progress = Math.max(0, Math.min(1, (now - started) / duration));
            const eased = progress * progress * (3 - 2 * progress);
            scrollTo(start + (target - start) * eased);
            if (progress < 1) this.scrollFrame = requestAnimationFrame(scroll);
            else finish();
        };
        this.scrollFrame = requestAnimationFrame(scroll);
    }

    private highlightRound(card: HTMLElement | null): void {
        if (!card?.animate || this.reducedMotion()) return;
        this.roundHighlight?.cancel();
        const accent = getComputedStyle(card).getPropertyValue('--hub-focus').trim() || '#3975ad';
        this.roundHighlight = card.animate(
            [{ outline: '2px solid ' + accent, outlineOffset: '2px' }, { outline: '2px solid transparent', outlineOffset: '2px' }],
            { duration: 1000, easing: 'ease-out' });
    }

    private stopScoreGuidance(): void {
        if (this.scrollFrame !== undefined) cancelAnimationFrame(this.scrollFrame);
        this.scrollFrame = undefined;
        this.scoreGuidance?.release();
        this.scoreGuidance = undefined;
        this.roundHighlight?.cancel();
        this.roundHighlight = undefined;
    }

    private async confirmDiscardScores(): Promise<boolean> {
        return !this.hasUnsavedScores || await this.confirm({
            title: 'Unsaved scores', message: 'Discard unsaved score changes?', action: 'Discard', tone: 'danger'
        });
    }

    scoresForMatchup(matchup: number): ScoreEdit[] { return this.scoreEdits.filter(score => score.matchup === matchup); }

    private initializeScores(round: SavedRound): void {
        this.scoreValidation = '';
        this.step = 'scores';
        try { sessionStorage.setItem(this.activeRoundKey, String(round.roundNumber)); } catch {}
        this.scoreRound = round;
        this.scoreVersion = this.state.version;
        this.scoreEdits = [];
        for (let index = 0; index < round.teams.length; index += 2) {
            const [first, second] = round.teams.slice(index, index + 2);
            if (!second) continue;
            for (const game of this.sequence(round.gamesPerMatchup)) {
                this.scoreEdits.push({
                    teamId: first.id, opponentId: second.id, game, matchup: index / 2 + 1,
                    points: first.scores.find(score => score.game === game)?.points ?? null,
                    opponentPoints: second.scores.find(score => score.game === game)?.points ?? null
                });
            }
        }
    }

    async saveScores(): Promise<void> {
        const started = this.scoreEdits.filter(score => score.points !== null || score.opponentPoints !== null);
        this.scoreValidation = '';
        if (!started.length || started.some(score => !Number.isInteger(score.points) || !Number.isInteger(score.opponentPoints) ||
            score.points! < 0 || score.opponentPoints! < 0)) {
            this.scoreValidation = 'Enter a nonnegative whole-number score for both teams in each game you started.';
            return;
        }
        await this.perform(async () => {
            const number = this.scoreRound!.roundNumber;
            const wasCompleted = this.scoreRound!.status === 'completed';
            await this.request(this.http.put(this.url + '/rounds/' + number + '/scores',
                { version: this.scoreVersion, scores: started }));
            await this.reload();
            this.versionChanged.emit(this.state!.version);
            this.returnFromScoring();
            this.notifications.success('Round ' + number + (wasCompleted ? ' score corrections saved.' : ' scores saved.'));
        });
    }

    print(rounds: SavedRound[]): void {
        if (!rounds.length) return;
        this.printRounds = rounds;
        const popup = window.open('', '_blank', 'width=800,height=600');
        if (!popup) { this.notifications.error('Allow popups to preview and print the round assignments.'); return; }
        setTimeout(() => {
            const printContent = this.host.nativeElement.querySelector('.tournament-print');
            if (!printContent || popup.closed) return;
            renderMatchupPrint(popup, 'Print Tournament Matchups', printContent.innerHTML,
                'body>article+article{break-before:page}' +
                '@media print{body{padding:0;margin:0}' +
                '.six-matchup-sheet .printed-matchup{break-inside:avoid;margin-bottom:0!important}' +
                '.six-matchup-sheet h2,.six-matchup-sheet h3{margin:0 0 4px}' +
                '.six-matchup-sheet .print-team table td{padding:2px 4px!important;line-height:1.2}' +
                '.six-matchup-sheet .print-team table th{padding:2px 4px!important}' +
                '.six-matchup-sheet .printed-matchup table th,.six-matchup-sheet .printed-matchup table td{padding-block:2px!important}' +
                '.six-matchup-sheet h5{margin:3px 0}}');
            popup.focus();
            popup.print();
        }, 0);
    }

    sequence(count: number): number[] {
        return Array.from({ length: Math.min(128, Math.max(0, Number.isInteger(count) ? count : 0)) }, (_, index) => index + 1);
    }
    playerName(player: Player): string { return player.firstName + ' ' + player.lastName; }
    previewName(id: number): string {
        const player = this.state!.roster.find(item => item.id === id);
        return player ? this.playerName(player) : 'Player ' + id;
    }
    byeCount(id: number): number { return this.rounds.filter(round => round.byes.some(bye => bye.id === id)).length; }
}

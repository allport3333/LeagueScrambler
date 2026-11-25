import { MatchupPrintSheetComponent, MatchupPrintSixComponent } from './matchup-print-sheet.component';
import { renderMatchupPrint } from './matchup-print';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, Injector, input, NgZone, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { generateTournament, TournamentAllocation, TournamentSettings } from './tournament-generation';
import { pairKey, ScramblePlayer } from './scrambler/scramble-engine';
import { TournamentNotifications } from './tournament-notifications.service';
import { moveToRedrawPreview } from './tournament-redraw-transition';
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
    imports: [FormsModule, NgTemplateOutlet, MatchupPrintSheetComponent, MatchupPrintSixComponent],
    templateUrl: './tournament-rounds.component.html',
    styleUrl: './tournament-rounds.component.css'
})
export class TournamentRoundsComponent implements OnInit {
    readonly leagueId = input.required<number>();
    readonly tournamentName = input('');
    readonly readOnly = input(false);
    readonly wizardStep = input(0);
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
    private readonly confirm = injectConfirmation();
    private readonly host = inject(ElementRef<HTMLElement>);
    private readonly injector = inject(Injector);
    private readonly zone = inject(NgZone);
    private readonly changeDetector = inject(ChangeDetectorRef);
    private readonly destroy = inject(DestroyRef);
    state?: SettingsState;
    rounds: SavedRound[] = [];
    managementOpen = false;
    availabilityDraft?: number[];
    availabilityFilter = "";
    get selectedRemovalNumbers() { return [...this.removalSelection].sort((a, b) => a - b); }
    get currentlyEligibleCount() { return this.baseEligible.filter(player => !this.savedUnavailable.includes(player.id)).length; }
    get unplayedRoundLabels() { return this.unplayedRounds.map(round => round.roundNumber).join(", "); }
    get availabilityPlayers() {
        const search = this.availabilityFilter.trim().toLowerCase();
        return this.state.roster.filter(player => this.playerName(player).toLowerCase().includes(search));
    }
    playingCount(round: SavedRound) { return round.teams.reduce((count, team) => count + team.players.length, 0); }
    removalSelection = new Set<number>();
    removeRequest?: { numbers: number[]; voidScored: boolean };
    canVoid = false;
    get activeRounds() { return this.rounds.filter(round => round.status !== "voided"); }
    get unplayedRounds() { return this.rounds.filter(round => round.status === "unplayed"); }
    get savedUnavailable() { return this.state?.settings.unavailablePlayerIds ?? []; }
    get baseEligible() {
        if (!this.state?.mode) return [];
        return this.state.mode === 3 ? this.state.roster : this.state.roster.filter(player => this.state.presentIds.includes(player.id));
    }
    preview: TournamentAllocation[] = [];
    redrawRound?: number;
    redrawTrigger?: EventTarget | null;
    private stopRedrawTransition?: () => void;
    redrawState: 'idle' | 'loading' | 'animating' | 'revealing' | 'ready' = 'idle';
    get redrawTransitionPending(): boolean {
        return this.redrawState === 'loading' || this.redrawState === 'animating' || this.redrawState === 'revealing';
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
        return !!this.additionalSettings || !!this.availabilityDraft || this.dirty || this.preview.length > 0 || this.hasUnsavedScores;
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
    scoreEdits: ScoreEdit[] = [];
    scoreValidation = '';
    private get activeRoundKey() { return 'league-hub-tournament-score-round-' + this.leagueId(); }
    get tournamentComplete() {
        return this.activeRounds.length > 0 && this.completed === this.activeRounds.length;
    }

    printSelection = new Set<number>();
    printRounds: SavedRound[] = [];

    private get url(): string { return '/api/tournaments/' + this.leagueId(); }

    get eligible(): (Player & ScramblePlayer)[] {
        const unavailable = new Set(this.availabilityDraft ?? this.savedUnavailable);
        return this.baseEligible.filter(player => !unavailable.has(player.id));
    }

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
        this.destroy.onDestroy(() => this.stopRedrawTransition?.());
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
                if (requestedRound && this.wizardStep() === 7) await this.openScores(requestedRound);
            }
        }, true);
        if (!this.readOnly() && !this.error && this.wizardStep() === 7 && this.initialRunView() === 'management' && this.rounds.length)
            this.openManagement();
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
                topPlayerIds: seed.topPlayerIds.filter(id => rosterIds.has(id)),
                lowPlayerIds: seed.lowPlayerIds.filter(id => rosterIds.has(id)),
                historicalScrambleNumbers: seed.historicalScrambleNumbers.filter(id => historyIds.has(id)) };
            this.availabilityFilter = "";
            this.availabilityDraft = this.savedUnavailable.filter(id => rosterIds.has(id));
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
        this.cancelAvailability();
        this.error = "";
        this.fallback = false;
        this.byeRound = 1;
        this.teamBySize = this.state.settings.maximumTeamSize !== null;
    }

    async propose(single?: number, trigger?: EventTarget | null): Promise<void> {
        if (this.busy || this.redrawTransitionPending) return;
        this.stopRedrawTransition?.();
        this.redrawState = single === undefined ? 'idle' : 'loading';
        this.redrawTrigger = trigger;
        await this.perform(async () => {
            const state = this.state!;
            let settings = this.editSettings;
            this.preview = [];
            this.redrawRound = undefined;
            if (single !== undefined && !this.unplayedRounds.some(round => round.roundNumber === single))
                throw new Error('Only an unplayed round can be redrawn.');
            if (!this.additionalSettings && (!this.settingsSaved || this.dirty)) throw new Error('Save your tournament settings before generating rounds.');
            if (this.additionalSettings && (!this.additionalRoundNumbers.length ||
                !Number.isInteger(settings.gamesPerMatchup) || settings.gamesPerMatchup < 1 || settings.gamesPerMatchup > 9))
                throw new Error("Choose a supported additional round count and 1 to 9 games per matchup.");
            const pending = this.additionalSettings ? this.additionalRoundNumbers : single ? [single] :
                this.rounds.length ? this.unplayedRounds.map(round => round.roundNumber) : this.sequence(settings.numberOfRounds);
            if (this.managementOpen || this.availabilityDraft) {
                const eligibleIds = new Set(this.eligible.map(player => player.id));
                const configured = settings.manualByes.filter(bye => pending.includes(bye.roundNumber));
                const saved = this.unplayedRounds.filter(round => pending.includes(round.roundNumber)).flatMap(round =>
                    (round.manualByeIds ?? []).map(playerId => ({ roundNumber: round.roundNumber, playerId })));
                settings = { ...settings, manualByes: [...configured, ...saved].filter((bye, index, all) =>
                    eligibleIds.has(bye.playerId) && all.findIndex(other => other.roundNumber === bye.roundNumber && other.playerId === bye.playerId) === index) };
            }
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
            const source = trigger instanceof HTMLElement && trigger.isConnected ? trigger.getBoundingClientRect() : undefined;
            if (single !== undefined && result.rounds.length) this.redrawState = 'animating';
            this.preview = result.rounds;
            this.repeats = result.repeats;
            this.relaxedRounds = result.relaxedRounds;
            this.previewVersion = state.version;
            this.redrawRound = single;
            if (single !== undefined && this.preview.length) {
                afterNextRender(() => {
                    const host = this.host.nativeElement as HTMLElement;
                    const preview = host.querySelector<HTMLElement>('.preview');
                    const heading = preview?.querySelector<HTMLElement>('.redraw-heading');
                    const card = preview?.querySelector<HTMLElement>('.redraw-flight');
                    if (preview && heading && card) {
                        this.stopRedrawTransition = this.zone.runOutsideAngular(() =>
                            moveToRedrawPreview(preview, heading, card, source, animate => this.zone.run(() => {
                                if (this.destroy.destroyed || !this.preview.length) return;
                                if (animate) {
                                    this.redrawState = 'revealing';
                                    this.changeDetector.markForCheck();
                                }
                                else this.finishRedrawReveal();
                            })));
                    } else this.redrawState = 'idle';
                }, { injector: this.injector });
            }
        });
        this.redrawTrigger = undefined;
        if (this.redrawState === 'loading') this.redrawState = 'idle';
    }

    finishRedrawReveal(): void {
        if (this.redrawState !== 'animating' && this.redrawState !== 'revealing') return;
        this.redrawState = 'ready';
        this.changeDetector.markForCheck();
        afterNextRender(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.redraw-heading')
            ?.focus({ preventScroll: true }), { injector: this.injector });
    }

    cancelPreview(): void {
        this.stopRedrawTransition?.();
        this.redrawState = 'idle';
        this.preview = [];
    }

    async saveRounds(): Promise<void> {
        if (this.redrawTransitionPending) return;
        this.stopRedrawTransition?.();
        await this.perform(async () => {
            const count = this.preview.length;
            const redrawRound = this.redrawRound;
            const updating = this.rounds.length > 0;
            const additionalSettings = this.additionalSettings && { ...this.additionalSettings,
                manualByes: this.additionalSettings.manualByes.filter(bye => this.additionalRoundNumbers.includes(bye.roundNumber)) };
            await this.request(this.http.put(this.url + '/rounds',
                { version: this.previewVersion, allowHistoricalFallback: this.fallback, rounds: this.preview, additionalSettings,
                    unavailablePlayerIds: this.availabilityDraft, preserveSavedByes: this.managementOpen }));
            this.availabilityDraft = undefined;
            this.cancelPreview();
            if (additionalSettings) {
                this.cancelAdditionalRounds();
                this.step = 'rounds';
            }
            await this.reload();
            this.versionChanged.emit(this.state!.version);
            this.notifications.success(additionalSettings ? (count === 1 ? 'One additional round added.' : count + ' additional rounds added.')
                : redrawRound !== undefined ? 'Round ' + redrawRound + ' teams updated.'
                : updating ? 'Upcoming tournament rounds updated.' : 'Tournament rounds generated successfully.');
            if (this.managementOpen) { this.closeManagement(); this.step = "rounds"; }
            this.roundsSaved.emit();
        });
    }

    openManagement() {
        if (this.hasUnsavedChanges || this.busy) return;
        this.managementOpen = true;
        this.error = "";
    }

    closeManagement() {
        if (!this.managementOpen) return;
        this.managementOpen = false;
        this.cancelAvailability();
        this.removeRequest = undefined;
        this.removalSelection.clear();
    }

    async beginAvailability() {
        await this.perform(async () => {
            await this.reload();
            const roster = new Set(this.state.roster.map(player => player.id));
            this.availabilityFilter = "";
            this.availabilityDraft = this.savedUnavailable.filter(id => roster.has(id));
            this.cancelPreview();
        });
    }

    updateAvailability(id: number, unavailable: boolean) {
        this.availabilityDraft = unavailable ? [...this.availabilityDraft, id] : this.availabilityDraft.filter(player => player !== id);
        this.cancelPreview();
    }

    cancelAvailability() {
        this.availabilityDraft = undefined;
        this.cancelPreview();
        this.error = "";
    }

    async saveAvailabilityOnly() {
        await this.perform(async () => {
            await this.request(this.http.put(this.url + "/rounds", { version: this.state.version, rounds: [],
                unavailablePlayerIds: this.availabilityDraft }));
            this.cancelAvailability();
            await this.reload();
            this.versionChanged.emit(this.state.version);
            this.notifications.success('Availability saved for future rounds.');
        });
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
        this.scoreEdits = [];
        this.scoreRound = undefined;
        this.step = 'rounds';
        if (number !== undefined) {
            this.updateExpanded(number, true);
            afterNextRender(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#run-round-' + number)?.focus(),
                { injector: this.injector });
        }
    }

    async openScores(round: SavedRound): Promise<void> {
        if (!await this.confirmDiscardScores()) return;
        if (this.managementOpen) this.closeManagement();
        if (this.wizardStep() !== 7) this.runRequested.emit();
        this.updateExpanded(round.roundNumber, true);
        this.initializeScores(round);
        afterNextRender(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.score-heading')?.focus(),
            { injector: this.injector });
    }

    private async confirmDiscardScores(): Promise<boolean> {
        return !this.hasUnsavedScores || await this.confirm({
            title: 'Unsaved scores', message: 'Discard unsaved score changes?', action: 'Discard', tone: 'danger'
        });
    }

    private initializeScores(round: SavedRound): void {
        this.scoreValidation = '';
        this.step = 'scores';
        try { sessionStorage.setItem(this.activeRoundKey, String(round.roundNumber)); } catch {}
        this.scoreRound = round;
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
                { version: this.state!.version, scores: started }));
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

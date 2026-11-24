import { LeagueStandingsComponent } from './league-standings/league-standings.component';
import { MatchupPrintSheetComponent, MatchupPrintSixComponent } from './matchup-print-sheet.component';
import { renderMatchupPrint } from './matchup-print';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { generateTournament, TournamentAllocation, TournamentSettings } from './tournament-generation';
import { pairKey, ScramblePlayer } from './scrambler/scramble-engine';

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
    imports: [FormsModule, NgTemplateOutlet, MatchupPrintSheetComponent, MatchupPrintSixComponent, LeagueStandingsComponent],
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
    private readonly host = inject(ElementRef<HTMLElement>);
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
    notice = '';
    private savedSettings?: TournamentSettings;
    noticeView = '';
    error = '';
    busy = false;
    dirty = false;
    settingsSaved = false;
    fallback = false;
    previewVersion = '';
    repeats = 0;
    relaxedRounds: number[] = [];
    step = 'rounds';
    get view(): string {
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

    async previewByeReplacement() {
        const round = this.selectedByeRound;
        if (round?.status !== 'unplayed' || this.busy) return;
        if (this.dirty && !(await this.saveSettings())) return;
        await this.propose(round.roundNumber);
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
        this.preview = [];
    }

    roundStatus(round: SavedRound) {
        return round.status === 'voided' ? 'Voided' : round.status === 'completed' ? 'Completed' : round.status === 'partial' ? 'Partially Scored' : 'Not Started';
    }
    byeRound = 1;
    scoreRound?: SavedRound;
    scoreEdits: ScoreEdit[] = [];
    scoreFeedback?: { title: string; message: string };
    private progression?: ReturnType<typeof setTimeout>;
    private get activeRoundKey() { return 'league-hub-tournament-score-round-' + this.leagueId(); }
    get tournamentComplete() {
        return this.activeRounds.length > 0 && this.completed === this.activeRounds.length;
    }

    constructor() { this.destroy.onDestroy(() => this.clearScoreFeedback()); }

    clearScoreFeedback() {
        clearTimeout(this.progression);
        this.progression = undefined;
        this.scoreFeedback = undefined;
    }

    openRememberedScores() {
        let number: number;
        try { number = Number(sessionStorage.getItem(this.activeRoundKey)); } catch {}
        const round = this.activeRounds.find(item => item.roundNumber === number) ?? this.nextRound ?? this.activeRounds[0];
        if (round) this.openScores(round);
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
        await this.perform(async () => {
            if (this.readOnly()) {
                const result = await this.request(this.http.get<{name: string; rounds: SavedRound[]}>(this.url + '/rounds'));
                this.publicName = result.name;
                this.rounds = result.rounds;
            } else {
                await this.reload();
                if (this.rounds.length) this.step = this.initialRunView() === 'rounds' ? 'rounds' :
                    this.tournamentComplete ? 'complete' : 'rounds';
                const requestedRound = this.activeRounds.find(round => round.roundNumber === this.initialScoreRound());
                if (requestedRound && this.wizardStep() === 7) this.openScores(requestedRound);
            }
        });
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

    private async perform(action: () => Promise<void>): Promise<void> {
        if (this.busy) return;
        this.busy = true;
        this.error = this.notice = '';
        try { await action(); }
        catch (error) { this.error = error.error?.message || error.message || 'The tournament request could not be completed.'; }
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
        this.preview = [];
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

    async saveSettings(): Promise<boolean> {
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
            this.notice = 'Tournament settings saved.';
            this.noticeView = this.view;
            success = true;
        });
        return success;
    }

    async openAdditionalRounds(): Promise<void> {
        if (this.dirty || this.additionalSettings || this.remainingRounds < 1) return;
        await this.perform(async () => {
            await this.reload();
            if (!this.rounds.length || this.remainingRounds < 1) return;
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

    async propose(single?: number): Promise<void> {
        await this.perform(async () => {
            const state = this.state!;
            let settings = this.editSettings;
            this.preview = [];
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
            const result = await generateTournament(settings, this.eligible, pending, preserved, [...prohibited], this.fallback);
            this.preview = result.rounds;
            this.repeats = result.repeats;
            this.relaxedRounds = result.relaxedRounds;
            this.previewVersion = state.version;
        });
    }

    async saveRounds(): Promise<void> {
        await this.perform(async () => {
            const additionalSettings = this.additionalSettings && { ...this.additionalSettings,
                manualByes: this.additionalSettings.manualByes.filter(bye => this.additionalRoundNumbers.includes(bye.roundNumber)) };
            await this.request(this.http.put(this.url + '/rounds',
                { version: this.previewVersion, allowHistoricalFallback: this.fallback, rounds: this.preview, additionalSettings,
                    unavailablePlayerIds: this.availabilityDraft, preserveSavedByes: this.managementOpen }));
            this.availabilityDraft = undefined;
            this.preview = [];
            if (additionalSettings) {
                this.cancelAdditionalRounds();
                this.step = 'rounds';
            }
            await this.reload();
            this.versionChanged.emit(this.state!.version);
            this.notice = additionalSettings ? 'Additional rounds saved.' : 'Tournament rounds saved.';
            this.noticeView = 'rounds';
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
            this.preview = [];
        });
    }

    updateAvailability(id: number, unavailable: boolean) {
        this.availabilityDraft = unavailable ? [...this.availabilityDraft, id] : this.availabilityDraft.filter(player => player !== id);
        this.preview = [];
    }

    cancelAvailability() {
        this.availabilityDraft = undefined;
        this.preview = [];
        this.error = "";
    }

    async saveAvailabilityOnly() {
        await this.perform(async () => {
            await this.request(this.http.put(this.url + "/rounds", { version: this.state.version, rounds: [],
                unavailablePlayerIds: this.availabilityDraft }));
            this.cancelAvailability();
            await this.reload();
            this.versionChanged.emit(this.state.version);
            this.notice = "Availability saved for future generation.";
            this.noticeView = this.view;
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
            this.versionChanged.emit(this.state.version);
            if (!this.rounds.length) { this.closeManagement(); this.roundsCleared.emit(); }
            this.step = this.tournamentComplete ? "complete" : "rounds";
            this.notice = voidScored ? "Round voided. Its scores are retained for review." : "Selected rounds deleted.";
            this.noticeView = this.view;
        });
    }

    roundAction(round: SavedRound): string {
        return round.status === 'completed' ? 'Edit Scores' : round.status === 'partial' ? 'Continue Scoring' : 'Enter Scores';
    }

    changeRunView(view: 'rounds' | 'complete') {
        if (this.busy || (this.hasUnsavedScores && !window.confirm('Discard unsaved score changes?'))) return;
        if (this.hasUnsavedScores && this.scoreRound) this.initializeScores(this.scoreRound);
        this.clearScoreFeedback();
        this.step = view;
    }

    openScores(round: SavedRound): void {
        if (this.hasUnsavedScores && !window.confirm('Discard unsaved score changes?')) return;
        if (this.wizardStep() !== 7) this.runRequested.emit();
        this.initializeScores(round);
    }

    private initializeScores(round: SavedRound): void {
        this.clearScoreFeedback();
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
        await this.perform(async () => {
            const started = this.scoreEdits.filter(score => score.points !== null || score.opponentPoints !== null);
            if (!started.length || started.some(score => !Number.isInteger(score.points) || !Number.isInteger(score.opponentPoints) ||
                score.points! < 0 || score.opponentPoints! < 0))
                throw new Error('Enter a nonnegative whole-number score for both teams in each game you started.');
            const number = this.scoreRound!.roundNumber;
            const wasCompleted = this.scoreRound!.status === 'completed';
            await this.request(this.http.put(this.url + '/rounds/' + number + '/scores',
                { version: this.state!.version, scores: started }));
            await this.reload();
            this.versionChanged.emit(this.state!.version);
            const saved = this.rounds.find(round => round.roundNumber === number)!;
            this.initializeScores(saved);
            if (wasCompleted) {
                this.scoreFeedback = { title: 'Score corrections saved.', message: 'Standings now reflect the corrected result.' };
                return;
            }
            if (saved.status !== 'completed') {
                this.scoreFeedback = { title: 'Round scores saved.', message: 'You can enter the remaining scores when they are ready.' };
                return;
            }
            const next = this.nextRound;
            this.scoreFeedback = this.tournamentComplete
                ? { title: 'Tournament Complete!', message: 'All rounds are scored. Opening the final standings.' }
                : { title: 'Round ' + number + ' Complete!', message: next
                    ? 'All scores saved. Continuing to Round ' + next.roundNumber + ' of ' + this.state!.settings.numberOfRounds + '.'
                    : 'All saved rounds are scored. Open tournament setup to generate the remaining rounds.' };
            if (this.tournamentComplete || next) {
                this.progression = setTimeout(() => {
                    if (this.view !== 'scores' || this.scoreRound?.roundNumber !== number) return;
                    if (next) this.openScores(next);
                    else { this.clearScoreFeedback(); this.step = 'complete'; }
                }, 2200);
            }
        });
    }

    print(rounds: SavedRound[]): void {
        if (!rounds.length) return;
        this.printRounds = rounds;
        const popup = window.open('', '_blank', 'width=800,height=600');
        if (!popup) { this.error = 'Allow popups to preview and print the round assignments.'; return; }
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

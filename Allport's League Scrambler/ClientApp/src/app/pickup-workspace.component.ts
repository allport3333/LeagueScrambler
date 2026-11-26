import { ChangeDetectionStrategy, Component, inject, Input, Output, EventEmitter, OnChanges, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { generateScramble, pairKey, PairFrequency } from './scrambler/scramble-engine';
import { buildScrambleDraft } from './scrambler/scramble-draft';
import { ScrambleDraftComponent, scrambleDraftDialogOptions } from './scrambler/scramble-draft.component';
import { renderLargeMatchupPrint } from './matchup-large-print';
import { ExistingPlayerBrowserComponent, PickupPlayerBrowser, PickupBrowserPlayer } from './league-management/existing-player-browser.component';
import { injectConfirmation } from './confirmation-dialog';
import { TournamentNotifications } from './tournament-notifications.service';

interface Participant { id: string; playerId: number | null; name: string; gender: string | null; }
interface Registration extends Participant { state: number; playing: boolean | null; }
interface Options { configurationMode?: 'size' | 'count'; teamCount: number | null; maxTeamSize: number | null; balanced: boolean; history: string; top: string[]; low: string[]; allowMinimumRepeats: boolean; }
interface Board { teams: Participant[][]; byes: Participant[]; gamesPerMatchup: number; options: Options; }
interface Score { matchup: number; game: number; first: number; second: number; }
interface GameSet { id: string; number: number; version: number; board: Board; scores: Score[]; }
interface Workspace {
    players: Registration[] | null; checkedInOnly: boolean; playing: number; gamesPlayed: number; gameSets: number;
    myRegistrationId: string | null; sets: GameSet[] | null;
}
interface SessionSummary { id: string; name: string; state: number; owner: boolean; confirmed: number; visibility: number; organizerNotes?: string; canReopen: boolean; canDelete: boolean; venue: {timeZone: string}; startsUtc: string; endsUtc: string; deadlineUtc?: string; }

@Component({
    selector: 'app-pickup-workspace',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, NgClass],
    templateUrl: './pickup-workspace.component.html',
    styleUrls: ['./pickup.component.css', './pickup-workspace.component.css']
})
export class PickupWorkspaceComponent implements OnChanges, OnDestroy {
    @Input({required: true}) session!: SessionSummary;
    @Input({required: true}) statuses: string[] = [];
    @Output() deleted = new EventEmitter<string>();
    @Output() sessionUpdated = new EventEmitter<void>();
    @Output() editSettings = new EventEmitter<void>();
    @Output() viewDetails = new EventEmitter<void>();
    @Input() shareUrl = '';
    @Output() invite = new EventEmitter<void>();

    private readonly route = inject(ActivatedRoute);
    private readonly http = inject(HttpClient);
    private readonly dialogs = inject(MatDialog);
    private readonly ask = injectConfirmation();
    private playerBrowser?: MatDialogRef<ExistingPlayerBrowserComponent>;
    private readonly notifications = inject(TournamentNotifications);
    private dialog?: MatDialogRef<ScrambleDraftComponent>;
    private currentId?: string;
    private request = 0;
    data?: Workspace;
    tab = 'Players';
    busy = false;
    error = '';
    guestName = '';
    guestOpen = false;
    reschedule = false;
    reopenNow = false;
    reopenStart = '';
    priority: Record<string, string> = {};
    options = { configurationMode: 'size' as 'size' | 'count', teamCount: 2, maxTeamSize: 4, balanced: true, history: 'none', games: 1, watch: false };
    preview?: Board;
    previewStale = false;
    warnings: string[] = [];
    strictFallback = false;
    open = new Set<string>();
    private showLatestOnLoad = false;
    scoring?: GameSet;
    scoreEdits: {matchup: number; game: number; first: number | null; second: number | null}[] = [];
    editing?: GameSet;
    teamEdits: Participant[][] = [];
    swapFirst = '';
    swapSecond = '';

    ngOnChanges(): void {
        if (this.currentId !== this.session.id) {
            this.dialog?.close();
            this.currentId = this.session.id;
            this.data = undefined;
            this.tab = this.session.owner || this.session.canReopen || this.session.canDelete ? this.savedTab() : 'Teams & Scores';
            if (this.route.snapshot.queryParamMap.has('tab') && this.tabs.includes(this.tab)) this.selectTab(this.tab);
            this.busy = false;
            this.error = '';
            this.open.clear();
            this.showLatestOnLoad = this.tab === 'Teams & Scores' && this.route.snapshot.queryParamMap.get('set') === 'latest';
            this.discardPreview();
            this.scoring = this.editing = undefined;
            this.priority = {};
            this.playerBrowser?.close();
            this.guestOpen = this.reschedule = this.reopenNow = false;
            this.reopenStart = '';
        }
        if (this.tabs.length && !this.tabs.includes(this.tab)) this.selectTab(this.tabs[0]);
        void this.load();
    }

    ngOnDestroy(): void {
        this.currentId = undefined;
        ++this.request;
        this.playerBrowser?.close();
        this.dialog?.close();
    }

    get tabs(): string[] {
        if (!this.session.owner) return this.session.canReopen || this.session.canDelete ? ['Session Settings'] : [];
        return ['Players', ...(this.active ? ['Scramble Teams'] : []), 'Teams & Scores',
            ...(this.session.visibility !== 2 ? ['Invite Players'] : []), 'Session Settings'];
    }

    tabId(tab: string): string { return 'pickup-tab-' + tab.split(' ')[0].toLowerCase(); }

    tabKey(event: KeyboardEvent, index: number): void {
        const tabs = this.tabs;
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
            : event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
        if (target < 0) return;
        event.preventDefault();
        this.selectTab(tabs[target]);
        document.getElementById(this.tabId(tabs[target]))?.focus();
    }

    selectTab(tab: string): void {
        this.tab = tab;
        try { sessionStorage.setItem('pickup-tab-' + this.session.id, tab); } catch { /* Optional resume. */ }
    }

    private savedTab(): string {
        const requested = this.route.snapshot.queryParamMap.get('tab');
        if (requested && this.tabs.includes(requested)) return requested;
        try {
            const tab = sessionStorage.getItem('pickup-tab-' + this.session.id);
            if (tab && this.tabs.includes(tab)) return tab;
        } catch { /* Optional resume. */ }
        return !this.session.owner || this.session.state === 4 ? 'Session Settings' : 'Players';
    }

    get active(): boolean { return this.session.owner && (this.session.state === 1 || this.session.state === 2); }
    get eligible(): Registration[] { return (this.data?.players ?? []).filter(p => this.playing(p)); }
    private get endpoint(): string { return '/api/pickup/sessions/' + this.session.id; }

    get participants(): Registration[] { return (this.data?.players ?? []).filter(player => player.state !== 0); }
    get verifying(): Registration[] { return (this.data?.players ?? []).filter(player => player.state === 0); }

    playing(player: Registration): boolean {
        return player.state === 2 && (player.playing ?? !this.data?.checkedInOnly);
    }

    private async load(): Promise<void> {
        const request = ++this.request;
        try {
            const result = await firstValueFrom(this.http.get<Workspace>(this.endpoint + '/workspace'));
            if (request === this.request) {
                this.data = result;
                if (this.showLatestOnLoad) {
                    const latest = result.sets?.at(-1);
                    if (latest) this.open.add(latest.id);
                    this.showLatestOnLoad = false;
                }
                const roster = new Set(this.eligible.map(player => player.id));
                if (this.preview) {
                    const proposed = [...this.preview.teams.flat(), ...this.preview.byes];
                    if (roster.size !== proposed.length || proposed.some(player => !roster.has(player.id))) this.previewStale = true;
                }
            }
        } catch (error) {
            if (request === this.request) this.error = this.message(error);
        }
    }

    async mutate(path: string, body: object, method = 'POST', success?: () => void): Promise<void> {
        if (this.busy) return;
        const id = this.currentId;
        this.busy = true;
        this.error = '';
        try {
            await firstValueFrom(this.http.request(method, this.endpoint + path, {body}));
            if (id !== this.currentId) return;
            success?.();
            await this.load();
            this.sessionUpdated.emit();
        } catch (error) {
            if (id === this.currentId) this.notifications.error(this.message(error));
        } finally {
            if (id === this.currentId) this.busy = false;
        }
    }

    private message(error: any): string {
        return error?.status < 500 && error?.error?.message || 'The Pickup workspace could not complete that action. Try again.';
    }

    browse(): void {
        if (!this.active || this.playerBrowser) return;
        const endpoint = this.endpoint;
        const sessionId = this.currentId;
        const pickup: PickupPlayerBrowser = {
            load: () => this.http.get<{players: PickupBrowserPlayer[]}>(endpoint + '/player-options'),
            add: id => this.http.post(endpoint + '/players', {playerIds: [id]})
        };
        this.playerBrowser = this.dialogs.open(ExistingPlayerBrowserComponent, {
            width: 'min(1100px, calc(100vw - 16px))', maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)',
            data: {leagueName: this.session.name, pickup, onAdded: () => {
                if (sessionId !== this.currentId) return;
                this.preview = undefined;
                this.sessionUpdated.emit();
                this.notifications.success('Player added.');
                void this.load();
            }}
        });
        this.playerBrowser.afterClosed().subscribe(() => { this.playerBrowser = undefined; });
    }

    readonly clearGuest = () => { this.guestName = ''; this.notifications.success('Player added.'); };

    onTeam(roster: Participant[], id: string): boolean { return roster.some(player => player.id === id); }

    get rescheduleRequired(): boolean {
        return Date.parse(this.session.endsUtc) <= Date.now() ||
            Date.parse(this.session.deadlineUtc ?? this.session.startsUtc) <= Date.now();
    }

    async deleteSession(): Promise<void> {
        const session = this.session;
        const summary = this.data;
        if (this.busy || !session.canDelete || !summary) return;
        const date = new Intl.DateTimeFormat(undefined, {dateStyle: 'long', timeZone: session.venue.timeZone});
        if (!await this.ask({
            title: 'Permanently Delete Pickup Session?',
            message: 'This permanently removes the session, registrations, saved teams, and scores. The session cannot be reopened.',
            action: 'Permanently Delete', dismiss: 'Keep Session', tone: 'danger', confirmName: session.name,
            details: [
                {label: 'Session', value: session.name},
                {label: 'Scheduled date', value: date.format(new Date(session.startsUtc))},
                {label: 'Registered participants', value: session.confirmed},
                {label: 'Saved Game Sets', value: summary.gameSets},
                {label: 'Recorded scores', value: summary.gamesPlayed > 0 ? 'Yes' : 'No'}
            ]
        }) || this.busy || session.id !== this.currentId) return;
        this.busy = true;
        try {
            await firstValueFrom(this.http.delete('/api/pickup/sessions/' + session.id, {body: {name: session.name}}));
            this.deleted.emit(session.id);
        } catch (error) {
            this.notifications.error(this.message(error));
        } finally {
            this.busy = false;
        }
    }

    async reopen(): Promise<void> {
        if ((this.rescheduleRequired || this.reschedule) && !this.reopenNow && !this.reopenStart) {
            this.error = 'Choose a new start time or Start Now.';
            return;
        }
        if (!await this.ask({title: 'Reopen Pickup Session?', action: 'Reopen Session',
            message: 'Restore registration and management for this session. Previous teams, scores and attendance will be kept.'})) return;
        await this.mutate('/reopen', {
            startNow: this.reopenNow, start: this.reschedule || this.rescheduleRequired ? this.reopenStart : null
        }, 'POST', () => {
            this.reschedule = this.reopenNow = false;
            this.reopenStart = '';
            this.notifications.success('Pickup session reopened.');
        });
    }

    async cancelSession(): Promise<void> {
        if (!await this.ask({title: 'Cancel Pickup Session?', action: 'Cancel Session', dismiss: 'Keep Session', tone: 'danger',
            message: 'This will cancel the session and prevent new players from joining. You can reopen it later.'})) return;
        await this.mutate('/cancel', {}, 'POST', () => {
            this.preview = undefined;
            this.scoring = this.editing = undefined;
            this.notifications.success('Pickup session cancelled.');
        });
    }

    startPlaying(): void { void this.mutate('/lifecycle', {complete: false}); }

    async completeSession(): Promise<void> {
        if (!await this.ask({title: 'Complete Pickup Session?', action: 'Complete Session',
            message: 'Finish play and keep this session?s teams, results, and attendance.'})) return;
        await this.mutate('/lifecycle', {complete: true}, 'POST', () => {
            this.preview = undefined;
            this.scoring = this.editing = undefined;
            this.selectTab('Teams & Scores');
            this.notifications.success('Pickup session completed.');
        });
    }

    setAttendance(body: object): void { void this.mutate('/attendance', body, 'PUT', () => this.notifications.success('Player attendance updated.')); }

    get plannedTeams(): number | null {
        const count = this.eligible.length;
        const {configurationMode, teamCount, maxTeamSize} = this.options;
        const value = configurationMode === 'size' ? maxTeamSize : teamCount;
        if (!Number.isInteger(value) || value < 1 || value > 80 || count < 2 || count > 80) return null;
        const teams = configurationMode === 'size' ? 2 * Math.ceil(count / (2 * value)) : value;
        return teams >= 2 && teams <= count && teams % 2 === 0 ? teams : null;
    }

    async confirmDiscardPreview(): Promise<void> {
        if (await this.ask({title: 'Discard Unsaved Teams?', action: 'Discard Preview',
            dismiss: 'Keep Preview', message: 'Discard this team preview? Saved game sets will stay as they are.'})) {
            this.discardPreview();
        }
    }

    discardPreview(): void { this.preview = undefined; this.previewStale = false; }

    get previewConfigurationChanged(): boolean {
        if (!this.preview) return false;
        const board = this.preview;
        const {configurationMode, teamCount, maxTeamSize, games, history, balanced} = this.options;
        return board.options.configurationMode !== configurationMode ||
            board.options.teamCount !== (configurationMode === 'count' ? teamCount : null) ||
            board.options.maxTeamSize !== (configurationMode === 'size' ? maxTeamSize : null) ||
            board.gamesPerMatchup !== games || board.options.history !== history || board.options.balanced !== balanced ||
            this.eligible.some(p => (this.priority[p.id] === 'top') !== board.options.top.includes(p.id) ||
                (this.priority[p.id] === 'low') !== board.options.low.includes(p.id));
    }

    genderClass(player: Participant): string {
        const gender = player.gender?.toLowerCase();
        return gender === 'male' || gender === 'female' ? gender : '';
    }

    async generate(allowMinimumRepeats = false): Promise<void> {
        if (this.busy) return;
        const roster = this.eligible;
        this.error = '';
        this.warnings = [];
        this.strictFallback = false;
        this.discardPreview();
        if (roster.length < 2 || roster.length > 80) {
            this.error = roster.length > 80 ? 'The Scrambler supports 80 players per draw. Mark some participants Not Playing to select a smaller group.'
                : 'At least two playing participants are needed to scramble.';
            return;
        }
        const {configurationMode, teamCount, maxTeamSize, balanced, history, games, watch} = this.options;
        const planned = this.plannedTeams;
        if (!planned || !Number.isInteger(games) || games < 1 || games > 20) {
            this.error = !planned ? (configurationMode === 'size'
                ? 'Choose a maximum size from 1 to 80 that allows complete matchups for every playing participant.'
                : 'Choose an even number of teams between 2 and the playing roster size.') : 'Choose 1 to 20 games per matchup.';
            return;
        }
        const id = this.currentId;
        this.busy = true;
        try {
            const ids = new Map(roster.map((player, index) => [player.id, index + 1]));
            const top = roster.filter(p => this.priority[p.id] === 'top');
            const low = roster.filter(p => this.priority[p.id] === 'low');
            const topIds = top.map(p => ids.get(p.id)!);
            const lowIds = low.map(p => ids.get(p.id)!);
            const frequencies = this.history(ids);
            const mode = balanced ? 'balanced' : 'random';
            const result = await generateScramble({
                players: roster.map((p, i) => ({id: i + 1, isMale: p.gender?.toLowerCase() !== 'female'})),
                topIds, lowIds, balancePriorities: top.length + low.length > 0, mode,
                numberOfTeams: planned, prioritizeMatchupComposition: balanced, tournamentTopPairing: true,
                prioritizeHistory: history !== 'none', frequencies,
                prohibitedPairs: history === 'strict' ? frequencies.map(p => pairKey(p.player1Id, p.player2Id)) : [],
                allowMinimumRepeats, cancelled: () => id !== this.currentId
            });
            if (id !== this.currentId) return;
            if (result.status !== 'success') {
                this.strictFallback = result.strictImpossible && frequencies.length > 0;
                this.error = result.reason;
                return;
            }
            this.warnings = result.warnings;
            const teams = result.teams.map(team => team.map(p => roster[p.id - 1]));
            const byes = result.byes.map(p => roster[p.id - 1]);
            const assigned = [...teams.flat(), ...byes];
            if (teams.length !== planned || byes.length || assigned.length !== roster.length ||
                new Set(assigned.map(p => p?.id)).size !== roster.length || assigned.some(p => !p) ||
                teams.some(team => team.length < Math.floor(roster.length / planned) || team.length > Math.ceil(roster.length / planned) ||
                    (configurationMode === 'size' && team.length > maxTeamSize))) {
                this.error = 'The generated teams do not satisfy the selected configuration.';
                return;
            }
            this.preview = {teams, byes, gamesPerMatchup: games, options: {
                configurationMode, teamCount: configurationMode === 'count' ? teamCount : null,
                maxTeamSize: configurationMode === 'size' ? maxTeamSize : null, balanced, history, allowMinimumRepeats, top: top.map(p => p.id), low: low.map(p => p.id)
            }};
            if (watch) {
                const draft = buildScrambleDraft(result.teams.map((team, i) => ({id: i + 1, playerIds: team.map(p => p.id)})),
                    result.byes.map(p => p.id), roster.map((p, i) => ({id: i + 1, name: p.name, gender: p.gender ?? undefined})), topIds, lowIds);
                this.dialog = this.dialogs.open(ScrambleDraftComponent, {...scrambleDraftDialogOptions,
                    data: {draft, pickup: this.session.name}});
            }
        } catch (error) {
            if (id === this.currentId) this.error = error instanceof Error ? error.message : this.message(error);
        } finally {
            if (id === this.currentId) this.busy = false;
        }
    }

    private history(ids: Map<string, number>): PairFrequency[] {
        const frequencies = new Map<string, PairFrequency>();
        for (const set of this.data?.sets ?? []) {
            for (const team of set.board.teams) {
                const players = team.map(p => ids.get(p.id)).filter((id): id is number => id != null);
                for (const [position, a] of players.entries()) {
                    for (const b of players.slice(position + 1)) {
                        const key = pairKey(a, b);
                        const pair = frequencies.get(key) ?? {player1Id: Math.min(a, b), player2Id: Math.max(a, b), count: 0};
                        pair.count++;
                        frequencies.set(key, pair);
                    }
                }
            }
        }
        return [...frequencies.values()];
    }

    saveTeams(): void {
        if (!this.preview || this.previewStale || this.previewConfigurationChanged) return;
        const board = this.preview;
        void this.mutate('/sets', {teams: board.teams.map(team => team.map(p => p.id)), byes: board.byes.map(p => p.id),
            gamesPerMatchup: board.gamesPerMatchup, options: board.options}, 'POST', () => {
            this.preview = undefined;
            this.selectTab('Teams & Scores');
            this.notifications.success('Teams saved to this pickup session.');
        }).then(() => {
            const last = this.data?.sets?.at(-1);
            if (last && this.tab === 'Teams & Scores') this.open.add(last.id);
        });
    }

    matchups(teams: Participant[][]): {first: Participant[]; second: Participant[]}[] {
        return teams.filter((_, i) => i % 2 === 0).map((first, i) => ({first, second: teams[i * 2 + 1]}));
    }

    toggleSet(id: string): void { if (this.open.has(id)) this.open.delete(id); else this.open.add(id); }

    startScores(set: GameSet): void {
        this.scoring = set;
        this.editing = undefined;
        this.scoreEdits = this.matchups(set.board.teams).flatMap((_, index) => Array.from({length: set.board.gamesPerMatchup}, (_, game) => {
            const saved = set.scores.find(s => s.matchup === index + 1 && s.game === game + 1);
            return {matchup: index + 1, game: game + 1, first: saved?.first ?? null, second: saved?.second ?? null};
        }));
    }

    scoreRows(matchup: number) { return this.scoreEdits.filter(s => s.matchup === matchup); }
    results(set: GameSet, matchup: number): {game: number; score?: Score}[] {
        return Array.from({length: set.board.gamesPerMatchup}, (_, i) => ({
            game: i + 1, score: set.scores.find(s => s.matchup === matchup && s.game === i + 1)
        }));
    }
    savedScores(set: GameSet, matchup: number): Score[] { return set.scores.filter(score => score.matchup === matchup); }

    saveScores(): void {
        if (!this.scoring) return;
        const scores = this.scoreEdits.filter(s => s.first != null || s.second != null);
        if (scores.some(s => !Number.isInteger(s.first) || !Number.isInteger(s.second) || s.first! < 0 || s.second! < 0)) {
            this.error = 'Enter both whole-number scores for each game you want to record.';
            return;
        }
        const {id, version} = this.scoring;
        void this.mutate('/sets/' + id + '/scores', {version, scores}, 'PUT', () => {
            this.scoring = undefined;
            this.notifications.success('Pickup scores saved.');
        });
    }

    startTeams(set: GameSet): void {
        this.scoring = undefined;
        this.editing = set;
        this.teamEdits = set.board.teams.map(team => [...team]);
        this.swapFirst = this.swapSecond = '';
    }

    move(player: Participant, from: number, to: number, select: HTMLSelectElement): void {
        if (from === to) return;
        if (this.teamEdits[from].length === 1) {
            this.error = 'Each team needs at least one player. Use Swap Players to exchange the last player.';
            select.value = String(from);
            return;
        }
        this.error = '';
        this.teamEdits[from] = this.teamEdits[from].filter(p => p.id !== player.id);
        this.teamEdits[to].push(player);
    }

    swap(): void {
        const a = this.teamEdits.findIndex(team => team.some(p => p.id === this.swapFirst));
        const b = this.teamEdits.findIndex(team => team.some(p => p.id === this.swapSecond));
        if (a < 0 || b < 0 || a === b) { this.error = 'Select two players on different teams.'; return; }
        const x = this.teamEdits[a].findIndex(p => p.id === this.swapFirst);
        const y = this.teamEdits[b].findIndex(p => p.id === this.swapSecond);
        [this.teamEdits[a][x], this.teamEdits[b][y]] = [this.teamEdits[b][y], this.teamEdits[a][x]];
        this.error = '';
        this.swapFirst = this.swapSecond = '';
    }

    saveTeamEdits(): void {
        if (!this.editing) return;
        const {id, version} = this.editing;
        void this.mutate('/sets/' + id + '/teams', {version, teams: this.teamEdits.map(team => team.map(p => p.id))}, 'PUT',
            () => { this.editing = undefined; this.notifications.success('Pickup teams updated.'); });
    }

    print(set: GameSet): void {
        const popup = window.open('', '_blank');
        if (!popup) { this.error = 'Allow pop-ups to print the teams.'; return; }
        const name = (p: Participant) => ({firstName: p.name, lastName: ''});
        renderLargeMatchupPrint(popup, this.session.name + ' · Game Set ' + set.number, [{
            teams: set.board.teams.map((roster, i) => ({players: roster.map(name),
                scores: this.savedScores(set, Math.floor(i / 2) + 1).map(s => ({game: s.game, points: i % 2 ? s.second : s.first}))})),
            byes: set.board.byes.map(name), games: set.board.gamesPerMatchup
        }], 'landscape-balanced');
    }
}

import { ChangeDetectionStrategy, Component, inject, Input, Output, EventEmitter, OnChanges, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { generateScramble, pairKey, PairFrequency } from './scrambler/scramble-engine';
import { buildScrambleDraft } from './scrambler/scramble-draft';
import { ScrambleDraftComponent, scrambleDraftDialogOptions } from './scrambler/scramble-draft.component';
import { renderLargeMatchupPrint } from './matchup-large-print';
import { TournamentNotifications } from './tournament-notifications.service';

interface Participant { id: string; playerId: number | null; name: string; gender: string | null; }
interface Registration extends Participant { state: number; playing: boolean | null; }
interface Options { teamCount: number; maxTeamSize: number; balanced: boolean; history: string; top: string[]; low: string[]; allowMinimumRepeats: boolean; }
interface Board { teams: Participant[][]; byes: Participant[]; gamesPerMatchup: number; options: Options; }
interface Score { matchup: number; game: number; first: number; second: number; }
interface GameSet { id: string; number: number; version: number; board: Board; scores: Score[]; }
interface Workspace {
    players: Registration[] | null; checkedInOnly: boolean; playing: number; gamesPlayed: number; gameSets: number;
    myRegistrationId: string | null; sets: GameSet[] | null;
}
interface SessionSummary { id: string; name: string; state: number; owner: boolean; confirmed: number; visibility: number; organizerNotes?: string; }

@Component({
    selector: 'app-pickup-workspace',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule],
    templateUrl: './pickup-workspace.component.html',
    styleUrls: ['./pickup.component.css', './pickup-workspace.component.css']
})
export class PickupWorkspaceComponent implements OnChanges, OnDestroy {
    @Input({required: true}) session!: SessionSummary;
    @Input({required: true}) statuses: string[] = [];
    @Output() sessionUpdated = new EventEmitter<void>();
    @Output() editSettings = new EventEmitter<void>();
    @Output() invite = new EventEmitter<void>();

    private readonly http = inject(HttpClient);
    private readonly dialogs = inject(MatDialog);
    private readonly notifications = inject(TournamentNotifications);
    private dialog?: MatDialogRef<ScrambleDraftComponent>;
    private currentId?: string;
    private request = 0;
    private optionsRequest = 0;
    data?: Workspace;
    tab = 'Players';
    busy = false;
    error = '';
    addOpen = false;
    addSearch = '';
    addPage = 0;
    addMore = false;
    addOptions: {id: number; name: string}[] = [];
    selected = new Set<number>();
    guestName = '';
    confirm: 'cancel' | 'complete' | null = null;
    priority: Record<string, string> = {};
    options = { teamCount: 2, maxTeamSize: 4, balanced: true, history: 'none', games: 1, watch: false };
    preview?: Board;
    warnings: string[] = [];
    strictFallback = false;
    open = new Set<string>();
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
            this.tab = this.session.owner ? 'Players' : 'Teams & Scores';
            this.busy = false;
            this.error = '';
            this.open.clear();
            this.preview = undefined;
            this.scoring = this.editing = undefined;
            this.priority = {};
            this.addOpen = false;
            this.selected.clear();
            this.confirm = null;
            ++this.optionsRequest;
        }
        void this.load();
    }

    ngOnDestroy(): void {
        this.currentId = undefined;
        ++this.request;
        ++this.optionsRequest;
        this.dialog?.close();
    }

    get active(): boolean { return this.session.owner && (this.session.state === 1 || this.session.state === 2); }
    get eligible(): Registration[] { return (this.data?.players ?? []).filter(p => this.playing(p)); }
    private get endpoint(): string { return '/api/pickup/sessions/' + this.session.id; }

    playing(player: Registration): boolean {
        return player.state === 2 && (player.playing ?? !this.data?.checkedInOnly);
    }

    private async load(): Promise<void> {
        const request = ++this.request;
        try {
            const result = await firstValueFrom(this.http.get<Workspace>(this.endpoint + '/workspace'));
            if (request === this.request) this.data = result;
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
            if (id === this.currentId) this.error = this.message(error);
        } finally {
            if (id === this.currentId) this.busy = false;
        }
    }

    private message(error: any): string {
        return error?.error?.message || 'The Pickup workspace could not complete that action. Try again.';
    }

    async browse(page = 0): Promise<void> {
        this.addOpen = true;
        const request = ++this.optionsRequest;
        try {
            const result = await firstValueFrom(this.http.get<{players: {id: number; name: string}[]; hasMore: boolean}>(
                this.endpoint + '/player-options', {params: {q: this.addSearch, page}}));
            if (request !== this.optionsRequest) return;
            this.addOptions = result.players;
            this.addMore = result.hasMore;
            this.addPage = page;
        } catch (error) {
            if (request === this.optionsRequest) this.error = this.message(error);
        }
    }

    selectPlayer(id: number, selected: boolean): void {
        if (selected) this.selected.add(id);
        else this.selected.delete(id);
    }

    readonly clearGuest = () => { this.guestName = ''; };

    onTeam(roster: Participant[], id: string): boolean { return roster.some(player => player.id === id); }

    finish(): void {
        const complete = this.confirm === 'complete';
        void this.mutate(complete ? '/lifecycle' : '/cancel', {complete}, 'POST', () => {
            this.confirm = null;
            this.preview = undefined;
            this.scoring = this.editing = undefined;
            this.tab = 'Teams & Scores';
            this.notifications.success(complete ? 'Pickup session completed.' : 'Pickup session cancelled.');
        });
    }

    addPlayers(): void {
        void this.mutate('/players', {playerIds: [...this.selected], guestName: this.guestName}, 'POST', () => {
            this.selected.clear();
            this.guestName = '';
            this.addOpen = false;
        });
    }

    setAttendance(body: object): void { void this.mutate('/attendance', body, 'PUT', () => { this.preview = undefined; }); }

    async generate(allowMinimumRepeats = false): Promise<void> {
        if (this.busy) return;
        const roster = this.eligible;
        this.error = '';
        this.warnings = [];
        this.strictFallback = false;
        this.preview = undefined;
        if (roster.length < 2 || roster.length > 80) {
            this.error = roster.length > 80 ? 'The Scrambler supports 80 players per draw. Mark some participants Not Playing to select a smaller group.'
                : 'At least two playing participants are needed to scramble.';
            return;
        }
        const {teamCount, maxTeamSize, balanced, history, games, watch} = this.options;
        if (![teamCount, maxTeamSize, games].every(Number.isInteger) || teamCount < 0 || teamCount > 80 || teamCount % 2 !== 0 ||
            maxTeamSize < 1 || maxTeamSize > 80 || games < 1 || games > 20) {
            this.error = 'Choose an even team count (or 0 for automatic), a team size from 1 to 80, and 1 to 20 games.';
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
                topIds, lowIds, balancePriorities: top.length + low.length > 0, mode, maxTeamSize,
                numberOfTeams: teamCount || undefined, prioritizeMatchupComposition: balanced,
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
            this.preview = {teams, byes, gamesPerMatchup: games, options: {
                teamCount, maxTeamSize, balanced, history, allowMinimumRepeats, top: top.map(p => p.id), low: low.map(p => p.id)
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
        if (!this.preview) return;
        const board = this.preview;
        void this.mutate('/sets', {teams: board.teams.map(team => team.map(p => p.id)), byes: board.byes.map(p => p.id),
            gamesPerMatchup: board.gamesPerMatchup, options: board.options}, 'POST', () => {
            this.preview = undefined;
            this.tab = 'Teams & Scores';
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

import { renderMatchupPrint } from './matchup-print';
import { RouterLink } from '@angular/router';
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
}
interface SavedRound {
    roundNumber: number; status: 'unplayed' | 'partial' | 'completed'; gamesPerMatchup: number;
    teams: {id: number; players: Player[]; scores: {game: number; points: number}[]}[];
    byes: Player[];
}
interface ScoreEdit {
    teamId: number; opponentId: number; game: number; points: number | null; opponentPoints: number | null;
    matchup: number;
}

@Component({
    selector: 'app-tournament-rounds',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, NgTemplateOutlet, RouterLink],
    templateUrl: './tournament-rounds.component.html',
    styleUrl: './tournament-rounds.component.css'
})
export class TournamentRoundsComponent implements OnInit {
    readonly leagueId = input.required<number>();
    readonly tournamentName = input('');
    readonly readOnly = input(false);
    readonly wizardStep = input(0);
    readonly roundsSaved = output<void>();
    publicName = '';
    readonly versionChanged = output<string>();
    teamBySize = true;
    private readonly http = inject(HttpClient);
    private readonly host = inject(ElementRef<HTMLElement>);
    private readonly destroy = inject(DestroyRef);
    state?: SettingsState;
    rounds: SavedRound[] = [];
    preview: TournamentAllocation[] = [];
    notice = '';
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
    byeRound = 1;
    scoreRound?: SavedRound;
    scoreEdits: ScoreEdit[] = [];
    printSelection = new Set<number>();
    printRounds: SavedRound[] = [];

    private get url(): string { return '/api/tournaments/' + this.leagueId(); }

    get eligible(): (Player & ScramblePlayer)[] {
        if (!this.state || !this.state.mode) return [];
        return this.state.mode === 3 ? this.state.roster :
            this.state.roster.filter(player => this.state!.presentIds.includes(player.id));
    }

    get filteredPlayers(): (Player & ScramblePlayer)[] {
        const query = this.filter.trim().toLowerCase();
        return (this.state?.roster ?? []).filter(player => this.playerName(player).toLowerCase().includes(query));
    }

    get history() {
        const rows = this.state?.history ?? [];
        return rows.filter((row, index) => rows.findIndex(test => test.scrambleNumber === row.scrambleNumber) === index);
    }

    get roundsForPrinting(): SavedRound[] { return this.rounds.filter(round => this.printSelection.has(round.roundNumber)); }
    matchupFor(index: number): number { return Math.floor(index / 2) + 1; }

    get completed(): number { return this.rounds.filter(round => round.status === 'completed').length; }
    get nextRound(): SavedRound | undefined { return this.rounds.find(round => round.status !== 'completed'); }
    get hasUnplayed(): boolean { return this.rounds.some(round => round.status === 'unplayed'); }

    async ngOnInit(): Promise<void> {
        await this.perform(async () => {
            if (this.readOnly()) {
                const result = await this.request(this.http.get<{name: string; rounds: SavedRound[]}>(this.url + '/rounds'));
                this.publicName = result.name;
                this.rounds = result.rounds;
            } else {
                await this.reload();
                if (this.rounds.length) this.step = 'rounds';
            }
        });
    }

    private request<T>(value: import('rxjs').Observable<T>): Promise<T> {
        return firstValueFrom(value.pipe(takeUntilDestroyed(this.destroy)));
    }

    private async reload(): Promise<void> {
        const [state, result] = await Promise.all([
            this.request(this.http.get<SettingsState>(this.url + '/round-settings')),
            this.request(this.http.get<{version: string; settingsSaved: boolean; rounds: SavedRound[]}>(this.url + '/rounds'))
        ]);
        if (state.version !== result.version) throw new Error('Tournament state changed while loading. Refresh and try again.');
        this.state = state;
        this.teamBySize = state.settings.maximumTeamSize !== null;
        this.rounds = result.rounds;
        this.settingsSaved = result.settingsSaved;
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
        Object.assign(this.state!.settings, size ?
            { maximumTeamSize: 4, numberOfTeams: null } : { maximumTeamSize: null, numberOfTeams: 4, activeTeamLimit: null });
        this.markEdited();
    }

    markEdited(): void {
        this.dirty = true;
        this.preview = [];
    }

    setPriority(id: number, priority: string): void {
        const settings = this.state!.settings;
        const set = (ids: number[], active: boolean) => ids.includes(id) ?
            (active ? ids : ids.filter(saved => saved !== id)) : (active ? [...ids, id] : ids);
        settings.topPlayerIds = set(settings.topPlayerIds, priority === 'top');
        settings.lowPlayerIds = set(settings.lowPlayerIds, priority === 'low');
        this.markEdited();
    }

    toggleHistory(number: number, checked: boolean): void {
        const settings = this.state!.settings;
        settings.historicalScrambleNumbers = checked ? [...settings.historicalScrambleNumbers, number] :
            settings.historicalScrambleNumbers.filter(saved => saved !== number);
        this.markEdited();
    }

    setBye(playerId: number, checked: boolean): void {
        const settings = this.state!.settings;
        settings.manualByes = settings.manualByes.filter(bye => bye.playerId !== playerId || bye.roundNumber !== this.byeRound);
        if (checked) settings.manualByes.push({ roundNumber: this.byeRound, playerId });
        this.markEdited();
    }

    manualBye(id: number): boolean {
        return this.state!.settings.manualByes.some(bye => bye.playerId === id && bye.roundNumber === this.byeRound);
    }

    async saveSettings(): Promise<boolean> {
        if (this.busy || !this.state) return false;
        let success = false;
        await this.perform(async () => {
            const state = this.state!;
            const saved = await this.request(this.http.put<{version: string}>(this.url + '/round-settings',
                { version: state.version, settings: state.settings }));
            state.version = saved.version;
            this.versionChanged.emit(saved.version);
            this.settingsSaved = true;
            this.dirty = false;
            this.notice = 'Tournament settings saved.';
            success = true;
        });
        return success;
    }

    async propose(single?: number): Promise<void> {
        await this.perform(async () => {
            const state = this.state!;
            const settings = state.settings;
            this.preview = [];
            if (!this.settingsSaved || this.dirty) throw new Error('Save your tournament settings before generating rounds.');
            const pending = single ? [single] : this.sequence(settings.numberOfRounds)
                .filter(number => !this.rounds.some(round => round.roundNumber === number && round.status !== 'unplayed'));
            const preserved = this.rounds.filter(round => !pending.includes(round.roundNumber)).map(round => ({
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
            await this.request(this.http.put(this.url + '/rounds',
                { version: this.previewVersion, allowHistoricalFallback: this.fallback, rounds: this.preview }));
            this.preview = [];
            await this.reload();
            this.versionChanged.emit(this.state!.version);
            this.notice = 'Tournament rounds saved.';
            this.roundsSaved.emit();
        });
    }

    openScores(round: SavedRound): void {
        this.step = 'scores';
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
            await this.request(this.http.put(this.url + '/rounds/' + number + '/scores',
                { version: this.state!.version, scores: started }));
            await this.reload();
            this.versionChanged.emit(this.state!.version);
            this.openScores(this.rounds.find(round => round.roundNumber === number)!);
            this.notice = 'Round scores saved.';
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
                '.player-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}' +
                '.team{border:1px solid #333;padding:8px;break-inside:avoid}' +
                'body>article+article{break-before:page}');
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

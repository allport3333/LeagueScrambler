import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface AttendancePlayer { id: number; firstName: string; lastName: string; present: boolean; }
interface AttendanceState {
    mode: number; version: string; unavailableIds?: number[];
    organizers: boolean; roster: AttendancePlayer[];
}

@Component({
    selector: 'app-tournament-check-in',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule],
    styles: [`
        main { padding: 12px; }
        header { text-align: center; }
        h3 { font-size: 1.1rem; }
        .eligibility { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); gap: .55rem; }
        .choice, .roster li { display: flex; align-items: center; gap: .55rem; padding: .55rem; border: 1px solid var(--hub-border, #bcc6d2); border-radius: .45rem; background: var(--hub-surface, #fff); }
        .choice { align-items: start; cursor: pointer; margin: 0; }
        .choice.selected { border-color: var(--hub-focus, #1c5d9b); }
        .choice:focus-within { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
        .choice input { flex: 0 0 1rem; width: 1rem; margin: .25rem 0 0; accent-color: var(--hub-primary-action, #30577e); }
        .choice small { display: block; margin-top: .15rem; }
        .actions, .counts { display: flex; flex-wrap: wrap; gap: .4rem .65rem; align-items: center; margin-block: .7rem; }
        .counts span { border: 1px solid var(--hub-border, #bcc6d2); border-radius: 1rem; padding: .2rem .55rem; }
        .counts .present, .attendance-status.present { color: var(--hub-win-text, #20543e); background: var(--hub-win-surface, #e6f5ec); }
        .search { display: grid; gap: .25rem; max-width: 23rem; margin-block: .6rem; }
        .roster { list-style: none; padding: 0; display: grid; gap: .4rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); }
        .roster li { justify-content: space-between; min-width: 0; }
        .player { min-width: 0; overflow-wrap: anywhere; }
        .attendance-status { display: table; padding: .06rem .3rem; border-radius: .3rem; font-size: .85rem; }
        button { min-height: 44px; padding: .4rem .65rem; border: 1px solid var(--hub-border, #bcc6d2); border-radius: .4rem; color: inherit; background: var(--hub-surface, #fff); }
        .actions { align-items: end; }
        .actions label { display: grid; gap: .25rem; max-width: 100%; }
        .actions .search { flex: 1 1 14rem; margin: 0; }
        .roster button { flex-shrink: 0; }
        button:disabled { opacity: .65; }
        :is(button, input, select):focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
    `],
    template: `
        <main>
            <header><h2>Confirm Participants</h2></header>
            @if (state?.organizers) {
                    <h3 id="eligibility-question">Who can play in this tournament?</h3>
                    <div class="eligibility" role="radiogroup" aria-labelledby="eligibility-question">
                        <label class="choice" [class.selected]="state.mode === 3">
                            <input type="radio" name="eligibility" [checked]="state.mode === 3" [disabled]="busy || loading" (change)="setMode(3)">
                            <span><strong>Use All Registered Players</strong>
                                <small>Everyone on the tournament roster is eligible. Check in is not required.</small></span>
                        </label>
                        <label class="choice" [class.selected]="checkedInOnly">
                            <input type="radio" name="eligibility" [checked]="checkedInOnly" [disabled]="busy || loading" (change)="setMode(1)">
                            <span><strong>Use Checked In Players</strong>
                                <small>Only checked-in players are eligible for future round generation.</small></span>
                        </label>
                    </div>
                    <p>Directors can record attendance with either option. Players check themselves in from Home once eligibility is set.</p>
                    @if (hasRounds()) { <p>Changes affect future generation or confirmed replacements. Saved teams and scores stay in place.</p> }
                    <div class="counts" aria-label="Attendance totals">
                        <span>{{ state.roster.length }} registered</span>
                        <span class="present">{{ presentCount }} checked in</span>
                        <span>{{ state.roster.length - presentCount }} not checked in</span>
                        @if (state.mode) { <span>{{ eligibleCount }} eligible</span> }
                        @else { <span>Eligible roster pending</span> }
                    </div>
                    <div class="actions">
                        <label class="search">Find a participant <input class="form-control" type="search" [(ngModel)]="filter"></label>
                        <label>Attendance <select class="form-control" [(ngModel)]="attendanceFilter">
                            <option value="all">All participants</option><option value="present">Checked in</option>
                            <option value="absent">Not checked in</option>
                        </select></label>
                        <button type="button" [disabled]="busy || loading" (click)="load()">Refresh Roster</button>
                    </div>
                    <ul class="roster">
                        @for (player of shownPlayers; track player.id) {
                            <li>
                                <span class="player">{{ player.firstName }} {{ player.lastName }}
                                    <small class="attendance-status" [class.present]="player.present">{{ player.present ? 'Checked in' : 'Not checked in' }}</small></span>
                                    <button type="button" [disabled]="busy || loading" (click)="setPresence(player)"
                                        [attr.aria-label]="(player.present ? 'Undo check-in for ' : 'Check in ') + player.firstName + ' ' + player.lastName">
                                        {{ player.present ? 'Undo Check In' : 'Check In' }}
                                    </button>
                            </li>
                        } @empty {
                            <li>{{ state.roster.length ? 'No matching participants.' : 'No participants registered yet.' }}</li>
                        }
                    </ul>
            }
            @if (loading) { <p role="status">Loading check-in…</p> }
            @if (notice) { <p role="status">{{ notice }}</p> }
            @if (error) { <p role="alert">{{ error }}</p> }
        </main>
    `
})
export class TournamentCheckInComponent implements OnInit {
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    readonly leagueId = input.required<number>();
    readonly hasRounds = input(false);
    readonly versionChanged = output<string>();
    private get url() { return '/api/tournament-attendance/' + this.leagueId(); }
    state?: AttendanceState;
    loading = true;
    busy = false;
    error = '';
    notice = '';
    filter = '';
    attendanceFilter = 'all';

    ngOnInit() { void this.load(); }

    get checkedInOnly() { return this.state?.mode === 1 || this.state?.mode === 2; }
    get eligibleCount() {
        return this.state?.roster.filter(player => (this.state.mode === 3 || player.present) &&
            !this.state.unavailableIds?.includes(player.id)).length ?? 0;
    }
    get presentCount() { return this.state?.roster.filter(player => player.present).length ?? 0; }
    get shownPlayers() {
        const name = this.filter.trim().toLowerCase();
        return (this.state?.roster ?? []).filter(player =>
            (player.firstName + ' ' + player.lastName).toLowerCase().includes(name) &&
            (this.attendanceFilter === 'all' || player.present === (this.attendanceFilter === 'present')));
    }

    private request<T>(observable: import('rxjs').Observable<T>) {
        return firstValueFrom(observable.pipe(takeUntilDestroyed(this.destroy)));
    }

    async load() {
        this.loading = true;
        this.error = this.notice = '';
        try {
            this.state = await this.request(this.http.get<AttendanceState>(this.url));
            this.versionChanged.emit(this.state.version);
            if (!this.state.organizers) this.error = 'Only tournament directors can manage attendance.';
        }
        catch { this.error = 'Check-in is unavailable for this account or tournament.'; }
        finally { this.loading = false; }
    }

    async saveEligibility(): Promise<boolean> {
        if (!this.state?.organizers || this.busy || this.loading) return false;
        if (this.state.mode === 2) return this.setMode(1);
        if (this.state.mode === 1 || this.state.mode === 3) return true;
        this.error = 'Choose who can play before continuing.';
        return false;
    }

    async setMode(mode: number) {
        if (!this.state?.organizers) return false;
        return this.change('/mode', { mode, version: this.state.version }, 'Eligibility saved.');
    }

    async setPresence(player: AttendancePlayer) {
        await this.change('/players/' + player.id, { present: !player.present }, player.present ? 'Check-in removed.' : 'Check-in confirmed.');
    }

    private async change(path: string, input: object, notice: string): Promise<boolean> {
        if (this.busy) return false;
        this.busy = true;
        this.error = this.notice = '';
        try {
            await this.request(this.http.put(this.url + path, input));
            await this.load();
            if (this.error) return false;
            this.notice = notice;
            return true;
        } catch (error) {
            this.error = error.error?.message || 'The check-in change could not be saved.';
            return false;
        } finally { this.busy = false; }
    }
}

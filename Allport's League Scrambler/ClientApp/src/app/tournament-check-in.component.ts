import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface AttendancePlayer { id: number; firstName: string; lastName: string; present: boolean; }
interface AttendanceState {
    name: string; eventDate: string; mode: number; version: string;
    organizers: boolean; ownPlayerId: number | null; roster: AttendancePlayer[];
}

@Component({
    selector: 'app-tournament-check-in',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, RouterLink],
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
        button, .actions a { min-height: 44px; padding: .4rem .65rem; border: 1px solid var(--hub-border, #bcc6d2); border-radius: .4rem; color: inherit; background: var(--hub-surface, #fff); }
        .actions a { display: inline-flex; align-items: center; color: var(--hub-link, #245587); }
        button:disabled { opacity: .65; }
        :is(button, input, a):focus-visible { outline: 2px solid var(--hub-focus, #1c5d9b); outline-offset: 2px; }
    `],
    template: `
        <main>
            <header>
                @if (embedded()) { <h2>Player Check In</h2> } @else { <h1>Tournament Check In</h1> }
                @if (state && !embedded()) { <p>{{ state.name }} · {{ state.eventDate }}</p> }
            </header>
            @if (state; as data) {
                @if (!manageEligibility && data.organizers) {
                    <div class="actions"><a [routerLink]="['/tournament', leagueId]" [queryParams]="{step: 5}">Back to Manage Attendance</a></div>
                }
                @if (manageEligibility) {
                    <h3 id="eligibility-question">Who can play in this tournament?</h3>
                    <div class="eligibility" role="radiogroup" aria-labelledby="eligibility-question">
                        <label class="choice" [class.selected]="data.mode === 3">
                            <input type="radio" name="eligibility" [checked]="data.mode === 3" [disabled]="busy" (change)="setMode(3)">
                            <span><strong>Use All Registered Participants</strong>
                                <small>Everyone on the tournament roster is eligible. Check in is not required.</small></span>
                        </label>
                        <label class="choice" [class.selected]="checkedInOnly">
                            <input type="radio" name="eligibility" [checked]="checkedInOnly" [disabled]="busy" (change)="setMode(1)">
                            <span><strong>Use Checked In Participants Only</strong>
                                <small>Only participants who have checked in are eligible. Players can check themselves in, or an organizer can check them in.</small></span>
                        </label>
                    </div>
                    @if (hasRounds()) { <p>Eligibility changes apply to future generation. Saved teams and scores stay in place.</p> }
                    <div class="counts" aria-label="Attendance totals">
                        <span>{{ data.roster.length }} registered</span>
                        <span class="present">{{ presentCount }} checked in</span>
                        <span>{{ data.roster.length - presentCount }} not checked in</span>
                    </div>
                    <div class="actions">
                        @if (!embedded()) { <a [routerLink]="['/tournament', leagueId]">Tournament Center</a> }
                        @if (checkedInOnly) {
                            <button type="button" [disabled]="busy" (click)="openPlayerPage()">Player Check In Page</button>
                            <button type="button" [disabled]="busy" [attr.aria-expanded]="showAttendance"
                                (click)="showAttendance = !showAttendance">Manage Attendance</button>
                        }
                    </div>
                    @if (checkedInOnly && showAttendance) {
                        <label class="search">Find a participant <input class="form-control" type="search" [(ngModel)]="filter"></label>
                    }
                } @else if (data.mode === 3) {
                    <p class="text-center">Check in is optional. All registered participants are eligible.</p>
                } @else if (data.mode !== 1) {
                    <p class="text-center">Player check in is not open yet.</p>
                }
                @if (!manageEligibility || (checkedInOnly && showAttendance)) {
                    <ul class="roster">
                        @for (player of shownPlayers; track player.id) {
                            <li>
                                <span class="player">{{ player.firstName }} {{ player.lastName }}
                                    <small class="attendance-status" [class.present]="player.present">{{ player.present ? 'Checked in' : 'Not checked in' }}</small></span>
                                @if (data.mode === 1 || (manageEligibility && data.mode === 2)) {
                                    <button type="button" [disabled]="busy" (click)="setPresence(player)"
                                        [attr.aria-label]="(player.present ? 'Undo check-in for ' : 'Check in ') + player.firstName + ' ' + player.lastName">
                                        {{ player.present ? 'Undo Check In' : 'Check In' }}
                                    </button>
                                }
                            </li>
                        } @empty {
                            <li>{{ manageEligibility ? 'No matching participants.' : 'No participant profile is linked to this account for this tournament.' }}</li>
                        }
                    </ul>
                }
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
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    readonly embedded = input(false);
    readonly hasRounds = input(false);
    readonly versionChanged = output<string>();
    readonly leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
    private get url() { return '/api/tournament-attendance/' + this.leagueId; }
    state?: AttendanceState;
    loading = true;
    busy = false;
    error = '';
    notice = '';
    filter = '';
    showAttendance = false;

    ngOnInit() { void this.load(); }

    get manageEligibility() { return this.state?.organizers && this.route.snapshot.queryParamMap.get('player') !== '1'; }
    get checkedInOnly() { return this.state?.mode === 1 || this.state?.mode === 2; }
    get presentCount() { return this.state?.roster.filter(player => player.present).length ?? 0; }
    get shownPlayers() {
        const name = this.filter.trim().toLowerCase();
        return (this.state?.roster ?? []).filter(player => this.manageEligibility
            ? (player.firstName + ' ' + player.lastName).toLowerCase().includes(name)
            : player.id === this.state?.ownPlayerId);
    }

    private request<T>(observable: import('rxjs').Observable<T>) {
        return firstValueFrom(observable.pipe(takeUntilDestroyed(this.destroy)));
    }

    private async load() {
        try {
            this.state = await this.request(this.http.get<AttendanceState>(this.url));
            this.versionChanged.emit(this.state.version);
        }
        catch { this.error = 'Check-in is unavailable for this account or tournament.'; }
        finally { this.loading = false; }
    }

    async saveEligibility(): Promise<boolean> {
        if (!this.state || this.busy) return false;
        if (this.state.mode === 2) return this.setMode(1);
        if (this.state.mode === 1 || this.state.mode === 3) return true;
        this.error = 'Choose who can play before continuing.';
        return false;
    }

    async setMode(mode: number) {
        if (!this.state || !this.manageEligibility) return false;
        return this.change('/mode', { mode, version: this.state.version }, 'Eligibility saved.');
    }

    async openPlayerPage() {
        if (this.state?.mode === 2 && !(await this.setMode(1))) return;
        if (this.state?.mode === 1) await this.router.navigate(['/tournament', this.leagueId, 'check-in'], { queryParams: { player: 1 } });
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

import { ExistingPlayerBrowserComponent } from './league-management/existing-player-browser.component';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, firstValueFrom, of, switchMap, timer } from 'rxjs';
import { PlayerService } from './services/player.service';

interface NameMatch extends Participant { exact: boolean; isMale: boolean; }
interface Participant { id: number; firstName: string; lastName: string; present?: boolean; }
@Component({
    selector: 'app-tournament-participants',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, ExistingPlayerBrowserComponent],
    styles: [`
        .actions, li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
        li, li span { min-width: 0; overflow-wrap: anywhere; }
        ul { list-style: none; margin: 8px 0; padding: 0; }
        li, details { border: 1px solid var(--hub-border, #bcc6d2); border-radius: 5px; padding: 8px; margin-block: 6px; background: var(--hub-surface, #fff); }
        .sections { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
        app-existing-player-browser { height: min(55vh, 40rem); min-height: 260px; }
        .roster { max-height: min(55vh, 40rem); overflow-y: auto; }
        @media (max-width: 740px) { .sections { grid-template-columns: minmax(0, 1fr); } }
        label { display: block; margin-block: 8px; }
        button, summary { min-height: 42px; }
        summary { cursor: pointer; padding: 8px; }
    `],
    template: `
        <h2>Manage Participants</h2>
        <p>{{ roster.length }} registered · {{ checkedIn }} checked in · {{ eligible }} eligible</p>
        @if (error) { <p role="alert">{{ error }}</p> }
        @if (notice) { <p role="status">{{ notice }}</p> }
        <div class="sections">
            <section>
                <h3>Add Participants</h3>
                <app-existing-player-browser [embeddedData]="pickerData" />
                <details>
                    <summary>Register a New Player</summary>
                    <form (ngSubmit)="register()" #form="ngForm">
                        <label>First Name <input class="form-control" name="firstName" maxlength="100" required [(ngModel)]="firstName" (ngModelChange)="reviewName()"></label>
                        <label>Last Name <input class="form-control" name="lastName" maxlength="100" required [(ngModel)]="lastName" (ngModelChange)="reviewName()"></label>
                        <label>Gender <select class="form-control" name="gender" required [(ngModel)]="gender">
                            <option value="">Select</option><option>Male</option><option>Female</option>
                        </select></label>
                        @if (checking) { <p role="status">Checking for existing players…</p> }
                        @if (matchError) { <p role="alert">{{ matchError }} <button type="button" (click)="reviewName()">Retry</button></p> }
                        @if (matches.length) {
                            <section aria-label="Possible existing players">
                                <h4>Possible Existing Players</h4>
                                <ul>
                                @for (match of matches; track match.id) {
                                    <li>
                                        <span>{{ match.firstName }} {{ match.lastName }} · {{ match.isMale ? 'Male' : 'Female' }}
                                            · Player #{{ match.id }}{{ match.exact ? ' · Exact name' : '' }}</span>
                                        <button type="button" class="btn btn-primary" [disabled]="busy || hasPlayer(match.id)"
                                            (click)="addMatch(match)">{{ hasPlayer(match.id) ? 'Already Added' : 'Add Existing Player' }}</button>
                                    </li>
                                }
                                </ul>
                                <label><input type="checkbox" name="reviewed" [(ngModel)]="reviewed">
                                    {{ exactMatch ? 'I confirm that this is a different person with the same name' : 'None of These' }}</label>
                            </section>
                        }
                        <button class="btn btn-primary" [disabled]="form.invalid || busy || checking || !!matchError || (matches.length > 0 && !reviewed)">Register and Add</button>
                    </form>
                </details>
            </section>
            <section>
                <h3>Tournament Roster</h3>
                <ul class="roster">
                @for (player of roster; track player.id) {
                    <li><span>{{ player.firstName }} {{ player.lastName }}{{ player.present ? ' · Checked in' : '' }}</span>
                        <button type="button" class="btn btn-primary" [disabled]="busy"
                            [attr.aria-label]="'Remove ' + player.firstName + ' ' + player.lastName" (click)="remove(player)">Remove</button>
                    </li>
                } @empty { <li>No participants added yet.</li> }
                </ul>
            </section>
        </div>
    `
})
export class TournamentParticipantsComponent implements OnInit {
    readonly leagueId = input.required<number>();
    readonly tournamentName = input.required<string>();
    private readonly http = inject(HttpClient);
    private readonly players = inject(PlayerService);
    private readonly destroy = inject(DestroyRef);
    roster: Participant[] = [];
    private readonly picker = viewChild(ExistingPlayerBrowserComponent);
    pickerData: ExistingPlayerBrowserComponent['embeddedData'];
    firstName = '';
    lastName = '';
    gender = '';
    private readonly nameChanges = new Subject<{ firstName: string; lastName: string }>();
    matches: NameMatch[] = [];
    checking = false;
    matchError = '';
    reviewed = false;
    get exactMatch() { return this.matches.some(match => match.exact); }
    mode = 0;
    busy = false;
    error = '';
    notice = '';
    get checkedIn() { return this.roster.filter(player => player.present).length; }
    get eligible() { return this.mode === 3 ? this.roster.length : this.mode ? this.checkedIn : 0; }

    ngOnInit() {
        this.pickerData = { leagueId: this.leagueId(), leagueName: this.tournamentName(),
            onAdded: result => {
                if (!this.hasPlayer(result.player.id)) this.roster = [...this.roster, result.player];
                void this.reload().catch(() => {});
            }
        };
        this.nameChanges.pipe(switchMap(names =>
            names.firstName && names.lastName
                ? timer(250).pipe(switchMap(() => this.http.get<NameMatch[]>(this.url + '/participant-matches', { params: names })), catchError(() => of(null)))
                : of([])), takeUntilDestroyed(this.destroy)).subscribe(matches => {
            this.checking = false;
            this.matchError = matches ? '' : 'Could not check for existing players.';
            this.matches = matches ?? [];
        });
        void this.perform(() => this.reload());
    }

    private request<T>(observable: import('rxjs').Observable<T>) {
        return firstValueFrom(observable.pipe(takeUntilDestroyed(this.destroy)));
    }

    private async reload() {
        const result = await this.request(this.http.get<{roster: Participant[]; mode: number}>('/api/tournament-attendance/' + this.leagueId()));
        this.roster = result.roster;
        this.mode = result.mode;
    }

    hasPlayer(id: number) { return this.roster.some(player => player.id === id); }

    private get url() { return '/api/tournaments/' + this.leagueId(); }

    reviewName() {
        this.reviewed = false;
        this.matches = [];
        this.matchError = '';
        this.checking = true;
        this.nameChanges.next({ firstName: this.firstName.trim(), lastName: this.lastName.trim() });
    }

    async addMatch(match: NameMatch) {
        await this.perform(async () => {
            await this.request(this.players.addExistingLeaguePlayer(this.leagueId(), this.tournamentName(), match.id, 0));
            await this.reload();
            this.picker()?.load();
            this.notice = 'Existing player added.';
        });
    }

    async register() {
        if (this.checking || this.matchError || (this.matches.length && !this.reviewed)) return;
        await this.perform(async () => {
            try {
                await this.request(this.http.post(this.url + '/participants/register', {
                    firstName: this.firstName.trim(), lastName: this.lastName.trim(), gender: this.gender,
                    reviewedMatches: this.matches.map(match => match.id), confirmExact: this.exactMatch && this.reviewed
                }));
            } catch (error) {
                if (error.status === 409 && Array.isArray(error.error?.matches)) {
                    this.matches = error.error.matches;
                    this.reviewed = false;
                }
                throw error;
            }
            await this.reload();
            this.picker()?.load();
            this.firstName = this.lastName = this.gender = '';
            this.reviewName();
            this.notice = 'New player registered and added.';
        });
    }

    async remove(player: Participant) {
        await this.perform(async () => {
            await this.request(this.http.delete('/api/tournaments/' + this.leagueId() + '/participants/' + player.id));
            await this.reload();
            this.picker()?.load();
            this.notice = 'Participant removed from this tournament.';
        });
    }

    private async perform(action: () => Promise<void>) {
        if (this.busy) return;
        this.busy = true;
        this.error = this.notice = '';
        try { await action(); }
        catch (error) { this.error = error.error?.message || 'Could not update tournament participants. Try again.'; }
        finally { this.busy = false; }
    }
}

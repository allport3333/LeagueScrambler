import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PlayerService } from './services/player.service';

interface Participant { id: number; firstName: string; lastName: string; present?: boolean; }
@Component({
    selector: 'app-tournament-participants',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule],
    styles: [`
        .actions, li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
        ul { list-style: none; margin: 8px 0; padding: 0; }
        li, details { border: 1px solid var(--hub-border, #bcc6d2); border-radius: 5px; padding: 8px; margin-block: 6px; background: var(--hub-surface, #fff); }
        .sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr)); gap: 16px; }
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
                <form (ngSubmit)="searchPlayers()">
                    <label>Search Existing Players <input class="form-control" type="search" name="query" [(ngModel)]="query"></label>
                    <button class="btn btn-primary" [disabled]="busy || query.trim().length < 2">Search</button>
                </form>
                <ul>
                @for (player of found; track player.id) {
                    <li>{{ player.firstName }} {{ player.lastName }}
                        <button type="button" class="btn btn-primary" [disabled]="busy || hasPlayer(player.id)"
                            (click)="add(player)">{{ hasPlayer(player.id) ? 'Added' : 'Add' }}</button>
                    </li>
                }
                </ul>
                <details>
                    <summary>Register a New Player</summary>
                    <form (ngSubmit)="register()" #form="ngForm">
                        <label>First Name <input class="form-control" name="firstName" maxlength="100" required [(ngModel)]="firstName"></label>
                        <label>Last Name <input class="form-control" name="lastName" maxlength="100" required [(ngModel)]="lastName"></label>
                        <label>Gender <select class="form-control" name="gender" required [(ngModel)]="gender">
                            <option value="">Select</option><option>Male</option><option>Female</option>
                        </select></label>
                        <button class="btn btn-primary" [disabled]="form.invalid || busy">Register and Add</button>
                    </form>
                </details>
            </section>
            <section>
                <h3>Tournament Roster</h3>
                <ul>
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
    found: Participant[] = [];
    query = '';
    firstName = '';
    lastName = '';
    gender = '';
    mode = 0;
    busy = false;
    error = '';
    notice = '';
    get checkedIn() { return this.roster.filter(player => player.present).length; }
    get eligible() { return this.mode === 3 ? this.roster.length : this.mode ? this.checkedIn : 0; }

    ngOnInit() { void this.perform(() => this.reload()); }

    private request<T>(observable: import('rxjs').Observable<T>) {
        return firstValueFrom(observable.pipe(takeUntilDestroyed(this.destroy)));
    }

    private async reload() {
        const result = await this.request(this.http.get<{roster: Participant[]; mode: number}>('/api/tournament-attendance/' + this.leagueId()));
        this.roster = result.roster;
        this.mode = result.mode;
    }

    hasPlayer(id: number) { return this.roster.some(player => player.id === id); }

    async searchPlayers() {
        if (this.query.trim().length < 2) return;
        await this.perform(async () => {
            this.found = await this.request(this.players.searchPlayers(encodeURIComponent(this.query.trim())));
            if (!this.found.length) this.notice = 'No matching players.';
        });
    }

    private async addPlayer(player: Participant) {
        await this.request(this.players.addExistingLeaguePlayer(this.leagueId(), this.tournamentName(), player.id, 0));
        await this.reload();
        this.notice = 'Participant added.';
    }

    async add(player: Participant) { await this.perform(() => this.addPlayer(player)); }

    async register() {
        await this.perform(async () => {
            const player = await this.request(this.players.addPlayerWithoutLeague({
                firstName: this.firstName.trim(), lastName: this.lastName.trim(), gender: this.gender
            }, this.leagueId()));
            await this.addPlayer(player);
            this.firstName = this.lastName = this.gender = '';
        });
    }

    async remove(player: Participant) {
        await this.perform(async () => {
            await this.request(this.http.delete('/api/tournaments/' + this.leagueId() + '/participants/' + player.id));
            await this.reload();
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

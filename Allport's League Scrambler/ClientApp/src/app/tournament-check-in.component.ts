import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterModule } from '@angular/router';

interface AttendancePlayer { id: number; firstName: string; lastName: string; present: boolean; }
interface AttendanceState {
    name: string; eventDate: string; mode: number; version: string;
    organizers: boolean; ownPlayerId: number; roster: AttendancePlayer[];
}

@Component({
    selector: 'app-tournament-check-in',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, MatButtonModule, RouterModule],
    styles: [`
        main { padding: 16px; }
        .mat-mdc-button-base { font-family: Arial, sans-serif; }
        header, .check-in-modes { text-align: center; }
        .check-in-modes { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
        .search { display: grid; gap: 4px; max-width: 340px; margin: 16px auto; }
        .roster { list-style: none; padding: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
        .roster li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px;
            padding: 8px; border: 1px solid var(--hub-border, #bcc6d2); border-radius: 6px; background: var(--hub-surface, #fff); }
        .roster button { min-height: 44px; }
    `],
    template: `
        <main>
          <header><h1>Tournament Check In</h1>
            @if (state) { <p>{{ state.name }} · {{ state.eventDate }}</p> }
          </header>
          @if (state) {
            @if (state.organizers) {
              <div class="check-in-modes">
                <a mat-button [routerLink]="['/tournament', leagueId]">Tournament Center</a>
                <button mat-stroked-button [disabled]="busy || state.mode === 1" (click)="setMode(1)">Open Player Check In</button>
                <button mat-stroked-button [disabled]="busy || state.mode === 2" (click)="setMode(2)">Check In Players Manually</button>
                <button mat-stroked-button [disabled]="busy || state.mode === 3" (click)="setMode(3)">Skip Check In</button>
              </div>
              <p class="text-center">{{ state.roster.length }} registered · {{ presentCount }} checked in · {{ state.roster.length - presentCount }} not checked in</p>
              <label class="search">Find a participant <input class="form-control" type="search" [(ngModel)]="filter"></label>
            }
            <p class="text-center">{{ modeMessage }}</p>
            <ul class="roster">
              @for (player of shownPlayers; track player.id) {
                <li><span>{{ player.firstName }} {{ player.lastName }} · {{ player.present ? 'Checked in' : 'Not checked in' }}</span>
                  @if (state.mode === 1 || (state.organizers && state.mode === 2)) {
                    <button mat-stroked-button type="button" [disabled]="busy" (click)="setPresence(player)"
                      [attr.aria-label]="(player.present ? 'Undo check-in for ' : 'Check in ') + player.firstName + ' ' + player.lastName">
                      {{ player.present ? 'Undo Check In' : 'Check In' }}
                    </button>
                  }
                </li>
              } @empty { <li>No matching participants.</li> }
            </ul>
          }
          @if (loading) { <p role="status" class="text-center">Loading check-in…</p> }
          @if (notice) { <p role="status" class="text-center">{{ notice }}</p> }
          @if (error) { <p role="alert" class="text-center">{{ error }}</p> }
        </main>
    `
})
export class TournamentCheckInComponent {
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    readonly leagueId = Number(inject(ActivatedRoute).snapshot.paramMap.get('leagueId'));
    private readonly url = '/api/tournament-attendance/' + this.leagueId;
    state: AttendanceState;
    loading = true;
    busy = false;
    error = '';
    notice = '';
    filter = '';

    constructor() { this.load(); }

    get presentCount() { return this.state.roster.filter(player => player.present).length; }
    get shownPlayers() {
        const name = this.filter.trim().toLowerCase();
        return this.state.roster.filter(player => (player.firstName + ' ' + player.lastName).toLowerCase().includes(name));
    }
    get modeMessage() {
        return ['Check-in has not been configured.', 'Players can check themselves in.',
            'Organizers are checking players in manually.', 'Check-in is skipped.'][this.state.mode];
    }

    setMode(mode: number) { this.change('/mode', { mode, version: this.state.version }, 'Check-in settings saved.'); }
    setPresence(player: AttendancePlayer) {
        this.change('/players/' + player.id, { present: !player.present }, player.present ? 'Check-in removed.' : 'Check-in confirmed.');
    }

    private load(): void {
        this.http.get<AttendanceState>(this.url).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: state => { this.state = state; this.loading = this.busy = false; },
            error: () => { this.loading = this.busy = false; this.error = 'Check-in is unavailable for this account or tournament.'; }
        });
    }

    private change(path: string, input: object, notice: string): void {
        if (this.busy) return;
        this.busy = true;
        this.error = this.notice = '';
        this.http.put(this.url + path, input).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: () => { this.notice = notice; this.load(); },
            error: error => { this.error = error.error?.message || 'The check-in change could not be saved.'; this.load(); }
        });
    }
}

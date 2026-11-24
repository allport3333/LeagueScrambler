import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LeagueService } from './services/league.service';

interface TournamentDetails {
    eventDate: string;
    description: string;
    location: string;
    version: string;
}

@Component({
    selector: 'app-tournament-center',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, MatButtonModule, RouterModule],
    styles: [`
        main { padding: 16px; }
        .mat-mdc-button-base { font-family: Arial, sans-serif; }
        header { text-align: center; }
        form {
            display: grid; gap: 12px; max-width: 580px; margin: 16px auto;
            padding: 16px; border: 1px solid var(--hub-border, #bcc6d2);
            border-radius: 6px; background: var(--hub-surface, #fff);
        }
        label { display: grid; gap: 4px; }
        nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    `],
    template: `
        <main>
          <header><h1>{{ name || 'Tournament Center' }}</h1></header>
          @if (loading) { <p role="status" class="text-center">Loading tournament…</p> }
          @if (name) {
            <nav aria-label="Tournament">
              <a mat-stroked-button routerLink="/standings" [queryParams]="{leagueId: leagueId}">View Standings</a>
              @if (leagueSelected) { <a mat-stroked-button routerLink="/league-management">Manage Participants</a> }
              @if (details.version) { <a mat-stroked-button [routerLink]="['/tournament', leagueId, 'check-in']">Player Check In</a> }
            </nav>
            <p class="text-center">{{ participants }} {{ participants === 1 ? 'participant' : 'participants' }}</p>
            <form #detailsForm="ngForm" (ngSubmit)="save()">
              <h2>Tournament Details</h2>
              <label>Tournament Name <input class="form-control" name="name" maxlength="50" required [(ngModel)]="draftName"></label>
              <label>Tournament Date <input class="form-control" name="date" type="date" required [(ngModel)]="details.eventDate"></label>
              <label>Location <input class="form-control" name="location" maxlength="120" [(ngModel)]="details.location"></label>
              <label>Description <textarea class="form-control" name="description" maxlength="500" [(ngModel)]="details.description"></textarea></label>
              <button mat-flat-button color="primary" type="submit" [disabled]="detailsForm.invalid || saving">Save Details</button>
              @if (saved) { <p role="status">Tournament details saved.</p> }
            </form>
          }
          @if (error) { <p role="alert" class="text-center">{{ error }}</p> }
        </main>
    `
})
export class TournamentCenterComponent {
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    private readonly leagueService = inject(LeagueService);
    readonly leagueId = Number(inject(ActivatedRoute).snapshot.paramMap.get('leagueId'));
    private readonly url = '/api/tournaments/' + this.leagueId;
    name = '';
    draftName = '';
    participants = 0;
    leagueSelected = false;
    details: TournamentDetails = { eventDate: '', description: '', location: '', version: null };
    loading = true;
    saving = false;
    saved = false;
    error = '';

    constructor() {
        this.http.get<{ name: string; details: TournamentDetails; participants: number }>(this.url)
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: response => {
                    this.name = response.name;
                    this.draftName = response.name;
                    this.participants = response.participants;
                    if (response.details) this.details = response.details;
                    this.loading = false;
                    this.leagueService.selectNavigationLeague(this.leagueId).pipe(takeUntilDestroyed(this.destroy))
                        .subscribe(selected => this.leagueSelected = selected);
                },
                error: () => { this.loading = false; this.error = 'This tournament is unavailable to your account.'; }
            });
    }

    save(): void {
        if (this.saving || !this.details.eventDate) return;
        this.saving = true;
        this.saved = false;
        this.error = '';
        this.http.put<{ name: string; details: TournamentDetails }>(this.url + '/details', { ...this.details, name: this.draftName })
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: response => {
                    const renamed = this.name !== response.name;
                    this.name = this.draftName = response.name;
                    this.details = response.details;
                    this.saved = true;
                    this.saving = false;
                    if (renamed) this.leagueService.getLeagues().pipe(takeUntilDestroyed(this.destroy))
                        .subscribe({ next: () => this.leagueService.setSelectedLeague(this.leagueId), error: () => {} });
                },
                error: error => {
                    this.saving = false;
                    this.error = error.error?.message || 'Tournament details could not be saved.';
                }
            });
    }
}

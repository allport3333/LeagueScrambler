import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { FacilityPickerComponent } from './facility-picker.component';

interface Assignment { venueId: number | null; name?: string; publicListing: boolean; sport?: string;
    season?: string; description?: string; directoryVisible?: boolean; leadAdminId?: number; }

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'app-event-facility',
    imports: [FormsModule, RouterLink, FacilityPickerComponent],
    styleUrl: './facility-checkbox.css',
    template: `
      @if (manage && eventId) {
        <details class="event-venue">
          <summary>Facility and Public Listing</summary>
          <app-facility-picker [(venueId)]="draft.venueId" [venueName]="current?.name" />
          <label class="facility-checkbox">
            <input type="checkbox" [(ngModel)]="draft.publicListing" [ngModelOptions]="standalone">
            <span>List this event publicly at the facility</span>
          </label>
          <label>Sport<input [(ngModel)]="draft.sport" [ngModelOptions]="standalone" maxlength="40"></label>
          <label>Season<input [(ngModel)]="draft.season" [ngModelOptions]="standalone" maxlength="80"></label>
          <label>Public description<textarea [(ngModel)]="draft.description" [ngModelOptions]="standalone" maxlength="500"></textarea></label>
          @if (leadAdmins.length) {
            <label>Lead administrator for league inquiries <select [(ngModel)]="draft.leadAdminId" [ngModelOptions]="standalone">
              <option [ngValue]="null">No fallback</option>
              @for (admin of leadAdmins; track admin.id) { <option [ngValue]="admin.id">{{ admin.name }}</option> }
            </select></label>
          }
          <button type="button" [disabled]="busy" (click)="save()">Save Facility</button>
          @if (status) { <p role="status">{{ status }}</p> }
        </details>
      } @else if (current?.venueId) {
        <p>Facility @if (current?.directoryVisible) { <a [routerLink]="['/facilities', current!.venueId]">{{ current!.name }}</a> } @else { {{ current!.name }} }</p>
      }
    `,
    styles: `
      .event-venue { margin: .75rem 0; padding: .75rem; border: 1px solid var(--hub-border, #718197); border-radius: .35rem; }
      label { display: grid; margin: .4rem 0; }
      input:not([type=checkbox]), select, textarea { width: 100%; max-width: 28rem; color: var(--hub-text, #172534); background: var(--hub-surface, #fff); }
    `
})
export class EventFacilityComponent implements OnChanges {
    @Input() eventId?: number;
    @Input() manage = false;
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    private read?: Subscription;
    readonly standalone = {standalone: true};
    leadAdmins: {id: number; name: string}[] = [];
    current?: Assignment;
    draft: Assignment = {venueId: null, publicListing: false};
    status = '';
    busy = false;

    ngOnChanges(): void {
        this.current = undefined;
        this.draft = {venueId: null, publicListing: false};
        this.status = '';
        this.load();
        if (this.manage && this.eventId) {
            this.http.get<{id: number; name: string}[]>('/api/facilities/lead-admins').pipe(takeUntilDestroyed(this.destroy))
                .subscribe({next: admins => { this.leadAdmins = admins; }, error: () => { this.leadAdmins = []; }});
        }
    }

    save(): void {
        if (!this.eventId || this.busy) return;
        const id = this.eventId;
        this.busy = true;
        this.status = '';
        this.http.put('/api/facilities/event/' + id, this.draft).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: () => { this.busy = false; if (id === this.eventId) { this.status = 'Facility saved.'; this.load(); } },
            error: error => { this.busy = false; if (id === this.eventId) this.status = error.error?.message || 'Facility could not be saved.'; }
        });
    }

    private load(): void {
        this.read?.unsubscribe();
        if (!this.eventId) return;
        this.read = this.http.get<Assignment>('/api/facilities/event/' + this.eventId)
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: response => { this.current = response; this.draft = {...response}; },
                error: error => {
                    if (error.status === 404) { this.current = undefined; this.draft = {venueId: null, publicListing: false}; }
                    else if (this.manage) this.status = 'The saved facility could not be loaded.';
                }
            });
    }
}

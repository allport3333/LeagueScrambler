import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Injectable, Input, OnChanges, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { protectPendingWork } from '../pwa/pending-work.service';
import { injectConfirmation } from '../confirmation-dialog';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LeagueService } from '../services/league.service';
import { FacilityPickerComponent } from './facility-picker.component';

interface Assignment { isActive?: boolean; eventTypeId?: number; venueId: number | null; name?: string; publicListing: boolean; sport?: string;
    season?: string; description?: string; directoryVisible?: boolean; leadAdminId?: number; }

@Injectable()
export class LeagueFacilityDraft {
    canLeave: () => boolean | Promise<boolean> = () => true;
}

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'app-event-facility',
    imports: [FormsModule, RouterLink, MatButtonModule, FacilityPickerComponent],
    styleUrls: ['./facility-checkbox.css', './facility-form.css'],
    template: `
      @if (manage && eventId) {
        <section class="event-venue" aria-label="Facility and Public Listing">
          @if (leagueName) {
            <h3>League Details</h3>
            <p class="league-name">{{ leagueName }}</p>
          } @else {
            <h3>Facility and Public Listing</h3>
          }
          @if (current) {
            <div class="setup-fields">
              <section class="setup-panel" aria-label="Primary Facility">
                <h4>Primary Facility</h4>
                <app-facility-picker [(venueId)]="draft.venueId"
                  [venueName]="draft.venueId === current.venueId ? current.name : undefined" [disabled]="busy" />
              </section>
              <section class="setup-panel" aria-label="Visibility and Status">
                <h4>Visibility and Status</h4>
                <label class="facility-checkbox">
                  <input type="checkbox" [(ngModel)]="draft.isActive" [ngModelOptions]="standalone" [disabled]="busy">
                  <span>Active {{ current.eventTypeId === 2 ? 'Tournament' : 'League' }}</span>
                </label>
                <label class="facility-checkbox">
                  <input type="checkbox" [(ngModel)]="draft.publicListing" [ngModelOptions]="standalone" [disabled]="busy || !draft.venueId">
                  <span>List this event publicly at the facility</span>
                </label>
                <p class="setup-help">{{ visibility }}</p>
              </section>
              <section class="setup-panel description-panel" aria-label="Public Description and Contact">
                <h4>Public Description and Contact</h4>
                @if (!draft.venueId) { <p class="setup-help">Select a facility to save public listing details.</p> }
                <div class="detail-fields">
                  <label class="facility-field">Sport<input class="form-control" [(ngModel)]="draft.sport"
                    [ngModelOptions]="standalone" maxlength="40" [disabled]="busy || !draft.venueId"></label>
                  <label class="facility-field">Season<input class="form-control" [(ngModel)]="draft.season"
                    [ngModelOptions]="standalone" maxlength="80" [disabled]="busy || !draft.venueId"></label>
                  <label class="facility-field description">Public description<textarea class="form-control"
                    [(ngModel)]="draft.description" [ngModelOptions]="standalone" rows="3" maxlength="500"
                    [disabled]="busy || !draft.venueId"></textarea></label>
                  @if (leadAdmins.length && current.eventTypeId !== 2) {
                    <label class="facility-field">Lead administrator for league inquiries
                      <select class="form-control" [(ngModel)]="draft.leadAdminId" [ngModelOptions]="standalone"
                        [disabled]="busy || !draft.venueId">
                        <option [ngValue]="null">No fallback</option>
                        @for (admin of leadAdmins; track admin.id) { <option [ngValue]="admin.id">{{ admin.name }}</option> }
                      </select>
                    </label>
                  }
                </div>
              </section>
            </div>
            <div class="setup-footer">
              <button mat-flat-button color="primary" type="button" [disabled]="busy || !hasUnsavedChanges"
                (click)="save()">{{ busy ? 'Saving?' : leagueName ? 'Save Changes' : 'Save Facility Settings' }}</button>
              @if (status && (failed || !hasUnsavedChanges)) { <span [attr.role]="failed ? 'alert' : 'status'">{{ status }}</span> }
              @else if (hasUnsavedChanges) { <span class="setup-help">Unsaved changes</span> }
            </div>
          } @else if (status) { <p [attr.role]="failed ? 'alert' : 'status'">{{ status }}</p> }
          @else { <p role="status">Loading facility settings?</p> }
        </section>
      } @else if (current) {
        @if (current.isActive === false) { <small>Inactive</small> }
        @if (current.venueId) { <p>Facility @if (current.directoryVisible) { <a [routerLink]="['/facilities', current.venueId]">{{ current.name }}</a> } @else { {{ current.name }} }</p> }
      }
    `,
    styles: `
      .event-venue { max-width: 62.5rem; margin: 0 auto; padding: clamp(.75rem, 2vw, 1.25rem);
        background: var(--hub-surface, #fff); border: 1px solid var(--hub-border, #b8c6d4); border-radius: .5rem; }
      h3, h4 { color: var(--hub-heading, #263849); margin: 0 0 .45rem; overflow-wrap: anywhere; }
      h3 { font-size: 1.2rem; }
      h4 { font-size: 1rem; }
      .league-name { color: var(--hub-muted, #52677c); margin: -.25rem 0 .65rem; overflow-wrap: anywhere; }
      .setup-fields, .detail-fields { display: grid; gap: .7rem 1rem; }
      .setup-panel { min-width: 0; padding: .65rem .75rem; border: 1px solid var(--hub-border, #ced8e3); border-radius: .35rem; }
      .facility-checkbox { margin-block: .55rem; }
      .setup-help { color: var(--hub-muted, #52677c); font-size: .875rem; margin: 0; }
      .detail-fields textarea { min-height: 5rem; resize: vertical; height: auto; }
      .setup-footer { display: flex; gap: .65rem; flex-wrap: wrap; align-items: center; margin-top: .75rem; }
      @media (min-width: 800px) {
        .setup-fields { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
        .description-panel, .description { grid-column: 1 / -1; }
        .detail-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `
})
export class EventFacilityComponent implements OnChanges {
    @Input() eventId?: number;
    @Input() manage = false;
    @Input() leagueName?: string;
    @Output() facilitySelected = new EventEmitter<boolean>();
    private readonly leagues = inject(LeagueService);
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    private read?: Subscription;
    readonly standalone = {standalone: true};
    leadAdmins: {id: number; name: string}[] = [];
    current?: Assignment;
    draft: Assignment = {venueId: null, publicListing: false};
    status = '';
    busy = false;
    failed = false;

    constructor() {
        protectPendingWork(() => this.busy || this.hasUnsavedChanges);
        const draft = inject(LeagueFacilityDraft, {optional: true});
        if (!draft) return;
        const confirm = injectConfirmation();
        const canLeave = () => {
            if (this.busy) return false;
            if (!this.hasUnsavedChanges) return true;
            return confirm({ title: 'Discard unsaved setup changes?',
                message: 'Your unsaved facility and public listing changes will be lost.',
                action: 'Discard Changes', tone: 'danger' });
        };
        draft.canLeave = canLeave;
        this.destroy.onDestroy(() => { if (draft.canLeave === canLeave) draft.canLeave = () => true; });
    }

    get hasUnsavedChanges(): boolean {
        return !!this.current && JSON.stringify(this.current) !== JSON.stringify(this.draft);
    }

    get visibility(): string {
        if (this.draft.isActive === false) return this.leagueName
            ? 'This league will be hidden from the active league selector and public listings. Its history is preserved.'
            : 'This tournament will stay off public listings. Its history is preserved.';
        if (!this.draft.venueId) return 'Assign a primary facility to enable a facility listing.';
        return this.draft.publicListing ? 'This active event will appear on the selected facility page.'
            : 'This active event will stay off the public facility page.';
    }

    ngOnChanges(): void {
        this.current = undefined;
        this.draft = {venueId: null, publicListing: false};
        this.status = '';
        this.failed = false;
        this.load();
        if (this.manage && this.eventId) {
            this.http.get<{id: number; name: string}[]>('/api/facilities/lead-admins').pipe(takeUntilDestroyed(this.destroy))
                .subscribe({next: admins => { this.leadAdmins = admins; }, error: () => { this.leadAdmins = []; }});
        }
    }

    save(): void {
        if (!this.eventId || this.busy || !this.hasUnsavedChanges) return;
        const id = this.eventId;
        this.busy = true;
        this.status = '';
        this.failed = false;
        this.http.put('/api/facilities/event/' + id, this.draft).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: () => { this.busy = false; if (id === this.eventId) { this.status = 'Facility and listing settings saved.'; this.current = {...this.draft}; this.load();
                this.leagues.getLeagues().pipe(takeUntilDestroyed(this.destroy)).subscribe({ error: () => {} }); } },
            error: error => { this.busy = false; if (id === this.eventId) { this.failed = true; this.status = error.error?.message || 'Changes could not be saved. Try again.'; } }
        });
    }

    private load(): void {
        this.read?.unsubscribe();
        if (!this.eventId) return;
        this.read = this.http.get<Assignment>('/api/facilities/event/' + this.eventId)
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: response => { this.current = response; this.draft = {...response}; this.facilitySelected.emit(!!response.venueId); },
                error: error => {
                    if (this.manage) { this.failed = true; this.status = 'The saved facility settings could not be loaded.'; }
                }
            });
    }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { Facility } from './facilities.component';

interface Candidate {
    sourceKey: string; source: string; name: string; address: string; city: string;
    region: string; postalCode: string; website: string; activities: string[];
    latitude?: number; longitude?: number;
}
const blank = () => ({name: '', alternateName: '', address: '', city: '', region: '', postalCode: '', country: 'United States',
    timeZone: 'America/Detroit', website: '', activities: '', source: '', sourceKey: '', latitude: null as number | null,
    longitude: null as number | null, approximateCoordinates: true, reviewed: false});

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'app-facility-review',
    imports: [FormsModule],
    template: `
      <details (toggle)="initialize($event)">
        <summary>{{ facility ? 'Edit Facility' : 'Review or Import a Facility' }}</summary>
        @if (!facility) {
          <form (ngSubmit)="lookup()">
            <h2>Search an approved public source</h2>
            <label>Name <input name="lookupName" [(ngModel)]="filters.q" maxlength="100"></label>
            <label>City and state or ZIP <input name="lookupCity" [(ngModel)]="filters.location" maxlength="100"></label>
            <label>Sport <input name="lookupSport" [(ngModel)]="filters.sport" maxlength="40"></label>
            <label>Distance <select name="radius" [(ngModel)]="filters.radius"><option>5</option><option>10</option><option>25</option></select> miles</label>
            <div><button type="submit" [disabled]="busy">Search Public Source</button>
              <button type="button" [disabled]="busy" (click)="locate()">Use My Location</button></div>
            <p><a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL</p>
            @for (candidate of candidates; track candidate.sourceKey) {
              <article>
                <strong>{{ candidate.name }}</strong>
                <p>{{ candidate.address }} {{ candidate.city }} {{ candidate.region }} {{ candidate.postalCode }}</p>
                @if (candidate.activities.length) { <p>{{ candidate.activities.join(', ') }}</p> }
                <button type="button" (click)="select(candidate)">Review {{ candidate.name }}</button>
              </article>
            }
          </form>
        }
        <form #review="ngForm" (ngSubmit)="save()">
          <h2>Reviewed Facility Details</h2>
          @for (field of fields; track field.key) {
            <label>{{ field.label }} <input [name]="field.key" [(ngModel)]="draft[field.key]" [maxlength]="field.length" [required]="field.required"></label>
          }
          <label>Latitude <input type="number" name="lat" [(ngModel)]="draft.latitude"></label>
          <label>Longitude <input type="number" name="lon" [(ngModel)]="draft.longitude"></label>
          <label class="checkbox"><input type="checkbox" name="approximate" [(ngModel)]="draft.approximateCoordinates"> Location is approximate</label>
          <label class="checkbox"><input type="checkbox" name="reviewed" [(ngModel)]="draft.reviewed" required> I reviewed these details and confirmed the activities listed.</label>
          <button type="submit" [disabled]="review.invalid || busy">Save Reviewed Facility</button>
        </form>
        @if (status) { <p role="status">{{ status }}</p> }
      </details>
    `,
    styles: `
      details { margin: 1rem auto; max-width: 48rem; padding: .8rem; border: 1px solid var(--hub-border, #718197); border-radius: .4rem; }
      form { display: grid; gap: .55rem; margin-top: .75rem; }
      h2 { font-size: 1.15rem; }
      label { display: grid; }
      .checkbox { display: flex; align-items: center; gap: .45rem; }
      input:not([type=checkbox]), select { min-height: 42px; background: var(--hub-surface, #fff); color: var(--hub-text, #172534); border: 1px solid var(--hub-border, #718197); }
      article { padding: .6rem; border: 1px solid var(--hub-border, #718197); }
      button { min-height: 42px; }
    `
})
export class FacilityReviewComponent {
    @Input() facility?: Facility;
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);
    private readonly destroy = inject(DestroyRef);
    private editingId?: number;
    readonly fields = [
        {key: 'name', label: 'Facility name', length: 100, required: true},
        {key: 'alternateName', label: 'Alternate name', length: 150, required: false},
        {key: 'address', label: 'Street address', length: 140, required: false},
        {key: 'city', label: 'City', length: 80, required: true},
        {key: 'region', label: 'State', length: 50, required: true},
        {key: 'postalCode', label: 'Postal code', length: 16, required: false},
        {key: 'country', label: 'Country', length: 50, required: true},
        {key: 'timeZone', label: 'Time zone', length: 80, required: true},
        {key: 'website', label: 'Website', length: 500, required: false},
        {key: 'activities', label: 'Verified activities (separate with |)', length: 250, required: false},
        {key: 'source', label: 'Verification source', length: 500, required: true}
    ] as const;
    filters = {q: '', location: '', sport: '', radius: '10'};
    candidates: Candidate[] = [];
    draft = blank();
    busy = false;
    status = '';

    initialize(event: Event): void {
        const facility = this.facility;
        if (!(event.target as HTMLDetailsElement).open || !facility || this.editingId === facility.id) return;
        this.editingId = facility.id;
        this.draft = {...blank(), ...facility, activities: facility.activities.join('|')};
    }

    lookup(point?: GeolocationCoordinates): void {
        if (this.busy) return;
        this.busy = true;
        this.status = '';
        let params = new HttpParams({fromObject: this.filters});
        if (point) params = params.set('latitude', point.latitude.toFixed(4)).set('longitude', point.longitude.toFixed(4));
        this.http.get<Candidate[]>('/api/facilities/lookup', {params}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: candidates => { this.busy = false; this.candidates = candidates; if (!candidates.length) this.status = 'No candidates found.'; },
            error: error => { this.busy = false; this.status = error.error?.message || 'Facility lookup is unavailable.'; }
        });
    }

    locate(): void {
        if (!navigator.geolocation) { this.status = 'Location is unavailable. Enter a city or ZIP.'; return; }
        navigator.geolocation.getCurrentPosition(position => this.lookup(position.coords),
            () => { this.status = 'Location was unavailable. Enter a city or ZIP.'; }, {timeout: 10000});
    }

    select(candidate: Candidate): void {
        this.draft = {...blank(), ...candidate, activities: '', website: candidate.website || ''};
        this.status = 'Review the candidate and enter only activities you have verified.';
    }

    save(): void {
        if (this.busy || !this.draft.reviewed) return;
        this.busy = true;
        this.status = '';
        const base = '/api/facilities/reviewed';
        const request = this.facility ? this.http.put<{id: number}>(base + '/' + this.facility.id, this.draft)
            : this.http.post<{id: number}>(base, this.draft);
        request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: result => {
                this.busy = false;
                this.status = 'Facility saved.';
                this.draft.reviewed = false;
                if (!this.facility) void this.router.navigate(['/facilities', result.id]);
            },
            error: error => { this.busy = false; this.status = error.error?.message || 'Facility could not be saved.'; }
        });
    }
}

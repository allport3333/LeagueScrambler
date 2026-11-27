import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { injectConfirmation } from '../confirmation-dialog';
import { Router } from '@angular/router';
import type { Facility } from './facilities.component';
import { FacilityConflict, FacilityMatch, FacilityMatchDraft, FacilityMatchReviewComponent } from './facility-match-review.component';

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
    imports: [FormsModule, MatButtonModule, FacilityMatchReviewComponent],
    templateUrl: './facility-review.component.html',
    styleUrls: ['./facility-checkbox.css', './facility-form.css', './facility-review.component.css']
})
export class FacilityReviewComponent {
    @Input() facility?: Facility;
    @Input() expanded = false;
    readonly saved = output<void>();
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);
    private readonly destroy = inject(DestroyRef);
    private editingId?: number;
    private readonly confirm = injectConfirmation();
    readonly groups = [
        {title: 'Facility Identity', fields: [
            {key: 'name', label: 'Facility name', length: 100, required: true, span: 3},
            {key: 'alternateName', label: 'Alternate name', length: 150, required: false, span: 3}
        ]},
        {title: 'Location', fields: [
            {key: 'address', label: 'Street address', length: 140, required: false, span: 6},
            {key: 'city', label: 'City', length: 80, required: true, span: 2},
            {key: 'region', label: 'State', length: 50, required: true, span: 2},
            {key: 'postalCode', label: 'Postal code', length: 16, required: false, span: 2},
            {key: 'country', label: 'Country', length: 50, required: true, span: 3},
            {key: 'timeZone', label: 'Time zone', length: 80, required: true, span: 3}
        ]},
        {title: 'Additional Information', fields: [
            {key: 'website', label: 'Website', length: 500, required: false, span: 6},
            {key: 'activities', label: 'Verified activities (separate with |)', length: 250, required: false, span: 6}
        ]}
    ] as const;
    filters = {q: '', location: '', sport: '', radius: '10'};
    candidates: Candidate[] = [];
    draft = blank();
    busy = false;
    status = '';
    failed = false;
    advancedOpen = false;
    private savedDraft = blank();
    conflict?: FacilityConflict;
    private distinctIdentity = '';

    get duplicateDraft(): FacilityMatchDraft {
        const {name, address, city, region, postalCode, country, alternateName, website, sourceKey,
            latitude, longitude, approximateCoordinates} = this.draft;
        return {name, address, city, region, postalCode, country, alternateName, website, sourceKey,
            latitude, longitude, approximate: approximateCoordinates, excludeId: this.facility?.id};
    }

    openExisting(match: FacilityMatch): void { void this.router.navigate(['/facilities', match.id]); }

    confirmDistinct(): void {
        this.distinctIdentity = JSON.stringify(this.duplicateDraft);
        this.conflict = undefined;
        this.status = 'Separate facility confirmed. Save to continue.';
    }

    initialize(event: Event): void {
        const facility = this.facility;
        if (!(event.target as HTMLDetailsElement).open || !facility || this.editingId === facility.id) return;
        this.editingId = facility.id;
        this.savedDraft = {...blank(), ...facility, activities: facility.activities.join('|')};
        this.draft = {...this.savedDraft};
    }

    lookup(point?: GeolocationCoordinates): void {
        if (this.busy) return;
        this.busy = true;
        this.status = '';
        this.failed = false;
        let params = new HttpParams({fromObject: this.filters});
        if (point) params = params.set('latitude', point.latitude.toFixed(4)).set('longitude', point.longitude.toFixed(4));
        this.http.get<Candidate[]>('/api/facilities/lookup', {params}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: candidates => { this.busy = false; this.candidates = candidates; if (!candidates.length) this.status = 'No candidates found.'; },
            error: error => { this.busy = false; this.failed = true; this.status = error.error?.message || 'Facility lookup is unavailable.'; }
        });
    }

    locate(): void {
        if (!navigator.geolocation) { this.status = 'Location is unavailable. Enter a city or ZIP.'; return; }
        navigator.geolocation.getCurrentPosition(position => this.lookup(position.coords),
            () => { this.status = 'Location was unavailable. Enter a city or ZIP.'; }, {timeout: 10000});
    }

    select(candidate: Candidate): void {
        this.conflict = undefined;
        this.distinctIdentity = '';
        this.draft = {...blank(), ...candidate, activities: '', website: candidate.website || ''};
        this.failed = false;
        this.status = 'Review the candidate and enter only activities you have verified.';
    }

    async cancel(form: NgForm, editor: HTMLDetailsElement): Promise<void> {
        if (this.busy) return;
        if (JSON.stringify(this.draft) !== JSON.stringify(this.savedDraft) &&
            !await this.confirm({title: 'Discard facility changes?', message: 'Unsaved facility details will be lost.',
                action: 'Discard Changes', tone: 'danger'})) return;
        this.draft = {...this.savedDraft};
        form.resetForm({...this.draft, lat: this.draft.latitude, lon: this.draft.longitude,
            approximate: this.draft.approximateCoordinates});
        this.conflict = undefined;
        this.distinctIdentity = '';
        this.status = '';
        this.failed = false;
        this.advancedOpen = false;
        editor.open = false;
    }

    save(existingId: number | undefined, form: NgForm): void {
        if (this.busy) return;
        const pointIncomplete = (this.draft.latitude == null) !== (this.draft.longitude == null);
        const advancedInvalid = !this.draft.reviewed || !this.draft.source?.trim() ||
            form.controls['lat']?.invalid || form.controls['lon']?.invalid || pointIncomplete;
        if (form.invalid || advancedInvalid) {
            form.form.markAllAsTouched();
            this.advancedOpen ||= advancedInvalid;
            this.failed = true;
            this.status = pointIncomplete ? 'Enter both latitude and longitude, or leave both blank.'
                : 'Review the required details and any highlighted fields before saving.';
            return;
        }
        this.busy = true;
        this.status = '';
        this.failed = false;
        this.conflict = undefined;
        const base = '/api/facilities/reviewed';
        const data = {...this.draft, distinctReviewed: this.distinctIdentity === JSON.stringify(this.duplicateDraft)};
        const request = existingId ? this.http.post<{id: number}>(base + '/' + existingId + '/fill-missing', data)
            : this.facility ? this.http.put<{id: number}>(base + '/' + this.facility.id, data)
            : this.http.post<{id: number}>(base, data);
        request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: result => {
                this.busy = false;
                this.status = 'Facility saved.';
                this.draft.reviewed = false;
                this.savedDraft = {...this.draft};
                if (this.facility) this.saved.emit();
                else void this.router.navigate(['/facilities', result.id]);
            },
            error: error => {
                this.busy = false;
                this.failed = true;
                if (error.status === 400) this.advancedOpen = true;
                if (error.error?.code === 'facility-match') this.conflict = error.error;
                this.status = error.error?.message || 'Facility could not be saved.';
            }
        });
    }
}

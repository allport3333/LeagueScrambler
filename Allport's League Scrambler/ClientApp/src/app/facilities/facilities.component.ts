import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, Subscription, switchMap } from 'rxjs';
import { LoginService } from '../services/login.service';
import { AuthService } from '../auth.service';
import { TournamentNotifications } from '../tournament-notifications.service';
import { FacilityReviewComponent } from './facility-review.component';
import { FacilityDuplicateAuditComponent } from './facility-duplicate-audit.component';

export interface Facility {
    id: number;
    name: string;
    address: string;
    city: string;
    region: string;
    postalCode: string;
    alternateName?: string;
    country?: string;
    timeZone?: string;
    latitude?: number;
    longitude?: number;
    approximateCoordinates?: boolean;
    website?: string;
    activities: string[];
    source?: string;
    openStreetMap?: boolean;
    distanceMiles?: number;
    approximate: boolean;
}

interface FacilityResult { facilities: Facility[]; hasMore: boolean; locationChoices: string[]; }
interface FacilityDetails {
    facility: Facility;
    events: { leagueId: number; eventType: number; name: string; sport?: string; season?: string; description?: string; date?: string; contactAvailable: boolean }[];
    pickup: { id: string; name: string; sport: string; startsUtc: string }[];
}

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [DatePipe, FormsModule, RouterLink, FacilityReviewComponent, FacilityDuplicateAuditComponent],
    templateUrl: './facilities.component.html',
    styleUrl: './facilities.component.css'
})
export class FacilitiesComponent {
    private readonly http = inject(HttpClient);
    private readonly route = inject(ActivatedRoute);
    private readonly destroy = inject(DestroyRef);
    private readonly notifications = inject(TournamentNotifications);
    private readonly auth = inject(AuthService);
    private request?: Subscription;
    private page = 0;
    filters = {q: '', location: '', radius: '25', sport: '', eventType: '', from: '', to: ''};
    facilityId = 0;
    get managing(): boolean { return this.route.snapshot.queryParamMap.get('view') === 'manage'; }
    eventId = 0;
    listing?: FacilityResult;
    details?: FacilityDetails;
    loading = false;
    error = '';
    contactLeague?: FacilityDetails['events'][number];
    contactPending = false;
    contactError = '';
    administrator = false;
    signedIn = false;
    inquiry = {name: '', email: '', subject: '', message: ''};

    constructor() {
        const login = inject(LoginService);
        this.auth.authenticationState$.pipe(switchMap(signedIn => {
            this.signedIn = signedIn === true;
            return signedIn ? login.getUsersRole().pipe(catchError(() => of(null))) : of(null);
        }), takeUntilDestroyed(this.destroy)).subscribe(response => { this.administrator = response?.role === 'Admin'; });
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params => {
            this.facilityId = Number(params.get('id'));
            this.eventId = Number(params.get('eventId'));
            this.details = undefined;
            this.contactLeague = undefined;
            if (!this.facilityId) { this.search(); return; }
            this.beginRequest();
            let query = new HttpParams().set('location', this.route.snapshot.queryParamMap.get('location') ?? '');
            if (this.eventId) query = query.set('eventId', this.eventId);
            this.request = this.http.get<FacilityDetails>('/api/facilities/' + this.facilityId, {params: query})
                .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                    next: details => { this.details = details; this.loading = false; },
                    error: error => this.showError(error, 'This facility could not be loaded.')
                });
        });
    }

    search(next = false): void {
        this.beginRequest();
        this.page = next ? this.page + 1 : 0;
        if (!next) this.listing = undefined;
        let params = new HttpParams().set('page', this.page);
        for (const [name, value] of Object.entries(this.filters)) {
            if (value.trim()) params = params.set(name, value.trim());
        }
        this.request = this.http.get<FacilityResult>('/api/facilities', {params})
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: result => {
                    this.listing = {...result, facilities: [...(this.listing?.facilities ?? []), ...result.facilities]};
                    this.loading = false;
                },
                error: error => { if (next) this.page--; this.showError(error, 'Facilities could not be loaded. Try again.'); }
            });
    }

    address(facility: Facility): string {
        return [facility.address, facility.city, [facility.region, facility.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    }

    directions(facility: Facility): string {
        return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(this.address(facility) || facility.name);
    }

    pickupTime(startsUtc: string, zone?: string): string {
        const date = new Date(startsUtc);
        try {
            return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short', timeZone: zone}).format(date);
        } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            return date.toLocaleString();
        }
    }

    startContact(event: FacilityDetails['events'][number]): void {
        this.contactLeague = event;
        this.contactError = '';
        this.inquiry = {name: '', email: '', subject: '', message: ''};
        if (this.signedIn) this.http.get<{name: string; email: string}>('/api/facilities/contact-profile')
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: profile => {
                    if (this.contactLeague !== event) return;
                    this.inquiry.name ||= profile.name;
                    this.inquiry.email ||= profile.email;
                },
                error: () => {}
            });
    }

    send(): void {
        if (!this.contactLeague || this.contactPending) return;
        this.contactPending = true;
        this.contactError = '';
        this.http.post('/api/facilities/event/' + this.contactLeague.leagueId + '/contact', this.inquiry)
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: () => {
                    this.contactPending = false;
                    this.contactLeague = undefined;
                    this.notifications.success('Your inquiry was accepted for delivery.');
                },
                error: error => {
                    this.contactPending = false;
                    this.contactError = error.status === 429 ? 'Too many inquiries. Try again later.' :
                        error.error?.message || 'The inquiry could not be accepted for delivery.';
                }
            });
    }

    private beginRequest(): void {
        this.request?.unsubscribe();
        this.loading = true;
        this.error = '';
    }

    private showError(error: {error?: {message?: string}}, fallback: string): void {
        this.loading = false;
        this.error = error.error?.message || fallback;
    }
}

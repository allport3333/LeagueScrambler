import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PickupWorkspaceComponent } from './pickup-workspace.component';
import { AuthService } from './auth.service';
import { TournamentNotifications } from './tournament-notifications.service';

interface SessionCard {
    id: string; name: string; sport: string; startsUtc: string; endsUtc: string; skill?: string;
    venue: string; city: string; region: string; timeZone: string; capacity: number | null; confirmed: number; state: number;
}
interface Venue {
    id: number; name: string; address: string; city: string; region: string; postalCode: string; country: string; timeZone: string;
}
interface Session extends Omit<SessionCard, 'venue' | 'city' | 'region' | 'timeZone'> {
    venue: Venue; organizer: string; description?: string; organizerNotes?: string; deadlineUtc?: string;
    approvalRequired: boolean; visibility: number; owner: boolean; canReopen: boolean; registration: number | null;
    registrationOpen: boolean; registrations?: {id: string; name: string; state: number}[];
}
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const durations = [60, 90, 120, 180];
const emptyForm = () => ({
    sport: 'Wallyball', name: '', date: '', time: '', startNow: false, duration: 120, customDuration: 120,
    venue: '', location: '', address: '', region: '', country: 'US', timeZone: deviceZone,
    deadlinePolicy: 'start', deadline: '',
    description: '', skill: '', organizerNotes: '', limitPlayers: false, capacity: null as number | null, visibility: 0, approvalRequired: false
});

@Component({
    selector: 'app-pickup',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, RouterLink, AsyncPipe, NgTemplateOutlet, PickupWorkspaceComponent],
    templateUrl: './pickup.component.html',
    styleUrl: './pickup.component.css'
})
export class PickupComponent implements OnInit {
    private readonly http = inject(HttpClient);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroy = inject(DestroyRef);
    private readonly notifications = inject(TournamentNotifications);
    readonly durations = [{minutes: 60, label: '1 hour'}, {minutes: 90, label: '1.5 hours'},
        {minutes: 120, label: '2 hours'}, {minutes: 180, label: '3 hours'}];
    readonly zones = [...new Set([deviceZone, 'America/Detroit', 'America/New_York', 'America/Chicago', 'America/Denver',
        'America/Los_Angeles', 'UTC', ...(Intl.supportedValuesOf?.('timeZone') ?? [])])];
    readonly signedIn = inject(AuthService).isLoggedIn$;
    readonly levels = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
    readonly statuses = ['Pending verification', 'Pending approval', 'Confirmed', 'Cancelled', 'Declined', 'Waitlisted', 'Offered'];
    sports: string[] | null = null;
    filters = { sport: '', location: '', date: '', available: false, skill: '' };
    form = emptyForm();
    venues: Venue[] = [];
    selectedVenue?: Venue;
    venueQuery = '';
    venueSearchFailed = false;
    newVenue = false;
    advancedOpen = false;
    scheduleEdited = false;
    fieldErrors: Record<string, string> = {};
    resume?: {id: string; name: string};
    shareUrl = '';
    private venueRequest = 0;
    join = { name: '', email: '' };
    session?: Session;
    sessions: SessionCard[] = [];
    id?: string;
    view = '';
    page = 0;
    hasMore = false;
    loading = true;
    busy = false;
    editing = false;
    guestForm = false;
    error = '';
    notice = '';
    private request = 0;
    private initialToken = '';
    private initialWaitlist = false;

    ngOnInit(): void {
        this.route.fragment.pipe(takeUntilDestroyed(this.destroy)).subscribe(fragment => {
            const parameters = new URLSearchParams(fragment ?? '');
            const token = parameters.get('verify');
            if (!token) return;
            this.initialToken = token;
            this.initialWaitlist = parameters.get('waitlist') === '1';
            window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
            void this.verifyIfReady();
        });
        this.route.url.pipe(takeUntilDestroyed(this.destroy)).subscribe(async () => {
            this.id = this.route.snapshot.paramMap.get('sessionId') ?? undefined;
            this.view = this.route.snapshot.data['view'] ?? '';
            this.session = undefined;
            this.editing = false;
            this.guestForm = false;
            this.notice = '';
            this.shareUrl = '';
            this.resetCreation();
            if (this.sports == null && !await this.loadCatalog()) return;
            if (this.view === 'create') void this.searchVenues();
            await this.load();
            await this.verifyIfReady();
        });
    }

    private async verifyIfReady(): Promise<void> {
        if (!this.session || !this.initialToken || this.busy) return;
        const token = this.initialToken;
        this.initialToken = '';
        const waitlist = this.initialWaitlist;
        this.initialWaitlist = false;
        await this.act(async () => {
            await firstValueFrom(this.http.post(this.sessionUrl('/verify'), {token, waitlist}));
            await this.load();
            this.notice = 'Email verified.';
        });
    }

    private async loadCatalog(): Promise<boolean> {
        try { this.sports = await firstValueFrom(this.http.get<string[]>('/api/pickup/catalog')); return true; }
        catch { this.error = 'Pickup Games is unavailable here.'; this.loading = false; return false; }
    }

    private async loadResume(request: number): Promise<void> {
        this.resume = undefined;
        try {
            const id = sessionStorage.getItem('pickup-current-session');
            if (!id) return;
            const sessions = await firstValueFrom(this.http.get<{id: string; name: string}[]>('/api/pickup/selector'));
            if (request === this.request) this.resume = sessions.find(session => session.id === id);
        } catch { /* Discovery remains available when signed out or storage is unavailable. */ }
    }

    sessionTime(game: Session): string {
        const zone = game.venue.timeZone;
        const time = new Intl.DateTimeFormat(undefined, {timeZone: zone, timeStyle: 'short'});
        return this.format(game.startsUtc, zone) + ' to ' + time.format(new Date(game.endsUtc));
    }

    venueZoneLabel(venue: Venue): string {
        const zone = venue.timeZone;
        if (zone === 'America/Detroit' || (zone === 'America/New_York' && /^(MI|Michigan)$/i.test(venue.region)))
            return 'Detroit (Eastern Time)';
        const name = new Intl.DateTimeFormat(undefined, {timeZone: zone, timeZoneName: 'longGeneric'})
            .formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value;
        return name || this.zoneLabel(zone);
    }

    async load(page = 0): Promise<void> {
        const request = ++this.request;
        this.loading = true;
        this.error = '';
        this.page = page;
        try {
            if (this.id) {
                const session = await firstValueFrom(this.http.get<Session>(this.sessionUrl()));
                if (request === this.request) {
                    this.session = session;
                    if (session.owner && [1, 2].includes(session.state)) {
                        try { sessionStorage.setItem('pickup-current-session', session.id); } catch { /* Optional resume. */ }
                    }
                }
            } else if (this.view === 'mine') {
                this.sessions = await firstValueFrom(this.http.get<SessionCard[]>('/api/pickup/mine'));
            } else if (this.view === 'find') {
                let params = new HttpParams().set('page', page);
                for (const [key, value] of Object.entries(this.filters)) if (value) params = params.set(key, value);
                const result = await firstValueFrom(this.http.get<{sessions: SessionCard[]; hasMore: boolean}>('/api/pickup/sessions', {params}));
                if (request === this.request) {
                    this.sessions = result.sessions;
                    this.hasMore = result.hasMore;
                }
            } else if (!this.view) {
                await this.loadResume(request);
            }
        } catch (error) {
            if (request === this.request) this.error = error.status === 404 ? 'This session is unavailable.' :
                error.status === 401 ? 'Sign in to view your sessions.' : this.describeError(error);
        } finally { if (request === this.request) this.loading = false; }
    }

    async save(): Promise<void> {
        this.fieldErrors = {};
        this.error = '';
        this.validateCreation();
        if (Object.keys(this.fieldErrors).length) return;
        const data = this.payload();
        await this.act(async () => {
            if (this.editing) {
                await firstValueFrom(this.http.put(this.sessionUrl(), data));
                this.editing = false;
                await this.load();
                this.notice = 'Session updated.';
            } else {
                const result = await firstValueFrom(this.http.post<{id: string}>('/api/pickup/sessions', data));
                await this.router.navigate(['/pickup', result.id]);
                this.notifications.success('Your pickup game is ready!');
            }
        });
    }

    edit(session: Session): void {
        this.resetCreation();
        this.selectedVenue = session.venue;
        const [date, time] = this.localInput(session.startsUtc, session.venue.timeZone).split('T');
        const minutes = Math.round((Date.parse(session.endsUtc) - Date.parse(session.startsUtc)) / 60000);
        const deadline = session.deadlineUtc && Date.parse(session.deadlineUtc);
        this.form = {
            ...emptyForm(), sport: session.sport, name: session.name, date, time,
            duration: durations.includes(minutes) ? minutes : 0, customDuration: minutes,
            description: session.description ?? '', skill: session.skill ?? '', organizerNotes: session.organizerNotes ?? '',
            limitPlayers: session.capacity != null, capacity: session.capacity, visibility: session.visibility, approvalRequired: session.approvalRequired,
            deadlinePolicy: deadline > Date.parse(session.startsUtc) ? 'end' : deadline && deadline < Date.parse(session.startsUtc) ? 'custom' : 'start',
            deadline: deadline ? this.localInput(session.deadlineUtc, session.venue.timeZone) : ''
        };
        this.scheduleEdited = true;
        this.editing = true;
    }

    private resetCreation(): void {
        this.form = emptyForm();
        this.selectedVenue = undefined;
        this.newVenue = false;
        this.venueQuery = '';
        this.scheduleEdited = false;
        this.fieldErrors = {};
        this.advancedOpen = false;
        this.setDefaultStart();
    }

    private setDefaultStart(): void {
        const halfHour = 30 * 60000;
        const instant = new Date(Math.ceil((Date.now() + 15 * 60000) / halfHour) * halfHour);
        [this.form.date, this.form.time] = this.localInput(instant.toISOString(), this.venueTimeZone).split('T');
        if (this.localInstant(this.startLocal, this.venueTimeZone) == null) {
            [this.form.date, this.form.time] = this.localInput(new Date(instant.getTime() + 2 * 3600000).toISOString(),
                this.venueTimeZone).split('T');
        }
    }

    async searchVenues(): Promise<void> {
        const sequence = ++this.venueRequest;
        this.venueSearchFailed = false;
        try {
            const results = await firstValueFrom(this.http.get<Venue[]>('/api/pickup/venues', {params: {q: this.venueQuery}}));
            if (sequence === this.venueRequest) this.venues = results;
        } catch {
            if (sequence === this.venueRequest) {
                this.venues = [];
                this.venueSearchFailed = true;
            }
        }
    }

    chooseVenue(venue: Venue): void {
        this.selectedVenue = venue;
        this.newVenue = false;
        this.clearField('venue');
        if (!this.scheduleEdited) this.setDefaultStart();
    }

    changeVenue(): void {
        this.selectedVenue = undefined;
        this.newVenue = false;
        this.venueQuery = '';
        void this.searchVenues();
    }

    addVenue(): void {
        this.selectedVenue = undefined;
        this.newVenue = true;
        this.form.venue = this.venueQuery.trim().slice(0, 100);
        this.clearField('venue');
        if (!this.scheduleEdited) this.setDefaultStart();
    }

    setStartNow(value: boolean): void {
        this.form.startNow = value;
        this.form.deadlinePolicy = value ? 'end' : 'start';
        this.clearField('start');
        this.clearField('deadline');
    }

    setZone(zone: string): void {
        this.form.timeZone = zone;
        this.clearField('timeZone');
        if (!this.scheduleEdited) this.setDefaultStart();
    }

    clearField(key: string): void { delete this.fieldErrors[key]; }
    get venueTimeZone(): string { return this.selectedVenue?.timeZone ?? this.form.timeZone; }
    get capacityMax(): number { return Math.max(80, this.editing ? this.session?.capacity ?? 0 : 0); }
    get durationMinutes(): number { return this.form.duration || this.form.customDuration; }
    get startLocal(): string { return this.form.date && this.form.time ? this.form.date + 'T' + this.form.time : ''; }

    zoneLabel(zone: string): string { return zone.replace(/_/g, ' ').split('/').reverse().join(' ? '); }
    facilityLocation(venue: Venue): string {
        return [venue.city, [venue.region, venue.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    }

    get endPreview(): string {
        const start = this.form.startNow ? Date.now() : this.localInstant(this.startLocal, this.venueTimeZone);
        const end = new Date((start ?? NaN) + this.durationMinutes * 60000);
        if (!this.durationMinutes || Number.isNaN(end.getTime())) return '';
        return this.format(end.toISOString(), this.venueTimeZone);
    }

    private validateCreation(): void {
        if (!this.selectedVenue && (!this.newVenue || !this.form.venue.trim())) this.fieldErrors['venue'] = 'Select a facility or add a new one.';
        if (this.newVenue && !this.form.location.trim()) this.fieldErrors['location'] = 'Enter a city or ZIP code.';
        if (this.form.limitPlayers && (!Number.isInteger(this.form.capacity) || this.form.capacity < 2 || this.form.capacity > this.capacityMax)) {
            this.advancedOpen = true;
            this.fieldErrors['capacity'] = 'Maximum players must be between 2 and ' + this.capacityMax + '.';
        }
        if (!Number.isInteger(this.durationMinutes) || this.durationMinutes < 1) {
            this.advancedOpen = true;
            this.fieldErrors['duration'] = 'Enter a duration of at least one minute.';
        }
        const start = this.form.startNow ? Date.now() : this.localInstant(this.startLocal, this.venueTimeZone);
        const unchanged = this.editing && this.startLocal === this.localInput(this.session.startsUtc, this.venueTimeZone);
        if (start == null || (start <= Date.now() && !this.form.startNow && !unchanged))
            this.fieldErrors['start'] = 'Choose an unambiguous future start time, or use Start Now.';
        if (this.form.deadlinePolicy === 'custom') {
            const deadline = this.localInstant(this.form.deadline, this.venueTimeZone);
            if (deadline == null || (start != null && deadline > start)) {
                this.advancedOpen = true;
                this.fieldErrors['deadline'] = 'Choose a registration deadline no later than the start, or allow late joining.';
            }
        }
    }

    private payload() {
        const form = this.form;
        const location = form.location.trim();
        const postal = /^\d{5}(?:-\d{4})?$/.test(location);
        return {
            sport: form.sport, name: form.name, start: form.startNow ? null : this.startLocal,
            startNow: form.startNow, durationMinutes: this.durationMinutes, capacity: form.limitPlayers ? form.capacity : null,
            venueId: this.selectedVenue?.id, venue: form.venue, city: postal ? '' : location,
            postalCode: postal ? location : '', address: form.address, region: form.region,
            country: form.country, timeZone: this.venueTimeZone,
            description: form.description, skill: form.skill, organizerNotes: form.organizerNotes,
            visibility: form.visibility, approvalRequired: form.approvalRequired,
            lateJoinUntilEnd: form.deadlinePolicy === 'end',
            deadline: form.deadlinePolicy === 'custom' ? form.deadline : null
        };
    }

    private localInstant(value: string, zone: string): number | null {
        if (!value) return null;
        const wall = Date.parse(value + ':00Z');
        if (!Number.isFinite(wall)) return null;
        const matching = new Set<number>();
        // Test offsets on both sides of the local day to reject skipped or repeated DST times.
        for (const offset of [-24, 0, 24]) {
            const sample = wall + offset * 3600000;
            const formatted = this.localInput(new Date(sample).toISOString(), zone);
            const candidate = wall + sample - Date.parse(formatted + ':00Z');
            if (this.localInput(new Date(candidate).toISOString(), zone) === value) matching.add(candidate);
        }
        return matching.size === 1 ? [...matching][0] : null;
    }

    async copyInvitation(): Promise<void> {
        this.shareUrl = new URL('/pickup/' + this.id, window.location.origin).href;
        try {
            await navigator.clipboard.writeText(this.shareUrl);
            this.notice = 'Invitation link copied.';
        } catch {
            this.notice = 'Copy the invitation link below.';
        }
    }

    async sendGuestLink(): Promise<void> {
        await this.act(async () => {
            await firstValueFrom(this.http.post(this.sessionUrl('/guest' + (this.sessionFull ? '?waitlist=true' : '')), this.join));
            this.guestForm = false;
            this.join = { name: '', email: '' };
            this.notice = 'Check your email for a verification link.';
        });
    }

    async change(action: string, data = {}): Promise<void> {
        await this.act(async () => {
            await firstValueFrom(this.http.post(this.sessionUrl('/' + action), data));
            await this.load();
            if (action === 'leave') this.notice = 'Registration cancelled.';
        });
    }

    get registered(): boolean { return [1, 2, 5].includes(this.session?.registration); }
    get sessionFull(): boolean { return this.session?.capacity != null && this.session.confirmed >= this.session.capacity; }
    get joinLabel(): string { return this.sessionFull ? 'Join Waitlist' : 'Join Session'; }

    format(value: string, zone: string): string {
        return new Intl.DateTimeFormat(undefined, { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    }

    private localInput(value: string, zone: string): string {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
            timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
        return parts['year'] + '-' + parts['month'] + '-' + parts['day'] + 'T' + parts['hour'] + ':' + parts['minute'];
    }

    private async act(action: () => Promise<void>): Promise<void> {
        if (this.busy) return;
        this.busy = true;
        this.notice = this.error = '';
        try { await action(); }
        catch (error) {
            const field = error.error?.field;
            if (field && (this.editing || this.view === 'create')) {
                this.fieldErrors[field] = this.describeError(error);
                if (['deadline', 'timeZone', 'visibility', 'capacity', 'duration'].includes(field)) this.advancedOpen = true;
            } else this.error = this.describeError(error);
        }
        finally { this.busy = false; }
    }
    private sessionUrl(suffix = ''): string { return '/api/pickup/sessions/' + this.id + suffix; }
    private describeError(error: any): string {
        return error.error?.message || Object.values<string[]>(error.error?.errors ?? {})[0]?.[0] || (error.status === 429 ? 'Too many requests. Try again in a few minutes.' :
            error.status === 401 ? 'Sign in to continue.' : 'The request could not be completed. Try again.');
    }
}

import { AsyncPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

interface SessionCard {
    id: string; name: string; sport: string; startsUtc: string; endsUtc: string; skill?: string;
    venue: string; city: string; region: string; timeZone: string; capacity: number; confirmed: number; state: number;
}
interface Venue {
    name: string; address: string; city: string; region: string; postalCode: string; country: string; timeZone: string;
}
interface Session extends Omit<SessionCard, 'venue' | 'city' | 'region' | 'timeZone'> {
    venue: Venue; organizer: string; description?: string; organizerNotes?: string; deadlineUtc?: string;
    approvalRequired: boolean; visibility: number; owner: boolean; registration: number | null;
    registrationOpen: boolean; registrations?: {id: string; name: string; state: number}[];
}
const emptyForm = () => ({
    name: '', sport: 'Wallyball', venue: '', address: '', city: '', region: '', postalCode: '', country: 'US',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, start: '', end: '', deadline: '',
    description: '', skill: '', organizerNotes: '', capacity: 16, visibility: 0, approvalRequired: false
});

@Component({
    selector: 'app-pickup',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FormsModule, RouterLink, AsyncPipe],
    templateUrl: './pickup.component.html',
    styleUrl: './pickup.component.css'
})
export class PickupComponent implements OnInit {
    private readonly http = inject(HttpClient);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroy = inject(DestroyRef);
    readonly signedIn = inject(AuthService).isLoggedIn$;
    readonly levels = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
    readonly statuses = ['Pending verification', 'Pending approval', 'Confirmed', 'Cancelled', 'Declined', 'Waitlisted', 'Offered'];
    sports: string[] | null = null;
    filters = { sport: '', location: '', date: '', available: false, skill: '' };
    form = emptyForm();
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

    ngOnInit(): void {
        this.route.fragment.pipe(takeUntilDestroyed(this.destroy)).subscribe(fragment => {
            const token = new URLSearchParams(fragment ?? '').get('verify');
            if (!token) return;
            this.initialToken = token;
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
            this.form = emptyForm();
            if (this.sports == null && !await this.loadCatalog()) return;
            await this.load();
            await this.verifyIfReady();
        });
    }

    private async verifyIfReady(): Promise<void> {
        if (!this.session || !this.initialToken || this.busy) return;
        const token = this.initialToken;
        this.initialToken = '';
        await this.act(async () => {
            await firstValueFrom(this.http.post(this.sessionUrl('/verify'), {token}));
            await this.load();
            this.notice = 'Email verified.';
        });
    }

    private async loadCatalog(): Promise<boolean> {
        try { this.sports = await firstValueFrom(this.http.get<string[]>('/api/pickup/catalog')); return true; }
        catch { this.error = 'Pickup Games is unavailable here.'; this.loading = false; return false; }
    }

    async load(page = 0): Promise<void> {
        const request = ++this.request;
        this.loading = true;
        this.error = '';
        this.page = page;
        try {
            if (this.id) {
                const session = await firstValueFrom(this.http.get<Session>(this.sessionUrl()));
                if (request === this.request) this.session = session;
            } else if (this.view === 'mine') {
                this.sessions = await firstValueFrom(this.http.get<SessionCard[]>('/api/pickup/mine'));
            } else if (!this.view) {
                let params = new HttpParams().set('page', page);
                for (const [key, value] of Object.entries(this.filters)) if (value) params = params.set(key, value);
                const result = await firstValueFrom(this.http.get<{sessions: SessionCard[]; hasMore: boolean}>('/api/pickup/sessions', {params}));
                if (request === this.request) {
                    this.sessions = result.sessions;
                    this.hasMore = result.hasMore;
                }
            }
        } catch (error) {
            if (request === this.request) this.error = error.status === 404 ? 'This session is unavailable.' :
                error.status === 401 ? 'Sign in to view your sessions.' : this.describeError(error);
        } finally { if (request === this.request) this.loading = false; }
    }

    async save(): Promise<void> {
        await this.act(async () => {
            if (this.editing) {
                await firstValueFrom(this.http.put(this.sessionUrl(), this.form));
                this.editing = false;
                await this.load();
                this.notice = 'Session updated.';
            } else {
                const result = await firstValueFrom(this.http.post<{id: string}>('/api/pickup/sessions', this.form));
                await this.router.navigate(['/pickup', result.id]);
            }
        });
    }

    edit(session: Session): void {
        const venue = session.venue;
        this.form = {
            ...emptyForm(), ...session, ...venue, name: session.name, venue: venue.name,
            start: this.localInput(session.startsUtc, venue.timeZone), end: this.localInput(session.endsUtc, venue.timeZone),
            deadline: session.deadlineUtc ? this.localInput(session.deadlineUtc, venue.timeZone) : ''
        };
        this.editing = true;
    }

    async sendGuestLink(): Promise<void> {
        await this.act(async () => {
            await firstValueFrom(this.http.post(this.sessionUrl('/guest'), this.join));
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
            if (action === 'cancel') { this.confirmCancel = false; this.notice = 'Session cancelled.'; }
        });
    }

    confirmCancel = false;
    get registered(): boolean { return this.session?.registration === 1 || this.session?.registration === 2; }

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
        catch (error) { this.error = this.describeError(error); }
        finally { this.busy = false; }
    }
    private sessionUrl(suffix = ''): string { return '/api/pickup/sessions/' + this.id + suffix; }
    private describeError(error: any): string {
        return error.error?.message || (error.status === 429 ? 'Too many requests. Try again in a few minutes.' :
            error.status === 401 ? 'Sign in to continue.' : 'The request could not be completed. Try again.');
    }
}

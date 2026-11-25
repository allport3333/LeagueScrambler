import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ConnectedPosition, Overlay } from '@angular/cdk/overlay';
import { AppearanceComponent } from '../appearance.component';
import { onLeagueResume } from '../pwa/pending-work.service';
import { Component, OnInit, OnDestroy, AfterViewInit, DoCheck, ViewChild, ElementRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { LoginService } from '../services/login.service';
import { NavigationStart, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { LeagueService } from '../services/league.service';
import { Leagues } from '../data-models/leagues.model';
import { forkJoin, of, throwError, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

const eventTypes = [
    { id: 1, title: 'Leagues', label: 'League', icon: 'groups' },
    { id: 2, title: 'Tournaments', label: 'Tournament', icon: 'emoji_events' },
    { id: 3, title: 'Pickup Games', label: 'Pickup', icon: 'sports_volleyball' },
];
const unclassified = { id: 0, title: 'Other events', label: 'Event', icon: 'event' };

interface NavLink {
    label: string;
    icon: string;
    route?: string | (string | number)[];
    queryParams?: Record<string, string | number>;
    action?: 'appearance' | 'logout';
}

interface NavItem extends NavLink {
    children?: NavLink[];
    roles?: string[];
    signedInOnly?: boolean;
    featured?: boolean;
}

@Component({
    selector: 'app-nav-menu',
    templateUrl: './nav-menu.component.html',
    styleUrls: ['./nav-menu.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class NavMenuComponent implements OnInit, OnDestroy, AfterViewInit, DoCheck {
    // Presentation metadata only: these are the existing routes and visibility rules.
    readonly destinations: NavItem[] = [
        { route: '/', label: 'Home', icon: 'home' },
        { route: '/scrambler', label: 'Scrambler', icon: 'shuffle', roles: ['Admin', 'Manager'] },
        { route: '/team-scores', label: 'Teams & Scores', icon: 'group', roles: ['Admin', 'Manager'] },
        { route: '/league-dashboard', label: 'League Dashboard', icon: 'dashboard', roles: ['Admin', 'Manager', 'Player'] },
        { route: '/standings', label: 'King & Queen', icon: 'emoji_events', roles: ['Admin', 'Manager', 'Player'], children: [
            { route: '/standings', label: 'Standings', icon: 'emoji_events' },
            { route: '/kqmatchups', label: 'Matchups', icon: 'view_list' }
        ] },
        { route: '/fetch-data', label: 'Players', icon: 'people', signedInOnly: true },
        { route: '/sign-in', label: 'Sign In Sheet', icon: 'how_to_reg', signedInOnly: true },
        { label: 'Manage', icon: 'settings', roles: ['Admin', 'Manager'], children: [
            { route: '/league-management', label: 'League Management', icon: 'settings' }
        ] }
    ];

    pickupEnabled = false;
    get inPickup(): boolean { return this.pickupEnabled && /^\/pickup(?:[/?#]|$)/.test(this.router.url); }

    get primaryDestinations(): NavItem[] {
        const tournament = this.leagues?.find(event => event.id === this.selectedLeagueId && event.eventTypeId === 2);
        const items = this.destinations.filter(item =>
            (!tournament || (item.label !== 'Manage' && !['/sign-in', '/team-scores', '/league-dashboard', '/scrambler'].some(route => route === item.route))) &&
            (!item.signedInOnly || (this.authenticationChecked && this.loggedIn)) &&
            (!item.roles || item.roles.includes(this.userRole)))
            .filter(item => !item.children || item.children.length)
            .map(item => item.children?.length === 1 ? item.children[0] : item);
        if (this.inPickup) return items.filter(item => item.route === '/');
        if (tournament && this.loggedIn) {
            const standings = items.findIndex(item => item.route === '/standings');
            if (standings >= 0) items[standings] = {
                label: 'Standings', icon: 'emoji_events', route: '/standings', queryParams: { leagueId: this.selectedLeagueId, tournament: 1 }
            };
            const organizer = this.userRole === 'Admin' || tournament.canManageTournament;
            if (organizer) items.splice(1, 0, {
                label: 'Tournament Workspace', icon: 'emoji_events', route: ['/tournament', tournament.id]
            });
            if (!organizer && tournament.canViewTournamentRounds) items.splice(1, 0, {
                label: 'Matchups', icon: 'view_list', route: ['/tournament', this.selectedLeagueId, 'rounds']
            });
        }
        return items;
    }

    get accountDestination(): NavItem | null {
        if (!this.authenticationChecked) return null;
        const children: NavLink[] = [];
        if (this.loggedIn && this.playerId) {
            children.push({ label: 'Profile', icon: 'person', route: ['/player-stats-tabs', this.playerId], queryParams: { leagueId: this.selectedLeagueId, tab: 'kq' } });
        }
        children.push(
            { label: 'Appearance', icon: 'palette', action: 'appearance' },
            { label: 'Install Locally', icon: 'get_app', route: '/install-locally' },
            { label: 'F.A.Q.', icon: 'help_outline', route: '/faq' }
        );
        if (this.loggedIn) {
            children.push({ label: 'Change Email', icon: 'alternate_email', route: '/change-email' });
            children.push({ label: 'Logout', icon: 'exit_to_app', action: 'logout' });
        }
        return { label: 'Account', icon: 'account_circle', children };
    }

    get visibleDestinations(): NavItem[] {
        const account = this.accountDestination;
        return account ? [...this.primaryDestinations, account] : this.primaryDestinations;
    }

    compact = true;
    @ViewChild('navigationBar', { static: true }) navigationBar: ElementRef<HTMLElement>;
    @ViewChild('widthProbe', { static: true }) widthProbe: ElementRef<HTMLElement>;
    private layoutFingerprint = '';
    private layoutFrame: number = null;
    private widthObserver: ResizeObserver;
    private readonly drawerScroll = this.overlay.scrollStrategies.block();
    ngAfterViewInit() {
        this.queueLayout();
        this.widthObserver = new ResizeObserver(() => this.queueLayout());
        this.widthObserver.observe(this.navigationBar.nativeElement);
        this.widthObserver.observe(this.widthProbe.nativeElement);
    }
    ngDoCheck() {
        const fingerprint = this.visibleDestinations.map(item => item.label).join('|') + this.selectedLeagueName;
        if (fingerprint !== this.layoutFingerprint) {
            this.layoutFingerprint = fingerprint;
            this.queueLayout();
        }
    }
    private queueLayout() {
        if(this.layoutFrame!==null)return;
        this.layoutFrame=window.requestAnimationFrame(()=>this.zone.run(()=>{this.layoutFrame=null;this.measureLayout();}));
    }
    private measureLayout() {
        const bar = this.navigationBar.nativeElement;
        const style = getComputedStyle(bar);
        const leading = bar.querySelector('.event-controls, .session-status');
        const reserved = (leading?.getBoundingClientRect().width || 0) + 2 * parseFloat(style.columnGap);
        const available = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - reserved;
        // Keep a compact phone header even when the signed-out links happen to fit.
        const phoneHeaderWidth = 30 * parseFloat(getComputedStyle(document.documentElement).fontSize);
        this.compact = bar.clientWidth < phoneHeaderWidth ||
            this.widthProbe.nativeElement.getBoundingClientRect().width + 4 > available;
        if (!this.compact) this.collapse();
    }

    destinationActive(item: NavLink): boolean {
        const path = this.router.url.split(/[?#]/)[0];
        const route = Array.isArray(item.route) ? item.route.join('/') : item.route;
        if (route === '/pickup') return path === route || path.startsWith('/pickup/');
        if (path === '/schedule') return route === '/league-dashboard';
        if (path !== route) return false;
        return true;
    }

    itemActive(item: NavItem): boolean {
        return item.children ? item.children.some(child => this.destinationActive(child)) : this.destinationActive(item);
    }

    runAction(action: NavLink['action']): void {
        this.collapse();
        if (action === 'appearance') this.openAppearance();
        if (action === 'logout') this.logoutAndNavigate();
    }
    authenticationChecked = false;
    private sessionVersion = 0;
    private selectionVersion = 0;
    pickupResumeId?: string;
    private pickupResumeRequest = 0;
    eventPopup: 'categories' | 'search' | null = null;
    expandedEventType: number | null = null;
    eventSearch = '';
    @ViewChild('eventTrigger', { read: ElementRef }) eventTrigger?: ElementRef<HTMLButtonElement>;
    @ViewChild('searchTrigger', { read: ElementRef }) searchTrigger?: ElementRef<HTMLButtonElement>;
    @ViewChild('eventPanel') eventPanel?: ElementRef<HTMLElement>;
    @ViewChild('eventSearchField') eventSearchField?: ElementRef<HTMLInputElement>;
    readonly selectorPositions: ConnectedPosition[] = [
        { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 5 },
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -5 }
    ];

    eventType(event?: {eventTypeId?: number}) { return eventTypes.find(type => type.id !== 3 && type.id === event?.eventTypeId) ?? unclassified; }
    get selectedEvent() { return this.leagues.find(event => event.id === this.selectedLeagueId); }
    get eventGroups() {
        const query = this.eventPopup === 'search' ? this.eventSearch.trim().toLocaleLowerCase() : '';
        const matching = this.leagues.filter(event => event.leagueName.toLocaleLowerCase().includes(query));
        return [...eventTypes, unclassified].map(type => ({
            ...type, events: matching.filter(event => this.eventType(event).id === type.id)
        })).filter(group => group.events.length || (this.eventPopup === 'categories' && (group.id === 2 && this.loggedIn || group.id === 3 && this.pickupEnabled)));
    }

    toggleEventPopup(popup: 'categories' | 'search'): void {
        if (this.eventPopup === popup) { this.closeEventSelector(); return; }
        this.eventSearch = '';
        this.expandedEventType = this.inPickup ? 3 : this.selectedEvent ? this.eventType(this.selectedEvent).id : 2;
        this.eventPopup = popup;
        if (popup === 'categories') this.loadPickupResume();
        requestAnimationFrame(() => {
            if (this.eventPopup !== popup) return;
            const panel = this.eventPanel?.nativeElement;
            if (panel?.contains(document.activeElement)) return;
            const target = popup === 'search' ? this.eventSearchField?.nativeElement
                : panel?.querySelector<HTMLElement>('.event-category[aria-expanded=true]') ?? panel?.querySelector<HTMLElement>('.event-category');
            (target ?? panel)?.focus({ preventScroll: true });
        });
    }

    private loadPickupResume(): void {
        const version = ++this.pickupResumeRequest;
        this.pickupResumeId = undefined;
        if (!this.pickupEnabled || !this.loggedIn) return;
        let id: string | null;
        try { id = sessionStorage.getItem('pickup-current-session'); } catch { return; }
        if (!id) return;
        this.subscriptions.add(this.http.get<{id: string}[]>('/api/pickup/selector').pipe(catchError(() => of([])))
            .subscribe(sessions => {
                if (version === this.pickupResumeRequest && this.loggedIn && sessions.some(session => session.id === id))
                    this.pickupResumeId = id;
            }));
    }

    toggleEventCategory(id: number): void {
        this.expandedEventType = this.expandedEventType === id ? null : id;
    }

    onEventPopupOutside(event: MouseEvent): void {
        if (!(event.target as Element)?.closest('.event-controls')) this.closeEventSelector(false);
    }

    closeEventSelector(restoreFocus = true): void {
        if (!this.eventPopup) return;
        const trigger = this.eventPopup === 'search' ? this.searchTrigger : this.eventTrigger;
        this.eventPopup = null;
        if (restoreFocus) trigger?.nativeElement.focus({ preventScroll: true });
    }

    onSelectorKey(event: KeyboardEvent): void {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const panel = this.eventPanel?.nativeElement;
        const choices = [...(panel?.querySelectorAll<HTMLElement>('input, button, a[href]') ?? [])];
        const index = choices.indexOf(event.target as HTMLElement);
        const next = choices[index + (event.key === 'ArrowDown' ? 1 : -1)];
        if (next) {
            event.preventDefault();
            next.focus();
        }
    }
    private subscriptions = new Subscription();
    isExpanded = false;
    loggedIn = false;
    userRole: string = '';
    playerId: number | null = null;
    leagues: Leagues[] = []; // List of available leagues
    selectedLeagueId: number | null = null; // Selected league ID
    selectedLeagueName: string | null = null;

    constructor(
        private http: HttpClient,
        private loginService: LoginService,
        private router: Router,
        private authService: AuthService,
        private zone: NgZone,
        private leagueService: LeagueService,
        private overlay: Overlay,
        private dialog: MatDialog
    ) {
        onLeagueResume(() => {
            if (this.loggedIn && this.authenticationChecked) this.loadSessionContext(++this.sessionVersion, true);
        });
    }

    openAppearance(): void {
        this.collapse();
        this.dialog.open(AppearanceComponent, { width: '380px', maxWidth: 'calc(100vw - 24px)' });
    }

    collapse() {
        if (!this.isExpanded) return;
        this.isExpanded = false;
        this.drawerScroll.disable();
    }

    toggle(trigger: HTMLElement) {
        if (this.isExpanded) this.collapse();
        else {
            // Touch activation does not consistently focus the trigger before Material records it.
            trigger.focus({ preventScroll: true });
            this.isExpanded = true;
            this.drawerScroll.enable();
        }
    }

    restoreDrawerFocus(): void {
        if (!this.isExpanded && !this.dialog.openDialogs.length) {
            this.navigationBar.nativeElement.querySelector<HTMLElement>('.drawer-toggle')?.focus({ preventScroll: true });
        }
    }

    ngOnInit() {
        this.subscriptions.add(this.http.get<string[]>('/api/pickup/catalog').pipe(catchError(() => of(null)))
            .subscribe(catalog => { this.pickupEnabled = Array.isArray(catalog) && catalog.length > 0; }));
        this.subscriptions.add(this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) { this.collapse(); this.closeEventSelector(false); }
        }));
        this.subscriptions.add(this.leagueService.authorizedLeagues$.subscribe(leagues => {
            this.leagues = leagues ?? [];
        }));
        this.subscriptions.add(this.leagueService.selectedLeague$.subscribe(selected => {
            this.selectedLeagueId = selected.leagueId;
            this.selectedLeagueName = selected.leagueName;
        }));
        this.subscriptions.add(this.authService.authenticationState$.subscribe(state => {
            const version = ++this.sessionVersion;
            this.authenticationChecked = state === false;
            this.loggedIn = state === true;
            this.userRole = '';
            this.playerId = null;
            if (state !== true) {
                this.selectionVersion++; this.pickupResumeRequest++; this.pickupResumeId = undefined;
                this.closeEventSelector(false);
            }
            if (state !== true) { return; }
            this.loadSessionContext(version);
        }));
    }

    private loadSessionContext(version: number, refreshing = false): void {
        const unauthorized = error => error.status === 401 || error.status === 403;
        const fallback = (error, value) => unauthorized(error) || (refreshing && error.status !== 404)
            ? throwError(error) : of(value);
        this.subscriptions.add(forkJoin([
            this.loginService.getUsersRole().pipe(catchError(error => fallback(error, { role: '' }))),
            // An unclaimed account legitimately has no player association (404).
            this.loginService.getUsersPlayer().pipe(catchError(error => fallback(error, null))),
            this.leagueService.getLeagues().pipe(catchError(error => fallback(error, [])))
        ]).subscribe(results => {
            if (version !== this.sessionVersion) { return; }
            this.userRole = results[0].role;
            this.playerId = results[1] ? results[1].playerId : null;
            const route = this.router.parseUrl(this.router.url);
            const segments = route.root.children['primary']?.segments;
            const explicit = segments?.[0]?.path === 'tournament' && segments[1]
                ? Number(segments[1].path) : Number(route.queryParams.leagueId);
            this.leagueService.restoreLeagues(results[2], explicit > 0 ? explicit : undefined);
            this.authenticationChecked = true;
        }, error => {
            if (version === this.sessionVersion && (!refreshing || unauthorized(error))) {
                this.authService.setLoggedIn(false);
            }
        }));
    }

    ngOnDestroy() {
        if(this.layoutFrame!==null)window.cancelAnimationFrame(this.layoutFrame);
        if(this.widthObserver)this.widthObserver.disconnect();
        this.collapse();
        this.sessionVersion++;
        this.subscriptions.unsubscribe();
    }
    async onLeagueChange(leagueId: number): Promise<void> {
        const event = this.leagues.find(league => league.id === leagueId);
        this.closeEventSelector();
        if (!event || (leagueId === this.selectedLeagueId && !this.inPickup)) return;
        const version = ++this.selectionVersion;
        const isTournament = event.eventTypeId === 2;
        const canManage = this.userRole === 'Admin' || event.canManageTournament;
        const destination = !isTournament
            ? this.router.createUrlTree(['/league-dashboard'], { queryParams: { leagueId } })
            : canManage ? this.router.createUrlTree(['/tournament', leagueId])
                : event.canViewTournamentRounds ? this.router.createUrlTree(['/tournament', leagueId, 'rounds'])
                    : this.router.createUrlTree(['/standings'], { queryParams: { leagueId, tournament: 1 } });
        try {
            if (await this.router.navigateByUrl(destination) && version === this.selectionVersion &&
                this.router.url === this.router.serializeUrl(destination) && this.leagues.some(league => league.id === leagueId))
                this.leagueService.setSelectedLeague(leagueId);
        } catch {
            // Keep the previous selection if the destination could not open.
        }
    }

    propagateSelectedLeague() {
        if (this.selectedLeagueId !== null) {
            this.leagueService.setSelectedLeague(this.selectedLeagueId);
        }
    }

    logoutAndNavigate() {
        this.loginService.logout().subscribe(() => {
            this.playerId = null;
            this.leagues = [];
            this.userRole = null;
            this.authService.setLoggedIn(false);
            this.router.navigate(['/']);
        });
    }
}

import { MatDialog } from '@angular/material/dialog';
import { Overlay } from '@angular/cdk/overlay';
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
        ] },
        { route: '/install-locally', label: 'Install Locally', icon: 'get_app', featured: true },
        { label: 'More', icon: 'more_horiz', children: [
            { route: '/faq', label: 'F.A.Q', icon: 'help_outline' }
        ] }
    ];

    get primaryDestinations(): NavItem[] {
        const tournament = this.leagues?.some(event => event.id === this.selectedLeagueId && event.eventTypeId === 2);
        const items = this.destinations.filter(item =>
            (!tournament || item.route !== '/sign-in') &&
            (!item.signedInOnly || (this.authenticationChecked && this.loggedIn)) &&
            (!item.roles || item.roles.includes(this.userRole)))
            .filter(item => !item.children || item.children.length)
            .map(item => item.children?.length === 1 ? item.children[0] : item);
        if (tournament && this.loggedIn) {
            const organizer = this.userRole === 'Admin' || this.userRole === 'Manager';
            items.splice(1, 0, organizer
                ? { label: 'Tournament Center', icon: 'emoji_events', route: ['/tournament', this.selectedLeagueId] }
                : { label: 'Tournament Check In', icon: 'how_to_reg', route: ['/tournament', this.selectedLeagueId, 'check-in'] });
        }
        return items;
    }

    get accountDestination(): NavItem | null {
        if (!this.authenticationChecked) return null;
        const children: NavLink[] = [];
        if (this.loggedIn && this.playerId) {
            children.push({ label: 'Profile', icon: 'person', route: ['/player-stats-tabs', this.playerId], queryParams: { leagueId: this.selectedLeagueId, tab: 'kq' } });
        }
        children.push({ label: 'Appearance', icon: 'palette', action: 'appearance' });
        if (this.loggedIn) {
            children.push({ label: 'Change Email', icon: 'alternate_email', route: '/change-email' });
            if (this.userRole === 'Admin') children.push({ label: 'Recovery Review', icon: 'fact_check', route: '/recovery-review' });
            children.push({ label: 'Logout', icon: 'exit_to_app', action: 'logout' });
        }
        return this.loggedIn ? { label: 'Account', icon: 'account_circle', children } : children[0];
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
        const leading = bar.querySelector('.league-selector, .session-status');
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
    private subscriptions = new Subscription();
    isExpanded = false;
    loggedIn = false;
    userRole: string = '';
    playerId: number | null = null;
    leagues: Leagues[] = []; // List of available leagues
    selectedLeagueId: number | null = null; // Selected league ID
    selectedLeagueName: string | null = null;

    constructor(
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
        this.subscriptions.add(this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) { this.collapse(); }
        }));
        this.subscriptions.add(this.leagueService.selectedLeague$.subscribe(selected => {
            if (this.loggedIn) this.leagues = this.leagueService.leaguesAvailable;
            this.selectedLeagueId = selected.leagueId;
            this.selectedLeagueName = selected.leagueName;
        }));
        this.subscriptions.add(this.authService.authenticationState$.subscribe(state => {
            const version = ++this.sessionVersion;
            this.authenticationChecked = state === false;
            this.loggedIn = state === true;
            this.userRole = '';
            this.playerId = null;
            if (state === false) {
                this.leagues = [];
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
            this.loginService.getUserLeagues().pipe(catchError(error => fallback(error, [])))
        ]).subscribe(results => {
            if (version !== this.sessionVersion) { return; }
            this.userRole = results[0].role;
            this.playerId = results[1] ? results[1].playerId : null;
            this.leagueService.restoreLeagues(results[2]);
            this.leagues = this.leagueService.leaguesAvailable;
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
    onLeagueChange(leagueId: number) {
        const selectedLeague = this.leagues.find((league) => league.id === leagueId);
        if (selectedLeague) {
            this.selectedLeagueId = leagueId; // Update the selected league ID
            this.selectedLeagueName = selectedLeague.leagueName; // Update the name to display
            this.leagueService.setSelectedLeague(leagueId); // Update globally
        } else {
            console.error('League not found with ID:', leagueId);
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
            this.leagues = null;
            this.userRole = null;
            this.authService.setLoggedIn(false);
            this.router.navigate(['/']);
        });
    }
}

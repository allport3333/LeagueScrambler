import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { LoginService } from '../services/login.service';
import { NavigationStart, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { LeagueService } from '../services/league.service';
import { Leagues } from '../data-models/leagues.model';
import { forkJoin, of, throwError, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
    selector: 'app-nav-menu',
    templateUrl: './nav-menu.component.html',
    styleUrls: ['./nav-menu.component.css']
})
export class NavMenuComponent implements OnInit, OnDestroy {
    // Presentation metadata only: these are the existing routes and visibility rules.
    readonly destinations = [
        { route: '/', label: 'Home', icon: 'home', group: 'night', primary: true, anonymousOnly: true },
        { route: '/scrambler', label: 'Scrambler', icon: 'shuffle', group: 'night', primary: true, roles: ['Admin', 'Manager'] },
        { route: '/team-scores', label: 'Team Management', icon: 'group', group: 'night', primary: true, roles: ['Admin', 'Manager'] },
        { route: '/league-dashboard', label: 'League Dashboard', icon: 'dashboard', group: 'night', primary: true, roles: ['Admin', 'Manager', 'Player'] },
        { route: '/standings', label: 'K/Q Standings', icon: 'emoji_events', group: 'results', primary: true, roles: ['Admin', 'Manager', 'Player'] },
        { route: '/kqmatchups', label: 'K/Q Matchups', icon: 'view_list', group: 'results', primary: true, roles: ['Admin', 'Manager', 'Player'] },
        { route: '/fetch-data', label: 'Players', icon: 'people', group: 'night', primary: false, signedInOnly: true },
        { route: '/sign-in', label: 'Sign In Sheet', icon: 'how_to_reg', group: 'night', primary: false, signedInOnly: true },
        { route: '/league-management', label: 'League Management', icon: 'settings', group: 'management', primary: false, roles: ['Admin', 'Manager'] },
        { route: '/faq', label: 'F.A.Q', icon: 'help_outline', group: 'management', primary: false }
    ];
    get visibleDestinations() {
        return this.destinations.filter(item =>
            (!item.anonymousOnly || (this.authenticationChecked && !this.loggedIn)) &&
            (!item.signedInOnly || (this.authenticationChecked && this.loggedIn)) &&
            (!item.roles || item.roles.indexOf(this.userRole) >= 0));
    }
    get primaryLinks() { return this.visibleDestinations.filter(item => item.primary); }
    get secondaryLinks() { return this.visibleDestinations.filter(item => !item.primary); }
    drawerLinks(group: string) { return this.visibleDestinations.filter(item => item.group === group); }
    trackDestination(index: number, item: { route: string }) { return item.route; }
    get secondaryPageActive(): boolean {
        return this.secondaryLinks.some(item => this.router.url.split(/[?#]/)[0] === item.route);
    }
    get profilePageActive(): boolean { return this.router.url.indexOf('/player-stats-tabs/') === 0; }
    @HostListener('window:resize') onNavigationResize() {
        if (window.innerWidth >= 1280) { this.collapse(); }
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
        private leagueService: LeagueService
    ) { }

    collapse() {
        this.isExpanded = false;
    }

    toggle() {
        this.isExpanded = !this.isExpanded;
    }

    ngOnInit() {
        this.subscriptions.add(this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) { this.collapse(); }
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
            if (state === false) {
                this.leagues = [];
            }
            if (state !== true) { return; }
            const fallback = (error, value) => error.status === 401 || error.status === 403 ? throwError(error) : of(value);
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
            }, () => {
                if (version === this.sessionVersion) { this.authService.setLoggedIn(false); }
            }));
        }));
    }

    ngOnDestroy() {
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

import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, DoCheck, ViewChild, ElementRef, NgZone } from '@angular/core';
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
export class NavMenuComponent implements OnInit, OnDestroy, AfterViewInit, DoCheck {
    // Presentation metadata only: these are the existing routes and visibility rules.
    readonly destinations = [
        { route: '/', label: 'Home', icon: 'home', group: 'night', anonymousOnly: true },
        { route: '/scrambler', label: 'Scrambler', icon: 'shuffle', group: 'night', roles: ['Admin', 'Manager'] },
        { route: '/team-scores', label: 'Team Management', icon: 'group', group: 'night', roles: ['Admin', 'Manager'] },
        { route: '/league-dashboard', label: 'League Dashboard', icon: 'dashboard', group: 'night', roles: ['Admin', 'Manager', 'Player'] },
        { route: '/standings', label: 'K/Q Standings', icon: 'emoji_events', group: 'results', roles: ['Admin', 'Manager', 'Player'] },
        { route: '/kqmatchups', label: 'K/Q Matchups', icon: 'view_list', group: 'results', roles: ['Admin', 'Manager', 'Player'] },
        { route: '/fetch-data', label: 'Players', icon: 'people', group: 'night', signedInOnly: true },
        { route: '/sign-in', label: 'Sign In Sheet', icon: 'how_to_reg', group: 'night', signedInOnly: true },
        { route: '/league-management', label: 'League Management', icon: 'settings', group: 'management', roles: ['Admin', 'Manager'] },
        { route: '/faq', label: 'F.A.Q', icon: 'help_outline', group: 'management', primary: false }
    ];
    get visibleDestinations() {
        return this.destinations.filter(item =>
            (!item.anonymousOnly || (this.authenticationChecked && !this.loggedIn)) &&
            (!item.signedInOnly || (this.authenticationChecked && this.loggedIn)) &&
            (!item.roles || item.roles.indexOf(this.userRole) >= 0));
    }
    primaryLinks: any[] = [];
    secondaryLinks: any[] = [];
    layoutReady = false;
    @ViewChild('desktopLinks') desktopLinks: ElementRef;
    @ViewChild('widthProbe') widthProbe: ElementRef;
    private layoutFingerprint = '';
    private layoutFrame: number = null;
    private widthObserver: any;
    ngAfterViewInit() {
        this.queueLayout();
        const Observer=(window as any).ResizeObserver;
        if(Observer){this.widthObserver=new Observer(()=>this.queueLayout());this.widthObserver.observe(this.desktopLinks.nativeElement);}
        const fonts=(document as any).fonts;
        if(fonts)fonts.ready.then(()=>{if(this.desktopLinks)this.queueLayout();});
    }
    ngDoCheck() {
        const fingerprint=this.visibleDestinations.map(item=>item.route+item.label+item.icon).join('|')+':'+this.authenticationChecked+':'+this.loggedIn+':'+this.selectedLeagueName;
        if(fingerprint!==this.layoutFingerprint){this.layoutFingerprint=fingerprint;this.layoutReady=false;this.queueLayout();}
    }
    private queueLayout() {
        if(this.layoutFrame!==null)return;
        this.layoutFrame=window.requestAnimationFrame(()=>this.zone.run(()=>{this.layoutFrame=null;this.measureLayout();}));
    }
    private measureLayout() {
        if(!this.desktopLinks||!this.widthProbe)return;
        const entries=this.visibleDestinations;
        const available=this.desktopLinks.nativeElement.getBoundingClientRect().width;
        if(!available)return;
        const probe=this.widthProbe.nativeElement;
        const widths=Array.from(probe.querySelectorAll('[data-measure-route]')).map((node:HTMLElement)=>node.getBoundingClientRect().width);
        if(widths.length!==entries.length){this.queueLayout();return;}
        const style=window.getComputedStyle(this.desktopLinks.nativeElement);
        const gap=parseFloat((style as any).columnGap)||2;
        const all=widths.reduce((sum,width)=>sum+width,0)+gap*Math.max(0,widths.length-1);
        let count=entries.length;
        if(all>available-4){
            const more=probe.querySelector('[data-measure-more]').getBoundingClientRect().width;
            const budget=available-more-gap-4;let used=0;count=0;
            for(const width of widths){const next=used+(count?gap:0)+width;if(next>budget)break;used=next;count++;}
        }
        this.primaryLinks=entries.slice(0,count);this.secondaryLinks=entries.slice(count);this.layoutReady=true;
    }
    drawerLinks(group: string) { return this.visibleDestinations.filter(item => item.group === group); }
    trackDestination(index: number, item: { route: string }) { return item.route; }
    get secondaryPageActive(): boolean {
        return this.secondaryLinks.some(item => this.router.url.split(/[?#]/)[0] === item.route);
    }
    get profilePageActive(): boolean { return this.router.url.indexOf('/player-stats-tabs/') === 0; }
    @HostListener('window:resize') onNavigationResize() {
        if (window.innerWidth >= 1024) { this.collapse(); }
        this.queueLayout();
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
        if(this.layoutFrame!==null)window.cancelAnimationFrame(this.layoutFrame);
        if(this.widthObserver)this.widthObserver.disconnect();
        this.desktopLinks=null;
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

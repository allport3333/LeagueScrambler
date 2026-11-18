import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LeagueService } from '../services/league.service';
import { StatisticsService } from '../services/statistics.service';
@Component({ selector: 'app-player-stats-tabs', templateUrl: './player-stats-tabs.component.html', styleUrls: ['./player-stats-tabs.component.css', './profile-statistics.shared.css'] })
export class PlayerStatsTabsComponent implements OnInit, OnDestroy {
    playerId: number; selectedLeagueId: number; selectedLeagueName: string;
    player: any = null; loading = false; error = ''; leagueError = ''; activeTab = 0;
    private subscriptions = new Subscription(); private version = 0; private key = ''; private resolvingLeague = false;
    private invalidLeagueRequest = false;
    get selectingLeague(): boolean { return this.resolvingLeague; }
    readonly tabKeys = ['kq', 'team', 'player'];
    constructor(private route: ActivatedRoute, private router: Router, private leagues: LeagueService, private stats: StatisticsService) { }
    ngOnInit() {
        this.subscriptions.add(this.route.params.subscribe(params => { this.playerId = Number(params.playerId); this.loadHeader(); }));
        this.subscriptions.add(this.route.queryParams.subscribe(params => {
            this.activeTab = Math.max(0, this.tabKeys.indexOf(params.tab || 'kq'));
            if (params.leagueId !== undefined && Number(params.leagueId) !== this.selectedLeagueId) {
                const requested = Number(params.leagueId);
                if (!Number.isInteger(requested) || requested <= 0) { this.invalidLeagueRequest = true; this.leagueError = 'The requested league is invalid.'; return; }
                this.invalidLeagueRequest = false;
                this.resolvingLeague = true;
                this.subscriptions.add(this.leagues.selectNavigationLeague(requested).subscribe(found => {
                    this.resolvingLeague = false; this.invalidLeagueRequest = !found; this.leagueError = found ? '' : 'The requested league is unavailable.';
                    if (found) { this.syncUrl(); this.loadHeader(); }
                }, () => { this.resolvingLeague = false; this.invalidLeagueRequest = true; this.leagueError = 'Unable to select the requested league.'; }));
            }
        }));
        this.subscriptions.add(this.leagues.selectedLeague$.subscribe(selected => {
            if (this.invalidLeagueRequest && this.selectedLeagueId && selected.leagueId && this.selectedLeagueId !== selected.leagueId) { this.invalidLeagueRequest = false; }
            this.selectedLeagueId = selected.leagueId; this.selectedLeagueName = selected.leagueName;
            if (!this.resolvingLeague && !this.invalidLeagueRequest) { this.leagueError = ''; this.syncUrl(); }
            this.loadHeader();
        }));
    }
    selectTab(index: number) { this.activeTab = index; this.syncUrl(); }
    private syncUrl() {
        if (!this.selectedLeagueId || !this.playerId || this.resolvingLeague) { return; }
        const current = this.route.snapshot.queryParams;
        if (Number(current.leagueId) === this.selectedLeagueId && current.tab === this.tabKeys[this.activeTab]) { return; }
        this.router.navigate([], { relativeTo: this.route, queryParams: { leagueId: this.selectedLeagueId, tab: this.tabKeys[this.activeTab] }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    loadHeader(force = false) {
        if (!Number.isInteger(this.playerId) || this.playerId <= 0) { this.version++; this.key = ''; this.loading = false; this.player = null; this.error = 'This player profile is unavailable.'; return; }
        const key = this.playerId + ':' + (this.selectedLeagueId || ''); if (key === this.key && !force) { return; }
        this.key = key; const version = ++this.version; this.player = null; this.loading = true; this.error = '';
        this.subscriptions.add(this.stats.getPlayerProfile(this.playerId, this.selectedLeagueId).subscribe(player => {
            if (version !== this.version) { return; } this.player = player; this.loading = false;
        }, error => { if (version !== this.version) { return; } this.loading = false; this.error = error.status === 404 ? 'This player could not be found.' : 'Unable to load this player. Please retry.'; }));
    }
    ngOnDestroy() { this.version++; this.subscriptions.unsubscribe(); }
}

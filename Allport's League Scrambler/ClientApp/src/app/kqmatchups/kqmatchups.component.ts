import { onLeagueResume } from '../pwa/pending-work.service';
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';
import { LeagueService } from '../services/league.service';
import { PlayerService } from '../services/player.service';
import { Team } from '../data-models/teams.model';
import { Player } from '../data-models/player.model';
import { KingQueenRoundScore } from '../data-models/KingQueenRoundScore';
import {latestSavedMatchupWeek, savedMatchupWeeks, compareSavedMatchupWeeks} from './latest-saved-week';

@Component({
    selector: 'app-kqmatchups',
    templateUrl: './kqmatchups.component.html',
    styleUrls: ['./kqmatchups.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class KqmatchupsComponent implements OnInit, OnDestroy {
    queriedScrambles: KingQueenTeam[] = [];
    retrievedListOfTeams: Team[] = [];
    selectedLeagueId: number;
    leagueName: string;
    selectedScramble: KingQueenTeam;
    byePlayers: Player[] = [];
    loading = false;
    message = '';
    focusedTeamId: number = null;
    focusedRoundId: number = null;
    fromStandings = false;
    fromProfile = false;
    private params: Params = {};
    private version = 0;
    private focused = false;
    private resolved = false;
    private subscriptions = new Subscription();
    private manuallySelectedWeek:number=null;
    private navigationKey='';

    constructor(public leagueService: LeagueService, public playerService: PlayerService,
        private route: ActivatedRoute, private router: Router) {
        onLeagueResume(() => {
            if (!this.selectedLeagueId || !this.leagueName || this.loading) return;
            const version = ++this.version;
            this.loading = true;
            this.subscriptions.add(this.playerService.SelectedLeagueScrambles(this.leagueName).subscribe({
                next: weeks => { if (version === this.version) this.applySavedWeeks(weeks, this.params); },
                error: () => { if (version === this.version) this.loading = false; }
            }));
        });
    }

    ngOnInit() {
        this.subscriptions.add(combineLatest(this.route.queryParams, this.leagueService.selectedLeague$).subscribe(([params, selected]) => {
            // A deliberate league change after opening a week starts normal browsing;
            // the old score URL must not force the navigation dropdown back again.
            if (params === this.params && this.selectedLeagueId && selected.leagueId
                && selected.leagueId !== this.selectedLeagueId
                && (params.leagueId===undefined || Number(params.leagueId)!==selected.leagueId)) {
                this.version++;
                this.manuallySelectedWeek=null;
                this.retrievedListOfTeams = [];
                this.router.navigate(['/kqmatchups'], { queryParams: { leagueId: selected.leagueId } });
                return;
            }
            const key=JSON.stringify({league:selected.leagueId,name:selected.leagueName,params});
            if(key===this.navigationKey)return;
            this.navigationKey=key;
            const cachedWeeks=this.selectedLeagueId===selected.leagueId?this.queriedScrambles.slice():[];
            if(this.selectedLeagueId!==selected.leagueId)this.manuallySelectedWeek=null;
            const version = ++this.version;
            this.params = params;
            this.fromStandings = params.fromStandings === '1';
            this.fromProfile = params.fromProfile === '1' && this.positiveId(Number(params.profilePlayerId));
            this.focused = this.fromStandings && params.view !== 'all';
            this.resolved = false; this.message = ''; this.retrievedListOfTeams = []; this.byePlayers = [];
            this.queriedScrambles = []; this.selectedScramble = null; this.loading = false;
            const requestedLeague = params.leagueId === undefined ? null : Number(params.leagueId);
            if (requestedLeague !== null && !this.positiveId(requestedLeague)) {
                this.message = 'The requested league is invalid.'; return;
            }
            if (requestedLeague && requestedLeague !== selected.leagueId) {
                this.loading = true;
                this.subscriptions.add(this.leagueService.selectNavigationLeague(requestedLeague).subscribe(found => {
                    if (!found && version === this.version) { this.loading = false; this.message = 'The requested league is unavailable. Select an available league and try again.'; }
                }));
                return;
            }
            if (!selected.leagueId || !selected.leagueName) { return; }
            this.selectedLeagueId = selected.leagueId; this.leagueName = selected.leagueName;
            this.loading = true;
            if(params.scrambleNumber!==undefined && cachedWeeks.some(s=>s.scrambleNumber===Number(params.scrambleNumber))){
                this.applySavedWeeks(cachedWeeks,params);return;
            }
            this.subscriptions.add(this.playerService.SelectedLeagueScrambles(this.leagueName).subscribe(result => {
                if (version !== this.version) { return; }
                this.applySavedWeeks(result,params);
            }, () => { if (version === this.version) { this.loading = false; this.message = 'Could not load saved weeks. Please try again.'; } }));
        }));
    }

    private applySavedWeeks(result:KingQueenTeam[], params:Params):void {
        this.queriedScrambles=savedMatchupWeeks(result).sort(compareSavedMatchupWeeks);
        this.loading=false;
        if(params.scrambleNumber!==undefined){
            const number=Number(params.scrambleNumber),week=this.queriedScrambles.find(s=>s.scrambleNumber===number);
            if(!this.positiveId(number)||!week){this.message='The saved week for this score is unavailable.';return;}
            this.retrieveScramble(week);
        }else if(this.fromStandings){this.message='This score link does not identify a saved week.';}
        else {
            const selected=this.queriedScrambles.find(s=>s.scrambleNumber===this.manuallySelectedWeek)||latestSavedMatchupWeek(this.queriedScrambles);
            if(selected)this.retrieveScramble(selected);
        }
    }

    ngOnDestroy() { this.version++; this.subscriptions.unsubscribe(); }
    positiveId(value: number): boolean { return Number.isInteger(value) && value > 0; }
    get singleMatchupView(): boolean { return this.focused; }
    getSortedScores(scores: KingQueenRoundScore[]): KingQueenRoundScore[] {
        return (scores || []).slice().sort((a, b) => a.roundId - b.roundId);
    }
    comparisonRows(pair: Team[]): any[] {
        const ids = Array.from(new Set<number>(pair.reduce((all,team)=>all.concat((team.kingQueenRoundScores||[]).map(score=>score.roundId)),[]))).sort((a,b)=>a-b);
        const rows:any[]=[];
        ids.forEach(roundId=>{
            const scores=pair.map(team=>(team.kingQueenRoundScores||[]).filter(score=>score.roundId===roundId));
            // Retain duplicate historical round records rather than silently dropping a saved score.
            const count=Math.max.apply(null,scores.map(values=>values.length));
            for(let i=0;i<count;i++) rows.push({roundId,scores:[scores[0]&&scores[0][i],scores[1]&&scores[1][i]]});
        });
        return rows;
    }
    roundWins(team: Team): number { return (team.kingQueenRoundScores||[]).filter(score=>score.roundWon===true).length; }
    hasRoundResults(team: Team): boolean { return (team.kingQueenRoundScores||[]).some(score=>score.roundWon===true||score.roundWon===false); }
    matchNumber(pair: Team[]): number { return Math.floor((pair[0].sortingId - 1) / 2) + 1; }
    getTeamPairs(): Team[][] {
        if (this.focused && !this.resolved) { return []; }
        const pairs: Team[][] = [];
        for (let i = 0; i < this.retrievedListOfTeams.length; i += 2) {
            const pair = this.retrievedListOfTeams.slice(i, i + 2);
            if (!this.focused || pair.some(t => t.kingQueenTeamId === this.focusedTeamId)) { pairs.push(pair); }
        }
        return pairs;
    }
    isFocusedScore(team: Team, score: KingQueenRoundScore): boolean {
        return this.focused && team.kingQueenTeamId === this.focusedTeamId && score.roundId === this.focusedRoundId;
    }
    showAllMatchups() {
        this.router.navigate([], { relativeTo: this.route, queryParams: { view: 'all', playerId: null, kingQueenTeamId: null, roundId: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    chooseWeek(scramble: KingQueenTeam) {
        this.manuallySelectedWeek=scramble.scrambleNumber;
        if (this.fromStandings || this.params.scrambleNumber !== undefined) {
            this.router.navigate([], { relativeTo: this.route, queryParams: { view: 'all', scrambleNumber: scramble.scrambleNumber, playerId: null, kingQueenTeamId: null, roundId: null }, queryParamsHandling: 'merge', replaceUrl: true });
        } else { this.retrieveScramble(scramble); }
    }
    backToStandings() {
        if (this.fromProfile) {
            this.router.navigate(['/player-stats-tabs', Number(this.params.profilePlayerId)], { queryParams: { leagueId: this.selectedLeagueId || this.params.leagueId, tab: 'kq' } });
            return;
        }
        this.router.navigate(['/standings'], { queryParams: { leagueId: this.selectedLeagueId || this.params.leagueId,
            standingsMode: this.params.standingsMode === 'matchup' ? 'matchup' : 'round',
            divisionId: this.params.divisionId || 0, gender: this.params.gender === 'women' ? 'women' : 'men' } });
    }
    retrieveScramble(scramble: KingQueenTeam) {
        const version = ++this.version;
        this.selectedScramble = scramble; this.retrievedListOfTeams = []; this.byePlayers = [];
        this.message = ''; this.loading = true; this.resolved = false;
        this.focusedTeamId = this.focused ? Number(this.params.kingQueenTeamId) : null;
        this.focusedRoundId = this.focused && this.params.roundId !== undefined ? Number(this.params.roundId) : null;
        const playerId = Number(this.params.playerId);
        if (this.focused && (!this.positiveId(this.focusedTeamId) || !this.positiveId(playerId)
            || (this.focusedRoundId !== null && !this.positiveId(this.focusedRoundId)))) {
            this.loading = false; this.message = 'This score link has incomplete or invalid player, team or round information.'; return;
        }
        this.subscriptions.add(this.playerService.getKingQueenTeamsByScrambleNumber(this.leagueName, scramble.scrambleNumber).subscribe(response => {
            if (version !== this.version) { return; }
            this.loading = false;
            if (!response || !response.kingQueenTeams) { this.message = 'The saved matchup is unavailable.'; return; }
            // Finalization assigns players to ascending saved IDs. Never pair an unordered response.
            const records = response.kingQueenTeams.slice().sort((a, b) => a.kingQueenTeam.id - b.kingQueenTeam.id);
            this.retrievedListOfTeams = records.map((entry, index) => ({
                kingQueenTeamId: entry.kingQueenTeam.id, scrambleNumber: scramble.scrambleNumber, sortingId: index + 1,
                players: (entry.players || []).map(player => {
                    const membership = (entry.kingQueenTeam.kingQueenPlayers || []).find(p => p.playerId === player.id);
                    return { ...player, isSubScore: membership ? membership.isSubScore : false };
                }),
                maleCount: (entry.players || []).filter(p => p.isMale).length,
                femaleCount: (entry.players || []).filter(p => !p.isMale).length,
                kingQueenRoundScores: entry.kingQueenTeam.kingQueenRoundScores || []
            }));
            this.byePlayers = response.byePlayers || [];
            if (this.focused) {
                const index = this.retrievedListOfTeams.findIndex(t => t.kingQueenTeamId === this.focusedTeamId);
                const team = this.retrievedListOfTeams[index];
                const pairStart = Math.floor(index / 2) * 2;
                const pair = this.retrievedListOfTeams.slice(pairStart, pairStart + 2);
                if (!team || !team.players.some(p => p.id === playerId) || pair.length !== 2
                    || this.retrievedListOfTeams.length % 2 !== 0 || pair.some(t => !t.players.length)
                    || pair[0].players.some(p => pair[1].players.some(other => other.id === p.id))
                    || (this.focusedRoundId !== null && !team.kingQueenRoundScores.some(s => s.roundId === this.focusedRoundId))) {
                    this.message = 'The exact saved player/team matchup could not be verified. No unrelated matchup is shown.'; return;
                }
            }
            this.resolved = true;
        }, () => { if (version === this.version) { this.loading = false; this.message = 'Could not retrieve the saved matchup. Please try again.'; } }));
    }
}

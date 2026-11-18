import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';
@Component({ selector: 'app-detailed-player-stats', templateUrl: './detailed-player-stats.component.html', styleUrls: ['../player-stats-tabs/profile-statistics.shared.css'] })
export class DetailedPlayerStatsComponent implements OnChanges, OnDestroy {
 @Input() playerId: number; @Input() leagueId: number;
 loading = false; error = ''; performanceStats: any = null; history: any[] = []; teammates: any[] = [];
 private request: Subscription; private version = 0; private sortField = ''; private sortAscending = true;
 constructor(private statistics: StatisticsService) { }
 ngOnChanges() { this.loadDetailedPerformanceStats(this.leagueId); }
 loadDetailedPerformanceStats(leagueId: number) {
  if (this.request) { this.request.unsubscribe(); } const version = ++this.version;
  this.performanceStats = null; this.history = []; this.teammates = []; this.error = ''; this.loading = false;
  if (!this.playerId || !leagueId) { return; } this.loading = true;
  this.request = this.statistics.getDetailedPerformanceStats(this.playerId, leagueId).subscribe(data => {
   if (version !== this.version) { return; } this.loading = false;
   if (!data || !Array.isArray(data.individualRounds) || !Array.isArray(data.scrambleTotals)) { this.error = 'The historical statistics response is incomplete.'; return; }
   this.performanceStats = data; this.teammates = (data.teammateCounts || []).slice();
   this.history = data.scrambleTotals.map(matchup => {
    const rounds = data.individualRounds.filter(r => r.scrambleNumber === matchup.scrambleNumber).slice().sort((a,b) => a.roundNumber-b.roundNumber || a.id-b.id || (a.scoreId||0)-(b.scoreId||0));
    const ids = Array.from(new Set<number>(rounds.map(r => Number(r.id)).filter(id => Number.isInteger(id) && id>0)));
    const rawDate = matchup.dateOfTeam || (rounds[0] && rounds[0].dateOfTeam);
    const date = rawDate && !String(rawDate).startsWith('0001') && !isNaN(new Date(rawDate).getTime()) ? rawDate : null;
    const teams = ids.map(id => ({ id, rounds: rounds.filter(r => Number(r.id)===id), members: data.teamMembers ? data.teamMembers.filter(m=>Number(m.id)===id) : ids.length===1 ? matchup.team || [] : [] }));
    return { ...matchup, date, rounds, teams };
   }).sort((a,b) => (a.date?new Date(a.date).getTime():Infinity)-(b.date?new Date(b.date).getTime():Infinity) || a.scrambleNumber-b.scrambleNumber);
  }, () => { if(version===this.version){this.loading=false;this.error='Unable to load King/Queen history. Please retry.';} });
 }
 canLink(matchup: any, team: any): boolean { return this.leagueId>0 && this.playerId>0 && matchup.scrambleNumber>0 && team.id>0 && team.rounds.length>0; }
 validDate(value: any): any { return value && !String(value).startsWith('0001') && !isNaN(new Date(value).getTime()) ? value : null; }
 matchupQuery(matchup: any, team: any, roundId?: number): any { return { leagueId:this.leagueId, playerId:this.playerId, scrambleNumber:matchup.scrambleNumber, kingQueenTeamId:team.id, roundId:roundId || null, fromStandings:'1', fromProfile:'1', profilePlayerId:this.playerId, profileTab:'kq' }; }
 sortTeammates(field: string) { this.sortAscending=this.sortField===field?!this.sortAscending:true;this.sortField=field;this.teammates=this.teammates.slice().sort((a,b)=>{const x=a[field],y=b[field];return(x<y?-1:x>y?1:0)*(this.sortAscending?1:-1)||a.playerId-b.playerId;}); }
 ngOnDestroy(){this.version++;if(this.request)this.request.unsubscribe();}
}

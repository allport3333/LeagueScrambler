import { Component, OnInit, OnDestroy } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';
import { LeagueTeams } from '../data-models/leagueTeams.model';
import { LeagueService } from '../services/league.service';
import { LoginService } from '../services/login.service';

interface ScoreEntry { team1Score: number | null; team2Score: number | null; }
interface MatchupEditor {
    scheduleId?: number;
    team1Id: number;
    team2Id: number;
    division?: string;
    description?: string;
    manual: boolean;
    games: ScoreEntry[];
    saving: boolean;
    message?: string;
    error?: string;
}

@Component({
    selector: 'app-team-scores',
    templateUrl: './team-scores.component.html',
    styleUrls: ['./team-scores.component.less']
})
export class TeamScoresComponent implements OnInit, OnDestroy {
    teams: LeagueTeams[] = [];
    selectedLeague: string;
    leagueID: number;
    loading = true;
    loadingMatchups = false;
    numberOfGames = 3;
    gameDate = new Date();
    loadedDate: Date = new Date();
    isActionAllowed = false;
    legacyPassword = '';
    matchups: MatchupEditor[] = [];
    savedScores: any[] = [];
    loadError = '';
    scheduledCount = 0;
    private requestVersion = 0;
    private subscriptions = new Subscription();

    constructor(public statisticsService: StatisticsService,
        public leagueService: LeagueService, public loginService: LoginService) { }

    ngOnInit() {
        this.subscriptions.add(this.loginService.isAdminPasswordAuthorized().subscribe(
            authorized => { if (authorized) { this.isActionAllowed = true; this.loadMatchups(); } },
            () => { /* No legacy administration session. */ }
        ));
        this.subscriptions.add(this.leagueService.selectedLeague$.subscribe(selected => {
            this.leagueID = selected.leagueId;
            this.selectedLeague = selected.leagueName;
            this.loadMatchups();
        }));
        this.subscriptions.add(this.loginService.isLoggedIn().subscribe(result => {
            if (result) {
                this.subscriptions.add(this.loginService.getUsersRole().subscribe(roleResult => {
                    if (roleResult.role === 'Admin' || roleResult.role === 'Manager') {
                        this.isActionAllowed = true;
                        this.loadMatchups();
                    }
                    this.loading = false;
                }, () => { this.loading = false; }));
                // Preserve the existing league discovery workflow.
                this.subscriptions.add(this.leagueService.getLeagues().subscribe(
                    () => { this.loading = false; }, () => { this.loading = false; }));
            } else { this.loading = false; }
        }, () => { this.loading = false; }));
    }

    ngOnDestroy() { this.requestVersion++; this.subscriptions.unsubscribe(); }
    unlockAdministration() {
        if (!this.legacyPassword) {
            alert('Enter the administration password.');
            return;
        }
        this.loginService.verifyAdminPassword(this.legacyPassword).subscribe(
            (result) => {
                if (result && result.authorized) {
                    this.isActionAllowed = true;
                    this.legacyPassword = '';
                    this.loadMatchups();
                }
            },
            (error) => alert(error.status === 429
                ? 'Too many attempts. Try again later.'
                : 'Incorrect administration password.')
        );
    }

    dateKey(date: Date): string {
        return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
    }

    changeDate() {
        if (this.matchups.some(m => !this.hasSaved(m) && m.games.some(g => g.team1Score !== null || g.team2Score !== null))
            && !window.confirm('Change date and discard unsaved score entries?')) {
            this.gameDate = new Date(this.loadedDate); return;
        }
        this.loadMatchups();
    }

    reloadDate() {
        if (this.matchups.some(m => !this.hasSaved(m) && m.games.some(g => g.team1Score !== null || g.team2Score !== null))
            && !window.confirm('Reload and discard unsaved score entries?')) return;
        this.loadMatchups();
    }

    loadMatchups() {
        const version = ++this.requestVersion;
        this.matchups = []; this.savedScores = []; this.scheduledCount = 0; this.loadError = '';
        this.loadingMatchups = false;
        if (!this.isActionAllowed || !this.leagueID || !this.selectedLeague) return;
        if (!this.gameDate || isNaN(this.gameDate.getTime())) { this.loadError = 'Select a valid game date.'; return; }
        this.loadedDate = new Date(this.gameDate);
        const day = this.dateKey(this.gameDate);
        this.loadingMatchups = true;
        this.subscriptions.add(forkJoin([
            this.statisticsService.GetTeams(this.selectedLeague),
            this.statisticsService.getLeagueSchedule(this.leagueID),
            this.statisticsService.getMatchupScores(this.leagueID, day)
        ]).subscribe(results => {
            if (version !== this.requestVersion) return;
            this.teams = results[0]; this.savedScores = results[2];
            results[1].filter(week => week.date.substring(0, 10) === day).forEach(week => {
                week.matches.forEach(match => {
                    const editor = this.newEditor(false);
                    editor.scheduleId = match.scheduleId;
                    editor.team1Id = match.team1Id; editor.team2Id = match.team2Id;
                    editor.division = match.division; editor.description = match.matchDescription;
                    this.matchups.push(editor);
                });
            });
            this.scheduledCount = this.matchups.length;
            // Include saved unscheduled matches so refresh never hides their saved status.
            this.savedScores.forEach(score => {
                if (!this.matchups.some(m => this.isPair(m, score.teamId, score.opponentsTeamId))) {
                    const editor = this.newEditor(true);
                    editor.team1Id = score.teamId; editor.team2Id = score.opponentsTeamId;
                    this.matchups.push(editor);
                }
            });
            if (!this.scheduledCount) this.addManualMatchup();
            this.loadingMatchups = false;
        }, error => {
            if (version !== this.requestVersion) return;
            this.loadingMatchups = false;
            this.loadError = error.status === 403 ? 'You do not have permission to enter scores for this league.'
                : 'Could not load matchups and existing scores. Reload before entering scores.';
        }));
    }

    newEditor(manual: boolean): MatchupEditor {
        return { manual: manual, team1Id: null, team2Id: null, saving: false,
            games: Array.from({ length: this.numberOfGames }, () => ({ team1Score: null, team2Score: null })) };
    }
    addManualMatchup() { this.matchups.push(this.newEditor(true)); }
    resizeGames(matchup: MatchupEditor, count: number) {
        if (count < matchup.games.length && matchup.games.slice(count).some(g => g.team1Score !== null || g.team2Score !== null)
            && !window.confirm('Remove the extra unsaved game scores?')) return;
        matchup.games = matchup.games.slice(0, count);
        while (matchup.games.length < count) matchup.games.push({ team1Score: null, team2Score: null });
    }
    teamName(id: number): string {
        const team = this.teams.find(t => t.id === id);
        return team ? team.teamName : 'Team unavailable';
    }
    isPair(matchup: MatchupEditor, one: number, two: number): boolean {
        return (matchup.team1Id === one && matchup.team2Id === two) || (matchup.team1Id === two && matchup.team2Id === one);
    }
    storedRows(matchup: MatchupEditor): any[] {
        return this.savedScores.filter(s => this.isPair(matchup, s.teamId, s.opponentsTeamId));
    }
    savedTeamResults(matchup: MatchupEditor): any[] {
        return [matchup.team1Id, matchup.team2Id].map(teamId => ({ teamId, name: this.teamName(teamId),
            scores: this.storedRows(matchup).filter(row => row.teamId === teamId) }));
    }
    hasSaved(matchup: MatchupEditor): boolean { return this.storedRows(matchup).length > 0; }
    valid(matchup: MatchupEditor): boolean {
        return !!matchup.team1Id && !!matchup.team2Id && matchup.team1Id !== matchup.team2Id &&
            matchup.games.every(g => [g.team1Score, g.team2Score].every(score =>
                score !== null && score !== undefined && Number.isInteger(score) && score >= 0 && score <= 2147483647));
    }
    anySaving(): boolean { return this.matchups.some(m => m.saving); }
    saveMatchup(matchup: MatchupEditor) {
        if (!this.valid(matchup) || this.hasSaved(matchup) || matchup.saving || this.loadError || this.loadingMatchups) return;
        const version = this.requestVersion;
        matchup.saving = true; matchup.error = ''; matchup.message = '';
        const payload = { leagueId: this.leagueID, date: this.dateKey(this.loadedDate),
            scheduleId: matchup.scheduleId, team1Id: matchup.team1Id, team2Id: matchup.team2Id, games: matchup.games };
        this.subscriptions.add(this.statisticsService.recordMatchupScores(payload).subscribe(() => {
            if (version !== this.requestVersion) return;
            // Preserve other matchup drafts while refreshing saved state.
            this.statisticsService.getMatchupScores(this.leagueID, payload.date).subscribe(rows => {
                if (version !== this.requestVersion) return;
                this.savedScores = rows; matchup.saving = false;
                matchup.message = 'Scores saved and standings updated.';
            }, () => { matchup.saving = false; matchup.error = 'Save completed, but confirmation could not be loaded. Reload before trying again.'; });
        }, error => {
            if (version !== this.requestVersion) return;
            matchup.saving = false;
            matchup.error = error.status === 409 ? 'Scores already exist. Reload the date to inspect them; no scores were replaced.'
                : 'Scores were not confirmed. Reload to check saved results before retrying.';
        }));
    }
}

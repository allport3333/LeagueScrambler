import { AsyncPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, inject, OnChanges, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, Observable, of, startWith, switchMap, throwError } from 'rxjs';
import { Leagues } from '../data-models/leagues.model';

interface TournamentHome {
    name: string; date?: string; location?: string; status?: string; participants: number; checkedIn?: number;
    canManage: boolean; generated: number; completed: number; total?: number; hasResults: boolean;
    nextRound?: { roundNumber: number; status: string };
    standings: { name: string; wins: number }[];
    recent: { roundNumber: number; matchup: number; teams: string[][]; scores: {game: number; first: number; second: number}[] }[];
}
interface PickupSession {
    id: string; name: string; startsUtc: string; endsUtc: string; state: number; visibility: number; owner: boolean;
    confirmed: number; registration?: number; canReopen: boolean;
    venue: {name: string; city?: string; timeZone: string};
}
interface PickupBoard {
    number: number;
    board: { teams: {id: string; name: string}[][]; byes: {id: string; name: string}[] };
    scores: {matchup: number; game: number; first: number; second: number}[];
}
interface PickupWorkspace {
    playing: number; gamesPlayed: number; gameSets: number;
    myRegistrationId?: string; sets?: PickupBoard[];
}
interface View {
    loading?: boolean;
    error?: string;
    tournament?: TournamentHome;
    pickup?: { session: PickupSession; workspace: PickupWorkspace };
}

@Component({
    selector: 'app-event-home',
    imports: [AsyncPipe, DatePipe, RouterLink],
    templateUrl: './event-home.component.html',
    styleUrl: './event-home.component.css'
})
export class EventHomeComponent implements OnChanges, OnInit {
    @Input() event?: Leagues;
    @Input() pickupSession?: string;
    private readonly http = inject(HttpClient);
    view$: Observable<View>;
    readonly sessionStates = ['Draft', 'Published', 'In Progress', 'Completed', 'Cancelled'];
    readonly registrationStates = ['Pending Verification', 'Pending Approval', 'Confirmed', 'Cancelled', 'Declined', 'Waitlisted', 'Offered'];

    ngOnChanges(): void { this.load(); }

    ngOnInit(): void { if (!this.view$) this.load(); }

    load(): void {
        const event = this.event;
        const source: Observable<View> = event
            ? this.http.get<TournamentHome>('/api/tournaments/' + event.id + '/home').pipe(map(tournament => ({tournament})))
            : this.pickupHome();
        this.view$ = source.pipe(
                startWith({loading: true}),
                catchError(error => of({error: [403, 404].includes(error.status)
                    ? 'This event is unavailable to your account.' : 'Unable to load this Home dashboard.'}))
            );
    }

    private pickupHome(): Observable<View> {
        const explicit = /^[a-f0-9-]{36}$/i.test(this.pickupSession ?? '') ? this.pickupSession : undefined;
        const select = this.http.get<{id: string; owned: boolean}[]>('/api/pickup/selector').pipe(map(rows => {
            let remembered: string | null = null;
            try { remembered = sessionStorage.getItem('pickup-current-session'); } catch { /* Optional resume. */ }
            return rows.find(row => row.owned && row.id === remembered)?.id
                ?? rows.find(row => row.owned)?.id ?? rows[0]?.id;
        }));
        return (explicit ? of(explicit) : select).pipe(switchMap(id => {
            if (!id) return of({});
            const url = '/api/pickup/sessions/' + id;
            return forkJoin({
                session: this.http.get<PickupSession>(url),
                workspace: this.http.get<PickupWorkspace>(url + '/workspace')
            }).pipe(map(pickup => ({pickup})), catchError(error => error.status === 404 && !explicit
                ? of({}) : throwError(() => error)));
        }));
    }

    tournamentAction(t: TournamentHome): string {
        if (!t.status) return 'Open Tournament Workspace';
        if (!t.generated) return 'Continue Tournament Setup';
        if (t.nextRound?.status === 'partial') return 'Continue Entering Scores';
        return t.completed ? 'Continue Tournament' : 'Start Tournament';
    }

    pickupDate(value: string, timeZone: string): string {
        return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short', timeZone}).format(new Date(value));
    }

    assignment(workspace: PickupWorkspace) {
        const id = workspace.myRegistrationId;
        if (!id || !workspace.sets) return undefined;
        for (const set of [...workspace.sets].reverse()) {
            const team = set.board.teams.findIndex(players => players.some(player => player.id === id));
            if (team >= 0) {
                const first = team - team % 2;
                return {set: set.number, team: team + 1, players: set.board.teams[team],
                    opponent: set.board.teams[first + (team === first ? 1 : 0)],
                    scores: set.scores.filter(score => score.matchup === first / 2 + 1)};
            }
            if (set.board.byes.some(player => player.id === id)) return {set: set.number};
        }
        return undefined;
    }
}

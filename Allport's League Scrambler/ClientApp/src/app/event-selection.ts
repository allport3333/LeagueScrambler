import { Router } from '@angular/router';
import { Leagues } from './data-models/leagues.model';

const eastern = 'America/Detroit';
const formatters = new Map<string, Intl.DateTimeFormat>();
function localDate(now: Date, timeZone: string): string {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        try { formatter = new Intl.DateTimeFormat('sv-SE', { timeZone }); }
        catch { formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: eastern }); }
        formatters.set(timeZone, formatter);
    }
    return formatter.format(now);
}

export function isHistoricalEvent(event: Leagues, now: Date): boolean {
    if (event.eventTypeId !== 2) return event.isActive === false;
    if (!event.eventDate) return true;
    const cutoff = new Date(localDate(now, event.eventTimeZone || eastern) + 'T00:00:00Z');
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    return event.eventDate < cutoff.toISOString().slice(0, 10);
}

export function eventDestination(router: Router, event: Leagues) {
    const id = event.id;
    if (event.eventTypeId !== 2) return router.createUrlTree(['/league-dashboard'], {queryParams: {leagueId: id}});
    if (event.canManageTournament) return router.createUrlTree(['/tournament', id]);
    if (event.canViewTournamentRounds) return router.createUrlTree(['/tournament', id, 'rounds']);
    return router.createUrlTree(['/standings'], {queryParams: {leagueId: id, tournament: 1}});
}

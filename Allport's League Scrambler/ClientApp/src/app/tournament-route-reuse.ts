import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

@Injectable()
export class TournamentRouteReuse extends BaseRouteReuseStrategy {
    override shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
        if (future.routeConfig?.path === 'standings' &&
            (future.queryParamMap.get('tournament') === '1' || current.queryParamMap.get('tournament') === '1') &&
            future.queryParamMap.get('leagueId') !== current.queryParamMap.get('leagueId')) return false;
        return super.shouldReuseRoute(future, current) &&
            (!future.data['tournamentContext'] || future.paramMap.get('leagueId') === current.paramMap.get('leagueId'));
    }
}

import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

@Injectable()
export class TournamentRouteReuse extends BaseRouteReuseStrategy {
    override shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
        return super.shouldReuseRoute(future, current) &&
            (!future.data['tournamentContext'] || future.paramMap.get('leagueId') === current.paramMap.get('leagueId'));
    }
}

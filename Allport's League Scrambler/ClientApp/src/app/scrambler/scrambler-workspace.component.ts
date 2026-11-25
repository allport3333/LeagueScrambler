import { Component, Injectable, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { LoginService } from '../services/login.service';

export function requireSignedInTournament() {
    const router = inject(Router);
    return inject(AuthService).isLoggedIn$.pipe(take(1),
        map(signedIn => signedIn || router.createUrlTree(['/access-denied'])));
}

@Injectable({ providedIn: 'root' })
export class LeagueManagementGuard  {
    constructor(private auth: AuthService, private login: LoginService, private router: Router) { }
    canActivate() {
        return this.auth.authenticationState$.pipe(
            filter(state => state !== null), take(1),
            switchMap(signedIn => signedIn ? this.login.getUsersRole().pipe(
                map(result => result.role === 'Admin' || result.role === 'Manager'),
                catchError(() => of(false))) : of(false)),
            map(allowed => allowed || this.router.createUrlTree(['/access-denied']))
        );
    }
}

// Both child routes retain this parent and its existing Scrambler instance.
// No algorithm/form/team state is copied into a second management controller.
@Component({
    selector: 'app-scrambler-workspace',
    template: '<app-scrambler-component [workspaceSection]="section"></app-scrambler-component><router-outlet></router-outlet>',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ScramblerWorkspaceComponent {
    constructor(private router: Router) { }
    get section(): string {
        return this.router.url.split(/[?#]/)[0] === '/league-management' ? 'league-management' : 'scrambler';
    }
}

@Component({
    selector: 'app-workspace-route', template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class WorkspaceRouteComponent { }

@Component({
    template: '<section class="text-center my-4"><h1>Access denied</h1><p>League Management requires an administrator or league manager account.</p><a routerLink="/">Return home</a></section>',
    standalone: false
})
export class LeagueManagementDeniedComponent {}

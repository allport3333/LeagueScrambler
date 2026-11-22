import { Component, Injectable, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { LoginService } from '../services/login.service';

@Injectable({ providedIn: 'root' })
export class LeagueManagementGuard  {
    constructor(private auth: AuthService, private login: LoginService, private router: Router) { }
    canActivate() {
        return this.auth.authenticationState$.pipe(
            filter(state => state !== null), take(1),
            switchMap(signedIn => signedIn ? this.login.getUsersRole().pipe(
                map(result => result.role === 'Admin' || result.role === 'Manager'),
                catchError(() => of(false))) : of(false)),
            map(allowed => { if (!allowed) { this.router.navigate(['/']); } return allowed; })
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

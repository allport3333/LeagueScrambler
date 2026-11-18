import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LoginService } from './services/login.service';

@Injectable()
export class AuthService {
    private loggedIn = new BehaviorSubject<boolean | null>(null);
    private stateVersion = 0;

    // null means checking, not logged out. Existing boolean consumers wait for a result.
    authenticationState$ = this.loggedIn.asObservable();
    isLoggedIn$ = this.authenticationState$.pipe(filter((value): value is boolean => value !== null));

    constructor(private loginService: LoginService) {
        this.restoreSession();
        // A back/forward-cache return can preserve Angular's old in-memory state.
        window.addEventListener('pageshow', event => {
            if (event.persisted) { this.restoreSession(); }
        });
    }

    restoreSession() {
        const version = ++this.stateVersion;
        this.loggedIn.next(null);
        this.loginService.isLoggedIn().subscribe(
            result => { if (version === this.stateVersion) { this.setLoggedIn(result === true); } },
            () => { if (version === this.stateVersion) { this.setLoggedIn(false); } }
        );
    }

    setLoggedIn(value: boolean) {
        // A late startup response must not undo a newer explicit login/logout.
        this.stateVersion++;
        this.loggedIn.next(value);
    }
}

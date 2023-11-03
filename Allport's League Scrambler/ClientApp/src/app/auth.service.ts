import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class AuthService {
    private loggedIn = new BehaviorSubject<boolean>(false);

    isLoggedIn$ = this.loggedIn.asObservable();

    constructor() { }

    setLoggedIn(value: boolean) {
        this.loggedIn.next(value);
    }
}
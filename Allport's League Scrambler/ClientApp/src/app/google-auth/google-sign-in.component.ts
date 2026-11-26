import { AsyncPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, inject } from '@angular/core';
import { catchError, of } from 'rxjs';

@Component({
    selector: 'app-google-sign-in',
    imports: [AsyncPipe],
    template: `
      @if ((available | async)?.enabled) {
        <form ngNoForm method="post" action="/api/auth/google/start">
          <input type="hidden" name="returnTo" [value]="returnTo">
          <button class="google-auth-action" type="submit">Continue with Google</button>
        </form>
      }
    `
})
export class GoogleSignInComponent {
    @Input() returnTo = '/';
    readonly available = inject(HttpClient).get<{enabled: boolean}>('/api/auth/google/available')
        .pipe(catchError(() => of({enabled: false})));
}

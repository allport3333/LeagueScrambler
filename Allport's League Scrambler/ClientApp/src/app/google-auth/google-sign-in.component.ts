import { AsyncPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, inject } from '@angular/core';
import { catchError, of } from 'rxjs';

interface GoogleAvailability {
    enabled: boolean;
    missingKeys?: string[];
}

@Component({
    selector: 'app-google-sign-in',
    imports: [AsyncPipe],
    template: `
      @if (available | async; as provider) {
        @if (provider.enabled) {
          <form ngNoForm method="post" action="/api/auth/google/start">
            <input type="hidden" name="returnTo" [value]="returnTo">
            <button class="google-auth-action google-provider" type="submit">
              <img src="assets/img/google-g.png" width="18" height="18" alt="">
              {{ label }}
            </button>
          </form>
          @if (showSeparator) { <div class="separator">or</div> }
        } @else if (showSeparator && provider.missingKeys?.length) {
          <aside class="development-diagnostic">
            <strong>Google sign-in is unavailable in Development.</strong>
            <p>Right-click the web project in Visual Studio and choose Manage User Secrets. Set the following keys with your Google OAuth client values, then restart the app.</p>
            <ul>
              @for (key of provider.missingKeys; track key) { <li><code>{{ key }}</code></li> }
            </ul>
          </aside>
        }
      }
    `,
    styles: `
      .google-provider {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 44px;
        padding: 0 12px;
        border: 1px solid #747775;
        background: #fff;
        color: #1f1f1f;
      }
      .google-provider:hover { background: #f2f2f2; }
      .separator {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 10px 0;
        color: var(--hub-muted, #526579);
      }
      .separator::before, .separator::after {
        content: '';
        flex: 1;
        border-top: 1px solid var(--hub-border, #718197);
      }
      .development-diagnostic {
        margin: 10px 0;
        font-size: .875rem;
        text-align: left;
        overflow-wrap: anywhere;
      }
      .development-diagnostic p { margin: 4px 0; }
      .development-diagnostic ul { margin: 4px 0; padding-inline-start: 20px; }
    `
})
export class GoogleSignInComponent {
    @Input() returnTo = '/';
    @Input() label = 'Continue with Google';
    @Input() showSeparator = false;
    readonly available = inject(HttpClient).get<GoogleAvailability>('/api/auth/google/available')
        .pipe(catchError(() => of<GoogleAvailability>({enabled: false})));
}

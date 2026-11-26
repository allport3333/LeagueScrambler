import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth.service';
import { filter } from 'rxjs';
import { googleStatus } from './google-status';
import { injectConfirmation } from '../confirmation-dialog';

interface Connection { enabled: boolean; connected: boolean; canDisconnect: boolean; }

@Component({
    imports: [FormsModule, RouterLink],
    template: `
      <article class="connected-accounts">
        <h1>Connected Accounts</h1>
        @if (message()) { <p role="status">{{ message() }}</p> }
        @if (authRequired()) { <p><a routerLink="/" [queryParams]="{toggleLoginForm: true}">Sign in</a> to manage your connections.</p> }
        @else if (connection(); as google) {
          <h2>Google</h2>
          @if (!google.enabled) { <p>Google sign-in is unavailable here.</p> }
          @else if (google.connected) {
            <p>Google is connected.</p>
            @if (google.canDisconnect) {
              <button class="google-auth-action" type="button" [disabled]="busy()" (click)="disconnect()">Disconnect Google</button>
            } @else {
              <p>Google is your only sign-in method. Set a password using <a routerLink="/">Forgot Password</a> before disconnecting.</p>
            }
          } @else {
            <form ngNoForm method="post" action="/api/auth/google/connect">
              <button class="google-auth-action" type="submit">Connect Google</button>
            </form>
          }
        } @else if (!message()) { <p role="status">Loading connected accounts...</p> }
        <p><a routerLink="/privacy">Privacy Policy</a></p>
      </article>
    `
})
export class ConnectedAccountsComponent implements OnInit {
    private readonly http = inject(HttpClient);
    private readonly route = inject(ActivatedRoute);
    private readonly auth = inject(AuthService);
    private readonly destroy = inject(DestroyRef);
    private readonly confirm = injectConfirmation();
    readonly connection = signal<Connection | null>(null);
    readonly authRequired = signal(false);
    readonly busy = signal(false);
    readonly message = signal(googleStatus(this.route.snapshot.queryParamMap.get('google')));

    ngOnInit(): void {
        this.auth.authenticationState$.pipe(filter(state => state !== null), takeUntilDestroyed(this.destroy))
            .subscribe(signedIn => {
                this.authRequired.set(!signedIn);
                this.connection.set(null);
                if (signedIn) this.load();
            });
    }

    private load(): void {
        this.http.get<Connection>('/api/auth/google/connection').pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: data => { if (!this.authRequired()) this.connection.set(data); },
            error: () => this.message.set('Unable to load connected accounts.')
        });
    }

    async disconnect(): Promise<void> {
        if (!this.connection()?.canDisconnect || this.busy()) return;
        if (!await this.confirm({title: 'Disconnect Google?', message: 'You can still use your League Hub password to sign in.',
            action: 'Disconnect Google', tone: 'danger'}) || this.busy() || !this.connection()?.canDisconnect) return;
        this.busy.set(true);
        this.http.post('/api/auth/google/disconnect', {}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: () => {
                this.busy.set(false);
                this.message.set('Google disconnected.');
                this.load();
            },
            error: error => {
                this.busy.set(false);
                this.message.set(error.status === 409 ? 'Set a League Hub password before disconnecting Google.' : 'Unable to disconnect Google.');
            }
        });
    }
}

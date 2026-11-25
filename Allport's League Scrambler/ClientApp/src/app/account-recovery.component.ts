import { DatePipe } from '@angular/common';
import { PageLoadingComponent } from './page-loading.component';
import { ProfileMatch } from './data-models/profile-match';
import { Subject, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectorRef, Component, inject, Input, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

interface ReviewRequest {
  playerName: string;
  createdUtc: string;
  verifiedUtc: string;
  id: string;
  userId: number;
  playerId: number;
  contactEmail: string;
  reviewInformation: string;
  expiresUtc: string;
  decidedUtc: string;
  reviewerId: number;
  reviewDecision: string;
  approved: boolean;
}

@Component({
  selector: 'app-account-recovery',
  standalone: true,
  imports: [FormsModule, DatePipe, PageLoadingComponent, RouterLink],
  template: `
    @if (embeddedReview) {
      <h2 class="review-title">Account Recovery Review</h2>
    } @else {
      <h1>{{ review ? 'Account Recovery Review' : emailChange ? 'Change Account Email' : 'Recover Existing Account' }}</h1>
    }
    @if (review) {
      @if (reviewLoading) {
        <app-page-loading label="Loading recovery requests"></app-page-loading>
      } @else if (reviewError) {
        <section class="review-state" aria-label="Recovery review unavailable">
          <p role="alert">{{ reviewError }}</p>
          @if (!reviewDenied) { <button type="button" (click)="load(page)">Retry</button> }
        </section>
      } @else {
      <p class="review-intro">Review verified requests and document independent ownership checks before approving recovery.</p>
      <label class="review-filter">Request status
        <select [ngModel]="filter" (ngModelChange)="filter = $event; load(0)">
          <option value="pending">Pending</option><option value="approved">Approved</option>
          <option value="rejected">Rejected</option><option value="expired">Expired</option>
        </select>
      </label>
      @for (entry of requests; track entry.id) {
        <article>
          <h2>{{ entry.playerName || 'Player ' + entry.playerId }}</h2>
          <p class="request-meta">Submitted {{ entry.createdUtc | date:'mediumDate':'+0000' }} · Account {{entry.userId}}</p>
          <p><strong>Verified contact</strong> {{entry.contactEmail}}</p>
          @if (entry.decidedUtc) {
            <p>{{ entry.approved ? 'Approved' : 'Declined' }} by administrator {{entry.reviewerId}}</p>
            <p>{{entry.reviewDecision}}</p>
          } @else if (expired(entry)) {
            <p>Expired</p>
          } @else {
            <p class="request-status">Pending review</p>
            @if (reviewId === entry.id) {
            <p>{{entry.reviewInformation}}</p>
            <form (ngSubmit)="decide(entry)">
              <label>Decision <select aria-label="Decision" name="resolution" [(ngModel)]="resolution" required>
                <option value="">Choose a decision</option>
                <option value="approve">Approve</option><option value="reject">Reject</option>
              </select></label>
              <label>Decision Notes (Optional) <textarea name="notes" [(ngModel)]="notes" maxlength="1000"></textarea></label>
              @if (resolution === 'approve') {
                <p>Verify ownership using a trusted channel or record obtained independently of the requester.
                A matching name, league information, or a verified new email is insufficient.</p>
                <label class="attestation"><input type="checkbox" name="attestation" [(ngModel)]="attested"> I independently verified account ownership.</label>
              }
              <button type="button" (click)="openReview('')" [disabled]="busy">Cancel</button>
              <button [disabled]="busy || !resolution || notes.length > 1000 || (resolution === 'approve' && !attested)">Record decision</button>
            </form>
            } @else {
              <button type="button" (click)="openReview(entry.id)" [disabled]="busy">Review this request</button>
            }
          }
        </article>
      } @empty {
        @if (!busy && !error) { <p>No {{ filter }} recovery requests to review.</p> }
      }
      @if (page > 0 || hasMore) {
        <nav class="review-pagination" aria-label="Recovery request pages">
          <button type="button" (click)="load(page - 1)" [disabled]="page === 0">Previous</button>
          <span>Page {{ page + 1 }} · {{ requests.length }} requests</span>
          <button type="button" (click)="load(page + 1)" [disabled]="!hasMore">Next</button>
        </nav>
      }
      }
    } @else {
      @if (!requestId && !finished) {
        @if (enterRequestId) {
          <form (ngSubmit)="resume()">
            <label>Request number from your email <input name="resumeId" [(ngModel)]="resumeId" maxlength="36" required></label>
            <button [disabled]="!resumeId">Continue to verification</button>
            <button type="button" (click)="enterRequestId = false">Back</button>
          </form>
        } @else {
        <form #submission="ngForm" (ngSubmit)="submit()">
          @if (!emailChange) {
            @if (selectedProfile) {
              <section class="selected-profile">
                <strong>{{ selectedProfile.firstName }} {{ selectedProfile.lastName }}</strong>
                @if (selectedProfile.leagues?.length) { <span>{{ selectedProfile.leagues.join(', ') }}</span> }
                <button type="button" (click)="changeProfile()" [disabled]="busy">Change profile</button>
              </section>
            } @else {
              <label>Player name
                <input type="search" name="profileName" autocomplete="off" maxlength="200" [ngModel]="profileName"
                  (ngModelChange)="searchProfiles($event)" placeholder="First and last name">
              </label>
              <div aria-live="polite">
                @if (profileLoading) { <p>Searching player profiles...</p> }
                @else if (profileError) {
                  <p role="alert">{{ profileError }}</p>
                  <button type="button" (click)="searchProfiles(profileName, retryProfilePage, true)">Retry search</button>
                }
                @else if (canSearch(profileName) && !profiles.length) { <p>No registered player account matches this search. <a routerLink="/">Register or claim a player from the home page.</a></p> }
              </div>
              @if (profiles.length) {
                <div class="profile-matches" role="group" aria-label="Matching player profiles">
                  @for (profile of profiles; track profile.id) {
                    <button type="button" (click)="selectProfile(profile)">
                      <strong>{{ profile.firstName }} {{ profile.lastName }}</strong>
                      @if (profile.leagues?.length) { <span>{{ profile.leagues.join(', ') }}</span> }
                    </button>
                  }
                </div>
              }
              @if (moreProfiles && !profileError) {
                <button type="button" [disabled]="profileLoading" (click)="searchProfiles(profileName, profilePage + 1)">Load more profiles</button>
              }
            }
          }
          <label>New contact email <input type="email" name="email" [(ngModel)]="email" maxlength="254" autocomplete="email" email required></label>
          @if (emailChange) {
            <label>Current password <input type="password" name="password" [(ngModel)]="password" maxlength="1024" autocomplete="current-password" required></label>
          } @else {
            <label>Information for the reviewer <textarea name="information" [(ngModel)]="information" maxlength="1000" required></textarea></label>
            <p>Share how the administrator can independently verify ownership. Keep passwords, codes and identity documents private.</p>
          }
          <button [disabled]="busy || submission.invalid || (!emailChange && (!selectedProfile || !information.trim()))">Send verification code</button>
          <button type="button" (click)="enterRequestId = true" [disabled]="busy">I have a request number from an earlier email</button>
        </form>
        }
      }
      @if (requestId && !finished) {
        <p>If the request can proceed, check {{ verificationEmail || 'your new contact email' }} for the verification code. The code expires one hour after it is issued.</p>
        <form (ngSubmit)="verify()">
          <label>Verification code <input name="code" [(ngModel)]="code" maxlength="64" [attr.inputmode]="legacyCode ? 'text' : 'numeric'" autocomplete="one-time-code" required></label>
          <button [disabled]="busy || !validCode()">Verify email</button>
          <button type="button" (click)="resend()" [disabled]="busy">Resend code</button>
          <button type="button" (click)="startAgain()" [disabled]="busy">Start again</button>
        </form>
      }
    }
    <p role="status">{{ message }}</p>
    @if (error) { <p class="error" role="alert">{{error}}</p> }
  `,
  styles: [`
    :host { display: block; max-width: 42rem; margin: 1rem auto; padding: 1rem; color: var(--hub-text); }
    h1 { text-align: center; font-size: clamp(1.5rem, 4vw, 2rem); }
    h2 { font-size: 1.2rem; }
    .review-title, .review-intro { text-align: center; }
    .review-filter { grid-template-columns: auto minmax(0, 12rem); align-items: center; justify-content: center; }
    .review-pagination { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: .5rem; border-top: 1px solid var(--hub-border); padding-top: .75rem; }
    .review-state { text-align: center; padding: .75rem; }
    .request-meta, .request-status { color: var(--hub-muted); }
    .profile-matches { display: grid; gap: .35rem; max-height: 16rem; overflow: auto; }
    .profile-matches button, .selected-profile { display: grid; gap: .2rem; text-align: start; overflow-wrap: anywhere; }
    .selected-profile { border: 1px solid var(--hub-border); padding: .5rem; border-radius: 4px; }
    article { border: 1px solid var(--hub-border); border-radius: 6px; padding: .75rem; margin: .75rem 0; overflow-wrap: anywhere; }
    form, label { display: grid; gap: .5rem; }
    form { margin-block: .75rem; }
    input, textarea, select, button { padding: .55rem; color: inherit; background: var(--hub-section, Canvas); border: 1px solid var(--hub-border, GrayText); border-radius: 4px; }
    textarea { min-height: 5rem; }
    button:disabled { opacity: .6; }
    .attestation { display: flex; align-items: baseline; }
    .attestation input { width: auto; flex: none; margin: 0; }
    .error { color: var(--hub-loss-text); }
  `]
})
export class AccountRecoveryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  @Input() embeddedReview = false;
  get review() { return this.embeddedReview || this.route.snapshot.data['mode'] === 'review'; }
  get emailChange() { return !this.review && this.route.snapshot.data['mode'] === 'email-change'; }
  private readonly api = '/api/account-recovery';
  email = '';
  password = '';
  information = '';
  private lastProfileTerm: string | undefined;
  private readonly profileQueries = new Subject<{ name: string; page: number }>();
  selectedProfile: ProfileMatch | null = null;
  profileName = '';
  profiles: ProfileMatch[] = [];
  profileLoading = false;
  profileError = '';
  profilePage = 0;
  retryProfilePage = 0;
  moreProfiles = false;
  requestId = '';
  verificationEmail = '';
  private retryCodeAfter = 0;
  reviewId = '';
  resumeId = '';
  enterRequestId = false;
  code = '';
  legacyCode = false;
  requests: ReviewRequest[] = [];
  page = 0;
  filter = 'pending';
  hasMore = false;
  reviewLoading = false;
  reviewError = '';
  reviewDenied = false;

  constructor() {
    this.profileQueries.pipe(
      switchMap(({name, page}) => !this.canSearch(name) ? of(null) : timer(page ? 0 : 300).pipe(
        switchMap(() => this.http.get<{players: ProfileMatch[]; hasMore: boolean}>(this.api + '/profiles', { params: {search: name.trim(), page} })),
        map(result => Array.isArray(result?.players) && typeof result.hasMore === 'boolean'
          ? {...result, page, error: ''}
          : {players: [], hasMore: false, page, error: 'The server returned an unexpected response. Retry search.'}),
        catchError((error: HttpErrorResponse) => of({players: [], hasMore: false, page, error: this.profileSearchError(error)}))
      )),
      takeUntilDestroyed()
    ).subscribe(result => {
      this.profileLoading = false;
      if (result?.error) {
        this.retryProfilePage = result.page;
        this.profileError = result.error;
      } else if (result) {
        this.profiles = result.page ? [...this.profiles, ...result.players] : result.players;
        this.moreProfiles = result.hasMore;
        this.profilePage = result.page;
      }
      this.changeDetector.markForCheck();
    });
  }
  busy = false;
  finished = false;
  error = '';
  message = '';
  resolution = '';
  notes = '';
  attested = false;

  ngOnInit(): void {
    if (this.review) this.load(0);
    else this.restoreVerification();
    if (!this.review && !this.emailChange) {
      const profile = history.state?.recoveryProfile as ProfileMatch | undefined;
      if (profile?.id > 0 && typeof profile.firstName === 'string' && typeof profile.lastName === 'string')
        this.selectProfile(profile);
    }
  }

  canSearch(name: string): boolean {
    return (name.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 2;
  }

  private profileSearchError(error: HttpErrorResponse): string {
    if (error.status === 0) return 'Could not reach the server. Check your connection and retry search.';
    if (error.status === 429) return 'Too many searches. Wait a few minutes before retrying.';
    if (error.status === 404 || (error.status === 200 && error.headers.get('content-type')?.includes('text/html')))
      return 'The running application does not have the recovery search endpoint. Retry after the server is updated.';
    if (error.status === 401 || error.status === 403)
      return 'The server refused this public search. Retry later or contact League Hub support.';
    if (error.status >= 500) return 'Player search is temporarily unavailable. Retry in a moment.';
    return 'Player search failed. Retry search.';
  }

  searchProfiles(name: string, page = 0, retry = false): void {
    this.profileName = name;
    const term = name.trim().replace(/\s+/g, ' ');
    const key = term.toUpperCase();
    if (!retry && (page ? this.profileLoading || page <= this.profilePage : key === this.lastProfileTerm)) return;

    this.lastProfileTerm = key;
    this.profileError = '';
    if (!page) {
      this.profiles = [];
      this.profilePage = 0;
      this.moreProfiles = false;
    }
    this.profileLoading = this.canSearch(term);
    this.profileQueries.next({name: term, page});
  }

  selectProfile(profile: ProfileMatch): void {
    this.selectedProfile = profile;
    this.lastProfileTerm = undefined;
    this.profileName = profile.firstName + ' ' + profile.lastName;
    this.profileQueries.next({name: '', page: 0});
  }

  changeProfile(): void {
    this.selectedProfile = null;
    this.searchProfiles(this.profileName);
  }

  expired(entry: ReviewRequest): boolean {
    return Date.parse(entry.expiresUtc.endsWith('Z') ? entry.expiresUtc : entry.expiresUtc + 'Z') <= Date.now();
  }

  openReview(id: string): void {
    this.reviewId = id;
    this.resolution = this.notes = '';
    this.attested = false;
  }

  resume(): void {
    const id = this.resumeId.trim();
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      this.error = 'Enter the request number shown in your email.';
      return;
    }
    this.error = '';
    this.requestId = id;
    this.legacyCode = true;
    this.saveVerification();
  }

  submit(): void {
    if (this.busy || (!this.emailChange && !this.selectedProfile)) return;
    this.begin();
    this.http.post<{ id: string }>(this.api + (this.emailChange ? '/email-change' : '/request'), {
      email: this.email, password: this.emailChange ? this.password : null,
      playerId: this.emailChange ? null : this.selectedProfile?.id, information: this.emailChange ? null : this.information
    }).subscribe({
      next: response => {
        this.password = '';
        this.requestId = response.id;
        this.legacyCode = false;
        this.verificationEmail = this.email.trim();
        this.retryCodeAfter = Date.now() + 60000;
        this.saveVerification();
        this.busy = false;
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        if (!this.emailChange && error.status === 404 && typeof error.error === 'string' &&
          error.error.startsWith('That player profile is no longer available.')) {
          this.busy = false;
          this.changeProfile();
          this.error = 'That player profile is no longer available. Select another match.';
          this.changeDetector.markForCheck();
          return;
        }
        this.fail(error);
      }
    });
  }

  private get verificationKey(): string {
    return this.emailChange ? 'league-hub-email-verification' : 'league-hub-recovery-verification';
  }

  private saveVerification(): void {
    try {
      if (this.finished || !this.requestId) sessionStorage.removeItem(this.verificationKey);
      else sessionStorage.setItem(this.verificationKey, JSON.stringify({
        id: this.requestId, email: this.verificationEmail, retryAfter: this.retryCodeAfter, legacy: this.legacyCode
      }));
    } catch {
      // The request remains usable on this page even when browser storage is unavailable.
    }
  }

  private restoreVerification(): void {
    try {
      const saved = JSON.parse(sessionStorage.getItem(this.verificationKey) ?? 'null');
      if (typeof saved?.id === 'string' && typeof saved.email === 'string' && typeof saved.retryAfter === 'number') {
        this.requestId = saved.id;
        this.verificationEmail = saved.email;
        this.retryCodeAfter = saved.retryAfter;
        this.legacyCode = saved.legacy === true;
      }
    } catch {
      // Ignore unavailable or invalid session storage.
    }
  }

  startAgain(): void {
    this.requestId = this.verificationEmail = this.code = this.error = this.message = '';
    this.retryCodeAfter = 0;
    this.legacyCode = false;
    this.saveVerification();
  }

  resend(): void {
    if (this.busy || !this.requestId) return;
    if (Date.now() < this.retryCodeAfter) {
      this.message = 'Wait one minute after requesting a code before trying again.';
      return;
    }
    this.begin();
    this.http.post(this.api + '/resend', { id: this.requestId }).subscribe({
      next: () => {
        this.busy = false;
        this.retryCodeAfter = Date.now() + 60000;
        this.saveVerification();
        this.message = 'If a new code can be sent, it will arrive at your new contact email.';
        this.changeDetector.markForCheck();
      },
      error: error => this.fail(error)
    });
  }

  validCode(): boolean {
    return /^(?:[0-9]{8}|[a-f0-9]{64})$/i.test(this.code.replace(/\s/g, ''));
  }

  verify(): void {
    if (this.busy || !this.validCode()) return;
    this.begin();
    this.http.post<{ emailChanged: boolean }>(this.api + '/verify', { id: this.requestId, code: this.code.replace(/\s/g, '') }).subscribe({
      next: result => {
        this.code = '';
        this.finished = true;
        this.saveVerification();
        this.busy = false;
        this.changeDetector.markForCheck();
        if (result.emailChanged) this.auth.setLoggedIn(false);
        this.message = result.emailChanged ? 'Email changed. Sign in again with your new email.' :
          'Email verified. An Application Administrator will review your request. Check your contact email for the decision.';
      },
      error: error => this.fail(error)
    });
  }

  load(page: number): void {
    this.page = page;
    this.reviewLoading = true;
    this.reviewError = '';
    this.reviewDenied = false;
    this.http.get<{requests: ReviewRequest[]; hasMore: boolean}>(this.api + '/review', { params: { page, status: this.filter } }).subscribe({
      next: result => {
        if (!Array.isArray(result?.requests)) {
          this.reviewError = 'The server did not return a recovery request list. Retry after the updated application is running.';
        } else {
          this.requests = result.requests;
          this.hasMore = result.hasMore;
        }
        this.reviewLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.reviewDenied = error.status === 401 || error.status === 403;
        this.reviewError = this.reviewDenied ? 'Sign in as an Application Administrator to review requests.' :
          error.status === 404 || (error.status === 200 && error.headers.get('content-type')?.includes('text/html'))
            ? 'The running application is missing the recovery review API. Retry after the local host is updated.'
            : 'Recovery requests could not be loaded. Retry in a moment.';
        this.reviewLoading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  decide(entry: ReviewRequest): void {
    if (this.busy) return;
    this.begin();
    this.http.post(this.api + '/review/' + entry.id, {
      approve: this.resolution === 'approve', decisionNotes: this.notes, independentlyVerified: this.attested
    }).subscribe({
      next: () => {
        this.openReview('');
        this.busy = false;
        this.load(this.page);
        this.message = 'Decision recorded.';
      },
      error: error => this.fail(error)
    });
  }

  private begin(): void {
    this.busy = true;
    this.message = this.error = '';
  }

  private fail(error: HttpErrorResponse): void {
    this.busy = false;
    this.changeDetector.markForCheck();
    this.error = error.status === 429 ? 'Too many attempts. Try again later.' :
      error.status === 401 || error.status === 403 ? 'Sign in with an account authorized for this action.' :
      typeof error.error === 'string' && [400, 409, 503].includes(error.status) ? error.error : 'The request could not be completed.';
  }
}

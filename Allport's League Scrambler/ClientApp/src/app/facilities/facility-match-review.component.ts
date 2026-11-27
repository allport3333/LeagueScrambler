import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, distinctUntilChanged, filter, of, switchMap, timer } from 'rxjs';

export interface FacilityMatch {
    id: number; name: string; address: string; city: string; region: string; postalCode: string;
    country: string; timeZone: string; definitive: boolean; reason: string; canViewDirectory: boolean;
}

export interface FacilityConflict {
    code: string; message: string; matches: FacilityMatch[]; canReviewDistinct: boolean;
}

export interface FacilityMatchDraft {
    name?: string; address?: string; city?: string; region?: string; postalCode?: string; country?: string;
    alternateName?: string; website?: string; sourceKey?: string; excludeId?: number;
    latitude?: number; longitude?: number; approximate?: boolean;
}

@Component({
    selector: 'app-facility-match-review',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink],
    template: `
      @if (result(); as matches) {
        @if (!dismissed() && matches.matches.length) {
          <section class="facility-matches" aria-label="Possible existing facilities">
            <h3>{{ matches.matches.length === 1 ? 'Possible Existing Facility Found' : 'Possible Existing Facilities Found' }}</h3>
            @for (match of matches.matches; track match.id) {
              <article>
                <strong>{{ match.name }}</strong>
                <p>{{ location(match) }}</p>
                <p>{{ match.reason }}</p>
                <div class="actions">
                  <button type="button" [disabled]="busy" (click)="useExisting.emit(match)">Use Existing Facility</button>
                  @if (match.canViewDirectory) {
                    <a [routerLink]="['/facilities', match.id]" target="_blank" rel="noopener">View Existing Facility</a>
                  }
                  <button type="button" [attr.aria-expanded]="reviewId() === match.id" (click)="toggle(match.id)">Review Differences</button>
                </div>
                @if (reviewId() === match.id) {
                  <dl>
                    <dt>Existing record</dt><dd>{{ match.name }} — {{ location(match) }}</dd>
                    <dt>Proposed details</dt><dd>{{ draft?.name || 'Unnamed facility' }} — {{ location(draft) }}</dd>
                  </dl>
                  @if (allowReconcile) {
                    <button type="button" [disabled]="busy" (click)="reconcile.emit(match)">Add Verified Missing Details</button>
                  }
                }
              </article>
            }
            @if (!canConfirmDistinct && matches.matches.some(isPossible)) {
              <p>If this is a separate facility, ask a League Hub administrator to review it.</p>
            }
            <div class="actions">
              @if (canConfirmDistinct && matches.canReviewDistinct && reviewId()) {
                <button type="button" (click)="allowDistinct.emit(); dismissed.set(true)">Confirm Separate Facility</button>
              }
              <button type="button" (click)="dismissed.set(true)">Cancel</button>
            </div>
          </section>
        }
      }
    `,
    styles: `
      .facility-matches { padding: .75rem; background: var(--hub-surface, #fff); border: 1px solid var(--hub-border, #718197); border-radius: .35rem; }
      h3 { font-size: 1.05rem; margin: 0 0 .5rem; }
      article { border-top: 1px solid var(--hub-border, #718197); padding: .55rem 0; }
      p { margin: .2rem 0; }
      .actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
      button, a { overflow-wrap: anywhere; }
      button { min-height: 40px; }
    `
})
export class FacilityMatchReviewComponent {
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    private readonly changes = new Subject<string>();
    private draftValue: FacilityMatchDraft;
    private explicitConflict?: FacilityConflict;
    private fingerprint?: string;
    readonly result = signal<FacilityConflict | null>(null);
    readonly dismissed = signal(false);
    readonly reviewId = signal<number | null>(null);
    readonly isPossible = (match: FacilityMatch) => !match.definitive;
    @Input() allowReconcile = false;
    @Input() canConfirmDistinct = false;
    @Input() busy = false;
    readonly useExisting = output<FacilityMatch>();
    readonly reconcile = output<FacilityMatch>();
    readonly allowDistinct = output<void>();

    @Input() set draft(value: FacilityMatchDraft) {
        this.draftValue = value;
        const fingerprint = JSON.stringify(value ?? {});
        if (this.fingerprint === fingerprint) return;
        this.fingerprint = fingerprint;
        this.explicitConflict = undefined;
        this.result.set(null);
        this.changes.next(fingerprint);
    }
    get draft(): FacilityMatchDraft { return this.draftValue; }

    @Input() set conflict(value: FacilityConflict | undefined) {
        this.explicitConflict = value;
        if (value) this.show(value);
        else this.result.set(null);
    }

    constructor() {
        this.changes.pipe(distinctUntilChanged(), switchMap(value => {
            const draft: FacilityMatchDraft = JSON.parse(value);
            if ((draft.name?.trim().length ?? 0) < 3 && (draft.address?.trim().length ?? 0) < 3 && !draft.sourceKey)
                return of(null);
            let params = new HttpParams();
            for (const [key, item] of Object.entries(draft)) {
                if (item != null && item !== '') params = params.set(key, item);
            }
            return timer(350).pipe(switchMap(() => this.http.get<FacilityConflict>('/api/facilities/matches', {params})),
                catchError(() => of(null)));
        }), filter(() => !this.explicitConflict), takeUntilDestroyed(this.destroy)).subscribe(value => this.show(value));
    }

    location(value?: FacilityMatchDraft): string {
        return [value?.address, value?.city, [value?.region, value?.postalCode].filter(Boolean).join(' ')]
            .filter(Boolean).join(', ') || 'Address unavailable';
    }

    toggle(id: number): void { this.reviewId.set(this.reviewId() === id ? null : id); }

    private show(value: FacilityConflict | null): void {
        this.result.set(value);
        this.dismissed.set(false);
        this.reviewId.set(null);
    }
}

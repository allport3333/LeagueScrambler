import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface RecordSummary {
    id: number; name: string; address: string; city: string; region: string; postalCode: string;
    pickup: {id: string; name: string}[];
    events: {leagueId: number; name: string; eventTypeId: number}[];
}
interface Pair { reason: string; definitive: boolean; facilities: [RecordSummary, RecordSummary]; }

@Component({
    selector: 'app-facility-duplicate-audit',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RouterLink],
    template: `
      <details (toggle)="onToggle($event)">
        <summary>Review Possible Duplicate Facilities</summary>
        @if (busy()) { <p role="status">Checking existing facilities&hellip;</p> }
        @for (pair of pairs(); track pair.facilities[0].id + ':' + pair.facilities[1].id) {
          <article>
            <h3>{{ pair.reason }}</h3>
            @for (facility of pair.facilities; track facility.id) {
              <p><a [routerLink]="['/facilities', facility.id]">{{ facility.name }}</a> (ID {{ facility.id }})<br>
                {{ facility.address }} {{ facility.city }} {{ facility.region }} {{ facility.postalCode }}</p>
              @if (facility.events.length || facility.pickup.length) {
                <ul>
                  @for (event of facility.events; track event.leagueId) {
                    <li>{{ event.eventTypeId === 2 ? 'Tournament' : 'League' }} {{ event.name }} (ID {{ event.leagueId }})</li>
                  }
                  @for (session of facility.pickup; track session.id) { <li>Pickup {{ session.name }} ({{ session.id }})</li> }
                </ul>
              } @else { <p>No associated events.</p> }
              <button type="button" [disabled]="busy()" (click)="review(pair, facility)">Review keeping {{ facility.name }}</button>
            }
          </article>
        } @empty { @if (loaded()) { <p>No likely duplicates were found.</p> } }
        @if (selected(); as merge) {
          <form (ngSubmit)="apply()">
            <h3>Merge Confirmed Duplicate</h3>
            <p>Keep {{ merge.target.name }} (ID {{ merge.target.id }}) and move all associations from
              {{ merge.source.name }} (ID {{ merge.source.id }}). The retired record will be retained in the audit history.</p>
            <label>Type <strong>{{ token }}</strong> to confirm
              <input name="confirmation" [(ngModel)]="confirmation" autocomplete="off">
            </label>
            <div class="actions"><button type="submit" [disabled]="confirmation !== token || busy()">Merge Facilities</button>
              <button type="button" (click)="selected.set(null)" [disabled]="busy()">Cancel</button></div>
          </form>
        }
        @if (status()) { <p role="status">{{ status() }}</p> }
      </details>
    `,
    styles: `
      details { max-width: 48rem; margin: 1rem auto; }
      article, form { margin-top: .75rem; padding: .75rem; border: 1px solid var(--hub-border, #718197); border-radius: .35rem; }
      h3 { font-size: 1.1rem; }
      li { overflow-wrap: anywhere; }
      label { display: grid; }
      .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
      button { min-height: 40px; }
    `
})
export class FacilityDuplicateAuditComponent {
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    readonly pairs = signal<Pair[]>([]);
    readonly selected = signal<{source: RecordSummary; target: RecordSummary} | null>(null);
    readonly loaded = signal(false);
    readonly busy = signal(false);
    readonly status = signal('');
    confirmation = '';

    get token(): string {
        const selection = this.selected();
        return selection ? 'Merge ' + selection.source.id + ' into ' + selection.target.id : '';
    }

    onToggle(event: Event): void {
        if ((event.target as HTMLDetailsElement).open && !this.busy()) this.load();
    }

    review(pair: Pair, target: RecordSummary): void {
        this.confirmation = '';
        this.status.set('');
        this.selected.set({source: pair.facilities.find(item => item.id !== target.id)!, target});
    }

    apply(): void {
        const selection = this.selected();
        if (!selection || this.busy() || this.confirmation !== this.token) return;
        this.busy.set(true);
        this.http.post('/api/facilities/merge', {sourceVenueId: selection.source.id, targetVenueId: selection.target.id,
            confirmation: this.confirmation}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: () => {
                    this.selected.set(null);
                    this.status.set('Facilities merged. Existing event associations have been retained.');
                    this.load();
                },
                error: error => { this.busy.set(false); this.status.set(error.error?.message || 'The merge could not be completed.'); }
            });
    }

    private load(): void {
        this.busy.set(true);
        this.http.get<Pair[]>('/api/facilities/duplicate-audit').pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: pairs => { this.pairs.set(pairs); this.busy.set(false); this.loaded.set(true); },
            error: () => { this.busy.set(false); this.status.set('The duplicate audit could not be loaded.'); }
        });
    }
}

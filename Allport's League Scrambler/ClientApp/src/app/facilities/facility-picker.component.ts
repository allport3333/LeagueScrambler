import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

interface Venue { id: number; name: string; city: string; postalCode: string; }

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'app-facility-picker',
    imports: [FormsModule],
    template: `
      <div class="facility-picker">
        <label>Find an existing facility <input [(ngModel)]="query" [ngModelOptions]="standalone"
          maxlength="140" placeholder="Facility, city, or ZIP"></label>
        <button type="button" (click)="search()">Search Facilities</button>
        <label>Primary facility
          <select [ngModel]="venueId" (ngModelChange)="venueIdChange.emit($event)" [ngModelOptions]="standalone">
            <option [ngValue]="null">No facility</option>
            @if (venueId && venueName && !choices.some(isSelected)) { <option [ngValue]="venueId">{{ venueName }}</option> }
            @for (choice of choices; track choice.id) {
              <option [ngValue]="choice.id">{{ choice.name }}{{ choice.city ? ' · ' + choice.city : '' }}</option>
            }
          </select>
        </label>
        @if (error) { <p role="alert">{{ error }}</p> }
      </div>
    `,
    styles: `
      .facility-picker { display: grid; gap: .35rem; max-width: 28rem; margin: .55rem 0; }
      label { display: grid; }
      input, select { min-width: 0; min-height: 40px; border: 1px solid var(--hub-border, #718197); border-radius: .25rem;
        color: var(--hub-text, #172534); background: var(--hub-surface, #fff); }
    `
})
export class FacilityPickerComponent implements OnInit {
    @Input() venueId: number | null = null;
    @Input() venueName?: string;
    readonly venueIdChange = output<number | null>();
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    private request?: Subscription;
    readonly standalone = {standalone: true};
    readonly isSelected = (venue: Venue) => venue.id === this.venueId;
    choices: Venue[] = [];
    query = '';
    error = '';

    ngOnInit(): void { this.search(); }

    search(): void {
        this.request?.unsubscribe();
        this.error = '';
        const params = new HttpParams().set('q', this.query).set('directory', true);
        this.request = this.http.get<Venue[]>('/api/pickup/venues', {params})
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: choices => { this.choices = [...this.choices.filter(this.isSelected), ...choices]
                    .filter((choice, index, rows) => rows.findIndex(row => row.id === choice.id) === index); },
                error: () => { this.error = 'Facilities could not be loaded.'; }
            });
    }
}

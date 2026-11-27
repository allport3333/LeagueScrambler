import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

interface Venue { id: number; name: string; city: string; region: string; postalCode: string; }

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'app-facility-picker',
    imports: [FormsModule, MatButtonModule],
    template: `
      <div class="facility-picker">
        <div class="facility-search">
          <label class="facility-field">
            <span>Find an existing facility</span>
            <input class="form-control" type="search" [(ngModel)]="query" [ngModelOptions]="standalone"
              maxlength="140" placeholder="Facility name, city, or ZIP" [disabled]="disabled"
              (keydown.enter)="$event.preventDefault(); search()">
          </label>
          <button mat-stroked-button type="button" [disabled]="disabled || searching" (click)="search()">Search Facilities</button>
        </div>
        @if (error) { <p role="alert">{{ error }}</p> }
        @else if (searched && !searching && noMatches) { <p role="status">No matching facilities. Try a different name, city, or ZIP.</p> }
        <label class="facility-field">Primary facility
          <select class="form-control" [ngModel]="venueId" (ngModelChange)="venueIdChange.emit($event)"
            [ngModelOptions]="standalone" [disabled]="disabled">
            <option [ngValue]="null">No facility</option>
            @if (venueId && venueName && !choices.some(isSelected)) { <option [ngValue]="venueId">{{ venueName }}</option> }
            @for (choice of choices; track choice.id) {
              <option [ngValue]="choice.id">{{ optionLabel(choice) }}</option>
            }
          </select>
        </label>
        @if (selection; as name) { <p class="selected-facility">Selected: <strong>{{ name }}</strong></p> }
      </div>
    `,
    styleUrl: './facility-form.css',
    styles: `
      .facility-picker { display: grid; gap: .55rem; min-width: 0; }
      .facility-search { display: flex; gap: .4rem; align-items: end; min-width: 0; }
      .facility-search .facility-field { flex: 1 1 0; }
      .facility-search button { flex: none; min-height: 2.65rem; }
      .facility-picker p { margin: 0; font-size: .875rem; overflow-wrap: anywhere; }
      .selected-facility { color: var(--hub-muted, #52677c); }
      @media (max-width: 420px) {
        .facility-search { flex-wrap: wrap; }
        .facility-search .facility-field { flex-basis: 100%; }
      }
    `
})
export class FacilityPickerComponent implements OnInit {
    @Input() venueId: number | null = null;
    @Input() venueName?: string;
    @Input() disabled = false;
    readonly venueIdChange = output<number | null>();
    private readonly http = inject(HttpClient);
    private readonly destroy = inject(DestroyRef);
    private request?: Subscription;
    readonly standalone = {standalone: true};
    readonly isSelected = (venue: Venue) => venue.id === this.venueId;
    choices: Venue[] = [];
    query = '';
    error = '';
    searching = false;
    searched = false;
    noMatches = false;

    get selection(): string | undefined {
        if (this.venueId == null) return undefined;
        const match = this.choices.find(this.isSelected);
        return match ? this.optionLabel(match) : this.venueName;
    }

    optionLabel(venue: Venue): string {
        const locality = [venue.city, [venue.region, venue.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        return locality ? venue.name + ' \u00b7 ' + locality : venue.name;
    }

    ngOnInit(): void { this.search(); }

    search(): void {
        this.request?.unsubscribe();
        this.error = '';
        this.searching = true;
        const params = new HttpParams().set('q', this.query).set('directory', true);
        this.request = this.http.get<Venue[]>('/api/pickup/venues', {params})
            .pipe(takeUntilDestroyed(this.destroy)).subscribe({
                next: choices => {
                    this.searching = false;
                    this.searched = true;
                    this.noMatches = !choices.length;
                    this.choices = [...this.choices.filter(this.isSelected), ...choices]
                    .filter((choice, index, rows) => rows.findIndex(row => row.id === choice.id) === index); },
                error: () => { this.searching = false; this.error = 'Facilities could not be loaded.'; }
            });
    }
}

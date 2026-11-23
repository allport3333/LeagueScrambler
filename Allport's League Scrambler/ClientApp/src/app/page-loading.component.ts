import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-page-loading',
    standalone: true,
    imports: [MatProgressSpinnerModule],
    template: '<div class="page-loader" role="status"><mat-spinner diameter="40" aria-hidden="true"></mat-spinner><span>{{ label }}</span></div>'
})
export class PageLoadingComponent {
    @Input() label = 'Loading…';
}

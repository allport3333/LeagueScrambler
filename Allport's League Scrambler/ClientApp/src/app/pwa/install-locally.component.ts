import { Component, ChangeDetectionStrategy } from '@angular/core';
import { PwaService } from './pwa.service';

@Component({
    selector: 'app-install-locally',
    templateUrl: './install-locally.component.html',
    styleUrls: ['./install-locally.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InstallLocallyComponent {
 constructor(public pwa: PwaService) {}
}

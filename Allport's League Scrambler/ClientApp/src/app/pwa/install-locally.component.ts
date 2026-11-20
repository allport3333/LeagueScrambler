import { Component } from '@angular/core';
import { PwaService } from './pwa.service';

@Component({
 selector: 'app-install-locally',
 templateUrl: './install-locally.component.html',
 styleUrls: ['./install-locally.component.css']
})
export class InstallLocallyComponent {
 constructor(public pwa: PwaService) {}
}

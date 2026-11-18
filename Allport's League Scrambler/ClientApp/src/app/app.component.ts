import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'app';

  constructor(private router: Router) { }

  get isPlayerStandingsPage(): boolean {
    return this.router.url.split(/[?#]/)[0].replace(/\/$/, '') === '/standings';
  }
}

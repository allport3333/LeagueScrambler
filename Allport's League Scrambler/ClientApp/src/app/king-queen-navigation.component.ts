import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-king-queen-navigation',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatTabsModule, RouterModule],
    template: `
        <nav mat-tab-nav-bar [tabPanel]="panel" [mat-stretch-tabs]="false" mat-align-tabs="center" aria-label="King &amp; Queen">
            <a mat-tab-link routerLink="/standings" routerLinkActive #standings="routerLinkActive" [active]="standings.isActive">Standings</a>
            <a mat-tab-link routerLink="/kqmatchups" routerLinkActive #matchups="routerLinkActive" [active]="matchups.isActive">Matchups</a>
        </nav>
        <mat-tab-nav-panel #panel><router-outlet></router-outlet></mat-tab-nav-panel>
    `
})
export class KingQueenNavigationComponent {}

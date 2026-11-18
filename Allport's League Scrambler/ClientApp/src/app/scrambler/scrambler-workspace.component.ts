import { Component } from '@angular/core';
import { Router } from '@angular/router';

// Both child routes retain this parent and its existing Scrambler instance.
// No algorithm/form/team state is copied into a second management controller.
@Component({
    selector: 'app-scrambler-workspace',
    template: '<app-scrambler-component [workspaceSection]="section"></app-scrambler-component><router-outlet></router-outlet>'
})
export class ScramblerWorkspaceComponent {
    constructor(private router: Router) { }
    get section(): string {
        return this.router.url.split(/[?#]/)[0] === '/league-management' ? 'league-management' : 'scrambler';
    }
}

@Component({ selector: 'app-workspace-route', template: '' })
export class WorkspaceRouteComponent { }

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TeamUpdateService {
    private teamUpdateSource = new Subject<void>();
    teamUpdated$ = this.teamUpdateSource.asObservable();

    notifyTeamUpdate(): void {
        this.teamUpdateSource.next();
    }
}

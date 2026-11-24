import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TournamentRoundsComponent } from './tournament-rounds.component';

@Component({
    selector: 'app-tournament-matchups',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [TournamentRoundsComponent],
    template: '<app-tournament-rounds [leagueId]="leagueId" [readOnly]="true" />',
    styles: [':host { display: block; padding: 16px; }']
})
export class TournamentMatchupsComponent {
    protected readonly leagueId = Number(inject(ActivatedRoute).snapshot.paramMap.get('leagueId'));
}

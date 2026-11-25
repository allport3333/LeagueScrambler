import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LeagueService } from './services/league.service';
import { ActivatedRoute } from '@angular/router';
import { TournamentRoundsComponent } from './tournament-rounds.component';

@Component({
    selector: 'app-tournament-matchups',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [TournamentRoundsComponent],
    template: '<app-tournament-rounds [leagueId]="leagueId" [readOnly]="true" />',
    styles: [':host { display: block; padding: 16px; }']
})
export class TournamentMatchupsComponent implements OnInit {
    protected readonly leagueId = Number(inject(ActivatedRoute).snapshot.paramMap.get('leagueId'));
    private readonly leagueService = inject(LeagueService);
    private readonly destroy = inject(DestroyRef);

    ngOnInit(): void {
        this.leagueService.selectNavigationLeague(this.leagueId)
            .pipe(takeUntilDestroyed(this.destroy)).subscribe();
    }
}

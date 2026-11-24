import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface PrintPlayer { firstName: string; lastName: string; }
interface PrintTeam { kingQueenTeamId?: number; players: PrintPlayer[]; scores?: { game: number; points: number }[]; }

@Component({
    selector: 'app-matchup-print-sheet',
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './matchup-print-sheet.component.html'
})
export class MatchupPrintSheetComponent {
    @Input() listOfTeams: PrintTeam[] = [];
    @Input() byePlayers: PrintPlayer[] = [];
    @Input() selectedRounds = 1;
    @Input() getMatchCourt: (team: PrintTeam) => unknown = () => null;
    @Input() title = '';
    @Input() roundNumber?: number;

    scoreAt(team: number, game: number) { return this.listOfTeams[team]?.scores?.find(score => score.game === game)?.points; }
    total(team: number) {
        const scores = this.listOfTeams[team]?.scores;
        return scores?.length ? scores.reduce((sum, score) => sum + score.points, 0) : undefined;
    }
}

@Component({
    selector: 'app-matchup-print-six',
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './matchup-print-six.component.html'
})
export class MatchupPrintSixComponent extends MatchupPrintSheetComponent {}
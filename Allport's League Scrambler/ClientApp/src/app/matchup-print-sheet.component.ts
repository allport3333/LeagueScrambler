import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { MatchupPrintPlayer as PrintPlayer, MatchupPrintTeam as PrintTeam, matchupScore, matchupTotal } from './matchup-print';

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

    scoreAt(team: number, game: number) { return matchupScore(this.listOfTeams[team], game); }
    total(team: number) { return matchupTotal(this.listOfTeams[team]); }
}

@Component({
    selector: 'app-matchup-print-six',
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './matchup-print-six.component.html'
})
export class MatchupPrintSixComponent extends MatchupPrintSheetComponent {}
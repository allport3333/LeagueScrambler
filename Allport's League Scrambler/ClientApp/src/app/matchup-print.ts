export interface MatchupPrintPlayer {
    firstName: string;
    lastName: string;
    isSub?: boolean;
    isSubScore?: boolean;
}
export interface MatchupPrintTeam {
    kingQueenTeamId?: number;
    players: MatchupPrintPlayer[];
    scores?: {game: number; points: number}[];
}

export function matchupScore(team: MatchupPrintTeam | undefined, game: number): number | undefined {
    return team?.scores?.find(score => score.game === game)?.points;
}

export function matchupTotal(team: MatchupPrintTeam | undefined): number | undefined {
    const scores = team?.scores;
    return scores?.length ? scores.reduce((sum, score) => sum + score.points, 0) : undefined;
}

export function renderMatchupPrint(window: Window, title: string, content: string, styles = ''): void {
    window.document.open();
    window.document.write(`<!doctype html>
<html lang="en">
<head>
    <title>${title}</title>
    <style>
        @page { size: portrait; margin: 1cm; }
        body { font-family: Arial, sans-serif; }
        app-matchup-print-sheet, app-matchup-print-six { display: block; }
        @media print {
            body { padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 5px; text-align: center; }
        }
        ${styles}
    </style>
</head>
<body>${content}</body>
</html>`);
    window.document.close();
}

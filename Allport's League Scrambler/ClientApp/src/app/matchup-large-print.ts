import { MatchupPrintPlayer, MatchupPrintTeam, matchupScore, matchupTotal, renderMatchupPrint } from './matchup-print';

const densities = {
    'landscape-large': { columns: 1, matchups: 2, names: 15, headings: 16, scores: 16, label: 13, padding: 2 },
    'landscape-balanced': { columns: 2, matchups: 4, names: 13, headings: 14, scores: 14, label: 11, padding: 2 },
    'landscape-compact': { columns: 2, matchups: 6, names: 11, headings: 12, scores: 12, label: 10, padding: 1.5 }
} as const;

export type LandscapePrintMode = keyof typeof densities;

export function isLandscapePrintMode(mode: string | number): mode is LandscapePrintMode {
    return Object.hasOwn(densities, mode);
}

interface LargePrintRound {
    roundNumber?: number;
    teams: readonly MatchupPrintTeam[];
    byes: readonly MatchupPrintPlayer[];
    games: number;
    court?: (teamIndex: number) => string;
}

const styles = `
    @page { size: landscape; margin: 10mm; }
    body { margin: 0; color: black; background: white; }
    .large-print-page { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .large-print-page + .large-print-page { break-before: page; }
    .large-print-page > :is(thead, tbody) > tr > td { padding: 0; border: 0; text-align: start; }
    .large-print-page > thead { display: table-header-group; }
    .large-print-page > tbody > tr { break-inside: avoid; }
    .large-print-page > tbody > tr > td { vertical-align: top; }
    .large-print-page > tbody > tr > td + td { padding-left: 10pt; }
    .large-print-page > tbody > tr:not(:first-child) > td { border-top: 1pt solid black; }
    .large-print-page h1, .large-print-page .round-number { text-align: center; margin: 0 0 4pt; }
    .large-print-page h1 { font-size: 22pt; overflow-wrap: anywhere; }
    .round-number { font-size: 17pt; font-weight: bold; }
    .large-matchup, .large-byes { break-inside: avoid; padding: 5pt 0; }
    .large-matchup h2, .large-byes h2 { font-size: var(--headings); margin: 0 0 4pt; break-after: avoid; }
    .large-matchup table, .large-byes table { width: 100%; table-layout: fixed; border-collapse: collapse; }
    .large-matchup :is(th, td), .large-byes :is(th, td) {
        border: 1pt solid black; padding: var(--padding) 3pt; line-height: 1.15; overflow-wrap: anywhere;
    }
    .large-matchup tr, .large-byes tr { break-inside: avoid; }
    .large-roster th { font-size: var(--headings); }
    .large-roster td, .large-byes td { font-size: var(--names); text-align: start; }
    .large-roster small, .large-byes small { font-size: var(--label); }
    .large-scores { break-inside: avoid; margin-top: 4pt; }
    .large-scores caption { text-align: start; font-size: var(--label); font-weight: bold; padding-bottom: 2pt; }
    .large-scores th { font-size: 13pt; }
    .large-scores td { font-size: var(--scores); font-weight: bold; text-align: center; }
    .landscape-compact h1 { font-size: 19pt; }
    .landscape-compact .round-number { font-size: 14pt; }
    .landscape-compact .large-matchup { padding-block: 2pt; }
    .landscape-compact .large-matchup :is(th, td) { line-height: 1.08; }
    .landscape-compact .large-scores { margin-top: 2pt; }
    .landscape-compact .large-matchup h2 { margin-bottom: 2pt; }
    .landscape-compact .large-roster tr > :is(th, td) { padding-block: 1pt; }
    .landscape-compact .large-scores:not(.continued) caption {
        position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
    }
    .court-number { display: inline-block; margin-inline-start: .4em; }
    @media print { body { margin: 0; padding: 0; } }
`;

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fullName(player: MatchupPrintPlayer | undefined): string {
    if (!player) return '';
    const name = escapeHtml([player.firstName, player.lastName].filter(Boolean).join(' '));
    return player.isSub || player.isSubScore ? name + ' <small>(Sub)</small>' : name;
}

function scores(first: MatchupPrintTeam, second: MatchupPrintTeam, index: number, games: number): string {
    const lastGame = Math.max(games, ...[first, second].flatMap(team => (team.scores ?? []).map(score => score.game)));
    const columns = Array.from({length: lastGame}, (_, game) => game + 1);
    // Keep game columns readable even in a printer's portrait override.
    const tables: string[] = [];
    do {
        const group = columns.splice(0, 5);
        const final = !columns.length;
        const cells = (team: MatchupPrintTeam, number: number) => `<tr><th scope="row">Team ${number}</th>
            ${group.map(game => `<td>${matchupScore(team, game) ?? ''}</td>`).join('')}
            ${final ? `<td>${matchupTotal(team) ?? ''}</td>` : ''}</tr>`;
        tables.push(`<table class="large-scores${tables.length ? ' continued' : ''}"><caption>${tables.length ? 'Scores continued' : 'Scores'}</caption>
            <thead><tr><th scope="col">Team</th>${group.map(game => `<th scope="col">Game ${game}</th>`).join('')}
            ${final ? '<th scope="col">Total</th>' : ''}</tr></thead>
            <tbody>${cells(first, index + 1)}${cells(second, index + 2)}</tbody></table>`);
    } while (columns.length);
    return tables.join('');
}

function matchup(round: LargePrintRound, index: number): string {
    const [first, second] = round.teams.slice(index, index + 2);
    const court = round.court?.(index);
    const roster = Array.from({length: Math.max(first.players.length, second.players.length)}, (_, row) =>
        `<tr><td>${fullName(first.players[row])}</td><td>${fullName(second.players[row])}</td></tr>`).join('');
    return `<section class="large-matchup">
        <h2>Matchup ${index / 2 + 1} · Team ${index + 1} vs Team ${index + 2}
            ${court ? `<span class="court-number">Court ${escapeHtml(court)}</span>` : ''}</h2>
        <table class="large-roster" aria-label="Full names by team"><thead><tr>
            <th scope="col">Team ${index + 1}</th><th scope="col">Team ${index + 2}</th>
        </tr></thead><tbody>${roster}</tbody></table>
        ${scores(first, second, index, round.games)}
    </section>`;
}

export function renderLargeMatchupPrint(popup: Window, title: string, rounds: readonly LargePrintRound[], mode: LandscapePrintMode): void {
    const { columns, matchups, names, headings, scores, label, padding } = densities[mode];
    const content = rounds.map(round => {
        const heading = `<thead><tr><td colspan="${columns}"><h1>${escapeHtml(title)}</h1>
            ${round.roundNumber == null ? '' : `<p class="round-number">Round ${round.roundNumber}</p>`}</td></tr></thead>`;
        const byes = round.byes.length ? `<section class="large-byes"><h2>Bye Players</h2>
            <table aria-label="Bye players"><tbody>${round.byes.map(player => `<tr><td>${fullName(player)}</td></tr>`).join('')}</tbody></table>
        </section>` : '';
        const cards = Array.from({length: Math.floor(round.teams.length / 2)}, (_, index) => matchup(round, index * 2));
        const pages: string[] = [];
        for (let start = 0; start < Math.max(1, cards.length); start += matchups) {
            const pageCards = cards.slice(start, start + matchups);
            const rows: string[] = [];
            for (let index = 0; index < pageCards.length; index += columns) {
                const cells = Array.from({length: columns}, (_, column) =>
                    `<td>${pageCards[index + column] ?? ''}</td>`).join('');
                rows.push(`<tr>${cells}</tr>`);
            }
            if (start + matchups >= cards.length && byes) rows.push(`<tr><td colspan="${columns}">${byes}</td></tr>`);
            pages.push(`<table class="large-print-page ${mode}" role="presentation">${heading}<tbody>${rows.join('')}</tbody></table>`);
        }
        return pages.join('');
    }).join('');
    const typography = `:root { --names: ${names}pt; --headings: ${headings}pt; --scores: ${scores}pt;
        --label: ${label}pt; --padding: ${padding}pt; }`;
    renderMatchupPrint(popup, 'Print Matchups', content, styles + typography);
}

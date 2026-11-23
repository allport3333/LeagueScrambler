const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('../../tests/functional/node_modules/@playwright/test');
const serveAsset = require('../../tests/functional/scripts/fixture-asset.cjs');
const { BASE_URL } = require('../../tests/functional/helpers/safety.cjs');

const auditBefore = process.argv.includes("--audit-before");
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1600, 1920, 2560, 3440];
const out = process.env.LEAGUE_TEST_OUT;
const league = { id: 101, leagueName: 'Harbor League' };
const otherLeague = { id: 102, leagueName: 'Court League' };
const divisions = ['Gold', 'Silver'];
const matches = Array.from({ length: 8 }, (_, index) => ({
    division: divisions[index % 2], team1Id: index * 2 + 1, team2Id: index * 2 + 2,
    team1Name: ['The Harbor Aces', 'Silver Spikers', 'A Team With a Long Name', 'Side Out'][index % 4],
    team2Name: 'Court Rockets ' + (index + 1)
}));
const date = offset => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    return [day.getFullYear(), day.getMonth() + 1, day.getDate()].map(n => String(n).padStart(2, '0')).join('-') + 'T12:00:00';
};
const roster = [
    { id: 1, firstName: 'Harbor', lastName: 'Player', isMale: true, gender: 'Male' },
    { id: 2, firstName: 'Jordan', lastName: 'Wellington', isMale: false, gender: 'Female' },
    { id: 3, firstName: 'Casey', lastName: 'Bell', isMale: true, gender: 'Male' }
];
const teams = [
    { id: 1, teamId: 1, teamName: 'Harbor Aces', division: 'Gold', wins: 3, losses: 1, totalPoints: 47 },
    { id: 2, teamId: 2, teamName: 'Court Rockets', division: 'Gold', wins: 2, losses: 2, totalPoints: 40 },
    { id: 3, teamId: 3, teamName: 'Silver Spikers', division: 'Silver', wins: 3, losses: 1, totalPoints: 45 }
];
const score = { roundId: 1, score: 15, roundScore: 15, roundWon: true, isSubScore: 0, date: date(0), scrambleNumber: 1 };
const standings = { maxRounds: 1, playerScores: roster.map(player => ({
    playerId: player.id, playerName: player.firstName + ' ' + player.lastName, isMale: player.isMale,
    scores: [score], totalScore: 15, leagueDivisionId: 1, leagueDivisionCode: 'Gold'
})) };
const schedule = [{ weekNumber: 1, date: date(0), matches }, { weekNumber: 2, date: date(7), matches: [] }];
assert(out && process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(out, { recursive: true });

async function run() {
    const browser = await chromium.launch({ channel: process.env.LEAGUE_BROWSER_CHANNEL || 'msedge' });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1920, height: 1050 } });
        let release;
        const initialResponse = new Promise(resolve => { release = resolve; });
        let requests = 0;
        let holdHarbor = false;
        let releaseHarbor;
        const harborResponse = new Promise(resolve => { releaseHarbor = resolve; });
        await context.route('**/*', async route => {
            if (new URL(route.request().url()).hostname === 'fonts.gstatic.com' && !new URL(route.request().url()).pathname.startsWith('/s/materialicons/')) return route.abort();
            if (await serveAsset(route)) return;
            const url = new URL(route.request().url());
            if (url.origin !== BASE_URL || !url.pathname.startsWith('/api/')) return route.abort();
            const endpoint = url.pathname.toLowerCase();
            let json = [];
            if (/\/getplayers(?:\/|$)|\/selectleague\//.test(endpoint)) json = roster;
            if (endpoint.endsWith('/isauthenticated')) json = true;
            if (endpoint.endsWith('/getusersrole')) json = { role: 'Admin' };
            if (endpoint.endsWith('/getusersplayer')) json = { playerId: 1 };
            if (endpoint.includes('getsettingvalue')) {
                const setting = url.searchParams.get('settingName');
                json = { settingValue: setting === 'standingsType' ? 'round' : setting === 'dayOfLeague' ? 'Sunday' : '0' };
            }
            if (endpoint.includes('/availableleagueplayers/')) json = { players: roster, members: roster.map(player => ({ playerId: player.id })), divisions: [{ id: 1, name: 'Gold', code: 'G' }] };
            if (endpoint.endsWith('/getprofile')) json = { firstName: 'Harbor', lastName: 'Player', gender: 'Female' };
            if (endpoint.includes('/getdetailedperformancestats')) json = {
                totalScores: 15, totalWins: 1,
                individualRounds: [{ id: 1, roundNumber: 1, roundScore: 15, roundWon: true, dateOfTeam: date(0), scrambleNumber: 1 }],
                scrambleTotals: [{ scrambleNumber: 1, dateOfTeam: date(0), totalScore: 15, wins: 1 }],
                teamMembers: roster.slice(1).map(player => ({
                    id: 1, playerId: player.id, isMale: player.isMale, playerName: player.firstName + ' ' + player.lastName
                }))
            };
            if (endpoint.includes('/getbyleague/')) json = standings;
            if (endpoint.includes('/league-standings/')) json = teams;
            if (endpoint.includes('/getteams/')) json = teams;
            if (endpoint.includes('/getallteamswithplayers/')) json = teams.map(team => ({
                ...team, totalWins: team.wins, totalLosses: team.losses,
                players: roster.map(p => ({ id: p.id, fullName: p.firstName + ' ' + p.lastName, isMale: p.isMale }))
            }));
            if (endpoint.endsWith('/getsignedinplayers')) json = [{ ...roster[2], playerId: 3 }];
            if (endpoint.includes('/selectedleaguescrambles/')) json = [{ id: 1, scrambleNumber: 1, dateOfTeam: date(0) }];
            if (endpoint.includes('getkingqueenteamsbyscramblenumber')) json = {
                kingQueenTeams: roster.slice(0, 2).map(player => ({
                    kingQueenTeam: { id: player.id, kingQueenPlayers: [], kingQueenRoundScores: [score] }, players: [player]
                }))
            };
            if (endpoint.includes('signinlockstatus')) json = false;
            if (/\/get(user)?leagues$/.test(endpoint)) json = [league, otherLeague];
            if (endpoint.includes('/available-dates/')) json = [date(0)];
            if (endpoint.includes('/getteamscores/')) json = teams.flatMap((team, i) => [15, 9, 16].map((teamScore, j) => ({
                teamId: team.id, teamName: team.teamName, teamScore, wonGame: j !== 1,
                date: date(0), opponentsTeamName: teams[(i + 1) % teams.length].teamName
            })));
            if (endpoint === '/api/schedulemanagement/101') json = {
                leagueId: 101, revision: 'fixture', today: date(0).slice(0, 10), defaultDay: 'Sunday',
                entries: [{ id: 1, kind: 'game', weekNumber: 1, date: date(0).slice(0, 10), team1Id: 1, team2Id: 2, description: 'Court 1' }],
                teams: teams.map(team => ({ ...team, divisionKey: team.division })),
                divisions: [{ id: 1, name: 'Gold', code: 'G' }], locked: []
            };
            if (endpoint.includes('/getleagueschedule/')) {
                if (++requests === 1 && !process.argv.includes("--baseline")) {
                    await initialResponse;
                    return route.fulfill({ status: 500, json: {} });
                }
                if (endpoint.endsWith('/102')) json = [{ weekNumber: 1, date: date(0), matches: [{ ...matches[0], division: 'Recreation' }] }];
                else {
                    if (holdHarbor) await harborResponse;
                    json = schedule;
                }
            }
            return route.fulfill({ json });
        });
        const page = await context.newPage();
        const errors = [];
        const baseline = process.argv.includes("--baseline");
        page.on('pageerror', error => errors.push(error.message));
        const url = BASE_URL + '/league-dashboard?leagueId=101&tab=schedule';
        await page.goto(url);
        if (baseline) {
            await expect(page.getByText('The Harbor Aces', { exact: true }).first()).toBeVisible();
            for (const width of [390, 1920]) {
                await page.setViewportSize({ width, height: 1050 });
                await page.screenshot({ path: path.join(out, 'baseline-schedule-' + width + '.png'), fullPage: true, animations: 'disabled' });
            }
            return;
        }
        await expect(page.locator('app-page-loading:visible')).toHaveCount(1);
        await expect(page.locator('.schedule-match')).toHaveCount(0);
        await page.screenshot({ path: path.join(out, 'schedule-initial-loading.png') });
        release();
        const retry = page.getByRole('button', { name: 'Retry Schedule' });
        await expect(retry).toBeVisible();
        await expect(page.locator('app-page-loading:visible')).toHaveCount(0);
        await retry.click();
        const sections = page.locator('.schedule-division');
        await expect(sections).toHaveCount(2);
        for (const [i, name] of divisions.entries()) {
            await expect(sections.nth(i).getByRole('heading')).toHaveText(name + ' Division');
            await expect(sections.nth(i).locator('.schedule-match')).toHaveCount(4);
        }
        assert.equal(requests, 2);
        const prev = page.getByRole('button', { name: 'Previous Week' });
        const next = page.getByRole('button', { name: 'Next Week' });
        await expect(prev).toBeDisabled();
        await next.click();
        await expect(next).toBeDisabled();
        await expect(page.getByText('No matchups scheduled for this week.')).toBeVisible();
        await prev.click();
        await expect(sections).toHaveCount(2);
        await next.click();
        await page.getByRole('button', { name: 'Current Week' }).click();
        await expect(sections).toHaveCount(2);
        assert.equal(requests, 2);
        for (const width of widths) {
            await page.setViewportSize({ width, height: 1050 });
            const positions = await sections.first().locator('.schedule-match').evaluateAll(cards =>
                cards.map(card => ({ x: card.offsetLeft, y: card.offsetTop, width: card.clientWidth })));
            if (width >= 1920) assert(positions.every(card => card.y === positions[0].y));
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.join(out, 'schedule-light-' + width + '.png'), fullPage: true });
        }
        const contrastChecks = [];
        async function checkContrast(selector, label) {
            const element = page.locator(selector).filter({ visible: true }).first();
            await expect(element, label).toBeVisible();
            const colors = await element.evaluate(target => {
                const fg = getComputedStyle(target).color;
                let bg;
                for (let el = target; el; el = el.parentElement) {
                    const color = getComputedStyle(el).backgroundColor;
                    if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') { bg = color; break; }
                }
                return { fg, bg: bg || 'rgb(255, 255, 255)' };
            });
            const luminance = value => value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number)
                .map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
                .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
            const pair = [luminance(colors.fg), luminance(colors.bg)].sort((a, b) => b - a);
            const ratio = (pair[0] + .05) / (pair[1] + .05);
            contrastChecks.push({ label, ...colors, ratio });
            if (!auditBefore) assert(ratio >= 4.5, label + ': ' + JSON.stringify({ ...colors, ratio }));
        }
        async function chooseTheme(label) {
            await page.getByRole('button', { name: 'Account', exact: true }).click();
            await page.getByRole('menuitem', { name: 'Appearance' }).click();
            await page.getByRole('radio', { name: label }).check();
            await expect(page.getByRole('radio', { name: label })).toBeChecked();
            await page.getByRole('button', { name: 'Done' }).click();
        }
        for (const [name, id] of [['Dark Navy', 'navy'], ['Charcoal', 'charcoal'], ['Classic Light', 'classic']]) {
            await page.setViewportSize({ width: 1920, height: 1050 });
            await chooseTheme(name);
            await expect(page.locator('html')).toHaveAttribute('data-theme', id);
            await page.reload();
            await expect.poll(() => page.locator('html').evaluate(element => element.dataset.theme || 'classic')).toBe(id);
            await expect(sections).toHaveCount(2);
            await page.screenshot({ path: path.join(out, id + '-schedule-1920.png'), fullPage: true });
            await page.getByRole('button', { name: 'Account', exact: true }).click();
            await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
            await page.screenshot({ path: path.join(out, id + '-account-menu.png'), animations: 'disabled' });
            await page.keyboard.press('Escape');
            await page.getByRole('combobox', { name: 'Scheduled week' }).click();
            await expect(page.getByRole('option', { name: /Week 2/ })).toBeVisible();
            await page.screenshot({ path: path.join(out, id + '-week-picker.png') });
            await page.keyboard.press('Escape');
            await page.getByRole('button', { name: 'Full Schedule' }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.screenshot({ path: path.join(out, id + '-full-schedule.png') });
            await page.getByRole('button', { name: 'Close full schedule' }).click();
            await page.setViewportSize({ width: 390, height: 900 });
            await page.screenshot({ path: path.join(out, id + '-schedule-390.png'), fullPage: true });
            await page.getByRole('button', { name: 'Open navigation' }).click();
            await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByText('Appearance')).toBeVisible();
            await page.screenshot({ path: path.join(out, id + '-mobile-navigation.png'), animations: 'disabled' });
            await page.getByRole('button', { name: 'Close navigation' }).click();
            for (const [route, label] of [['/', 'home'], ['/install-locally', 'install'], ['/league-dashboard', 'team-standings'], ['/league-dashboard', 'individual-scores'], ['/team-scores', 'league-teams'], ['/scrambler', 'scrambler'], ['/team-scores', 'scores'],
                ['/standings', 'player-standings'], ['/kqmatchups', 'matchups'], ['/fetch-data', 'players'],
                ['/player-stats-tabs/1?leagueId=101', 'profile'], ['/league-management', 'management'],
                ['/sign-in', 'sign-in'], ['/resetpassword', 'password-reset'], ['/faq', 'faq']]) {
                await page.setViewportSize({ width: 1280, height: 1000 });
                await page.goto(BASE_URL + route);
                await expect(page.locator('app-root nav').first()).toBeVisible();
                await expect(page.locator('app-page-loading:visible'), route).toHaveCount(0);
                if (label === 'individual-scores') {
                    await page.getByRole('tab', { name: 'Individual Team Scores' }).click();
                    await expect(page.locator('.score-card')).toHaveCount(teams.length);
                    if (id !== 'classic' && !auditBefore) {
                        const backgrounds = await page.locator('.score-card').first().evaluate(card =>
                            [card, card.querySelector('table'), card.querySelector('.mat-mdc-header-row'), card.querySelector('tbody tr:nth-child(2)')]
                                .map(element => getComputedStyle(element).backgroundColor));
                        assert.equal(new Set(backgrounds).size, 4, JSON.stringify(backgrounds));
                    }
                }
                if (label === 'profile') {
                    await page.locator('.history-entry summary').first().click();
                    await expect(page.locator('.teammate-links a')).toHaveCount(2);
                    await expect(page.locator('.teammate-links a').first()).toHaveAttribute('href', /player-stats-tabs\/2/);
                    if (id !== 'classic') {
                        await checkContrast('.teammate-links .male-player a', id + ' male teammate');
                        await checkContrast('.teammate-links .female-player a', id + ' female teammate');
                    }
                }
                if (label === 'faq') {
                    const question = page.locator('.faq-question').first();
                    await expect(question).toHaveAttribute('aria-expanded', 'false');
                    await page.screenshot({ path: path.join(out, id + '-faq-collapsed-1280.png'), animations: 'disabled' });
                    await question.focus();
                    await page.keyboard.press('Enter');
                    await expect(question).toHaveAttribute('aria-expanded', 'true');
                    await expect(page.locator('.faq-answer').first()).toBeVisible();
                    if (id !== 'classic') {
                        await checkContrast('.faq-question', id + ' FAQ question');
                        await checkContrast('.faq-answer', id + ' FAQ answer');
                    }
                    await page.keyboard.press('Space');
                    await expect(question).toHaveAttribute('aria-expanded', 'false');
                    await question.click();
                    const linkedItem = page.locator('.faq-item').filter({ has: page.locator('.faq-answer a') }).first();
                    if (await linkedItem.getByRole('button').getAttribute('aria-expanded') !== 'true') await linkedItem.getByRole('button').click();
                    const link = linkedItem.locator('.faq-answer a').first();
                    await link.hover();
                    if (id !== 'classic') await checkContrast('.faq-answer a:hover', id + ' FAQ hovered link');
                }
                if (label === 'league-teams') await page.getByRole('tab', { name: 'League Teams', exact: true }).click();
                if (id !== 'classic') {
                    const selectors = {
                        install: '.install-page .intro', 'team-standings': 'mat-row:nth-child(even) mat-cell',
                        'league-teams': 'app-league-teams mat-card-title', players: '.player-link',
                        'player-standings': '.compact-table tbody td', 'sign-in': '.signed-in-players-table th',
                        matchups: '.extended-background-pink-lastName'
                    };
                    if (selectors[label]) await checkContrast(selectors[label], id + ' ' + label);
                }
                if (label === 'management') {
                    await page.getByRole('tab', { name: 'Manage Schedule' }).click();
                    await expect(page.locator('.schedule-manager h2').first()).toBeVisible();
                    if (id !== 'classic') await checkContrast('.schedule-manager h2', id + ' manage schedule');
                    await page.screenshot({ path: path.join(out, id + '-manage-schedule-1280.png'), animations: 'disabled' });
                    await page.getByRole('tab', { name: 'League Setup' }).click();
                    await expect(page.getByRole('heading', { name: 'Add Division' })).toBeVisible();
                }
                await page.screenshot({ path: path.join(out, id + '-' + label + '-1280.png'), animations: 'disabled' });
                await page.setViewportSize({ width: 390, height: 900 });
                await page.screenshot({ path: path.join(out, id + '-' + label + '-390.png'), animations: 'disabled' });
                if (label === 'profile') {
                    await page.locator('.teammate-links a').first().click();
                    await expect(page).toHaveURL(/player-stats-tabs\/2\?/);
                }
            }
            await page.goto(url);
            await expect(sections).toHaveCount(2);
        }
        const beforeSwitch = requests;
        holdHarbor = true;
        await page.goto(url);
        await expect.poll(() => requests).toBe(beforeSwitch + 1);
        await expect(page.locator('app-page-loading:visible')).toHaveCount(1);
        await page.locator('#leagueDropdown').click();
        await page.getByRole('menuitem', { name: 'Court League' }).click();
        await expect(sections.getByRole('heading')).toHaveText('Recreation Division');
        releaseHarbor();
        await expect(sections.getByRole('heading')).toHaveText('Recreation Division');
        await expect(page.locator('app-page-loading:visible')).toHaveCount(0);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(out, 'contrast-results.json'), JSON.stringify(contrastChecks, null, 2));
        console.log('Division grouping, week navigation, initial failure/retry, and persistent themes passed in Edge.');
    } finally {
        await browser.close();
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });


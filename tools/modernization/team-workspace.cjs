const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('../../tests/functional/node_modules/@playwright/test');
const serveAsset = require('../../tests/functional/scripts/fixture-asset.cjs');
const { BASE_URL } = require('../../tests/functional/helpers/safety.cjs');

const output = process.env.LEAGUE_TEST_OUT;
const baseline = process.argv.includes('--baseline');
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1920, 2560, 3440];
assert(output && process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(output, { recursive: true });
const leagues = [{ id: 101, leagueName: 'Harbor League' }, { id: 102, leagueName: 'Court League' }];
const players = [
    { id: 21, firstName: 'Alexandria', lastName: 'Montgomery-Wellington', isMale: false },
    { id: 22, firstName: 'Jordan', lastName: 'Bell', isMale: true },
    { id: 23, firstName: 'Maria', lastName: 'Jones', isMale: false },
    { id: 24, firstName: 'Unenrolled', lastName: 'Player', isMale: true },
    ...Array.from({ length: 40 }, (_, i) => ({ id: i + 31, firstName: 'Player', lastName: 'Fixture ' + (i + 1), isMale: i % 2 === 0 }))
];
const enrolled = players.filter(player => player.id !== 24);
const rosterPlayer = player => ({ id: player.id, fullName: player.firstName + ' ' + player.lastName, isMale: player.isMale });
const teams = [{ id: 11, teamName: 'Harbor Aces', division: 'Gold', players: [rosterPlayer(players[0])] },
    { id: 12, teamName: 'Court Rockets', division: 'Silver', players: [] }];
const assignments = [];
let failedJordan = false;

async function run() {
    const browser = await chromium.launch({ channel: 'msedge' });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1920, height: 1000 } });
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.hostname === 'fonts.gstatic.com' && !url.pathname.startsWith('/s/materialicons/')) return route.abort();
            if (await serveAsset(route)) return;
            if (url.origin !== BASE_URL || !url.pathname.startsWith('/api/')) return route.abort();
            const endpoint = url.pathname.toLowerCase();
            if (endpoint.endsWith('/addteam')) {
                const request = route.request().postDataJSON();
                assert.deepEqual(request, { leagueId: 101, teamName: 'Net Results', division: 'Silver' });
                const team = { id: 13, teamName: request.teamName, division: request.division, players: [] };
                teams.push(team);
                return route.fulfill({ json: team });
            }
            if (endpoint.endsWith('/addplayertoleagueteam')) {
                const teamId = Number(url.searchParams.get('leagueTeamId'));
                const playerId = Number(url.searchParams.get('playerId'));
                assert.equal(Number(url.searchParams.get('leagueId')), 101);
                assert.equal(teamId, 13);
                const team = teams.find(row => row.id === teamId);
                const player = enrolled.find(row => row.id === playerId);
                assert(player && !team.players.some(row => row.id === playerId));
                if (playerId === 23) {
                    teams[0].players.push(rosterPlayer(player));
                    return route.fulfill({ status: 409, json: {} });
                }
                if (playerId === 22 && !failedJordan) {
                    failedJordan = true;
                    return route.fulfill({ status: 500, json: {} });
                }
                assignments.push(playerId);
                team.players.push(rosterPlayer(player));
                return route.fulfill({ json: { message: 'Added.' } });
            }
            if (route.request().method() !== 'GET') return route.abort();
            let json = [];
            if (endpoint.endsWith('/isauthenticated')) json = true;
            if (endpoint.endsWith('/getusersrole')) json = { role: 'Manager' };
            if (endpoint.endsWith('/getusersplayer')) json = { playerId: null };
            if (/\/get(user)?leagues$/.test(endpoint)) json = leagues;
            if (endpoint.includes('/getallteamswithplayers/') || endpoint.includes('/getteams/')) json = endpoint.endsWith('/101') ? teams : [];
            if (endpoint.includes('/availableleagueplayers/')) json = {
                players, members: enrolled.map(player => ({ playerId: player.id })), divisions: [{ name: 'Gold' }, { name: 'Silver' }]
            };
            if (endpoint.includes('/getplayers/')) json = enrolled;
            return route.fulfill({ json });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(BASE_URL + '/team-scores');
        await page.getByRole('tab', { name: 'Team Management', exact: true }).click();
        if (baseline) {
            await expect(page.getByText('Create a New Team', { exact: true })).toBeVisible();
            for (const width of [390, 1920]) {
                await page.setViewportSize({ width, height: 900 });
                await page.screenshot({ path: path.join(output, 'before-' + width + '.png'), animations: 'disabled', fullPage: true });
            }
            return;
        }
        const workspace = page.locator('.team-workspace');
        await expect(workspace.getByRole('link', { name: /Alexandria/ })).toHaveAttribute('href', '/player-stats-tabs/21?leagueId=101');
        await workspace.getByRole('combobox', { name: 'Division' }).click();
        await page.getByRole('option', { name: 'Silver', exact: true }).click();
        await expect(workspace.getByRole('heading', { name: 'Court Rockets' })).toBeVisible();
        await workspace.getByRole('button', { name: 'New Team' }).click();
        const create = page.getByRole('dialog');
        await expect(create.getByRole('button', { name: 'Create Team' })).toBeDisabled();
        await create.getByRole('textbox', { name: 'Team name' }).fill('Net Results');
        await page.screenshot({ path: path.join(output, 'create-team-1920.png'), animations: 'disabled' });
        await create.getByRole('button', { name: 'Create Team' }).click();
        await expect(workspace.getByRole('heading', { name: 'Net Results' })).toBeVisible();
        await expect(workspace.getByText('No players are assigned to this team yet.')).toBeVisible();
        await workspace.getByRole('button', { name: 'Add League Players' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Add League Players' })).toBeVisible();
        await expect(dialog.getByRole('button', { name: /Unenrolled/ })).toHaveCount(0);
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Dialog overflow at ' + width);
            await page.screenshot({ path: path.join(output, 'players-' + width + '.png'), animations: 'disabled' });
        }
        await page.setViewportSize({ width: 390, height: 900 });
        const search = dialog.getByRole('textbox', { name: 'Search players' });
        await dialog.getByRole('button', { name: 'Women' }).click();
        await search.fill('wellington');
        await expect(dialog.getByRole('button', { name: /Add Alexandria/ })).toHaveCount(0);
        await expect(dialog.getByText('No eligible players match your search or filter.')).toBeVisible();
        await search.fill('Maria');
        const maria = dialog.getByRole('button', { name: /Add Maria/ });
        await maria.click();
        await expect(dialog.getByRole('alert')).toContainText('available list has been refreshed');
        await expect(maria).toHaveCount(0);
        await expect(search).toHaveValue('Maria');
        await expect(dialog.getByRole('button', { name: 'Women' })).toHaveAttribute('aria-pressed', 'true');
        await dialog.getByRole('button', { name: 'Men', exact: true }).click();
        await search.fill('jordan');
        const jordan = dialog.getByRole('button', { name: /Add Jordan/ });
        await jordan.click();
        await expect(dialog.getByRole('alert')).toContainText('Could not add Jordan');
        await jordan.click();
        await expect(jordan).toHaveCount(0);
        await search.fill('fixture 10');
        await expect(dialog.getByRole('button', { name: /Fixture 10/ })).toHaveCount(0);
        await dialog.getByRole('button', { name: 'Women' }).click();
        await dialog.getByRole('button', { name: /Add Player Fixture 10/ }).click();
        await dialog.getByRole('button', { name: 'Close player browser' }).click();
        await expect(workspace.getByText(/Silver.*2 players/)).toBeVisible();
        assert.deepEqual(assignments, [22, 40]);
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            await page.screenshot({ path: path.join(output, 'after-' + width + '.png'), animations: 'disabled', fullPage: true });
        }
        for (const theme of ['navy', 'charcoal']) {
            await page.setViewportSize({ width: 1920, height: 900 });
            await page.evaluate(id => document.documentElement.dataset.theme = id, theme);
            await workspace.getByRole('button', { name: 'Add League Players' }).click();
            await expect(dialog).toBeVisible();
            await page.screenshot({ path: path.join(output, theme + '-browser.png'), animations: 'disabled' });
            await page.setViewportSize({ width: 390, height: 900 });
            await page.screenshot({ path: path.join(output, theme + '-browser-390.png'), animations: 'disabled' });
            await page.keyboard.press('Escape');
            await expect(dialog).toHaveCount(0);
        }
        await page.locator('#leagueDropdown').click();
        await page.getByRole('menuitem', { name: 'Court League', exact: true }).click();
        await expect(workspace.getByText('No teams have been created for this league.')).toBeVisible();
        await expect(workspace.getByText('Net Results')).toHaveCount(0);
        assert.deepEqual(errors, []);
        console.log('Team creation, division and league switching, assignment, error retry, themes and responsive captures passed.');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

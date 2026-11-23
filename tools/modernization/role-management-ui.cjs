// Test the production Angular bundle with browser-only fixtures. No API is forwarded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('../../tests/functional/node_modules/@playwright/test');
const serveAsset = require('../../tests/functional/scripts/fixture-asset.cjs');
const { BASE_URL } = require('../../tests/functional/helpers/safety.cjs');

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1920, 2560, 3440];
const assigned = { id: 101, leagueName: 'Harbor League' };
const other = { id: 102, leagueName: 'Court League' };
const teams = [{ id: 11, teamName: 'Harbor Aces' }, { id: 12, teamName: 'Court Rockets' }];
const output = process.env.LEAGUE_TEST_OUT;
const before = process.argv.includes('--baseline');
assert(output && process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(output, { recursive: true });

async function run() {
    const browser = await chromium.launch({ channel: process.env.LEAGUE_BROWSER_CHANNEL || 'msedge' });
    const errors = [];
    const scoreSaves = [];
    const managementRequests = [];
    let scheduled = false;
    try {
        async function open(role, leagues) {
            const context = await browser.newContext({ serviceWorkers: 'block' });
            await context.route('**/*', async route => {
                const { pathname, origin, hostname } = new URL(route.request().url());
                if (hostname === 'fonts.gstatic.com' && !pathname.startsWith('/s/materialicons/')) return route.abort();
                if (await serveAsset(route)) return;
                if (origin !== BASE_URL || !pathname.startsWith('/api/')) return route.abort();
                const endpoint = pathname.toLowerCase();
                if (route.request().method() === 'POST' && endpoint.endsWith('/recordmatchupscores')) {
                    scoreSaves.push(route.request().postDataJSON());
                    return route.fulfill({ json: { message: 'Scores saved.' } });
                }
                if (!before && (role === 'Manager' || role === 'Admin') && route.request().method() === 'POST' &&
                    endpoint.endsWith('/addnewleague/new%20fixture%20league')) {
                    const created = { id: 103, leagueName: 'New Fixture League' };
                    leagues = [...leagues, created];
                    managementRequests.push({ action: 'create', leagueId: created.id });
                    return route.fulfill({ json: created });
                }
                if (!before && role === 'Admin' && route.request().method() === 'PUT' &&
                    endpoint.endsWith('/login/leaguemanager/101')) {
                    managementRequests.push(route.request().postDataJSON());
                    return route.fulfill({ status: 204 });
                }
                if (route.request().method() !== 'GET') return route.abort();
                let json = [];
                if (endpoint.endsWith('/isauthenticated')) json = !!role;
                if (endpoint.endsWith('/getusersrole')) json = { role };
                if (endpoint.endsWith('/isadminpasswordauthorized')) json = false;
                if (endpoint.endsWith('/getusersplayer')) json = { playerId: null };
                if (endpoint.endsWith('/getuserleagues')) json = leagues;
                if (endpoint.endsWith('/getleagues')) json = [assigned, other];
                if (endpoint.includes('/getteams/')) json = teams;
                if (endpoint.includes('/getmatchupscores/') && scoreSaves.length) {
                    json = [{ teamId: 11, opponentsTeamId: 12, teamScore: 21, wonGame: true },
                        { teamId: 12, opponentsTeamId: 11, teamScore: 16, wonGame: false }];
                }
                if (scheduled && endpoint.includes('/getleagueschedule/')) {
                    const today = new Date();
                    const day = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
                        .map(value => String(value).padStart(2, '0')).join('-');
                    json = [{ date: day + 'T12:00:00', matches: [{
                        scheduleId: 9, team1Id: 11, team2Id: 12, division: 'Gold', matchDescription: 'Court 1'
                    }] }];
                }
                return route.fulfill({ json });
            });
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            return { context, page };
        }

        const { page: scorePage, context: scoreContext } = await open('Manager', [assigned]);
        await scorePage.goto(BASE_URL + '/team-scores');
        if (!before) await scorePage.getByRole('tab', { name: 'Enter Team Scores', exact: true }).click();
        await expect(scorePage.getByRole('heading', { name: 'Enter Team Scores' })).toBeVisible();
        const card = scorePage.locator('.matchup-card').first();
        await expect(card).toBeVisible();
        for (const width of widths) {
            await scorePage.setViewportSize({ width, height: 900 });
            await scorePage.screenshot({ path: path.join(output, `team-scores-${width}.png`), animations: 'disabled' });
            if (before) continue;
            const geometry = await scorePage.locator('.game-row').first().evaluate(row => {
                const fields = [...row.querySelectorAll('mat-form-field')].map(field => field.getBoundingClientRect());
                const labels = [...row.previousElementSibling.querySelectorAll('span')].slice(1).map(label => {
                    const range = document.createRange();
                    range.selectNodeContents(label);
                    return range.getBoundingClientRect();
                });
                return {
                    overflow: document.documentElement.scrollWidth - innerWidth,
                    balanced: Math.abs(fields[0].width - fields[1].width) < 1,
                    inline: Math.abs(fields[0].y - fields[1].y) < 1,
                    contained: labels.length === 2 && labels.every((label, index) => label.right <= fields[index].right)
                };
            });
            assert(geometry.overflow <= 1 && geometry.balanced && geometry.inline && geometry.contained, JSON.stringify({ width, geometry }));
        }
        if (!before) {
            await expect(card.getByRole('spinbutton', { name: 'Team 1 game 1 score' })).toBeVisible();
            await expect(card.getByRole('spinbutton', { name: 'Team 2 game 1 score' })).toBeVisible();
            await scorePage.getByRole('button', { name: 'Add Manual Matchup', exact: true }).click();
            await expect(scorePage.locator('.matchup-card')).toHaveCount(2);
            await card.getByRole('combobox', { name: 'Team 1', exact: true }).click();
            await scorePage.getByRole('option', { name: teams[0].teamName }).click();
            await card.getByRole('combobox', { name: 'Team 2', exact: true }).click();
            await expect(scorePage.getByRole('option', { name: teams[0].teamName })).toBeDisabled();
            await scorePage.getByRole('option', { name: teams[1].teamName }).click();
            await card.getByRole('combobox', { name: 'Number of games' }).click();
            await scorePage.getByRole('option', { name: '1', exact: true }).click();
            const save = card.getByRole('button', { name: 'Save matchup scores' });
            const scores = card.getByRole('spinbutton');
            await expect(save).toBeDisabled();
            await scores.nth(0).fill('21');
            await scores.nth(1).fill('-1');
            await expect(save).toBeDisabled();
            await scores.nth(1).fill('16');
            await save.click();
            await expect.poll(() => scoreSaves.length).toBe(1);
            assert.equal(scoreSaves[0].leagueId, assigned.id);
            await expect(card.getByText('Scores saved and standings updated.')).toBeVisible();
            scheduled = true;
            await scorePage.getByRole('button', { name: 'Reload date' }).click();
            await expect(scorePage.getByRole('heading', { name: 'Scheduled matchup 1' })).toBeVisible();
            const savedResults = scorePage.getByRole('region', { name: 'Saved Matchup Results' });
            await expect(savedResults).toContainText('Harbor Aces');
            await expect(savedResults).toContainText('Court Rockets');
            await expect(scorePage.locator('.empty-schedule')).toHaveCount(0);
            await scorePage.setViewportSize({ width: 390, height: 900 });
            await scorePage.screenshot({ path: path.join(output, 'team-scores-scheduled-390.png') });
        }
        await scoreContext.close();

        if (!before) {
            for (const [role, leagues] of [['Admin', [assigned, other]], ['Manager', [assigned]], ['Manager', []], ['Player', [assigned]], [null, []]]) {
                const { context, page } = await open(role, leagues);
                await page.setViewportSize({ width: 390, height: 844 });
                await page.goto(BASE_URL + '/league-management');
                const authorized = role === 'Admin' || role === 'Manager';
                if (!authorized) {
                    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
                    await expect(page.getByRole('tab', { name: 'League Setup' })).toHaveCount(0);
                } else {
                    const setupTab = page.getByRole('tab', { name: 'League Setup' });
                    await setupTab.click();
                    await expect(setupTab).toHaveAttribute('aria-selected', 'true');
                    await expect.poll(() => setupTab.evaluate(tab => {
                        const bounds = tab.getBoundingClientRect();
                        return bounds.left >= 0 && bounds.right <= innerWidth;
                    })).toBe(true);
                    await expect(page.getByRole('button', { name: 'Add New League' })).toHaveCount(0);
                    await expect(page.getByRole('tab', { name: 'Edit / Remove Players' })).toHaveCount(leagues.length ? 1 : 0);
                    await expect(page.getByRole('button', { name: 'Grant Access' })).toHaveCount(role === 'Admin' ? 1 : 0);
                    await expect(page.getByText('Administration Password')).toHaveCount(0);
                    await page.screenshot({ path: path.join(output, `league-management-${role}-${leagues.length}.png`), animations: 'disabled' });
                    if (role === 'Admin') {
                        await page.getByRole('textbox', { name: 'Manager email' }).fill('manager@example.invalid');
                        await page.getByRole('button', { name: 'Grant Access' }).click();
                        await expect(page.getByText('League access granted.', { exact: true })).toBeVisible();
                        assert.deepEqual(managementRequests[0], { email: 'manager@example.invalid', assigned: true });
                    }
                    if (role === 'Admin' || (role === 'Manager' && !leagues.length)) {
                        await page.getByRole('tab', { name: 'Create League' }).click();
                        await expect(page.getByRole('button', { name: 'Add New League' })).toBeDisabled();
                        await page.screenshot({ path: path.join(output, `create-league-${role}-390.png`) });
                        await page.getByRole('textbox', { name: 'New League Name' }).fill('New Fixture League');
                        await page.getByRole('button', { name: 'Add New League' }).click();
                        await expect(page.getByText('League created.', { exact: true })).toBeVisible();
                        await expect(setupTab).toHaveAttribute('aria-selected', 'true');
                        await expect(page.locator('#leagueDropdown')).toContainText('New Fixture League');
                        await expect(page.getByRole('heading', { name: 'Add Division' })).toBeVisible();
                        await expect(page.getByRole('tab', { name: 'Edit / Remove Players' })).toBeVisible();
                        await page.getByRole('button', { name: 'Close', exact: true }).click();
                        await expect(page.getByRole('heading', { name: 'Create New League' })).toHaveCount(0);
                        await page.screenshot({ path: path.join(output, `created-league-setup-${role}-390.png`), animations: 'disabled' });
                        assert.deepEqual(managementRequests.at(-1), { action: 'create', leagueId: 103 });
                        await page.reload();
                        await expect(page.locator('#leagueDropdown')).toContainText('New Fixture League');
                    }
                }
                await context.close();
            }
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ widths, before, scoreSaves, managementRequests, errors }, null, 2));
        console.log('Team Scores and League Management browser checks passed.');
    } finally {
        await browser.close();
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });


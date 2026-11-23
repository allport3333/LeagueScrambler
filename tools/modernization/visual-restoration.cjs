// Visual fixtures only. No requests reach IIS or SQL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('../../tests/functional/node_modules/@playwright/test');
const serveAsset = require('../../tests/functional/scripts/fixture-asset.cjs');
const { BASE_URL } = require('../../tests/functional/helpers/safety.cjs');

const out = process.env.LEAGUE_TEST_OUT;
const baseline = process.argv.includes('--baseline');
const topSummary = process.argv.includes('--top-summary');
const rosterOnly = topSummary || process.argv.includes('--roster-only');
if (!out || !process.env.LEAGUE_TEST_DIST) throw new Error('Set LEAGUE_TEST_DIST and LEAGUE_TEST_OUT.');
fs.mkdirSync(out, { recursive: true });
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1600, 1920, 2560, 3440];
const leagues = [{ id: 101, leagueName: 'Fixture League' }];
if (topSummary) leagues.push({ id: 102, leagueName: 'Other Fixture League' });
const teams = [{ id: 11, teamName: 'Harbor Aces' }, { id: 12, teamName: 'Court Rockets' }];
const player = { id: 1, firstName: 'Avery', lastName: 'Fixture', isMale: true, divisionName: 'Gold' };
const roster = Array.from({ length: 24 }, (_, index) => ({
    id: 100 + index, firstName: 'Fixture', lastName: 'Player ' + (index + 1), isMale: index % 2 === 0
}));
if (rosterOnly) {
    Object.assign(roster[0], { firstName: 'Jim', lastName: 'Lowe' });
    Object.assign(roster[1], { firstName: 'Ava', lastName: 'Lee' });
    Object.assign(roster[2], { firstName: 'Alexander', lastName: 'Montgomery-Sienkiewicz' });
    Object.assign(roster[3], { firstName: 'Isabella', lastName: 'Fernández de la Cruz' });
}
const round = { id: 21, scoreId: 91, roundNumber: 1, scrambleNumber: 12, roundScore: 21, roundWon: true, dateOfTeam: '2026-11-15T18:00:00' };

async function run() {
    const channel = process.env.LEAGUE_BROWSER_CHANNEL;
    const browser = await chromium.launch({ ...(channel ? { channel } : {}), timeout: 25000 });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    let signedIn = false;
    const errors = [];
    const observations = [];
    const generatedTeams = [];
    try {
        await context.route('**/*', async route => {
            const request = route.request();
            const url = new URL(request.url());
            // The fixture font is Material Icons. Serving it as an inlined Roboto
            // URL makes production Material text render as icon glyphs.
            if (url.hostname === 'fonts.gstatic.com' && !url.pathname.startsWith('/s/materialicons/')) {
                return route.abort();
            }
            if (await serveAsset(route)) return;
            const endpoint = url.pathname.toLowerCase();
            if (url.origin !== BASE_URL || !endpoint.startsWith('/api/')) return route.abort();
            if (request.method() === 'POST' && endpoint === '/api/login/login') {
                assert.equal(request.postDataJSON().email, 'fixture@example.invalid');
                return route.fulfill({ status: 400, json: { message: 'Invalid email or password.' } });
            }
            if (rosterOnly && request.method() === 'POST' && endpoint.includes('/generatescramble/')) {
                const teams = request.postDataJSON().kingQueenTeams;
                generatedTeams.push(teams.map(team => team.players.length));
                return route.fulfill({ json: teams.map((_, index) => ({ id: 500 + index, scrambleNumber: generatedTeams.length })) });
            }
            if (request.method() !== 'GET') return route.abort();
            let body = [];
            if (endpoint.endsWith('/isauthenticated')) body = signedIn;
            if (endpoint.endsWith('/getusersrole')) body = { role: signedIn ? 'Admin' : null };
            if (endpoint.endsWith('/getusersplayer')) body = { playerId: 1 };
            if (endpoint.endsWith('/isadminpasswordauthorized')) body = false;
            if (endpoint.endsWith('/getleagues') || endpoint.endsWith('/getuserleagues')) body = leagues;
            if (endpoint.includes('/getteams/')) body = teams;
            if (endpoint.includes('allmale')) body = roster.filter(person => person.isMale);
            if (endpoint.includes('allfemale')) body = roster.filter(person => !person.isMale);
            if (endpoint.includes('getplayers') || endpoint.includes('getallplayers') || endpoint.includes('/selectleague/')) body = roster;
            if (endpoint.includes('numberofbrackets')) body = 4;
            if (topSummary && endpoint.endsWith('/gettopplayers')) body = roster.slice(0, 8).map((person, index) => ({ ...person, rank: index + 1 }));
            if (topSummary && endpoint.includes('/getbyleague/')) body = { maxRounds: 1, playerScores: roster.map(person => ({
                playerId: person.id, isMale: person.isMale, playerName: person.firstName + ' ' + person.lastName, scores: [], totalScore: 10
            })) };
            if (endpoint.endsWith('/getprofile')) body = player;
            if (endpoint.endsWith('/getdetailedperformancestats')) {
                body = {
                    totalScores: 21,
                    totalWins: 1,
                    individualRounds: [round],
                    scrambleTotals: [{ scrambleNumber: 12, totalScore: 21, wins: 1, dateOfTeam: round.dateOfTeam }]
                };
            }
            await route.fulfill({ json: body });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        if (rosterOnly) {
            signedIn = true;
            await page.goto(BASE_URL + '/scrambler');
            const panel = page.locator('#playerListHidden');
            const showPlayers = page.locator('#hideInputOptions').getByRole('button', { name: /^(Show )?Player List$/ });
            if (await showPlayers.isVisible() && await showPlayers.getAttribute('aria-expanded') !== 'true') await showPlayers.click();
            const shortName = panel.getByText('Jim Lowe', { exact: true });
            await expect(shortName).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            if (topSummary) {
                await page.setViewportSize({ width: 1920, height: 1000 });
                await panel.getByRole('button', { name: 'Select All', exact: true }).click();
                const row = panel.getByRole('option').filter({ hasText: 'Jim Lowe' });
                await row.getByRole('button', { name: 'Set Top Player' }).click();
                const summary = page.locator(baseline ? '.top-players-section' : '.top-players-summary');
                await expect(summary).toContainText('Jim Lowe');
                if (baseline) {
                    for (const width of [390, 1920]) {
                        await page.setViewportSize({ width, height: 1000 });
                        await summary.scrollIntoViewIfNeeded();
                        await page.screenshot({ path: path.join(out, 'before-' + width + '.png'), animations: 'disabled' });
                    }
                    return;
                }
                const count = summary.getByRole('status');
                await expect(count).toHaveText('1 selected');
                await row.click();
                await expect(summary).toHaveCount(0);
                await row.click();
                await row.getByRole('button', { name: 'Remove Top Player' }).click();
                await expect(summary).toHaveCount(0);
                await page.getByRole('button', { name: 'Apply Top Players', exact: true }).click();
                await expect(count).toHaveText('6 selected');
                const scramble = page.locator('.primary-action');
                for (const width of widths) {
                    await page.setViewportSize({ width, height: 900 });
                    const order = await summary.evaluate(el => {
                        const action = document.querySelector('.primary-action');
                        return el.getBoundingClientRect().bottom <= action.getBoundingClientRect().top &&
                            document.documentElement.scrollWidth <= innerWidth + 1;
                    });
                    assert(order, 'Summary placement or overflow at ' + width);
                    await summary.evaluate(el => el.scrollIntoView({ block: 'center' }));
                    await page.screenshot({ path: path.join(out, 'after-' + width + '.png'), animations: 'disabled' });
                }
                for (const theme of ['navy', 'charcoal']) {
                    await page.evaluate(id => document.documentElement.dataset.theme = id, theme);
                    await page.setViewportSize({ width: 390, height: 900 });
                    await summary.evaluate(el => el.scrollIntoView({ block: 'center' }));
                    await page.screenshot({ path: path.join(out, theme + '-390.png'), animations: 'disabled' });
                    await expect(count).toHaveText('6 selected');
                }
                await page.getByRole('button', { name: 'Apply Top Players (Male Standings)', exact: true }).click();
                await expect(summary.locator('.top-player-female')).toHaveCount(0);
                await expect(count).toHaveText('6 selected');
                await scramble.click();
                await expect.poll(() => generatedTeams.length).toBe(1);
                await expect(count).toHaveText('6 selected');
                await page.getByRole('button', { name: 'Reset Players', exact: true }).click();
                page.once('dialog', dialog => dialog.accept());
                await page.getByRole('menuitem', { name: 'Reset Top Players' }).click();
                await expect(summary).toHaveCount(0);
                await page.locator('#leagueDropdown').click();
                await page.getByRole('menuitem', { name: 'Other Fixture League', exact: true }).click();
                await expect(summary).toHaveCount(0);
                assert.deepEqual(errors, []);
                console.log('Top Players placement, state and responsive themes passed.');
                return;
            }
            for (const width of widths) {
                await page.setViewportSize({ width, height: 1000 });
                await page.evaluate(async () => {
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    document.querySelector('#hideInputOptions').scrollIntoView({ block: 'start', behavior: 'instant' });
                });
                const metrics = await panel.evaluate(root => {
                    const rows = [...root.querySelectorAll('.league-roster mat-list-option')];
                    function measure(row) {
                        const name = row.querySelector('.desktop-player-name, .mobile-player-name');
                        const actions = row.querySelector('.desktop-player-actions, .mobile-player-action, mat-select') ?? row.querySelector('.player-icon-action');
                        const checkbox = row.querySelector('.mdc-list-item__start');
                        const range = document.createRange();
                        range.selectNodeContents(name);
                        const lines = [...range.getClientRects()];
                        const button = row.querySelector('.player-icon-action');
                        const icon = button?.querySelector('mat-icon');
                        const textBox = name.getBoundingClientRect();
                        const verticalCenter = element => {
                            const bounds = element.getBoundingClientRect();
                            return bounds.top + bounds.height / 2;
                        };
                        return {
                            name: name.textContent.trim(),
                            lines: new Set(lines.map(line => Math.round(line.top))).size,
                            nameRoom: Math.round(textBox.width),
                            icon: icon?.getBoundingClientRect().width,
                            button: button?.getBoundingClientRect().width,
                            iconOffset: icon && Math.abs(verticalCenter(icon) - verticalCenter(checkbox)),
                            separated: lines.every(line => line.right <= actions.getBoundingClientRect().left - 1 &&
                                line.left >= checkbox.getBoundingClientRect().right + 1 &&
                                line.top >= row.getBoundingClientRect().top &&
                                line.bottom <= row.getBoundingClientRect().bottom)
                        };
                    }
                    const top = rows[0].getBoundingClientRect().top;
                    const count = [...root.querySelectorAll('.league-roster mat-list')][0].querySelectorAll('mat-list-option').length;
                    return {
                        columns: rows.slice(0, count).filter(row => Math.abs(row.getBoundingClientRect().top - top) < 1).length,
                        headerHeight: Math.round(rows[0].getBoundingClientRect().top - root.getBoundingClientRect().top),
                        overflow: document.documentElement.scrollWidth - innerWidth,
                        players: rows.map(measure)
                    };
                });
                observations.push({ width, ...metrics });
                await page.screenshot({ path: path.join(out, `roster-${width}.png`), animations: 'disabled' });
                if (!baseline) {
                    assert(metrics.overflow <= 1 && metrics.players.every(person => person.separated), `Roster overlap at ${width}px`);
                    assert.equal(metrics.players.find(person => person.name === 'Jim Lowe').lines, 1, `Short name at ${width}px`);
                    assert(metrics.players.every(person => person.lines <= 3), `Player name wraps excessively at ${width}px`);
                    assert(metrics.players.every(person => person.icon === undefined ||
                        person.icon === 16 && person.button === 28 && person.iconOffset <= 1), `Roster icon alignment at ${width}px`);
                }
            }
            const requirements = panel.getByRole('button', { name: /^(Top\/Low )?Player Requirements$/i });
            const fixtureRow = panel.getByRole('option').filter({ hasText: 'Jim Lowe' });
            await page.setViewportSize({ width: 1920, height: 1000 });
            await panel.getByRole('button', { name: 'Select All', exact: true }).click();
            await fixtureRow.getByRole('button', { name: 'Set Top Player' }).click();
            await requirements.click();
            const breakdown = page.getByRole('heading', { name: 'Team Breakdown', exact: true }).locator('..');
            await expect(breakdown.getByText('Number of Teams: 6', { exact: true })).toBeVisible();
            await expect(breakdown.getByText('4 Player Teams', { exact: true }).locator('..')).toHaveText(/4 Player Teams\s*6/);
            if (!baseline) {
                await expect(panel.locator('#roster-requirements dd')).toHaveText(['2 players needed', '3 players needed', '4 players needed']);
                await expect(panel.getByText('Total players selected', { exact: false })).toHaveCount(0);
            }
            for (const width of widths) {
                await page.setViewportSize({ width, height: 1000 });
                await breakdown.screenshot({ path: path.join(out, `breakdown-${width}.png`), animations: 'disabled' });
                await page.locator('#hideInputOptions').evaluate(section => section.scrollIntoView({ block: 'start', inline: 'nearest' }));
                await page.screenshot({ path: path.join(out, `requirements-${width}.png`), animations: 'disabled' });
                const gap = await breakdown.evaluate(card => card.children[2].getBoundingClientRect().top -
                    card.children[1].getBoundingClientRect().bottom);
                observations.find(result => result.width === width).teamBreakdownGap = gap;
                if (!baseline) {
                    assert(gap >= 0 && gap <= 6, `Breakdown gap at ${width}px: ${gap}px`);
                }
            }
            await page.setViewportSize({ width: 1920, height: 1000 });
            if (!baseline) {
                const lowPlayers = ['Ava Lee', 'Fixture Player 5'].map(name => panel.getByRole('option').filter({ hasText: name }));
                for (const player of lowPlayers) await player.getByRole('button', { name: 'Set Low Player' }).click();
                await expect(panel.locator('#roster-requirements dd')).toHaveText(['4 players needed', '6 players needed', '8 players needed']);
                for (const player of lowPlayers) await player.getByRole('button', { name: 'Remove Low Player' }).click();
                await expect(panel.locator('#roster-requirements dd')).toHaveText(['2 players needed', '3 players needed', '4 players needed']);
            }
            await requirements.click();
            await fixtureRow.getByRole('button', { name: 'Remove Top Player' }).click();
            await panel.getByRole('button', { name: 'Deselect All', exact: true }).click();
            if (!baseline) {
                await page.setViewportSize({ width: 1920, height: 1000 });
                const row = panel.getByRole('option').filter({ hasText: 'Jim Lowe' });
                await row.focus();
                await page.keyboard.press('Space');
                await expect(row).toHaveAttribute('aria-selected', 'true');
                for (const action of ['Top', 'Low', 'Bye']) {
                    await row.getByRole('button', { name: `Set ${action} Player` }).click();
                    await row.getByRole('button', { name: `Remove ${action} Player` }).click();
                }
                await row.getByRole('button', { name: 'Set Female Player' }).click();
                await row.getByRole('button', { name: 'Set Male Player' }).click();
                await panel.getByRole('button', { name: 'Select All', exact: true }).click();
                await expect(page.locator('.selection-summary')).toContainText('24 selected');
                await panel.getByRole('button', { name: 'Deselect All', exact: true }).click();
                await expect(page.locator('.selection-summary')).toContainText('0 selected');
                const required = panel.getByRole('button', { name: 'Player Requirements', exact: true });
                await required.click();
                await expect(panel.getByText('Mark a Top or Low player to see the estimated totals.', { exact: true })).toBeVisible();
                await required.click();
                await page.setViewportSize({ width: 390, height: 844 });
                const mobileActions = row.getByRole('button', { name: 'Actions for Jim Lowe' });
                await mobileActions.click();
                await expect(page.getByRole('menu')).toBeVisible();
                await page.screenshot({ path: path.join(out, 'roster-mobile-actions.png'), animations: 'disabled' });
                await page.keyboard.press('Escape');
                await expect(page.getByRole('menu')).toBeHidden();
                await expect(mobileActions).toBeFocused();
                await mobileActions.click();
                await page.getByRole('menuitem', { name: 'Set Top Player', exact: true }).click();
                await expect(page.getByRole('menu')).toBeHidden();
                await expect(row.locator('.status-top')).toBeVisible();
                await row.click();
                await expect(row).toHaveAttribute('aria-selected', 'true');
                await panel.getByText('Fixture Player 24', { exact: true }).scrollIntoViewIfNeeded();
                await page.getByRole('button', { name: 'Player List', exact: true }).click();
                await expect(panel).toBeHidden();
                await showPlayers.click();
                await expect(shortName).toBeVisible();
                await expect(row).toHaveAttribute('aria-selected', 'true');

                await page.setViewportSize({ width: 1920, height: 1000 });
                const setup = page.locator('.scramble-setup');
                const sizeMode = setup.getByRole('radio', { name: 'Maximum Team Size' });
                const countMode = setup.getByRole('radio', { name: 'Number of Teams' });
                const field = setup.getByRole('combobox');
                const options = page.locator('.mat-mdc-select-panel').getByRole('option');
                const rules = page.locator('.scramble-rules');
                const ruleToggle = rules.locator('summary');
                const random = rules.getByRole('checkbox', { name: 'Completely Random' });
                await expect(ruleToggle).toHaveAttribute('aria-expanded', 'false');
                await expect(sizeMode).toBeChecked();
                await expect(field).toHaveCount(1);
                await expect(field).toHaveText('4');
                await page.evaluate(() => scrollTo(0, 0));
                await page.screenshot({ path: path.join(out, 'configuration-desktop-default.png') });

                await field.click();
                await expect(options).toHaveText(['2', '3', '4', '5']);
                await page.getByRole('option', { name: '3', exact: true }).click();
                await panel.getByRole('button', { name: 'Select All', exact: true }).click();
                await countMode.check();
                await expect(field).toHaveCount(1);
                await expect(field).toHaveText('Choose a number');
                const scramble = page.locator('.primary-action');
                await expect(scramble).toBeDisabled();
                await field.click();
                await expect(options).toHaveCount(26);
                await page.getByRole('option', { name: '26', exact: true }).click();
                await scramble.click();
                await expect(page.locator('.generation-report')).toContainText('every team needs a player');
                assert.equal(generatedTeams.length, 0);
                await page.locator('mat-snack-bar-container').getByRole('button', { name: 'Close', exact: true }).click();

                await field.click();
                await page.getByRole('option', { name: '4', exact: true }).click();
                await ruleToggle.click();
                await random.check();
                await ruleToggle.click();
                await sizeMode.check();
                await expect(field).toHaveText('3');
                await expect(page.locator('.selection-summary')).toContainText('24 selected');
                await scramble.click();
                await expect.poll(() => generatedTeams.length).toBe(1);
                assert.deepEqual(generatedTeams[0], Array(8).fill(3));
                await expect(scramble).toBeEnabled();
                await countMode.check();
                await expect(field).toHaveText('4');
                await ruleToggle.click();
                await expect(random).toBeChecked();
                await ruleToggle.click();
                await scramble.click();
                await expect.poll(() => generatedTeams.length).toBe(2);
                assert.deepEqual(generatedTeams[1], Array(4).fill(6));
                await page.setViewportSize({ width: 390, height: 844 });
                await page.evaluate(() => scrollTo(0, 0));
                await page.screenshot({ path: path.join(out, 'configuration-mobile-count.png') });
            }
            assert.deepEqual(errors, []);
            return;
        }
        async function capture(label) {
            await page.evaluate(() => document.fonts.ready);
            for (const width of widths) {
                await page.setViewportSize({ width, height: 900 });
                const layout = await page.evaluate(async () => {
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    const overflow = document.documentElement.scrollWidth - innerWidth;
                    const offenders = overflow > 1 ? Array.from(document.body.querySelectorAll('*'))
                        .filter(element => element.getBoundingClientRect().right > innerWidth + 1)
                        .slice(0, 12).map(element => element.tagName + '.' + Array.from(element.classList).join('.')) : [];
                    return { overflow, offenders };
                });
                if (label === 'scrambler' && !baseline) {
                    await expect(page.locator('.scramble-setup mat-form-field')).toHaveCount(1);
                }
                if (label === 'scrambler-roster') {
                    layout.columns = await page.locator('.league-roster mat-list').first().evaluate(list => {
                        const rows = [...list.querySelectorAll('mat-list-option')].map(option => option.getBoundingClientRect().top);
                        return rows.filter(top => Math.abs(top - rows[0]) < 1).length;
                    });
                    if (!baseline && width === 390) {
                        const nameWidth = await page.locator('.league-roster .mobile-player-name').first()
                            .evaluate(name => name.getBoundingClientRect().width);
                        assert(nameWidth >= 90, 'Scrambler roster leaves insufficient room for names');
                    }
                    if (!baseline && width === 3440) assert(layout.columns > 4);
                }
                observations.push({ label, width, ...layout });
                if ([320, 390, 768, 1920, 3440].includes(width)) {
                    const surface = label === 'scrambler-roster' ? page.locator('.league-roster') : page;
                    await surface.screenshot({ path: path.join(out, `${label}-${width}.png`), animations: 'disabled' });
                }
            }
        }

        await page.goto(BASE_URL + '/?toggleLoginForm=true');
        await page.locator('#loginEmail').fill('fixture@example.invalid');
        await page.locator('#loginPassword').fill('visual-fixture');
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
        const message = baseline ? page.getByText('Login Failed', { exact: true }) : page.getByRole('alert').filter({ hasText: 'Invalid email or password.' });
        await expect(message).toBeVisible();
        await capture('login-error');
        if (!baseline) {
            await page.getByRole('button', { name: 'Dismiss sign-in message' }).click();
            await expect(page.locator('#loginEmail')).toBeFocused();
        }
        signedIn = true;
        for (const [label, url, selector, tab] of [
            ['scrambler', '/scrambler', 'app-scrambler-component', null],
            ['league-management', '/league-management', '.management-tabs', 'League Setup'],
            ['team-scores', '/team-scores', 'app-team-scores', 'Team Management'],
            ['dashboard', '/league-dashboard?leagueId=101', 'app-league-dashboard', 'League Teams'],
            ['standings', '/standings', 'app-league-standings', null],
            ['matchups', '/kqmatchups', 'app-kqmatchups', null],
            ['players', '/fetch-data', 'app-fetch-data', null],
            ['player-history', '/player-stats-tabs/1?leagueId=101&tab=kq', 'app-detailed-player-stats .history-entry', null],
            ['home-dashboard', '/', 'app-player-home-dashboard', null],
            ['schedule', '/schedule', 'app-schedule', null],
            ['sign-in', '/sign-in', 'app-sign-in', null],
            ['password-reset', '/resetpassword', 'app-reset-password', null],
            ['faq', '/faq', 'app-faq', null],
            ['installation', '/install-locally', 'app-install-locally', null]
        ]) {
            await page.goto(BASE_URL + url);
            await expect(page.locator(selector)).toBeVisible();
            if (label === 'player-history') {
                const summary = page.locator('.history-entry > summary');
                await summary.focus();
                await page.keyboard.press('Enter');
                await expect(page.locator('.history-entry')).toHaveAttribute('open', '');
            }
            await capture(label);
            if (label === 'scrambler') {
                const showPlayers = page.getByRole('button', { name: 'Show Player List', exact: true });
                if (await showPlayers.isVisible() && await showPlayers.getAttribute('aria-expanded') !== 'true') await showPlayers.click();
                await expect(page.locator('.league-roster mat-list-option').first()).toBeVisible();
                await capture('scrambler-roster');
            }
            if (tab && !baseline) {
                await page.setViewportSize({ width: 320, height: 900 });
                const target = page.getByRole('tab', { name: tab, exact: true });
                await target.click();
                await expect(target).toHaveAttribute('aria-selected', 'true');
                const labelHeight = await target.locator('.mdc-tab__text-label').evaluate(el => el.getBoundingClientRect().height);
                assert(labelHeight <= 24, `Wrapped tab label: ${tab}`);
            }
        }
        assert.deepEqual(errors, []);
        if (!baseline) assert.deepEqual(observations.filter(item => item.overflow > 1), []);
    } finally {
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ baseline, observations, errors, generatedTeams }, null, 2));
        await browser.close();
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

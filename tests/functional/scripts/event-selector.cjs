const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const asset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const league = { id: 37, leagueName: 'Test League Fixture', eventTypeId: 1 };
const tournament = { id: 31, leagueName: 'Wallyball Unicorn Tournament', eventTypeId: 2, canManageTournament: true };
const second = { id: 32, leagueName: 'Advanced 3s Tourney Jan 2025 with an unusually long descriptive name', eventTypeId: 2, canManageTournament: true };
const legacy = { id: 40, leagueName: 'Legacy Competition', eventTypeId: null };

(async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
        for (const [width, role, events, theme] of [
            [375, 'Player', [{ ...tournament, canManageTournament: false, canViewTournamentRounds: true }], 'navy'],
            [390, 'Player', [league, tournament], 'charcoal'],
            [430, 'Manager', [league, ...Array.from({ length: 35 }, (_, index) => ({ ...legacy, id: 100 + index, leagueName: 'Long historical competition name with a further description ' + index }))], 'navy'],
            [1366, 'Manager', [league, legacy], 'classic'],
            [1920, 'Admin', [league, tournament, second, legacy], 'classic'],
            [390, 'Manager', [], 'classic']
        ]) {
            const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: width < 500, viewport: { width, height: 850 } });
            await context.addInitScript(theme => {
                localStorage.setItem('league-hub-appearance', theme);
                if (!sessionStorage.getItem('league-hub-selected-league')) sessionStorage.setItem('league-hub-selected-league', '37');
                sessionStorage.setItem('league-hub-tournament-step:31', '2');
            }, theme);
            let created;
            await context.route('**/*', async route => {
                if (await asset(route)) return;
                const url = new URL(route.request().url()), endpoint = url.pathname.toLowerCase();
                if (url.origin !== origin) return route.abort();
                if (route.request().method() === 'POST' && endpoint.includes('/addnewleague/')) {
                    assert.equal(url.searchParams.get('eventTypeId'), '2');
                    created = { id: 44, leagueName: 'New Tournament Fixture', eventTypeId: 2, canManageTournament: true };
                    events.push(created);
                    return route.fulfill({ json: created });
                }
                if (route.request().method() !== 'GET') return route.abort();
                let result = [];
                if (endpoint.endsWith('/isauthenticated')) result = true;
                else if (endpoint.endsWith('/getusersrole')) result = { role };
                else if (endpoint.endsWith('/getusersplayer')) result = { playerId: 1 };
                else if (endpoint.endsWith('/getuserleagues')) result = events;
                else if (endpoint.endsWith('/getleagues')) result = [league, tournament, second, legacy];
                else if (endpoint === '/api/tournaments/managed') {
                    result = events.filter(event => event.eventTypeId === 2 && (role === 'Admin' || event.canManageTournament));
                    return route.fulfill({ json: result, headers: { 'X-Tournaments-Exist': 'true' } });
                } else if (/^\/api\/tournaments\/\d+$/.test(endpoint)) {
                    const event = events.find(event => event.id === Number(endpoint.split('/').at(-1)));
                    if (!event || (role !== 'Admin' && !event.canManageTournament)) return route.fulfill({ status: 403, json: {} });
                    result = { name: event.leagueName, participants: 1, hasRounds: false, status: 'Setup',
                        details: { eventDate: '2026-11-20', description: '', location: '', version: 'fixture', workflowStep: 2 } };
                } else if (endpoint.endsWith('/rounds')) {
                    result = { name: tournament.leagueName, rounds: [], version: 'fixture' };
                } else if (endpoint.startsWith('/api/tournament-attendance/')) {
                    result = { mode: 3, roster: [], organizers: role !== 'Player' };
                }
                return route.fulfill({ json: result });
            });
            const page = await context.newPage();
            await page.goto(origin + '/tournament');
            const trigger = page.locator('#leagueDropdown');
            await trigger.click();
            const panel = page.getByRole('dialog', { name: 'Select league or event' });
            const categories = panel.locator('.event-category');
            const searchTrigger = page.getByRole('button', { name: 'Search events', exact: true });
            const search = page.getByRole('dialog', { name: 'Find an event' });
            const field = search.getByRole('searchbox');
            const groups = panel.getByRole('group');
            const expected = ['Leagues', 'Tournaments', 'Other events'].filter((_, index) =>
                index === 1 || events.some(event => event.eventTypeId === [1, 2, null][index]));
            assert.deepEqual(await groups.evaluateAll(items => items.map(item => item.getAttribute('aria-label'))), expected);
            const checkBounds = async locator => {
                const box = await locator.boundingBox();
                assert(box.x >= 0 && box.x + box.width <= width + 1, JSON.stringify({ width, box }));
            };
            await checkBounds(panel);
            await checkBounds(searchTrigger);
            assert(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));
            await expect(panel.getByRole('searchbox')).toHaveCount(0);
            const screenshot = state => page.screenshot({
                path: path.join(process.env.LEAGUE_TEST_OUT, 'refined-' + width + '-' + state + '.png')
            });
            if (events.length) {
                await expect(panel.locator('[aria-current=true]')).toHaveCount(1);
                const expanded = categories.and(panel.locator('[aria-expanded=true]'));
                await expect(expanded).toHaveCount(1);
                await expect(expanded).toBeFocused();
                await expanded.press('Enter');
                await expect(expanded).toHaveCount(0);
                await expect(panel.locator('.event-choice')).toHaveCount(0);
                if (width === 390) await screenshot('collapsed');
                if (width < 500) await categories.last().tap();
                else await categories.last().click();
                await expect(expanded).toHaveCount(1);
                if (width === 390) await screenshot('expanded');
                if (width === 430) {
                    const list = panel.locator('.event-selector-list');
                    assert(await list.evaluate(element => element.scrollHeight > element.clientHeight));
                    await expect(panel.locator('.event-choice').last()).toBeVisible();
                }
                if (width < 500) await searchTrigger.tap();
                else await searchTrigger.click();
                await expect(field).toBeFocused();
                await expect(panel).toHaveCount(0);
                await checkBounds(search);
                await field.fill('NOT A MATCH');
                await expect(search.getByText('No events match your search.')).toBeVisible();
                await field.fill('');
                await expect(search.locator('.event-choice')).toHaveCount(events.length);
                if (width === 390) await screenshot('search');
                await field.press('Escape');
                await expect(searchTrigger).toBeFocused();
            } else await expect(panel.getByText('No tournaments yet.')).toBeVisible();
            const nav = page.getByRole('navigation', {name: 'Main navigation'});
            await expect(nav.getByRole('link', {name: 'Tournament Center', exact: true})).toHaveCount(0);
            if (events.length) await trigger.click();
            const tournamentGroup = panel.getByRole('group', {name: 'Tournaments', exact: true});
            const tournamentCategory = tournamentGroup.locator('.event-category');
            if (await tournamentCategory.getAttribute('aria-expanded') !== 'true') await tournamentCategory.click();
            const selectedLabel = await trigger.locator('.league-name').innerText();
            await tournamentGroup.getByRole('link', {name: 'Create Tournament'}).click();
            await expect(page).toHaveURL(/\/tournament\?view=create$/);
            await expect(page.getByRole('heading', {name: 'Create a Tournament'})).toBeVisible();
            await expect(trigger.locator('.league-name')).toHaveText(selectedLabel);
            await trigger.click();
            if (await tournamentCategory.getAttribute('aria-expanded') !== 'true') await tournamentCategory.click();
            await tournamentGroup.getByRole('link', {name: 'Manage Tournaments'}).click();
            await expect(page).toHaveURL(/\/tournament$/);
            await expect(page.getByRole('region', {name: 'Manage Tournaments'})).toBeVisible();
            await expect(trigger.locator('.league-name')).toHaveText(selectedLabel);
            if (!events.length) {
                await trigger.click();
                await tournamentGroup.getByRole('link', {name: 'Create Tournament'}).click();
                await page.getByLabel('Tournament Name').fill('New Tournament Fixture');
                await page.getByLabel('Tournament Date').fill('2026-12-01');
                await page.getByRole('button', {name: 'Create Tournament', exact: true}).click();
                await expect(page).toHaveURL(/\/tournament\/44\?step=1$/);
                await expect(trigger).toContainText('New Tournament Fixture');
                assert(created);
                await context.close();
                continue;
            }
            if (role === 'Admin' || (role === 'Player' && width === 390)) {
                if (width < 500) await searchTrigger.tap();
                else await searchTrigger.click();
                await field.fill('wALLyBaLl');
                await expect(search.locator('.event-choice')).toContainText('Tournament');
                await field.press('ArrowDown');
                await expect(search.locator('.event-choice')).toBeFocused();
                await page.keyboard.press('Enter');
                await expect(page).toHaveURL(/\/tournament\/31$/);
                await expect(page.getByRole('heading', { name: 'Manage Participants' })).toBeVisible();
                await page.reload();
                await expect(trigger).toContainText(tournament.leagueName);
                if (width >= 1300) await expect(nav.getByRole('link', {name: 'Tournament Workspace'})).toHaveAttribute('href', '/tournament/31');
                if (role === 'Admin') {
                    await page.goto(origin + '/tournament/31?step=1');
                    await page.getByLabel('Tournament Name', { exact: true }).fill('Unsaved fixture title');
                    await trigger.click();
                    await panel.getByRole('button', { name: second.leagueName }).click();
                    const confirmation = page.getByRole('alertdialog');
                    await expect(confirmation).toBeVisible();
                    await confirmation.getByRole('button', { name: 'Cancel' }).click();
                    await expect(confirmation).toHaveCount(0);
                    await expect(trigger).toContainText(tournament.leagueName);
                    await expect(page).toHaveURL(/\/tournament\/31/);
                    await trigger.click();
                    await panel.getByRole('button', { name: second.leagueName }).click();
                    await expect(confirmation).toBeVisible();
                    await confirmation.getByRole('button', { name: 'Discard' }).click();
                    await expect(page).toHaveURL(/\/tournament\/32$/).catch(async error => { console.error(await page.getByRole('alertdialog').allTextContents()); console.error((await page.locator('body').innerText()).slice(-850)); throw error; });
                    await expect(trigger).toContainText(second.leagueName);
                }
                await trigger.click();
                await categories.filter({ hasText: 'Leagues' }).click();
                await panel.getByRole('button', { name: league.leagueName }).click();
                await expect(page).toHaveURL(/\/league-dashboard\?leagueId=37$/);
                await expect(trigger).toContainText(league.leagueName);
            } else if (role === 'Player') {
                await trigger.click();
                await page.keyboard.press('Escape');
                await expect(trigger).toBeFocused();
                await page.goto(origin + '/tournament/31/rounds');
                await expect(trigger).toContainText(tournament.leagueName);
                await expect(page.getByRole('heading', { name: tournament.leagueName })).toBeVisible();
            } else if (width === 1366) {
                await trigger.click();
                await categories.filter({ hasText: 'Other events' }).click();
                await panel.getByRole('button', { name: legacy.leagueName }).click();
                await expect(page).toHaveURL(/\/league-dashboard\?leagueId=40$/);
                await expect(trigger).toContainText(legacy.leagueName);
            }
            await context.close();
        }
        console.log('Event selector permissions, grouping, search, routing, resume and unsaved changes passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

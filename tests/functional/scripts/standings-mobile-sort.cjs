const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const out = process.env.LEAGUE_TEST_OUT;
const roster = [15, 32, 20].map((points, index) => ({
    playerId: index + 1, playerName: ['Alex Winner', 'Ben Points', 'Cory Tie'][index], isMale: true,
    leagueDivisionId: 0, leagueDivisionCode: 'Unassigned',
    scores: [{ roundId: 1, scrambleNumber: 1, score: points, roundWon: index !== 1,
        isSubScore: index === 1, hasSavedScore: true }]
}));

(async () => {
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
        for (const theme of ['classic', 'navy', 'charcoal']) {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
            await context.addInitScript(theme => localStorage.setItem('league-hub-appearance', theme), theme);
            let role = 'Manager';
            await context.route('**/*', async route => {
                if (await serveAsset(route)) return;
                const url = new URL(route.request().url());
                if (url.origin !== origin || !url.pathname.startsWith('/api/') || route.request().method() !== 'GET')
                    return route.abort();
                const endpoint = url.pathname.toLowerCase();
                let body = [];
                if (endpoint.endsWith('/isauthenticated')) body = true;
                else if (endpoint.endsWith('/getusersrole')) body = { role };
                else if (endpoint.endsWith('/getusersplayer')) body = { playerId: 1 };
                else if (/getuserleagues|getleagues/.test(endpoint)) body = [
                    {id: 37, leagueName: 'Fixture League', eventTypeId: 1},
                    {id: 42, leagueName: 'Fixture Cup', eventTypeId: 2, canManageTournament: role !== 'Player', canViewTournamentRounds: true}
                ];
                else if (endpoint.includes('getbyleague')) body = {
                    playerScores: roster, maxRounds: 1, matchupWins: endpoint.includes('cup') ? {1: 3, 2: 1, 3: 1} : undefined
                };
                else if (url.searchParams.has('settingName')) body = { settingValue: ({
                    numberOfSubsAllowed: '0', subScorePercent: '50', dropLowest: '0', standingsType: 'round'
                })[url.searchParams.get('settingName')] };
                else if (endpoint === '/api/tournaments/42') body = { name: 'Fixture Cup', details: {
                    eventDate: '2026-12-12', description: '', location: 'Gym', version: 'fixture', workflowStep: 2
                }, hasRounds: false };
                else if (endpoint === '/api/tournament-attendance/42') body = { roster: [], mode: 0 };
                else if (endpoint === '/api/tournaments/42/rounds') body = { name: 'Fixture Cup', rounds: [] };
                await route.fulfill({json: body});
            });
            const page = await context.newPage();
            const table = page.locator('.mobile-rankings:visible');
            const primary = () => table.locator('thead .mobile-primary-stat');
            await page.goto(origin + '/standings?leagueId=42');
            await expect(table.getByRole('columnheader', {name: 'Place'})).toBeVisible();
            await expect(table.getByRole('columnheader', {name: 'Player Name'})).toBeVisible();
            async function sort(label) {
                await page.locator('.mobile-standings-controls:visible mat-select').click();
                await page.getByRole('option', {name: label, exact: true}).click();
                await expect(primary()).toHaveText(label);
                await expect(table.locator('thead th:visible')).toHaveCount(3);
            }
            await sort('Total Wins');
            await expect(table.locator('tbody .mobile-player-row').first()).toContainText('Alex Winner');
            await expect(table.locator('tbody .mobile-player-row').first().locator('.mobile-primary-stat')).toHaveText('3');
            await page.getByRole('button', { name: /Sort direction/ }).click();
            await expect(table.locator('tbody .mobile-primary-stat').first()).toHaveText('1');
            await expect(table.locator('tbody .mobile-primary-stat').nth(1)).toHaveText('1');
            await page.screenshot({ path: path.join(out, theme + '-wins-mobile.png'), fullPage: true });
            await sort('Total Points');
            await expect(table.locator('tbody .mobile-player-row').first()).toContainText('Ben Points');
            await sort('King Queen Score');
            await page.getByRole('button', { name: 'View Full Table', exact: true }).click();
            await expect(page.locator('.standings-full-table:visible').getByText('Total Wins', { exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'View Compact Table', exact: true }).click();
            await page.setViewportSize({ width: 700, height: 900 });
            await expect(table.locator('thead th:visible')).toHaveCount(5);
            await page.setViewportSize({ width: 1440, height: 900 });
            await expect(page.locator('.standings-full-table:visible').getByText('Total Wins', { exact: true })).toBeVisible();
            await page.reload();
            await page.getByRole('link', { name: 'Back to Fixture Cup Tournament', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Manage Participants', exact: true })).toBeVisible();
            await page.goto(origin + '/standings?leagueId=37');
            await expect(page.getByRole('link', {name: /Back to .* Tournament/ })).toHaveCount(0);
            await page.setViewportSize({ width: 390, height: 844 });
            await sort('Total Wins');
            role = 'Player';
            await page.goto(origin + '/standings?leagueId=42');
            await page.getByRole('link', {name: 'Back to Fixture Cup Tournament Matchups'}).click();
            await expect(page).toHaveURL(/\/tournament\/42\/rounds$/);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await context.close();
        }
        console.log('Compact standings sort columns, ties, full table, and scoped return navigation passed in three themes.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

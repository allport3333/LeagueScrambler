const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const out = process.env.LEAGUE_TEST_OUT;
assert(out && process.env.LEAGUE_TEST_DIST);
const roster = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1, firstName: 'Player', lastName: String(index + 1), isMale: index % 2 === 0
}));
const name = 'Tournament Browser Fixture';
const settings = {
    maximumTeamSize: 4, numberOfTeams: null, numberOfRounds: 5, gamesPerMatchup: 1,
    balanceGenders: true, minimizeRepeats: true, balancePriorities: true, automaticByes: false,
    activeTeamLimit: null, topPlayerIds: [1, 2], lowPlayerIds: [3, 4], historicalScrambleNumbers: [],
    manualByes: []
};
const details = { eventDate: '2026-12-12', description: '', location: 'Gym', version: 'fixture', workflowStep: 6 };
const defaultRounds = [1, 2, 3, 4, 5].map(roundNumber => ({
    roundNumber, status: roundNumber === 1 ? 'partial' : 'unplayed', gamesPerMatchup: 1,
    teams: Array.from({length: roundNumber === 1 ? 12 : 6}, (_, index) => ({
        id: 100 * roundNumber + index,
        players: Array.from({length: 4}, (_, player) => roster[(index * 4 + player) % roster.length]), scores: []
    })),
    byes: []
}));

(async () => {
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
        for (const theme of ['classic', 'navy', 'charcoal']) {
            const context = await browser.newContext({
                serviceWorkers: 'block', viewport: { width: 1440, height: 960 }
            });
            await context.addInitScript(value => {
                localStorage.setItem('league-hub-appearance', value);
                if (!sessionStorage.getItem('league-hub-selected-league'))
                    sessionStorage.setItem('league-hub-selected-league', '37');
            }, theme);
            await context.addInitScript(() => {
                window.print = () => { document.body.dataset.printInvoked = 'true'; };
            });
            let role = theme === 'classic' ? 'Admin' : 'Manager';
            let rounds = structuredClone(defaultRounds);
            let roundSettings = structuredClone(settings);
            let generatedWrites = 0;
            let savedScores = 0;
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await context.route('**/*', async route => {
                if (await serveAsset(route)) return;
                const uri = new URL(route.request().url());
                if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(uri.hostname) && route.request().method() === 'GET')
                    return route.continue();
                if (uri.origin !== origin || !uri.pathname.startsWith('/api/')) return route.abort();
                const endpoint = uri.pathname.toLowerCase();
                const method = route.request().method();
                if (method === 'PUT') {
                    const body = route.request().postDataJSON();
                    if (endpoint.endsWith('/round-settings')) roundSettings = body.settings;
                    else if (endpoint.endsWith('/rounds')) {
                        generatedWrites++;
                        rounds = body.rounds.map(round => ({
                            ...round, status: 'unplayed', gamesPerMatchup: roundSettings.gamesPerMatchup,
                            teams: round.teams.map((members, index) => ({
                                id: 100 * round.roundNumber + index, scores: [],
                                players: members.map(id => roster.find(player => player.id === id))
                            }))
                        }));
                    } else if (endpoint.endsWith('/rounds/1/scores')) {
                        savedScores += body.scores.length;
                    } else return route.abort();
                    return route.fulfill({ json: { version: details.version } });
                }
                if (method !== 'GET') return route.abort();
                let data = [];
                if (endpoint.endsWith('/isauthenticated')) data = true;
                else if (endpoint.endsWith('/getusersrole')) data = { role };
                else if (endpoint.endsWith('/getusersplayer')) data = { playerId: 1 };
                else if (endpoint.endsWith('/getuserleagues') || endpoint.endsWith('/getleagues')) data = [{id: 37, leagueName: 'WW Winter 2026', eventTypeId: 1}, {id: 133, leagueName: name, eventTypeId: 2}];
                else if (endpoint.includes('managementaccess')) data = { role, canManage: role !== 'Player' };
                else if (endpoint.includes('/availableleagueplayers/')) data = {players: roster, divisions: []};
                else if (endpoint === '/api/tournaments/managed') data = [{id: 133, leagueName: name, eventTypeId: 2, eventDate: '2026-12-12', participants: 20, status: 'In Progress', total: 5, completed: 0}];
                else if (endpoint === '/api/tournaments/133') data = { name, details, participants: 20, hasRounds: rounds.length > 0 };
                else if (endpoint === '/api/tournaments/133/round-settings') data = {
                    version: details.version, mode: 1, roster, presentIds: roster.map(player => player.id), history: [], settings: roundSettings
                };
                else if (endpoint === '/api/tournaments/133/rounds') data = { name, version: details.version, settingsSaved: true, rounds };
                else if (endpoint === '/api/tournaments/133/check-in' || endpoint === '/api/tournament-attendance/133') data = {
                    name, ...details, mode: 1, organizers: role !== 'Player', ownPlayerId: 1,
                    roster: [{ ...roster[0], present: true }]
                };
                return route.fulfill({ json: data });
            });

            await page.setViewportSize({ width: theme === 'classic' ? 1920 : 390, height: 900 });
            await page.goto(origin + '/');
            await expect(page.getByRole('button', { name: /WW Winter 2026/ })).toBeVisible();
            if (theme !== 'classic') await page.getByRole('button', { name: 'Open navigation' }).click();
            await page.getByRole('link', { name: 'Tournament Center', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Tournament Center', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: /WW Winter 2026/ })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Open Tournament: ' + name, exact: true })).toBeVisible();
            await expect(page.getByRole('link', { name: 'WW Winter 2026' })).toHaveCount(0);
            if (theme !== 'classic') await page.getByText('Tournament menu', { exact: true }).click();
            await expect(page.getByRole('link', { name: 'Create Tournament', exact: true })).toBeVisible();
            await page.locator('app-tournament-landing').screenshot({ path: path.join(out, theme + '-landing.png') });
            await page.getByRole('link', { name: 'Open Tournament: ' + name, exact: true }).click();
            await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
            await page.setViewportSize({ width: 1440, height: 960 });
            await page.getByRole('button', { name: 'Manage Tournament Setup' }).click();
            await expect(page.getByRole('button', { name: 'Save & Continue' })).toBeVisible();
            await expect(page.getByText(/1 of 5 rounds completed/)).toHaveCount(0);
            await page.getByRole('button', { name: /Team & Round Setup/ }).click();
            await expect(page.getByRole('heading', { name: 'Team & Round Setup' })).toBeVisible();
            await page.getByText('ⓘ', {exact: true}).nth(1).click();
            await expect(page.getByText(/four teams of at most four/)).toBeVisible();
            await page.getByText('ⓘ', {exact: true}).nth(1).click();
            await page.evaluate(() => document.fonts.ready);
            await page.locator('app-tournament-center').screenshot({ path: path.join(out, theme + '-desktop.png') });
            await page.getByRole('button', { name: /Player Priorities & Byes/ }).click();
            const priority = page.getByRole('combobox', { name: 'Priority for Player 1', exact: true });
            await expect(priority).toBeVisible();
            await priority.selectOption('top');
            await page.getByRole('button', { name: 'Top', exact: true }).click();
            await expect(priority).toBeVisible();
            await page.getByRole('button', { name: 'Manual Byes', exact: true }).click();
            await page.getByRole('checkbox', { name: 'Manual bye for Player 1', exact: true }).check();
            await expect(page.getByText(/1 manual bye/)).toBeVisible();
            await page.locator('app-tournament-rounds').screenshot({ path: path.join(out, theme + '-priorities.png') });
            await page.getByRole('button', { name: 'Return to Run Tournament' }).click();
            await page.locator('.saved-round').first().locator('summary').click();
            await expect(page.locator('.saved-round[open]').getByRole('heading', {name: 'Matchup 1', exact: true})).toBeVisible();
            if (theme === 'classic') {
                const popupPending = page.waitForEvent('popup');
                await page.locator('.print-options summary').click();
                await page.getByRole('button', { name: 'Print Current Round', exact: true }).click();
                const popup = await popupPending;
                await expect(popup.getByRole('heading', { name, exact: true })).toBeVisible();
                await expect(popup.locator('.print-team').first().getByRole('row').nth(1).getByRole('cell', { name: 'Player 1', exact: true })).toBeVisible();
                await expect(popup.locator('.printed-matchup')).toHaveCount(6);
                const pdf = await popup.pdf({path: path.join(out, 'six-matchups-letter.pdf'), format: 'Letter', printBackground: true});
                assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
                await popup.emulateMedia({media: 'print'});
                await popup.screenshot({path: path.join(out, 'six-matchups-print.png'), fullPage: true});
                await popup.close();
            }
            await page.getByRole('button', { name: 'Continue: Enter Round 1 Scores' }).click();
            const scores = page.locator('.score-inputs input');
            await scores.nth(0).fill('21');
            await scores.nth(1).fill('15');
            await page.locator('app-tournament-rounds').screenshot({ path: path.join(out, theme + '-scores.png') });
            await page.getByRole('button', { name: 'Save Round Scores' }).click();
            await expect(page.getByText('Round scores saved.')).toBeVisible();
            assert.equal(savedScores, 1);

            rounds = [];
            await page.reload();
            await page.getByRole('button', { name: 'Generate Tournament Rounds' }).click();
            await expect(page.getByRole('heading', { name: 'Proposed Rounds' })).toBeVisible({timeout: 15000});
            assert.equal(generatedWrites, 0);
            await page.getByRole('button', { name: 'Save Proposed Rounds' }).click();
            await expect(page.getByText('Tournament rounds saved.')).toBeVisible();
            assert.equal(generatedWrites, 1);
            assert.equal(rounds.length, 5);

            await page.setViewportSize({ width: 390, height: 844 });
            await page.getByLabel('Tournament setup step', { exact: true }).selectOption({ label: 'Team & Round Setup' });
            await expect(page.getByRole('heading', {name: 'Team & Round Setup'})).toBeVisible();
            await page.locator('app-tournament-center').screenshot({path: path.join(out, theme + '-wizard-mobile.png')});
            const mobileStep = page.getByLabel('Tournament setup step', { exact: true });
            for (const label of ['Tournament Details', 'Manage Participants', 'Player Priorities & Byes', 'Player Check In',
                'Generate & Preview Tournament', 'Run Tournament']) {
                await mobileStep.selectOption({ label });
                await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            }
            await page.locator('.saved-round').first().locator('summary').click();
            await page.locator('app-tournament-rounds').screenshot({ path: path.join(out, theme + '-rounds-mobile.png') });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.goto(origin + '/tournament/133/check-in');
            await expect(page.getByRole('heading', { name: 'Tournament Check In' })).toBeVisible();
            await expect(page.getByText(/1 registered.*1 checked in/)).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            await page.locator('app-tournament-check-in').screenshot({ path: path.join(out, theme + '-check-in-mobile.png') });
            role = 'Player';
            await page.goto(origin + '/tournament/133/rounds');
            await expect(page.getByRole('heading', { name })).toBeVisible().catch(async error => {
                console.error(page.url(), await page.locator('body').innerText(), errors);
                throw error;
            });
            await expect(page.getByRole('button', { name: 'Save Round Scores' })).toHaveCount(0);
            await page.getByRole('button', { name: 'Open navigation' }).click();
            await expect(page.getByRole('link', { name: 'Tournament Center', exact: true })).toHaveCount(0);
            await page.goto(origin + '/tournament');
            await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
            assert.deepEqual(errors, []);
            await context.close();
        }
        console.log('Tournament setup, preview/save, scores, printing, check-in, participant matchups and 390px layouts passed in three themes.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

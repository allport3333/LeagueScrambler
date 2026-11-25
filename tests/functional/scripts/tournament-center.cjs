const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const out = process.env.LEAGUE_TEST_OUT;
const layoutOnly = process.argv.includes('--workspace-layout');
const notificationsOnly = process.argv.includes('--notifications');
const visualPolish = process.argv.includes('--visual-polish');
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
            let role = theme === 'classic' || visualPolish ? 'Admin' : 'Manager';
            let rounds = notificationsOnly ? [] : structuredClone(defaultRounds);
            let roundSettings = structuredClone(settings);
            let generatedWrites = 0;
            let savedScores = 0;
            let present = true;
            let attendanceMode = 1;
            let rejectScores = false;
            let canGenerate = true;
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
                if (visualPolish && method === 'POST' && endpoint.endsWith('/resetpassword'))
                    return route.fulfill({ json: { message: 'Fixture reset' } });
                if ((layoutOnly || notificationsOnly) && method === 'POST' && endpoint.endsWith('/rounds/remove')) {
                    const { roundNumbers } = route.request().postDataJSON();
                    rounds = rounds.filter(round => !roundNumbers.includes(round.roundNumber));
                    return route.fulfill({ json: { version: details.version } });
                }
                if (method === 'PUT') {
                    const body = route.request().postDataJSON();
                    if (notificationsOnly && endpoint.endsWith('/details'))
                        return route.fulfill({ json: { name: body.name, details: { ...details, ...body } } });
                    if (notificationsOnly && endpoint.endsWith('/workflow'))
                        return route.fulfill({ json: { step: body.step + 1 } });
                    if (endpoint === '/api/tournament-attendance/133/players/1') present = body.present;
                    else if (endpoint.endsWith('/round-settings')) roundSettings = body.settings;
                    else if (endpoint.endsWith('/rounds')) {
                        generatedWrites++;
                        const updated = body.rounds.map(round => ({
                            ...round, status: 'unplayed', gamesPerMatchup: roundSettings.gamesPerMatchup,
                            teams: round.teams.map((members, index) => ({
                                id: 100 * round.roundNumber + index, scores: [],
                                players: members.map(id => roster.find(player => player.id === id))
                            }))
                        }));
                        if (layoutOnly || visualPolish) {
                            const updatedNumbers = new Set(updated.map(round => round.roundNumber));
                            rounds = [...rounds.filter(round => !updatedNumbers.has(round.roundNumber)), ...updated]
                                .sort((a, b) => a.roundNumber - b.roundNumber);
                            if (body.additionalSettings) roundSettings.numberOfRounds += updated.length;
                        } else rounds = updated;
                    } else if ((layoutOnly || notificationsOnly) && /\/rounds\/\d+\/scores$/.test(endpoint)) {
                        if (rejectScores) return route.fulfill({ status: 409, json: { message: 'Results changed. Reload the round before saving.' } });
                        const number = Number(endpoint.split('/').at(-2));
                        const round = rounds.find(item => item.roundNumber === number);
                        for (const score of body.scores) {
                            for (const [id, points] of [[score.teamId, score.points], [score.opponentId, score.opponentPoints]]) {
                                const team = round.teams.find(item => item.id === id);
                                team.scores = [...team.scores.filter(item => item.game !== score.game), { game: score.game, points }];
                            }
                        }
                        round.status = round.teams.every(team => team.scores.length === round.gamesPerMatchup) ? 'completed' : 'partial';
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
                else if (endpoint === '/api/tournaments/133') data = { name, details, participants: 20, hasRounds: rounds.length > 0, status: 'In Progress' };
                else if (endpoint === '/api/tournaments/133/deletion-preview') data = {
                    name: 'Regional Invitational Volleyball Tournament 2027', eventDate: '2027-01-27',
                    participants: 128, generated: 12, hasScores: true, revision: 'fixture'
                };
                else if (endpoint === '/api/tournaments/133/round-settings') data = {
                    version: details.version, mode: 1, roster, presentIds: canGenerate ? roster.map(player => player.id) : [], history: [], settings: roundSettings
                };
                else if (endpoint === '/api/tournaments/133/rounds') data = { name, version: details.version, settingsSaved: true, rounds };
                else if (endpoint === '/api/tournaments/133/check-in' || endpoint === '/api/tournament-attendance/133') data = {
                    name, ...details, mode: attendanceMode, organizers: role !== 'Player', ownPlayerId: 1,
                    roster: [{ ...roster[0], present }]
                };
                return route.fulfill({ json: data });
            });

            if (visualPolish) {
                const width = { classic: 1440, navy: 2560, charcoal: 390 }[theme];
                await page.setViewportSize({ width, height: 800 });
                async function centered(popup) {
                    await expect(popup).toBeVisible();
                    const box = await popup.boundingBox();
                    assert(Math.abs(box.x + box.width / 2 - width / 2) < 4, 'Popup horizontal center');
                    assert(Math.abs(box.y + box.height / 2 - 400) < 4, 'Popup vertical center');
                }
                await page.goto(origin + '/tournament/133?step=7');
                const workspace = page.locator('app-tournament-center');
                const heading = workspace.getByRole('heading', { name: 'New Team Assignments', exact: true });
                const preview = workspace.locator('.preview');
                const flight = workspace.locator('.redraw-flight:not([hidden])');
                const toast = page.locator('mat-snack-bar-container');
                const roundCard = number => workspace.locator('#run-round-' + number).locator('..');
                async function startRedraw(number) {
                    const card = roundCard(number);
                    const summary = card.locator('summary');
                    if (await card.getAttribute('open') === null) await summary.click();
                    const button = card.getByRole('button', { name: 'Redraw Round Teams' });
                    await button.scrollIntoViewIfNeeded();
                    await button.evaluate(element => {
                        const source = element.getBoundingClientRect();
                        window.redrawFirstFrame = new Promise(resolve => {
                            const watcher = new MutationObserver(() => {
                                const fly = document.querySelector('.redraw-flight:not([hidden])');
                                if (!fly) return;
                                watcher.disconnect();
                                const rect = fly.getBoundingClientRect();
                                const content = document.querySelector('.redraw-heading');
                                resolve({ source: [source.x + source.width / 2, source.y + source.height / 2],
                                    card: [rect.x + rect.width / 2, rect.y + rect.height / 2],
                                    waiting: getComputedStyle(content).visibility === 'hidden',
                                    inert: !!content.closest('[inert]') });
                            });
                            watcher.observe(document.body, { subtree: true, childList: true, attributes: true });
                            setTimeout(() => { watcher.disconnect(); resolve(null); }, 1500);
                        });
                    });
                    await button.click();
                }
                const original = structuredClone(rounds);
                await startRedraw(4);
                const first = await page.evaluate(() => window.redrawFirstFrame);
                assert(first && first.waiting && first.inert);
                assert(Math.hypot(first.source[0] - first.card[0], first.source[1] - first.card[1]) < 65);
                await expect(flight).toHaveText('New Round 4 Teams');
                await expect(preview.getByRole('button', { name: 'Save New Round Teams' })).toHaveCount(0);
                await expect(heading).toBeFocused();
                await expect(flight).toHaveCount(0);
                await expect(heading).toBeInViewport();
                await expect(preview.getByRole('heading', { name: 'Matchup 1' })).toBeVisible();
                assert.deepEqual(rounds, original);
                await preview.getByRole('button', { name: 'Cancel' }).click();
                assert.deepEqual(rounds, original);
                await startRedraw(3);
                await expect(flight).toHaveText('New Round 3 Teams');
                await expect(heading).toBeFocused();
                await preview.getByRole('button', { name: 'Save New Round Teams' }).click();
                await expect(toast).toContainText('Round 3 teams updated.');
                await centered(toast);
                await page.screenshot({ path: path.join(out, theme + '-centered-success.png') });
                await toast.getByRole('button', { name: 'OK' }).click();

                await page.emulateMedia({ reducedMotion: 'reduce' });
                await startRedraw(2);
                await expect(heading).toBeFocused();
                await expect(preview.getByRole('button', { name: 'Save New Round Teams' })).toBeVisible();
                assert.equal(await page.evaluate(() => window.redrawFirstFrame), null);
                await preview.getByRole('button', { name: 'Cancel' }).click();
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                canGenerate = false;
                await page.reload();
                await startRedraw(2);
                await expect(toast).toContainText('Between 2 and 256 eligible participants are required.');
                await centered(toast);
                await expect(preview).toHaveCount(0);
                await expect(roundCard(2).getByRole('button', { name: 'Redraw Round Teams' })).toBeEnabled();
                await toast.getByRole('button', { name: 'Close' }).click();

                await page.goto(origin + '/tournament');
                await page.getByRole('button', { name: 'Delete Tournament: ' + name }).click();
                const dialog = page.getByRole('alertdialog');
                await centered(dialog);
                await expect(dialog.locator('.tournament-name')).toHaveText('Regional Invitational Volleyball Tournament 2027');
                await expect(dialog.locator('.tournament-date')).toHaveText('Jan 27, 2027');
                await expect(dialog.locator('.tournament-summary dd')).toHaveText(['128', '12', 'Yes']);
                assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
                const commit = dialog.getByRole('button', { name: 'Permanently Delete', exact: true });
                await expect(commit).toBeDisabled();
                await dialog.getByLabel('Type the tournament name to confirm').fill('Regional Invitational Volleyball Tournament 2027');
                await expect(commit).toBeEnabled();
                await page.screenshot({ path: path.join(out, theme + '-deletion-dialog.png') });
                await dialog.getByRole('button', { name: 'Cancel' }).click();
                await expect(dialog).toHaveCount(0);
                await expect(page.getByRole('button', { name: 'Delete Tournament: ' + name })).toBeVisible();
                await page.goto(origin + '/resetpassword?token=fixture');
                await page.getByPlaceholder('New Password').fill('Fixture123');
                await page.getByPlaceholder('Confirm Password').fill('Fixture123');
                await page.getByRole('button', { name: 'Reset Password' }).click();
                await expect(toast).toContainText('Password reset successful');
                await centered(toast);
                await toast.getByRole('button', { name: 'Close' }).click();
                assert.equal(generatedWrites, 1);
                assert.deepEqual(errors, []);
                await context.close();
                continue;
            }

            if (notificationsOnly) {
                await page.setViewportSize({ width: theme === 'charcoal' ? 390 : 1440, height: 800 });
                await page.goto(origin + '/tournament/133?step=1');
                const workspace = page.locator('app-tournament-center .workspace');
                const toast = page.locator('mat-snack-bar-container.tournament-operation-snackbar');
                async function expectToast(message, success = true) {
                    await expect(toast.getByText(message, { exact: true })).toBeVisible();
                    await expect(toast).toHaveClass(success ? /tournament-success-snackbar/ : /red-snackbar/);
                    await expect(workspace.getByText(message, { exact: true })).toHaveCount(0);
                    const box = await toast.boundingBox();
                    assert(Math.abs(box.y + box.height / 2 - 400) < 4);
                }
                await workspace.getByLabel('Location').fill('Updated gym');
                await expect(toast).toHaveCount(0);
                await workspace.getByRole('button', { name: 'Save & Continue' }).click();
                await expectToast('Tournament details saved.');
                await toast.getByRole('button', { name: 'OK' }).click();
                await expect(toast).toHaveCount(0);
                if (theme === 'charcoal') await workspace.getByLabel('Tournament setup step', { exact: true }).selectOption({ label: 'Generate & Preview Tournament' });
                else await workspace.getByRole('navigation', { name: 'Tournament setup steps' })
                    .getByRole('button', { name: 'Generate & Preview Tournament' }).click();
                await workspace.getByRole('button', { name: 'Generate Tournament Rounds' }).click();
                await expect(toast).toHaveCount(0);
                await workspace.getByRole('button', { name: 'Save Proposed Rounds' }).click();
                await expectToast('Tournament rounds generated successfully.');
                const start = Date.now();
                const position = await workspace.evaluate(element => {
                    const box = element.getBoundingClientRect();
                    return [box.top + window.scrollY, box.width, box.height];
                });
                await expect(toast).toHaveCount(0, { timeout: 4500 });
                assert(Date.now() - start > 2000);
                assert.deepEqual(await workspace.evaluate(element => {
                    const box = element.getBoundingClientRect();
                    return [box.top + window.scrollY, box.width, box.height];
                }), position);

                await workspace.getByRole('button', { name: 'Continue: Enter Round 1 Scores' }).click();
                const scoring = workspace.getByRole('region', { name: 'Round scores' });
                await scoring.getByRole('button', { name: 'Save Round Scores' }).click();
                await expect(scoring.getByRole('alert')).toContainText('Enter a nonnegative whole-number score');
                await expect(toast).toHaveCount(0);
                await scoring.locator('.score-inputs input').nth(0).fill('21');
                await scoring.locator('.score-inputs input').nth(1).fill('15');
                rejectScores = true;
                await scoring.getByRole('button', { name: 'Save Round Scores' }).click();
                await expectToast('Results changed. Reload the round before saving.', false);
                assert.equal(rounds[0].teams[0].scores.length, 0);
                if (theme === 'classic') await page.waitForTimeout(3300);
                await expect(toast.getByRole('button', { name: 'Close' })).toBeVisible();
                await toast.getByRole('button', { name: 'Close' }).click();
                await expect(toast).toHaveCount(0);
                rejectScores = false;
                await scoring.getByRole('button', { name: 'Save Round Scores' }).click();
                await expectToast('Round 1 scores saved.');
                assert.equal(rounds[0].teams[0].scores[0].points, 21);
                await toast.getByRole('button', { name: 'OK' }).click();
                await expect(toast).toHaveCount(0);

                await workspace.getByRole('button', { name: 'Manage Rounds', exact: true }).click();
                const management = workspace.getByRole('region', { name: 'Manage Rounds' });
                await management.locator('summary[aria-label^="View Round 2,"]').click();
                await management.locator('.saved-round').filter({ hasText: 'Round 2' }).getByRole('button', { name: 'Delete Round' }).click();
                assert(rounds.some(round => round.roundNumber === 2));
                await expect(toast).toHaveCount(0);
                await management.getByRole('button', { name: 'Confirm Deletion' }).click();
                await expectToast('Round 2 deleted.');
                assert(!rounds.some(round => round.roundNumber === 2));
                if (theme === 'charcoal') await workspace.getByLabel('Tournament setup step', { exact: true }).selectOption({ label: 'Team & Round Setup' });
                else await workspace.getByRole('navigation', { name: 'Tournament setup steps' })
                    .getByRole('button', { name: 'Team & Round Setup' }).click();
                await expect(workspace.getByRole('heading', { name: 'Team & Round Setup' })).toBeVisible();
                await expect(toast).toHaveCount(0);
                await page.reload();
                await expect(workspace.getByRole('heading', { name: 'Team & Round Setup' })).toBeVisible();
                await expect(toast).toHaveCount(0);
                assert.deepEqual(errors, []);
                await context.close();
                continue;
            }

            if (layoutOnly) {
                const width = { classic: 1440, navy: 1920, charcoal: 390 }[theme];
                await page.setViewportSize({ width, height: 950 });
                await page.goto(origin + '/tournament/133?step=1');
                const workspace = page.locator('app-tournament-center .workspace');
                const header = workspace.locator(':scope > header');
                await expect(header.getByRole('heading', { name })).toBeVisible();
                const stableHeader = await header.innerText();
                const stepNames = ['Tournament Details', 'Manage Participants', 'Team & Round Setup',
                    'Confirm Participants', 'Generate & Preview Tournament', 'Run Tournament'];
                const stepControl = workspace.getByRole('combobox', { name: 'Tournament setup step' });
                for (const [index, step] of stepNames.entries()) {
                    if (index && width < 720) await stepControl.selectOption({ label: step });
                    else if (index) await workspace.getByRole('navigation').getByRole('button', { name: step }).first().click();
                    await expect(workspace.getByRole('heading', { name: step, exact: true })).toBeVisible();
                    assert.equal(await header.innerText(), stableHeader);
                    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                    if (width > 720) {
                        const wizard = workspace.locator('.workflow');
                        const sidebar = workspace.locator('.wizard-steps');
                        const content = workspace.locator('.step-content');
                        const [grid, left, right] = await Promise.all([wizard.boundingBox(), sidebar.boundingBox(), content.boundingBox()]);
                        assert(right.x > left.x + left.width);
                        if (index === 0) {
                            assert(right.width >= 750 && right.width <= 850);
                            assert(Math.abs((right.x + right.width / 2) - ((left.x + left.width + grid.x + grid.width) / 2)) < 30);
                        }
                    } else {
                        await expect(stepControl).toBeVisible();
                        await expect(workspace.locator('.wizard-steps')).toBeHidden();
                    }
                    await page.screenshot({ path: path.join(out, `${theme}-${width}-${index + 1}.png`) });
                }
                const first = workspace.locator('.saved-round').nth(0);
                const second = workspace.locator('.saved-round').nth(1);
                await first.locator('summary').click();
                await expect(first.getByRole('button', { name: 'Redraw Round Teams' })).toHaveCount(0);
                await second.locator('summary').click();
                const unchanged = structuredClone(rounds);
                await expect(workspace.getByText(/Preview Replacement/i)).toHaveCount(0);
                await second.getByRole('button', { name: 'Redraw Round Teams' }).click();
                const preview = workspace.locator('.preview');
                await expect(preview.getByRole('heading', { name: 'New Team Assignments' })).toBeFocused();
                await expect(preview).toContainText('Redrawing Round 2 may change every matchup');
                assert.equal(generatedWrites, 0);
                await page.screenshot({ path: path.join(out, `${theme}-${width}-redraw.png`) });
                await preview.getByRole('button', { name: 'Cancel' }).click();
                await expect(preview).toHaveCount(0);
                assert.deepEqual(rounds, unchanged);
                await second.getByRole('button', { name: 'Redraw Round Teams' }).click();
                await preview.getByRole('button', { name: 'Save New Round Teams' }).click();
                await expect.poll(() => generatedWrites).toBe(1);
                assert.deepEqual(rounds.filter(round => round.roundNumber !== 2), unchanged.filter(round => round.roundNumber !== 2));
                const list = workspace.getByRole('region', { name: 'Saved tournament rounds' });
                const toolbar = workspace.getByRole('group', { name: 'Tournament actions' });
                await expect(toolbar.getByRole('button')).toHaveCount(3);
                await expect(workspace.getByText('Participants and saved rounds', { exact: true })).toHaveCount(0);
                const manage = toolbar.getByRole('button', { name: 'Manage Rounds' });
                const management = workspace.getByRole('region', { name: 'Manage Rounds' });
                await manage.click();
                await expect(management.getByRole('button', { name: 'Update Remaining Players' })).toBeVisible();
                await expect(list.locator('#run-round-2').locator('..')).toHaveAttribute('open', '');
                await management.getByRole('button', { name: 'Close Round Management' }).click();
                await expect(list.locator('#run-round-2').locator('..')).toHaveAttribute('open', '');
                await manage.click();
                await management.getByRole('button', { name: 'Add Additional Rounds' }).click();
                await expect(list).toBeVisible();
                await workspace.getByRole('button', { name: 'Preview Additional Rounds' }).click();
                await workspace.locator('.preview').getByRole('button', { name: 'Save Additional Rounds' }).click();
                await expect(list.locator('#run-round-6')).toBeVisible();
                await manage.click();
                await management.locator('summary[aria-label^="View Round 6,"]').click();
                await management.locator('.saved-round').filter({ hasText: 'Round 6' }).getByRole('button', { name: 'Delete Round' }).click();
                await management.getByRole('button', { name: 'Confirm Deletion' }).click();
                await expect(list.locator('#run-round-6')).toHaveCount(0);
                await management.getByRole('button', { name: 'Close Round Management' }).click();
                const target = list.locator('#run-round-2').locator('..');
                await target.getByRole('button', { name: 'Enter Scores' }).click();
                const scoring = workspace.getByRole('region', { name: 'Round scores' });
                await expect(scoring.getByRole('heading', { name: 'Round 2 Scores' })).toBeVisible();
                await expect(list).toBeVisible();
                await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                const inputs = await scoring.locator('.score-inputs input').all();
                for (const [index, input] of inputs.entries()) await input.fill(index % 2 ? '18' : '21');
                await scoring.getByRole('button', { name: 'Save Round Scores' }).click();
                await expect(scoring).toHaveCount(0);
                await expect(target).toHaveAttribute('open', '');
                await expect(target.getByRole('button', { name: 'Redraw Round Teams' })).toHaveCount(0);
                await target.getByRole('button', { name: 'Edit Scores' }).click();
                await expect(scoring.locator('.score-inputs input').first()).toHaveValue('21');
                await scoring.getByRole('button', { name: 'Back to Rounds' }).click();
                await expect(target).toHaveAttribute('open', '');
                if (theme === 'classic') {
                    async function checkPrint(button, printedRounds) {
                        const pending = page.waitForEvent('popup');
                        await button.click();
                        const popup = await pending;
                        await expect(popup.getByRole('heading', { name, exact: true }).first()).toBeVisible();
                        await expect(popup.locator('.printed-matchup')).toHaveCount(printedRounds.reduce((count, round) => count + round.teams.length / 2, 0));
                        await popup.close();
                    }
                    await checkPrint(target.getByRole('button', { name: 'Print Round 2' }), [rounds[1]]);
                    await toolbar.getByRole('button', { name: 'Print Rounds' }).click();
                    const printPanel = workspace.getByRole('region', { name: 'Print Rounds' });
                    await expect(printPanel.getByRole('button', { name: 'Print Selected Rounds' })).toBeDisabled();
                    await target.getByRole('checkbox', { name: 'Select for Printing' }).check();
                    await list.locator('#run-round-3').locator('..').getByRole('checkbox', { name: 'Select for Printing' }).check();
                    await target.locator('summary').click();
                    await target.locator('summary').click();
                    await expect(target.getByRole('checkbox', { name: 'Select for Printing' })).toBeChecked();
                    await checkPrint(printPanel.getByRole('button', { name: 'Print Selected Rounds' }), [rounds[1], rounds[2]]);
                    await checkPrint(printPanel.getByRole('button', { name: 'Print All Rounds' }), rounds);
                }
                await header.getByRole('button', { name: 'View Standings' }).click();
                await expect(page).toHaveURL(/\/standings\?leagueId=133/);
                await page.goto(origin + '/tournament/133');
                await expect(list.locator('#run-round-2').locator('..')).toHaveAttribute('open', '');
                rounds = rounds.map(round => ({ ...round, status: round.roundNumber === 5 ? 'voided' : 'completed' }));
                await page.reload();
                await expect(toolbar.getByRole('button', { name: 'View Standings' })).toBeVisible();
                await expect(toolbar.getByRole('button', { name: /Continue: Enter Round/ })).toHaveCount(0);
                const voidedRound = list.locator('#run-round-5').locator('..');
                await expect(voidedRound).toContainText('Voided');
                await voidedRound.locator('summary').click();
                await expect(voidedRound.getByRole('button', { name: /Scores|Print Round|Redraw Round Teams/ })).toHaveCount(0);
                await expect(voidedRound.getByRole('checkbox')).toHaveCount(0);
                await header.getByRole('link', { name: 'Back to Tournament Center' }).click();
                await expect(page).toHaveURL(/\/tournament\?view=current$/);
                assert.deepEqual(errors, []);
                await context.close();
                continue;
            }

            await page.setViewportSize({ width: theme === 'classic' ? 1920 : 390, height: 900 });
            await page.goto(origin + '/');
            await expect(page.getByRole('button', { name: /WW Winter 2026/ })).toBeVisible();
            if (theme !== 'classic') await page.getByRole('button', { name: 'Open navigation' }).click();
            await page.getByRole('link', { name: 'Tournament Center', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Tournament Center', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: /WW Winter 2026/ })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Open Tournament: ' + name, exact: true })).toBeVisible();
            await expect(page.getByRole('link', { name: 'WW Winter 2026' })).toHaveCount(0);
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
            await page.getByRole('button', { name: 'Round Byes', exact: true }).click();
            await page.getByRole('button', { name: 'Assign bye to Player 1', exact: true }).click();
            await expect(page.getByText(/1 manual bye/)).toBeVisible();
            await page.locator('app-tournament-rounds').screenshot({ path: path.join(out, theme + '-priorities.png') });
            await page.getByRole('button', { name: 'Return to Run Tournament' }).click();
            await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
            await page.locator('.saved-round').first().locator('summary').click();
            await expect(page.locator('.saved-round[open]').getByRole('heading', {name: 'Matchup 1', exact: true})).toBeVisible();
            if (theme === 'classic') {
                const popupPending = page.waitForEvent('popup');
                await page.getByRole('button', { name: 'Print Rounds', exact: true }).click();
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
            await expect(page.getByText('Round 1 scores saved.')).toBeVisible();
            assert.equal(savedScores, 1);

            rounds = [];
            await page.reload();
            await page.getByRole('button', { name: 'Generate Tournament Rounds' }).click();
            await expect(page.getByRole('heading', { name: 'Proposed Rounds' })).toBeVisible({timeout: 15000});
            assert.equal(generatedWrites, 0);
            await page.getByRole('button', { name: 'Save Proposed Rounds' }).click();
            await expect(page.getByText('Tournament rounds generated successfully.')).toBeVisible();
            assert.equal(generatedWrites, 1);
            assert.equal(rounds.length, 5);

            await page.setViewportSize({ width: 390, height: 844 });
            await page.getByLabel('Tournament setup step', { exact: true }).selectOption({ label: 'Team & Round Setup' });
            await expect(page.getByRole('heading', {name: 'Team & Round Setup'})).toBeVisible();
            await page.locator('app-tournament-center').screenshot({path: path.join(out, theme + '-wizard-mobile.png')});
            const mobileStep = page.getByLabel('Tournament setup step', { exact: true });
            for (const label of ['Tournament Details', 'Manage Participants', 'Player Priorities & Byes', 'Confirm Participants',
                'Generate & Preview Tournament', 'Run Tournament']) {
                await mobileStep.selectOption({ label });
                await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            }
            await page.locator('.saved-round').first().locator('summary').click();
            await page.locator('app-tournament-rounds').screenshot({ path: path.join(out, theme + '-rounds-mobile.png') });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await mobileStep.selectOption({ label: 'Confirm Participants' });
            await expect(page.getByRole('heading', { name: 'Confirm Participants' })).toBeVisible();
            await expect(page.getByText('1 registered', {exact: true})).toBeVisible();
            await expect(page.getByText('1 checked in', {exact: true})).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            await page.locator('app-tournament-check-in').screenshot({ path: path.join(out, theme + '-check-in-mobile.png') });
            {
                await page.setViewportSize({ width: 1920, height: 900 });
                await page.getByRole('button', {name: /Tournament Details/}).click();
                const form = await page.locator('#tournament-details').boundingBox();
                const sidebar = await page.locator('.wizard-steps').boundingBox();
                const wizard = await page.locator('.workflow').boundingBox();
                assert(form.width >= 750 && form.width <= 850);
                assert(Math.abs(form.x + form.width / 2 - (sidebar.x + sidebar.width + wizard.x + wizard.width + 16) / 2) < 2);
                await page.screenshot({path: path.join(out, theme + '-details-desktop.png')});
                await page.getByRole('button', {name: /Team & Round Setup/}).click();
                const structure = page.locator('.settings-grid > .settings-card');
                const format = page.locator('.format-column > .settings-card').first();
                const preferences = page.locator('.format-column > .settings-card').last();
                await expect(preferences.getByRole('heading', {name: 'Generation Preferences'})).toBeVisible();
                const [left, top, bottom] = await Promise.all([structure.boundingBox(), format.boundingBox(), preferences.boundingBox()]);
                assert(left.x < top.x && Math.abs(left.y - top.y) < 2);
                assert(Math.abs(top.x - bottom.x) < 2 && top.y + top.height < bottom.y);
                await page.screenshot({path: path.join(out, theme + '-setup-desktop.png')});
                await page.setViewportSize({ width: 390, height: 844 });
                const [mobileLeft, mobileTop, mobileBottom] = await Promise.all([structure.boundingBox(), format.boundingBox(), preferences.boundingBox()]);
                assert(Math.abs(mobileLeft.x - mobileTop.x) < 2 && mobileLeft.y + mobileLeft.height < mobileTop.y && mobileTop.y + mobileTop.height < mobileBottom.y);
                await page.screenshot({path: path.join(out, theme + '-setup-mobile.png')});
                await expect(page.getByLabel('Number of Rounds', {exact: true})).toHaveCount(0);
                await page.getByRole('button', {name: 'Manage Existing Rounds', exact: true}).click();
                await expect(page.getByRole('heading', {name: 'Manage Existing Rounds'})).toBeVisible();
                await page.locator('.saved-round').first().locator('summary').click();
                await expect(page.getByRole('button', {name: 'Delete Round', exact: true})).toBeVisible();
                await page.screenshot({path: path.join(out, theme + '-manage-rounds-mobile.png')});
                await page.getByRole('button', {name: 'Back to Tournament'}).click();
                await page.getByRole('button', {name: 'Add Additional Rounds', exact: true}).click();
                await page.getByLabel('Number of Additional Rounds').fill('2');
                await expect(page.getByText(/5 existing rounds.*2 additional rounds.*7 total/)).toBeVisible();
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                await page.screenshot({path: path.join(out, theme + '-add-rounds-mobile.png')});
                await page.getByRole('button', {name: 'Cancel', exact: true}).click();
            }
            role = 'Player';
            for (const mode of [3, 1, 0, 2]) {
                attendanceMode = mode;
                present = false;
                await page.goto(origin + '/tournament/133/check-in');
                await expect(page).toHaveURL(/leagueId=133#attendance$/);
                await page.getByRole('button', {name: 'Check In for Tournament'}).click();
                await expect(page.locator('.attendance-success')).toContainText('Checked In for Tournament');
            }
            await page.goto(origin + '/tournament/133/rounds');
            await expect(page.getByRole('heading', { name })).toBeVisible().catch(async error => {
                console.error(page.url(), await page.locator('body').innerText(), errors);
                throw error;
            });
            await expect(page.getByRole('button', { name: 'Save Round Scores' })).toHaveCount(0);
            await page.getByRole('button', { name: 'Open navigation' }).click();
            await expect(page.getByRole('link', { name: 'Tournament Center', exact: true })).toBeVisible();
            await page.goto(origin + '/tournament');
            await expect(page.getByRole('heading', { name: 'Tournament Center', exact: true })).toBeVisible();
            assert.deepEqual(errors, []);
            await context.close();
        }
        console.log(visualPolish ? 'Centered popups, deletion layout, and synchronized redraw passed in three themes.' :
            notificationsOnly ? 'Tournament popup, timing, dismissal, validation, error, and confirmation checks passed in three themes.' :
            layoutOnly ? 'Run Tournament dashboard, round management, scoring, printing, and redraw checks passed.' :
            'Tournament setup, preview/save, scores, printing, check-in, participant matchups and 390px layouts passed in three themes.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

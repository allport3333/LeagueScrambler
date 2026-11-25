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
const priorityOnly = process.argv.includes('--priority-activation');
const scoreGuidance = process.argv.includes('--score-guidance');
assert(out && process.env.LEAGUE_TEST_DIST);
const roster = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1, firstName: 'Player', lastName: visualPolish && index === 19 ? 'A-Long-Surname-For-Checking-Mobile-Team-Editor-Wrapping' : String(index + 1), isMale: index % 2 === 0
}));
const name = 'Tournament Browser Fixture';
const settings = {
    maximumTeamSize: 4, numberOfTeams: null, numberOfRounds: 5, gamesPerMatchup: 1,
    balanceGenders: true, minimizeRepeats: true, balancePriorities: false, automaticByes: false,
    activeTeamLimit: null, topPlayerIds: [1, 2], lowPlayerIds: [3, 4], historicalScrambleNumbers: [],
    manualByes: []
};
const details = { eventDate: '2026-12-12', description: '', location: 'Gym', version: 'fixture', workflowStep: 6 };
const defaultRounds = [1, 2, 3, 4, 5].map(roundNumber => ({
    roundNumber, status: roundNumber === 1 ? 'partial' : 'unplayed', gamesPerMatchup: 1,
    teams: Array.from({length: roundNumber === 1 ? 12 : visualPolish && roundNumber === 4 ? 4 : 6}, (_, index) => ({
        id: 100 * roundNumber + index,
        players: Array.from({length: 4}, (_, player) => roster[(index * 4 + player) % roster.length]), scores: []
    })),
    byes: []
}));

(async () => {
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
        for (const theme of priorityOnly ? ['classic'] : scoreGuidance ? ['classic', 'charcoal'] : ['classic', 'navy', 'charcoal']) {
            const context = await browser.newContext({
                serviceWorkers: 'block', reducedMotion: 'no-preference', viewport: { width: 1440, height: 960 }
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
            if (scoreGuidance) rounds = Array.from({ length: 10 }, (_, index) => ({
                ...structuredClone(defaultRounds[3]), roundNumber: index + 1,
                status: index < 6 ? 'completed' : 'unplayed'
            }));
            if (visualPolish) for (const round of rounds) round.teams.forEach((team, index) => {
                team.players = roster.filter((_, playerIndex) => playerIndex % round.teams.length === index);
            });
            let roundSettings = priorityOnly ? { ...settings, maximumTeamSize: null, numberOfTeams: 4 } : structuredClone(settings);
            let generatedWrites = 0;
            let savedScores = 0;
            let present = true;
            let attendanceMode = 1;
            let rejectScores = false, rejectRedraw = false;
            let canGenerate = true;
            let manualWrites = 0;
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
                if ((layoutOnly || notificationsOnly || visualPolish) && method === 'POST' && endpoint.endsWith('/rounds/remove')) {
                    const { roundNumbers } = route.request().postDataJSON();
                    rounds = rounds.filter(round => !roundNumbers.includes(round.roundNumber));
                    return route.fulfill({ json: { version: details.version } });
                }
                if (method === 'PUT') {
                    const body = route.request().postDataJSON();
                    if (visualPolish && /\/rounds\/\d+\/teams$/.test(endpoint)) {
                        const round = rounds.find(item => item.roundNumber === Number(endpoint.split('/').at(-2)));
                        for (const assignment of body.teams)
                            round.teams.find(team => team.id === assignment.teamId).players =
                                assignment.playerIds.map(id => roster.find(player => player.id === id));
                        manualWrites++;
                        return route.fulfill({ json: { version: details.version } });
                    }
                    if (notificationsOnly && endpoint.endsWith('/details'))
                        return route.fulfill({ json: { name: body.name, details: { ...details, ...body } } });
                    if ((notificationsOnly || priorityOnly) && endpoint.endsWith('/workflow'))
                        return route.fulfill({ json: { step: body.step + 1 } });
                    if (endpoint === '/api/tournament-attendance/133/players/1') present = body.present;
                    else if (endpoint.endsWith('/round-settings')) roundSettings = body.settings;
                    else if (endpoint.endsWith('/rounds')) {
                        if (visualPolish && rejectRedraw) return route.fulfill({ status: 409, json: { message: 'Fixture rejected redraw.' } });
                        generatedWrites++;
                        const updated = body.rounds.map(round => ({
                            ...round, status: 'unplayed', gamesPerMatchup: roundSettings.gamesPerMatchup,
                            teams: round.teams.map((members, index) => ({
                                id: 100 * round.roundNumber + index, scores: [],
                                players: members.map(id => roster.find(player => player.id === id))
                            }))
                        }));
                        if (layoutOnly || visualPolish || priorityOnly) {
                            const updatedNumbers = new Set(updated.map(round => round.roundNumber));
                            rounds = [...rounds.filter(round => !updatedNumbers.has(round.roundNumber)), ...updated]
                                .sort((a, b) => a.roundNumber - b.roundNumber);
                            if (body.additionalSettings) roundSettings.numberOfRounds += updated.length;
                        } else rounds = updated;
                    } else if ((layoutOnly || notificationsOnly || visualPolish) && /\/rounds\/\d+\/scores$/.test(endpoint)) {
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
                    version: details.version, mode: attendanceMode, roster, presentIds: canGenerate ? roster.filter(player => player.id !== 1 || present).map(player => player.id) : [], history: [], settings: roundSettings,
                    additionalDefaults: priorityOnly ? { ...roundSettings, topPlayerIds: [], lowPlayerIds: [] } : undefined
                };
                else if (endpoint === '/api/tournaments/133/rounds') data = { name, version: details.version, settingsSaved: true, canVoid: role === 'Admin', rounds };
                else if (endpoint === '/api/tournaments/133/check-in' || endpoint === '/api/tournament-attendance/133') data = {
                    name, ...details, mode: attendanceMode, organizers: role !== 'Player', ownPlayerId: 1,
                    roster: [{ ...roster[0], present }]
                };
                return route.fulfill({ json: data });
            });

            if (scoreGuidance) {
                await page.setViewportSize({ width: theme === 'classic' ? 1440 : 390, height: 800 });
                const workspace = page.locator('app-tournament-center');
                async function traceGuidance(button, pointer = false) {
                const trace = await button.evaluateHandle(element => ({ result: new Promise(resolve => {
                    element.addEventListener('click', () => {
                        const samples = [];
                        const began = performance.now();
                        const origin = window.scrollY;
                        function record(now) {
                            samples.push([now - began, scrollY]);
                            if (document.activeElement?.matches('#matchups-7 input[type="number"]')) {
                                resolve({ origin, samples, finished: now - began });
                            } else if (now - began > 2200) {
                                resolve({ origin, samples, finished: null });
                            } else requestAnimationFrame(record);
                        }
                        requestAnimationFrame(record);
                    }, { once: true, capture: true });
                }) }));
                if (pointer) await button.click();
                else await button.evaluate(element => { element.focus({ preventScroll: true }); element.click(); });
                const result = await trace.evaluate(trace => trace.result);
                await trace.dispose();
                return result;
                }
                let animatedOrigin, alignedPosition;
                for (const motion of ['no-preference', 'reduce']) {
                    await page.emulateMedia({ reducedMotion: motion });
                    await page.goto(origin + '/tournament/133?step=7');
                    const card = number => workspace.locator('#run-round-' + number).locator('..');
                    for (const number of (motion === 'reduce' ? [9, 10] : [8, 9, 10]))
                        if (await card(number).getAttribute('open') === null) await card(number).locator('summary').click();
                    if (motion === 'reduce' && await card(8).getAttribute('open') !== null) await card(8).locator('summary').click();
                    if (await card(7).getAttribute('open') !== null) await card(7).locator('summary').click();
                    const button = workspace.getByRole('button', { name: 'Continue: Enter Round 7 Scores' });
                    await button.evaluate(element => element.scrollIntoView({ block: 'end', behavior: 'instant' }));
                    const result = await traceGuidance(button, true);
                    console.log(theme, motion, JSON.stringify({ origin: result.origin, first: result.samples[0],
                        last: result.samples.at(-1), points: new Set(result.samples.map(sample => sample[1])).size, elapsed: result.finished }));
                    const field = card(7).locator('.score-inputs input').first();
                    await expect(card(7)).toHaveAttribute('open', '');
                    await expect(field).toBeFocused();
                    await expect(field).toBeInViewport();
                    assert(await field.evaluate(element => element.getBoundingClientRect().top >=
                        document.querySelector('.league-navigation').getBoundingClientRect().height));
                    if (motion === 'no-preference') {
                        animatedOrigin = result.origin;
                        assert(Math.abs(result.samples[0][1] - result.origin) <= 4, 'Expansion keeps the starting scroll position');
                        assert(result.finished >= 1150 && result.finished <= 1450, 'Guided scroll lasts around 1.2 seconds');
                        assert(new Set(result.samples.map(sample => sample[1])).size >= 15);
                        assert(await card(7).evaluate(element => element.getAnimations().some(animation => animation.playState === 'running')));
                    } else {
                        assert.notEqual(result.origin, animatedOrigin, 'Start from a different scroll position');
                        assert(result.finished < 250, 'Reduced motion jumps directly');
                    }
                    const destination = await page.evaluate(() => scrollY);
                    alignedPosition = destination;
                    await page.waitForTimeout(140);
                    assert.equal(await page.evaluate(() => scrollY), destination, 'Focusing the editor causes no second scroll');
                }
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                const nextVisible = workspace.getByRole('button', { name: 'Continue: Enter Round 7 Scores' });
                const field = workspace.locator('#matchups-7 .score-inputs input').first();
                // Trigger the actual button without Playwright first scrolling it back into view.
                for (const [selector, viewportFraction] of [
                    ['#matchups-7 .score-inputs input', .85],
                    ['#matchups-7 .score-inputs input', .58],
                    ['#run-round-7', .97]
                ]) {
                    await page.locator(selector).first().evaluate((element, fraction) => window.scrollTo({
                        top: scrollY + element.getBoundingClientRect().top - innerHeight * fraction,
                        behavior: 'instant'
                    }), viewportFraction);
                    const result = await traceGuidance(nextVisible);
                    assert(result.finished >= 1150 && result.finished <= 1450, 'Visible or partial target still animates');
                    assert(new Set(result.samples.map(sample => sample[1])).size >= 12);
                    assert(Math.abs(result.samples.at(-1)[1] - alignedPosition) <= 2, 'Arrives at the same alignment');
                    await expect(field).toBeFocused();
                }
                const aligned = await traceGuidance(nextVisible);
                assert(new Set(aligned.samples.map(sample => sample[1])).size === 1, 'Already aligned stays in place');
                assert(await workspace.locator('#run-round-7').locator('..').evaluate(card =>
                    card.getAnimations().some(animation => animation.playState === 'running')), 'Already aligned still highlights');
                if (theme === 'classic') {
                    await page.goto(origin + '/tournament/133?step=7');
                    const next = workspace.getByRole('button', { name: 'Continue: Enter Round 7 Scores' });
                    await next.evaluate(button => button.scrollIntoView({ block: 'end', behavior: 'instant' }));
                    await next.click();
                    await expect.poll(() => page.evaluate(() => document.scrollingElement.style.overflowAnchor)).toBe('none');
                    await page.mouse.wheel(0, -160);
                    await expect.poll(() => page.evaluate(() => document.scrollingElement.style.overflowAnchor)).toBe('');
                    await page.waitForTimeout(1250);
                    await expect(workspace.locator('#matchups-7 input').first()).not.toBeFocused();
                }
                assert.deepEqual(errors, []);
                await context.close();
                continue;
            }
            if (priorityOnly) {
                await page.goto(origin + '/tournament/133?step=4');
                const workspace = page.locator('app-tournament-center');
                await expect(workspace.getByText(/Top Players are automatically distributed/)).toBeVisible();
                await expect(workspace.getByText('Balance Teams by Player Priority')).toHaveCount(0);
                await workspace.getByLabel('Priority for Player 5', { exact: true }).selectOption('top');
                await workspace.getByRole('button', { name: 'Save & Continue' }).click();
                await expect(workspace.getByRole('heading', { name: 'Confirm Participants' })).toBeVisible();
                await page.goto(origin + '/tournament/133?step=4');
                await expect(workspace.getByLabel('Priority for Player 5', { exact: true })).toHaveValue('top');
                await expect(workspace.getByText(/3 Top Players selected/)).toBeVisible();

                await page.goto(origin + '/tournament/133?step=7');
                const round = workspace.locator('#run-round-2').locator('..');
                if (await round.getAttribute('open') === null) await round.locator('summary').click();
                await round.getByRole('button', { name: 'Manage Round' }).click();
                await page.getByRole('dialog').getByRole('button', { name: 'Redraw Round Teams' }).click();
                await expect(round.getByText('Unsaved Team Preview')).toBeVisible();
                const topNames = new Set(['Player 1', 'Player 2', 'Player 5']);
                const counts = await round.locator('.matchup .team-roster').evaluateAll((teams, names) =>
                    teams.map(team => [...team.querySelectorAll('li')].filter(player => names.includes(player.textContent.trim())).length), [...topNames]);
                assert.deepEqual(counts.slice().sort(), [0, 1, 1, 1]);
                assert(counts.some((count, index) => index % 2 === 0 && count === 1 && counts[index + 1] === 1));
                await round.getByRole('button', { name: 'Cancel', exact: true }).click();
                await expect(round.getByText('Unsaved Team Preview')).toHaveCount(0);
                assert.equal(generatedWrites, 0);

                await workspace.getByRole('button', { name: 'Add Additional Rounds' }).click();
                await workspace.getByRole('button', { name: 'Preview Additional Rounds' }).click();
                const request = page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith('/133/rounds'));
                await workspace.getByRole('button', { name: 'Save Additional Rounds' }).click();
                const allocation = (await request).postDataJSON();
                assert.deepEqual(allocation.additionalSettings.topPlayerIds.sort((a, b) => a - b), [1, 2, 5]);
                assert.deepEqual(allocation.additionalSettings.lowPlayerIds, [3, 4]);
                const appended = allocation.rounds[0].teams.map(team => team.filter(id => [1, 2, 5].includes(id)).length);
                assert.deepEqual(appended.slice().sort(), [0, 1, 1, 1]);
                assert(appended.some((count, index) => index % 2 === 0 && count === 1 && appended[index + 1] === 1));
                await expect(workspace.locator('#run-round-6')).toBeVisible();
                assert.deepEqual(errors, []);
                console.log('Tournament priorities persist across reopening and apply to redraw and additional rounds.');
                await context.close();
                continue;
            }

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
                const toast = page.locator('mat-snack-bar-container:not([mat-exit])');
                const roundCard = number => workspace.locator('#run-round-' + number).locator('..');
                async function manageRound(number) {
                    const card = roundCard(number);
                    const summary = card.locator('summary');
                    if (await card.getAttribute('open') === null) await summary.click();
                    await card.getByRole('button', { name: 'Manage Round', exact: true }).click();
                    const dialog = page.getByRole('dialog');
                    await expect(dialog.getByRole('heading', { name: 'Manage Round ' + number })).toBeVisible();
                    return dialog;
                }
                async function startRedraw(number) {
                    const dialog = await manageRound(number);
                    await dialog.getByRole('button', { name: 'Redraw Round Teams' }).click();
                }
                const original = structuredClone(rounds);
                const target4 = roundCard(4);
                const toolbar = workspace.getByRole('group', { name: 'Tournament actions' });
                await expect(toolbar.getByRole('button', { name: /Continue/ })).toHaveCount(0);
                const roundList = workspace.getByRole('region', { name: 'Saved tournament rounds' });
                for (const number of [2, 3, 4, 5])
                    if (await roundCard(number).getAttribute('open') === null) await roundCard(number).locator('summary').click();
                const next = roundList.locator('.continue-scoring').getByRole('button', { name: 'Continue: Finish Round 1 Scores' });
                await next.evaluate(button => button.scrollIntoView({ block: 'end', behavior: 'instant' }));
                await page.evaluate(() => {
                    window.scoreScroll = [];
                    window.addEventListener('scroll', () => window.scoreScroll.push(scrollY), { passive: true });
                });
                await next.click();
                const guided = roundCard(1).getByRole('region', { name: 'Round scores' });
                await expect(guided.getByRole('spinbutton').first()).toBeFocused();
                await expect(guided.getByRole('spinbutton').first()).toBeInViewport();
                const scrollSteps = await page.evaluate(() => new Set(window.scoreScroll).size);
                assert(scrollSteps > 4, theme + ' guided scroll steps: ' + scrollSteps);
                await guided.getByRole('button', { name: 'Cancel' }).click();
                await target4.evaluate(card => {
                    window.redrawTiming = {};
                    const observer = new MutationObserver(() => {
                        if (card.querySelector('.round-shuffle') && !window.redrawTiming.shuffle) {
                            window.redrawTiming.shuffle = performance.now();
                            window.redrawTiming.controlsDuringShuffle = [...card.querySelectorAll('button')]
                                .some(button => button.textContent.trim() === 'Save New Round Teams');
                        }
                        if (card.querySelector('.inline-redraw')) {
                            window.redrawTiming.ready = performance.now();
                            observer.disconnect();
                        }
                    });
                    observer.observe(card, { childList: true, subtree: true, attributes: true });
                });
                await startRedraw(4);
                await expect(target4.getByText('Unsaved Team Preview')).toBeVisible();
                const timing = await page.evaluate(() => window.redrawTiming);
                assert(timing.ready - timing.shuffle >= 650, 'Save waits for shuffle and reveal');
                assert.equal(timing.controlsDuringShuffle, false);
                await expect(workspace.locator('.preview, .redraw-flight')).toHaveCount(0);
                await expect(target4.locator('.matchup-grid')).toHaveCount(1);
                await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
                assert.deepEqual(rounds, original);
                await target4.getByRole('button', { name: 'Cancel', exact: true }).click();
                await expect(target4.getByText('Unsaved Team Preview')).toHaveCount(0);
                assert.deepEqual(rounds, original);

                const regeneration = await manageRound(4);
                await expect(regeneration.getByText('Update Remaining Players')).toHaveCount(0);
                await regeneration.getByRole('button', { name: 'Regenerate This and Following Unplayed Rounds' }).click();
                await expect(regeneration.getByText('20 eligible players')).toBeVisible();
                await regeneration.getByRole('button', { name: 'Go to Confirm Participants' }).click();
                const attendance = workspace.locator('app-tournament-check-in');
                await attendance.getByRole('button', { name: 'Undo check-in for Player 1' }).click();
                await expect(attendance.getByRole('button', { name: 'Check in Player 1', exact: true })).toBeVisible();
                await workspace.getByRole('button', { name: 'Back to Round 4 Regeneration' }).click();
                await expect(regeneration.getByText('19 eligible players')).toBeVisible();
                await regeneration.getByRole('button', { name: 'Close', exact: true }).click();
                assert.deepEqual(rounds, original);
                present = true;

                await expect(workspace.getByRole('button', { name: 'Manage Rounds', exact: true })).toHaveCount(0);
                const protectedDialog = await manageRound(1);
                await expect(protectedDialog.getByRole('button', { name: 'Void Round' })).toBeVisible();
                await expect(protectedDialog.getByRole('button', { name: /Modify Teams|Redraw|Delete Round/ })).toHaveCount(0);
                await protectedDialog.getByRole('button', { name: 'Close', exact: true }).click();
                const manager = await manageRound(4);
                await centered(manager);
                await manager.getByRole('button', { name: 'Modify Teams Manually' }).click();
                const editor = manager.locator('app-tournament-team-editor');
                async function assertTeamSelections(scope, savedRound) {
                    for (const team of savedRound.teams)
                        for (const player of team.players)
                            await expect(scope.getByLabel('Assigned team for ' + player.firstName + ' ' + player.lastName, { exact: true }))
                                .toHaveValue(String(team.id));
                }
                await assertTeamSelections(editor, original[3]);
                await expect.poll(() => editor.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
                await expect(editor.getByRole('button', { name: 'Save Team Changes' })).toBeDisabled();
                await editor.getByLabel('Assigned team for Player 1', { exact: true }).selectOption({ label: 'Team 2' });
                await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
                assert.deepEqual(rounds, original);
                await manager.getByRole('button', { name: 'Modify Teams Manually' }).click();
                await editor.getByLabel('Assigned team for Player 1', { exact: true }).selectOption({ label: 'Team 2' });
                const editableTeams = editor.locator('.teams section');
                await editableTeams.nth(0).getByRole('button', { name: 'Swap' }).first().click();
                await editableTeams.nth(1).getByRole('button', { name: 'Swap' }).first().click();
                await expect(editor.getByRole('button', { name: 'Undo' })).toBeEnabled();
                await editor.getByRole('button', { name: 'Save Team Changes' }).click();
                await expect(toast).toContainText('Round 4 teams updated successfully.');
                await expect(roundCard(4)).toHaveAttribute('open', '');
                assert.deepEqual(rounds.filter(round => round.roundNumber !== 4), original.filter(round => round.roundNumber !== 4));
                assert(rounds[3].teams[1].players.some(player => player.id === 1));
                await toast.getByRole('button', { name: 'OK' }).click();
                await page.reload();
                await expect(roundCard(4)).toHaveAttribute('open', '');
                await startRedraw(3);
                const preview3 = roundCard(3);
                await expect(preview3.getByText('Unsaved Team Preview')).toBeVisible();
                await preview3.getByRole('button', { name: 'Modify Teams Manually' }).click();
                const proposed = page.getByRole('dialog');
                await proposed.locator('.teams section').nth(0).getByRole('button', { name: 'Swap' }).first().click();
                await proposed.locator('.teams section').nth(1).getByRole('button', { name: 'Swap' }).first().click();
                await proposed.getByRole('button', { name: 'Apply to Preview' }).click();
                assert.equal(generatedWrites, 0);
                rejectRedraw = true;
                await preview3.getByRole('button', { name: 'Save New Round Teams' }).click();
                await expect(toast).toContainText('Fixture rejected redraw.');
                await expect(preview3.getByText('Unsaved Team Preview')).toBeVisible();
                await toast.getByRole('button', { name: 'Close' }).click();
                rejectRedraw = false;
                await preview3.getByRole('button', { name: 'Save New Round Teams' }).click();
                await expect(toast).toContainText('Round 3 teams updated successfully.');
                await centered(toast);
                await page.screenshot({ path: path.join(out, theme + '-centered-success.png') });
                await toast.getByRole('button', { name: 'OK' }).click();

                await page.emulateMedia({ reducedMotion: 'reduce' });
                await startRedraw(2);
                const secondRound = roundCard(2);
                await expect(secondRound.getByRole('button', { name: 'Save New Round Teams' })).toBeVisible();
                await expect(secondRound.getByText('Shuffling teams')).toHaveCount(0);
                await secondRound.getByRole('button', { name: 'Cancel', exact: true }).click();
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                canGenerate = false;
                await page.reload();
                await startRedraw(2);
                await expect(toast).toContainText('Between 2 and 256 eligible participants are required.');
                await centered(toast);
                await expect(secondRound.getByText('Unsaved Team Preview')).toHaveCount(0);
                await expect(secondRound.getByRole('button', { name: 'Manage Round' })).toBeEnabled();
                await toast.getByRole('button', { name: 'Close' }).click();

                canGenerate = true;
                rounds[1].gamesPerMatchup = 3;
                await page.reload();
                await secondRound.getByRole('button', { name: 'Enter Scores', exact: true }).click();
                const inline = secondRound.getByRole('region', { name: 'Round scores' });
                await expect(inline.getByRole('heading', { name: 'Round 2 Scores' })).toBeVisible();
                await expect(inline.locator('.matchup').first().getByRole('spinbutton')).toHaveCount(6);
                await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
                const inputs = inline.locator('.matchup').first().getByRole('spinbutton');
                await inputs.nth(0).fill('21');
                await inputs.nth(1).fill('18');
                await expect(secondRound.getByRole('button', { name: 'Manage Round' })).toBeDisabled();
                await inline.getByRole('button', { name: 'Save Round Scores' }).click();
                await expect(secondRound.getByRole('button', { name: 'Continue Scoring' })).toBeVisible();
                await expect(secondRound).toHaveAttribute('open', '');
                await secondRound.getByRole('button', { name: 'Continue Scoring' }).click();
                await expect(inputs.nth(0)).toHaveValue('21');
                await inputs.nth(0).fill('19');
                const fifth = roundCard(5);
                if (await fifth.getAttribute('open') === null) await fifth.locator('summary').click();
                await fifth.getByRole('button', { name: 'Enter Scores', exact: true }).click();
                const discard = page.getByRole('alertdialog');
                await discard.getByRole('button', { name: 'Cancel' }).click();
                await expect(inputs.nth(0)).toHaveValue('19');
                await inline.getByRole('button', { name: 'Cancel' }).click();
                await discard.getByRole('button', { name: 'Discard' }).click();
                await secondRound.getByRole('button', { name: 'Continue Scoring' }).click();
                await expect(inputs.nth(0)).toHaveValue('21');
                const allScores = await inline.getByRole('spinbutton').all();
                for (const [index, input] of allScores.entries()) await input.fill(index % 2 ? '18' : '21');
                await inline.getByRole('button', { name: 'Save Round Scores' }).click();
                await expect(secondRound.getByRole('button', { name: 'Edit Scores' })).toBeVisible();
                await secondRound.getByRole('button', { name: 'Edit Scores' }).click();
                await inputs.nth(0).fill('23');
                await inline.getByRole('button', { name: 'Save Round Scores' }).click();
                await expect(toast).toContainText('Round 2 score corrections saved.');
                assert.equal(rounds[1].teams[0].scores.find(score => score.game === 1).points, 23);

                if (theme === 'classic') {
                    await page.goto(origin + '/tournament/133?step=3');
                    await workspace.getByRole('button', { name: 'Manage Existing Rounds' }).click();
                    const setup = workspace.getByRole('region', { name: 'Manage Rounds' });
                    const setupRound = setup.locator('#matchups-4').locator('..');
                    if (await setupRound.getAttribute('open') === null) await setupRound.locator('summary').click();
                    await setupRound.evaluate(card => {
                        window.setupShuffled = false;
                        const observer = new MutationObserver(() => {
                            if (!card.querySelector('.round-shuffle')) return;
                            window.setupShuffled = true;
                            observer.disconnect();
                        });
                        observer.observe(card, { childList: true, subtree: true });
                    });
                    await setupRound.getByRole('button', { name: 'Redraw Round Teams' }).click();
                    await expect(setupRound.getByText('Unsaved Team Preview')).toBeVisible();
                    assert(await page.evaluate(() => window.setupShuffled), 'Setup redraw ran the inline shuffle');
                    await expect(workspace.locator('.preview')).toHaveCount(0);
                    await setupRound.getByRole('button', { name: 'Cancel', exact: true }).click();
                    await expect(setupRound.getByText('Unsaved Team Preview')).toHaveCount(0);

                    await page.goto(origin + '/tournament/133?step=6');
                    const beforeBatch = structuredClone(rounds);
                    await workspace.getByRole('button', { name: 'Preview All Unplayed Rounds' }).click();
                    await expect(workspace.locator('.round-list .round-matchups.inline-redraw')).toHaveCount(3);
                    await expect(workspace.locator('.preview')).toHaveCount(0);
                    assert.deepEqual(rounds, beforeBatch);
                    await roundCard(4).getByRole('button', { name: 'Save New Round Teams' }).click();
                    await expect(toast).toContainText('Upcoming tournament rounds updated.');
                    await expect(workspace.getByRole('heading', { name: 'Generate & Preview Tournament' })).toBeVisible();
                    assert.deepEqual(rounds.slice(0, 2), beforeBatch.slice(0, 2));
                }

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
                assert.equal(generatedWrites, theme === 'classic' ? 2 : 1);
                assert.equal(manualWrites, 1);
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

                const secondRound = workspace.locator('#run-round-2').locator('..');
                if (await secondRound.getAttribute('open') === null) await secondRound.locator('summary').click();
                await secondRound.getByRole('button', { name: 'Manage Round', exact: true }).click();
                const management = page.getByRole('dialog');
                await management.getByRole('button', { name: 'Delete Round' }).click();
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
                await second.getByRole('button', { name: 'Manage Round', exact: true }).click();
                await page.getByRole('dialog').getByRole('button', { name: 'Redraw Round Teams' }).click();
                const preview = second;
                await expect(preview.getByText('Unsaved Team Preview')).toBeVisible();
                assert.equal(generatedWrites, 0);
                await page.screenshot({ path: path.join(out, `${theme}-${width}-redraw.png`) });
                await preview.getByRole('button', { name: 'Cancel' }).click();
                await expect(preview.getByText('Unsaved Team Preview')).toHaveCount(0);
                assert.deepEqual(rounds, unchanged);
                await second.getByRole('button', { name: 'Manage Round', exact: true }).click();
                await page.getByRole('dialog').getByRole('button', { name: 'Redraw Round Teams' }).click();
                await preview.getByRole('button', { name: 'Save New Round Teams' }).click();
                await expect.poll(() => generatedWrites).toBe(1);
                assert.deepEqual(rounds.filter(round => round.roundNumber !== 2), unchanged.filter(round => round.roundNumber !== 2));
                const list = workspace.getByRole('region', { name: 'Saved tournament rounds' });
                const toolbar = workspace.getByRole('group', { name: 'Tournament actions' });
                await expect(toolbar.getByRole('button')).toHaveCount(2);
                await expect(workspace.getByText('Participants and saved rounds', { exact: true })).toHaveCount(0);
                const management = page.getByRole('dialog');
                await second.getByRole('button', { name: 'Manage Round', exact: true }).click();
                await expect(management.getByRole('button', { name: 'Update Remaining Players' })).toHaveCount(0);
                await management.getByRole('button', { name: 'Regenerate This and Following Unplayed Rounds' }).click();
                await expect(management.getByText(/New teams will use the current eligible participants/)).toBeVisible();
                await management.getByRole('button', { name: 'Close', exact: true }).click();
                await expect(second).toHaveAttribute('open', '');
                await toolbar.getByRole('button', { name: 'Add Additional Rounds' }).click();
                await expect(list).toBeVisible();
                await expect(workspace.getByText(/players eligible for these rounds/)).toBeVisible();
                await expect(workspace.getByText('Availability for New Rounds')).toHaveCount(0);
                await workspace.getByRole('button', { name: 'Preview Additional Rounds' }).click();
                await workspace.locator('.preview').getByRole('button', { name: 'Save Additional Rounds' }).click();
                const added = list.locator('#run-round-6').locator('..');
                await expect(added).toBeVisible();
                if (await added.getAttribute('open') === null) await added.locator('summary').click();
                await added.getByRole('button', { name: 'Manage Round', exact: true }).click();
                await management.getByRole('button', { name: 'Delete Round' }).click();
                await management.getByRole('button', { name: 'Confirm Deletion' }).click();
                await expect(list.locator('#run-round-6')).toHaveCount(0);
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
                await scoring.getByRole('button', { name: 'Cancel', exact: true }).click();
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
                await expect(list.getByRole('button', { name: 'View Final Standings' })).toBeVisible();
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
        if (!priorityOnly && !scoreGuidance) console.log(visualPolish ? 'Inline redraw, inline scoring, and attendance return passed in three themes.' :
            notificationsOnly ? 'Tournament popup, timing, dismissal, validation, error, and confirmation checks passed in three themes.' :
            layoutOnly ? 'Run Tournament dashboard, round management, scoring, printing, and redraw checks passed.' :
            'Tournament setup, preview/save, scores, printing, check-in, participant matchups and 390px layouts passed in three themes.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

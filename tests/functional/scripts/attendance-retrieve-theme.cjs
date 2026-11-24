const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const out = process.env.LEAGUE_TEST_OUT;
const league = { id: 101, leagueName: 'Harbor League' };
const player = { id: 7, firstName: 'Avery', lastName: 'Harbor', isMale: true };
const players = [player, ...[8, 9, 10].map(id => ({
    id, firstName: 'Player', lastName: String(id), isMale: id < 9
}))];
const savedPairs = { 12: [[7, 8], [9, 10]], 13: [[7, 9], [8, 10]], 14: [[7, 10], [8, 9]] };
function savedTeams(number) {
    return (savedPairs[number] || savedPairs[12]).map((pair, index) => ({
        kingQueenTeam: { id: number * 10 + index, leagueID: league.id, scrambleNumber: number, scrambleWithScoresToBeSaved: true },
        players: pair.map(id => players.find(player => player.id === id))
    }));
}
const scrambles = [12, 13, 14, 15, 16, 17].map(number => ({
    id: 200 + number, scrambleNumber: number, dateOfTeam: '2026-11-18T12:00:00'
}));
assert(out && process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(out, { recursive: true });

function contrast(first, second) {
    function luminance(color) {
        const rgb = color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(value => Number(value) / 255);
        return rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    }
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function checkText(locator, surface, label, minimum = 4.5) {
    const foreground = await locator.evaluate(el => getComputedStyle(el).color);
    const background = await surface.evaluate(el => {
        for (let node = el; node; node = node.parentElement) {
            const color = getComputedStyle(node).backgroundColor;
            if (color !== 'rgba(0, 0, 0, 0)') return color;
        }
        return 'rgb(255, 255, 255)';
    });
    const ratio = contrast(foreground, background);
    assert(ratio >= minimum, `${label}: ${ratio.toFixed(2)} (${foreground} on ${background})`);
    return Number(ratio.toFixed(2));
}

(async () => {
    const browser = await chromium.launch({ channel: process.env.LEAGUE_TEST_BROWSER_CHANNEL || 'msedge' });
    const report = [];
    try {
        for (const theme of ['classic', 'navy', 'charcoal']) {
            for (const width of [1440, 375]) {
                const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 920 } });
                await context.addInitScript(value => localStorage.setItem('league-hub-appearance', value), theme);
                const page = await context.newPage();
                let upcoming = true, signedIn = false, attendanceWrites = 0, retrieved = null, historyRequests = 0;
                const generated = [], historySelections = [];
                await context.route('**/*', async route => {
                    const url = new URL(route.request().url());
                    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return route.continue();
                    if (await serveAsset(route)) return;
                    if (url.origin !== origin || !url.pathname.startsWith('/api/')) return route.abort();
                    const endpoint = url.pathname.toLowerCase();
                    let body = [];
                    if (endpoint.includes('/playerattendance/')) {
                        if (route.request().method() !== 'GET') { attendanceWrites++; signedIn = true; }
                        body = { visible: true, isOwnProfile: true, canSignIn: !signedIn, signedIn, canRemove: signedIn };
                    } else if (endpoint.includes('/getkingqueenteamsbyscramblenumbers/')) {
                        const selected = route.request().postDataJSON();
                        historySelections.push(selected);
                        body = { kingQueenTeams: selected.flatMap(savedTeams).reverse(), byePlayers: [] };
                    } else if (endpoint.includes('/generatescramble/')) {
                        generated.push(route.request().postDataJSON().kingQueenTeams.map(team => team.players.map(player => player.id).sort((a, b) => a - b)));
                        body = generated.at(-1).map((_, index) => ({ id: 301 + index, scrambleNumber: 18 }));
                    } else if (route.request().method() !== 'GET') {
                        return route.abort();
                    } else if (endpoint.endsWith('/isauthenticated')) body = true;
                    else if (endpoint.endsWith('/getusersrole')) body = { role: 'Admin' };
                    else if (endpoint.endsWith('/getusersplayer')) body = { playerId: player.id };
                    else if (endpoint.endsWith('/getuserleagues') || endpoint.endsWith('/getleagues')) body = [league];
                    else if (endpoint.includes('/getmanagementaccess') || endpoint.includes('/leaguemanagementaccess')) body = { role: 'Admin', canManage: true };
                    else if (endpoint.includes('/selectedleaguescrambles/')) body = scrambles;
                    else if (endpoint.includes('/teammatehistory/')) {
                        historyRequests++;
                        body = { leagueId: league.id, pairs: [{ player1Id: 7, player2Id: 10, count: 3 }] };
                    } else if (endpoint.includes('allmale')) body = players.filter(p => p.isMale);
                    else if (endpoint.includes('allfemale')) body = players.filter(p => !p.isMale);
                    else if (/getplayers|selectleague|getallplayers/.test(endpoint)) body = players;
                    else if (endpoint.includes('/getkingqueenteamsbyscramblenumber/')) {
                        retrieved = Number(endpoint.split('/').at(-1));
                        const teams = savedTeams(retrieved);
                        teams[0].kingQueenTeam.kingQueenPlayers = [{ playerId: teams[0].players[0].id, isSubScore: true }];
                        body = { kingQueenTeams: teams, byePlayers: [] };
                    } else if (endpoint.includes('/getallteamswithplayers/')) body = [{ id: 11, teamName: 'Harbor Aces', players: [player] }];
                    else if (endpoint.includes('/getleagueschedule/') && upcoming) body = [{
                        date: '2099-04-04', weekNumber: 1,
                        matches: [{ scheduleId: 1, team1Id: 11, team1Name: 'Harbor Aces', team2Id: 12, team2Name: 'Court Rockets' }]
                    }];
                    else if (endpoint.includes('/getdetailedperformancestats')) body = { scrambleTotals: [] };
                    else if (endpoint.includes('/getbyleague')) body = { playerScores: [] };
                    else if (url.searchParams.has('settingName')) body = { settingValue: url.searchParams.get('settingName') === 'standingsType' ? 'round' : '0' };
                    return route.fulfill({ json: body });
                });
                const tag = `${theme}-${width}`;
                await page.goto(origin + '/');
                const card = page.getByRole('region', { name: 'League night attendance' });
                const heading = card.getByRole('heading', { name: 'League Night Sign In' });
                const signIn = card.getByRole('button', { name: 'Sign In for Tonight' });
                await expect(page.getByText('Court Rockets', { exact: true }).first()).toBeVisible();
                await expect(signIn).toBeEnabled();
                await page.evaluate(() => document.fonts.ready);
                const headingRatio = await checkText(heading, card, tag + ' attendance heading');
                const buttonRatio = await checkText(signIn, signIn, tag + ' attendance button');
                await card.screenshot({ path: path.join(out, tag + '-attendance.png'), animations: 'disabled' });
                upcoming = false;
                await page.reload();
                await expect(page.getByText('No Upcoming Games', { exact: true })).toBeVisible();
                await expect(signIn).toBeEnabled();
                await card.screenshot({ path: path.join(out, tag + '-attendance-no-game.png'), animations: 'disabled' });
                await signIn.click();
                await expect(card.getByText('Signed In for Tonight')).toBeVisible();
                assert.equal(attendanceWrites, 1);

                await page.goto(origin + '/scrambler');
                const help = page.getByRole('button', { name: 'About team configuration' });
                await expect(help).toBeVisible();
                await page.locator('.scramble-setup').screenshot({ path: path.join(out, tag + '-team-configuration.png'), animations: 'disabled' });
                await help.focus();
                await page.keyboard.press('Enter');
                const dialog = page.getByRole('dialog', { name: 'Team Configuration' });
                await expect(dialog).toContainText('With 20 players and 5 teams');
                await dialog.screenshot({ path: path.join(out, tag + '-team-help.png'), animations: 'disabled' });
                await page.keyboard.press('Escape');
                await expect(help).toBeFocused();
                const historyTab = page.getByRole('tab', { name: 'Avoid Repeat Teammates', exact: true });
                await historyTab.click();
                const list = page.getByRole('list', { name: 'Previous scrambles' });
                const rows = list.getByRole('listitem');
                await expect(rows).toHaveCount(scrambles.length);
                const row = rows.first(), second = rows.nth(1);
                const firstCheckbox = row.getByRole('checkbox'), secondCheckbox = second.getByRole('checkbox');
                const generate = page.getByRole('button', { name: 'Generate Teams Without Repeat Teammates' });
                const viewSelected = page.getByRole('button', { name: 'View Selected Saved Teams' });
                const results = page.locator('.scrambler-results-shell');
                const selection = page.locator('.history-selection-summary');
                await expect(generate).toBeDisabled();
                await expect(viewSelected).toBeDisabled();
                await expect(results).toBeHidden();
                await expect(selection).toContainText('No specific historical teammate restrictions selected');
                await expect(firstCheckbox).not.toBeChecked();
                const dateRatio = await checkText(row.locator('.retrieve-scramble-date'), row, tag + ' date');
                await checkText(row.locator('b'), row, tag + ' number');
                await checkText(row.getByRole('button'), row, tag + ' retrieve icon', 3);
                const beforeHover = await row.evaluate(el => getComputedStyle(el).backgroundColor);
                await row.hover();
                await expect.poll(() => row.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(beforeHover);
                await row.getByRole('button').focus();
                await page.keyboard.press('Tab');
                await expect(secondCheckbox).toBeFocused();
                await expect(second).toHaveCSS('outline-width', '2px');
                await page.keyboard.press('Space');
                await expect(secondCheckbox).toBeChecked();
                await expect(firstCheckbox).not.toBeChecked();
                await expect(selection).toContainText('1 previous scramble selected');
                const selectedRatio = await checkText(second.locator('.retrieve-scramble-date'), second, tag + ' selected date');
                const measureControls = () => list.evaluate(element => {
                    return ['input:not(:checked)', 'input:checked'].map(selector => {
                        const checkbox = element.querySelector(selector);
                        const styles = getComputedStyle(checkbox);
                        return [checkbox.checked ? styles.backgroundColor : styles.borderTopColor,
                            getComputedStyle(checkbox.closest('li')).backgroundColor];
                    });
                });
                await expect.poll(async () => Math.min(...(await measureControls()).map(([control, surface]) =>
                    contrast(control, surface))), { message: tag + ' checkbox contrast' }).toBeGreaterThanOrEqual(3);
                assert(await row.evaluate(element => {
                    const boundary = element.querySelector('label').getBoundingClientRect();
                    return [...element.querySelector('.retrieve-scramble-details').children].every(label => {
                        const range = document.createRange();
                        range.selectNodeContents(label);
                        const text = range.getBoundingClientRect();
                        const row = element.getBoundingClientRect();
                        return text.left >= boundary.left - 1 && text.right <= boundary.right + 1 &&
                            text.top >= row.top && text.bottom <= row.bottom;
                    });
                }), tag + ' unclipped row text');
                const boxes = await rows.evaluateAll(nodes => nodes.slice(0, 2).map(node => node.getBoundingClientRect().toJSON()));
                assert.equal(Math.abs(boxes[0].y - boxes[1].y) < 1, width === 1440, tag + ' column layout');
                assert(boxes[0].height <= 75, tag + ' row density');
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), tag + ' horizontal overflow');
                await page.locator('.teammate-history').screenshot({ path: path.join(out, tag + '-retrieve.png'), animations: 'disabled' });
                const eye = row.getByRole('button');
                await eye.scrollIntoViewIfNeeded();
                const scrollBeforePreview = await page.evaluate(() => scrollY);
                await eye.click();
                await expect.poll(() => retrieved).toBe(scrambles[0].scrambleNumber);
                const single = page.getByRole('dialog', { name: 'Saved Scramble 12', exact: true });
                await expect(single).toContainText('Nov 18, 2026');
                await expect(single.locator('.saved-team')).toHaveCount(2);
                await expect(single.locator('.saved-team').first()).toContainText('Avery Harbor');
                await expect(single.locator('.saved-team').first()).toContainText('Sub');
                await expect(single.getByRole('button')).toHaveText('Close');
                await expect(results).toBeHidden();
                assert.equal(generated.length, 0);
                await checkText(single.locator('.saved-team li').first(), single.locator('.saved-team').first(), tag + ' preview player');
                await single.screenshot({ path: path.join(out, tag + '-preview-single.png'), animations: 'disabled' });
                await page.keyboard.press('Escape');
                await expect(single).toHaveCount(0);
                await expect(eye).toBeFocused();
                await expect.poll(() => page.evaluate(() => scrollY)).toBe(scrollBeforePreview);
                await expect(secondCheckbox).toBeChecked();
                await expect(firstCheckbox).not.toBeChecked();
                await firstCheckbox.check();
                await expect(page.getByRole('dialog')).toHaveCount(0);
                await viewSelected.click();
                const multiple = page.getByRole('dialog', { name: 'Saved Scrambles', exact: true });
                const groups = multiple.locator('details');
                await expect(groups).toHaveCount(2);
                await expect(groups.nth(0).locator('summary')).toHaveText('Scramble 12 · Nov 18, 2026');
                await expect(groups.nth(1).locator('summary')).toHaveText('Scramble 13 · Nov 18, 2026');
                await expect(groups.nth(0).locator('.saved-team').first()).toContainText('Player 8');
                await expect(groups.nth(1).locator('.saved-team').first()).toContainText('Player 9');
                await expect(multiple.getByRole('button')).toHaveText('Close');
                await multiple.screenshot({ path: path.join(out, tag + '-preview-multiple.png'), animations: 'disabled' });
                await multiple.getByRole('button', { name: 'Close' }).click();
                await expect(multiple).toHaveCount(0);
                await expect(viewSelected).toBeFocused();
                await expect(results).toBeHidden();
                await expect(selection).toContainText('2 previous scrambles selected');
                assert.equal(generated.length, 0);
                if (theme === 'navy' && width === 375) {
                    await rows.nth(2).getByRole('checkbox').check();
                    await rows.nth(3).getByRole('checkbox').check();
                    await viewSelected.click();
                    await expect(groups).toHaveCount(4);
                    await expect(groups.first()).toHaveJSProperty('open', true);
                    await expect(groups.last()).toHaveJSProperty('open', false);
                    await groups.last().locator('summary').press('Enter');
                    await expect(groups.last().locator('.saved-team').first()).toBeVisible();
                    await multiple.getByRole('button', { name: 'Close' }).click();
                    await expect(selection).toContainText('4 previous scrambles selected');
                    await expect(results).toBeHidden();
                }
                historySelections.length = 0;
                await firstCheckbox.uncheck();
                if (theme === 'classic' && width === 1440) {
                    await page.getByRole('tab', { name: 'Select Players', exact: true }).click();
                    await page.getByRole('button', { name: 'Select All', exact: true }).click();
                    await expect(page.locator('#team-configuration-hint')).toContainText('most players allowed');
                    await page.getByRole('radio', { name: 'Number of Teams' }).check();
                    await expect(page.locator('#team-configuration-hint')).toContainText('how many teams');
                    await page.getByRole('combobox', { name: 'Number of Teams' }).click();
                    await page.getByRole('option', { name: '2', exact: true }).click();
                    await page.getByRole('button', { name: /Scramble Rules/ }).click();
                    await page.getByRole('checkbox', { name: 'Prioritize fewer previous teammates' }).check();
                    await page.getByRole('checkbox', { name: /Allow minimum repeats/ }).check();
                    await historyTab.click();
                    await expect(secondCheckbox).toBeChecked();
                    await secondCheckbox.uncheck();
                    await firstCheckbox.check();
                    await page.locator('.teammate-history').screenshot({ path: path.join(out, tag + '-generate-ready.png'), animations: 'disabled' });
                    await generate.click();
                    await expect(page.getByText('New scramble generated', { exact: true })).toBeVisible().catch(async error => {
                        const diagnostics = await page.locator('.generation-report, .generation-feedback').allTextContents();
                        throw new Error(diagnostics.join(' ') || String(error));
                    });
                    await expect.poll(() => generated.length).toBe(1);
                    assert.deepEqual(historySelections[0], [12]);
                    assert.equal(historyRequests, 1);
                    assert.equal(generated[0].length, 2);
                    assert.deepEqual(generated[0].map(pair => pair.join()).sort(), ['7,9', '8,10'].sort());
                    const generatedSummary = await results.locator('.results-summary').textContent();
                    assert.match(generatedSummary, /Scramble 18/);
                    const viewGenerated = results.getByRole('button', { name: 'View Matchups' });
                    const generatedViewer = page.getByRole('dialog', { name: 'Matchups', exact: true });
                    await viewGenerated.click();
                    const generatedTeams = await generatedViewer.locator('.generated-matchups').innerText();
                    await generatedViewer.getByRole('button', { name: 'Close matchups' }).click();
                    await historyTab.click();
                    await secondCheckbox.check();
                    await eye.click();
                    await expect(single).toContainText('Player 8');
                    await single.getByRole('button', { name: 'Close' }).click();
                    await viewSelected.click();
                    await expect(multiple.locator('details')).toHaveCount(2);
                    await multiple.getByRole('button', { name: 'Close' }).click();
                    assert.equal(generated.length, 1);
                    await expect(results.locator('.results-summary')).toHaveText(generatedSummary.trim());
                    await viewGenerated.click();
                    await expect(generatedViewer.locator('.generated-matchups')).toHaveText(generatedTeams, { useInnerText: true });
                    await generatedViewer.getByRole('button', { name: 'Close matchups' }).click();
                    historySelections.pop(); // The grouped preview reads history without generating teams.
                    await historyTab.click();
                    await rows.nth(2).getByRole('checkbox').check();
                    await expect(selection).toContainText('3 previous scrambles selected');
                    const retry = page.getByRole('button', { name: 'Retry with Minimum Repeats' });
                    await expect(retry).toHaveCount(0);
                    await generate.click();
                    await expect(retry).toBeVisible();
                    assert.equal(generated.length, 1);
                    await expect(page.locator('.history-fallback')).toContainText('every valid arrangement repeats');
                    await page.locator('.teammate-history').screenshot({ path: path.join(out, tag + '-strict-impossible.png'), animations: 'disabled' });
                    await retry.click();
                    await expect.poll(() => generated.length).toBe(2);
                    assert.deepEqual(historySelections.slice(1), [[12, 13, 14], [12, 13, 14]]);
                    await historyTab.click();
                    await page.getByRole('button', { name: 'Clear Selection' }).click();
                    await expect(generate).toBeDisabled();
                    await page.getByRole('radio', { name: 'Maximum Team Size' }).check();
                    await page.getByRole('combobox', { name: 'Maximum Team Size' }).click();
                    await page.getByRole('option', { name: '2', exact: true }).click();
                    await page.getByRole('button', { name: 'Scramble Players', exact: true }).click();
                    await expect.poll(() => generated.length).toBe(3);
                    assert.equal(historySelections.length, 3);
                    assert.deepEqual(generated[2].map(team => team.length), [2, 2]);
                }
                report.push({ theme, width, headingRatio, buttonRatio, dateRatio, selectedRatio, rowHeight: boxes[0].height });
                await context.close();
            }
        }
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
        console.log('Read-only single and grouped previews, unchanged generated results, and strict and minimum-repeat generation passed. History layout and contrast passed in all three themes at desktop and mobile widths.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

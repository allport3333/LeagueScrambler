const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const out = process.env.LEAGUE_TEST_OUT;
const league = { id: 101, leagueName: 'Harbor League' };
const player = { id: 7, firstName: 'Avery', lastName: 'Harbor', isMale: true };
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
                let upcoming = true, signedIn = false, attendanceWrites = 0, retrieved = null;
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
                    } else if (route.request().method() !== 'GET') {
                        return route.abort();
                    } else if (endpoint.endsWith('/isauthenticated')) body = true;
                    else if (endpoint.endsWith('/getusersrole')) body = { role: 'Admin' };
                    else if (endpoint.endsWith('/getusersplayer')) body = { playerId: player.id };
                    else if (endpoint.endsWith('/getuserleagues') || endpoint.endsWith('/getleagues')) body = [league];
                    else if (endpoint.includes('/selectedleaguescrambles/')) body = scrambles;
                    else if (endpoint.includes('/getkingqueenteamsbyscramblenumber/')) {
                        retrieved = Number(endpoint.split('/').at(-1));
                        body = { kingQueenTeams: [{ kingQueenTeam: { id: 212 }, players: [player] }], byePlayers: [] };
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
                await page.getByRole('tab', { name: 'Retrieve Scramble', exact: true }).click();
                const list = page.getByRole('listbox', { name: 'Previous scrambles' });
                const rows = list.getByRole('option');
                await expect(rows).toHaveCount(scrambles.length);
                const row = rows.first(), second = rows.nth(1);
                await expect(row).toHaveAttribute('aria-selected', 'false');
                const dateRatio = await checkText(row.locator('.retrieve-scramble-date'), row, tag + ' date');
                await checkText(row.locator('b'), row, tag + ' number');
                await checkText(row.getByRole('button'), row, tag + ' retrieve icon', 3);
                const beforeHover = await row.evaluate(el => getComputedStyle(el).backgroundColor);
                await row.hover();
                await expect.poll(() => row.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(beforeHover);
                await row.focus();
                await page.keyboard.press('ArrowDown');
                await expect(second).toBeFocused();
                await expect(second).toHaveCSS('outline-width', '2px');
                await page.keyboard.press('Space');
                await expect(second).toHaveAttribute('aria-selected', 'true');
                await expect(row).toHaveAttribute('aria-selected', 'false');
                const selectedRatio = await checkText(second.locator('.retrieve-scramble-date'), second, tag + ' selected date');
                const measureControls = () => list.evaluate(element => {
                    const colors = selected => {
                        const item = element.querySelector(`[role=option][aria-selected="${selected}"]`);
                        const checkbox = item.querySelector('.mdc-checkbox__background');
                        const styles = getComputedStyle(checkbox);
                        return [selected ? styles.backgroundColor : styles.borderTopColor, getComputedStyle(item).backgroundColor];
                    };
                    return [colors(false), colors(true)];
                });
                await expect.poll(async () => Math.min(...(await measureControls()).map(([control, surface]) =>
                    contrast(control, surface))), { message: tag + ' checkbox contrast' }).toBeGreaterThanOrEqual(3);
                assert(await row.evaluate(element => {
                    const boundary = element.querySelector('.mdc-list-item__primary-text').getBoundingClientRect();
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
                await list.screenshot({ path: path.join(out, tag + '-retrieve.png'), animations: 'disabled' });
                await row.getByRole('button').click();
                await expect.poll(() => retrieved).toBe(scrambles[0].scrambleNumber);
                await page.getByRole('tab', { name: 'Retrieve Scramble', exact: true }).click();
                const summary = page.locator('.retrieved-scramble-summary');
                await expect(summary).toContainText(String(scrambles[0].scrambleNumber));
                await checkText(summary, summary, tag + ' retrieved summary');
                await summary.screenshot({ path: path.join(out, tag + '-retrieve-summary.png'), animations: 'disabled' });
                report.push({ theme, width, headingRatio, buttonRatio, dateRatio, selectedRatio, rowHeight: boxes[0].height });
                await context.close();
            }
        }
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
        console.log('Attendance and Retrieve Scramble checks passed in all three themes.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

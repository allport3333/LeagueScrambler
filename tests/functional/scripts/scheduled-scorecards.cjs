const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const base = 'https://localhost:5001';
const widths = [320, 375, 390, 430, 768, 1280, 1920, 2560, 3440];
const names = ['Harbor Aces', 'The West Side Saturday Volleyball Club', 'Net Results', 'Court Rockets', 'Set for Life', 'South Harbor Community Volleyball', 'Block Party', 'Sideout Crew'];
const out = path.resolve(process.env.LEAGUE_TEST_OUT);
assert(process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(out, { recursive: true });

async function check(browser, theme) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    try {
        await context.addInitScript(theme => localStorage.setItem('league-hub-appearance', theme), theme);
        const page = await context.newPage();
        const teams = names.map((teamName, i) => ({ id: i + 10, teamName, leagueID: 101, division: i < 4 ? 'Gold' : 'Silver' }));
        const matches = Array.from({ length: 8 }, (_, i) => ({
            scheduleId: i + 100, team1Id: teams[i % teams.length].id, team2Id: teams[(i + 1) % teams.length].id, division: teams[i % teams.length].division
        }));
        const date = new Date();
        const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');
        const writes = [], saved = [], native = [], errors = [];
        let rejectNext = false, scheduled = false;
        page.on('dialog', async d => { native.push(d.type()); await d.dismiss(); });
        page.on('pageerror', e => errors.push(e.message));
        await context.route('**/*', async route => {
            if (await serveAsset(route)) return;
            const req = route.request(), url = new URL(req.url()), p = url.pathname.toLowerCase();
            if (url.origin !== base || !p.startsWith('/api/')) return route.abort();
            let body = [], status = 200;
            if (req.method() === 'POST' && p === '/api/statistics/recordmatchupscores') {
                const data = req.postDataJSON();
                writes.push(data);
                if (rejectNext) { rejectNext = false; status = 500; }
                else for (const game of data.games) saved.push(
                    { teamId: data.team1Id, opponentsTeamId: data.team2Id, score: game.team1Score },
                    { teamId: data.team2Id, opponentsTeamId: data.team1Id, score: game.team2Score }
                );
            } else if (req.method() !== 'GET') return route.abort();
            else if (p === '/api/login/isauthenticated') body = true;
            else if (p === '/api/login/getusersrole') body = { role: 'Admin' };
            else if (p === '/api/login/getusersplayer') body = { playerId: null };
            else if (p === '/api/login/getuserleagues') body = [{ id: 101, leagueName: 'Fixture League' }, { id: 102, leagueName: 'Second League' }];
            else if (decodeURIComponent(p).endsWith('/getteams/fixture league')) body = teams;
            else if (p.endsWith('/getleagueschedule/101') && scheduled) body = [{ weekNumber: 1, date: day + 'T00:00:00', matches }];
            else if (p.endsWith('/getmatchupscores/101')) body = url.searchParams.get('date') === day ? saved : [];
            return route.fulfill({ status, json: body });
        });
        await page.goto(base + '/team-scores');
        const cards = page.locator('.matchup-card');
        const add = page.getByRole('button', { name: 'Add Manual Matchup' });
        async function verifyLayout(label) {
            for (const width of widths) {
                await page.setViewportSize({ width, height: 950 });
                const layout = await cards.evaluateAll(nodes => {
                    const container = nodes[0].parentElement.getBoundingClientRect();
                    const center = rect => (rect.left + rect.right) / 2;
                    const rows = new Map();
                    for (const node of nodes) {
                        const bounds = node.getBoundingClientRect();
                        const row = Math.round(bounds.top);
                        rows.set(row, [...(rows.get(row) || []), bounds]);
                    }
                    return {
                        columns: rows.values().next().value.length,
                        centered: [...rows.values()].every(row =>
                            Math.abs((row[0].left + row.at(-1).right) / 2 - center(container)) < 2),
                        actionCentered: Math.abs(center(container) - center(document.querySelector('.add-manual-matchup').getBoundingClientRect())) < 2,
                        helpFits: document.querySelector('.matchup-help').scrollWidth <= document.querySelector('.matchup-help').clientWidth + 1,
                        width: Math.max(...nodes.map(node => node.getBoundingClientRect().width)),
                        overflow: document.documentElement.scrollWidth > innerWidth,
                        aligned: nodes.every(node => [...node.querySelectorAll('.team-names strong, .team-pair mat-form-field')].every((name, i) => {
                            const field = node.querySelectorAll('.game-row mat-form-field')[i];
                            return field && Math.abs(center(name.getBoundingClientRect()) - center(field.getBoundingClientRect())) < 2 &&
                                name.scrollWidth <= name.clientWidth + 1;
                        }))
                    };
                });
                assert(!layout.overflow && layout.centered && layout.aligned && layout.actionCentered && layout.helpFits && layout.width <= 601, JSON.stringify({ width, label, layout }));
                if (width <= 430) assert.equal(layout.columns, 1);
                if (width >= 1920 && label === '8-scheduled') assert(layout.columns >= 3, JSON.stringify({ width, layout }));
                if ([390, 1280, 3440].includes(width)) {
                    await page.screenshot({ path: path.join(out, theme + '-' + label + '-' + width + '.png'), fullPage: true });
                }
            }
        }
        for (let count = 1; count <= 4; count++) {
            await expect(cards).toHaveCount(count);
            await verifyLayout(count + '-manual');
            if (count < 4) await add.click();
        }
        scheduled = true;
        await page.getByRole('button', { name: 'Reload date' }).click();
        await expect(cards).toHaveCount(8);
        await verifyLayout('8-scheduled');
        await page.setViewportSize({ width: 390, height: 850 });
        const first = cards.nth(0), second = cards.nth(1);
        const fields = card => card.getByRole('spinbutton');
        for (const card of [first, second]) {
            for (let i = 0; i < 6; i++) await fields(card).nth(i).fill(String(i + 10));
        }
        await first.getByRole('combobox', { name: 'Number of games' }).click();
        await page.getByRole('option', { name: '2', exact: true }).click();
        const dialog = page.getByRole('alertdialog');
        await expect(dialog).toContainText('unsaved scores');
        await page.screenshot({ path: path.join(out, theme + '-remove-games.png') });
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(fields(first)).toHaveCount(6);
        await expect(fields(first).last()).toHaveValue('15');
        rejectNext = true;
        const save = card => card.getByRole('button', { name: 'Save matchup scores' });
        await save(first).click();
        await expect(first.getByRole('alert')).toContainText('Scores were not confirmed');
        await save(first).evaluate(el => { el.click(); el.click(); });
        await expect(first.getByRole('region', { name: 'Saved Matchup Results' })).toBeVisible();
        await expect(fields(second).last()).toHaveValue('15');
        await save(second).click();
        await expect(second.getByRole('region', { name: 'Saved Matchup Results' })).toBeVisible();
        assert.deepEqual(writes.map(w => w.scheduleId), [100, 100, 101]);
        assert.deepEqual(native, []);
        assert.deepEqual(errors, []);
        console.log(theme + ' passed layout, unsaved-score cancellation, save rejection, duplicate click, and two fixture saves');
    } finally {
        await context.close();
    }
}

(async () => {
    const browser = await chromium.launch({ channel: process.env.LEAGUE_TEST_BROWSER_CHANNEL || undefined });
    try {
        for (const theme of ['classic', 'navy', 'charcoal']) await check(browser, theme);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

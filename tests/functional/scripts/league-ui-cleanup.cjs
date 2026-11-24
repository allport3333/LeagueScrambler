const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const out = process.env.LEAGUE_TEST_OUT;
const sample = process.env.LEAGUE_TEAM_SAMPLE;
assert(out && process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(out, { recursive: true });
const leagues = [
    { id: 133, leagueName: 'Two Divisions' },
    { id: 134, leagueName: 'Single Division' },
    { id: 135, leagueName: 'Other Divisions' }
];
const players = [
    { id: 1, firstName: 'Alex', lastName: 'Harbor', isMale: true },
    { id: 2, firstName: 'Bailey', lastName: 'Court', isMale: false }
];
const roster = players.map(player => ({ id: player.id, fullName: player.firstName + ' ' + player.lastName, isMale: player.isMale }));
function team(id, division) {
    return { id, division, teamName: 'Fixture Team ' + id, totalWins: 4, totalLosses: 2, players: roster };
}
const twoDivisions = sample ? JSON.parse(fs.readFileSync(sample, 'utf8').replace(/^\uFEFF/, '')) :
    Array.from({ length: 16 }, (_, i) => team(i+1, i < 8 ? 'Gold' : 'Silver'));
const teams = {
    133: twoDivisions,
    134: [team(21, 'Gold'), team(22, 'Gold')],
    135: [team(31, 'Gold'), team(32, 'Bronze'), team(33, 'Platinum'), team(34, null), team(35, '  ')]
};
const historical = { id: 301, scrambleNumber: 12, dateOfTeam: '2026-11-18T12:00:00' };
const saved = { kingQueenTeams: [{
    kingQueenTeam: { ...historical, leagueID: 133, kingQueenPlayers: [], kingQueenRoundScores: [{ id: 401, kingQueenTeamId: 301, roundId: 1, roundScore: 21, roundWon: true }] },
    players
}], byePlayers: [] };

async function checkContrast(selector, minimum = 4.5, color = 'color') {
    const ratio = await selector.evaluate((el, color) => {
        function luminance(rgb) {
            const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(x => Number(x) / 255);
            return channels.reduce((s, c, i) => s + [.2126, .7152, .0722][i] * (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4), 0);
        }
        const foreground = luminance(getComputedStyle(el).getPropertyValue(color));
        let background = 1;
        for (let node = el; node; node = node.parentElement) {
            const candidate = getComputedStyle(node).backgroundColor;
            if (candidate !== 'rgba(0, 0, 0, 0)') { background = luminance(candidate); break; }
        }
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    }, color);
    assert(ratio >= minimum, String(selector) + ' contrast ' + ratio.toFixed(2));
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge' });
    try {
      for (const theme of ['classic', 'navy', 'charcoal']) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 950 } });
        await context.addInitScript(theme => localStorage.setItem('league-hub-appearance', theme), theme);
        const page = await context.newPage();
        let attemptedWrites = 0;
        let savedSelectionRequests = 0;
        let role = 'Admin';
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname) && route.request().method() === 'GET') return route.continue();
            if (await serveAsset(route)) return;
            if (url.origin !== origin || !url.pathname.startsWith('/api/')) return route.abort();
            if (route.request().method() !== 'GET') { attemptedWrites++; return route.abort(); }
            const endpoint = url.pathname.toLowerCase();
            let data = [];
            if (endpoint.endsWith('/isauthenticated')) data = true;
            else if (endpoint.endsWith('/getusersrole')) data = { role };
            else if (endpoint.endsWith('/getusersplayer')) data = { playerId: 1 };
            else if (endpoint.endsWith('/getuserleagues') || endpoint.endsWith('/getleagues')) data = leagues;
            else if (/managementaccess/.test(endpoint)) data = { role, canManage: role === 'Admin' };
            else if (endpoint.includes('/selectleague/')) data = players;
            else if (endpoint.includes('/getscramblenumbers')) data = [12, 13];
            else if (endpoint.includes('/getteamsbyscramblenumber')) { savedSelectionRequests++; data = []; }
            else if (endpoint.includes('/selectedleaguescrambles/')) data = [historical];
            else if (endpoint.includes('/getkingqueenteamsbyscramblenumber/')) data = saved;
            else if (endpoint.includes('/getallteamswithplayers/')) data = teams[Number(endpoint.split('/').at(-1))];
            else if (endpoint.includes('/getbyleague/')) data = { maxRounds: 1, playerScores: [] };
            else if (endpoint.includes('/playerattendance/')) data = { visible: true, isOwnProfile: true, canSignIn: false };
            else if (url.searchParams.has('settingName')) data = { settingValue: url.searchParams.get('settingName') === 'standingsType' ? 'round' : '0' };
            return route.fulfill({ json: data });
        });
        await page.goto(origin + '/');
        const fullSchedule = page.getByRole('link', { name: 'View Full Schedule', exact: true });
        await expect(fullSchedule).toBeVisible();
        await fullSchedule.click();
        await expect(page.getByRole('tab', { name: 'Schedule', exact: true })).toHaveAttribute('aria-selected','true');
        await expect(page.getByRole('heading', { name: 'League Schedule' })).toBeVisible();
        await page.goto(origin + '/schedule');
        await expect(page.locator('app-schedule')).toBeVisible();

        const division = name => page.getByRole('region', { name, exact: true });
        const cards = scope => scope.locator('.league-team-card');
        await page.goto(origin + '/league-dashboard?tab=teams&leagueId=133');
        await expect(page.getByRole('tab', { name: 'League Teams', exact:true })).toHaveAttribute('aria-selected','true');
        const gold = division('Gold Division'), silver = division('Silver Division');
        await expect(cards(gold)).toHaveCount(twoDivisions.filter(t => t.division === 'Gold').length);
        await expect(cards(silver)).toHaveCount(twoDivisions.filter(t => t.division === 'Silver').length);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('.league-team-card')).toHaveCount(twoDivisions.length);
        for (const [index, card] of (await page.locator('.league-team-card').all()).entries()) {
            const t = twoDivisions[index];
            await expect(card).toContainText(t.teamName);
            await expect(card).toContainText('Wins: '+t.totalWins+' | Losses: '+t.totalLosses);
            await expect(card.locator('.team-player-list li')).toHaveText(t.players.map(player => player.fullName));
        }
        for (const width of [390, 1440, 3440]) {
            await page.setViewportSize({ width, height: 950 });
            const grid = gold.locator('.league-team-grid');
            const items = await cards(gold).evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()));
            const columns = items.filter(n => Math.abs(n.y - items[0].y)<1).length;
            assert(width===390 ? columns===1 : columns>=5);
            const s = await silver.boundingBox(), g = await grid.boundingBox();
            assert(s.y >= g.y+g.height, 'Silver has a separate row after the entire Gold grid');
            await checkContrast(gold.getByRole('heading'));
            await checkContrast(cards(gold).first().locator('mat-card-title'));
            const badge = page.locator('.team-player-list li').first();
            if (await badge.count()) await checkContrast(badge);
            await page.locator('.league-team-divisions').screenshot({ path: path.join(out, theme+'-divisions-'+width+'.png'), animations:'disabled' });
            assert(await grid.evaluate(e=>e.scrollWidth<=e.clientWidth));
        }
        await page.goto(origin + '/league-dashboard?tab=teams&leagueId=134');
        await expect(page.locator('.league-team-division')).toHaveCount(1);
        await expect(cards(division('Gold Division'))).toHaveCount(2);
        await page.goto(origin + '/league-dashboard?tab=teams&leagueId=135');
        for (const group of ['Gold Division','Bronze Division','Platinum Division','Unassigned Teams']) await expect(division(group)).toBeVisible();
        await expect(cards(division('Unassigned Teams'))).toHaveCount(2);
        await expect(page.locator('.league-team-card')).toHaveCount(5);
        await page.goto(origin + '/team-scores?tab=teams');
        await expect(page.getByRole('tab', { name: 'Enter Team Scores' })).toHaveAttribute('aria-selected','true');
        await expect(page.locator('.scores-workspace').getByRole('tab')).toHaveCount(2);
        await page.getByRole('tab', { name: 'Team Management' }).click();
        await expect(page.locator('app-team-management')).toBeVisible();

        await page.setViewportSize({ width: 1440, height: 950 });
        await page.goto(origin + '/scrambler');
        const tabs = page.locator('app-scrambler-component').getByRole('tab');
        for (const name of ['Select Players','Avoid Repeat Teammates','Manage Scores','Create Teams and Scores']) await expect(tabs.filter({hasText:name})).toBeVisible();
        const scrambleTab = name => page.locator('app-scrambler-component').getByRole('tab',{name,exact:true});
        await checkContrast(page.locator('.roster-player .desktop-player-name').first());
        await scrambleTab('Avoid Repeat Teammates').click();
        await checkContrast(page.locator('.retrieve-scramble-date').first());
        await page.getByRole('button',{name:'View saved teams for scramble 12'}).click();
        const preview = page.getByRole('dialog',{name:'Saved Scramble 12',exact:true});
        await checkContrast(preview.locator('.saved-team li').first());
        await preview.getByRole('button',{name:'Close',exact:true}).click();
        await scrambleTab('Manage Scores').click();
        const score = page.locator('.desktop-score-editor').getByRole('spinbutton').first();
        await expect(score).toBeVisible();
        await checkContrast(score);
        await scrambleTab('Create Teams and Scores').click();
        const manual = page.locator('app-create-teams');
        const rounds = manual.getByRole('combobox',{name:'Number of Rounds'});
        const scramble = manual.getByRole('combobox',{name:'Scramble Number'});
        await expect(rounds).toContainText('5');
        await expect(scramble).toContainText('New Scramble');
        await page.evaluate(() => document.fonts.ready);
        for (const field of [rounds,scramble]) {
            await checkContrast(field.locator('.mat-mdc-select-value-text'));
            await checkContrast(field.locator('.mat-mdc-select-arrow svg'),3,'fill');
        }
        for (const label of await manual.locator('.manual-team-controls mat-label').all()) await checkContrast(label);
        await rounds.click();
        const panel = page.locator('.manual-team-select-panel');
        await expect(panel.getByRole('option')).toHaveCount(10);
        await checkContrast(panel.getByRole('option',{name:'3',exact:true}));
        await panel.screenshot({ path: path.join(out,theme+'-round-options.png'),animations:'disabled' });
        await panel.getByRole('option',{name:'3',exact:true}).click();
        const male = manual.getByRole('button',{name:'Alex Harbor',exact:true});
        const female = manual.getByRole('button',{name:'Bailey Court',exact:true});
        await checkContrast(male);await checkContrast(female);
        await male.press('Space');
        await expect(male).toHaveAttribute('aria-pressed','true');
        await checkContrast(male);
        await expect(manual.getByRole('spinbutton')).toHaveCount(3);
        const won = manual.getByRole('checkbox').first();
        await checkContrast(won, 3, 'border-top-color');
        await won.check();
        await expect(won).toBeChecked();
        await female.click();
        await expect(female).toHaveAttribute('aria-pressed','true');
        await checkContrast(manual.locator('.manual-team-player').last());
        await manual.screenshot({ path:path.join(out,theme+'-create-teams-desktop.png'),animations:'disabled' });
        await page.setViewportSize({width:390,height:850});
        await manual.screenshot({path:path.join(out,theme+'-create-teams-mobile.png'),animations:'disabled'});
        assert(await manual.evaluate(e=>e.scrollWidth<=e.getBoundingClientRect().width+1));
        await male.press('Space');
        await expect(male).toHaveAttribute('aria-pressed','false');
        await scramble.click();
        await checkContrast(panel.getByRole('option',{name:'Scramble 12',exact:true}));
        await panel.getByRole('option',{name:'Scramble 12',exact:true}).click();
        await expect(scramble).toHaveText('Scramble 12');
        await expect.poll(()=>savedSelectionRequests).toBe(1);
        role = 'Player';
        await page.goto(origin + '/team-scores');
        await expect(page.getByRole('tab',{name:'Enter Team Scores'})).toHaveCount(0);
        await page.getByRole('link',{name:'View League Teams',exact:true}).click();
        await expect(page.getByRole('tab',{name:'League Teams',exact:true})).toHaveAttribute('aria-selected','true');
        assert.equal(attemptedWrites,0);
        assert.deepEqual(errors,[]);
        await context.close();
      }
      console.log('Home schedule links, two score tabs, every division card, four Scrambler tabs, and manual controls passed in all themes.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

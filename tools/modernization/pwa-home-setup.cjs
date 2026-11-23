// Serve verified releases on a disposable loopback origin. APIs use synthetic fixtures only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, expect } = require('../../tests/functional/node_modules/@playwright/test');

const artifacts = path.resolve(__dirname, '../../tests/functional/artifacts');
const [mode, firstPath, secondPath, outputPath] = process.argv.slice(2);
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1600, 1920, 2560, 3440];
const league = { id: 101, leagueName: 'Harbor League' };
const teams = [
    { id: 11, teamName: 'Harbor Aces', division: 'Silver', players: [{ id: 1 }] },
    { id: 12, teamName: 'Wall and Order', players: [{ id: 2 }] },
    { id: 13, teamName: 'J.E.T.S.', players: [] },
    { id: 14, teamName: 'Slam Chowder with a Very Long Team Name', players: [] }
];
const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
let score = 15;
let saves = 0;
const edits = [];
const date = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

function checkedPath(value) {
    const resolved = path.resolve(value);
    assert(resolved.startsWith(artifacts + path.sep));
    return resolved;
}

function readRelease(value) {
    const directory = checkedPath(value);
    const bytes = fs.readFileSync(path.join(directory, 'ngsw.json'));
    const configuration = JSON.parse(bytes);
    assert.deepEqual(configuration.dataGroups, []);
    assert(!Object.keys(configuration.hashTable).some(file => file.startsWith('/api/')));
    for (const [file, hash] of Object.entries(configuration.hashTable)) {
        const contents = fs.readFileSync(path.join(directory, file.slice(1)));
        assert.equal(crypto.createHash('sha1').update(contents).digest('hex'), hash, file);
    }
    for (const file of ['index.html', 'manifest.webmanifest', 'ngsw-worker.js']) assert(fs.existsSync(path.join(directory, file)));
    const webmanifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.webmanifest')));
    assert.equal(webmanifest.start_url, '/');
    assert.equal(webmanifest.scope, '/');
    assert.equal(webmanifest.display, 'standalone');
    return { directory, hash: crypto.createHash('sha1').update(bytes).digest('hex') };
}

async function api(req, res, url) {
    const endpoint = url.pathname.toLowerCase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    let body = [];
    if (endpoint.endsWith('/isauthenticated')) body = true;
    if (endpoint.endsWith('/getusersrole')) body = { role: 'Admin' };
    if (endpoint.endsWith('/getusersplayer')) body = { playerId: 1 };
    if (endpoint.endsWith('/getuserinfo')) body = { firstName: 'Fixture' };
    if (endpoint.endsWith('/getleagues') || endpoint.endsWith('/getuserleagues')) {
        body = edits.some(edit => edit.endpoint.includes('/addnewleague/')) ? [league, { id: 103, leagueName: 'New Fixture League' }] : [league];
    }
    if (endpoint.includes('/getteams/') || endpoint.includes('/getallteamswithplayers/')) body = teams;
    if (endpoint.includes('/getleagueschedule/')) {
        body = teams.slice(1).map((opponent, index) => ({
            weekNumber: index + 8, date: date((index + 1) * 7) + 'T00:00:00', matches: [
                { scheduleId: index + 1, team1Id: 11, team1Name: teams[0].teamName, team2Id: opponent.id, team2Name: opponent.teamName, division: 'Silver' }
            ]
        }));
    }
    if (endpoint.includes('/league-standings/')) body = [{ teamId: 11, teamName: teams[0].teamName, wins: 2, losses: 1, totalPoints: 36, division: 'Silver' }];
    if (endpoint.includes('/league-team-scores/')) {
        body = [score, 6, 15].map((teamScore, index) => ({
            date: date(-index - 1) + 'T12:00:00', opponentTeam: teams[index + 1].teamName,
            format: '4 × 4 Play', teamScore, wonGame: index !== 1
        }));
    }
    if (endpoint.includes('/getmatchupscores/') && saves) body = [
        { teamId: 11, opponentsTeamId: 12, teamScore: 21, wonGame: true },
        { teamId: 12, opponentsTeamId: 11, teamScore: 16, wonGame: false }
    ];
    if (endpoint.includes('/getdetailedperformancestats')) body = { individualRounds: [], scrambleTotals: [] };
    if (endpoint.includes('/getsettingvalue')) {
        const setting = url.searchParams.get('settingName');
        body = { settingValue: setting === 'standingsType' ? 'round' : setting === 'dayOfLeague' ? 'Monday' : '0' };
    }
    if (endpoint.includes('/playerattendance/')) body = { visible: false, canSignIn: false };
    if (endpoint.includes('/getbyleague') && !endpoint.includes('leaguedivision')) body = { maxRounds: 1, playerScores: [] };
    if (req.method !== 'GET') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const payload = JSON.parse(Buffer.concat(chunks).toString() || 'null');
        if (endpoint.endsWith('/recordmatchupscores')) {
            assert.equal(payload.leagueId, league.id);
            saves++;
            body = {};
        } else if (endpoint.endsWith('/leaguemanager/101') || endpoint.endsWith('/leaguedivision/add')) {
            edits.push({ endpoint, payload });
            body = { id: 5 };
            if (payload.email === 'unknown@example.invalid') res.statusCode = 404;
        } else if (endpoint.includes('/addnewleague/')) {
            edits.push({ endpoint, payload });
            body = { id: 103, leagueName: 'New Fixture League' };
        } else res.statusCode = 405;
    }
    res.end(JSON.stringify(body));
}

function startHost(initial, fallback) {
    let active = initial;
    let reachable = true;
    const server = http.createServer(async (req, res) => {
        try {
            if (!reachable) return req.socket.destroy();
            const url = new URL(req.url, 'http://127.0.0.1');
            if (url.pathname.startsWith('/api/')) return await api(req, res, url);
            const name = path.posix.extname(url.pathname) ? decodeURIComponent(url.pathname.slice(1)) : 'index.html';
            const target = path.resolve(active.directory, name);
            if (!target.startsWith(active.directory + path.sep)) return res.writeHead(404).end();
            const hashNamed = /-[A-Z0-9]{8}\.(js|css)$/.test(name);
            const retained = fallback && hashNamed && path.join(fallback.directory, name);
            const file = fs.existsSync(target) ? target : retained;
            if (!file || !fs.existsSync(file)) return res.writeHead(404).end();
            res.writeHead(200, {
                'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
                'Cache-Control': hashNamed ? 'public, max-age=31536000, immutable' : 'no-cache'
            });
            const bytes = name === 'ngsw.json' && active.manifestOverride
                ? Buffer.from(active.manifestOverride) : fs.readFileSync(file);
            res.end(active.corruptIndex && name === 'index.html' ? Buffer.concat([bytes, Buffer.from('<!-- incomplete release -->')]) : bytes);
        } catch (error) {
            console.error(error.message);
            res.writeHead(500).end();
        }
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
        base: 'http://127.0.0.1:' + server.address().port,
        switchTo: release => { active = release; },
        setReachable: online => { reachable = online; },
        close: () => new Promise(done => server.close(done))
    })));
}

async function visual(browser, release, out, before) {
    const host = await startHost(release);
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(host.base + '/');
        const scores = page.locator('.recent-scores-table');
        const upcoming = page.locator('.home-upcoming');
        await expect(scores.locator('tbody tr')).toHaveCount(3);
        await expect(upcoming.locator('li')).toHaveCount(3);
        for (const width of widths) {
            await page.setViewportSize({ width, height: 1000 });
            if (!before) {
                await expect(scores.getByRole('columnheader')).toHaveText(['Date', 'Format', 'Score', 'Result']);
                assert(await upcoming.evaluate(section => {
                    const entries = [...section.querySelectorAll('li a')];
                    const rectangles = entries.map(entry => [...entry.children].map(child => child.getBoundingClientRect()));
                    return rectangles.every(([day, team, week, division]) =>
                        Math.abs(day.top - team.top) < 1 && Math.abs(week.top - division.top) < 1 &&
                        team.left === rectangles[0][1].left && day.right < team.left);
                }), 'Schedule grid alignment at ' + width);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            }
            await page.screenshot({ path: path.join(out, `home-${width}.png`), fullPage: true, animations: 'disabled' });
        }
        if (!before) {
            await upcoming.getByRole('link').nth(1).click();
            await expect(page).toHaveURL(/league-dashboard\?.*tab=schedule.*weekNumber=9/);
            await page.goBack();
            await page.getByRole('link', { name: 'View Game History' }).click();
            await expect(page).toHaveURL(/player-stats-tabs\/1\?.*tab=team/);
            await page.goBack();
            await page.getByRole('link', { name: 'View League Standings' }).click();
            await expect(page).toHaveURL(/league-dashboard\?leagueId=101/);
        }

        await page.goto(host.base + '/league-management');
        await page.getByRole('tab', { name: 'League Setup' }).click();
        const grant = page.getByRole('button', { name: 'Grant Access' });
        await expect(grant).toBeVisible();
        const create = page.getByRole('button', { name: 'Add New League' });
        const division = page.getByRole('button', { name: 'Add Division', exact: true });
        if (before) await expect(create).toBeDisabled();
        else await expect(create).toHaveCount(0);
        await expect(division).toBeDisabled();
        await expect(grant).toBeDisabled();
        for (const width of widths) {
            await page.setViewportSize({ width, height: 1000 });
            await page.getByRole('tab', { name: 'League Setup' }).evaluate(tab => tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
            if (!before) {
                const boxes = await page.locator('.setup-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().toJSON()));
                assert.equal(boxes.length, 2);
                if (width >= 1024) {
                    assert.equal(boxes[0].top, boxes[1].top);
                    assert(boxes[0].right < boxes[1].left);
                } else assert(boxes[0].bottom < boxes[1].top);
                assert(await page.locator('.setup-actions button').evaluateAll(buttons =>
                    buttons.length === 2 && buttons[0].getBoundingClientRect().top === buttons[1].getBoundingClientRect().top));
                assert(await page.locator('.setup-card label').evaluateAll(labels =>
                    labels.every(label => label.scrollWidth <= label.clientWidth + 1)), 'Clipped setup label at ' + width);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            }
            await page.screenshot({ path: path.join(out, `setup-${width}.png`), fullPage: true, animations: 'disabled' });
        }
        if (!before) {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.getByRole('tab', { name: 'Create League' }).click();
            await expect(create).toBeDisabled();
            await page.getByRole('textbox', { name: 'New League Name' }).fill('New Fixture League');
            await expect(create).toBeEnabled();
            await page.getByRole('tab', { name: 'League Setup' }).click();
            await page.getByRole('textbox', { name: 'Division Abbreviation', exact: true }).fill('S1');
            await page.keyboard.press('Tab');
            await expect(page.getByRole('textbox', { name: 'Division Name', exact: true })).toBeFocused();
            await page.getByRole('textbox', { name: 'Division Name', exact: true }).fill('New Division');
            await expect(division).toBeEnabled();
            await division.click();
            await expect(division).toBeDisabled();
            const email = page.getByRole('textbox', { name: 'Manager email' });
            await email.fill('manager@example.invalid');
            await grant.click();
            await expect(page.getByText('League access granted.', { exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Revoke Access' }).click();
            await expect(page.getByText('League access revoked.', { exact: true })).toBeVisible();
            await email.fill('unknown@example.invalid');
            await grant.click();
            await expect(page.getByText('No matching manager account or league was found.', { exact: true })).toBeVisible();
            await page.getByRole('tab', { name: 'Create League' }).click();
            await create.click();
            await expect(page.getByText('League created.', { exact: true })).toBeVisible();
            await expect(page.getByRole('tab', { name: 'League Setup' })).toHaveAttribute('aria-selected', 'true');
            await expect(page.locator('#leagueDropdown')).toContainText('New Fixture League');
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(out, 'visual-results.json'), JSON.stringify({ widths, before, edits, errors }, null, 2));
    } finally {
        await context.close();
        await host.close();
    }
}

async function updates(browser, first, second, out) {
    assert.notEqual(first.hash, second.hash);
    const host = await startHost(first, first);
    const contexts = [];
    try {
        for (const [width, outcome] of [[1280, 'save'], [390, 'discard']]) {
            host.switchTo(first);
            saves = 0;
            const context = await browser.newContext({ viewport: { width, height: 900 } });
            contexts.push(context);
            await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
            const home = await context.newPage();
            const homeUrl = host.base + '/?fixture=resume#top';
            await home.goto(homeUrl);
            await home.waitForFunction(() => !!navigator.serviceWorker.controller);
            await expect(home.locator('.recent-scores-table .score-value').first()).toHaveText(String(score));
            await home.evaluate(() => { window.resumeFixture = true; });
            host.setReachable(false);
            await context.setOffline(true);
            assert(await home.evaluate(() => fetch('/api/Statistics/league-team-scores/1/101').then(response => !response.ok, () => true)));
            score++;
            host.setReachable(true);
            await context.setOffline(false);
            await home.bringToFront();
            await expect(home.locator('.recent-scores-table .score-value').first()).toHaveText(String(score), { timeout: 15000 });
            assert.equal(await home.evaluate(() => window.resumeFixture), true);
            const editor = await context.newPage();
            const editorUrl = host.base + '/team-scores?fixture=draft';
            await editor.goto(editorUrl);
            await editor.waitForFunction(() => !!navigator.serviceWorker.controller);
            const card = editor.locator('.matchup-card').first();
            const enterTeam = async (label, name) => {
                await card.getByRole('combobox', { name: label, exact: true }).click();
                await editor.getByRole('option', { name, exact: true }).click();
            };
            await enterTeam('Team 1', teams[0].teamName);
            await enterTeam('Team 2', teams[1].teamName);
            await card.getByRole('combobox', { name: 'Number of games' }).click();
            await editor.getByRole('option', { name: '1', exact: true }).click();
            await card.getByRole('spinbutton').first().fill('21');
            await card.getByRole('spinbutton').nth(1).fill('16');

            host.setReachable(false);
            await context.setOffline(true);
            host.switchTo(second);
            host.setReachable(true);
            await context.setOffline(false);
            await editor.bringToFront();
            await expect(editor.getByText('An update is ready.', { exact: false })).toBeVisible({ timeout: 25000 });
            await expect(card.getByRole('spinbutton').first()).toHaveValue('21');
            assert.equal(await editor.locator('meta[name="release-fixture"]').count(), 0);
            await editor.screenshot({ path: path.join(out, `pending-${width}.png`), animations: 'disabled' });
            await home.bringToFront();
            await expect(home.locator('meta[name="release-fixture"]')).toHaveAttribute('content', 'version-b', { timeout: 25000 });
            assert.equal(home.url(), homeUrl);
            await editor.bringToFront();
            await expect(card.getByRole('spinbutton').first()).toHaveValue('21');
            if (outcome === 'save') await card.getByRole('button', { name: 'Save matchup scores' }).click();
            else {
                await editor.getByRole('button', { name: 'Dismiss', exact: true }).click();
                editor.once('dialog', dialog => dialog.accept());
                await editor.getByRole('button', { name: 'Reload date' }).click();
            }
            await expect(editor.locator('meta[name="release-fixture"]')).toHaveAttribute('content', 'version-b', { timeout: 25000 });
            assert.equal(editor.url(), editorUrl);
            assert.equal(saves, outcome === 'save' ? 1 : 0);
            const cached = await editor.evaluate(async () => {
                const keys = await caches.keys();
                return (await Promise.all(keys.map(async name => (await (await caches.open(name)).keys()).map(item => item.url)))).flat();
            });
            assert(!cached.some(url => new URL(url).pathname.startsWith('/api/')));
            await context.close();
        }
        fs.writeFileSync(path.join(out, 'update-results.json'), JSON.stringify({
            first: first.hash, second: second.hash, widths: [1280, 390], networkOnly: true, routePreserved: true, saved: true, discarded: true
        }, null, 2));
    } finally {
        await Promise.all(contexts.map(context => context.close()));
        await host.close();
    }
}

async function legacyUpgrade(browser, legacy, current, out) {
    const host = await startHost(legacy, legacy);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
        await context.route('**/*', route => new URL(route.request().url()).origin === host.base ? route.continue() : route.abort());
        const installed = await context.newPage();
        await installed.goto(host.base + '/');
        await installed.waitForFunction(() => !!navigator.serviceWorker.controller);
        assert.equal(await installed.evaluate(async () => (await navigator.serviceWorker.ready).scope), host.base + '/');
        assert.equal(await installed.locator('meta[name="release-fixture"]').count(), 0);
        await installed.close();
        host.switchTo(current);
        let launches = 0;
        await expect.poll(async () => {
            launches++;
            const resumed = await context.newPage();
            try {
                await resumed.goto(host.base + '/?fixture=legacy-upgrade');
                await resumed.locator('app-root').waitFor({ state: 'attached' });
                return await resumed.locator('meta[name="release-fixture"]').getAttribute('content', { timeout: 1000 }).catch(() => null);
            } finally {
                await resumed.close();
            }
        }, { timeout: 40000, intervals: [1000, 2000, 4000] }).toBe('version-b');
        fs.writeFileSync(path.join(out, 'legacy-results.json'), JSON.stringify({ launches, scope: '/', cacheCleared: false }, null, 2));
    } finally {
        await context.close();
        await host.close();
    }
}

async function installationFailure(browser, first, second, out) {
    const host = await startHost(first, first);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
        const page = await context.newPage();
        await page.goto(host.base + '/install-locally');
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);
        const rejected = page.waitForEvent('console', {
            predicate: message => message.text().includes('League Hub update verification failed'),
            timeout: 25000
        });
        await context.setOffline(true);
        host.switchTo({ ...second, corruptIndex: true });
        await context.setOffline(false);
        await rejected;
        await expect(page.getByRole('heading', { name: "Install Allport's League Hub" })).toBeVisible();
        assert.equal(await page.locator('meta[name="release-fixture"]').count(), 0);
        await context.setOffline(true);
        host.switchTo(second);
        await context.setOffline(false);
        await expect(page.locator('meta[name="release-fixture"]')).toHaveAttribute('content', 'version-b', { timeout: 25000 });
        const previousManifest = JSON.parse(fs.readFileSync(path.join(first.directory, 'ngsw.json')));
        const rollback = { ...first, manifestOverride: JSON.stringify({
            ...previousManifest,
            appData: { ...previousManifest.appData, release: 'verified-rollback-fixture' }
        }) };
        await context.setOffline(true);
        host.switchTo(rollback);
        await context.setOffline(false);
        await expect(page.locator('meta[name="release-fixture"]')).toHaveCount(0, { timeout: 25000 });
        await expect(page.getByRole('heading', { name: "Install Allport's League Hub" })).toBeVisible();
        fs.writeFileSync(path.join(out, 'failure-results.json'), JSON.stringify({
            invalidReleaseRejected: true, completeReleaseApplied: true, rollbackAppliedWithNewManifestIdentity: true
        }, null, 2));
    } finally {
        await context.close();
        await host.close();
    }
}

(async () => {
    const first = readRelease(firstPath);
    const second = readRelease(secondPath);
    const out = checkedPath(outputPath);
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ channel: process.env.LEAGUE_BROWSER_CHANNEL || 'msedge' });
    try {
        if (mode === 'updates') await updates(browser, first, second, out);
        else if (mode === 'legacy') await legacyUpgrade(browser, first, second, out);
        else if (mode === 'failure') await installationFailure(browser, first, second, out);
        else if (mode === 'visual') {
            for (const [release, before] of [[first, true], [second, false]]) {
                const folder = path.join(out, before ? 'before' : 'after');
                fs.mkdirSync(folder, { recursive: true });
                await visual(browser, release, folder, before);
            }
        } else throw Error('Use updates or visual mode.');
        console.log(mode + ' passed.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

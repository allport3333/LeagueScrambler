const { chromium, expect, request: apiRequest } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { withPickupTestHost } = require('../helpers/pickup-test-host.cjs');

let persistedLeague;
withPickupTestHost(async (origin, restartHost) => {
    const browser = await chromium.launch({ channel: 'msedge' });
    try {
        const admin = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
        const visitor = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
        const headers = { Origin: origin };
        const post = (context, path, data) => context.request.post(origin + path, { headers, data });
        const token = randomUUID().slice(0, 8);
        const email = token + '@example.invalid';
        await expect(await post(admin, '/api/login/register', {
            email, password: randomUUID() + 'Aa1!', firstName: 'Attendance', lastName: token
        })).toBeOK();
        execFileSync('sqlcmd.exe', ['-S', 'lpc:localhost', '-d', 'LeagueScramblerPickupTest', '-E', '-C', '-b', '-Q',
            "IF DB_NAME() <> 'LeagueScramblerPickupTest' THROW 51000,'Wrong database',1; UPDATE dbo.[User] SET UserRoleId=1 WHERE Email=N'" + email + "';"]);
        const createLeague = async name => {
            const response = await post(admin, '/api/ScrambleData/AddNewLeague/' + name, []);
            await expect(response).toBeOK();
            return (await response.json()).id;
        };
        const name = 'Attendance-' + token;
        const leagueId = await createLeague(name);
        const otherId = await createLeague(name + '-other');
        const read = async id => (await visitor.request.get(origin + '/api/Login/LeagueAttendanceAvailability/' + id)).json();
        const other = await read(otherId);
        const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(new Date());
        await expect(await post(admin, '/api/login/updatesetting', {
            leagueId, settingName: 'dayOfLeague', settingValue: today === 'Sunday' ? 'Monday' : 'Sunday'
        })).toBeOK();
        const player = await post(admin, '/api/ScrambleData/AddPlayer/' + name, {
            firstName: 'Fixture', lastName: token, isMale: true, gender: 'Male'
        });
        await expect(player).toBeOK();
        const signIn = () => post(visitor, '/api/ScrambleData/SignInPlayer', { leagueId, playerId: playerId });
        const playerId = (await player.json()).id;
        expect((await signIn()).status()).toBe(423);
        expect((await post(visitor, '/api/Login/SetLockSignInStatus', { leagueId, mode: 'open' })).status()).toBe(401);

        const page = await admin.newPage();
        await page.addInitScript(id => sessionStorage.setItem('league-hub-selected-league', id), String(leagueId));
        await page.goto(origin + '/sign-in');
        const controls = page.getByRole('region', { name: 'Sign-in availability' });
        await expect(controls).toContainText('Using Automatic Schedule');
        for (const theme of ['classic', 'soft-light', 'navy', 'charcoal']) {
            await page.evaluate(id => localStorage.setItem('league-hub-appearance', id), theme);
            await page.reload();
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            await controls.getByRole('button', { name: 'Unlock Sign In' }).click();
            await expect(controls).toContainText('Manually Opened');
            expect(await read(leagueId)).toMatchObject({ mode: 'open', locked: false });
            if (theme === 'classic') await expect(await signIn()).toBeOK();
            await page.reload();
            await expect(controls).toContainText('Manually Opened');
            await controls.getByRole('button', { name: 'Lock Sign In', exact: true }).click();
            await expect(controls).toContainText('Manually Locked');
            expect((await signIn()).status()).toBe(423);
            await controls.getByRole('button', { name: 'Return to Automatic Schedule' }).click();
            await expect(controls).toContainText('Using Automatic Schedule');
        }
        expect(await read(otherId)).toEqual(other);
        const { attendanceDate } = await read(leagueId);
        const rows = await (await visitor.request.get(origin + '/api/ScrambleData/GetSignedInPlayers', {
            params: { leagueId, date: attendanceDate }
        })).json();
        expect(rows.map(row => row.playerId)).toEqual([playerId]);
        const nextPlayer = await post(admin, '/api/ScrambleData/AddPlayer/' + name, {
            firstName: 'Player', lastName: 'With Long Last Name', isMale: false, gender: 'Female'
        });
        await expect(nextPlayer).toBeOK();
        await page.setViewportSize({ width: 1920, height: 1000 });
        const sheet = await page.locator('.sign-in-sheet').boundingBox();
        expect(sheet.width).toBeLessThan(1200);
        expect(Math.abs(sheet.x * 2 + sheet.width - 1920)).toBeLessThan(3);
        await page.getByRole('link', { name: 'Open Player Sign In Mode' }).click();
        await expect(page).toHaveURL(/\/sign-in\/player/);
        await expect(page.locator('app-nav-menu')).toBeHidden();
        await expect(page.locator('.legal-footer')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Add New Player' })).toHaveCount(0);
        const tile = page.getByRole('button', { name: 'Player With Long Last Name', exact: true });
        await expect(tile).toBeDisabled();
        await expect(await post(admin, '/api/Login/SetLockSignInStatus', { leagueId, mode: 'open' })).toBeOK();
        await expect(tile).toBeEnabled({ timeout: 15000 });
        const search = page.getByRole('searchbox', { name: 'Find your name' });
        await search.fill('long name');
        await expect(page.locator('.roster-tile')).toHaveCount(1);
        await page.getByRole('button', { name: 'Clear', exact: true }).click();
        await expect(page.locator('.roster-tile')).toHaveCount(1);
        await search.fill('long name');
        const writePath = '**/api/ScrambleData/SignInPlayer';
        const failWrite = route => route.fulfill({ status: 500 });
        await page.route(writePath, failWrite);
        await tile.click();
        await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
        await expect(tile).toBeEnabled();
        await page.unroute(writePath, failWrite);
        await tile.click();
        await expect(page.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible();
        await expect(page.getByRole('list', { name: 'Signed-in names' })).toContainText('Player With Long Last Name');
        await expect(tile).toHaveCount(0);
        await expect(search).toHaveValue('long name');
        await expect(page.locator('.signed-in-panel')).toContainText('Male 1');
        await expect(page.locator('.signed-in-panel')).toContainText('Female 1');
        const remove = page.getByRole('button', { name: 'Remove Player With Long Last Name from sign-in' });
        const removePath = '**/api/ScrambleData/SignInPlayer/*';
        await page.route(removePath, failWrite);
        await remove.click();
        await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
        await expect(tile).toHaveCount(0);
        await expect(remove).toBeVisible();
        await page.unroute(removePath, failWrite);
        await remove.click();
        await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
        await expect(tile).toBeEnabled();
        await expect(search).toHaveValue('long name');
        await expect(page.getByRole('heading', { name: 'Signed-In Players 1' })).toBeVisible();
        await expect(page.locator('.signed-in-panel')).toContainText('Female 0');

        const secondId = (await nextPlayer.json()).id;
        const dashboard = await admin.newPage();
        await dashboard.addInitScript(id => sessionStorage.setItem('league-hub-selected-league', id), String(leagueId));
        await dashboard.goto(origin + '/sign-in');
        await expect(dashboard.getByText('Live', { exact: true })).toBeVisible();
        await expect(page.getByText('Live', { exact: true })).toBeVisible();
        await dashboard.getByRole('searchbox', { name: 'Search signed-in players' }).fill('long');
        const external = await post(visitor, '/api/ScrambleData/SignInPlayer', { leagueId, playerId: secondId });
        await expect(external).toBeOK();
        const externalRecord = await external.json();
        await expect(tile).toHaveCount(0);
        await expect(dashboard.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible();
        await expect(await admin.request.delete(origin + '/api/ScrambleData/SignInPlayer/' + externalRecord.playerSignInId, { headers })).toBeOK();
        await expect(tile).toBeEnabled({ timeout: 15000 });
        await expect(dashboard.getByRole('heading', { name: 'Signed-In Players 1' })).toBeVisible();
        await expect(dashboard.getByRole('searchbox', { name: 'Search signed-in players' })).toHaveValue('long');
        await page.bringToFront();
        const fullscreen = page.getByRole('button', { name: 'Fullscreen', exact: true });
        if (await fullscreen.isVisible()) {
            await fullscreen.click();
            await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
        }
        await page.getByRole('button', { name: 'Exit Sign In Mode' }).click();
        await expect(page.locator('.sign-in-sheet')).toBeVisible();
        expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);

        const kiosk = await visitor.newPage();
        let size = 20;
        const sampleNames = [['Alan', 'Camargo'], ['April','Schoenemann'], ['Uwe','Schoenemann'],
            ['WW Test','Participant'], ['Alexandra Winifred','Schoenemann Camargo Montgomery Wellington']];
        await kiosk.route('**/api/ScrambleData/GetPlayers/' + leagueId, route => route.fulfill({
            json: [
                { id: playerId, firstName: 'Fixture', lastName: token, gender: 'Male' },
                ...Array.from({ length: size }, (_, index) => ({
                    id: 100000 + index, firstName: size === 5 ? sampleNames[index][0] : index ? 'Player ' + (index + 1) : 'Fixture',
                    lastName: size === 5 ? sampleNames[index][1] : index ? 'Long Family Name' : token,
                    gender: index % 2 ? 'Male' : 'Female'
                }))
            ]
        }));
        for (const [width, count, theme] of [
            [2560, 100, 'classic'], [1920, 100, 'soft-light'], [1920, 80, 'soft-light'], [1366, 60, 'navy'],
            [768, 40, 'charcoal'], [390, 20, 'soft-light'], [1920, 5, 'navy']
        ]) {
            size = count;
            await kiosk.setViewportSize({ width, height: width >= 1920 ? 1080 : 860 });
            await kiosk.goto(origin + '/sign-in/player?leagueId=' + leagueId);
            await kiosk.evaluate(value => localStorage.setItem('league-hub-appearance', value), theme);
            await kiosk.reload();
            await expect(kiosk.locator('html')).toHaveAttribute('data-theme', theme);
            await expect(kiosk.locator('.roster-tile').first()).toBeVisible();
            const pager = kiosk.getByRole('navigation', { name: 'Available player pages' });
            if (width >= 1366 || !await pager.isVisible()) await expect(kiosk.locator('.roster-tile')).toHaveCount(count);
            if (count !== 5) await expect(kiosk.getByRole('button', { name: 'Fixture ' + token, exact: true })).toHaveCount(1);
            await expect(kiosk.getByRole('heading', { name: 'Signed-In Players 1' })).toBeInViewport();
            await expect(kiosk.getByRole('button', { name: /^Remove .* from sign-in$/ })).toHaveCount(0);
            const tile = await kiosk.locator('.roster-tile').first().boundingBox();
            expect(tile.height).toBeGreaterThanOrEqual(47);
            expect(tile.height).toBeLessThanOrEqual(97);
            if (count === 5) {
                expect(tile.height).toBeGreaterThan(90);
                const alan = kiosk.getByRole('button', { name: 'Alan Camargo' });
                const alexandra = kiosk.getByRole('button', { name: /Alexandra Winifred/ });
                await expect(alan).toHaveCSS('font-size', '26px');
                expect(await alexandra.evaluate(button => parseFloat(getComputedStyle(button).fontSize))).toBeLessThan(26);
                await kiosk.setViewportSize({ width: 390, height: 650 });
                await expect.poll(() => alan.evaluate(button => parseFloat(getComputedStyle(button).fontSize))).toBeLessThan(23);
                await kiosk.setViewportSize({ width, height: 1080 });
                await expect(alan).toHaveCSS('font-size', '26px');
            }
            if (width >= 1366) await expect(pager).toHaveCount(0);
            const arena = await kiosk.locator('.roster-space').boundingBox();
            const last = await kiosk.locator('.roster-tile').last().boundingBox();
            expect(last.y + last.height).toBeLessThanOrEqual(arena.y + arena.height + 1);
            expect(await kiosk.locator('.roster-tile').evaluateAll(tiles => tiles.some(tile => tile.scrollHeight > tile.clientHeight + 1))).toBe(false);
            expect(await kiosk.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
        size = 100;
        await kiosk.setViewportSize({width: 390, height: 650});
        await kiosk.reload();
        const pagination = kiosk.getByRole('navigation', { name: 'Available player pages' });
        await expect(pagination).toBeVisible();
        const visited = [];
        for (;;) {
            visited.push(...await kiosk.locator('.roster-tile').allTextContents());
            const next = pagination.getByRole('button', { name: 'Next' });
            if (await next.isDisabled()) break;
            await next.click();
        }
        expect(visited).toHaveLength(100);
        expect(new Set(visited).size).toBe(100);
        await kiosk.getByRole('searchbox', {name:'Find your name'}).fill('player 99');
        await expect(kiosk.locator('.roster-tile')).toHaveCount(1);
        await expect(pagination).toHaveCount(0);
        await kiosk.close();
        console.log('Centered sheet, fullscreen and exit, live unlock, search, kiosk attendance and 5-100-player layouts passed.');
        const bulk = '/api/LeagueAttendance/' + leagueId + '/bulk';
        const preview = async () => (await admin.request.get(origin + bulk)).json();
        const snapshot = await preview();
        expect(snapshot).toMatchObject({ signedIn: 1, additional: 1, records: 1 });
        expect((await visitor.request.get(origin + bulk)).status()).toBe(401);
        expect((await post(visitor, bulk, { operation: 'sign-in', version: snapshot.version })).status()).toBe(401);
        expect((await post(admin, bulk, { operation: 'remove', version: snapshot.version, text: 'REMOVE' })).status()).toBe(400);
        await expect(page.getByText('Available Players (1)', { exact: true })).toBeVisible();
        const signedSearch = page.getByRole('searchbox', { name: 'Search signed-in players' });
        await signedSearch.fill(token);
        await expect(page.getByRole('list', { name: 'Signed-in names' })).toContainText('Fixture ' + token);
        await page.getByRole('button', { name: 'Clear', exact: true }).click();

        await page.getByRole('button', { name: 'Sign In Everyone', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('This will add 1 players');
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        expect(await preview()).toEqual(snapshot);

        await page.getByRole('button', { name: 'Sign In Everyone', exact: true }).click();
        await dialog.getByRole('button', { name: 'Confirm Sign In Everyone' }).click();
        await expect(page.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible();
        await expect(dashboard.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible();

        // Insert an earlier attendance record and a current record in another league in the disposable database.
        execFileSync('sqlcmd.exe', ['-S', 'lpc:localhost', '-d', 'LeagueScramblerPickupTest', '-E', '-C', '-b', '-Q',
            "IF DB_NAME() <> 'LeagueScramblerPickupTest' THROW 51000,'Wrong database',1; " +
            "INSERT dbo.PlayerSignIn (LeagueId, PlayerId, DateTime, LockedSignIn) VALUES " +
            "(" + leagueId + ", " + playerId + ", DATEADD(day,-3,'" + snapshot.date + "'),0)," +
            "(" + otherId + ", " + playerId + ",'" + snapshot.date + "',0);"]);
        await page.getByRole('button', { name: 'Remove All Sign Ins', exact: true }).click();
        const typed = dialog.getByRole('textbox', { name: 'Type REMOVE ALL to confirm' });
        const removeAll = dialog.getByRole('button', { name: 'Remove All 2 Sign Ins' });
        await typed.fill('remove all');
        await expect(removeAll).toBeDisabled();
        await typed.fill('REMOVE ALL');
        await expect(removeAll).toBeEnabled();
        await removeAll.click();
        await expect(page.getByRole('heading', { name: 'Signed-In Players 0' })).toBeVisible();
        await expect(dashboard.getByRole('heading', { name: 'Signed-In Players 0' })).toBeVisible();
        await expect(page.getByText('Available Players (2)', { exact: true })).toBeVisible();

        const getRows = async (id, date) => (await visitor.request.get(origin + '/api/ScrambleData/GetSignedInPlayers', {
            params: { leagueId: id, date }
        })).json();
        const earlier = new Date(snapshot.date + 'T00:00:00Z');
        earlier.setUTCDate(earlier.getUTCDate() - 3);
        expect((await getRows(leagueId, earlier.toISOString().slice(0, 10))).map(row => row.playerId)).toEqual([playerId]);
        expect((await getRows(otherId, snapshot.date)).map(row => row.playerId)).toEqual([playerId]);

        const fallback = await visitor.newPage();
        await fallback.route('**/api/league-attendance-live/**', route => route.abort());
        await fallback.goto(origin + '/sign-in/player?leagueId=' + leagueId);
        await expect(fallback.getByText('Refreshing Automatically', { exact: true })).toBeVisible();
        await expect(fallback.getByRole('heading', { name: 'Signed-In Players 0' })).toBeVisible();
        const empty = await preview();
        const confirm = { operation: 'sign-in', version: empty.version };
        const concurrent = await Promise.all([post(admin, bulk, confirm), post(admin, bulk, confirm)]);
        expect(concurrent.map(response => response.status()).sort()).toEqual([200, 409]);
        expect((await getRows(leagueId, snapshot.date)).map(row => row.playerId).sort()).toEqual([playerId, secondId].sort());
        await expect(fallback.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible({timeout: 20000});
        await fallback.unroute('**/api/league-attendance-live/**');
        await expect(fallback.getByText('Live', { exact: true })).toBeVisible({timeout: 20000});
        const recovered = fallback.waitForResponse(response =>
            response.url().includes('/api/Login/LeagueAttendanceAvailability/' + leagueId) && response.ok(),
        { timeout: 45000 });
        await restartHost();
        await recovered;
        await expect(fallback.getByText('Live', { exact: true })).toBeVisible({timeout: 20000});
        await expect(fallback.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible();
        const longPoll = await visitor.newPage();
        await longPoll.route('**/api/league-attendance-live/negotiate?*', async route => {
            const response = await route.fetch();
            const json = await response.json();
            json.availableTransports = json.availableTransports.filter(t => t.transport === 'LongPolling');
            await route.fulfill({ response, json });
        });
        let otherRefreshes = 0;
        longPoll.on('response', response => {
            if (response.url().includes('/api/Login/LeagueAttendanceAvailability/' + otherId) && response.ok()) otherRefreshes++;
        });
        await longPoll.goto(origin + '/sign-in/player?leagueId=' + otherId);
        await expect(longPoll.getByText('Live', { exact: true })).toBeVisible();
        await expect(longPoll.getByRole('heading', { name: 'Signed-In Players 1' })).toBeVisible();
        // Establish the initial snapshot and the post-subscription reconciliation first.
        await expect.poll(() => otherRefreshes).toBeGreaterThanOrEqual(2);
        const baseline = otherRefreshes;
        const filled = await preview();
        await expect(await post(admin, bulk, { operation: 'remove', version: filled.version, text: 'REMOVE ALL' })).toBeOK();
        await expect(fallback.getByRole('heading', { name: 'Signed-In Players 0' })).toBeVisible();
        expect(otherRefreshes).toBe(baseline);
        await longPoll.close();
        await fallback.close();
        await dashboard.close();
        console.log('Live dashboards, automatic fallback, restored connectivity, Long Polling and league isolation passed.');
        const density = await admin.newPage();
        await density.addInitScript(id => sessionStorage.setItem('league-hub-selected-league', id), String(leagueId));
        let attendanceCount = 5;
        await density.route('**/api/ScrambleData/GetSignedInPlayers?*', route => route.fulfill({
            json: Array.from({ length: attendanceCount }, (_, i) => ({
                playerSignInId: i + 1, playerId: i + 100000, leagueId,
                firstName: 'Player ' + (i + 1), lastName: 'Long Family Name', gender: 'Female'
            }))
        }));
        for (const [width, count, theme, columns] of [
            [390, 5, 'classic', 1], [600, 20, 'soft-light', 2], [768, 40, 'navy', 2],
            [1366, 60, 'charcoal', 4], [1920, 80, 'classic', 4], [2560, 100, 'soft-light', 4]
        ]) {
            attendanceCount = count;
            await density.setViewportSize({ width, height: 860 });
            await density.goto(origin + '/sign-in');
            await density.evaluate(value => localStorage.setItem('league-hub-appearance', value), theme);
            await density.reload();
            await expect(density.locator('html')).toHaveAttribute('data-theme', theme);
            const grid = density.getByRole('list', { name: 'Signed-in names' });
            await expect(grid.locator('li')).toHaveCount(count);
            expect(await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(columns);
            expect(await density.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
        await density.close();
        console.log('Bulk preview, cancellation, confirmation, permission, concurrent requests and scope passed. Admin layouts passed with 5-100 signed in.');
        await expect(await post(admin, '/api/Login/SetLockSignInStatus', { leagueId, mode: 'locked' })).toBeOK();
        const lockedPreview = await preview();
        expect(lockedPreview.lockedReason).toBeTruthy();
        expect((await post(admin, bulk, { operation: 'sign-in', version: lockedPreview.version })).status()).toBe(423);
        persistedLeague = leagueId;
        console.log('Four themes, off-day attendance, lock enforcement, authorization, refresh, and league isolation passed.');
    } finally {
        await browser.close();
    }
}).then(() => withPickupTestHost(async origin => {
    const request = await apiRequest.newContext({ ignoreHTTPSErrors: true });
    try {
        const response = await request.get(origin + '/api/Login/LeagueAttendanceAvailability/' + persistedLeague);
        await expect(response).toBeOK();
        expect(await response.json()).toMatchObject({ mode: 'locked', locked: true });
        console.log('Manual override survived a backend restart.');
    } finally {
        await request.dispose();
    }
})).catch(error => { console.error(error); process.exitCode = 1; });

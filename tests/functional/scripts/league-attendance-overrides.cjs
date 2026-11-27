const { chromium, expect, request: apiRequest } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { withPickupTestHost } = require('../helpers/pickup-test-host.cjs');

let persistedLeague;
withPickupTestHost(async origin => {
    const browser = await chromium.launch({ channel: 'msedge' });
    try {
        const admin = await browser.newContext({ ignoreHTTPSErrors: true });
        const visitor = await browser.newContext({ ignoreHTTPSErrors: true });
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
        await expect(page.locator('.roster-tile')).toHaveCount(2);
        await tile.click();
        await expect(page.getByRole('heading', { name: 'Signed-In Players 2' })).toBeVisible();
        await expect(page.getByRole('list', { name: 'Signed-in names' })).toContainText('Player With Long Last Name');
        await expect(page.getByRole('button', { name: /Player With Long Last Name.*Signed in/ })).toBeDisabled();
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
        await kiosk.route('**/api/ScrambleData/GetPlayers/' + leagueId, route => route.fulfill({
            json: Array.from({ length: size }, (_, index) => ({
                id: 100000 + index, firstName: 'Player ' + (index + 1), lastName: 'Long Family Name',
                gender: index % 2 ? 'Male' : 'Female'
            }))
        }));
        for (const [width, count, theme] of [
            [2560, 100, 'classic'], [1920, 80, 'soft-light'], [1366, 60, 'navy'],
            [768, 40, 'charcoal'], [390, 20, 'soft-light']
        ]) {
            size = count;
            await kiosk.setViewportSize({ width, height: 860 });
            await kiosk.goto(origin + '/sign-in/player?leagueId=' + leagueId);
            await kiosk.evaluate(value => localStorage.setItem('league-hub-appearance', value), theme);
            await kiosk.reload();
            await expect(kiosk.locator('html')).toHaveAttribute('data-theme', theme);
            await expect(kiosk.locator('.roster-tile')).toHaveCount(count);
            await expect(kiosk.getByRole('heading', { name: 'Signed-In Players 2' })).toBeInViewport();
            expect(await kiosk.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
        console.log('Centered sheet, fullscreen and exit, live unlock, search, kiosk attendance and 20-100-player layouts passed.');
        await expect(await post(admin, '/api/Login/SetLockSignInStatus', { leagueId, mode: 'locked' })).toBeOK();
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

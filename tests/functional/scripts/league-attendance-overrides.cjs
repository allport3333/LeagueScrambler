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

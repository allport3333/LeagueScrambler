const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {readFileSync} = require('node:fs');
const {randomUUID} = require('node:crypto');
const path = require('node:path');
const {chromium, expect} = require('@playwright/test');
const {withPickupTestHost} = require('../helpers/pickup-test-host.cjs');

const host = path.resolve(__dirname, '../google-host/bin/Release/net10.0/GoogleFixtureHost.dll');
const token = randomUUID().replaceAll('-', '');
const existingEmail = 'existing-' + token + '@example.invalid';
const newEmail = 'new-' + token + '@example.invalid';
const password = 'Fixture-' + randomUUID();
const sql = query => execFileSync('sqlcmd.exe', ['-S', 'lpc:localhost', '-d', 'LeagueScramblerPickupTest',
    '-E', '-C', '-b', '-h', '-1', '-W', '-Q',
    "IF DB_NAME() <> 'LeagueScramblerPickupTest' THROW 51000,'Wrong database',1; SET NOCOUNT ON; " + query],
    {encoding: 'utf8'}).trim();

withPickupTestHost(async origin => {
    sql(readFileSync(path.resolve(__dirname, '../../../tools/security/GoogleAccount.sql'), 'utf8'));
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        async function open(theme = 'classic', width = 1366, serviceWorkers = 'block') {
            const context = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers, viewport: {width, height: 850}});
            await context.addInitScript(theme => localStorage.setItem('league-hub-appearance', theme), theme);
            const catalog = await context.request.get(origin + '/api/pickup/catalog');
            assert.equal(catalog.headers()['x-pickup-test-database'], 'LeagueScramblerPickupTest');
            return context;
        }
        const loginPath = '/api/login/login';
        for (const [theme, width] of [['classic', 1366], ['navy', 390], ['charcoal', 390]]) {
            const context = await open(theme, width);
            const page = await context.newPage();
            await page.goto(origin + '/?toggleLoginForm=true');
            await expect(page.getByRole('button', {name: 'Continue with Google'})).toBeVisible();
            await expect(page.locator('.login-form').getByText('or', {exact: true})).toBeVisible();
            assert(await page.locator('.google-provider img').evaluate(img => img.complete && img.naturalWidth > 0));
            await page.getByRole('button', {name: 'Cancel', exact: true}).click();
            await page.getByRole('button', {name: 'Register', exact: true}).click();
            await expect(page.getByRole('button', {name: 'Sign Up with Google'})).toBeVisible();
            await expect(page.locator('.registration-form').getByText('or', {exact: true})).toBeVisible();
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await context.close();
        }
        async function post(context, endpoint, data) {
            return context.request.post(origin + endpoint, {headers: {Origin: origin}, data, maxRedirects: 0});
        }
        async function provider(context, code) {
            await context.addCookies([{name: 'google-fixture-choice', value: code ? code + ':' + token : 'cancel', url: origin}]);
        }

        const owner = await open();
        assert.equal((await post(owner, '/api/login/register', {
            email: 'host-' + token + '@example.invalid', password, firstName: 'Fixture', lastName: 'Organizer'
        })).status(), 200);
        const created = await post(owner, '/api/pickup/sessions', {
            name: 'Invitation Fixture ' + token, sport: 'Wallyball', venue: 'Fixture Gym ' + token,
            city: 'Roseville', timeZone: 'America/Detroit', startNow: true, visibility: 1
        });
        assert.equal(created.status(), 201, await created.text());
        const {id} = await created.json();
        const route = '/pickup/' + id;

        const existing = await open('navy', 390);
        const signup = await post(existing, '/api/login/register', {email: existingEmail, password, firstName: 'Fixture', lastName: 'Player'});
        assert.equal(signup.status(), 200);
        const {userId} = await signup.json();
        const profile = await post(existing, '/api/scrambledata/CreateAndClaimPlayer', {firstName: 'Fixture', lastName: token, gender: 'Male'});
        assert.equal(profile.status(), 200);
        const {playerId} = await (await existing.request.get(origin + '/api/login/getusersplayer')).json();
        assert(playerId > 0);
        assert.equal((await post(existing, '/api/login/logout', {})).status(), 200);

        const guest = await open();
        const malicious = await guest.request.post(origin + '/api/auth/google/start', {
            headers: {Origin: origin}, form: {returnTo: '//example.invalid/pickup/' + id}, maxRedirects: 0
        });
        assert.equal(malicious.status(), 400);
        const forged = await guest.request.get(origin + '/signin-google?state=invalid&code=test', {maxRedirects: 0});
        assert.equal(forged.status(), 302);
        assert.equal(await (await guest.request.get(origin + '/api/login/isauthenticated')).json(), false);
        await post(guest, '/api/pickup/sessions/' + id + '/guest', {email: existingEmail, name: 'Fixture Player'});
        assert.equal(sql("SELECT COUNT(*) FROM dbo.PickupRegistration WHERE SessionId='" + id + "'"), '0');

        const page = await existing.newPage();
        await page.goto(origin + route);
        await expect(page.getByRole('button', {name: 'Continue with Google'})).toBeVisible();
        await expect(page.getByRole('button', {name: 'Join as Guest'})).toBeVisible();
        await provider(existing, null);
        await page.getByRole('button', {name: 'Continue with Google'}).click();
        await expect(page).toHaveURL(origin + route + '?google=cancelled');
        await provider(existing, 'existing');
        await page.getByRole('button', {name: 'Continue with Google'}).click();
        await expect(page).toHaveURL(origin + '/?returnTo=' + encodeURIComponent(route) + '&google=existing-account');
        await expect(page.getByRole('heading', {name: 'Connect Google to Your Existing Account'})).toBeVisible();
        await expect(page.getByRole('button', {name: 'Continue with Google'})).toHaveCount(0);
        assert.equal(await (await existing.request.get(origin + '/api/login/isauthenticated')).json(), false);

        await expect(page.getByRole('link', {name: 'Back to the Pickup Game'})).toHaveAttribute('href', route);
        await page.locator('#loginEmail').fill(existingEmail);
        await page.locator('#loginPassword').fill(password);
        await page.getByRole('button', {name: 'Sign In', exact: true}).click();
        await expect(page.getByRole('heading', {name: 'Connected Accounts', exact: true})).toBeVisible();
        await page.getByRole('button', {name: 'Connect Google'}).click();
        await expect(page.getByText('Google is connected to your League Hub account.')).toBeVisible();
        assert.equal(sql("SELECT UserId FROM dbo.GoogleAccount WHERE Subject=N'existing-" + token + "'"), String(userId));
        await page.getByRole('link', {name: 'Back to the Pickup Game'}).click();
        await expect(page).toHaveURL(origin + route);
        assert.equal(sql("SELECT COUNT(*) FROM dbo.PickupRegistration WHERE SessionId='" + id + "'"), '0');
        await page.getByRole('button', {name: 'Join Game', exact: true}).click();
        await expect(page.getByText('Your registration: Confirmed')).toBeVisible();
        await page.reload();
        await expect(page.getByRole('button', {name: 'Join Game', exact: true})).toHaveCount(0);
        assert.equal(sql("SELECT PlayerId FROM dbo.PickupRegistration WHERE SessionId='" + id + "' AND AccountId=" + userId), String(playerId));

        await post(existing, '/api/login/logout', {});
        await page.goto(origin + route);
        await page.getByRole('button', {name: 'Continue with Google'}).click();
        await expect(page).toHaveURL(origin + route);
        await expect(page.getByText('Your registration: Confirmed')).toBeVisible();
        const linkedPlayer = await (await existing.request.get(origin + '/api/login/getusersplayer')).json();
        assert.equal(linkedPlayer.playerId, playerId);

        const newcomer = await open('charcoal', 768, 'allow');
        const newcomerPage = await newcomer.newPage();
        await provider(newcomer, 'new');
        await newcomerPage.goto(origin + route);
        await newcomerPage.evaluate(async () => {
            await navigator.serviceWorker.register('/ngsw-worker.js');
            await navigator.serviceWorker.ready;
        });
        await newcomerPage.reload();
        await newcomerPage.waitForFunction(() => navigator.serviceWorker.controller !== null);
        const callback = newcomerPage.waitForResponse(response =>
            new URL(response.url()).pathname === '/signin-google' && response.status() === 302);
        await newcomerPage.getByRole('button', {name: 'Continue with Google'}).click();
        assert.match((await callback).headers()['cache-control'] ?? '', /no-store/);
        await expect(newcomerPage).toHaveURL(origin + route);
        await expect(newcomerPage.getByRole('button', {name: 'Join Game', exact: true})).toBeVisible();
        const newId = Number(sql("SELECT UserId FROM dbo.[User] WHERE Email=N'" + newEmail + "' AND PasswordHash IS NULL"));
        assert(newId > 0);
        assert.equal(sql('SELECT COUNT(*) FROM dbo.UsersPlayer WHERE UserId=' + newId), '0');
        assert.equal((await post(newcomer, '/api/auth/google/disconnect', {})).status(), 409);
        await post(newcomer, '/api/login/logout', {});
        await provider(newcomer, 'new-changed');
        await newcomerPage.goto(origin + route);
        await newcomerPage.getByRole('button', {name: 'Continue with Google'}).click();
        await expect(newcomerPage.getByRole('button', {name: 'Join Game', exact: true})).toBeVisible();
        assert.equal(sql("SELECT UserId FROM dbo.GoogleAccount WHERE Subject=N'new-" + token + "'"), String(newId));
        assert.equal(sql("SELECT COUNT(*) FROM dbo.[User] WHERE Email=N'changed-" + token + "@example.invalid'"), '0');

        assert.equal((await post(existing, '/api/auth/google/disconnect', {})).status(), 204);
        assert.equal(sql('SELECT COUNT(*) FROM dbo.GoogleAccount WHERE UserId=' + userId), '0');
        await post(existing, '/api/login/logout', {});
        assert.equal((await post(existing, loginPath, {email: existingEmail, password})).status(), 200);
        await post(owner, '/api/pickup/sessions/' + id + '/cancel', {});
        console.log('Google fixture sign-in, linking, cancel, guards, account preservation, Pickup return, and password login passed.');
    } finally {
        await browser.close();
    }
}, host).catch(error => { console.error(error); process.exitCode = 1; });

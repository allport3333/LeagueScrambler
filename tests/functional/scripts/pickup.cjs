const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium, expect, request} = require('@playwright/test');
const {withPickupTestHost} = require('../helpers/pickup-test-host.cjs');

const token = crypto.randomBytes(5).toString('hex');
const inbox = path.join(process.env.LOCALAPPDATA, 'LeagueHub', 'PickupTest', 'mail');
const run = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const values = {name: 'Pickup fixture ' + token, sport: 'Wallyball', venue: 'Fixture Recreation Center',
    address: '1 Fixture Way', city: 'Fixtureville', region: 'MI', postalCode: '48001', country: 'US',
    timeZone: 'America/New_York', start: run + 'T18:00', end: run + 'T20:00', capacity: 16, visibility: 0,
    skill: 'All levels', approvalRequired: false};

async function api(page, endpoint, method = 'GET', body) {
    return page.evaluate(async ({endpoint, method, body}) => {
        const response = await fetch(endpoint, {method, headers: body ? {'Content-Type': 'application/json'} : {},
            body: body ? JSON.stringify(body) : undefined});
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        return {status: response.status, data};
    }, {endpoint, method, body});
}

withPickupTestHost(async origin => {
    const browser = await chromium.launch({channel: 'chrome'});
    const errors = [];
    try {
        async function open(width, authenticated) {
            const ctx = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: {width, height: 900}});
            const page = await ctx.newPage();
            page.on('pageerror', error => errors.push(error.message));
            const catalog = await ctx.request.get(origin + '/api/pickup/catalog');
            assert.equal(catalog.headers()['x-pickup-test-database'], 'LeagueScramblerPickupTest', 'Refusing to write fixtures outside the disposable database.');
            await page.goto(origin + '/pickup');
            await expect(page.getByRole('heading', {name: 'Pickup Games'})).toBeVisible();
            if (authenticated) {
                const result = await api(page, '/api/login/register', 'POST', {
                    email: authenticated + '-' + token + '@example.invalid', password: crypto.randomBytes(20).toString('hex'),
                    firstName: authenticated, lastName: 'Fixture'
                });
                assert.equal(result.status, 200, JSON.stringify(result));
                await page.reload();
            }
            return page;
        }

        const organizer = await open(1440, 'Organizer');

        const seed = await api(organizer, '/api/pickup/sessions', 'POST', {...values, visibility: 1});
        assert.equal(seed.status, 201, JSON.stringify(seed));
        assert.equal((await api(organizer, '/api/pickup/sessions/' + seed.data.id + '/cancel', 'POST', {})).status, 204);
        await organizer.getByRole('link', {name: 'Create Pickup Game'}).click();
        await organizer.getByRole('button', {name: /Fixture Recreation Center/}).first().click();
        await expect(organizer.getByLabel('Maximum players')).toBeHidden();
        await expect(organizer.getByLabel('Duration', {exact: true})).toBeHidden();
        const date = await organizer.getByLabel('Date', {exact: true}).inputValue();
        await organizer.getByRole('button', {name: 'Create Pickup Game'}).click();
        await expect(organizer.getByRole('heading', {name: 'Wallyball Pickup'})).toBeVisible();
        await expect(organizer.getByText('Open Registration', {exact: true})).toBeVisible();
        const sessionUrl = organizer.url();
        const id = sessionUrl.split('/').at(-1);
        const endpoint = '/api/pickup/sessions/' + id;
        const details = (await api(organizer, endpoint)).data;
        assert.equal(details.capacity, null);
        assert.equal(Date.parse(details.endsUtc) - Date.parse(details.startsUtc), 120 * 60000);
        assert.equal(Date.parse(details.deadlineUtc), Date.parse(details.endsUtc));

        const mobile = await open(390, 'MobileOrganizer');
        await mobile.getByRole('link', {name: 'Create Pickup Game'}).click();
        await mobile.getByRole('button', {name: 'Add New Facility'}).click();
        await mobile.getByLabel('Facility name').fill('Mobile Facility ' + token);
        await mobile.getByLabel('City or ZIP code').fill('Fixtureville');
        await mobile.getByLabel('Start Now').check();
        assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await mobile.getByRole('button', {name: 'Create Pickup Game'}).click();
        await expect(mobile.getByText('Open Registration', {exact: true})).toBeVisible();
        const immediate = '/api/pickup/sessions/' + mobile.url().split('/').at(-1);
        const timing = (await api(mobile, immediate)).data;
        assert.equal(Date.parse(timing.deadlineUtc), Date.parse(timing.endsUtc));
        assert.equal((await api(mobile, immediate + '/cancel', 'POST', {})).status, 204);
        await mobile.locator('#leagueDropdown').click();
        await mobile.getByRole('dialog', {name: 'Select league or event'}).getByRole('link', {name: 'Create Pickup Game'}).click();
        await mobile.getByRole('button', {name: new RegExp('Mobile Facility ' + token)}).click();
        await mobile.getByText('Advanced Options', {exact: true}).click();
        await mobile.getByLabel('Custom session name').fill('Advanced ' + token);
        await mobile.getByLabel('Limit number of players').check();
        await mobile.getByLabel('Maximum players').fill('6');
        await mobile.getByLabel('Description').fill('Advanced settings fixture');
        await mobile.getByLabel('Require organizer approval').check();
        await mobile.getByRole('button', {name: 'Create Pickup Game'}).click();
        await expect(mobile.getByRole('heading', {name: 'Advanced ' + token})).toBeVisible();
        const advancedEndpoint = '/api/pickup/sessions/' + mobile.url().split('/').at(-1);
        const advanced = (await api(mobile, advancedEndpoint)).data;
        assert.equal(advanced.capacity, 6);
        assert.equal(advanced.approvalRequired, true);
        assert.equal(advanced.description, 'Advanced settings fixture');
        const visitor = await open(390);
        await visitor.getByRole('link', {name: 'Find Pickup Games', exact: true}).click();
        await visitor.getByLabel('Where do you want to play?').fill(values.postalCode);
        await visitor.getByText('More Filters', {exact: true}).click();
        await visitor.locator('select[name=sport]').selectOption('Wallyball');
        await visitor.getByLabel('Date', {exact: true}).fill(date);
        await visitor.getByLabel('Available spots only').check();
        await visitor.getByRole('button', {name: 'Find Games'}).click();
        await visitor.getByRole('link', {name: 'View Details for Wallyball Pickup'}).and(visitor.locator('a[href="/pickup/' + id + '"]')).click();
        await expect(visitor).toHaveURL(origin + '/pickup/' + id);
        await expect(visitor.getByRole('heading', {name: 'Wallyball Pickup', exact: true})).toBeVisible();
        await expect(visitor.getByText('Open Registration', {exact: true})).toBeVisible();
        const before = new Set(await fs.readdir(inbox));
        const guestEmail = 'guest-' + token + '@example.invalid';
        await visitor.getByRole('button', {name: 'Join Session'}).click();
        await visitor.getByLabel('Name', {exact: true}).fill('Guest ' + token);
        await visitor.getByLabel('Email address', {exact: true}).fill(guestEmail);
        await visitor.getByRole('button', {name: 'Join Session'}).click();
        await expect(visitor.getByRole('status')).toContainText('Check your email');
        await organizer.reload();
        await expect(organizer.getByRole('heading', {name: 'Pending Verification'})).toBeVisible();
        await expect(organizer.locator('.verification-list')).toContainText('Guest ' + token);
        await expect(organizer.locator('.player-line').filter({hasText: 'Guest ' + token})).toHaveCount(0);
        const raw = (await Promise.all((await fs.readdir(inbox)).filter(file => !before.has(file)).map(file =>
            fs.readFile(path.join(inbox, file), 'utf8')))).find(message => message.includes(guestEmail));
        assert(raw, 'Local mail delivery missing');
        const mail = raw.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
        const link = mail.match(/https:\/\/localhost:5003\/pickup\/[\w-]+#verify=[A-F\d]{64}/)?.[0];
        assert(link, 'Expected a local verification URL');
        await visitor.goto(link);
        await expect(visitor.getByText('Your registration: Confirmed')).toBeVisible();
        assert.equal(visitor.url(), sessionUrl);
        assert(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const replay = await api(visitor, endpoint + '/verify', 'POST', {token: link.split('=').at(-1)});
        assert.equal(replay.status, 400);
        const outsider = await open(375);
        assert.equal((await api(outsider, endpoint + '/leave', 'POST', {})).status, 404);
        const publicDetail = await api(outsider, endpoint);
        assert.equal(publicDetail.data.registrations, null);
        assert.equal(publicDetail.data.confirmed, 1);
        await organizer.reload();
        await expect(organizer.locator('.player-line').filter({hasText: 'Guest ' + token}).getByText('Playing', {exact: true})).toBeVisible();
        await visitor.getByRole('button', {name: 'Cancel Registration'}).click();
        await expect(visitor.getByText('Your registration: Cancelled')).toBeVisible();
        await expect(visitor.getByText('Open Registration', {exact: true})).toBeVisible();

        const player = await open(1280, 'Player');
        const second = await open(1280, 'Second');
        const claim = await api(player, '/api/scrambledata/CreateAndClaimPlayer', 'POST', {
            firstName: 'Player', lastName: 'Fixture', gender: 'Male'
        });
        assert.equal(claim.status, 200, JSON.stringify(claim));
        await player.goto(sessionUrl);
        await player.getByRole('button', {name: 'Join Session'}).click();
        await expect(player.getByText('Your registration: Confirmed')).toBeVisible();
        assert.equal((await api(player, endpoint + '/join', 'POST', {})).status, 200);
        assert.equal((await api(organizer, endpoint)).data.confirmed, 1);
        assert.equal((await api(player, endpoint, 'PUT', values)).status, 404);
        assert.equal((await api(player, endpoint + '/cancel', 'POST', {})).status, 404);

        async function create(host, input) {
            const result = await api(host, '/api/pickup/sessions', 'POST', {...values, ...input});
            assert.equal(result.status, 201, JSON.stringify(result));
            return '/api/pickup/sessions/' + result.data.id;
        }
        const approvalHost = await open(1280, 'ApprovalHost');
        const capacityHost = await open(1280, 'CapacityHost');
        const privateHost = await open(1280, 'PrivateHost');
        const unlistedHost = await open(1280, 'UnlistedHost');
        const privateSession = await create(privateHost, {visibility: 2, name: 'Private ' + token});
        const unlisted = await create(unlistedHost, {visibility: 1, name: 'Unlisted ' + token});
        assert.equal((await api(visitor, privateSession)).status, 404);
        assert.equal((await api(second, privateSession)).status, 404);
        assert.equal((await api(visitor, unlisted)).status, 200);
        const found = await api(visitor, '/api/pickup/sessions?location=' + values.postalCode + '&sport=Wallyball&date=' + date);
        assert(found.data.sessions.some(row => row.id === id));
        assert(!found.data.sessions.some(row => row.name === 'Unlisted ' + token || row.name === 'Private ' + token));

        const approval = await create(approvalHost, {approvalRequired: true, name: 'Approval ' + token});
        const pending = await api(player, approval + '/join', 'POST', {});
        assert.equal(pending.data.registration, 1);
        const row = (await api(approvalHost, approval)).data.registrations[0];
        assert.equal((await api(player, approval + '/registrations/' + row.id, 'POST', {approve: true})).status, 404);
        assert.equal((await api(approvalHost, approval + '/registrations/' + row.id, 'POST', {approve: true})).status, 204);
        assert.equal((await api(player, approval)).data.registration, 2);
        assert.equal((await api(second, approval + '/join', 'POST', {})).data.registration, 1);
        const secondRequest = (await api(approvalHost, approval)).data.registrations.find(row => row.state === 1);
        assert.equal((await api(approvalHost, approval + '/registrations/' + secondRequest.id, 'POST', {approve: false})).status, 204);
        assert.equal((await api(second, approval)).data.registration, 4);

        const finalSpot = await create(capacityHost, {capacity: 2, name: 'Capacity ' + token});
        assert.equal((await api(capacityHost, finalSpot + '/join', 'POST', {})).status, 200);
        const results = await Promise.all([player, second].map(page => api(page, finalSpot + '/join', 'POST', {})));
        assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
        assert.equal((await api(capacityHost, finalSpot)).data.confirmed, 2);

        const rejected = results[0].status === 409 ? player : second;
        assert.equal((await api(rejected, finalSpot + '/join?waitlist=true', 'POST', {})).data.registration, 5);
        assert.equal((await api(capacityHost, finalSpot + '/leave', 'POST', {})).status, 204);
        assert.equal((await api(rejected, finalSpot)).data.registration, 2);
        assert.equal((await api(capacityHost, finalSpot)).data.confirmed, 2);
        assert.equal((await api(capacityHost, finalSpot + '/cancel', 'POST', {})).status, 204);
        assert.equal((await api(capacityHost, finalSpot + '/join', 'POST', {})).status, 409);

        // Provision accounts serially so the concurrency test targets Pickup joins.
        for (let batch = 0; batch < 21; batch++) {
            const participants = [];
            try {
                for (let n = 0; n < 4; n++) {
                    const ctx = await request.newContext({ignoreHTTPSErrors: true, extraHTTPHeaders: {Origin: origin}});
                    participants.push(ctx);
                    const signup = await ctx.post(origin + '/api/login/register', {data: {
                        email: ['open', token, batch, n].join('-') + '@example.invalid',
                        password: crypto.randomBytes(20).toString('hex'), firstName: 'Capacity', lastName: 'Fixture'
                    }});
                    assert.equal(signup.status(), 200, await signup.text());
                }
                await Promise.all(participants.map(async ctx => {
                    const joined = await ctx.post(origin + endpoint + '/join?waitlist=true', {data: {}});
                    assert.equal(joined.status(), 200, await joined.text());
                    assert.equal((await joined.json()).registration, 2);
                }));
            } finally {
                await Promise.all(participants.map(ctx => ctx.dispose()));
            }
        }
        assert.equal((await api(organizer, endpoint)).data.confirmed, 85);
        const original = await api(organizer, endpoint);
        assert.equal((await api(organizer, endpoint, 'PUT', {...values, capacity: null, description: 'Updated fixture'})).status, 204);
        assert.equal((await api(organizer, endpoint)).data.description, 'Updated fixture');
        assert.equal(original.data.id, id);
        assert.deepEqual(errors, []);
        for (const [host, fixture] of [[organizer, endpoint], [privateHost, privateSession], [unlistedHost, unlisted],
            [approvalHost, approval], [mobile, advancedEndpoint]])
            assert.equal((await api(host, fixture + '/cancel', 'POST', {})).status, 204);
        console.log('Pickup browser and API checks passed at desktop and mobile widths against the isolated database.');
    } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });

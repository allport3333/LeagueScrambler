const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium, expect} = require('@playwright/test');

const origin = 'https://localhost:5003';
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

(async () => {
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
        await organizer.getByRole('link', {name: 'Create Pickup Session'}).click();
        for (const [label, value] of Object.entries({'Session name': values.name, 'Facility name': values.venue,
            'Street address': values.address, City: values.city, 'State or province': values.region,
            'ZIP or postal code': values.postalCode, 'Venue time zone': values.timeZone,
            'Start date and time': values.start, 'End date and time': values.end})) {
            await organizer.getByLabel(label, {exact: true}).fill(value);
        }
        await organizer.getByRole('button', {name: 'Create Pickup Session'}).click();
        await expect(organizer.getByRole('heading', {name: values.name})).toBeVisible();
        await expect(organizer.getByText('16 spots open')).toBeVisible();
        const sessionUrl = organizer.url();
        const id = sessionUrl.split('/').at(-1);
        const endpoint = '/api/pickup/sessions/' + id;
        const details = await api(organizer, endpoint);
        assert.equal(new Intl.DateTimeFormat('en-GB', {timeZone: values.timeZone, hour: '2-digit', minute: '2-digit'}).format(new Date(details.data.startsUtc)), '18:00');
        assert.equal(details.data.capacity, 16);

        const visitor = await open(390);
        await visitor.getByLabel('City or ZIP code').fill(values.postalCode);
        await visitor.locator('select[name=sport]').selectOption('Wallyball');
        await visitor.getByLabel('Date', {exact: true}).fill(run);
        await visitor.getByLabel('Available spots only').check();
        await visitor.getByRole('button', {name: 'Find Games'}).click();
        await visitor.getByRole('link', {name: 'View Details for ' + values.name}).click();
        await expect(visitor.getByText('16 spots open')).toBeVisible();
        const before = new Set(await fs.readdir(inbox));
        const guestEmail = 'guest-' + token + '@example.invalid';
        await visitor.getByRole('button', {name: 'Join Session'}).click();
        await visitor.getByLabel('Name', {exact: true}).fill('Guest ' + token);
        await visitor.getByLabel('Email address', {exact: true}).fill(guestEmail);
        await visitor.getByRole('button', {name: 'Join Session'}).click();
        await expect(visitor.getByRole('status')).toContainText('Check your email');
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
        await expect(organizer.getByText('Guest ' + token + ' · Confirmed')).toBeVisible();
        await visitor.getByRole('button', {name: 'Cancel Registration'}).click();
        await expect(visitor.getByText('Your registration: Cancelled')).toBeVisible();
        await expect(visitor.getByText('16 spots open')).toBeVisible();

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

        async function create(input) {
            const result = await api(organizer, '/api/pickup/sessions', 'POST', {...values, ...input});
            assert.equal(result.status, 201, JSON.stringify(result));
            return '/api/pickup/sessions/' + result.data.id;
        }
        const privateSession = await create({visibility: 2, name: 'Private ' + token});
        const unlisted = await create({visibility: 1, name: 'Unlisted ' + token});
        assert.equal((await api(visitor, privateSession)).status, 404);
        assert.equal((await api(second, privateSession)).status, 404);
        assert.equal((await api(visitor, unlisted)).status, 200);
        const found = await api(visitor, '/api/pickup/sessions?location=' + values.postalCode + '&sport=Wallyball&date=' + run);
        assert(found.data.sessions.some(row => row.id === id));
        assert(!found.data.sessions.some(row => row.name === 'Unlisted ' + token || row.name === 'Private ' + token));

        const approval = await create({approvalRequired: true, name: 'Approval ' + token});
        const pending = await api(player, approval + '/join', 'POST', {});
        assert.equal(pending.data.registration, 1);
        const row = (await api(organizer, approval)).data.registrations[0];
        assert.equal((await api(player, approval + '/registrations/' + row.id, 'POST', {approve: true})).status, 404);
        assert.equal((await api(organizer, approval + '/registrations/' + row.id, 'POST', {approve: true})).status, 204);
        assert.equal((await api(player, approval)).data.registration, 2);
        assert.equal((await api(second, approval + '/join', 'POST', {})).data.registration, 1);
        const secondRequest = (await api(organizer, approval)).data.registrations.find(row => row.state === 1);
        assert.equal((await api(organizer, approval + '/registrations/' + secondRequest.id, 'POST', {approve: false})).status, 204);
        assert.equal((await api(second, approval)).data.registration, 4);

        const finalSpot = await create({capacity: 2, name: 'Capacity ' + token});
        assert.equal((await api(organizer, finalSpot + '/join', 'POST', {})).status, 200);
        const results = await Promise.all([player, second].map(page => api(page, finalSpot + '/join', 'POST', {})));
        assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
        assert.equal((await api(organizer, finalSpot)).data.confirmed, 2);
        assert.equal((await api(organizer, finalSpot + '/cancel', 'POST', {})).status, 204);
        assert.equal((await api(second, finalSpot + '/guest', 'POST', values)).status, 400);
        const rejected = results[0].status === 409 ? player : second;
        assert.equal((await api(rejected, finalSpot + '/join', 'POST', {})).status, 409);
        const original = await api(organizer, endpoint);
        assert.equal((await api(organizer, endpoint, 'PUT', {...values, description: 'Updated fixture'})).status, 204);
        assert.equal((await api(organizer, endpoint)).data.description, 'Updated fixture');
        assert.equal(original.data.id, id);
        assert.deepEqual(errors, []);
        for (const fixture of [endpoint, privateSession, unlisted, approval])
            assert.equal((await api(organizer, fixture + '/cancel', 'POST', {})).status, 204);
        console.log('Pickup browser and API checks passed at desktop and mobile widths against the isolated database.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

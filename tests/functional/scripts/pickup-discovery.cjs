const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {randomBytes} = require('node:crypto');
const {chromium, expect} = require('@playwright/test');
const {withPickupTestHost} = require('../helpers/pickup-test-host.cjs');

const token = randomBytes(5).toString('hex');
const zone = 'America/Detroit';
function localInput(date) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(date).map(p => [p.type, p.value]));
    return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
}

withPickupTestHost(async origin => {
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        const owner = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block'});
        const api = owner.request;
        assert.equal((await api.get(origin + '/api/pickup/catalog')).headers()['x-pickup-test-database'], 'LeagueScramblerPickupTest');
        const headers = {Origin: origin};
        const sessionsByOwner = new Map();
        async function register(api, suffix) {
            const signup = await api.post(origin + '/api/login/register', {headers, data: {
                email: 'discovery-' + suffix + '-' + token + '@example.invalid', password: randomBytes(20).toString('hex'),
                firstName: 'Discovery', lastName: 'Fixture'
            }});
            assert.equal(signup.status(), 200);
        }
        await register(api, 0);
        const ids = [];
        async function create(label, details = {}) {
            const account = ids.length ? (await browser.newContext({ignoreHTTPSErrors: true})).request : api;
            if (ids.length) await register(account, ids.length);
            const response = await account.post(origin + '/api/pickup/sessions', {headers, data: {
                name: label + ' ' + token, sport: 'Wallyball', venue: label + ' Facility ' + token,
                city: 'Roseville', region: 'MI', timeZone: zone, startNow: true, ...details
            }});
            assert.equal(response.status(), 201, await response.text());
            const {id} = await response.json();
            assert.match(id, /^[0-9a-f-]{36}$/i);
            ids.push(id);
            sessionsByOwner.set(id, account);
            return id;
        }
        const closed = await create('Cross-midnight', {region: '', deadline: '2020-01-01T12:00'});
        const zipOnly = await create('ZIP only', {city: '', region: '', postalCode: '48066'});
        const cityOnly = await create('City only');
        const justInside = await create('Just inside');
        const justOutside = await create('Just outside');
        const shortly = await create('Soon', {startNow: false, start: localInput(new Date(Date.now() + 3600000))});
        const upcoming = await create('Upcoming', {startNow: false, start: localInput(new Date(Date.now() + 3 * 86400000))});
        const point = await create('Coordinate fixture', {city: 'Detroit'});
        const otherState = await create('Other state', {region: 'CA', timeZone: 'America/Los_Angeles'});
        const privateId = await create('Private', {visibility: 2});
        const unlisted = await create('Unlisted', {visibility: 1});
        const exactWithoutLookup = await create('Unindexed ZIP', {city: '', region: '', postalCode: '00000-0123'});
        const completed = await create('Completed');
        const cancelled = await create('Cancelled');
        assert.equal((await sessionsByOwner.get(completed).post(origin + '/api/pickup/sessions/' + completed + '/lifecycle', {headers, data: {complete: true}})).status(), 204);
        assert.equal((await sessionsByOwner.get(cancelled).post(origin + '/api/pickup/sessions/' + cancelled + '/cancel', {headers})).status(), 204);

        const today = localInput(new Date()).slice(0, 10);
        const yesterday = new Date(Date.parse(today + 'T12:00Z') - 86400000).toISOString().slice(0, 10);
        const start = today + 'T00:00:00.000Z';
        const end = new Date(Date.now() + 2 * 3600000).toISOString();
        // Give the fixture a previous local start date and verified venue coordinates.
        // All values are controlled fixtures and the SQL batch also verifies its database.
        execFileSync('sqlcmd.exe', ['-S', 'lpc:localhost', '-d', 'LeagueScramblerPickupTest', '-E', '-C', '-b', '-Q',
            `IF DB_NAME() <> N'LeagueScramblerPickupTest' THROW 51000,'Wrong test database',1;
             UPDATE dbo.PickupSession SET StartsUtc='${start}', EndsUtc='${end}', LocalDate='${yesterday}', State=2 WHERE Id='${closed}';
             UPDATE v SET Latitude=42.3314,Longitude=-83.0458 FROM dbo.PickupVenue v
             JOIN dbo.PickupSession s ON s.VenueId=v.Id WHERE s.Id='${point}';
             UPDATE v SET Latitude=42.5743,Longitude=-82.9387 FROM dbo.PickupVenue v JOIN dbo.PickupSession s ON s.VenueId=v.Id WHERE s.Id='${justInside}';
             UPDATE v SET Latitude=42.5772,Longitude=-82.9387 FROM dbo.PickupVenue v JOIN dbo.PickupSession s ON s.VenueId=v.Id WHERE s.Id='${justOutside}';`]);

        const guest = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: {width: 1366, height: 850}});
        const page = await guest.newPage();
        async function search(params) {
            const rows = [];
            for (let page = 0; ; page++) {
                const response = await guest.request.get(origin + '/api/pickup/sessions', {params: {...params, page}});
                assert.equal(response.status(), 200, await response.text());
                const result = await response.json();
                rows.push(...result.sessions);
                if (!result.hasMore) return rows;
            }
        }
        for (const location of ['Roseville, MI', '48066']) {
            const rows = await search({location});
            const relevant = rows.filter(row => ids.includes(row.id));
            for (const id of [closed, zipOnly, cityOnly, shortly, upcoming]) assert(relevant.some(row => row.id === id));
            for (const id of [otherState, unlisted, privateId, completed, cancelled]) assert(!relevant.some(row => row.id === id));
            assert.equal(relevant.find(row => row.id === closed).registrationOpen, false);
            assert.equal(relevant.find(row => row.id === closed).timing, 0);
            assert.equal(relevant.find(row => row.id === shortly).timing, 1);
            assert.equal(relevant.find(row => row.id === upcoming).timing, 2);
            assert.equal(relevant.find(row => row.id === cityOnly).distanceMiles, 0);
            assert.equal(relevant.find(row => row.id === cityOnly).approximateLocation, true);
            assert.equal(relevant.find(row => row.id === closed).distanceMiles, null);
        }
        const exactRows = await search({location: '00000', radius: 25});
        assert(exactRows.some(row => row.id === exactWithoutLookup && row.distanceMiles === null));
        const zipResult = (await search({location: '48066'})).find(row => row.id === zipOnly);
        assert.equal(zipResult.displayCity, 'Roseville');
        assert.equal(zipResult.displayRegion, 'MI');
        for (const location of ['48081', 'Saint Clair Shores, MI']) {
            const nearby = await search({location, radius: 5});
            for (const id of [zipOnly, cityOnly]) {
                const row = nearby.find(result => result.id === id);
                assert(row && row.distanceMiles > 2 && row.distanceMiles < 3 && row.approximateLocation);
            }
        }
        const fiveMiles = await search({location: '48066', radius: 5});
        assert(fiveMiles.some(row => row.id === justInside && row.distanceMiles === 4.9 && !row.approximateLocation));
        assert(!fiveMiles.some(row => row.id === justOutside));
        assert((await search({location: '48066', radius: 10})).some(row => row.id === justOutside && row.distanceMiles === 5.1));
        assert(!(await search({location: '90210', radius: 50})).some(row => row.id === zipOnly));
        const unqualified = await search({location: 'Roseville'});
        assert(unqualified.some(r => r.id === closed));
        assert((await search({location: '48066', radius: 25})).some(r => r.id === point && r.distanceMiles > 5));
        assert(!(await search({location: '48066', radius: 5})).some(r => r.id === point));
        assert((await search({location: '48066', available: true})).some(r => r.id === zipOnly));
        assert(!(await search({location: '48066', available: true})).some(r => r.id === closed));
        for (const date of [yesterday, today]) assert((await search({location: '48066', date})).some(r => r.id === closed));
        assert.equal((await guest.request.get(origin + '/api/pickup/sessions/' + privateId)).status(), 404);
        assert.equal((await guest.request.get(origin + '/api/pickup/sessions/' + unlisted)).status(), 200);
        assert.equal((await guest.request.get(origin + '/api/pickup/sessions', {params: {location: 'bad-location-' + token}})).status(), 400);

        await page.goto(origin + '/');
        const nav = page.getByRole('navigation', {name: 'Main navigation'});
        await nav.getByRole('link', {name: 'Pickup Games', exact: true}).click();
        await expect(page.locator('#leagueDropdown')).toHaveCount(0);
        await expect(page.getByRole('link', {name: 'Create Pickup Game'})).toHaveCount(0);
        await page.getByRole('link', {name: 'Find Pickup Games', exact: true}).click();
        await expect(page.getByLabel('Where do you want to play?')).toBeVisible();
        await page.getByText('More Filters', {exact: true}).click();
        await page.getByLabel('Date', {exact: true}).fill(yesterday);
        for (const [width, theme, location] of [[1366, 'classic', 'Roseville'], [390, 'navy', '48066'], [768, 'charcoal', 'Roseville, MI']]) {
            await page.setViewportSize({width, height: 850});
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await expect(nav.getByRole('link', {name: 'Pickup Games', exact: true})).toBeVisible();
            await page.getByLabel('Where do you want to play?').fill(location);
            await page.getByRole('button', {name: 'Find Games', exact: true}).click();
            const card = page.locator('article').filter({hasText: 'Cross-midnight ' + token});
            await expect(card.getByText('Playing Now', {exact: true})).toBeVisible();
            await expect(card.getByText('Registration Closed', {exact: true})).toBeVisible();
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await page.getByRole('button', {name: 'Find Games', exact: true}).click();
        await expect(page.locator('article').filter({hasText: 'Cross-midnight ' + token})).toBeVisible();
        await page.route('**/api/pickup/sessions?*', async route => {
            const response = await route.fetch();
            const {sessions, hasMore} = await response.json();
            await route.fulfill({response, json: {sessions, hasMore}});
        });
        await page.getByRole('button', {name: 'Find Games', exact: true}).click();
        await expect(page.locator('article').filter({hasText: 'Cross-midnight ' + token})).toBeVisible();
        await page.unroute('**/api/pickup/sessions?*');
        await page.route('**/api/pickup/sessions?*', route => route.fulfill({status: 503, json: {message: 'Fixture outage'}}), {times: 1});
        await page.getByRole('button', {name: 'Find Games', exact: true}).click();
        await expect(page.getByRole('button', {name: 'Retry', exact: true})).toBeVisible();
        await page.getByRole('button', {name: 'Retry', exact: true}).click();
        await expect(page.locator('article').filter({hasText: 'Cross-midnight ' + token})).toBeVisible();
        await page.goto(origin + '/pickup/' + zipOnly);
        await expect(page.locator('.pickup-home-link')).toHaveCount(0);
        await page.getByRole('button', {name: 'Join as Guest', exact: true}).click();
        await expect(page.getByLabel('Email address')).toBeVisible();
        await page.reload();
        await expect(page.locator('#leagueDropdown')).toHaveCount(0);
        const ownerPage = await owner.newPage();
        await ownerPage.goto(origin + '/pickup/mine');
        await expect(ownerPage.getByRole('link', {name: 'Cross-midnight ' + token, exact: true})).toBeVisible();
        await ownerPage.locator('#leagueDropdown').click();
        const selector = ownerPage.getByRole('dialog', {name: 'Select league or event'});
        await expect(selector.getByRole('button', {name: /^Pickup Games/})).toHaveCount(1);
        await expect(selector.getByRole('link', {name: 'Pickup Games', exact: true})).toHaveCount(0);
        await expect(selector.getByRole('link', {name: 'Find Pickup Games', exact: true})).toBeVisible();
        await expect(ownerPage.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: 'Pickup Games', exact: true})).toHaveCount(0);
        for (const id of ids.filter(id => id !== completed && id !== cancelled))
            await sessionsByOwner.get(id).post(origin + '/api/pickup/sessions/' + id + '/cancel', {headers});
        await ownerPage.keyboard.press('Escape');
        await ownerPage.getByRole('button', {name: 'Account', exact: true}).click();
        await ownerPage.getByRole('menuitem', {name: 'Logout'}).click();
        await expect(ownerPage.locator('#leagueDropdown')).toHaveCount(0);
        await expect(ownerPage.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: 'Pickup Games', exact: true})).toBeVisible();
        console.log('Pickup discovery, overnight overlap, distance, visibility and signed-in/out browser navigation passed.');
    } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });

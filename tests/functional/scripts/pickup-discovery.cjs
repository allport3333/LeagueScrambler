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
        const signup = await api.post(origin + '/api/login/register', {headers, data: {
            email: 'discovery-' + token + '@example.invalid', password: randomBytes(20).toString('hex'),
            firstName: 'Discovery', lastName: 'Fixture'
        }});
        assert.equal(signup.status(), 200);
        const ids = [];
        async function create(label, details = {}) {
            const response = await api.post(origin + '/api/pickup/sessions', {headers, data: {
                name: label + ' ' + token, sport: 'Wallyball', venue: label + ' Facility ' + token,
                city: 'Roseville', region: 'MI', timeZone: zone, startNow: true, ...details
            }});
            assert.equal(response.status(), 201, await response.text());
            const {id} = await response.json();
            assert.match(id, /^[0-9a-f-]{36}$/i);
            ids.push(id);
            return id;
        }
        const closed = await create('Cross-midnight', {region: '', deadline: '2020-01-01T12:00'});
        const zipOnly = await create('ZIP only', {city: '', region: '', postalCode: '48066'});
        const cityOnly = await create('City only');
        const shortly = await create('Soon', {startNow: false, start: localInput(new Date(Date.now() + 3600000))});
        const upcoming = await create('Upcoming', {startNow: false, start: localInput(new Date(Date.now() + 3 * 86400000))});
        const point = await create('Coordinate fixture', {city: 'Detroit'});
        const otherState = await create('Other state', {region: 'CA', timeZone: 'America/Los_Angeles'});
        const privateId = await create('Private', {visibility: 2});
        const unlisted = await create('Unlisted', {visibility: 1});
        const completed = await create('Completed');
        const cancelled = await create('Cancelled');
        assert.equal((await api.post(origin + '/api/pickup/sessions/' + completed + '/lifecycle', {headers, data: {complete: true}})).status(), 204);
        assert.equal((await api.post(origin + '/api/pickup/sessions/' + cancelled + '/cancel', {headers})).status(), 204);

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
             JOIN dbo.PickupSession s ON s.VenueId=v.Id WHERE s.Id='${point}';`]);

        const guest = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: {width: 1366, height: 850}});
        const page = await guest.newPage();
        async function search(params) {
            const response = await guest.request.get(origin + '/api/pickup/sessions', {params});
            assert.equal(response.status(), 200, await response.text());
            return (await response.json()).sessions;
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
            assert.equal(relevant.find(row => row.id === cityOnly).distanceMiles, null);
        }
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
        await page.getByText('More Filters', {exact: true}).click();
        await page.getByLabel('Date', {exact: true}).fill(yesterday);
        await page.getByRole('button', {name: 'Find Games', exact: true}).click();
        await expect(page.locator('article').filter({hasText: 'Cross-midnight ' + token})).toBeVisible();
        await page.goto(origin + '/pickup/' + zipOnly);
        await page.getByRole('button', {name: 'Join Session', exact: true}).click();
        await expect(page.getByLabel('Email address')).toBeVisible();
        await page.reload();
        await expect(page.locator('#leagueDropdown')).toHaveCount(0);
        const ownerPage = await owner.newPage();
        await ownerPage.goto(origin + '/pickup/mine');
        await expect(ownerPage.getByRole('link', {name: 'Cross-midnight ' + token, exact: true})).toBeVisible();
        await ownerPage.locator('#leagueDropdown').click();
        const selector = ownerPage.getByRole('dialog', {name: 'Select league or event'});
        await expect(selector.getByRole('link', {name: 'Pickup Games', exact: true})).toHaveCount(1);
        await expect(selector.getByRole('link', {name: 'Find Pickup Games', exact: true})).toBeVisible();
        await expect(ownerPage.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: 'Pickup Games', exact: true})).toHaveCount(0);
        for (const id of ids.filter(id => id !== completed && id !== cancelled))
            await api.post(origin + '/api/pickup/sessions/' + id + '/cancel', {headers});
        await ownerPage.keyboard.press('Escape');
        await ownerPage.getByRole('button', {name: 'Account', exact: true}).click();
        await ownerPage.getByRole('menuitem', {name: 'Logout'}).click();
        await expect(ownerPage.locator('#leagueDropdown')).toHaveCount(0);
        await expect(ownerPage.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: 'Pickup Games', exact: true})).toBeVisible();
        console.log('Pickup discovery, overnight overlap, distance, visibility and signed-in/out browser navigation passed.');
    } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });

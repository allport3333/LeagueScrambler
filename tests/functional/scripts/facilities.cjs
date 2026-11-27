const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { withPickupTestHost } = require('../helpers/pickup-test-host.cjs');

const token = randomUUID().slice(0, 8);
const administrator = 'facility-admin-' + token + '@example.invalid';
const lead = 'facility-lead-' + token + '@example.invalid';
const manager = 'facility-manager-' + token + '@example.invalid';
const sql = query => execFileSync('sqlcmd.exe', ['-S', 'lpc:localhost', '-d', 'LeagueScramblerPickupTest',
    '-E', '-C', '-b', '-h', '-1', '-W', '-Q',
    "IF DB_NAME() <> 'LeagueScramblerPickupTest' THROW 51000,'Wrong database',1; SET NOCOUNT ON; " + query],
    {encoding: 'utf8'}).trim();

withPickupTestHost(async origin => {
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        const organizer = await browser.newContext({ignoreHTTPSErrors: true});
        const visitor = await browser.newContext({ignoreHTTPSErrors: true, viewport: {width: 390, height: 840}});
        const probe = await organizer.request.get(origin + '/api/pickup/catalog');
        assert.equal(probe.headers()['x-pickup-test-database'], 'LeagueScramblerPickupTest');
        const post = (context, url, data) => context.request.post(origin + url, {headers: {Origin: origin}, data});
        const put = (context, url, data) => context.request.put(origin + url, {headers: {Origin: origin}, data});
        for (const email of [administrator, lead, manager]) assert.equal((await post(organizer, '/api/login/register', {
            email, password: randomUUID() + 'Aa1!', firstName: 'Facility', lastName: token
        })).status(), 200);
        await post(organizer, '/api/login/logout', {});
        const organizerPassword = randomUUID() + 'Aa1!';
        const loginEmail = 'facility-owner-' + token + '@example.invalid';
        assert.equal((await post(organizer, '/api/login/register', {
            email: loginEmail, password: organizerPassword, firstName: 'Facility', lastName: 'Owner'
        })).status(), 200);
        sql(`UPDATE dbo.[User] SET UserRoleId=1 WHERE Email IN (N'${loginEmail}',N'${administrator}',N'${lead}');
            UPDATE dbo.[User] SET UserRoleId=2 WHERE Email=N'${manager}';`);
        const profile = {
            name: 'Roseville Facility ' + token, alternateName: 'Hub Fixture ' + token,
            address: token + ' Fixture Avenue', city: 'Roseville', region: 'MI', postalCode: '48066',
            country: 'United States', timeZone: 'America/Detroit', website: 'https://example.invalid/',
            activities: 'Wallyball|Racquetball', source: 'Disposable test fixture', sourceKey: 'fixture:' + token,
            latitude: 42.5316, longitude: -82.9094, approximateCoordinates: true, reviewed: true
        };
        assert.equal((await post(visitor, '/api/facilities/reviewed', profile)).status(), 401);
        const reviewed = await post(organizer, '/api/facilities/reviewed', profile);
        assert.equal(reviewed.status(), 200, await reviewed.text());
        const {id: venueId} = await reviewed.json();
        assert.equal((await post(organizer, '/api/facilities/reviewed', profile)).status(), 409);
        const create = async (label, type) => {
            const response = await post(organizer, '/api/ScrambleData/AddNewLeague/' + encodeURIComponent(label + ' ' + token) +
                '?eventTypeId=' + type + '&venueId=' + venueId + (type === 2 ? '&eventDate=2026-12-12' : ''), []);
            assert.equal(response.status(), 200, await response.text());
            return (await response.json()).id;
        };
        const organizerPage = await organizer.newPage();
        async function createFromForm(type) {
            const tournamentForm = type === 2;
            const label = tournamentForm ? 'Public tournament ' : 'Public league ';
            await organizerPage.goto(origin + (tournamentForm ? '/tournament?view=create' : '/league-management?view=create'));
            await organizerPage.getByLabel(tournamentForm ? 'Tournament Name' : 'Event Name', {exact: true}).fill(label + token);
            if (tournamentForm) await organizerPage.getByLabel('Tournament Date').fill('2026-12-12');
            await organizerPage.getByLabel('Find an existing facility').fill(profile.name);
            await organizerPage.getByRole('button', {name: 'Search Facilities'}).click();
            const selector = organizerPage.getByLabel('Primary facility');
            await selector.selectOption({label: profile.name + ' \u00b7 Roseville'});
            const result = organizerPage.waitForResponse(response =>
                response.request().method() === 'POST' && response.url().includes('/api/ScrambleData/AddNewLeague/'));
            await organizerPage.getByRole('button', {name: tournamentForm ? 'Create Tournament' : 'Create League', exact: true}).click();
            const response = await result;
            assert.equal(response.status(), 200, await response.text());
            return (await response.json()).id;
        }
        const league = await createFromForm(1);
        const tournament = await createFromForm(2);
        await organizerPage.close();
        const hidden = await create('Private league', 1);
        const leadId = Number(sql(`SELECT UserId FROM dbo.[User] WHERE Email=N'${lead}';`));
        assert.equal((await put(organizer, '/api/facilities/event/' + league, {
            venueId, publicListing: true, sport: 'Wallyball', season: 'Winter', leadAdminId: leadId
        })).status(), 204);
        assert.equal((await put(organizer, '/api/facilities/event/' + tournament, {
            venueId, publicListing: true, sport: 'Wallyball'
        })).status(), 204);
        sql(`DELETE dbo.UserLeague WHERE LeagueTypeId=${league};
            INSERT dbo.UserLeague(UserId,LeagueTypeId) SELECT UserId,${league} FROM dbo.[User] WHERE Email=N'${manager}';`);
        for (const visibility of [0, 1, 2]) {
            const result = await post(organizer, '/api/pickup/sessions', {
                name: 'Fixture pickup ' + visibility + ' ' + token,
                venueId, sport: 'Wallyball', startNow: true, visibility
            });
            assert.equal(result.status(), 201, await result.text());
            await post(organizer, '/api/pickup/sessions/' + (await result.json()).id + '/cancel', {});
        }
        const upcoming = await post(organizer, '/api/pickup/sessions', {
            name: 'Visible pickup ' + token, venueId, sport: 'Wallyball', startNow: true, visibility: 0
        });
        assert.equal(upcoming.status(), 201, await upcoming.text());
        const details = await visitor.request.get(origin + '/api/facilities/' + venueId);
        assert.equal(details.status(), 200, await details.text());
        const raw = await details.text();
        const json = JSON.parse(raw);
        assert.deepEqual(json.events.map(event => event.leagueId).sort(), [league, tournament].sort());
        assert.equal(json.pickup.length, 1);
        assert(!raw.includes(manager) && !raw.includes(lead));
        assert.equal((await visitor.request.get(origin + '/api/facilities/event/' + hidden)).status(), 404);
        for (const type of [1, 2, 3]) {
            const nearby = await visitor.request.get(origin + '/api/facilities?location=48081&radius=25&eventType=' + type);
            assert.equal(nearby.status(), 200, await nearby.text());
            const found = (await nearby.json()).facilities.find(venue => venue.id === venueId);
            assert(found && found.approximate && found.distanceMiles > 0);
        }
        const page = await visitor.newPage();
        await page.goto(origin + '/facilities/' + venueId);
        await expect(page.getByRole('heading', {name: profile.name})).toBeVisible();
        await page.getByRole('button', {name: 'Contact League Organizer'}).click();
        await page.getByLabel('Name', {exact: true}).fill('Guest Fixture');
        await page.getByLabel('Reply email').fill('visitor@example.invalid');
        await page.getByLabel('Subject').fill('Location inquiry');
        await page.getByLabel('Message').fill('manager-route-' + token);
        await page.getByRole('button', {name: 'Send Inquiry'}).click();
        await expect(page.getByText('Your inquiry was accepted for delivery.')).toBeVisible();
        sql(`DELETE dbo.UserLeague WHERE LeagueTypeId=${league};`);
        assert.equal((await post(visitor, '/api/facilities/event/' + league + '/contact', {
            name: 'Guest Fixture', email: 'visitor@example.invalid', subject: 'Location inquiry', message: 'lead-route-' + token
        })).status(), 202);
        assert.equal((await post(visitor, '/api/facilities/event/' + hidden + '/contact', {
            name: 'Guest Fixture', email: 'visitor@example.invalid', subject: 'Location inquiry', message: 'private'
        })).status(), 404);
        assert.equal((await post(visitor, '/api/facilities/event/' + league + '/contact', {
            name: 'Guest Fixture', email: 'visitor@example.invalid', subject: 'Location inquiry', message: 'rate limit'
        })).status(), 429);
        const mail = path.join(process.env.LOCALAPPDATA, 'LeagueHub', 'PickupTest', 'mail');
        const delivered = fs.readdirSync(mail).filter(file => file.endsWith('.eml'))
            .map(file => fs.readFileSync(path.join(mail, file), 'utf8').replace(/=\r?\n/g, ''))
            .filter(text => text.includes(token));
        assert(delivered.some(text => text.includes('manager-route-' + token) && text.includes(manager)));
        assert(delivered.some(text => text.includes('lead-route-' + token) && text.includes(lead)));
        console.log('Shared facilities, public visibility, all three radius filters, manager and lead routing, and inquiry rate limits passed.');
    } finally {
        await browser.close();
    }
}).catch(error => { console.error(error); process.exitCode = 1; });

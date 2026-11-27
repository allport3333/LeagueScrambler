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
        const organizer = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block'});
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
            name: 'Roseville Community Sports and Recreation Facility ' + token, alternateName: 'Hub Fixture ' + token,
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
        const create = async (label, type, date = '2026-12-12') => {
            const response = await post(organizer, '/api/ScrambleData/AddNewLeague/' + encodeURIComponent(label + ' ' + token) +
                '?eventTypeId=' + type + '&venueId=' + venueId + (type === 2 ? '&eventDate=' + date : ''), []);
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
            await selector.selectOption({label: profile.name + ' \u00b7 Roseville, MI 48066'});
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
        const selectorPage = await organizer.newPage();
        for (const [theme, width] of [['classic', 1366], ['soft-light', 1280], ['navy', 390], ['charcoal', 768]]) {
            await selectorPage.setViewportSize({width, height: 850});
            await selectorPage.goto(origin + '/?leagueId=' + (width === 390 ? tournament : league));
            await selectorPage.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await selectorPage.locator('#leagueDropdown').click();
            const menu = selectorPage.getByRole('dialog', {name: 'Select league or event'});
            await expect(menu.locator('.event-category > span:first-of-type')).toHaveText(['Leagues','Tournaments','Pickup Games','Facilities']);
            await menu.getByRole('button', {name: /^Facilities/}).click();
            await expect(menu.getByRole('link', {name: 'Find Facilities'})).toHaveAttribute('href', '/facilities');
            await expect(menu.getByRole('link', {name: 'Manage Facilities'})).toHaveAttribute('href', '/facilities?view=manage');
            await menu.getByRole('link', {name: 'Find Facilities'}).click();
            await expect(selectorPage).toHaveURL(origin + '/facilities');
        }
        await selectorPage.close();
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
        const organizerView = await organizer.newPage();
        const eventsAtVenue = async () => (await (await visitor.request.get(origin + '/api/facilities/' + venueId)).json()).events;
        const leagueEndpoint = '/api/facilities/event/' + league;
        const tournamentEndpoint = '/api/facilities/event/' + tournament;
        const assignment = async endpoint => (await (await organizer.request.get(origin + endpoint)).json());
        expect(await assignment(leagueEndpoint)).toMatchObject({isActive: true, venueId, publicListing: true});
        expect(await assignment(tournamentEndpoint)).toMatchObject({isActive: true, venueId, publicListing: true});
        await organizerView.goto(origin + '/league-management?leagueId=' + league);
        await organizerView.getByRole('tab', {name: 'Manage Schedule'}).click();
        await expect(organizerView.getByRole('region', {name:'Facility and Public Listing', exact:true})).not.toBeVisible();
        await organizerView.getByRole('tab', {name: 'League Settings'}).click();
        await expect(organizerView.getByRole('region', {name:'Facility and Public Listing', exact:true})).not.toBeVisible();
        await organizerView.getByRole('tab', {name: 'League Setup'}).click();
        const activeLeague = organizerView.getByRole('checkbox', {name: 'Active League'});
        await expect(activeLeague).toBeChecked();
        const setup = organizerView.getByRole('region', {name:'Facility and Public Listing', exact:true});
        await expect(setup.getByRole('heading', {name:'League Details'})).toBeVisible();
        await expect(setup.getByText('Selected:', {exact:false})).toContainText(profile.name);
        for (const [theme, width] of [['classic',1920], ['soft-light',1366], ['navy',768], ['charcoal',390]]) {
            await organizerView.setViewportSize({width,height:850});
            await organizerView.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            const panels = setup.locator('.setup-fields');
            expect((await panels.evaluate(e => getComputedStyle(e).gridTemplateColumns)).split(' ').length).toBe(width >= 800 ? 2 : 1);
            await expect.poll(() => organizerView.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
        await organizerView.setViewportSize({width:1366,height:850});
        const searchBox = setup.getByRole('searchbox', {name:'Find an existing facility'});
        await searchBox.fill('No fixture facility matches ' + token);
        await searchBox.press('Enter');
        await expect(setup.getByText(/No matching facilities/)).toBeVisible();
        await expect(setup.getByText('Selected:', {exact:false})).toContainText(profile.name);
        await searchBox.fill('48066');
        await setup.getByRole('button',{name:'Search Facilities'}).click();
        await expect.poll(() => setup.locator('select option').allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining('Roseville, MI 48066')]));
        await searchBox.fill(profile.name);
        await searchBox.press('Enter');
        const primary = setup.getByRole('combobox', {name:/^Primary facility/});
        const option = profile.name + ' \u00b7 Roseville, MI 48066';
        await primary.selectOption({label:'No facility'});
        await expect(setup.getByText('Selected:', {exact:false})).toHaveCount(0);
        await primary.selectOption({label:option});
        await expect(setup.getByText('Selected:', {exact:false})).toContainText(profile.name);
        await setup.getByLabel('Public description', {exact:true}).fill('Public details ' + token);
        await expect(setup.getByText('Unsaved changes', {exact:true})).toBeVisible();
        await organizerView.locator('#leagueDropdown').click();
        await organizerView.getByRole('link', {name:'View Past Leagues'}).click();
        const discard = organizerView.getByRole('alertdialog');
        await expect(discard.getByRole('heading', {name:'Discard unsaved setup changes?'})).toBeVisible();
        await discard.getByRole('button', {name:'Cancel'}).click();
        await expect(setup.getByLabel('Public description', {exact:true})).toHaveValue('Public details ' + token);

        const requestPattern = '**/api/facilities/event/' + league;
        const failSave = route => route.request().method() === 'PUT'
            ? route.fulfill({status:400, json:{message:'Fixture validation error.'}}) : route.continue();
        await organizerView.route(requestPattern, failSave);
        await organizerView.getByRole('button', {name:'Save Changes', exact:true}).click();
        await expect(setup.getByRole('alert')).toHaveText('Fixture validation error.');
        await expect(setup.getByLabel('Public description', {exact:true})).toHaveValue('Public details ' + token);
        await organizerView.unroute(requestPattern, failSave);
        await activeLeague.uncheck();
        await organizerView.getByRole('button', {name: 'Save Changes', exact:true}).click();
        await expect(organizerView.getByText('Facility and listing settings saved.')).toBeVisible();
        expect(await assignment(leagueEndpoint)).toMatchObject({isActive: false, venueId, publicListing: true, season: 'Winter', sport:'Wallyball', description:'Public details ' + token, leadAdminId:leadId});
        expect((await eventsAtVenue()).map(e => e.leagueId)).toEqual([tournament]);
        expect((await visitor.request.get(origin + leagueEndpoint)).status()).toBe(404);
        const outsider = await browser.newContext({ignoreHTTPSErrors:true});
        assert.equal((await post(outsider, '/api/login/register', {email:'outsider-' + token + '@example.invalid',
            password:randomUUID() + 'Aa1!', firstName:'Outside', lastName:'Fixture'})).status(), 200);
        expect((await put(outsider, leagueEndpoint, {isActive: true})).status()).toBe(403);
        await outsider.close();

        await organizerView.locator('#leagueDropdown').click();
        const leagueMenu = organizerView.getByRole('dialog', {name:'Select league or event'});
        const leagueSection = leagueMenu.getByRole('group', {name:'Leagues', exact:true});
        const leagueTitle = 'Public league ' + token;
        await expect(leagueSection.getByText(leagueTitle, {exact:true})).toHaveCount(0);
        await leagueSection.getByRole('link', {name:'View Past Leagues'}).click();
        await expect(organizerView.getByRole('heading', {name:'Past Leagues'})).toBeVisible();
        await organizerView.getByRole('searchbox', {name:'Search leagues'}).fill(token);
        await expect(organizerView.getByText('Inactive · Winter')).toBeVisible();
        await organizerView.getByRole('link', {name:'Open ' + leagueTitle}).click();
        await expect(organizerView).toHaveURL(origin + '/league-dashboard?leagueId=' + league);
        await expect(organizerView.locator('#leagueDropdown')).toContainText('Inactive');
        assert.equal((await put(organizer, leagueEndpoint, {isActive: true})).status(), 204);
        expect(await assignment(leagueEndpoint)).toMatchObject({isActive:true, venueId, publicListing:true});

        await organizerView.goto(origin + '/tournament/' + tournament);
        await expect(organizerView.getByRole('heading', {name:'Tournament Details', exact:true})).toBeVisible();
        const activeTournament = organizerView.getByRole('checkbox', {name:'Active Tournament'});
        await expect(activeTournament).toBeChecked();
        await expect(organizerView.getByRole('textbox', {name:'Location', exact:true})).toHaveCount(0);
        await activeTournament.uncheck();
        await organizerView.getByRole('button', {name:'Save Facility Settings'}).click();
        await expect(organizerView.getByText('Facility and listing settings saved.')).toBeVisible();
        expect((await eventsAtVenue()).map(e=>e.leagueId)).toEqual([league]);
        assert.equal((await put(organizer, tournamentEndpoint, {isActive:true})).status(), 204);
        expect(await assignment(tournamentEndpoint)).toMatchObject({isActive:true, venueId, publicListing:true});

        const daysFromToday = offset => {
            const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Detroit'}).format(new Date());
            const day = new Date(today + 'T00:00:00Z');
            day.setUTCDate(day.getUTCDate() + offset);
            return day.toISOString().slice(0,10);
        };
        await create('Boundary tournament', 2, daysFromToday(-30));
        await create('Old tournament', 2, daysFromToday(-31));
        await create('Today tournament', 2, daysFromToday(0));
        const future = await create('Future tournament', 2, daysFromToday(400));
        await put(organizer, '/api/facilities/event/' + future, {isActive:false});
        sql("INSERT dbo.LeagueType(LeagueName,EventTypeId) VALUES(N'Undated tournament " + token + "',2);");
        await organizerView.goto(origin + '/?leagueId=' + tournament);
        await organizerView.locator('#leagueDropdown').click();
        const tournamentsMenu = organizerView.getByRole('group',{name:'Tournaments',exact:true});
        for (const label of ['Boundary', 'Today', 'Future']) await expect(tournamentsMenu.getByText(label+' tournament '+token,{exact:true})).toBeVisible();
        for (const label of ['Old', 'Undated']) await expect(tournamentsMenu.getByText(label+' tournament '+token,{exact:true})).toHaveCount(0);
        await tournamentsMenu.getByRole('link',{name:'View Past Tournaments'}).click();
        await organizerView.getByRole('searchbox',{name:'Search tournaments'}).fill(token);
        await expect(organizerView.getByRole('link',{name:'Open Undated tournament '+token})).toBeVisible();
        await expect(organizerView.getByRole('link',{name:'Open Old tournament '+token})).toBeVisible();
        await organizerView.getByRole('link',{name:'Open Old tournament '+token}).click();
        await expect(organizerView.locator('#leagueDropdown')).toContainText('Past');
        await organizerView.close();
        console.log('Event settings, active visibility, reactivation, authorized history and tournament date boundaries passed.');

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

const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium, expect} = require('@playwright/test');
const {withPickupTestHost} = require('../helpers/pickup-test-host.cjs');

const token = randomUUID().slice(0, 8);
const sql = query => execFileSync('sqlcmd.exe', ['-S', 'lpc:localhost', '-d', 'LeagueScramblerPickupTest', '-E', '-C',
    '-b', '-h', '-1', '-W', '-Q',
    "IF DB_NAME() <> 'LeagueScramblerPickupTest' THROW 51000,'Wrong database',1; SET NOCOUNT ON; " + query],
    {encoding: 'utf8'}).trim();

withPickupTestHost(async origin => {
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        const admin = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: {width: 390, height: 850}});
        const organizer = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block'});
        const guest = await browser.newContext({ignoreHTTPSErrors: true});
        assert.equal((await guest.request.get(origin + '/api/pickup/catalog')).headers()['x-pickup-test-database'],
            'LeagueScramblerPickupTest');
        const post = (context, url, data) => context.request.post(origin + url, {headers: {Origin: origin}, data});
        async function register(context, role) {
            const email = role + '-' + token + '@example.invalid';
            const response = await post(context, '/api/login/register', {
                email, password: randomUUID() + 'Aa1!', firstName: 'Facility', lastName: token
            });
            assert.equal(response.status(), 200, await response.text());
            return email;
        }
        const adminEmail = await register(admin, 'identity-admin');
        const organizerEmail = await register(organizer, 'identity-organizer');
        sql(`UPDATE dbo.[User] SET UserRoleId=1 WHERE Email=N'${adminEmail}';`);
        const base = {
            name: 'The Fixture Sports Center ' + token, alternateName: 'Fixture Club ' + token, address: '210 ' + token + ' Avenue',
            city: 'Roseville', region: 'MI', postalCode: '48066', country: 'United States', timeZone: 'America/Detroit',
            website: 'https://facility-' + token + '.example.invalid/', source: 'Test source', activities: 'Wallyball',
            sourceKey: 'fixture:a:' + token, latitude: 42.53, longitude: -82.91, approximateCoordinates: true, reviewed: true
        };
        const save = data => post(admin, '/api/facilities/reviewed', {...base, ...data});
        const pickup = await post(organizer, '/api/pickup/sessions', {
            name: 'Facility test game ' + token, sport: 'Wallyball', venue: base.name, address: base.address,
            city: base.city, region: base.region, country: 'USA', postalCode: base.postalCode, timeZone: base.timeZone,
            startNow: true, visibility: 0
        });
        assert.equal(pickup.status(), 201, await pickup.text());
        const session = (await pickup.json()).id;
        const target = Number(sql(`SELECT VenueId FROM dbo.PickupSession WHERE Id='${session}';`));
        const variant = {...base, name: 'fixture SPORTS-CENTER ' + token.toUpperCase(), address: '210 ' + token + ' AVE.',
            region: 'Michigan', postalCode: '48066-1234'};
        const secondOrganizer = await browser.newContext({ignoreHTTPSErrors: true, serviceWorkers: 'block'});
        await register(secondOrganizer, 'identity-second-organizer');
        const duplicatePickup = await post(secondOrganizer, '/api/pickup/sessions', {
            ...variant, name: 'Second Pickup ' + token, venue: variant.name, sport: 'Wallyball', startNow: true, visibility: 0
        });
        assert.equal(duplicatePickup.status(), 409, await duplicatePickup.text());
        assert((await duplicatePickup.json()).matches.some(option => option.id === target && option.definitive));
        const reused = await post(secondOrganizer, '/api/pickup/sessions', {
            name: 'Second Pickup ' + token, venueId: target, sport: 'Wallyball', startNow: true, visibility: 0
        });
        assert.equal(reused.status(), 201, await reused.text());
        assert.equal(sql(`SELECT VenueId FROM dbo.PickupSession WHERE Id='${(await reused.json()).id}';`), String(target));
        const conflict = await save(variant);
        assert.equal(conflict.status(), 409, await conflict.text());
        const match = await conflict.json();
        assert.equal(match.code, 'facility-match');
        assert(match.matches.some(option => option.id === target && option.definitive));
        const filled = await post(admin, '/api/facilities/reviewed/' + target + '/fill-missing', variant);
        assert.equal(filled.status(), 200, await filled.text());
        assert.equal(sql(`SELECT Name FROM dbo.PickupVenue WHERE Id=${target};`), base.name);
        const alternate = await save({name: base.alternateName, alternateName: '', sourceKey: 'fixture:b:' + token});
        assert.equal(alternate.status(), 409, await alternate.text());
        assert((await alternate.json()).matches.some(option => option.id === target && option.definitive));
        const idCollision = await save({name: 'Different label ' + token, address: '470 Different Street'});
        assert.equal(idCollision.status(), 409);
        assert((await idCollision.json()).matches.some(option => option.reason === 'Same provider record'));

        const secondAddress = await save({address: '400 ' + token + ' Avenue', sourceKey: 'fixture:branch:' + token});
        assert.equal(secondAddress.status(), 200, await secondAddress.text());
        const branch = (await secondAddress.json()).id;
        const editing = await admin.request.put(origin + '/api/facilities/reviewed/' + branch, {
            headers: {Origin: origin}, data: {...variant, sourceKey: ''}
        });
        assert.equal(editing.status(), 409, await editing.text());

        const otherBusiness = {name: 'Fixture Fitness Annex ' + token, alternateName: '', sourceKey: 'fixture:other:' + token};
        const shared = await save(otherBusiness);
        assert.equal(shared.status(), 409, await shared.text());
        assert.equal((await shared.json()).canReviewDistinct, true);
        const allowed = await save({...otherBusiness, distinctReviewed: true});
        assert.equal(allowed.status(), 200, await allowed.text());
        const approximate = await save({name: 'Different Approximate Fixture ' + token, alternateName: '', address: '',
            sourceKey: 'fixture:approx:' + token, website: ''});
        assert.equal(approximate.status(), 200, await approximate.text());

        const simultaneous = {name: 'Race Facility ' + token, alternateName: '', address: '602 ' + token + ' Road'};
        const results = await Promise.all([save({...simultaneous, sourceKey: 'fixture:race-1:' + token}),
            save({...simultaneous, sourceKey: 'fixture:race-2:' + token})]);
        assert.deepEqual(results.map(result => result.status()).sort(), [200, 409]);

        const hidden = await post(admin, '/api/pickup/sessions', {name: 'Private hidden ' + token, sport: 'Wallyball',
            venue: 'Invisible identity ' + token, city: 'Roseville', region: 'MI', postalCode: '48066',
            timeZone: base.timeZone, startNow: true, visibility: 2});
        assert.equal(hidden.status(), 201, await hidden.text());
        const hiddenMatch = await organizer.request.get(origin + '/api/facilities/matches', {params: {
            name: 'Invisible identity ' + token, city: 'Roseville', region: 'MI'
        }});
        assert.equal((await hiddenMatch.json()).matches.length, 0);
        assert.equal((await guest.request.get(origin + '/api/facilities/duplicate-audit')).status(), 401);

        const retired = (await allowed.json()).id;
        const sourceSession = (await hidden.json()).id;
        sql(`UPDATE dbo.PickupSession SET VenueId=${retired} WHERE Id='${sourceSession}';
            INSERT dbo.PickupGameSet(Id,SessionId,Number,CreatedUtc,Version,BoardJson,ScoresJson)
            VALUES(NEWID(),'${sourceSession}',1,SYSUTCDATETIME(),1,N'{}',(SELECT 21 AS [first],17 AS [second] FOR JSON PATH));`);
        const eventIds = [];
        for (const type of [1, 2]) {
            const created = await post(admin, '/api/ScrambleData/AddNewLeague/' + encodeURIComponent('Merge Event ' + type + ' ' + token) +
                '?venueId=' + retired + '&eventTypeId=' + type + (type === 2 ? '&eventDate=2026-12-18' : ''), []);
            assert.equal(created.status(), 200, await created.text());
            eventIds.push((await created.json()).id);
        }
        const audit = await admin.request.get(origin + '/api/facilities/duplicate-audit');
        assert.equal(audit.status(), 200, await audit.text());
        assert((await audit.json()).some(pair => pair.facilities.some(row => row.id === retired && row.events.length === 2)));
        const plan = {sourceVenueId: retired, targetVenueId: target, confirmation: 'Merge ' + retired + ' into ' + target};
        assert.equal((await post(organizer, '/api/facilities/merge', plan)).status(), 403);
        assert.equal((await post(admin, '/api/facilities/merge', {...plan, confirmation: ''})).status(), 400);
        const merge = await post(admin, '/api/facilities/merge', plan);
        assert.equal(merge.status(), 200, await merge.text());
        assert.deepEqual(await merge.json(), {id: target, pickupSessionsMoved: 1, eventsMoved: 2});
        assert.equal(sql(`SELECT VenueId FROM dbo.PickupSession WHERE Id='${sourceSession}';`), String(target));
        assert.equal(sql(`SELECT ScoresJson FROM dbo.PickupGameSet WHERE SessionId='${sourceSession}';`), '[{"first":21,"second":17}]');
        assert.equal(sql(`SELECT COUNT(*) FROM dbo.EventFacility WHERE VenueId=${target} AND LeagueId IN (${eventIds.join(',')});`), '2');
        assert.equal(sql(`SELECT VenueId FROM dbo.FacilityProviderIdentity WHERE SourceKey=N'fixture:other:${token}';`), String(target));
        assert.equal(sql(`SELECT COUNT(*) FROM dbo.FacilityMerge WHERE SourceVenueId=${retired} AND TargetVenueId=${target};`), '1');
        const aliasSearch = await guest.request.get(origin + '/api/facilities', {params: {q: otherBusiness.name}});
        assert((await aliasSearch.json()).facilities.some(facility => facility.id === target));
        assert.equal(sql(`SELECT COUNT(*) FROM dbo.UserLeague l JOIN dbo.[User] u ON u.UserId=l.UserId
            WHERE u.Email=N'${organizerEmail}' AND l.LeagueTypeId IN (${eventIds.join(',')});`), '0');

        const page = await admin.newPage();
        await page.goto(origin + '/facilities');
        await page.getByText('Review or Import a Facility', {exact: true}).click();
        const review = page.getByRole('heading', {name: 'Reviewed Facility Details'}).locator('..');
        await review.getByLabel('Facility name', {exact: true}).fill(base.name);
        await review.getByLabel('City', {exact: true}).fill('Roseville');
        await review.getByLabel('State', {exact: true}).fill('MI');
        const matches = review.getByRole('region', {name: 'Possible existing facilities'});
        await expect(matches.getByText(base.name, {exact: true}).first()).toBeVisible();
        const record = matches.locator('article').filter({has: page.getByText(base.name, {exact: true})}).first();
        await record.getByRole('button', {name: 'Review Differences'}).click();
        await expect(record.getByText('Existing record', {exact: true})).toBeVisible();
        await record.getByRole('button', {name: 'Use Existing Facility'}).click();
        await expect(page).toHaveURL(origin + '/facilities/' + target);
        const read = async id => (await (await admin.request.get(origin + '/api/facilities/' + id)).json()).facility;
        const saved = await read(target);
        const editor = page.locator('.facility-editor');
        await editor.getByText('Edit Facility', {exact:true}).click();
        const editorForm = editor.getByRole('heading', {name:'Reviewed Facility Details'}).locator('..');
        const name = editorForm.getByLabel('Facility name', {exact:true});
        await expect(name).toHaveValue(saved.name);
        for (const [theme, width, height] of [['classic',1920,1080], ['soft-light',2560,1440],
            ['navy',1366,768], ['charcoal',768,1024], ['soft-light',390,844]]) {
            await page.setViewportSize({width,height});
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            expect(await editor.locator('.editor-grid').first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length))
                .toBe(width >= 720 ? 6 : 1);
            expect((await editor.boundingBox()).width).toBeLessThanOrEqual(Math.min(width,1057));
            if (width >= 1366) expect((await editor.boundingBox()).width).toBeGreaterThanOrEqual(1000);
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
        await name.fill('Discarded Facility Name ' + token);
        await editorForm.getByRole('button',{name:'Cancel',exact:true}).click();
        const discard = page.getByRole('alertdialog');
        await expect(discard.getByRole('heading',{name:'Discard facility changes?'})).toBeVisible();
        await discard.getByRole('button',{name:'Discard Changes'}).click();
        await expect(editor).not.toHaveAttribute('open','');
        assert.deepEqual(await read(target), saved);
        await editor.getByText('Edit Facility',{exact:true}).click();
        await expect(name).toHaveValue(saved.name);

        const advanced = editor.locator('details.advanced');
        await expect(advanced).not.toHaveAttribute('open','');
        await editorForm.getByRole('button',{name:'Save Facility',exact:true}).click();
        await expect(advanced).toHaveAttribute('open','');
        await expect(advanced.getByText('Confirm that you reviewed the details.',{exact:true})).toBeVisible();
        await advanced.getByLabel('Latitude', {exact:true}).fill('42.541');
        await advanced.getByLabel('Longitude', {exact:true}).fill('-82.907');
        await advanced.getByLabel('Verification source', {exact:true}).fill('Updated fixture source');
        await advanced.getByLabel('Location is approximate').check();
        await advanced.getByLabel(/I reviewed these details/).check();
        const updatedName = 'Updated Fixture Sports Center ' + token;
        await name.fill(updatedName);
        await editorForm.getByRole('button',{name:'Save Facility',exact:true}).click();
        await expect(editor.getByText('Facility saved.',{exact:true})).toBeVisible();
        await expect(page.getByRole('heading',{level:1,name:updatedName})).toBeVisible();
        const updated = await read(target);
        assert.equal(updated.name, updatedName);
        assert.equal(updated.id, target);
        assert.equal(updated.latitude, 42.541);
        assert.equal(updated.longitude, -82.907);
        assert.equal(updated.approximateCoordinates, true);
        assert.equal(updated.source, 'Updated fixture source');
        assert.equal(sql(`SELECT COUNT(*) FROM dbo.EventFacility WHERE VenueId=${target} AND LeagueId IN (${eventIds.join(',')});`), '2');
        assert.equal(sql(`SELECT VenueId FROM dbo.PickupSession WHERE Id='${session}';`), String(target));
        const unauthorized = await guest.newPage();
        await unauthorized.goto(origin + '/facilities/' + target);
        await expect(unauthorized.getByRole('heading',{level:1,name:updatedName})).toBeVisible();
        await expect(unauthorized.getByText('Edit Facility',{exact:true})).toHaveCount(0);
        await unauthorized.close();

        await page.goto(origin + '/facilities?view=manage');
        const candidate = {...base, name:'Reviewed Import ' + token, address:'64 New Fixture Court ' + token,
            source:'Fixture public lookup', sourceKey:'fixture:import:' + token, activities:[]};
        await page.route('**/api/facilities/lookup?*', route => route.fulfill({json:[candidate]}));
        await page.getByRole('button',{name:'Search Public Source'}).click();
        await page.getByRole('button',{name:'Review ' + candidate.name}).click();
        const importForm = page.getByRole('heading', {name:'Reviewed Facility Details'}).locator('..');
        await expect(importForm.getByLabel('Facility name',{exact:true})).toHaveValue(candidate.name);
        await page.getByText('Advanced Location and Verification',{exact:true}).click();
        await page.getByLabel(/I reviewed these details/).check();
        await page.getByRole('button',{name:'Save Reviewed Facility'}).click();
        await expect(page.getByRole('heading',{level:1,name:candidate.name})).toBeVisible();
        console.log('Responsive facility editor, cancellation, advanced validation, association safety and reviewed import passed.');
        console.log('Facility duplicate audit, canonical identifiers, shared addresses, concurrent writes, review UI and transactional merges passed.');
    } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });

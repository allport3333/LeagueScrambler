const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {chromium, expect} = require('@playwright/test');
const {withPickupTestHost} = require('../helpers/pickup-test-host.cjs');

const token = crypto.randomBytes(5).toString('hex');
async function api(page, endpoint, method = 'GET', body) {
    return page.evaluate(async ({endpoint, method, body}) => {
        const result = await fetch(endpoint, {method, headers: body ? {'Content-Type': 'application/json'} : {},
            body: body ? JSON.stringify(body) : undefined});
        const raw = await result.text();
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        return {status: result.status, data};
    }, {endpoint, method, body});
}

withPickupTestHost(async origin => {
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        async function open(role, width = 1440) {
            const ctx = await browser.newContext({ignoreHTTPSErrors: true, viewport: {width, height: 850}, serviceWorkers: 'block'});
            const probe = await ctx.request.get(origin + '/api/pickup/catalog');
            assert.equal(probe.headers()['x-pickup-test-database'], 'LeagueScramblerPickupTest');
            const page = await ctx.newPage();
            await page.goto(origin + '/pickup');
            if (role) {
                assert.equal((await api(page, '/api/login/register', 'POST', {
                    email: role + '-' + token + '@example.invalid', password: crypto.randomBytes(20).toString('hex'),
                    firstName: role, lastName: token
                })).status, 200);
                await page.reload();
            }
            return page;
        }

        const organizer = await open('WorkspaceOrganizer');
        // Give the selector deterministic league and tournament metadata without seeding formal event records.
        await organizer.route('**/api/Login/getuserleagues', route => route.fulfill({json: [
            {id: 900001, leagueName: 'Fixture League', eventTypeId: 1},
            {id: 900002, leagueName: 'Fixture Tournament', eventTypeId: 2, canViewTournamentRounds: true}
        ]}));
        const player = await open('SelectedPlayer', 390);
        const outsider = await open(null);
        const claim = await api(player, '/api/scrambledata/CreateAndClaimPlayer', 'POST', {
            firstName: 'SelectedPlayer', lastName: token, gender: 'Male'
        });
        assert.equal(claim.status, 200);
        async function create(label) {
            const result = await api(organizer, '/api/pickup/sessions', 'POST', {
                name: label + ' ' + token, sport: 'Wallyball', venue: 'Workspace Fixture Venue', city: 'Fixtureville',
                timeZone: 'America/New_York', startNow: true, visibility: 0
            });
            assert.equal(result.status, 201, JSON.stringify(result));
            const id = result.data.id;
            return {url: origin + '/pickup/' + id, api: '/api/pickup/sessions/' + id};
        }
        const session = await create('Workspace');
        await organizer.reload();
        await expect(organizer.locator('#leagueDropdown')).toContainText('Fixture League');
        const savedLeague = () => organizer.evaluate(() => sessionStorage.getItem('league-hub-selected-league'));
        assert.equal(await savedLeague(), '900001');
        await organizer.locator('#leagueDropdown').click();
        await organizer.getByRole('button', {name: /Pickup Sessions/}).click();
        await organizer.getByRole('dialog').getByRole('button', {name: 'Workspace ' + token}).click();
        await expect(organizer).toHaveURL(session.url);
        await expect(organizer.getByText('No players have joined yet.')).toBeVisible();
        assert.equal(await savedLeague(), '900001');
        await organizer.locator('#leagueDropdown').click();
        await expect(organizer.getByRole('button', {name: /Pickup Sessions/})).toBeVisible();
        await expect(organizer.getByRole('dialog').getByRole('button', {name: 'Workspace ' + token})).toBeVisible();
        await organizer.keyboard.press('Escape');
        await organizer.getByRole('button', {name: 'Add Players'}).click();
        await organizer.getByLabel('Find existing players').fill(token);
        await organizer.getByLabel('Find existing players').press('Enter');
        await organizer.getByLabel('SelectedPlayer ' + token).check();
        await organizer.getByRole('button', {name: 'Add Selected (1)'}).click();
        await expect(organizer.getByText('SelectedPlayer ' + token + ' · Confirmed · Playing')).toBeVisible();
        for (let i = 1; i <= 7; i++) {
            assert.equal((await api(organizer, session.api + '/players', 'POST', {guestName: 'Walk-in ' + i})).status, 204);
        }
        await organizer.reload();
        await organizer.getByRole('button', {name: 'Start Playing'}).click();
        await expect(organizer.getByText('In Progress', {exact: true})).toBeVisible();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 not playing'}).click();
        await expect(organizer.getByText('Walk-in 7 · Confirmed · Not Playing')).toBeVisible();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 playing'}).click();
        await expect(organizer.getByText('Walk-in 7 · Confirmed · Playing')).toBeVisible();

        await organizer.getByRole('button', {name: 'Scramble Teams', exact: true}).click();
        await organizer.getByLabel('Games per matchup').fill('3');
        await organizer.getByLabel('Watch the Scramble').check();
        await organizer.getByRole('button', {name: 'Generate Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Skip Animation'}).click();
        await organizer.getByRole('button', {name: 'Review Proposed Teams'}).click();
        await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: 'Game Set 1'})).toBeVisible();
        await expect(organizer.getByText('Unscored')).toBeVisible();

        const original = (await api(organizer, session.api + '/workspace')).data;
        const set = original.sets[0];
        assert.deepEqual(set.board.teams.map(t => t.length), [4, 4]);
        assert.equal(new Set(set.board.teams.flat().map(p => p.id)).size, 8);
        assert.equal(original.gamesPlayed, 0);
        await organizer.getByRole('button', {name: 'Enter Scores'}).click();
        await organizer.getByLabel('Team 1 score').first().fill('21');
        await organizer.getByLabel('Team 2 score').first().fill('17');
        await organizer.getByRole('button', {name: 'Save Scores'}).click();
        await expect(organizer.getByText('Game 1 · 21 – 17')).toBeVisible();
        const scored = (await api(organizer, session.api + '/workspace')).data.sets[0];
        assert.deepEqual(scored.scores, [{matchup: 1, game: 1, first: 21, second: 17}]);
        assert.equal((await api(organizer, session.api + '/sets/' + set.id + '/scores', 'PUT', {version: set.version, scores: []})).status, 409);
        const layout = set.board.teams.map(t => t.map(p => p.id));
        assert.equal((await api(organizer, session.api + '/sets/' + set.id + '/teams', 'PUT', {version: scored.version, teams: layout})).status, 409);

        await player.goto(session.url);
        await expect(player.getByText('Your registration: Confirmed')).toBeVisible();
        await player.getByRole('button', {name: 'Game Set 1'}).click();
        await expect(player.getByText(/Your assignment: Team/)).toBeVisible();
        await expect(player.getByRole('button', {name: 'Edit Scores'})).toHaveCount(0);
        assert(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal((await api(player, session.api + '/lifecycle', 'POST', {complete: true})).status, 404);
        assert.equal((await api(outsider, session.api + '/workspace')).data.sets, null);

        await organizer.setViewportSize({width: 390, height: 850});
        await organizer.getByRole('button', {name: 'Players', exact: true}).click();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 not playing'}).click();
        await expect(organizer.getByText('Walk-in 7 · Confirmed · Not Playing')).toBeVisible();
        await organizer.getByRole('button', {name: 'Scramble Teams', exact: true}).click();
        await organizer.getByLabel('Watch the Scramble').uncheck();
        await organizer.getByLabel('Previous pickup teammates').selectOption('minimize');
        await organizer.getByRole('button', {name: 'Generate Next Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: 'Game Set 2'})).toBeVisible();
        const later = (await api(organizer, session.api + '/workspace')).data;
        assert.deepEqual(later.sets[0], scored);
        assert.equal(later.sets[1].scores.length, 0);
        assert(await organizer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(later.sets[1].board.teams.flat().length + later.sets[1].board.byes.length, 7);
        assert(![...later.sets[1].board.teams.flat(), ...later.sets[1].board.byes].some(p => p.name === 'Walk-in 7'));
        const second = later.sets[1];
        const secondCard = organizer.locator('.game-set').filter({has: organizer.getByRole('button', {name: 'Game Set 2'})});
        await secondCard.getByRole('button', {name: 'Manage Teams'}).click();
        const movedPlayer = second.board.teams[0].at(-1);
        await secondCard.getByLabel('Assigned team for ' + movedPlayer.name, {exact: true}).selectOption('1');
        await secondCard.getByRole('button', {name: 'Save Team Changes'}).click();
        await expect(secondCard.getByRole('button', {name: 'Save Team Changes'})).toHaveCount(0);
        const edited = (await api(organizer, session.api + '/workspace')).data.sets[1];
        assert(edited.board.teams[1].some(p => p.id === movedPlayer.id));
        assert(!edited.board.teams[0].some(p => p.id === movedPlayer.id));

        await organizer.getByRole('button', {name: 'Session Settings'}).click();
        await organizer.getByRole('button', {name: 'Complete Session'}).click();
        await organizer.getByRole('button', {name: 'Confirm Completion'}).click();
        await expect(organizer.getByText('Completed', {exact: true})).toBeVisible();
        await organizer.reload();
        assert.equal((await api(organizer, session.api + '/workspace')).data.gameSets, 2);
        await organizer.locator('#leagueDropdown').click();
        await organizer.getByRole('dialog').getByRole('button', {name: /^Leagues/}).click();
        await organizer.getByRole('dialog').getByRole('button', {name: 'Fixture League'}).click();
        await expect(organizer).toHaveURL(/league-dashboard\?leagueId=900001/);
        assert.equal(await savedLeague(), '900001');
        await organizer.goto(session.url);
        await expect(organizer.locator('#leagueDropdown')).toContainText('Workspace ' + token);
        assert.equal(await savedLeague(), '900001');
        const unscored = await create('Unscored');
        for (const guestName of ['First unscored guest', 'Second unscored guest']) {
            assert.equal((await api(organizer, unscored.api + '/players', 'POST', {guestName})).status, 204);
        }
        await organizer.goto(unscored.url);
        await organizer.getByRole('button', {name: 'Scramble Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Generate Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: 'Game Set 1'})).toBeVisible();
        assert.equal((await api(organizer, unscored.api + '/lifecycle', 'POST', {complete: true})).status, 204);
        const history = (await api(organizer, unscored.api + '/workspace')).data;
        assert.equal(history.gameSets, 1);
        assert.equal(history.gamesPlayed, 0);
        assert.equal(history.sets[0].board.teams.flat().length, 2);

        const casual = await create('Casual');
        assert.equal((await api(organizer, casual.api + '/lifecycle', 'POST', {complete: true})).status, 204);
        assert.equal((await api(organizer, casual.api + '/workspace')).data.gameSets, 0);
        assert.equal((await api(organizer, casual.api)).data.state, 3);
        console.log('Pickup workspace checks passed for generation, attendance, playback, scoring, permissions and lifecycle.');
    } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });

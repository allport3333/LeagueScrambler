const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
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
        async function create(label, overrides = {}) {
            const result = await api(organizer, '/api/pickup/sessions', 'POST', {
                name: label + ' ' + token, sport: 'Wallyball', venue: 'Workspace Fixture Venue', city: 'Fixtureville',
                timeZone: 'America/New_York', startNow: true, visibility: 0, ...overrides
            });
            assert.equal(result.status, 201, JSON.stringify(result));
            const id = result.data.id;
            return {url: origin + '/pickup/' + id, api: '/api/pickup/sessions/' + id};
        }
        const screenshots = path.join(os.tmpdir(), 'leaguehub-pickup-workspace');
        await fs.mkdir(screenshots, {recursive: true});
        async function checkLayout(count, width, theme) {
            await organizer.setViewportSize({width, height: 850});
            await organizer.evaluate(theme => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme === 'classic' ? 'light' : 'dark';
            }, theme);
            if (width < 480) await expect(organizer.locator('.drawer-toggle')).toBeVisible();
            await expect(organizer.locator('.player-line')).toHaveCount(count);
            const layout = await organizer.locator('.eligibility-choice').evaluate(label => {
                const title = label.querySelector('strong');
                const input = label.querySelector('input');
                const range = document.createRange();
                range.selectNodeContents(title);
                const titleRects = Array.from(range.getClientRects());
                const button = label.previousElementSibling.querySelector('button');
                const computed = [title, title.parentElement, input, label, label.parentElement, label.parentElement.parentElement].map(node => {
                    const style = getComputedStyle(node);
                    return [node.tagName, node.className, node.getBoundingClientRect().width, style.display, style.width, style.minWidth, style.maxWidth, style.flex, style.wordBreak];
                });
                return {computed, height: label.getBoundingClientRect().height, titleLines: titleRects.length,
                    checkboxOffset: titleRects[0].left - input.getBoundingClientRect().right,
                    buttonOffset: label.getBoundingClientRect().top - button.getBoundingClientRect().bottom,
                    overflows: document.documentElement.scrollWidth > innerWidth,
                    outside: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && el.getBoundingClientRect().height).slice(0, 12).map(el => [el.tagName, el.className, el.getBoundingClientRect().right])};
            });
            assert(layout.height < 100 && layout.titleLines <= 2 && layout.checkboxOffset >= 2 &&
                layout.buttonOffset < 65 && !layout.overflows, JSON.stringify({width, theme, count, layout}));
            await organizer.screenshot({path: path.join(screenshots, [count, width, theme].join('-') + '.png')});
        }

        const session = await create('Workspace');
        await organizer.goto(origin + '/');
        await expect(organizer.locator('#leagueDropdown')).toContainText('Fixture League');
        const savedLeague = () => organizer.evaluate(() => sessionStorage.getItem('league-hub-selected-league'));
        assert.equal(await savedLeague(), '900001');
        const selector = organizer.locator('#leagueDropdown');
        const menu = organizer.getByRole('dialog', {name: 'Select league or event'});
        async function openPickupMenu() {
            await selector.click();
            const pickup = menu.getByRole('button', {name: 'Pickup Games'});
            if (await pickup.getAttribute('aria-expanded') !== 'true') await pickup.click();
        }
        await selector.click();
        await menu.getByRole('button', {name: /^Tournaments/}).click();
        await expect(menu.getByRole('link', {name: 'Manage Tournaments'})).toHaveAttribute('href', '/tournament');
        await expect(menu.getByRole('link', {name: 'Create Tournament'})).toHaveAttribute('href', '/tournament?view=create');
        await menu.getByRole('link', {name: 'Manage Tournaments'}).click();
        await expect(organizer).toHaveURL(origin + '/tournament');
        await selector.click();
        await menu.getByRole('button', {name: /^Tournaments/}).click();
        await menu.getByRole('link', {name: 'Create Tournament'}).click();
        await expect(organizer).toHaveURL(origin + '/tournament?view=create');
        await expect(organizer.locator('.desktop-navigation').getByText('Pickup Games')).toHaveCount(0);
        await openPickupMenu();
        await expect(menu.getByRole('link', {name: 'Pickup Games'})).toHaveCount(1);
        await expect(menu.getByText('Workspace ' + token)).toHaveCount(0);
        await menu.getByRole('link', {name: 'Create Pickup Game'}).click();
        await expect(organizer.getByRole('heading', {name: 'Create a Pickup Game'})).toBeVisible();
        await openPickupMenu();
        await menu.getByRole('link', {name: 'My Pickup Sessions'}).click();
        await organizer.getByRole('link', {name: 'Workspace ' + token, exact: true}).click();
        await expect(organizer.getByText('No players have joined yet.')).toBeVisible();
        assert.equal(await savedLeague(), '900001');
        await checkLayout(0, 1920, 'classic');
        await checkLayout(0, 1366, 'classic');
        await expect(selector).toContainText('Pickup Games');
        await expect(organizer.getByRole('navigation', {name: 'Main navigation'}).getByText('League Dashboard')).toHaveCount(0);
        await organizer.getByRole('button', {name: 'Add Players'}).click();
        const browserDialog = organizer.getByRole('dialog').filter({hasText: 'Add Existing Players'});
        await expect(browserDialog.locator('.available-player').first()).toBeVisible();
        await browserDialog.getByRole('button', {name: 'Women', exact: true}).click();
        await expect(browserDialog.locator('.available-player').filter({hasText: 'SelectedPlayer ' + token})).toHaveCount(0);
        await browserDialog.getByRole('button', {name: 'Men', exact: true}).click();
        await browserDialog.getByRole('textbox', {name: 'Search players'}).fill(token);
        const selectedCard = browserDialog.locator('.available-player').filter({hasText: 'SelectedPlayer ' + token});
        await selectedCard.click();
        await expect(selectedCard).toBeDisabled();
        await expect(selectedCard).toContainText('Already Added');
        await browserDialog.getByRole('button', {name: 'Close player browser'}).click();
        await expect(organizer.locator('.player-line').filter({hasText: 'SelectedPlayer ' + token}).getByText('Playing', {exact: true})).toBeVisible();
        for (let i = 1; i <= 7; i++) {
            assert.equal((await api(organizer, session.api + '/players', 'POST', {guestName: 'Walk-in ' + i})).status, 204);
        }
        await organizer.reload();
        await organizer.getByRole('button', {name: 'Start Playing'}).click();
        await expect(organizer.getByText('In Progress', {exact: true})).toBeVisible();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 not playing'}).click();
        await expect(organizer.locator('.player-line').filter({hasText: 'Walk-in 7'}).getByText('Not Playing', {exact: true})).toBeVisible();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 playing'}).click();
        await expect(organizer.locator('.player-line').filter({hasText: 'Walk-in 7'}).getByText('Playing', {exact: true})).toBeVisible();

        await organizer.getByRole('button', {name: 'Scramble Teams', exact: true}).click();
        await organizer.getByLabel('Games per matchup').fill('3');
        await organizer.getByLabel('Watch the Scramble').check();
        await organizer.getByRole('button', {name: 'Generate Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Skip Animation'}).click();
        await organizer.getByRole('button', {name: 'Review Proposed Teams'}).click();
        await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: /^Game Set 1/})).toBeVisible();
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
        await player.getByRole('button', {name: /^Game Set 1/}).click();
        await expect(player.getByText(/Your assignment: Team/)).toBeVisible();
        await expect(player.getByRole('button', {name: 'Edit Scores'})).toHaveCount(0);
        assert(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal((await api(player, session.api + '/lifecycle', 'POST', {complete: true})).status, 404);
        assert.equal((await api(outsider, session.api + '/workspace')).data.sets, null);

        await organizer.setViewportSize({width: 390, height: 850});
        await organizer.getByRole('button', {name: 'Players', exact: true}).click();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 not playing'}).click();
        await expect(organizer.locator('.player-line').filter({hasText: 'Walk-in 7'}).getByText('Not Playing', {exact: true})).toBeVisible();
        await organizer.getByRole('button', {name: 'Scramble Teams', exact: true}).click();
        await organizer.getByLabel('Watch the Scramble').uncheck();
        await organizer.getByLabel('Previous pickup teammates').selectOption('minimize');
        await organizer.getByRole('button', {name: 'Generate Next Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: /^Game Set 2/})).toBeVisible();
        const later = (await api(organizer, session.api + '/workspace')).data;
        assert.deepEqual(later.sets[0], scored);
        assert.equal(later.sets[1].scores.length, 0);
        assert(await organizer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await openPickupMenu();
        await menu.getByRole('link', {name: 'Pickup Games', exact: true}).click();
        await expect(organizer.getByRole('link', {name: /Continue Pickup Session/})).toBeVisible();
        await openPickupMenu();
        await menu.getByRole('link', {name: 'Continue Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: 'Teams & Scores'})).toHaveAttribute('aria-pressed', 'true');
        await organizer.getByRole('button', {name: /Game Set 2/}).click();
        assert.equal(later.sets[1].board.teams.flat().length + later.sets[1].board.byes.length, 7);
        assert(![...later.sets[1].board.teams.flat(), ...later.sets[1].board.byes].some(p => p.name === 'Walk-in 7'));
        const second = later.sets[1];
        const secondCard = organizer.locator('.game-set').filter({has: organizer.getByRole('button', {name: /^Game Set 2/})});
        await secondCard.getByRole('button', {name: 'Manage Teams'}).click();
        const movedPlayer = second.board.teams[0].at(-1);
        await secondCard.getByLabel('Assigned team for ' + movedPlayer.name, {exact: true}).selectOption('1');
        await secondCard.getByRole('button', {name: 'Save Team Changes'}).click();
        await expect(secondCard.getByRole('button', {name: 'Save Team Changes'})).toHaveCount(0);
        const edited = (await api(organizer, session.api + '/workspace')).data.sets[1];
        assert(edited.board.teams[1].some(p => p.id === movedPlayer.id));
        assert(!edited.board.teams[0].some(p => p.id === movedPlayer.id));

        await organizer.getByRole('button', {name: 'Session Settings'}).click();
        await organizer.getByRole('button', {name: 'Cancel Session', exact: true}).click();
        const cancel = organizer.getByRole('alertdialog');
        await expect(cancel.getByText('Cancel Pickup Session?')).toBeVisible();
        assert.equal((await api(organizer, session.api)).data.state, 2);
        await cancel.getByRole('button', {name: 'Cancel Session'}).click();
        await expect(organizer.getByText('Session cancelled. Previous registrations are preserved.')).toBeVisible();
        assert.equal((await api(player, session.api + '/reopen', 'POST', {})).status, 404);
        await organizer.getByRole('button', {name: 'Reopen Session', exact: true}).click();
        await organizer.getByRole('alertdialog').getByRole('button', {name: 'Reopen Session'}).click();
        await expect(organizer.getByText('Published', {exact: true})).toBeVisible();
        assert.deepEqual((await api(organizer, session.api + '/workspace')).data.sets[0], scored);
        await organizer.getByRole('button', {name: 'Start Playing', exact: true}).click();
        await expect(organizer.getByText('In Progress', {exact: true})).toBeVisible();
        await organizer.getByRole('button', {name: 'Complete Session', exact: true}).click();
        await organizer.getByRole('alertdialog').getByRole('button', {name: 'Complete Session'}).click();
        await expect(organizer.getByText('Completed', {exact: true})).toBeVisible();
        await organizer.reload();
        assert.equal((await api(organizer, session.api + '/workspace')).data.gameSets, 2);
        await selector.click();
        await menu.getByRole('button', {name: /^Leagues/}).click();
        await menu.getByRole('button', {name: 'Fixture League'}).click();
        await expect(organizer).toHaveURL(origin + '/league-dashboard?leagueId=900001');
        assert.equal(await savedLeague(), '900001');
        await organizer.goto(session.url);
        await expect(organizer.locator('#leagueDropdown')).toContainText('Pickup Games');
        assert.equal(await savedLeague(), '900001');
        const unscored = await create('Unscored');
        for (const guestName of ['First unscored guest', 'Second unscored guest']) {
            assert.equal((await api(organizer, unscored.api + '/players', 'POST', {guestName})).status, 204);
        }
        await organizer.goto(unscored.url);
        await checkLayout(2, 768, 'navy');
        await checkLayout(2, 390, 'charcoal');
        await organizer.getByRole('button', {name: 'Scramble Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Generate Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: /^Game Set 1/})).toBeVisible();
        assert.equal((await api(organizer, unscored.api + '/lifecycle', 'POST', {complete: true})).status, 204);
        const history = (await api(organizer, unscored.api + '/workspace')).data;
        assert.equal(history.gameSets, 1);
        assert.equal(history.gamesPlayed, 0);
        assert.equal(history.sets[0].board.teams.flat().length, 2);

        const casual = await create('Casual');
        assert.equal((await api(organizer, casual.api + '/lifecycle', 'POST', {complete: true})).status, 204);
        assert.equal((await api(organizer, casual.api + '/workspace')).data.gameSets, 0);
        assert.equal((await api(organizer, casual.api)).data.state, 3);
        const expired = await create('Expired registration', {deadline: '2020-01-01T12:00'});
        assert.equal((await api(organizer, expired.api + '/cancel', 'POST', {})).status, 204);
        assert.equal((await api(organizer, expired.api + '/reopen', 'POST', {})).status, 400);
        await organizer.goto(expired.url);
        await organizer.getByRole('checkbox', {name: 'Start Now'}).check();
        await organizer.getByRole('button', {name: 'Reopen Session', exact: true}).click();
        await organizer.getByRole('alertdialog').getByRole('button', {name: 'Reopen Session'}).click();
        await expect(organizer.getByText('Published', {exact: true})).toBeVisible();
        assert.equal((await api(organizer, expired.api)).data.registrationOpen, true);
        assert.equal((await api(organizer, expired.api + '/cancel', 'POST', {})).status, 204);

        const large = await create('Layout');
        for (let i = 0; i < 21; i++) assert.equal(
            (await api(organizer, large.api + '/players', 'POST', {guestName: 'Layout player ' + i})).status, 204);
        await organizer.goto(large.url);
        await checkLayout(21, 1920, 'classic');
        await checkLayout(21, 1366, 'navy');
        await checkLayout(21, 768, 'charcoal');
        await checkLayout(21, 390, 'classic');
        assert.equal((await api(organizer, large.api + '/cancel', 'POST', {})).status, 204);
        console.log('Layout screenshots: ' + screenshots);
        console.log('Pickup workspace checks passed for generation, attendance, playback, scoring, permissions and lifecycle.');
    } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });

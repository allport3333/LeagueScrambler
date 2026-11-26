const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
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
            const ctx = await browser.newContext({ignoreHTTPSErrors: true, viewport: {width, height: 850}, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write']});
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
        async function checkPopup(message, dismiss = true) {
            const popup = organizer.locator('mat-snack-bar-container').filter({hasText: message});
            await expect(popup).toBeVisible();
            const offset = await popup.evaluate(el => {
                const r = el.getBoundingClientRect();
                return [Math.abs(r.x + r.width / 2 - innerWidth / 2), Math.abs(r.y + r.height / 2 - innerHeight / 2)];
            });
            assert(offset.every(value => value <= 2), JSON.stringify(offset));
            assert.equal(await organizer.locator('main > p.feedback').filter({hasText: message}).count(), 0);
            if (dismiss) {
                await popup.getByRole('button', {name: 'OK'}).click();
                await expect(popup).toHaveCount(0);
            } else {
                const started = Date.now();
                await expect(popup).toBeVisible();
                await expect(popup).toHaveCount(0, {timeout: 4500});
                assert(Date.now() - started >= 2300);
            }
        }

        async function checkLayout(count, width, theme) {
            await organizer.setViewportSize({width, height: 850});
            await organizer.evaluate(theme => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme === 'classic' ? 'light' : 'dark';
            }, theme);
            if (width < 480) await expect(organizer.locator('.drawer-toggle')).toBeVisible();
            await expect(organizer.locator('.player-line')).toHaveCount(count);
            const structure = await organizer.locator('.pickup-workspace-shell').evaluate(shell => {
                const border = el => parseFloat(getComputedStyle(el).borderTopWidth);
                const tabs = shell.querySelector('[role=tab][aria-selected=false]');
                const card = shell.querySelector('.player-line');
                return [border(shell), border(tabs), card ? border(card) : 1,
                    getComputedStyle(shell.querySelector('.pickup-roster')).gridTemplateColumns.split(' ').length];
            });
            assert(structure.slice(0, 3).every(width => width >= 1));
            if (count >= 12) assert(structure[3] >= (width >= 1366 ? 3 : 2), JSON.stringify({width, structure}));

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

        await organizer.goto(origin + '/');
        await expect(organizer.locator('#leagueDropdown')).toContainText('Fixture League');
        const savedLeague = () => organizer.evaluate(() => sessionStorage.getItem('league-hub-selected-league'));
        assert.equal(await savedLeague(), '900001');
        const selector = organizer.locator('#leagueDropdown');
        const menu = organizer.getByRole('dialog', {name: 'Select league or event'});
        async function openPickupMenu() {
            await selector.click();
            const pickup = menu.getByRole('button', {name: /^Pickup Games/});
            if (await pickup.getAttribute('aria-expanded') !== 'true') await pickup.click();
        }
        async function checkPickupActions(active = false) {
            const actions = menu.locator('#event-category-3 a');
            await expect(actions).toHaveText(active ?
                [/My Sessions/, /Find Pickup Games/, /Create Pickup Game/, /Continue Pickup Session/] :
                [/My Sessions/, /Find Pickup Games/, /Create Pickup Game/]);
            await expect(menu.getByRole('link', {name: 'Create Pickup Game'})).toHaveCSS('font-weight', active ? '400' : '650');
            if (active) await expect(menu.getByRole('link', {name: 'Continue Pickup Session'})).toHaveCSS('font-weight', '650');
        }
        await openPickupMenu();
        await checkPickupActions();
        await organizer.keyboard.press('Escape');
        await organizer.goto(origin + '/pickup/mine');
        await organizer.getByRole('link', {name: 'Home', exact: true}).click();
        await expect(organizer).toHaveURL(origin + '/?context=pickup');
        await expect(organizer.getByRole('heading', {name: 'Pickup Games', exact: true})).toBeVisible();
        await expect(organizer.locator('.public-game-action').getByRole('link', {name: 'Pickup Games', exact: true})).toHaveAttribute('href', '/pickup/find');
        await expect(organizer.locator('app-player-home-dashboard')).toHaveCount(0);
        const session = await create('Workspace');
        await selector.click();
        await menu.getByRole('button', {name: /^Tournaments/}).click();
        await expect(menu.getByRole('link', {name: 'Manage Tournaments'})).toHaveAttribute('href', '/tournament');
        for (const [width, theme] of [[1366, 'classic'], [390, 'navy'], [768, 'charcoal']]) {
            await organizer.setViewportSize({width, height: 850});
            await organizer.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            const sections = menu.locator('h2 > button.event-category');
            await expect(sections).toHaveCount(3);
            const styles = await sections.evaluateAll(rows => rows.map(row => {
                const style = getComputedStyle(row);
                return [style.fontSize, style.fontWeight, style.paddingLeft, style.paddingRight, style.minHeight,
                    style.borderBottomWidth, row.querySelectorAll('mat-icon').length, Boolean(row.querySelector('.event-count'))];
            }));
            for (const style of styles) assert.deepEqual(style, styles[0]);
            await menu.screenshot({path: path.join(screenshots, 'event-selector-' + theme + '.png')});
        }
        await organizer.setViewportSize({width: 1440, height: 850});
        await expect(menu.getByRole('link', {name: 'Create Tournament'})).toHaveAttribute('href', '/tournament?view=create');
        await menu.getByRole('link', {name: 'Manage Tournaments'}).click();
        await expect(organizer).toHaveURL(origin + '/tournament');
        await selector.click();
        await menu.getByRole('button', {name: /^Tournaments/}).click();
        await menu.getByRole('link', {name: 'Create Tournament'}).click();
        await expect(organizer).toHaveURL(origin + '/tournament?view=create');
        await expect(organizer.locator('.desktop-navigation').getByText('Pickup Games')).toHaveCount(0);
        await openPickupMenu();
        await expect(menu.getByRole('link', {name: 'Pickup Games', exact: true})).toHaveCount(0);
        await expect(menu.getByText('Workspace ' + token)).toHaveCount(0);
        await checkPickupActions(true);
        await menu.getByRole('link', {name: 'Create Pickup Game'}).click();
        await expect(organizer.getByText('You already have an active pickup session.', {exact: false})).toBeVisible();
        await expect(organizer.getByRole('link', {name: 'Continue Pickup Session'})).toHaveAttribute('href', session.url.replace(origin, ''));
        await openPickupMenu();
        await menu.getByRole('link', {name: 'My Sessions', exact: true}).click();
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
        await checkPopup('Player attendance updated.');
        await expect(organizer.locator('.player-line').filter({hasText: 'Walk-in 7'}).getByText('Not Playing', {exact: true})).toBeVisible();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 playing'}).click();
        await expect(organizer.locator('.player-line').filter({hasText: 'Walk-in 7'}).getByText('Playing', {exact: true})).toBeVisible();

        await organizer.getByRole('tab', {name: 'Scramble Teams', exact: true}).click();
        await organizer.getByLabel('Games per matchup').fill('3');
        await organizer.getByLabel('Watch the Scramble').check();
        await organizer.getByRole('button', {name: 'Generate Teams', exact: true}).click();
        await organizer.getByRole('button', {name: 'Skip Animation'}).click();
        await organizer.getByRole('button', {name: 'Review Proposed Teams'}).click();
        await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
        await expect(organizer.getByRole('button', {name: /^Game Set 1/})).toBeVisible();
        await checkPopup('Teams saved to this pickup session.');
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
        await player.locator('.drawer-toggle').click();
        await player.getByRole('link', {name: 'Home', exact: true}).click();
        await expect(player.getByRole('heading', {name: 'Workspace ' + token})).toBeVisible();
        await expect(player.getByRole('heading', {name: 'Game Set 1'})).toBeVisible();
        await expect(player.getByRole('link', {name: 'View Pickup Session'})).toBeVisible();
        await expect(player.getByRole('link', {name: 'Continue Pickup Session', exact: true})).toHaveCount(0);
        await player.goBack();
        await expect(player).toHaveURL(session.url);
        assert(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal((await api(player, session.api + '/lifecycle', 'POST', {complete: true})).status, 404);
        assert.equal((await api(outsider, session.api + '/workspace')).data.sets, null);

        await organizer.setViewportSize({width: 390, height: 850});
        await organizer.getByRole('tab', {name: 'Players', exact: true}).click();
        await organizer.getByRole('button', {name: 'Mark Walk-in 7 not playing'}).click();
        await expect(organizer.locator('.player-line').filter({hasText: 'Walk-in 7'}).getByText('Not Playing', {exact: true})).toBeVisible();
        await organizer.getByRole('tab', {name: 'Scramble Teams', exact: true}).click();
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
        await menu.getByRole('link', {name: 'Find Pickup Games', exact: true}).click();
        await organizer.goto(origin + '/pickup');
        await expect(organizer.getByRole('link', {name: /Continue Pickup Session/})).toBeVisible();
        await openPickupMenu();
        await checkPickupActions(true);
        await menu.getByRole('link', {name: 'Continue Pickup Session'}).click();
        await expect(organizer.getByRole('tab', {name: 'Teams & Scores'})).toHaveAttribute('aria-selected', 'true');
        const secondSetToggle = organizer.getByRole('button', {name: /Game Set 2/});
        await secondSetToggle.scrollIntoViewIfNeeded();
        await organizer.screenshot({path: path.join(screenshots, 'mobile-saved-sets.png')});
        await secondSetToggle.click({position: {x: 20, y: 18}});
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

        await organizer.getByRole('tab', {name: 'Session Settings'}).click();
        await organizer.getByRole('button', {name: 'Cancel Session', exact: true}).click();
        const cancel = organizer.getByRole('alertdialog');
        await expect(cancel.getByText('Cancel Pickup Session?')).toBeVisible();
        assert.equal((await api(organizer, session.api)).data.state, 2);
        await cancel.getByRole('button', {name: 'Cancel Session'}).click();
        await expect(organizer.getByText('Session cancelled. Previous registrations are preserved.')).toBeVisible();
        await openPickupMenu();
        await checkPickupActions();
        await organizer.keyboard.press('Escape');
        assert.equal((await api(player, session.api + '/reopen', 'POST', {})).status, 404);
        const attempts = await Promise.all([1, 2].map(i => api(organizer, '/api/pickup/sessions', 'POST', {
            name: 'Concurrent ' + i + ' ' + token, sport: 'Wallyball', venue: 'Workspace Fixture Venue',
            city: 'Fixtureville', timeZone: 'America/New_York', startNow: true
        })));
        assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
        const concurrentId = attempts.find(result => result.status === 201).data.id;
        assert.equal(attempts.find(result => result.status === 409).data.activeSessionId, concurrentId);
        assert.equal((await api(organizer, session.api + '/reopen', 'POST', {})).status, 409);
        const concurrentApi = '/api/pickup/sessions/' + concurrentId;
        const concurrent = (await api(organizer, concurrentApi)).data;
        assert.equal((await api(organizer, concurrentApi, 'DELETE', {name: concurrent.name})).status, 204);
        await organizer.getByRole('button', {name: 'Reopen Session', exact: true}).click();
        await organizer.getByRole('alertdialog').getByRole('button', {name: 'Reopen Session'}).click();
        await expect(organizer.getByText('Published', {exact: true})).toBeVisible();
        assert.deepEqual((await api(organizer, session.api + '/workspace')).data.sets[0], scored);
        await organizer.getByRole('button', {name: 'Start Playing', exact: true}).click();
        await expect(organizer.getByText('In Progress', {exact: true})).toBeVisible();
        await organizer.getByRole('button', {name: 'Complete Session', exact: true}).click();
        await organizer.getByRole('alertdialog').getByRole('button', {name: 'Complete Session'}).click();
        await expect(organizer.getByText('Completed', {exact: true})).toBeVisible();
        await openPickupMenu();
        await checkPickupActions();
        await organizer.keyboard.press('Escape');
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
        await organizer.setViewportSize({width: 1366, height: 850});
        await organizer.getByRole('link', {name: 'Home', exact: true}).click();
        await expect(organizer.getByRole('heading', {name: 'Workspace ' + token})).toBeVisible();
        await expect(organizer.getByText('Completed', {exact: true})).toBeVisible();
        await expect(organizer.locator('app-player-home-dashboard')).toHaveCount(0);
        await organizer.reload();
        await expect(organizer.getByRole('link', {name: 'View Session Results'})).toBeVisible();
        for (const [width, theme] of [[1366, 'classic'], [390, 'navy'], [768, 'charcoal']]) {
            await organizer.setViewportSize({width, height: 850});
            await organizer.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            if (width < 500) await expect(organizer.locator('.drawer-toggle')).toBeVisible();
            await expect.poll(() => organizer.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
            const surface = organizer.locator('.event-home');
            if (theme === 'classic') await expect(surface).toHaveCSS('background-color', 'rgb(255, 255, 255)');
            else await expect(surface).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
            await organizer.screenshot({path: path.join(screenshots, 'pickup-home-' + theme + '.png')});
        }
        await organizer.setViewportSize({width: 1366, height: 850});
        await organizer.getByRole('link', {name: 'View Session Results'}).click();
        await expect(organizer.getByRole('tab', {name: 'Teams & Scores'})).toHaveAttribute('aria-selected', 'true');
        const name = 'Workspace ' + token;
        assert.equal((await api(player, session.api, 'DELETE', {name})).status, 404);
        assert.equal((await api(organizer, session.api, 'DELETE', {name: 'wrong'})).status, 409);
        await organizer.getByRole('tab', {name: 'Session Settings'}).click();
        await organizer.getByRole('button', {name: 'Delete Pickup Session'}).click();
        const deletion = organizer.getByRole('alertdialog');
        await expect(deletion.getByRole('heading', {name: 'Permanently Delete Pickup Session?'})).toBeVisible();
        await expect(deletion.locator('dt').filter({hasText: 'Recorded scores'}).locator('..').locator('dd')).toHaveText('Yes');
        await expect(deletion.getByRole('button', {name: 'Permanently Delete'})).toBeDisabled();
        await deletion.getByRole('button', {name: 'Keep Session'}).click();
        assert.equal((await api(organizer, session.api + '/workspace')).data.gameSets, 2);
        await organizer.getByRole('button', {name: 'Delete Pickup Session'}).click();
        await deletion.getByRole('textbox').fill(name);
        await deletion.getByRole('button', {name: 'Permanently Delete'}).click();
        await expect(organizer).toHaveURL(origin + '/pickup/mine');
        await checkPopup('Pickup session deleted.');
        await expect(organizer.getByRole('link', {name, exact: true})).toHaveCount(0);
        assert.equal((await api(organizer, session.api)).status, 404);
        assert.equal((await api(organizer, session.api + '/reopen', 'POST', {})).status, 404);
        const administrativeTarget = await create('Admin deletion', {visibility: 2});
        const admin = await open(null);
        const credentials = {email: 'pickup-admin-' + token + '@example.invalid', password: crypto.randomBytes(20).toString('hex')};
        assert.equal((await api(admin, '/api/login/register', 'POST', {...credentials, firstName: 'Pickup', lastName: 'Admin'})).status, 200);
        execFileSync('sqlcmd.exe', ['-S', 'lpc:localhost', '-d', 'LeagueScramblerPickupTest', '-E', '-C', '-b', '-Q',
            `IF DB_NAME() <> N'LeagueScramblerPickupTest' THROW 51000,'Wrong test database',1;
             UPDATE dbo.[User] SET UserRoleId=1 WHERE Email='${credentials.email}';`]);
        assert.equal((await api(admin, '/api/login/login', 'POST', credentials)).status, 200);
        const targetName = 'Admin deletion ' + token;
        assert.equal((await api(admin, administrativeTarget.api)).data.canDelete, true);
        assert(!(await api(admin, '/api/pickup/selector')).data.some(row => row.owned && row.id === administrativeTarget.api.split('/').at(-1)));
        assert.equal((await api(admin, administrativeTarget.api, 'DELETE', {name: targetName})).status, 204);
        assert.equal((await api(organizer, administrativeTarget.api)).status, 404);
        const requestHeaders = {Origin: origin};
        const tourneyName = 'Home fixture ' + token;
        const sql = `IF DB_NAME() <> N'LeagueScramblerPickupTest' THROW 51000,'Wrong test database',1;
            SET NOCOUNT ON;
            INSERT INTO dbo.LeagueType(LeagueName,EventTypeId) VALUES(N'${tourneyName}',2);
            DECLARE @id int = SCOPE_IDENTITY();
            SELECT @id;`;
        const tourneyId = Number(execFileSync('sqlcmd.exe', ['-S','lpc:localhost','-d','LeagueScramblerPickupTest',
            '-E','-C','-b','-h','-1','-W','-Q',sql], {encoding: 'utf8'}).trim());
        assert(tourneyId > 0);
        const summaryUrl = origin + '/api/tournaments/' + tourneyId + '/home';
        assert.equal((await player.request.get(summaryUrl)).status(), 403);
        const summary = await admin.request.get(summaryUrl, {headers: requestHeaders});
        assert.equal(summary.status(), 200, await summary.text());
        assert.equal((await summary.json()).status, null);
        await admin.goto(origin + '/?leagueId=' + tourneyId);
        await expect(admin.getByRole('heading', {name: 'Tournament Home'})).toBeVisible();
        await expect(admin.locator('.public-game-action').getByRole('link', {name: 'Pickup Games', exact: true})).toHaveAttribute('href', '/pickup/find');
        await expect(admin.getByRole('heading', {name: tourneyName})).toBeVisible();
        await expect(admin.getByRole('heading', {name: 'No Tournament Results Yet'})).toBeVisible();
        await expect(admin.locator('app-player-home-dashboard')).toHaveCount(0);
        await admin.getByRole('link', {name: 'Open Tournament Workspace'}).click();
        await expect(admin).toHaveURL(origin + '/tournament/' + tourneyId);
        await organizer.goto(origin + '/?leagueId=900001');
        await expect(organizer.locator('app-player-home-dashboard')).toBeVisible();
        await expect(organizer.locator('.public-game-action').getByRole('link', {name: 'Pickup Games', exact: true})).toHaveAttribute('href', '/pickup/find');
        const unscored = await create('Unscored');
        for (const guestName of ['First unscored guest', 'Second unscored guest']) {
            assert.equal((await api(organizer, unscored.api + '/players', 'POST', {guestName})).status, 204);
        }
        await organizer.goto(unscored.url);
        await checkLayout(2, 768, 'navy');
        await checkLayout(2, 390, 'charcoal');
        await organizer.getByRole('tab', {name: 'Scramble Teams', exact: true}).click();
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
        await checkLayout(21, 1366, 'classic');
        await checkLayout(21, 1366, 'navy');
        await checkLayout(21, 768, 'classic');
        await checkLayout(21, 768, 'charcoal');
        await checkLayout(21, 390, 'classic');

        const matrix = [
            {players: 12, mode: 'size', value: 4, sizes: [3, 3, 3, 3]},
            {players: 12, mode: 'count', value: 2, sizes: [6, 6]},
            {players: 16, mode: 'size', value: 4, sizes: [4, 4, 4, 4]},
            {players: 10, mode: 'size', value: 4, sizes: [2, 2, 3, 3]},
            {players: 20, mode: 'count', value: 4, sizes: [5, 5, 5, 5]}
        ];
        await organizer.setViewportSize({width: 1366, height: 850});
        for (const scenario of matrix) {
            await api(organizer, large.api + '/attendance', 'PUT', {all: true, playing: true});
            const roster = (await api(organizer, large.api + '/workspace')).data.players;
            for (const row of roster.slice(scenario.players))
                assert.equal((await api(organizer, large.api + '/attendance', 'PUT', {playerId: row.id, playing: false})).status, 204);
            await organizer.reload();
            await organizer.getByRole('tab', {name: 'Scramble Teams'}).click();
            await organizer.getByLabel('Team configuration').selectOption(scenario.mode);
            await organizer.getByLabel(scenario.mode === 'size' ? 'Maximum Team Size' : 'Number of Teams', {exact: true}).fill(String(scenario.value));
            await expect(organizer.getByText(scenario.players + ' players will be distributed across ' + scenario.sizes.length + ' teams.')).toBeVisible();
            if (scenario.players === 12 && scenario.mode === 'size') {
                await organizer.getByRole('tab', {name: 'Players', exact: true}).click();
                await checkLayout(21, 1366, 'classic');
                await organizer.getByRole('tab', {name: 'Scramble Teams'}).click();
                await expect(organizer.getByLabel('Maximum Team Size', {exact: true})).toHaveValue('4');
                await organizer.getByText('Top and Low Player priorities', {exact: true}).click();
                for (const picker of (await organizer.locator('.priority-row select').all()).slice(0, 2)) await picker.selectOption('top');
            }
            await organizer.getByRole('button', {name: /^Generate (Next )?Teams$/}).click();
            if (scenario.players === 12 && scenario.mode === 'size') await organizer.locator('.pickup-matchups').screenshot({path: path.join(screenshots, '12-players-maximum-4.png')});
            await organizer.getByRole('button', {name: 'Save Teams to Pickup Session'}).click();
            await expect(organizer.getByRole('tab', {name: 'Teams & Scores'})).toHaveAttribute('aria-selected', 'true');
            const saved = (await api(organizer, large.api + '/workspace')).data.sets.at(-1).board;
            assert.deepEqual(saved.teams.map(team => team.length).sort((a, b) => a - b), scenario.sizes);
            assert.equal(new Set(saved.teams.flat().map(player => player.id)).size, scenario.players);
            assert.deepEqual(saved.byes, []);
            if (scenario.players === 12 && scenario.mode === 'size') {
                const locations = saved.options.top.map(id => saved.teams.findIndex(team => team.some(p => p.id === id)));
                assert.equal(locations.length, 2);
                assert.notEqual(locations[0], locations[1]);
                assert.equal(Math.floor(locations[0] / 2), Math.floor(locations[1] / 2));
            }
        }
        const last = (await api(organizer, large.api + '/workspace')).data.sets.at(-1).board;
        const oversized = {teams: last.teams.map(team => team.map(player => player.id)), byes: [], gamesPerMatchup: 1,
            options: {...last.options, configurationMode: 'size', maxTeamSize: 4, teamCount: null}};
        assert.equal((await api(organizer, large.api + '/sets', 'POST', oversized)).status, 400);
        await organizer.getByRole('tab', {name: 'Scramble Teams'}).click();
        await organizer.getByLabel('Team configuration').selectOption('count');
        await organizer.getByLabel('Number of Teams', {exact: true}).fill('3');
        await organizer.getByRole('button', {name: 'Generate Next Teams'}).click();
        await expect(organizer.getByRole('alert')).toContainText('Choose an even number of teams');
        await organizer.getByRole('tab', {name: 'Invite Players'}).click();
        await expect(organizer.getByRole('tabpanel').getByRole('button', {name: 'Copy Invitation Link'})).toBeVisible();
        await expect(organizer.getByLabel('Team configuration')).toHaveCount(0);
        for (const [theme, width] of [['classic', 1366], ['navy', 390], ['charcoal', 768]]) {
            await organizer.setViewportSize({width, height: 850});
            await organizer.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            const copy = organizer.getByRole('button', {name: 'Copy Invitation Link'});
            await copy.scrollIntoViewIfNeeded();
            const heading = organizer.locator('.session-heading');
            const before = await heading.boundingBox();
            await copy.click();
            await checkPopup('Invitation link copied.', theme !== 'classic');
            assert.deepEqual(await heading.boundingBox(), before);
            await expect(organizer.getByRole('textbox', {name: 'Invitation Link'})).toHaveCount(0);
        }
        await organizer.getByRole('tab', {name: 'Session Settings'}).click();
        await organizer.getByRole('button', {name: 'Edit Session'}).click();
        await organizer.getByText('Advanced Options', {exact: true}).click();
        await organizer.getByLabel('Description').fill('Updated in a disposable browser fixture.');
        await organizer.getByRole('button', {name: 'Save Pickup Game'}).click();
        await checkPopup('Session updated.');

        for (let i = 21; i < 80; i++)
            assert.equal((await api(organizer, large.api + '/players', 'POST', {guestName: 'Limit player ' + i})).status, 204);
        await api(organizer, large.api + '/attendance', 'PUT', {all: true, playing: true});
        await organizer.reload();
        await organizer.getByRole('tab', {name: 'Scramble Teams'}).click();
        await expect(organizer.getByText('80 players will be distributed across 20 teams.')).toBeVisible();
        await organizer.getByRole('button', {name: 'Generate Next Teams'}).click();
        await expect(organizer.locator('.pickup-matchup')).toHaveCount(10);
        await organizer.getByRole('tab', {name: 'Players', exact: true}).click();
        await organizer.getByRole('button', {name: 'Mark Limit player 79 not playing'}).click();
        await organizer.getByRole('tab', {name: 'Scramble Teams'}).click();
        await expect(organizer.getByText(/The playing roster changed/)).toBeVisible();
        await expect(organizer.getByRole('button', {name: 'Save Teams to Pickup Session'})).toBeDisabled();
        await organizer.getByRole('button', {name: 'Discard Preview'}).click();
        await organizer.getByRole('alertdialog').getByRole('button', {name: 'Discard Preview'}).click();
        await expect(organizer.getByText('Proposed Teams', {exact: true})).toHaveCount(0);
        assert.equal((await api(organizer, large.api + '/cancel', 'POST', {})).status, 204);
        console.log('Layout screenshots: ' + screenshots);
        console.log('Pickup workspace checks passed for generation, attendance, playback, scoring, permissions and lifecycle.');
    } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });

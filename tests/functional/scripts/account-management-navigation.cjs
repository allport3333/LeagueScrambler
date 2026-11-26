const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const league = { id: 37, leagueName: 'Test League Fixture with a Long Name for the Event Selector', eventTypeId: 1 };

(async () => {
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        for (const [width, role] of [[375, ''], [390, 'Player'], [430, 'Admin'], [1366, ''], [1366, 'Manager'], [1920, 'Admin']]) {
            const theme = width === 430 ? 'navy' : width === 1366 && role ? 'charcoal' : 'classic';
            const context = await browser.newContext({serviceWorkers: 'block', hasTouch: width < 500, viewport: {width, height: 850}});
            const events = [league];
            const decisions = [];
            let reviewRequests = 0;
            await context.addInitScript(theme => {
                localStorage.setItem('league-hub-appearance', theme);
                sessionStorage.setItem('league-hub-selected-league', '37');
            }, theme);
            await context.route('**/*', async route => {
                if (new URL(route.request().url()).hostname === 'fonts.gstatic.com' &&
                    !new URL(route.request().url()).pathname.includes('/materialicons/')) return route.abort();
                if (await serveAsset(route)) return;
                const url = new URL(route.request().url());
                const endpoint = url.pathname.toLowerCase();
                if (url.origin !== origin || !endpoint.startsWith('/api/')) return route.abort();
                const method = route.request().method();
                let data = [];
                if (endpoint === '/api/account-recovery/review' || endpoint.startsWith('/api/account-recovery/review/')) {
                    reviewRequests++;
                    if (role !== 'Admin') return route.fulfill({status: role ? 403 : 401, json: {}});
                    if (method === 'POST') decisions.push(route.request().postDataJSON());
                    else {
                        const page = Number(url.searchParams.get('page'));
                        const status = url.searchParams.get('status');
                        data = {hasMore: page === 0, requests: status === 'pending'
                            ? [{id: 'fixture-' + page, playerName: 'Fixture Person ' + (page + 1), playerId: 1, userId: 10,
                                contactEmail: 'player@example.invalid', createdUtc: '2026-11-25', expiresUtc: '2099-12-31',
                                reviewInformation: 'Fixture verification notes'}] : []};
                    }
                } else if (method === 'POST' && endpoint.includes('/addnewleague/')) {
                    assert.equal(url.searchParams.get('eventTypeId'), '1');
                    data = {id: 42, leagueName: 'New League Fixture', eventTypeId: 1};
                    events.push(data);
                } else if (method !== 'GET') return route.abort();
                else if (endpoint === '/api/pickup/catalog') data = ['Wallyball'];
                else if (endpoint.endsWith('/isauthenticated')) data = !!role;
                else if (endpoint.endsWith('/getusersrole')) data = {role};
                else if (endpoint.endsWith('/getusersplayer')) data = {playerId: 1};
                else if (endpoint.endsWith('/getuserleagues') || endpoint.endsWith('/getleagues')) data = events;
                else if (endpoint.endsWith('/getbyleague')) data = {playerScores: [], maxRounds: 0};
                else if (url.searchParams.has('settingName')) data = {settingValue: ''};
                return route.fulfill({json: data});
            });
            const page = await context.newPage();
            await page.goto(origin + '/faq');
            const nav = page.getByRole('navigation', {name: 'Main navigation'});
            const drawer = page.locator('#navigation-drawer');
            const compact = nav.getByRole('button', {name: 'Open navigation'});
            const desktopAccount = nav.locator('.desktop-account button');
            await expect(compact.or(desktopAccount).first()).toBeVisible();
            const mobile = await compact.isVisible();
            const account = mobile ? drawer.locator('summary').filter({hasText: 'Account'}) : desktopAccount;
            const openAccount = async () => {
                if (mobile) {
                    await nav.getByRole('button', {name: 'Open navigation'}).click();
                    if (await account.locator('..').getAttribute('open') === null) await account.click();
                    return account.locator('..');
                }
                await account.click();
                return page.getByRole('menu');
            };
            const item = (menu, name) => menu.getByRole(!mobile ? 'menuitem' : ['Appearance', 'Logout'].includes(name) ? 'button' : 'link', {name, exact: true});
            let menu = await openAccount();
            await expect(item(menu, 'Appearance')).toBeVisible();
            await expect(item(menu, 'Install Locally')).toBeVisible();
            await expect(item(menu, 'F.A.Q.')).toBeVisible();
            assert.deepEqual(await menu.locator(mobile ? '.drawer-child-links .drawer-link' : '[role=menuitem]').evaluateAll(items =>
                items.map(item => {
                    const label = item.cloneNode(true);
                    label.querySelectorAll('mat-icon').forEach(icon => icon.remove());
                    return label.textContent.trim();
                })),
                role ? ['Profile', 'Appearance', 'Install Locally', 'F.A.Q.', 'Change Email', 'Logout'] : ['Appearance', 'Install Locally', 'F.A.Q.']);
            await expect(nav.getByRole('link', {name: 'Install Locally'})).toHaveCount(0);
            await expect(nav.getByRole('button', {name: 'More', exact: true})).toHaveCount(0);
            await expect(nav.getByRole('link', {name: 'Tournament Center', exact: true})).toHaveCount(0);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            await item(menu, 'Appearance').click();
            await expect(page.getByRole('dialog').getByRole('heading', {name: 'Appearance'})).toBeVisible();
            await page.keyboard.press('Escape');
            menu = await openAccount();
            await item(menu, 'Install Locally').click();
            await expect(page.getByRole('heading', {name: /Install Allport/})).toBeVisible();
            menu = await openAccount();
            await item(menu, 'F.A.Q.').click();
            await expect(page.getByRole('heading', {name: 'Frequently Asked Questions'})).toBeVisible();

            if (role === 'Admin' || role === 'Manager') {
                await page.goto(origin + '/league-management');
                const management = page.locator('.management-workspace');
                await expect(management.getByRole('heading', {name: 'Player and League Management'})).toBeVisible();
                const tab = name => management.getByRole('tab', {name, exact: true});
                const labels = await management.getByRole('tab').allTextContents();
                assert.equal(labels.at(-1).trim(), role === 'Admin' ? 'Recovery Review' : 'League Setup');
                await expect(tab('Create League')).toHaveCount(0);
                if (role === 'Admin') {
                    assert.equal(reviewRequests, 0);
                    await tab('Recovery Review').click();
                    await expect(management.getByRole('heading', {name: 'Account Recovery Review'})).toBeVisible();
                    await expect(management.getByRole('heading', {name: 'Fixture Person 1'})).toBeVisible();
                    await management.getByRole('button', {name: 'Next', exact: true}).click();
                    await expect(management.getByRole('heading', {name: 'Fixture Person 2'})).toBeVisible();
                    await management.getByRole('button', {name: 'Previous', exact: true}).click();
                    await management.getByLabel('Request status').selectOption('rejected');
                    await expect(management.getByText('No rejected recovery requests to review.')).toBeVisible();
                    await management.getByLabel('Request status').selectOption('pending');
                    for (const resolution of ['approve', 'reject']) {
                        await management.getByRole('button', {name: 'Review this request'}).click();
                        await management.getByLabel('Decision', {exact:true}).selectOption(resolution);
                        if (resolution === 'approve') {
                            await expect(management.getByRole('button', {name: 'Record decision'})).toBeDisabled();
                            await management.getByLabel(/independently verified/).check();
                        }
                        await management.getByRole('button', {name: 'Record decision'}).click();
                        await expect.poll(() => decisions.length).toBe(resolution === 'approve' ? 1 : 2);
                    }
                    assert.deepEqual(decisions.map(decision => decision.approve), [true, false]);
                } else assert.equal(reviewRequests, 0);
                const selector = page.locator('#leagueDropdown');
                await expect(selector).toHaveAttribute('title', league.leagueName);
                const triggerWidth = (await selector.boundingBox()).width;
                assert(triggerWidth > 180 && triggerWidth <= 217, String(triggerWidth));
                await selector.click();
                const eventsMenu = page.getByRole('dialog', {name: 'Select league or event'});
                const leagues = eventsMenu.getByRole('group', {name: 'Leagues', exact: true});
                const choice = leagues.getByRole('button', {name: league.leagueName});
                await expect(choice).toHaveAttribute('title', league.leagueName);
                await expect(choice).toHaveAttribute('aria-current', 'true');
                const create = leagues.getByRole('link', {name: 'Create League', exact: true});
                assert(await create.evaluate(el => el.compareDocumentPosition(el.closest('[role=group]').querySelector('button[aria-current]')) & Node.DOCUMENT_POSITION_PRECEDING));
                const box = await eventsMenu.boundingBox();
                assert(box.x >= 0 && box.x + box.width <= width + 1 && box.width >= Math.min(431, width - 25), JSON.stringify(box));
                if (process.env.LEAGUE_TEST_OUT) {
                    fs.mkdirSync(process.env.LEAGUE_TEST_OUT, {recursive: true});
                    await page.evaluate(() => document.fonts.ready);
                    await page.screenshot({path: path.join(process.env.LEAGUE_TEST_OUT, width + '-' + role + '-' + theme + '.png')});
                }
                await create.click();
                await expect(page).toHaveURL(origin + '/league-management?view=create');
                await expect(management.getByRole('heading', {name: 'Create League', exact: true})).toBeVisible();
                await expect(management.getByRole('tab')).toHaveCount(0);
                await management.getByLabel('Event Name').fill('New League Fixture');
                await management.getByRole('button', {name: 'Create League', exact:true}).click();
                await expect(tab('League Setup')).toHaveAttribute('aria-selected', 'true');
                await expect(management.getByText('Selected league: New League Fixture')).toBeVisible();
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
                for (const [group, title, destination] of [
                    ['Tournaments', 'Create Tournament', '/tournament?view=create'],
                    ['Pickup Games', 'Create Pickup Game', '/pickup/create']
                ]) {
                    await selector.click();
                    await eventsMenu.getByRole('button', {name: new RegExp('^' + group)}).click();
                    await eventsMenu.getByRole('link', {name: title, exact: true}).click();
                    await expect(page).toHaveURL(origin + destination);
                }
            } else {
                if (role) {
                    await page.locator('#leagueDropdown').click();
                    await expect(page.getByRole('link', {name: 'Create League', exact: true})).toHaveCount(0);
                } else await expect(page.locator('#leagueDropdown')).toHaveCount(0);
                await page.goto(origin + '/league-management?view=create');
                await expect(page.getByRole('heading', {name: 'Access denied'})).toBeVisible();
            }
            await page.goto(origin + '/recovery-review');
            await expect(page.getByRole('heading', {name: 'Account Recovery Review'})).toBeVisible();
            if (role === 'Admin') await expect(page.getByRole('heading', {name: 'Fixture Person 1'})).toBeVisible();
            else await expect(page.getByRole('alert')).toContainText('Sign in as an Application Administrator');
            console.log(width + 'px ' + (role || 'signed out') + ' ' + (mobile ? 'drawer' : 'desktop'));
            await context.close();
        }
        console.log('Account placement, public routes, administrator review and Create League passed at five viewport widths.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

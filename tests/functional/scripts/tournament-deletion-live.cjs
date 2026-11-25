// Run by EventTypeCheck --deletion against isolated Development fixtures.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { origin, adminEmail, managerEmail, playerEmail, password, scored, scoredName, rosterName } =
    JSON.parse(fs.readFileSync(0, 'utf8'));
assert.match(origin, /^https:\/\/127\.0\.0\.1:\d+$/);
assert.match(scoredName, /^DeleteCheck-[a-f0-9]{16}-scored$/);
assert(Number.isSafeInteger(scored) && scored > 0);

(async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
        async function visit(email, theme, width) {
            assert.match(email, /^DeleteCheck-[a-f0-9]{16}-[123]@example\.invalid$/);
            const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block',
                viewport: { width, height: 850 } });
            await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
            await context.addInitScript(value => localStorage.setItem('league-hub-appearance', value), theme);
            const login = await context.request.post(origin + '/api/Login/login', { data: { email, password }, headers: { Origin: origin } });
            assert.equal(login.status(), 200);
            const page = await context.newPage();
            page.setDefaultTimeout(12000);
            return { context, page };
        }
        const remove = page => page.getByRole('button', { name: 'Delete Tournament: ' + scoredName, exact: true });
        const open = name => 'Open Tournament: ' + name;
        for (const [theme, width] of [['classic', 1440], ['navy', 390], ['charcoal', 390]]) {
            const { context, page } = await visit(adminEmail, theme, width);
            let deletes = 0;
            page.on('request', request => { if (request.method() === 'DELETE') deletes++; });
            if (theme === 'charcoal') {
                // Keep existing Development events intact while exercising removal from a one-event view.
                await page.route('**/api/tournaments/managed', async route => {
                    const response = await route.fetch();
                    await route.fulfill({ response, json: (await response.json()).filter(event => event.id === scored) });
                });
            }
            await page.goto(origin + '/tournament');
            if (theme === 'classic') await expect(page.locator('html[data-theme]')).toHaveCount(0);
            else await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            await expect(page.getByRole('link', { name: 'Manage Tournaments', exact: true })).toHaveAttribute('aria-current', 'page');
            await expect(page.getByRole('link', { name: open(scoredName) })).toBeVisible();
            await remove(page).click();
            const dialog = page.getByRole('alertdialog');
            await expect(dialog).toContainText(scoredName);
            await expect(dialog).toContainText('Jan 27, 2027');
            await expect(dialog).toContainText('Scores');
            await expect(dialog.getByRole('button', { name: 'Permanently Delete', exact: true })).toBeDisabled();
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            await dialog.getByLabel('Type the tournament name to confirm').fill(scoredName.toUpperCase());
            await expect(dialog.getByRole('button', { name: 'Permanently Delete', exact: true })).toBeDisabled();
            await dialog.getByRole('button', { name: 'Cancel' }).click();
            await expect(dialog).toHaveCount(0);
            assert.equal(deletes, 0);
            await expect(page.getByRole('link', { name: open(scoredName) })).toBeVisible();
            if (theme === 'charcoal') {
                await page.getByRole('link', { name: open(scoredName) }).click();
                await expect(page.getByRole('heading', { name: scoredName, exact: true })).toBeVisible();
                await expect(page.getByRole('button', { name: 'View Standings' })).toBeEnabled();
                await page.getByRole('button', { name: 'Continue: Enter Round 1 Scores', exact: true }).click();
                await expect(page.getByRole('heading', { name: 'Round 1 Scores' })).toBeVisible();
                await expect(page.getByRole('navigation', { name: 'Tournament Center views' })).toHaveCount(0);
                await page.getByRole('link', { name: 'Back to Tournament Center' }).click();
                await expect(page.getByRole('link', { name: 'Continue Tournament' })).toBeVisible();
                await page.getByRole('link', { name: 'Continue Tournament' }).click();
                await expect(page.getByRole('heading', { name: scoredName, exact: true })).toBeVisible();
                await expect(page.getByRole('heading', { name: 'Round 1 Scores' })).toBeVisible();
                const standings = page.waitForResponse(response => response.url().includes('/GetByLeague/' + scoredName));
                await page.getByRole('button', { name: 'View Standings' }).click();
                await expect(page).toHaveURL(new RegExp('/standings\\?.*leagueId=' + scored + '(?:&|$)'));
                assert.equal((await standings).status(), 200);
                await page.getByRole('link', { name: new RegExp('Back to ' + scoredName) }).click();
                await expect(page.getByRole('heading', { name: 'Round 1 Scores' })).toBeVisible();
                await expect(page.getByRole('button', { name: 'View Standings' })).toBeEnabled();
                await page.getByRole('link', { name: 'Back to Tournament Center' }).click();
                await page.getByRole('link', { name: 'Manage Tournaments', exact: true }).click();
                await expect(page).toHaveURL(origin + '/tournament');
                await expect(page.getByRole('link', { name: 'Current Tournament', exact: true })).toBeVisible();
                await remove(page).click();
                await dialog.getByLabel('Type the tournament name to confirm').fill(scoredName);
                await dialog.getByRole('button', { name: 'Permanently Delete', exact: true }).click();
                await expect(page.getByText('Tournament deleted.', { exact: true })).toBeVisible();
                await expect(page.getByRole('link', { name: open(scoredName) })).toHaveCount(0);
                await expect(page.getByRole('heading', { name: 'No tournaments yet' })).toBeVisible();
                await page.getByRole('link', { name: 'Current Tournament', exact: true }).click();
                await expect(page.getByRole('heading', { name: 'No current tournament' })).toBeVisible();
                await page.goto(origin + '/tournament/' + scored);
                await expect(page.locator('app-tournament-center').getByRole('alert')).toContainText('Tournament not found');
                assert.equal(deletes, 1);
            }
            await context.close();
        }

        const manager = await visit(managerEmail, 'navy', 390);
        await manager.page.goto(origin + '/tournament');
        await expect(manager.page.getByRole('link', { name: open(rosterName) })).toBeVisible();
        await expect(manager.page.getByRole('button', { name: /Delete Tournament/ })).toHaveCount(0);
        await manager.page.route('**/api/tournaments/managed', route => route.fulfill({ json: [], headers: { 'X-Tournaments-Exist': 'true' } }));
        await manager.page.reload();
        await expect(manager.page.getByRole('heading', { name: 'No tournaments to manage' })).toBeVisible();
        await manager.context.close();

        const player = await visit(playerEmail, 'classic', 1440);
        await player.page.goto(origin + '/tournament');
        await expect(player.page.getByRole('heading', { name: 'Tournament Center' })).toBeVisible();
        await player.page.getByRole('navigation', {name: 'Tournament Center views'}).getByRole('link', { name: 'Create Tournament' }).click();
        await expect(player.page.getByText('0 of 3 tournaments created')).toBeVisible();
        const browserName = scoredName.replace(/-scored$/, '-browser-created');
        await player.page.getByLabel('Tournament Name').fill(browserName);
        await player.page.getByLabel('Tournament Date').fill('2027-01-27');
        await player.page.getByRole('button', { name: 'Create Tournament' }).click();
        await expect(player.page.getByRole('heading', { name: browserName })).toBeVisible();
        await expect(player.page.getByLabel('Tournament Name')).toHaveValue(browserName);
        await player.page.getByRole('link', { name: 'Back to Tournament Center' }).click();
        await expect(player.page.getByRole('link', { name: 'Continue Tournament' })).toBeVisible();
        await expect(player.page.getByRole('button', { name: /Delete Tournament/ })).toHaveCount(0);
        await player.context.close();

        const empty = await visit(adminEmail, 'classic', 1440);
        // Existing Development events must stay intact. Simulate the API response for the final empty list.
        await empty.page.route('**/api/tournaments/managed', route => route.fulfill({ json: [], headers: { 'X-Tournaments-Exist': 'false' } }));
        await empty.page.goto(origin + '/tournament');
        await expect(empty.page.getByRole('heading', { name: 'No tournaments yet' })).toBeVisible();
        await empty.page.getByRole('region', { name: 'No tournaments yet' }).getByRole('link', { name: 'Create Tournament' }).click();
        await expect(empty.page.getByRole('heading', { name: 'Create a Tournament' })).toBeVisible();
        await empty.context.close();
        console.log('Tournament deletion browser checks passed in Classic Light, Dark Navy and Charcoal.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });


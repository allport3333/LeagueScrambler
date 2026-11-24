// Invoked by EventTypeCheck with an ephemeral loopback host and an owned SQL fixture.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { origin, email, password, leagueId } = JSON.parse(fs.readFileSync(0, 'utf8'));
assert.match(origin, /^https:\/\/127\.0\.0\.1:\d+$/);
assert.match(email, /^EventCheck-[a-f0-9]{32}@example\.invalid$/);
assert(Number.isSafeInteger(leagueId) && leagueId > 0);
(async () => {
    const browser = await chromium.launch({ channel: 'msedge' });
    try {
        const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const login = await context.request.post(origin + '/api/Login/login', {
            data: { email, password }, headers: { Origin: origin }, maxRedirects: 0
        });
        assert.equal(login.status(), 200, 'Fixture manager login');
        const page = await context.newPage();
        await page.goto(origin + '/tournament/' + leagueId);
        await expect(page.getByText(/24 registered.*20 eligible.*5 saved rounds/)).toBeVisible();
        const firstRound = page.locator('.saved-round').filter({ hasText: 'Round 1' });
        await firstRound.locator('summary').click();
        const popupPending = page.waitForEvent('popup');
        await firstRound.getByRole('button', { name: 'Print Round 1' }).click();
        const popup = await popupPending;
        await expect(popup.getByRole('heading', { name: 'Round 1' })).toBeVisible();
        await expect(popup.locator('.team')).toHaveCount(6);
        await popup.close();
        await page.getByRole('link', { name: 'View Standings' }).click();
        await expect(page.getByText('Player Standings', { exact: true })).toBeVisible();
        await page.goBack();
        await page.getByRole('button', { name: 'Continue: Enter Round 1 Scores' }).click();
        const inputs = page.locator('.score-inputs input');
        await expect(inputs.first()).toHaveValue('21');
        await inputs.first().fill('22');
        await page.getByRole('button', { name: 'Save Round Scores' }).click();
        await expect(page.getByText('Round scores saved.')).toBeVisible();
        await page.reload();
        await page.getByRole('button', { name: 'Continue: Enter Round 1 Scores' }).click();
        await expect(page.locator('.score-inputs input').first()).toHaveValue('22');
        console.log('SQL-backed browser confirmed print preview, standings, round score edit and reload.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

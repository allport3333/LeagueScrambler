// Invoked by EventTypeCheck with an ephemeral loopback host and an owned SQL fixture.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { origin, email, password, leagueId, administrator } = JSON.parse(fs.readFileSync(0, 'utf8'));
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
        await context.addInitScript(() => {
            if (!sessionStorage.getItem('league-hub-selected-league'))
                sessionStorage.setItem('league-hub-selected-league', '37');
        });
        const page = await context.newPage();
        await page.setViewportSize({ width: 1920, height: 900 });
        await page.goto(origin + '/');
        await expect(page.getByRole('button', { name: /WW Winter 2026/ })).toBeVisible();
        await page.getByRole('link', { name: 'Tournament Center', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Tournament Center', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /WW Winter 2026/ })).toBeVisible();
        await expect(page.getByRole('link', { name: 'WW Winter 2026' })).toHaveCount(0);
        if (administrator) {
            await expect(page.getByRole('link', { name: '419 Tournament', exact: true })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Wallyball Unicorn Tournament', exact: true })).toBeVisible();
        } else {
            await expect(page.getByRole('link', { name: '419 Tournament', exact: true })).toHaveCount(0);
            await expect(page.getByRole('link', { name: 'Wallyball Unicorn Tournament', exact: true })).toHaveCount(0);
        }
        const newName = email.split('@')[0] + (administrator ? '-ADMIN' : '-UI');
        await page.getByLabel('Tournament Name').fill(newName);
        await page.getByLabel('Tournament Date').fill('2026-12-12');
        await page.getByRole('button', { name: 'Create Tournament' }).click();
        await expect(page.getByRole('heading', { name: newName, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: new RegExp(newName) })).toBeVisible();
        if (administrator) {
            console.log('Administrator created a tournament from WW Winter 2026 and could list both legacy tournaments.');
            return;
        }
        const createdUrl = page.url();
        const next = () => page.getByRole('button', { name: 'Save & Continue', exact: true }).click();
        await next();
        await expect(page.getByRole('heading', { name: 'Manage Participants' })).toBeVisible();
        await next();
        await expect(page.getByText('Add at least two participants before continuing.')).toBeVisible();
        await page.getByText('Register a New Player', { exact: true }).click();
        const fixtureLastName = email.split('@')[0];
        for (const first of ['WizardOne', 'WizardTwo']) {
            await page.getByLabel('First Name').fill(first);
            await page.getByLabel('Last Name').fill(fixtureLastName);
            await page.getByLabel('Gender').selectOption('Female');
            await page.getByRole('button', {name: 'Register and Add'}).click();
            await expect(page.getByRole('button', { name: 'Remove ' + first + ' ' + fixtureLastName })).toBeVisible();
        }
        await page.getByRole('button', { name: 'Remove WizardTwo ' + fixtureLastName }).click();
        await expect(page.getByText(/1 registered/)).toBeVisible();
        await page.getByLabel('Search Existing Players').fill('WizardTwo ' + fixtureLastName);
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.getByText(/2 registered/)).toBeVisible();
        await next();
        await page.getByLabel('Number of Rounds').fill('1');
        await next();
        await expect(page.getByRole('heading', { name: 'Player Priorities & Byes' })).toBeVisible();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await expect(page.getByLabel('Number of Rounds')).toHaveValue('1');
        await page.goto(createdUrl);
        await expect(page.getByRole('heading', { name: 'Player Priorities & Byes' })).toBeVisible();
        await next();
        await expect(page.getByRole('heading', { name: 'Player Check In' })).toBeVisible();
        await page.getByRole('button', { name: 'Skip Check In' }).click();
        await expect(page.getByText('Check-in is skipped.')).toBeVisible();
        await next();
        await page.getByRole('button', { name: 'Generate Tournament Rounds' }).click();
        await expect(page.getByRole('heading', { name: 'Proposed Rounds' })).toBeVisible();
        await page.getByRole('button', { name: 'Save Proposed Rounds' }).click();
        await expect(page.getByRole('heading', { name: 'Run Tournament' })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Run Tournament' })).toBeVisible();
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

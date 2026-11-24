// Invoked by EventTypeCheck with an ephemeral loopback host and an owned SQL fixture.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { origin, email, password, leagueId, administrator } = JSON.parse(fs.readFileSync(0, 'utf8'));
assert.match(origin, /^https:\/\/127\.0\.0\.1:\d+$/);
assert.match(email, /^EventCheck-[a-f0-9]{32}@example\.invalid$/);
assert(Number.isSafeInteger(leagueId) && leagueId > 0);
(async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
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
            const testTournament = page.getByRole('link', { name: 'Manage Test 1', exact: true });
            if (await testTournament.count()) {
                await testTournament.click();
                await expect(page.getByRole('heading', { name: 'Test 1', exact: true })).toBeVisible();
                await page.getByRole('link', { name: 'Tournament Center', exact: true }).click();
                await expect(page.getByRole('heading', { name: 'Test 1', exact: true })).toBeVisible();
                await page.getByRole('button', { name: /Test 1/ }).click();
                await page.getByRole('menuitem', { name: /WW Winter 2026/ }).click();
                await page.getByRole('link', { name: 'Tournament Center', exact: true }).click();
                await expect(page.getByRole('heading', { name: 'Tournament Center', exact: true })).toBeVisible();
            }
        } else {
            await expect(page.getByRole('link', { name: '419 Tournament', exact: true })).toHaveCount(0);
            await expect(page.getByRole('link', { name: 'Wallyball Unicorn Tournament', exact: true })).toHaveCount(0);
        }
        const newName = email.split('@')[0] + (administrator ? '-ADMIN' : '-UI');
        await page.getByRole('link', { name: 'Create Tournament', exact: true }).click();
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
        await expect(page.locator('.available-player').first()).toBeVisible();
        await next();
        await expect(page.getByText('Add at least two participants before continuing.')).toBeVisible();
        await page.getByText('Register a New Player', { exact: true }).click();
        const fixtureLastName = email.split('@')[0];
        for (const first of ['WizardOne', 'WizardTwo']) {
            await page.getByLabel('First Name').fill(first);
            await page.getByLabel('Last Name').fill(fixtureLastName);
            await page.locator('select[name=gender]').selectOption('Female');
            await page.getByRole('button', {name: 'Register and Add'}).click();
            await expect(page.getByRole('button', { name: 'Remove ' + first + ' ' + fixtureLastName })).toBeVisible();
        }
        await page.getByRole('button', { name: 'Remove WizardTwo ' + fixtureLastName }).click();
        await expect(page.getByText(/1 registered/)).toBeVisible();
        await page.getByLabel('First Name').fill('wizardtwo');
        await page.getByLabel('Last Name').fill(fixtureLastName);
        await page.locator('select[name=gender]').selectOption('Female');
        const suggestions = page.getByRole('region', { name: 'Possible existing players' });
        await expect(suggestions.getByText(/Exact name/)).toBeVisible();
        await expect(page.getByRole('button', {name: 'Register and Add'})).toBeDisabled();
        await suggestions.getByRole('button', { name: 'Add Existing Player' }).click();
        await expect(page.getByText(/2 registered/)).toBeVisible();
        await expect(suggestions.getByRole('button', { name: 'Already Added' })).toBeDisabled();
        await page.getByRole('checkbox', { name: /confirm that this is a different person/ }).check();
        await page.getByRole('button', { name: 'Register and Add' }).click();
        await expect(page.getByText(/3 registered/)).toBeVisible();
        await page.getByRole('button', { name: 'Remove wizardtwo ' + fixtureLastName, exact: true }).last().click();
        await expect(page.getByText(/2 registered/)).toBeVisible();
        await page.getByRole('button', { name: 'Women', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Women', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'All', exact: true }).click();
        await next();
        await page.getByLabel('Number of Rounds').fill('2');
        await next();
        await expect(page.getByRole('heading', { name: 'Player Priorities & Byes' })).toBeVisible();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await expect(page.getByLabel('Number of Rounds')).toHaveValue('2');
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
        await page.getByRole('button', { name: 'Continue: Enter Round 1 Scores' }).click();
        const scoreFields = page.locator('.score-inputs input');
        await scoreFields.nth(0).fill('12');
        await scoreFields.nth(1).fill('15');
        await page.getByRole('button', { name: 'Save Round Scores' }).click();
        await expect(page.getByText('Round 1 Complete!')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Round 2 Scores' })).toBeVisible();
        await scoreFields.nth(0).fill('15');
        await scoreFields.nth(1).fill('12');
        await page.getByRole('button', { name: 'Save Round Scores' }).click();
        await expect(page.getByText('Tournament Complete!')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Tournament Complete', exact: true })).toBeVisible();
        await expect(page.getByText('Player Standings', { exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Tournament Center', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Tournament Complete', exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Manage Tournaments', exact: true }).click();
        const setup = await (await context.request.get(origin + '/api/tournaments/' + leagueId)).json();
        await page.getByRole('link', { name: 'Manage ' + setup.name, exact: true }).click();
        await page.locator('.roster-summary summary').click();
        await expect(page.getByText(/24 registered.*20 eligible.*5 saved rounds/)).toBeVisible();
        await page.getByRole('button', { name: 'Manage Tournament Setup' }).click();
        await page.getByRole('button', { name: /Manage Participants/ }).click();
        await expect(page.getByText(/24 registered.*20 checked in/)).toBeVisible();
        await expect(page.locator('.available-player').first()).toBeVisible();
        assert(await page.locator('.available-player').count() >= 24);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true).catch(async error => {
            const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => {
                const bounds = element.getBoundingClientRect();
                return bounds.width && bounds.right > innerWidth + 1 && getComputedStyle(element).visibility === 'visible';
            }).slice(0, 10).map(element => [element.tagName, element.className, Math.round(element.getBoundingClientRect().right)]));
            console.error('Visible overflowing elements', overflow);
            throw error;
        });
        await page.setViewportSize({ width: 1920, height: 900 });
        await page.getByRole('button', { name: 'Return to Run Tournament' }).click();
        const firstRound = page.locator('.saved-round').filter({ hasText: 'Round 1' });
        await firstRound.locator('summary').click();
        const popupPending = page.waitForEvent('popup');
        await firstRound.getByRole('button', { name: 'Print Round 1' }).click();
        const popup = await popupPending;
        await expect(popup.getByRole('heading', { name: 'Round 1' })).toBeVisible();
        await expect(popup.locator('.print-team')).toHaveCount(6);
        const folder = path.resolve('tests/functional/artifacts/tournament-print');
        fs.mkdirSync(folder, { recursive: true });
        const printRound = async (sheet, filename, expectedHeadings) => {
            await expect(sheet.locator('h3').filter({ hasText: /^Round \d+$/ })).toHaveCount(expectedHeadings);
            const documentHtml = await sheet.content();
            const preview = await context.newPage();
            await preview.setContent(documentHtml);
            await preview.emulateMedia({ media: 'print' });
            await preview.screenshot({ path: path.join(folder, filename + '.png'), fullPage: true });
            const pdf = await preview.pdf({ path: path.join(folder, filename + '.pdf'), format: 'Letter', printBackground: true });
            await preview.close();
            const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
            assert(pageCount >= expectedHeadings && pageCount <= expectedHeadings * 3, 'Printed page count: ' + pageCount);
        };
        await printRound(popup, 'single-round', 1);
        await popup.close();
        await page.locator('.print-options summary').click();
        await expect(page.getByLabel('Matchups per printed page')).toHaveValue(/: 6$/);
        await firstRound.getByRole('checkbox', { name: 'Select for Printing' }).check();
        const secondRound = page.locator('.saved-round').filter({ hasText: 'Round 2' });
        await secondRound.locator('summary').click();
        await secondRound.getByRole('checkbox', { name: 'Select for Printing' }).check();
        for (const [name, file, count] of [['Print Selected Rounds', 'selected-rounds', 2], ['Print All Rounds', 'all-rounds', 5]]) {
            const pending = page.waitForEvent('popup');
            await page.getByRole('button', { name, exact: true }).click();
            const sheet = await pending;
            await printRound(sheet, file, count);
            await sheet.close();
        }

        const standingsUrl = origin + '/api/ScrambleData/GetByLeague/' + encodeURIComponent(email.split('@')[0] + '-T2');
        const roundData = await (await context.request.get(origin + '/api/tournaments/' + leagueId + '/rounds')).json();
        const expectedWins = async (winningIndex) => {
            const savedStandings = await (await context.request.get(standingsUrl)).json();
            const firstTwo = roundData.rounds[0].teams.slice(0, 2);
            for (const [index, team] of firstTwo.entries())
                for (const player of team.players)
                    assert.equal(savedStandings.matchupWins[player.id] ?? 0, index === winningIndex ? 1 : 0);
        };
        await expectedWins(1);
        await page.getByLabel('Matchups per printed page').selectOption({ label: 'Two matchups' });
        const alternatePending = page.waitForEvent('popup');
        await firstRound.getByRole('button', { name: 'Print Round 1' }).click();
        const alternate = await alternatePending;
        await expect(alternate.locator('app-matchup-print-sheet')).toHaveCount(1);
        await printRound(alternate, 'two-matchups-per-page', 1);
        await alternate.close();
        await page.getByRole('link', { name: 'View Standings' }).click();
        await expect(page.getByText('Player Standings', { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: /^Back to .* Tournament$/ })).toBeVisible();
        await page.reload();
        await page.getByRole('link', { name: /^Back to .* Tournament$/ }).click();
        await page.getByRole('button', { name: 'Continue: Enter Round 1 Scores' }).click();
        const inputs = page.locator('.score-inputs input');
        await expect(inputs.first()).toHaveValue('12');
        await inputs.first().fill('22');
        await page.getByRole('button', { name: 'Save Round Scores' }).click();
        await expect(page.getByText('Round scores saved.')).toBeVisible();
        await page.reload();
        await page.getByRole('button', { name: 'Continue: Enter Round 1 Scores' }).click();
        await expect(page.locator('.score-inputs input').first()).toHaveValue('22');
        await expectedWins(0);
        console.log('SQL-backed browser confirmed print preview, standings, round score edit and reload.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

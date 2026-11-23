const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('../../tests/functional/node_modules/@playwright/test');
const serveAsset = require('../../tests/functional/scripts/fixture-asset.cjs');
const { BASE_URL } = require('../../tests/functional/helpers/safety.cjs');
const output = process.env.LEAGUE_TEST_OUT;
assert(output && process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(output, { recursive: true });
const league = { id: 101, leagueName: 'Fixture League' };
const roster = [
    { id: 21, firstName: 'Avery', lastName: 'Harbor', gender: 'Female', isMale: false },
    { id: 22, firstName: 'Casey', lastName: 'Harbor', gender: 'Male', isMale: true },
    { id: 23, firstName: 'Jordan', lastName: 'Harbor', gender: 'Female', isMale: false }
];
const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(new Date());

async function run() {
    const browser = await chromium.launch({ channel: 'msedge' });
    try {
        for (const [theme, width] of [['classic', 1280], ['navy', 390], ['charcoal', 320]]) {
            let authenticated = false, role = 'Player', registrations = 0, claims = 0, creations = 0;
            const signedIn = [];
            const searches = [];
            const recoverySearches = [];
            let searchFailure = '';
            let resent = 0;
            const recoveryId = '3dd8c850-02e9-489c-bbbd-bd909173c5f5';
            let decision, emailChange = false, reviewFailure = 0, reviewEmpty = false, reviewDelay = 0;
            const claimed = { ...roster[1], leagues: ['Fixture League'] };
            const many = Array.from({length: 60}, (_, i) => ({ id: 1000 + i, firstName: 'Fixture', lastName: 'Player ' + i }));
            const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 900 } });
            await context.addInitScript(id => localStorage.setItem('league-hub-appearance', id), theme);
            await context.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.hostname === 'fonts.gstatic.com' && !url.pathname.startsWith('/s/materialicons/')) return route.abort();
                if (await serveAsset(route)) return;
                if (url.origin !== BASE_URL || !url.pathname.startsWith('/api/')) return route.abort();
                const endpoint = url.pathname.toLowerCase();
                let json = [];
                if (endpoint.endsWith('/register')) { authenticated = true; registrations++; json = { userId: 7 }; }
                if (endpoint.endsWith('/login/login')) { authenticated = true; json = {}; }
                if (endpoint.endsWith('/logout')) { authenticated = false; json = {}; }
                if (endpoint.endsWith('/isauthenticated')) json = authenticated;
                if (endpoint.endsWith('/getusersrole')) json = { role };
                if (endpoint.endsWith('/getusersplayer')) return route.fulfill({ status: 404, json: {} });
                if (/\/get(user)?leagues$/.test(endpoint)) json = role === 'Player' ? [] : [league];
                if (endpoint === '/api/account-recovery/email-change') {
                    const body = route.request().postDataJSON();
                    assert.equal(body.email, 'changed@example.invalid');
                    assert.equal(body.password, 'FixturePassword123!');
                    emailChange = true;
                    return route.fulfill({ status: 202, json: { id: recoveryId } });
                }
                if (endpoint === '/api/account-recovery/profiles') {
                    const search = url.searchParams.get('search').toLowerCase();
                    recoverySearches.push(search);
                    if (search === 'ch') {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return route.fulfill({ json: { players: [ { id: 35, firstName: 'Obsolete', lastName: 'Search' } ], hasMore: false } }).catch(() => {});
                    }
                    if (searchFailure === 'offline') return route.abort('internetdisconnected');
                    if (searchFailure === 'html')
                        return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html>SPA shell</html>' });
                    if (searchFailure === 'server') return route.fulfill({ status: 503 });
                    if (searchFailure === 'shape') return route.fulfill({ json: { unexpected: [] } });
                    return route.fulfill({ json: { players: search.includes('harbor')
                        ? [claimed, { ...claimed, id: 99, leagues: ['Other League'] }] : [], hasMore: false } });
                }
                if (endpoint === '/api/account-recovery/review') {
                    if (reviewDelay) await new Promise(resolve => setTimeout(resolve, reviewDelay));
                    const status = url.searchParams.get('status');
                    if (reviewFailure) return route.fulfill({ status: reviewFailure });
                    if (reviewEmpty || (decision && status === 'pending'))
                        return route.fulfill({ json: { requests: [], hasMore: false } });
                    if (status === 'rejected' || status === 'expired') {
                        return route.fulfill({ json: { requests: [{
                            id: 'archived-case', playerName: 'Archived Fixture', playerId: 23, userId: 11,
                            contactEmail: 'archive@example.invalid', expiresUtc: '2020-01-01T00:00:00Z',
                            createdUtc: '2020-01-01T00:00:00Z', decidedUtc: status === 'rejected' ? '2020-01-02T00:00:00Z' : null,
                            reviewerId: 1, approved: false, reviewDecision: 'Independent ownership could not be verified.'
                        }], hasMore: false } });
                    }
                    return route.fulfill({ json: { requests: [{
                        id: recoveryId, playerId: 22, userId: 7, contactEmail: 'recovery@example.invalid',
                        reviewInformation: 'Independently verifiable fixture identity',
                        expiresUtc: new Date(Date.now() + 3600000).toISOString(),
                        decidedUtc: decision ? new Date().toISOString() : null, reviewerId: 1,
                        approved: decision?.approve, reviewDecision: decision?.decisionNotes,
                        playerName: 'Casey Harbor', createdUtc: new Date().toISOString()
                    }], hasMore: !url.searchParams.get('page') || url.searchParams.get('page') === '0' } });
                }
                if (endpoint === '/api/account-recovery/review/' + recoveryId) {
                    decision = route.request().postDataJSON();
                    return route.fulfill({ json: {} });
                }
                if (endpoint === '/api/account-recovery/request') {
                    assert.equal(route.request().postDataJSON().playerId, 22);
                    assert.equal(route.request().postDataJSON().information, 'help');
                    return route.fulfill({ status: 202, json: { id: '3dd8c850-02e9-489c-bbbd-bd909173c5f5' } });
                }
                if (endpoint === '/api/account-recovery/resend') {
                    assert.equal(route.request().postDataJSON().id, recoveryId);
                    resent++;
                    return route.fulfill({ status: 202, json: { id: recoveryId } });
                }
                if (endpoint === '/api/account-recovery/verify') {
                    assert.deepEqual(route.request().postDataJSON(), {
                        id: '3dd8c850-02e9-489c-bbbd-bd909173c5f5', code: '12345678'
                    });
                    return route.fulfill({ json: { emailChanged: emailChange } });
                }
                if (endpoint.endsWith('/claimableplayers')) {
                    const search = url.searchParams.get('search').trim().toLowerCase();
                    searches.push(search);
                    json = {
                        players: search === 'ave har' ? [roster[0]] : search === 'fixture' ? many : [],
                        claimedExactMatch: search === 'casey harbor',
                        claimedProfiles: search === 'casey harbor' ? [claimed] : []
                    };
                }
                if (endpoint.endsWith('/createandclaimplayer')) {
                    assert.deepEqual(route.request().postDataJSON(), {
                        firstName: 'Avery', lastName: 'Harbor', gender: 'Female'
                    });
                    creations++;
                    return route.fulfill({ json: { playerId: 42 } });
                }
                if (endpoint.endsWith('/claimplayer')) {
                    assert.deepEqual(route.request().postDataJSON(), { playerId: 21 });
                    claims++;
                    json = {};
                }
                if (endpoint.endsWith('/getsettingvalue')) json = { settingValue: day };
                if (endpoint.includes('/getlocksigninstatus/')) json = false;
                if (endpoint.includes('/getplayers/')) json = roster;
                if (endpoint.endsWith('/getsignedinplayers')) json = signedIn;
                if (endpoint.endsWith('/signinplayer')) {
                    const id = route.request().postDataJSON().playerId;
                    if (id === 23) return route.fulfill({ status: 500, json: {} });
                    const person = roster.find(person => person.id === id);
                    json = { ...person, playerId: id };
                    signedIn.push(json);
                }
                return route.fulfill({ json });
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(BASE_URL + '/');
            await page.getByRole('button', { name: 'Register', exact: true }).click();
            await page.locator('#registerEmail').fill('casey@example.invalid');
            await page.locator('#registerPassword').fill('FixturePassword123!');
            await page.locator('#confirmPassword').fill('FixturePassword123!');
            await page.locator('#registerFirstName').fill('Casey');
            await page.locator('#registerLastName').fill('Harbor');
            await page.screenshot({ path: path.join(output, theme + '-registration.png') });
            await page.locator('.registration-form').getByRole('button', { name: 'Submit' }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog.getByText(/already linked to an account/)).toBeVisible();
            await expect(dialog.getByRole('textbox', { name: 'Player name' })).toHaveValue('Casey Harbor');
            await expect(dialog.getByText('No player profiles match your search.')).toHaveCount(0);
            assert.deepEqual(searches, ['casey harbor']);
            await page.screenshot({ path: path.join(output, theme + '-claimed.png'), animations: 'disabled' });
            await expect(dialog.getByRole('button', { name: 'Claim Selected Player' })).toBeDisabled();
            await dialog.getByRole('button', { name: 'Recover Existing Account' }).click();
            await expect(dialog.getByRole('button', { name: 'Forgot Password' })).toBeVisible();
            await page.screenshot({ path: path.join(output, theme + '-recovery.png') });
            await dialog.getByRole('button', { name: 'Back' }).click();
            await dialog.getByRole('textbox', { name: 'Player name' }).fill('Nobody matches');
            await expect(dialog.getByText('No player profiles match your search.')).toBeVisible();
            await expect(dialog.getByRole('button', { name: 'Create New Player Profile' })).toBeInViewport();
            await page.screenshot({ path: path.join(output, theme + '-empty.png'), animations: 'disabled' });
            await dialog.getByRole('button', { name: 'Create New Player Profile' }).click();
            await expect(dialog.getByRole('textbox', { name: 'First Name' })).toHaveValue('Casey');
            await expect(dialog.getByText('Gender classification is used for league rankings and team balancing in the Scrambler.')).toBeVisible();
            await expect(dialog.getByText('Is Sub')).toHaveCount(0);
            await page.screenshot({ path: path.join(output, theme + '-create-player.png') });
            await dialog.getByRole('button', { name: 'Back' }).click();
            const field = dialog.getByRole('textbox', { name: 'Player name' });
            await field.fill('A');
            await field.fill('Ave');
            await field.fill(' Ave Har ');
            await dialog.getByRole('button', { name: 'Avery Harbor' }).click();
            assert.deepEqual(searches, ['casey harbor', 'nobody matches', 'ave har']);
            await field.fill('fixture');
            await expect(dialog.getByRole('button', { name: 'Fixture Player 59' })).toBeAttached();
            const resultsPane = dialog.locator('mat-dialog-content');
            await expect(dialog.getByRole('button', { name: 'Create New Player Profile' })).toBeInViewport();
            await page.screenshot({ path: path.join(output, theme + '-claim-long.png') });
            await resultsPane.evaluate(el => el.scrollTop = el.scrollHeight);
            await expect(dialog.getByRole('button', { name: 'Create New Player Profile' })).toBeInViewport();
            await expect(field).toBeInViewport();
            if (width < 500) {
                await field.focus();
                await page.evaluate(() => {
                    Object.defineProperty(visualViewport, 'height', {configurable: true, value: 380});
                    visualViewport.dispatchEvent(new Event('resize'));
                });
                const footer = await dialog.getByRole('button', { name: 'Create New Player Profile' }).boundingBox();
                assert(footer.y + footer.height < 380);
                await page.screenshot({ path: path.join(output, theme + '-claim-keyboard-viewport.png'), clip: {x: 0, y: 0, width, height: 380} });
                await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
            }
            await field.fill('Ave Har');
            await dialog.getByRole('button', { name: 'Avery Harbor' }).click();
            await page.screenshot({ path: path.join(output, theme + '-claim.png') });
            await dialog.getByRole('button', { name: 'Claim Selected Player' }).click();
            await expect(dialog).toHaveCount(0);
            assert.equal(registrations, 1);
            assert.equal(claims, 1);
            await page.reload();
            await page.getByRole('button', { name: 'Login', exact: true }).click();
            await page.locator('#loginEmail').fill('casey@example.invalid');
            await page.locator('#loginPassword').fill('FixturePassword123!');
            await page.locator('.login-form').getByRole('button', { name: 'Submit' }).click();
            await expect(page.getByRole('button', { name: 'Find or claim my player' })).toBeVisible();
            await expect(page).toHaveURL(BASE_URL + '/');
            await page.getByRole('button', { name: 'Find or claim my player' }).click();
            await expect(dialog.getByRole('heading', { name: 'Find Your Player Profile' })).toBeVisible();
            await dialog.getByRole('textbox', { name: 'Player name' }).fill('Ave Har');
            await expect(dialog.getByRole('button', { name: 'Avery Harbor' })).toBeVisible();
            await dialog.getByRole('button', { name: 'Create New Player Profile' }).click();
            await dialog.getByRole('textbox', { name: 'First Name' }).fill('Avery');
            await dialog.getByRole('textbox', { name: 'Last Name' }).fill('Harbor');
            await dialog.getByRole('combobox', { name: 'Gender' }).click();
            await page.getByRole('option', { name: 'Female' }).click();
            await dialog.getByRole('button', { name: 'Create Player' }).click();
            await expect(dialog).toHaveCount(0);
            assert.equal(creations, 1);
            await page.reload();
            await page.getByRole('button', { name: 'Find or claim my player' }).click();
            await dialog.getByLabel('Player name').fill('Casey Harbor');
            await dialog.getByRole('button', { name: /Recover Existing Account.*Casey Harbor/ }).click();
            await dialog.getByRole('link', { name: /Request account recovery/ }).click();
            await expect(page).toHaveURL(BASE_URL + '/account-recovery');
            await expect(page.locator('.selected-profile')).toContainText('Casey Harbor');
            await page.screenshot({ path: path.join(output, theme + '-recovery-from-claim.png') });
            await page.getByRole('button', { name: 'Change profile' }).click();
            await page.getByLabel('Player name').fill('No One');
            await expect(page.getByText('No registered player account matches this search.', { exact: false })).toBeVisible();
            await page.screenshot({ path: path.join(output, theme + '-recovery-empty.png') });
            const search = page.getByLabel('Player name');
            searchFailure = 'html';
            await search.fill('Harbor');
            await expect(page.getByRole('alert')).toContainText('does not have the recovery search endpoint');
            searchFailure = 'offline';
            await page.getByRole('button', { name: 'Retry search' }).click();
            await expect(page.getByRole('alert')).toContainText('Check your connection');
            searchFailure = 'server';
            await page.getByRole('button', { name: 'Retry search' }).click();
            await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
            searchFailure = 'shape';
            await page.getByRole('button', { name: 'Retry search' }).click();
            await expect(page.getByRole('alert')).toContainText('unexpected response');
            searchFailure = '';
            const beforeTyping = recoverySearches.length;
            await search.fill('Ca');
            await search.fill('Casey');
            await search.fill('CaSeY Harbor');
            await expect(page.getByRole('button', { name: 'Casey Harbor Other League' })).toBeVisible();
            assert.deepEqual(recoverySearches.slice(beforeTyping), ['casey harbor']);
            const beforeDuplicate = recoverySearches.length;
            await search.fill('  casey   HARBOR ');
            await expect(page.getByRole('button', { name: 'Casey Harbor Other League' })).toBeVisible();
            await page.waitForTimeout(350);
            assert.equal(recoverySearches.length, beforeDuplicate);
            const sentOld = page.waitForRequest(request => new URL(request.url()).searchParams.get('search') === 'Ch');
            await search.fill('Ch');
            await sentOld;
            await search.fill('Harbor');
            await expect(page.getByRole('button', { name: 'Casey Harbor Other League' })).toBeVisible();
            await expect(page.getByRole('alert')).toHaveCount(0);
            await search.fill('');
            await expect(page.locator('.profile-matches')).toHaveCount(0);
            await search.fill('Harbor');
            await expect(page.getByRole('button', { name: 'Casey Harbor Other League' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Obsolete Search' })).toHaveCount(0);
            await page.screenshot({ path: path.join(output, theme + '-recovery-multiple.png') });
            await page.getByRole('button', { name: 'Casey Harbor Fixture League' }).click();
            await page.getByLabel('New contact email').fill('recovery@example.invalid');
            await page.getByLabel('Information for the reviewer').fill('   ');
            await expect(page.getByRole('button', { name: 'Send verification code' })).toBeDisabled();
            await page.getByLabel('Information for the reviewer').fill('help');
            await page.screenshot({ path: path.join(output, theme + '-recovery-request.png') });
            await page.getByRole('button', { name: 'Send verification code' }).click();
            await expect(page.getByLabel('Verification code')).toBeVisible();
            await expect(page.getByText(/check recovery@example.invalid/)).toBeVisible();
            await page.getByRole('button', { name: 'Resend code' }).click();
            await expect(page.getByText(/Wait one minute/)).toBeVisible();
            await page.evaluate(() => {
                const key = 'league-hub-recovery-verification';
                const saved = JSON.parse(sessionStorage.getItem(key));
                saved.retryAfter = 0;
                sessionStorage.setItem(key, JSON.stringify(saved));
            });
            await page.reload();
            await page.getByRole('button', { name: 'Resend code' }).click();
            await expect(page.getByText(/If a new code can be sent/)).toBeVisible();
            assert.equal(resent, 1);
            await page.screenshot({ path: path.join(output, theme + '-verification.png') });
            await page.getByLabel('Verification code').fill('12345678');
            await page.getByRole('button', { name: 'Verify email' }).click();
            await expect(page.getByRole('status').filter({ hasText: /Email verified/ })).toBeVisible();
            const leavingPage = await context.newPage();
            await leavingPage.goto(BASE_URL + '/account-recovery');
            await Promise.all([
                leavingPage.waitForRequest(request => new URL(request.url()).searchParams.get('search') === 'Ch'),
                leavingPage.getByRole('searchbox', { name: 'Player name' }).fill('Ch')
            ]);
            await leavingPage.goto(BASE_URL + '/');
            await expect(leavingPage.locator('.profile-matches')).toHaveCount(0);
            await leavingPage.close();
            role = 'Admin';
            authenticated = true;
            reviewDelay = 500;
            reviewFailure = 500;
            await page.goto(BASE_URL + '/recovery-review');
            if (width < 500) {
                await page.getByRole('button', { name: 'Open navigation' }).click();
                await expect(page.locator('#navigation-drawer').getByRole('link', { name: 'Recovery Review' })).toBeVisible();
                await page.screenshot({ path: path.join(output, theme + '-account-menu.png') });
                await page.getByRole('button', { name: 'Close navigation' }).click();
            } else {
                await page.getByRole('button', { name: 'Account' }).click();
                await expect(page.getByRole('menuitem', { name: 'Recovery Review' })).toBeVisible();
                await page.screenshot({ path: path.join(output, theme + '-account-menu.png') });
                await page.keyboard.press('Escape');
            }
            await expect(page.getByText('Loading recovery requests')).toBeVisible();
            await expect(page.getByRole('alert')).toContainText('Recovery requests could not be loaded');
            reviewDelay = 0;
            await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
            reviewFailure = 0;
            reviewEmpty = true;
            await page.getByRole('button', { name: 'Retry' }).click();
            await expect(page.getByText('No pending recovery requests to review.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
            reviewEmpty = false;
            await page.reload();
            await page.getByRole('button', { name: 'Next' }).click();
            await expect(page.getByText('Page 2 · 1 requests')).toBeVisible();
            await page.getByRole('button', { name: 'Previous' }).click();
            await page.getByRole('button', { name: 'Review this request' }).click();
            await page.getByLabel('Decision', { exact: true }).selectOption('approve');
            await page.getByLabel('Decision Notes (Optional)').fill(theme === 'classic' ? '' : theme === 'navy' ? 'yes' : 'Independent contact verified using fixture records.');
            await expect(page.getByRole('button', { name: 'Record decision' })).toBeDisabled();
            await page.getByLabel('I independently verified account ownership.').check();
            for (const reviewWidth of [390, 768, 1280, 1920]) {
                await page.setViewportSize({width: reviewWidth, height: 900});
                await page.screenshot({ path: path.join(output, theme + '-recovery-review-' + reviewWidth + '.png'), fullPage: true });
            }
            await page.setViewportSize({width, height: 900});
            await page.getByRole('button', { name: 'Record decision' }).click();
            await expect(page.getByText('No pending recovery requests to review.')).toBeVisible();
            const status = page.locator('.review-filter select');
            await status.selectOption('approved');
            await expect(page.getByText('Approved by administrator 1')).toBeVisible();
            await status.selectOption('rejected');
            await expect(page.getByText('Declined by administrator 1')).toBeVisible();
            await status.selectOption('expired');
            await expect(page.locator('article').getByText('Expired', { exact: true })).toBeVisible();
            reviewFailure = 403;
            await page.reload();
            await expect(page.getByRole('alert')).toContainText('Sign in as an Application Administrator');
            await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
            reviewFailure = 0;
            assert.equal(decision.independentlyVerified, true);
            decision = undefined;
            await page.reload();
            await page.getByRole('button', { name: 'Review this request' }).click();
            await page.getByLabel('Decision', { exact: true }).selectOption('reject');
            await expect(page.getByLabel('Decision Notes (Optional)')).toHaveValue('');
            await expect(page.getByLabel('I independently verified account ownership.')).toHaveCount(0);
            await page.getByRole('button', { name: 'Record decision' }).click();
            await expect(page.getByText('No pending recovery requests to review.')).toBeVisible();
            assert.deepEqual(decision, { approve: false, decisionNotes: '', independentlyVerified: false });
            await page.goto(BASE_URL + '/change-email');
            await page.getByLabel('New contact email').fill('changed@example.invalid');
            await page.getByLabel('Current password').fill('FixturePassword123!');
            await page.getByRole('button', { name: 'Send verification code' }).click();
            await page.getByLabel('Verification code').fill('12345678');
            await page.getByRole('button', { name: 'Verify email' }).click();
            await expect(page.getByRole('status').filter({ hasText: /Email changed/ })).toBeVisible();
            await page.goto(BASE_URL + '/sign-in');
            async function signIn(name) {
                await page.locator('.player-card').filter({ hasText: name }).click();
                await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
            }
            await signIn('Avery');
            await expect(page.getByText('Avery Harbor has been signed in.')).toBeVisible();
            await signIn('Casey');
            await expect(page.getByText('Casey Harbor has been signed in.')).toBeVisible();
            await expect(page.getByText('Avery Harbor has been signed in.')).toHaveCount(0);
            await expect(page.locator('.signed-in-players-table tbody tr')).toHaveCount(2);
            await page.screenshot({ path: path.join(output, theme + '-sign-in.png') });
            if (theme === 'navy') await expect(page.getByText('Casey Harbor has been signed in.')).toHaveCount(0, { timeout: 4500 });
            else {
                await page.locator('mat-snack-bar-container').getByRole('button', { name: 'OK' }).click();
                await expect(page.getByText('Casey Harbor has been signed in.')).toHaveCount(0);
            }
            await signIn('Jordan');
            await expect(page.getByRole('dialog')).toContainText('Unable to sign in this player.');
            await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
            assert.deepEqual(errors, []);
            await context.close();
        }
        console.log('Registration, profile modal and nonblocking sign-in notification checks passed.');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

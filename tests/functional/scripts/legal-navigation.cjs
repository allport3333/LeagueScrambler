const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const pickupId = 'd3512b60-7316-4af1-8621-55dec8e48103';

(async () => {
    assert(process.env.LEAGUE_TEST_DIST, 'Use a local fixture bundle.');
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        for (const [theme, width, signedIn] of [['classic', 1366, false], ['navy', 390, false], ['charcoal', 768, true]]) {
            const context = await browser.newContext({serviceWorkers: 'block', viewport: {width, height: 850}});
            await context.addInitScript(theme => localStorage.setItem('league-hub-appearance', theme), theme);
            await context.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.hostname === 'fonts.gstatic.com' && !url.pathname.includes('/materialicons/')) return route.abort();
                if (await serveAsset(route)) return;
                if (url.origin !== origin || !url.pathname.startsWith('/api/') || route.request().method() !== 'GET') return route.abort();
                const endpoint = url.pathname.toLowerCase();
                let data = [];
                if (endpoint.endsWith('/isauthenticated')) data = signedIn;
                else if (endpoint.endsWith('/getusersrole')) data = {role: 'Player'};
                else if (endpoint.endsWith('/getusersplayer')) data = {playerId: 1};
                else if (endpoint === '/api/pickup/catalog') data = ['Wallyball'];
                else if (endpoint === '/api/pickup/sessions/' + pickupId) data = {
                    id: pickupId, name: 'Legal Navigation Fixture', sport: 'Wallyball',
                    startsUtc: '2026-12-12T20:00:00Z', endsUtc: '2026-12-12T22:00:00Z',
                    venue: { name: 'Fixture Gym', city: 'Roseville', timeZone: 'America/Detroit' },
                    state: 1, registrationOpen: true, confirmed: 0, capacity: null
                };
                await route.fulfill({json: data});
            });
            const page = await context.newPage();
            const footer = page.getByRole('navigation', {name: 'Legal information'});
            for (const [route, title, other] of [
                ['/privacy', 'Privacy Policy', 'Terms of Service'],
                ['/terms', 'Terms of Service', 'Privacy Policy']
            ]) {
                await page.goto(origin + route);
                await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
                await page.reload();
                await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                const appearance = await page.locator('.legal-document').evaluate(el => {
                    const style = getComputedStyle(el);
                    return [style.color, style.backgroundColor];
                });
                assert.notEqual(...appearance);
                await footer.getByRole('link', {name: other}).click();
                await expect(page.getByRole('heading', {name: other, exact: true})).toBeVisible();
            }
            if (!signedIn) {
                await page.goto(origin + '/?toggleLoginForm=true');
                await expect(page.locator('.legal-form-links').getByRole('link', {name: 'Privacy Policy'})).toBeVisible();
                await page.goto(origin + '/');
                await page.getByRole('button', {name: 'Register', exact: true}).click();
                await expect(page.locator('.registration-form').getByRole('link', {name: 'Terms of Service'})).toBeVisible();
                await page.goto(origin + '/pickup/' + pickupId);
                await page.getByRole('button', {name: 'Join as Guest', exact: true}).click();
                await expect(page.locator('.guest-form').getByRole('link', {name: 'Privacy Policy'})).toBeVisible();
            }
            await context.close();
        }
        console.log('Legal routes, refresh, footer and form links passed across three themes.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

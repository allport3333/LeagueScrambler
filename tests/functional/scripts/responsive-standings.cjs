const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, expect} = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');

const origin = 'https://localhost:5001';
const out = process.env.LEAGUE_TEST_OUT;
const baseline = process.argv.includes('--baseline');
assert(out && process.env.LEAGUE_TEST_DIST);
fs.mkdirSync(out, {recursive: true});

(async () => {
    const browser = await chromium.launch({channel: 'chrome'});
    try {
        const page = await browser.newPage({serviceWorkers: 'block'});
        let rounds = 5;
        const roster = () => ['Aaron Bennett', 'Zachary Montgomery-Sutherland', 'Beth Nelson'].map((playerName, i) => ({
            playerId: 1 + i, playerName, isMale: i < 2, leagueDivisionId: i < 2 ? 1 : 2, leagueDivisionCode: i < 2 ? 'GM' : 'SM',
            scores: Array.from({length: rounds}, (_, round) => ({
                roundId: round + 1, scrambleNumber: round + 1, score: 10 + i + round, roundWon: i === 0,
                isSubScore: i === 1 && round === 0, hasSavedScore: true
            }))
        }));
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            // The fixture helper only provides a Material Icons font. Let text use system fallback fonts.
            if (url.hostname === 'fonts.gstatic.com' && !url.pathname.includes('/materialicons/')) return route.abort();
            if (await serveAsset(route)) return;
            if (url.origin !== origin || !url.pathname.startsWith('/api/') || route.request().method() !== 'GET') return route.abort();
            const endpoint = url.pathname.toLowerCase();
            let data = [];
            if (endpoint.endsWith('/isauthenticated')) data = true;
            else if (endpoint.endsWith('/getusersrole')) data = {role: 'Manager'};
            else if (endpoint.endsWith('/getusersplayer')) data = {playerId: 1};
            else if (/getuserleagues|getleagues/.test(endpoint)) data = [
                {id: 101, leagueName: 'Fixture League', eventTypeId: 1},
                {id: 102, leagueName: 'Fixture Cup', eventTypeId: 2, canManageTournament: true}
            ];
            else if (endpoint.includes('getbyleague')) data = {playerScores: roster(), maxRounds: rounds};
            else if (endpoint.includes('/league-standings/')) data = [
                {teamName: 'Montgomery County Volleyball Club', wins: 5, losses: 2, totalPoints: 440, division: 'Gold'},
                {teamName: 'Northside', wins: 4, losses: 3, totalPoints: 421, division: 'Gold'}
            ];
            else if (url.searchParams.has('settingName')) data = {settingValue: ({
                numberOfSubsAllowed: '100', subScorePercent: '50', dropLowest: '1', standingsType: 'round'
            })[url.searchParams.get('settingName')]};
            await route.fulfill({json: data});
        });
        const results = [];
        for (const [width, count, theme, league] of [
            [390, 22, 'navy', 102], [768, 12, 'charcoal', 101], [1366, 5, 'classic', 102],
            [1920, 10, 'navy', 101], [2560, 12, 'classic', 102], [3840, 22, 'charcoal', 102], [1366, 22, 'classic', 102]
        ]) {
            rounds = count;
            await page.setViewportSize({width, height: 900});
            await page.goto(origin + '/standings?leagueId=' + league);
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            if (width < 768) await page.locator('.mobile-table-toggle:visible').click();
            const table = page.locator('.compact-table:visible');
            await expect(table.locator('thead th')).toHaveCount(count + 5);
            const stats = await table.evaluate(el => {
                const cells = [...el.tBodies[0].rows[0].cells];
                const scroll = el.parentElement;
                return {
                    font: cells.map(cell => parseFloat(getComputedStyle(cell).fontSize)),
                    tableWidth: el.getBoundingClientRect().width,
                    overflow: scroll.scrollWidth - scroll.clientWidth,
                    pageOverflow: document.documentElement.scrollWidth - innerWidth
                };
            });
            results.push({width, count, theme, ...stats});
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({path: path.join(out, width + '-' + count + '-' + theme + '.png')});
            if (baseline) continue;
            assert(stats.pageOverflow <= 1, JSON.stringify({width, count, stats}));
            assert(stats.font[1] >= 15 && stats.font[2] >= 16 && stats.font.at(-1) >= 14, JSON.stringify(stats));
            if (width <= 768 || count === 22 && width === 1366) {
                assert(stats.overflow > 0);
                const frozen = await table.evaluate(el => {
                    const scroll = el.parentElement;
                    scroll.scrollLeft = scroll.scrollWidth;
                    const [rank, name] = el.tBodies[0].rows[0].cells;
                    return {left: rank.getBoundingClientRect().left - scroll.getBoundingClientRect().left,
                        gap: name.getBoundingClientRect().left - rank.getBoundingClientRect().right};
                });
                assert(Math.abs(frozen.left) <= 1 && Math.abs(frozen.gap) <= 1, JSON.stringify(frozen));
            }
            const region = table.locator('..');
            await region.evaluate(el => { el.scrollLeft = 0; });
            await table.getByRole('columnheader', {name: 'Player Name'}).click();
            const firstName = table.locator('tbody tr').first().locator('td').nth(1);
            const first = await firstName.innerText();
            await table.getByRole('columnheader', {name: 'Player Name'}).click();
            const second = await firstName.innerText();
            assert.deepEqual([first, second].sort(), ['Aaron Bennett', 'Zachary Montgomery-Sutherland']);
        }
        if (!baseline) {
            assert(results[2].font.at(-1) > results.at(-1).font.at(-1), 'Fewer rounds should allow larger scores at the same width.');
            await page.getByRole('tab', {name: 'GM', exact: true}).click();
            await expect(page.getByRole('tabpanel', {name: 'GM', exact: true}).getByRole('table')).toContainText('Aaron Bennett');
            await page.getByRole('tab', {name: 'SM', exact: true}).click();
            await page.getByRole('tab', {name: "Women's Standings", exact: true}).click();
            const silver = page.getByRole('tabpanel', {name: 'SM', exact: true}).getByRole('table');
            await expect(silver).toContainText('Beth Nelson');
            await page.getByRole('button', {name: 'Show Standings by Matchup'}).click();
            await expect(silver.getByRole('columnheader', {name: 'Matchup 1', exact: true})).toBeVisible();
            for (const width of [390, 1920, 3840]) {
                await page.setViewportSize({width, height: 900});
                await page.goto(origin + '/league-dashboard?leagueId=101');
                const teams = page.locator('app-league-team-standings table');
                await expect(teams.getByText('Montgomery County Volleyball Club')).toBeVisible();
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                if (width === 390) {
                    const result = await teams.evaluate(table => {
                        const scroll = table.parentElement;
                        scroll.scrollLeft = scroll.scrollWidth;
                        const [rank, name, , , points] = table.tBodies[0].rows[0].cells;
                        return {
                            scrolled: scroll.scrollLeft > 0, nameWidth: name.getBoundingClientRect().width,
                            gap: name.getBoundingClientRect().left - rank.getBoundingClientRect().right,
                            pointsVisible: points.getBoundingClientRect().right <= scroll.getBoundingClientRect().right + 1
                        };
                    });
                    assert(result.scrolled && result.nameWidth >= 114 && Math.abs(result.gap) <= 1 && result.pointsVisible, JSON.stringify(result));
                    await teams.locator('..').evaluate(el => { el.scrollLeft = 0; });
                }
                await page.screenshot({path: path.join(out, 'team-' + width + '.png')});
            }
        }
        fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(results, null, 2));
        console.log('Standings browser checks completed (' + (baseline ? 'before' : 'after') + ').');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

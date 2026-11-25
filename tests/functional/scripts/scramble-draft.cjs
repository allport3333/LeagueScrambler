const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const serveAsset = require('./fixture-asset.cjs');
const { BASE_URL, assertLocalUrl } = require('../helpers/safety.cjs');

const ids = process.env.LEAGUE_DRAFT_ROSTER
    ? JSON.parse(fs.readFileSync(process.env.LEAGUE_DRAFT_ROSTER, 'utf8'))
    : Array.from({ length: 80 }, (_, index) => ({ id: 1001 + index, isMale: index % 2 === 0 }));
const roster = ids.map((player, index) => ({
    ...player, firstName: 'Player', lastName: String(index + 1).padStart(2, '0'),
    gender: index === 11 ? 'Unspecified' : player.isMale ? 'Male' : 'Female'
}));
const league = { id: 101, leagueName: 'Draft Fixture League', eventTypeId: 1 };

(async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'no-preference' });
        let selectedCount = 12;
        const generations = [], saves = [], errors = [];
        await context.addInitScript(() => {
            sessionStorage.setItem('league-hub-selected-league', '101');
            window.print = () => {};
        });
        await context.route('**/*', async route => {
            if (await serveAsset(route)) return;
            let url;
            try { url = assertLocalUrl(route.request().url()); } catch { return route.abort(); }
            if (!url.pathname.startsWith('/api/')) return route.abort();
            const path = url.pathname.toLowerCase(), selected = roster.slice(0, selectedCount);
            let body = [];
            if (route.request().method() !== 'GET') {
                if (path.includes('/generatescramble/')) {
                    const input = route.request().postDataJSON();
                    generations.push(input);
                    body = input.kingQueenTeams.map((_, i) => ({ id: 501 + i, scrambleNumber: 12 }));
                } else if (path.includes('/savekingqueenteams/')) {
                    const input = route.request().postDataJSON();
                    saves.push(input);
                    body = { kingQueenTeams: input.kingQueenTeams.map(team => ({
                        ...team, kingQueenTeam: { ...team.kingQueenTeam, scrambleNumber: 12 }
                    })), byePlayers: input.byePlayers };
                } else return route.abort();
            } else if (path.endsWith('/isauthenticated')) body = true;
            else if (path.endsWith('/getusersrole')) body = { role: 'Admin' };
            else if (path.endsWith('/getusersplayer')) body = { playerId: 1001 };
            else if (path.endsWith('/getuserleagues') || path.endsWith('/getleagues')) body = [league];
            else if (path.includes('managementaccess')) body = { role: 'Admin', canManage: true };
            else if (path.includes('getsignedinplayersasplayers')) body = selected;
            else if (path.includes('getsignedinplayers')) body = selected.map(player => ({ ...player, playerId: player.id }));
            else if (path.includes('allmale')) body = selected.filter(player => player.isMale);
            else if (path.includes('allfemale')) body = selected.filter(player => !player.isMale);
            else if (/getplayers|selectleague|getallplayers/.test(path)) body = selected;
            else if (url.searchParams.has('settingName')) body = { settingValue: '0' };
            return route.fulfill({ json: body });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        const stage = page.locator('.draft-stage');
        const assigned = count => stage.getByRole('progressbar').getAttribute('value').then(value => Number(value) === count);
        const destination = async id => stage.locator('[data-slot="' + id + '"]').evaluate(el => Number(el.closest('[data-team]').dataset.team));
        const allVisible = async () => stage.evaluate(el => {
            const board = el.querySelector('.board');
            const bounds = board.getBoundingClientRect();
            const cards = [...board.querySelectorAll('.matchup')].map(card => card.getBoundingClientRect());
            const controls = el.querySelector('.controls').getBoundingClientRect();
            return el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2 &&
                cards.every(card => card.bottom <= bounds.bottom + 2) && controls.bottom <= innerHeight + 2;
        });

        const viewportOnly = process.argv.includes('--viewport');
        const topPasses = process.argv.includes('--top-passes');
        const reducedCompletion = process.argv.includes('--reduced-completion');
        const sizes = topPasses ? [[77, 1366, 768, 'classic']] : reducedCompletion ? [[77, 1440, 900, 'charcoal']] : viewportOnly ? (process.argv.includes('--mobile-only') ? [[77, 390, 844, 'navy']] :
            [[77, 1366, 768, 'classic'], [77, 390, 844, 'navy']]) : [
            [12, 1366, 768, 'classic'], [20, 390, 844, 'navy'], [32, 1280, 720, 'charcoal'],
            [48, 768, 1024, 'classic'], [64, 390, 740, 'charcoal'], [80, 1920, 1080, 'navy']
        ];
        for (const [count, width, height, theme] of process.argv.includes('--team-config') ? sizes.filter(([size]) => [32, 48].includes(size)) : sizes) {
            selectedCount = count;
            await page.setViewportSize({ width, height });
            if (reducedCompletion) await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(BASE_URL + '/scrambler');
            await page.evaluate(value => localStorage.setItem('league-hub-appearance', value), theme);
            await page.reload();
            const watch = page.getByRole('checkbox', { name: 'Watch the Scramble' });
            await expect(watch).not.toBeChecked();
            await page.getByRole('button', { name: 'Select All', exact: true }).click();
            if (count === 32 || count === 48) {
                if (count === 48) await page.getByRole('radio', { name: 'Number of Teams' }).check();
                await page.locator('.active-team-configuration mat-select').click();
                await page.getByRole('option', { name: count === 32 ? '3' : '2', exact: true }).click();
            }
            if (count === 12) {
                await page.getByRole('button', { name: 'Scramble Players', exact: true }).click();
                await expect(page.getByRole('heading', { name: 'Scramble Results' })).toBeVisible();
                await expect(stage).toHaveCount(0);
                await page.getByRole('button', { name: 'Set Top Player', exact: true }).nth(0).click();
                await page.getByRole('button', { name: 'Set Top Player', exact: true }).nth(0).click();
                await page.getByRole('button', { name: 'Set Bye Player', exact: true }).last().click();
            }
            if (topPasses) {
                const option = page.getByRole('button', { name: 'Set Top Player', exact: true }).first();
                for (let count = 0; count < 20; count++) await option.click();
            }
            const before = generations.length;
            await watch.check();
            await page.getByRole('button', { name: 'Scramble & Watch', exact: true }).click();
            await expect(stage.getByRole('progressbar')).toHaveAttribute('max', String(count));
            assert.equal(generations.length, before + 1);
            const generated = generations.at(-1).kingQueenTeams.map(team => team.players.map(player => player.id));
            assert(await allVisible(), 'One-screen layout for ' + count);
            if (count === 32) assert.equal(Math.max(...generated.map(team => team.length)), 3);
            if (count === 48) assert.deepEqual(generated.map(team => team.length), [24, 24]);
            assert(await stage.locator('[data-pool]').count() <= 32);
            if (width < 500) assert(await stage.locator('[data-pool]').count() <= 9);
            const initialSlots = await stage.locator('.pool-slot').evaluateAll(slots => slots.map(slot => slot.getBoundingClientRect().top));
            if (count === 12) {
                await expect(stage.locator('.flight')).toBeVisible();
                const inFlight = stage.locator('.pool-player.in-flight');
                const player = Number(await inFlight.getAttribute('data-pool'));
                await expect(inFlight).toHaveClass(/top/);
                assert.equal(await destination(player), generated.findIndex(team => team.includes(player)) + 1);
                const motion = await stage.locator('.flight').evaluate(el => el.getAnimations()[0].effect.getKeyframes().map(frame => frame.transform));
                assert.notEqual(motion[0], motion.at(-1));
                await stage.getByRole('button', { name: 'Pause', exact: true }).click();
                await expect.poll(() => assigned(1)).toBe(true);
                await page.waitForTimeout(400);
                assert(await assigned(1));
                assert.deepEqual(await stage.locator('.pool-slot').evaluateAll(slots => slots.map(slot => slot.getBoundingClientRect().top)), initialSlots);
                await stage.getByRole('button', { name: 'Resume' }).click();
                await expect(stage.locator('.opposing-highlight').first()).toBeVisible();
            }
            if (topPasses) {
                const watchSequence = () => stage.evaluate(root => {
                    window.topPassSequence = [];
                    const seen = new Set();
                    const observer = new MutationObserver(() => {
                        for (const row of root.querySelectorAll('.assignment.filled')) {
                            const id = Number(row.dataset.slot);
                            if (seen.has(id)) continue;
                            seen.add(id);
                            const matchup = row.closest('[data-matchup]');
                            window.topPassSequence.push({ id, top: !!row.querySelector('.top-mark'),
                                matchup: Number(matchup.dataset.matchup), highlighted: matchup.classList.contains('opposing-highlight') });
                        }
                        if (seen.size >= 20) observer.disconnect();
                    });
                    observer.observe(root, { subtree: true, attributes: true, childList: true });
                });
                await expect(stage.getByRole('progressbar')).toHaveAttribute('value', '0');
                await watchSequence();
                await stage.getByLabel('Speed').selectOption('Fast');
                await expect.poll(() => page.evaluate(() => window.topPassSequence.length), { timeout: 12000 }).toBe(20);
                const revealed = await page.evaluate(() => window.topPassSequence);
                assert(revealed.every(reveal => reveal.top));
                assert.equal(new Set(revealed.slice(0, 10).map(reveal => reveal.matchup)).size, 10);
                assert.equal(new Set(revealed.slice(10).map(reveal => reveal.matchup)).size, 10);
                assert(revealed.every((reveal, index) => index === 0 || reveal.matchup !== revealed[index - 1].matchup));
                assert(revealed.slice(0, 10).every(reveal => !reveal.highlighted));
                assert(revealed.slice(10).every(reveal => reveal.highlighted));
                await stage.getByRole('button', { name: 'Skip Animation' }).click();
                await expect(stage.getByText('Teams Are Ready!')).toBeVisible();
                const actual = await stage.locator('[data-team]').evaluateAll(teams => teams.map(team =>
                    [...team.querySelectorAll('.filled')].map(player => Number(player.dataset.slot))));
                assert.deepEqual(actual, generated);
                await stage.getByRole('button', { name: 'Replay Scramble' }).click();
                await expect(stage.getByRole('progressbar')).toHaveAttribute('value', '0');
                await watchSequence();
                await expect.poll(() => page.evaluate(() => window.topPassSequence.length), { timeout: 12000 }).toBe(20);
                assert.deepEqual(await page.evaluate(() => window.topPassSequence), revealed);
            }
            if (viewportOnly) {
                const geometry = () => stage.evaluate(root => {
                    const pool = root.querySelector('.waiting'), row = root.querySelector('.assignment');
                    return { pool: Math.round(pool.getBoundingClientRect().height), rows: new Set(
                        [...root.querySelectorAll('.pool-slot')].map(slot => slot.offsetTop)).size,
                        assignment: Math.round(row.getBoundingClientRect().height), font: parseFloat(getComputedStyle(row).fontSize) };
                });
                const initialGeometry = await geometry();
                await stage.evaluate(root => {
                    window.poolTransition = { movementOverlap: false, durations: [] };
                    root.addEventListener('transitionstart', event => {
                        if (event.propertyName !== 'height' || !event.target.matches('.waiting')) return;
                        window.poolTransition.movementOverlap ||= !root.querySelector('.flight').hidden;
                        window.poolTransition.durations.push(performance.now());
                    });
                    root.addEventListener('transitionend', event => {
                        if (event.propertyName === 'height' && event.target.matches('.waiting'))
                            window.poolTransition.durations.push(performance.now());
                    });
                });
                const poolLayout = () => stage.locator('.pool-slot').evaluateAll(slots => {
                    const boxes = slots.map(slot => slot.getBoundingClientRect());
                    return { rows: new Set(boxes.map(box => box.top)).size, slots: boxes.length, width: boxes[0].width };
                });
                await expect.poll(poolLayout).toMatchObject({ rows: 3, slots: width < 500 ? 9 : 24 });
                assert((await poolLayout()).width >= (width < 500 ? 110 : 135));
                const initialPool = await stage.locator('[data-pool]').evaluateAll(cards => cards.map(card => card.dataset.pool));
                await expect.poll(() => stage.locator('[data-pool]').evaluateAll((cards, ids) =>
                    cards.some(card => !ids.includes(card.dataset.pool)), initialPool)).toBe(true);
                assert(await allVisible());
                if (width > 500) {
                    await expect(stage.locator('.matchup')).toHaveCount(10);
                    assert((await stage.locator('.matchup').first().boundingBox()).height > 180);
                } else {
                    const currentProgress = Number(await stage.getByRole('progressbar').getAttribute('value'));
                    await page.setViewportSize({ width, height: 650 });
                    await expect.poll(poolLayout).toMatchObject({ rows: 2, slots: 6 });
                    await expect.poll(async () => Number(await stage.getByRole('progressbar').getAttribute('value')))
                        .toBeGreaterThan(currentProgress);
                    assert(await allVisible());
                    await page.setViewportSize({ width, height });
                    await expect.poll(poolLayout).toMatchObject({ rows: 3, slots: 9 });
                }
                assert.deepEqual(await stage.locator('.pool-slot').evaluateAll(slots => {
                    const tops = slots.map(slot => slot.getBoundingClientRect().top);
                    return tops.map(top => Math.round(top - tops[0]));
                }), initialSlots.map(top => Math.round(top - initialSlots[0])));
                await stage.screenshot({ path: require('node:path').join(process.env.LEAGUE_TEST_OUT, '77-player-' + width + '.png') });
                await stage.getByRole('button', { name: 'Fullscreen', exact: true }).click();
                await expect(stage.getByRole('button', { name: 'Exit Fullscreen', exact: true })).toBeVisible();
                await stage.getByRole('button', { name: 'Exit Fullscreen', exact: true }).click();
                await expect(stage.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
                const progress = Number(await stage.getByRole('progressbar').getAttribute('value'));
                await stage.getByRole('button', { name: 'Pause', exact: true }).click();
                await expect(stage.locator('.flight')).toBeHidden();
                assert(Number(await stage.getByRole('progressbar').getAttribute('value')) >= progress);
                await stage.getByRole('button', { name: 'Resume' }).click();
                await stage.getByLabel('Speed').selectOption('Fast');
                if (width > 500) {
                    let midGeometry;
                    await expect.poll(async () => Number(await stage.getByRole('progressbar').getAttribute('value')),
                        { timeout: 22000 }).toBeGreaterThanOrEqual(40);
                    midGeometry = await geometry();
                    assert.equal(midGeometry.rows, initialGeometry.rows);
                    await stage.evaluate(root => {
                        const observer = new MutationObserver(() => {
                            if (root.querySelector('progress').value < 65 || !root.classList.contains('reallocating')) return;
                            observer.disconnect();
                            root.querySelector('[data-pause]').click();
                        });
                        observer.observe(root, { subtree: true, attributes: true, childList: true });
                    });
                    await expect(stage.getByRole('button', { name: 'Resume' })).toBeVisible({ timeout: 22000 });
                    await expect(stage).not.toHaveClass(/reallocating/);
                    const near = await geometry();
                    assert(near.rows < midGeometry.rows && near.assignment > midGeometry.assignment);
                    assert(await allVisible());
                    await stage.screenshot({ path: require('node:path').join(process.env.LEAGUE_TEST_OUT, '77-player-near-complete.png') });
                    await stage.getByRole('button', { name: 'Resume' }).click();
                    await expect(stage.getByText('Teams Are Ready!')).toBeVisible({ timeout: 12000 });
                    const completed = await geometry();
                    assert.equal(completed.pool, 0);
                    assert(completed.assignment > near.assignment && completed.font > initialGeometry.font);
                    assert(await allVisible());
                    const transitions = await page.evaluate(() => window.poolTransition);
                    assert(!transitions.movementOverlap);
                    assert(transitions.durations.length >= 4);
                    assert(transitions.durations[1] - transitions.durations[0] >= 380);
                    await stage.screenshot({ path: require('node:path').join(process.env.LEAGUE_TEST_OUT, '77-player-complete.png') });
                    const actual = await stage.locator('[data-team]').evaluateAll(teams => teams.map(team =>
                        [...team.querySelectorAll('.filled')].map(player => Number(player.dataset.slot))));
                    assert.deepEqual(actual, generated);
                    await stage.getByRole('button', { name: 'Replay Scramble' }).click();
                    await expect(stage.getByRole('progressbar')).toHaveAttribute('value', '0');
                } else {
                    await expect(stage.locator('.flight')).toBeVisible();
                    const current = Number(await stage.locator('.pool-player.in-flight').getAttribute('data-pool'));
                    assert(await destination(current) > 0);
                    const originalScroll = await page.evaluate(() => scrollY);
                    await expect(stage.getByText('Teams Are Ready!')).toBeVisible({ timeout: 45000 });
                    assert.equal(await page.evaluate(() => scrollY), originalScroll);
                    const previousView = stage.getByRole('button', { name: 'Previous view' });
                    const nextView = stage.getByRole('button', { name: 'Next view' });
                    while (await previousView.isEnabled()) await previousView.click();
                    const assignments = new Map();
                    for (;;) {
                        const visibleTeams = await stage.locator('[data-team]').evaluateAll(teams => teams.map(team => [
                            Number(team.dataset.team), [...team.querySelectorAll('.filled')].map(player => Number(player.dataset.slot))
                        ]));
                        for (const [team, players] of visibleTeams) assignments.set(team, players);
                        assert(await allVisible());
                        if (!(await nextView.isEnabled())) break;
                        await nextView.click();
                    }
                    assert.deepEqual([...assignments].sort((a, b) => a[0] - b[0]).map(entry => entry[1]), generated);
                    const completed = await geometry();
                    assert.equal(completed.pool, 0);
                    assert(completed.assignment > initialGeometry.assignment);
                    await stage.getByRole('button', { name: 'Replay Scramble' }).click();
                    await expect(stage.getByRole('progressbar')).toHaveAttribute('value', '0');
                }
            }
            if (count === 64) {
                await expect(stage).toContainText(/View \d+ \/ \d+/);
                await expect(stage.locator('.flight')).toBeVisible();
                const current = Number(await stage.locator('.pool-player.in-flight').getAttribute('data-pool'));
                assert(await destination(current) > 0);
            }
            if (count === 80) {
                await expect(stage.getByRole('progressbar')).toHaveAttribute('value', '0');
                const firstPlayer = await stage.locator('[data-pool]').first().getAttribute('data-pool');
                await expect(stage.locator('.matchup')).toHaveCount(generated.length / 2);
                await expect(stage.locator('[data-pool]')).toHaveCount(32);
                const initialPool = await stage.locator('[data-pool]').evaluateAll(cards => cards.map(card => card.dataset.pool));
                await expect.poll(() => stage.locator('[data-pool]').evaluateAll((cards, ids) =>
                    cards.some(card => !ids.includes(card.dataset.pool)), initialPool)).toBe(true);
                assert.equal(new Set(await stage.locator('[data-pool]').evaluateAll(cards => cards.map(card => card.dataset.pool))).size, 32);
                const progressBeforeFullscreen = Number(await stage.getByRole('progressbar').getAttribute('value'));
                await stage.getByRole('button', { name: 'Fullscreen', exact: true }).click();
                await expect(stage.getByRole('button', { name: 'Exit Fullscreen', exact: true })).toBeVisible();
                await stage.getByRole('button', { name: 'Exit Fullscreen', exact: true }).click();
                assert(Number(await stage.getByRole('progressbar').getAttribute('value')) >= progressBeforeFullscreen);
                await stage.evaluate(root => {
                    window.draftBalance = [];
                    let last = -1;
                    const monitor = new MutationObserver(() => {
                        const progress = root.querySelector('progress').value;
                        if (progress === last) return;
                        last = progress;
                        const counts = [...root.querySelectorAll('[data-team]')].map(team => team.querySelectorAll('.filled').length);
                        if (counts.length === 20) window.draftBalance.push(Math.max(...counts) - Math.min(...counts));
                        if (progress === 80) monitor.disconnect();
                    });
                    monitor.observe(root, { subtree: true, attributes: true, childList: true });
                });
                await stage.getByLabel('Speed').selectOption('Fast');
                const scrollBefore = await page.evaluate(() => scrollY);
                await expect(stage.getByText('Teams Are Ready!')).toBeVisible({ timeout: 40000 });
                assert.equal(await stage.locator('.filled').count(), 80);
                const spread = await page.evaluate(() => window.draftBalance);
                assert(spread.length >= 70 && spread.every(value => value <= 1), 'Each visible pass keeps equal teams within one player');
                assert.equal(await page.evaluate(() => scrollY), scrollBefore);
                const actual = await stage.locator('[data-team]').evaluateAll(teams => teams.map(team =>
                    [...team.querySelectorAll('.filled')].map(player => Number(player.dataset.slot))));
                assert.deepEqual(actual, generated);
                await stage.screenshot({ path: require('node:path').join(process.env.LEAGUE_TEST_OUT, '80-player-desktop.png') });
                await page.setViewportSize({ width: 390, height: 844 });
                await stage.getByRole('button', { name: 'Replay Scramble' }).click();
                await expect(stage.getByRole('progressbar')).toHaveAttribute('value', '0');
                assert.equal(await stage.locator('[data-pool]').first().getAttribute('data-pool'), firstPlayer);
                await expect(stage).toContainText(/View \d+ \/ \d+/);
                assert(await allVisible(), '80-player mobile playback fits the viewport');
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await stage.getByRole('button', { name: 'Pause', exact: true }).click();
                await expect(stage.locator('.flight')).toBeHidden();
            }
            await stage.getByRole('button', { name: 'Skip Animation' }).click();
            await expect(stage.getByText('Teams Are Ready!')).toBeVisible();
            assert(await assigned(count));
            assert.equal(await stage.locator('.waiting').evaluate(el => el.getBoundingClientRect().height), 0);
            if (reducedCompletion) assert.equal(await stage.locator('.waiting').evaluate(el => el.getAnimations().length), 0);
            assert.equal(generations.length, before + 1);
            assert(await allVisible(), 'Completed one-screen layout for ' + count);
            const styledIds = await stage.locator('.assignment.filled').evaluateAll(rows => rows.map(row => {
                const expected = row.classList.contains('draft-male') ? '--hub-male' :
                    row.classList.contains('draft-female') ? '--hub-female' : '--hub-row-alt';
                const probe = document.createElement('span');
                const fallback = { '--hub-male': '#dbfdff', '--hub-female': '#fce0ff', '--hub-row-alt': '#eff4fa' }; probe.style.backgroundColor = 'var(' + expected + ',' + fallback[expected] + ')';
                row.append(probe);
                const matches = getComputedStyle(row).backgroundColor === getComputedStyle(probe).backgroundColor;
                probe.remove();
                return { id: Number(row.dataset.slot), expected, matches };
            }));
            assert(styledIds.length > 0 && styledIds.every(row => row.matches));
            for (const row of styledIds) {
                const gender = roster.find(player => player.id === row.id).gender;
                assert.equal(row.expected, gender === 'Unspecified' ? '--hub-row-alt' : '--hub-' + gender.toLowerCase());
            }
            if (count === 12 || count === 80) {
                assert.equal(saves.length, count === 12 ? 0 : 1);
                await stage.getByRole('button', { name: 'Save Scramble' }).click();
                try { await expect(stage.getByRole('button', { name: 'Print Matchups' })).toBeEnabled(); }
                catch (error) { console.error('Save requests:', saves.length, 'footer:', await stage.locator('.playback').innerText()); throw error; }
                const written = saves.at(-1);
                assert.deepEqual(written.kingQueenTeams.map(team => team.players.map(player => player.id)), generated);
                assert.equal((written.byePlayers ?? []).length, count === 12 ? 1 : 0);
                if (count === 12) {
                    await page.evaluate(() => {
                        window.open = () => ({
                            document: { open() {}, write(html) { window.draftPrintedHtml = html; }, close() {} },
                            print() {}, close() {}
                        });
                    });
                    await stage.getByRole('button', { name: 'Print Matchups' }).click();
                    const printed = await page.evaluate(() => window.draftPrintedHtml);
                    assert(printed.includes('printed-matchup'));
                    assert(!printed.includes('draft-stage'));
                }
            }
            await stage.getByRole('button', { name: 'Exit presentation' }).click();
            await expect(stage).toHaveCount(0);
            await expect(page.getByRole('heading', { name: 'Scramble Results' })).toBeVisible();
            console.log('Draft browser fixture passed for ' + count + ' players at ' + width + 'x' + height + '.');
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

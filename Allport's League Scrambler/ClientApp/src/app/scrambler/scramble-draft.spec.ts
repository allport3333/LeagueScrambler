import { describe, expect, it } from 'vitest';
import { generateScramble } from './scramble-engine';
import { buildScrambleDraft } from './scramble-draft';

describe('Scramble draft', () => {
    it.each([12, 20, 32, 48, 64, 80])('reveals the existing assignments exactly once for %i players', async count => {
        const selected = Array.from({ length: count }, (_, index) => ({
            id: index + 1, name: 'Duplicate display name', isMale: index % 2 === 0, isByePlayer: index === count - 1
        }));
        const topIds = [1, 2, 3];
        const result = await generateScramble({
            players: selected, mode: 'balanced', maxTeamSize: 4,
            topIds, configuredTop: topIds.map((playerId, index) => ({ playerId, rank: index + 1 }))
        });
        expect(result.status).toBe('success');
        const teams = result.teams.map((players, index) => ({ id: index + 1, playerIds: players.map(player => player.id) }));
        const draft = buildScrambleDraft(teams, result.byes.map(player => player.id), selected, topIds, []);
        expect(new Set(draft.queue.map(entry => entry.player.id)).size).toBe(count);
        expect(draft.queue.slice(0, 3).every(entry => entry.player.top)).toBe(true);
        for (const reveal of draft.queue) {
            const team = draft.matchups[reveal.matchupId].teams.find(candidate => candidate.id === reveal.teamId);
            expect(team.players[reveal.slot].id).toBe(reveal.player.id);
        }
        expect(draft.queue.find(entry => entry.teamId === 0).player.id).toBe(count);
        for (const team of teams)
            expect(draft.matchups.flatMap(matchup => matchup.teams).find(entry => entry.id === team.id)
                .players.map(player => player.id)).toEqual(team.playerIds);
        selected[0].name = 'Changed after generation';
        teams[0].playerIds.length = 0;
        expect(draft.queue.find(entry => entry.player.id === 1).player.name).toBe('Duplicate display name');
        expect(Object.isFrozen(draft.queue)).toBe(true);
    });

    it.each([false, true])('reveals the least-filled team with uneven rosters set to %s', uneven => {
        const teams = Array.from({ length: 20 }, (_, index) => ({
            id: index + 1, playerIds: Array.from({ length: uneven && index >= 17 ? 3 : 4 }, (_, slot) => index * 4 + slot + 1)
        }));
        const ids = teams.flatMap(team => team.playerIds);
        const selected = ids.map(id => ({ id, name: String(id) }));
        const topIds = [1, 2, 5, 9];
        const draft = buildScrambleDraft(teams, [], selected, topIds, []);
        expect(draft.queue.slice(0, topIds.length).every(entry => topIds.includes(entry.player.id))).toBe(true);
        const revealed = teams.map(() => 0);
        for (const [index, entry] of draft.queue.entries()) {
            if (index >= topIds.length) {
                const minimum = Math.min(...revealed.filter((count, i) => count < teams[i].playerIds.length));
                expect(revealed[entry.teamId - 1]).toBe(minimum);
            }
            revealed[entry.teamId - 1]++;
            if (!uneven && index >= topIds.length && Math.min(...revealed) >= 1)
                expect(Math.max(...revealed) - Math.min(...revealed)).toBeLessThanOrEqual(1);
        }
        expect(revealed).toEqual(teams.map(team => team.playerIds.length));
        expect(new Set(draft.queue.map(entry => entry.player.id)).size).toBe(ids.length);
    });

    it('reveals one Top Player per matchup in randomized passes', () => {
        const teams = Array.from({ length: 20 }, (_, index) => ({
            id: index + 1, playerIds: [index * 2 + 1, index * 2 + 2]
        }));
        const selected = teams.flatMap(team => team.playerIds.map(id => ({ id, name: String(id) })));
        const topIds = teams.map(team => team.playerIds[0]);
        const pairOrders = [() => 0, n => n - 1].map(random => {
            const draft = buildScrambleDraft(teams, [], selected, topIds, [], random);
            const first = draft.queue.slice(0, 10).map(entry => entry.matchupId);
            const second = draft.queue.slice(10, 20).map(entry => entry.matchupId);
            expect(new Set(first).size).toBe(10);
            expect(new Set(second).size).toBe(10);
            expect(first[first.length - 1]).not.toBe(second[0]);
            expect(draft.queue.slice(0, 20).every(entry => entry.player.top)).toBe(true);
            expect(draft.queue.slice(20).some(entry => entry.player.top)).toBe(false);
            return [first, second];
        });
        expect(pairOrders[0][0]).not.toEqual(pairOrders[1][0]);
        expect(pairOrders[0][1]).not.toEqual(pairOrders[1][1]);
    });

    it('handles missing Top Players, overflow and a single active matchup', () => {
        const selected = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, name: String(index) }));
        const teams = [{ id: 1, playerIds: [1, 2, 3] }, { id: 2, playerIds: [4] },
            { id: 3, playerIds: [5] }, { id: 4, playerIds: [6] }, { id: 5, playerIds: [7, 8] }];
        const draft = buildScrambleDraft(teams, [], selected, [1, 2, 3, 4, 7], [], () => 0);
        expect(new Set(draft.queue.slice(0, 2).map(entry => entry.matchupId))).toEqual(new Set([0, 2]));
        expect(draft.queue.find(entry => !entry.player.top)).toBe(draft.queue[5]);
        const only = buildScrambleDraft(teams, [], selected, [1, 2, 3, 4], [], () => 0);
        expect(only.queue.slice(0, 4).map(entry => entry.teamId)).toEqual([1, 2, 1, 1]);
    });

    it('randomizes ties without changing finalized rosters', () => {
        const teams = [{ id: 1, playerIds: [1, 2] }, { id: 2, playerIds: [3, 4] }];
        const selected = [1, 2, 3, 4].map(id => ({ id, name: String(id) }));
        const first = buildScrambleDraft(teams, [], selected, [], [], () => 0);
        const last = buildScrambleDraft(teams, [], selected, [], [], n => n - 1);
        expect(first.queue.map(entry => entry.player.id)).not.toEqual(last.queue.map(entry => entry.player.id));
        expect(first.matchups).toEqual(last.matchups);
    });

    it('uses roster gender and leaves unspecified players neutral', () => {
        const selected = [
            { id: 1, name: 'Player 1', gender: 'Female' },
            { id: 2, name: 'Player 2', isMale: true },
            { id: 3, name: 'Player 3', gender: 'Unspecified', isMale: false },
            { id: 4, name: 'Player 4' }
        ];
        const { matchups } = buildScrambleDraft([{ id: 1, playerIds: [1, 2] }, { id: 2, playerIds: [3, 4] }],
            [], selected, [1], []);
        expect(matchups[0].teams.flatMap(team => team.players.map(player => player.gender)))
            .toEqual(['female', 'male', 'neutral', 'neutral']);
    });

    it('rejects a repeated or missing participant before showing any results', () => {
        const selected = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }];
        expect(() => buildScrambleDraft([{ id: 1, playerIds: [1] }], [1], selected, [], [])).toThrow();
        expect(() => buildScrambleDraft([{ id: 1, playerIds: [1] }], [], selected, [], [])).toThrow();
    });
});

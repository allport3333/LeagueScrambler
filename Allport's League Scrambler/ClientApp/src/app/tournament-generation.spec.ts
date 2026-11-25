import { describe, expect, it } from 'vitest';
import { generateTournament, TournamentSettings } from './tournament-generation';
import { pairKey } from './scrambler/scramble-engine';

const settings: TournamentSettings = {
    maximumTeamSize: 2, numberOfTeams: null, numberOfRounds: 1, gamesPerMatchup: 1,
    balanceGenders: false, minimizeRepeats: false,
    automaticByes: false, activeTeamLimit: null, topPlayerIds: [], lowPlayerIds: [],
    historicalScrambleNumbers: [], manualByes: []
};
const players = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, isMale: index % 2 === 0 }));
function seededRandom(seed = 73) {
    let value = seed;
    return (maximum: number) => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value % maximum;
    };
}

describe('Tournament generation', () => {
    it.each([[13, 2, 4], [13, 4, 4], [20, 6, 6], [13, 3, 4]])(
        'pairs opposing compositions across rounds with %i players, %i women and %i teams',
        async (count, women, teams) => {
            const roster = Array.from({ length: count }, (_, index) => ({ id: index + 1, isMale: index >= women }));
            const options = { ...settings, maximumTeamSize: null, numberOfTeams: teams,
                numberOfRounds: 3, balanceGenders: true, minimizeRepeats: true };
            const result = await generateTournament(options, roster, [1, 2, 3], [], [], false, seededRandom());
            for (const round of result.rounds) {
                const composition = round.teams.map(team => team.filter(id => id <= women).length);
                const difference = composition.reduce((sum, total, index) =>
                    index % 2 === 0 ? sum + Math.abs(total - composition[index + 1]) : sum, 0);
                expect(difference).toBe(women % 2);
                expect(new Set(round.teams.flat()).size).toBe(count);
                expect(Math.max(...round.teams.map(team => team.length)) - Math.min(...round.teams.map(team => team.length))).toBeLessThanOrEqual(1);
            }
        });
    it('ignores gender in random mode even with repeat minimization', async () => {
        const options = { ...settings, numberOfRounds: 4, minimizeRepeats: true };
        const inverted = players.map(player => ({ ...player, isMale: !player.isMale }));
        const original = await generateTournament(options, players, [1, 2, 3, 4], [], [], false, seededRandom());
        const changed = await generateTournament(options, inverted, [1, 2, 3, 4], [], [], false, seededRandom());
        expect(changed.rounds).toEqual(original.rounds);
        expect(original.rounds).toHaveLength(4);
    });

    it('only allows fallback after strict historical exclusions are impossible', async () => {
        const roster = players.slice(0, 4);
        const pairs = roster.flatMap((player, index) => roster.slice(index + 1).map(other => pairKey(player.id, other.id)));
        await expect(generateTournament(settings, roster, [1], [], pairs, false, seededRandom())).rejects.toThrow();
        const result = await generateTournament(settings, roster, [1], [], pairs, true, seededRandom());
        expect(result.relaxedRounds).toEqual([1]);
        expect(result.rounds[0].teams.flat()).toHaveLength(4);
    });

    it('uses retained rounds for repeat costs and bye rotation in appended rounds', async () => {
        const roster = players.slice(0, 6);
        const prior = [{ roundNumber: 3, teams: [[3, 4], [5, 6]], byes: [1, 2] }];
        const next = await generateTournament({ ...settings, minimizeRepeats: true, activeTeamLimit: 2, automaticByes: true },
            roster, [4], prior, [], false, seededRandom());
        expect(next.rounds[0].roundNumber).toBe(4);
        expect(next.rounds[0].byes).toHaveLength(2);
        expect(next.rounds[0].byes.some(id => prior[0].byes.includes(id))).toBe(false);
        expect(next.repeats).toBe(0);
    });

    it.each([[2, 4], [3, 4], [4, 4], [5, 6], [6, 6], [3, 2], [5, 4]])(
        'separates and pairs %i Top Players with %i teams when capacity permits', async (topCount, teamCount) => {
            const roster = Array.from({ length: teamCount * 2 }, (_, i) => ({ id: i + 1, isMale: i > 1 }));
            for (const balanceGenders of [true, false]) {
                const result = await generateTournament({ ...settings, maximumTeamSize: null, numberOfTeams: teamCount,
                    balanceGenders, minimizeRepeats: true,
                    topPlayerIds: roster.slice(0, topCount).map(player => player.id) }, roster, [1, 2], [], [], false, seededRandom());
                for (const round of result.rounds) {
                    const counts = round.teams.map(team => team.filter(id => id <= topCount).length);
                    expect(counts.filter(n => n > 0)).toHaveLength(Math.min(topCount, teamCount));
                    expect(counts.filter((n, i) => i % 2 === 0 && n && counts[i + 1])).toHaveLength(
                        Math.floor(Math.min(topCount, teamCount) / 2));
                    expect(counts.filter(n => n === 2)).toHaveLength(Math.max(0, topCount - teamCount));
                    expect(new Set(round.teams.flat()).size).toBe(roster.length);
                }
            }
        });

    it('rotates three Top Player opponents across saved and generated rounds', async () => {
        const options = { ...settings, topPlayerIds: [1, 2, 3] };
        const original = [{ roundNumber: 1, teams: [[1, 4], [2, 5], [3, 6], [7, 8]], byes: [] }];
        const result = await generateTournament(options, players, [2, 3], original, [], false, seededRandom());
        const paired = [ ...original, ...result.rounds ].map(round => round.teams
            .filter((team, i) => i % 2 === 0 && team.some(id => id <= 3) && round.teams[i + 1].some(id => id <= 3))
            .map(team => pairKey(team.find(id => id <= 3), round.teams[round.teams.indexOf(team) + 1].find(id => id <= 3)))[0]);
        expect(new Set(paired).size).toBe(3);
        expect(original[0].teams[0]).toEqual([1, 4]);
    });

    it('varies unmatched and overflow Top Players across independent previews', async () => {
        const opposing = new Set<string>(), teammates = new Set<string>();
        for (let seed = 1; seed <= 16; seed++) {
            for (const numberOfTeams of [2, 4]) {
                const result = await generateTournament({ ...settings, maximumTeamSize: null, numberOfTeams,
                    topPlayerIds: [1, 2, 3] }, players, [1], [], [], false, seededRandom(seed));
                const tops = result.rounds[0].teams.map(team => team.filter(id => id <= 3));
                if (numberOfTeams === 2) teammates.add(tops.find(team => team.length === 2).sort().join(':'));
                else {
                    const index = tops.findIndex((team, i) => i % 2 === 0 && team.length && tops[i + 1].length);
                    opposing.add([...tops[index], ...tops[index + 1]].sort().join(':'));
                }
            }
        }
        expect(teammates.size).toBe(3);
        expect(opposing.size).toBe(3);
    });

    it('excludes a manual bye from Top Player pairing and keeps strict history', async () => {
        const result = await generateTournament({ ...settings, topPlayerIds: [1, 2, 3],
            manualByes: [{ roundNumber: 1, playerId: 3 }] }, players, [1], [], ['1:2', '1:4', '2:5'], false, seededRandom());
        const round = result.rounds[0];
        expect(round.byes).toEqual([3]);
        const first = round.teams.findIndex(team => team.includes(1));
        expect(round.teams[first ^ 1]).toContain(2);
        expect(round.teams[first]).not.toContain(4);
    });

    it('tries strict history before allowing unavoidable Top teammates', async () => {
        const roster = players.slice(0, 4);
        const result = await generateTournament({ ...settings, topPlayerIds: [1, 2] },
            roster, [1], [], ['1:3', '1:4', '2:3', '2:4'], false, seededRandom());
        expect(result.rounds[0].teams).toContainEqual(expect.arrayContaining([1, 2]));
        expect(result.sharedTopRounds).toEqual([1]);
        expect(result.relaxedRounds).toEqual([]);
    });

    it('honors persisted priorities with a legacy unchecked toggle in every generation request', async () => {
        const migrated = { ...settings, balancePriorities: false, topPlayerIds: [1, 2, 3] };
        const initial = await generateTournament(migrated, players, [1, 2, 3], [], [], false, seededRandom());
        const saved = JSON.stringify(initial.rounds);
        for (const [numbers, preserved] of [
            [[2], initial.rounds.filter(round => round.roundNumber !== 2)],
            [[4], initial.rounds],
            [[2, 3], initial.rounds.slice(0, 1)]
        ] as const) {
            const result = await generateTournament(migrated, players, [...numbers], preserved, [], false, seededRandom());
            for (const round of result.rounds) {
                const counts = round.teams.map(team => team.filter(id => id <= 3).length);
                expect([...counts].sort()).toEqual([0, 1, 1, 1]);
                expect(counts.some((n, i) => i % 2 === 0 && n === 1 && counts[i + 1] === 1)).toBe(true);
            }
        }
        expect(JSON.stringify(initial.rounds)).toBe(saved);
    });

    it('spreads Low Players with no Top Players or separate toggle', async () => {
        const lowPlayerIds = [1, 2, 3, 4];
        const result = await generateTournament({ ...settings, lowPlayerIds },
            players, [1], [], [], false, seededRandom());
        expect(result.rounds[0].teams.map(team => team.filter(id => lowPlayerIds.includes(id)).length)).toEqual([1, 1, 1, 1]);
    });

    it('applies explicit priorities without gender balance', async () => {
        const result = await generateTournament({ ...settings, topPlayerIds: [1, 2, 3, 4] },
            players, [1], [], [], false, seededRandom());
        expect(result.rounds[0].teams.map(team => team.filter(id => id < 5).length)).toEqual([1, 1, 1, 1]);
    });
});

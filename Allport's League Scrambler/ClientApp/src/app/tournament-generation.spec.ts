import { describe, expect, it } from 'vitest';
import { generateTournament, TournamentSettings } from './tournament-generation';
import { pairKey } from './scrambler/scramble-engine';

const settings: TournamentSettings = {
    maximumTeamSize: 2, numberOfTeams: null, numberOfRounds: 1, gamesPerMatchup: 1,
    balanceGenders: false, minimizeRepeats: false, balancePriorities: false,
    automaticByes: false, activeTeamLimit: null, topPlayerIds: [], lowPlayerIds: [],
    historicalScrambleNumbers: [], manualByes: []
};
const players = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, isMale: index % 2 === 0 }));
function seededRandom() {
    let value = 73;
    return (maximum: number) => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value % maximum;
    };
}

describe('Tournament generation', () => {
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

    it('applies explicit priorities without gender balance', async () => {
        const result = await generateTournament({ ...settings, balancePriorities: true, topPlayerIds: [1, 2, 3, 4] },
            players, [1], [], [], false, seededRandom());
        expect(result.rounds[0].teams.map(team => team.filter(id => id < 5).length)).toEqual([1, 1, 1, 1]);
    });
});

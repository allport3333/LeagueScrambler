import { generateScramble, pairKey, RandomInt, ScramblePlayer, secureRandomInt, shuffled } from './scrambler/scramble-engine';

export interface TournamentBye { roundNumber: number; playerId: number; }
export interface TournamentSettings {
    maximumTeamSize: number | null;
    numberOfTeams: number | null;
    numberOfRounds: number;
    gamesPerMatchup: number;
    balanceGenders: boolean;
    minimizeRepeats: boolean;
    balancePriorities: boolean;
    automaticByes: boolean;
    activeTeamLimit: number | null;
    topPlayerIds: number[];
    lowPlayerIds: number[];
    historicalScrambleNumbers: number[];
    manualByes: TournamentBye[];
}
export interface TournamentAllocation {
    roundNumber: number;
    teams: number[][];
    byes: number[];
}

function addPairs(counts: Map<string, number>, teams: number[][]): number {
    let repeats = 0;
    for (const team of teams) {
        team.forEach((player, index) => {
            for (const other of team.slice(index + 1)) {
                const key = pairKey(player, other);
                const count = counts.get(key) ?? 0;
                repeats += count;
                counts.set(key, count + 1);
            }
        });
    }
    return repeats;
}

export async function generateTournament(
    settings: TournamentSettings, players: ScramblePlayer[], pending: number[],
    preserved: TournamentAllocation[], prohibitedPairs: string[],
    allowFallback: boolean, random: RandomInt = secureRandomInt
): Promise<{ rounds: TournamentAllocation[]; repeats: number; relaxedRounds: number[] }> {
    if (players.length < 2 || players.length > 256)
        throw new Error('Between 2 and 256 eligible participants are required.');
    if (!pending.length)
        throw new Error('Select at least one round to generate.');
    const eligible = new Set(players.map(player => player.id));
    const manual = settings.manualByes.filter(bye => pending.includes(bye.roundNumber));
    if (manual.some(bye => !eligible.has(bye.playerId)))
        throw new Error('A manual bye references someone who is absent. Update check-in or remove that bye.');
    const capacity = settings.activeTeamLimit == null ? players.length : settings.activeTeamLimit * settings.maximumTeamSize!;
    const topRanks = settings.topPlayerIds.map((playerId, index) => ({ playerId, rank: index + 1 }));
    const deadline = Date.now() + 7000;
    let best: { rounds: TournamentAllocation[]; repeats: number; relaxedRounds: number[]; violations: number; spread: number } | undefined;
    let failure = '';

    // Compare several complete schedules with fresh randomized choices. Preserved rounds
    // contribute to both fairness and repeat costs regardless of their round number.
    for (let attempt = 0; attempt < (settings.minimizeRepeats ? 4 : 1) && Date.now() < deadline; attempt++) {
        const counts = new Map<string, number>();
        const byeCounts = new Map<number, number>();
        for (const round of preserved) {
            addPairs(counts, round.teams);
            for (const id of round.byes) byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
        }
        for (const bye of manual) byeCounts.set(bye.playerId, (byeCounts.get(bye.playerId) ?? 0) + 1);

        const rounds: TournamentAllocation[] = [];
        const relaxedRounds: number[] = [];
        let repeats = 0;
        let violations = 0;
        for (const roundNumber of pending) {
            const byes = new Set(manual.filter(bye => bye.roundNumber === roundNumber).map(bye => bye.playerId));
            const extra = Math.max(0, players.length - byes.size - capacity);
            if (extra > 0 && !settings.automaticByes)
                throw new Error('The active team limit cannot fit the eligible roster. Enable automatic byes or increase capacity.');
            const candidates = shuffled(players.filter(player => !byes.has(player.id)), random)
                .sort((a, b) => (byeCounts.get(a.id) ?? 0) - (byeCounts.get(b.id) ?? 0));
            for (const player of candidates.slice(0, extra)) {
                byes.add(player.id);
                byeCounts.set(player.id, (byeCounts.get(player.id) ?? 0) + 1);
            }

            if (players.length - byes.size < 2)
                throw new Error('Each round needs at least two active players.');
            if (Date.now() >= deadline) {
                failure = 'The tournament search ran out of time. Try fewer rounds per generation or relax an optional preference.';
                break;
            }

            const result = await generateScramble({
                players: players.map(player => ({ ...player, isByePlayer: byes.has(player.id) })),
                mode: settings.balanceGenders ? 'balanced' : 'random',
                maxTeamSize: settings.maximumTeamSize ?? undefined,
                numberOfTeams: settings.numberOfTeams ?? undefined,
                balancePriorities: settings.balancePriorities,
                configuredTop: topRanks,
                topIds: settings.topPlayerIds,
                lowIds: settings.lowPlayerIds,
                prohibitedPairs,
                allowMinimumRepeats: allowFallback,
                prioritizeHistory: settings.minimizeRepeats,
                frequencies: [...counts].map(([pair, count]) => {
                    const [player1Id, player2Id] = pair.split(':').map(Number);
                    return { player1Id, player2Id, count };
                }),
                maxNodes: 180000,
                maxMilliseconds: Math.min(600, Math.max(1, deadline - Date.now())),
                improveSteps: 60
            }, random);
            if (result.status !== 'success') {
                failure = 'Round ' + roundNumber + ': ' + result.reason;
                break;
            }
            if (result.repeatedPairs.length) relaxedRounds.push(roundNumber);
            violations += result.repeatedPairs.length;
            const teams = result.teams.map(team => team.map(player => player.id));
            const roundRepeats = addPairs(counts, teams);
            repeats += roundRepeats;
            rounds.push({ roundNumber, teams, byes: [...byes] });
        }
        if (rounds.length !== pending.length) continue;
        const spread = players.reduce((sum, player) => sum + (byeCounts.get(player.id) ?? 0) ** 2, 0);
        if (!best || violations < best.violations ||
            (violations === best.violations && (spread < best.spread ||
                (spread === best.spread && repeats < best.repeats)))) {
            best = { rounds, repeats, relaxedRounds, violations, spread };
        }
        if (best.repeats === 0 && !best.violations) break;
    }
    if (!best) throw new Error(failure || 'No complete tournament schedule was found.');
    return best;
}

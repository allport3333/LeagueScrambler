import { generateScramble, matchupCompositionCost, pairKey, RandomInt, ScramblePlayer, secureRandomInt, shuffled } from './scrambler/scramble-engine';

export interface TournamentBye { roundNumber: number; playerId: number; }
export interface TournamentSettings {
    maximumTeamSize: number | null;
    numberOfTeams: number | null;
    numberOfRounds: number;
    gamesPerMatchup: number;
    balanceGenders: boolean;
    minimizeRepeats: boolean;
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

function addTopOpponents(counts: Map<string, number>, teams: number[][], tops: Set<number>): void {
    for (let i = 0; i + 1 < teams.length; i += 2)
        for (const a of teams[i].filter(id => tops.has(id)))
            for (const b of teams[i + 1].filter(id => tops.has(id))) {
                const key = pairKey(a, b);
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
}

export async function generateTournament(
    settings: TournamentSettings, players: ScramblePlayer[], pending: number[],
    preserved: TournamentAllocation[], prohibitedPairs: string[],
    allowFallback: boolean, random: RandomInt = secureRandomInt
): Promise<{ rounds: TournamentAllocation[]; repeats: number; relaxedRounds: number[]; sharedTopRounds: number[] }> {
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
    const tops = new Set(settings.topPlayerIds);
    const hasPriorities = tops.size > 0 || settings.lowPlayerIds.length > 0;
    let best: { rounds: TournamentAllocation[]; repeats: number; relaxedRounds: number[]; violations: number; spread: number; mismatch: number; topTeammates: number; opposing: number; sharedTopRounds: number[] } | undefined;
    let failure = '';

    // Compare several complete schedules with fresh randomized choices. Preserved rounds
    // contribute to both fairness and repeat costs regardless of their round number.
    for (let attempt = 0; attempt < (settings.minimizeRepeats ? 4 : 1) && Date.now() < deadline; attempt++) {
        const counts = new Map<string, number>();
        const opponentHistory = new Map<string, number>();
        const byeCounts = new Map<number, number>();
        for (const round of preserved) {
            addPairs(counts, round.teams);
            addTopOpponents(opponentHistory, round.teams, tops);
            for (const id of round.byes) byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
        }
        for (const bye of manual) byeCounts.set(bye.playerId, (byeCounts.get(bye.playerId) ?? 0) + 1);

        const rounds: TournamentAllocation[] = [];
        const relaxedRounds: number[] = [];
        const sharedTopRounds: number[] = [];
        let topTeammates = 0, opposing = 0;
        let repeats = 0;
        let mismatch = 0;
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
                balancePriorities: hasPriorities,
                configuredTop: topRanks,
                tournamentTopPairing: true,
                opponentHistory,
                topIds: settings.topPlayerIds,
                lowIds: settings.lowPlayerIds,
                prohibitedPairs,
                allowMinimumRepeats: allowFallback,
                prioritizeHistory: settings.minimizeRepeats,
                prioritizeMatchupComposition: settings.balanceGenders,
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
            if (settings.balanceGenders) mismatch += matchupCompositionCost(result.teams);
            const teams = result.teams.map(team => team.map(player => player.id));
            const topCounts = teams.map(team => team.filter(id => tops.has(id)).length);
            const shared = topCounts.reduce((sum, count) => sum + count * (count - 1) / 2, 0);
            if (shared) sharedTopRounds.push(roundNumber);
            topTeammates += shared;
            opposing += topCounts.filter((count, index) => index % 2 === 0 && count && topCounts[index + 1]).length;
            addTopOpponents(opponentHistory, teams, tops);
            const roundRepeats = addPairs(counts, teams);
            repeats += roundRepeats;
            rounds.push({ roundNumber, teams, byes: [...byes] });
        }
        if (rounds.length !== pending.length) continue;
        const spread = players.reduce((sum, player) => sum + (byeCounts.get(player.id) ?? 0) ** 2, 0);
        const quality = [violations, spread, topTeammates, -opposing, mismatch, repeats];
        const previous = best && [best.violations, best.spread, best.topTeammates, -best.opposing, best.mismatch, best.repeats];
        const difference = previous && quality.findIndex((value, i) => value !== previous[i]);
        if (!best || difference >= 0 && quality[difference] < previous[difference])
            best = { rounds, repeats, relaxedRounds, violations, spread, mismatch, topTeammates, opposing, sharedTopRounds };
        if (!tops.size && best.repeats === 0 && best.mismatch === 0 && !best.violations) break;
    }
    if (!best) throw new Error(failure || 'No complete tournament schedule was found.');
    return best;
}

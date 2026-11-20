// Pure, dependency-free engine. No Angular state, HTTP, database writes or permanent player mutations.
export interface ScramblePlayer {
    id: number;
    isMale: boolean;
    isByePlayer?: boolean;
    isTopPlayer?: boolean;
    isLowPlayer?: boolean;
    firstName?: string;
    lastName?: string;
}
export interface TopPriority {
    playerId: number;
    rank: number;
}
export interface HistoryTeam {
    leagueId: number;
    teamId: number;
    scrambleNumber: number;
    playerIds: number[];
    saved: boolean;
    bye?: boolean;
}
export interface PairFrequency {
    player1Id: number;
    player2Id: number;
    count: number;
}
export interface ScrambleInput {
    players: ScramblePlayer[];
    mode: 'balanced' | 'random';
    maxTeamSize?: number;
    numberOfTeams?: number;
    topIds?: number[];
    lowIds?: number[];
    configuredTop?: TopPriority[];
    standings?: any[];
    prohibitedPairs?: string[];
    allowMinimumRepeats?: boolean;
    prioritizeHistory?: boolean;
    frequencies?: PairFrequency[];
    maxNodes?: number;
    maxMilliseconds?: number;
    improveSteps?: number;
    cancelled?: () => boolean;
}
export type ScrambleStatus = 'success' | 'impossible' | 'budget-exhausted' | 'invalid-configuration' | 'cancelled' | 'unexpected-error';
export interface ScrambleResult {
    status: ScrambleStatus;
    reason: string;
    teams: ScramblePlayer[][];
    byes: ScramblePlayer[];
    retainedTopIds: number[];
    demotedTopIds: number[];
    repeatedPairs: number[][];
    historyCost: number;
    strictImpossible: boolean;
    minimumRepeatsProven: boolean;
    balancingOptimal: boolean;
    historyOptimal: boolean;
    nodes: number;
    elapsedMilliseconds: number;
    warnings: string[];
}
export type RandomInt = (exclusiveMaximum: number) => number;
export const pairKey = (a: number, b: number): string => a < b ? a + ':' + b : b + ':' + a;
export function secureRandomInt(max: number): number {
    if (!Number.isInteger(max) || max <= 0 || max > 4294967296)
        throw new Error('Invalid random range');
    const cryptoSource = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : null;
    if (!cryptoSource || !cryptoSource.getRandomValues)
        throw new Error('Secure browser randomness is unavailable');
    const value = new Uint32Array(1), limit = 4294967296 - (4294967296 % max);
    do {
        cryptoSource.getRandomValues(value);
    } while (value[0] >= limit);
    return value[0] % max;
}
export function shuffled<T>(values: T[], random: RandomInt): T[] {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = random(i + 1);
        const v = result[i];
        result[i] = result[j];
        result[j] = v;
    }
    return result;
}
const validId = (id: number) => Number.isInteger(id) && id > 0;
const gold = (s: any) => String(s.leagueDivisionCode || '').toUpperCase() === 'GM' || String(s.leagueDivisionName || '').toUpperCase().indexOf('GOLD') >= 0;
export function rankTopPlayers(players: ScramblePlayer[], configured: TopPriority[] = [], standings: any[] = []): ScramblePlayer[] {
    const ranks = new Map<number, number>(), rows = new Map<number, any>();
    configured.forEach(p => { if (validId(p.playerId) && Number.isFinite(p.rank) && p.rank > 0)
        ranks.set(p.playerId, Math.min(ranks.has(p.playerId) ? ranks.get(p.playerId) : Infinity, p.rank)); });
    standings.forEach(p => { if (validId(p.playerId))
        rows.set(p.playerId, p); });
    return players.slice().sort((a, b) => {
        const ar = ranks.has(a.id) ? ranks.get(a.id) : Infinity, br = ranks.has(b.id) ? ranks.get(b.id) : Infinity;
        if (ar !== br)
            return ar < br ? -1 : 1;
        const sa = rows.get(a.id), sb = rows.get(b.id);
        if (!!sa !== !!sb)
            return sa ? -1 : 1;
        if (sa && sb) {
            const score = (Number(sb.totalScore) || 0) - (Number(sa.totalScore) || 0);
            if (score)
                return score;
            const g = Number(gold(sb)) - Number(gold(sa));
            if (g)
                return g;
            const raw = (Number(sb.totalScoreBeforeReduction) || 0) - (Number(sa.totalScoreBeforeReduction) || 0);
            if (raw)
                return raw;
        }
        const an = String(sa && sa.playerName || ((a.firstName || '') + ' ' + (a.lastName || ''))).toLowerCase(), bn = String(sb && sb.playerName || ((b.firstName || '') + ' ' + (b.lastName || ''))).toLowerCase();
        return an < bn ? -1 : an > bn ? 1 : a.id - b.id;
    });
}
export function historyIndex(leagueId: number, teams: HistoryTeam[]): {
    frequencies: PairFrequency[];
    scrambles: number[];
} {
    if (!validId(leagueId) || !Array.isArray(teams))
        throw new Error('Historical data is unavailable');
    const seen = new Map<string, string>(), counts = new Map<string, number>(), scrambles = new Set<number>();
    teams.forEach(team => {
        if (team.leagueId !== leagueId || !team.saved || team.bye)
            return;
        if (!validId(team.teamId) || !Number.isInteger(team.scrambleNumber) || team.scrambleNumber < 0 || !Array.isArray(team.playerIds) || team.playerIds.some(id => !validId(id)))
            throw new Error('Historical player/team identity is incomplete');
        const ids = Array.from(new Set(team.playerIds)).sort((a, b) => a - b), key = team.scrambleNumber + ':' + team.teamId, signature = ids.join(',');
        if (seen.has(key)) {
            if (seen.get(key) !== signature)
                throw new Error('Historical team snapshots disagree');
            return;
        }
        seen.set(key, signature);
        scrambles.add(team.scrambleNumber);
        for (let i = 0; i < ids.length; i++)
            for (let j = i + 1; j < ids.length; j++) {
                const pair = pairKey(ids[i], ids[j]);
                counts.set(pair, (counts.get(pair) || 0) + 1);
            }
    });
    return { scrambles: Array.from(scrambles), frequencies: Array.from(counts.keys()).map(key => ({ player1Id: +key.split(':')[0], player2Id: +key.split(':')[1], count: counts.get(key) })) };
}
export function capacitiesFor(count: number, maxSize?: number, requested?: number): number[] {
    const teams = requested !== null && requested !== undefined ? requested : (maxSize >= 2 && maxSize <= 5 && Number.isInteger(maxSize) ? 2 * Math.ceil(count / (2 * maxSize)) : 0);
    if (!Number.isInteger(teams) || teams <= 0 || teams > count)
        throw new Error('Choose a valid team count or maximum size; every team needs a player.');
    return Array.from({ length: teams }, (_, i) => Math.floor(count / teams) + (i < count % teams ? 1 : 0));
}
// Existing composition ordering: males descending, then females descending; equal groups shuffled.
export function pairByComposition(teams: ScramblePlayer[][], random: RandomInt): ScramblePlayer[][] {
    return shuffled(teams, random).map(players => players.slice().sort((a, b) => Number(b.isMale) - Number(a.isMale)))
        .sort((a, b) => b.filter(p => p.isMale).length - a.filter(p => p.isMale).length || b.filter(p => !p.isMale).length - a.filter(p => !p.isMale).length);
}
function minimumCost(capacities: number[], count: number, gender: boolean): number {
    let dp: number[] = Array(count + 1).fill(Infinity);
    dp[0] = 0;
    capacities.forEach(size => { const next: number[] = Array(count + 1).fill(Infinity); for (let used = 0; used <= count; used++)
        if (dp[used] !== Infinity)
            for (let n = 0; n <= size && used + n <= count; n++)
                next[used + n] = Math.min(next[used + n], dp[used] + n * n + (gender ? (size - n) * (size - n) : 0)); dp = next; });
    return dp[count];
}
export function validateAllocation(players: ScramblePlayer[], capacities: number[], teams: ScramblePlayer[][], topIds: number[], prohibited: Set<string>, repeatLimit: number): string[] {
    const errors: string[] = [], eligible = players.filter(p => !p.isByePlayer), expected = new Set(eligible.map(p => p.id)), seen = new Set<number>(), top = new Set(topIds);
    let repeats = 0;
    if (teams.length !== capacities.length || teams.map(t => t.length).sort((a, b) => a - b).join(',') !== capacities.slice().sort((a, b) => a - b).join(','))
        errors.push('Team sizes do not match the configuration.');
    teams.forEach(team => { if (team.filter(p => top.has(p.id)).length > 1)
        errors.push('More than one retained top on a team.'); team.forEach(p => { if (!validId(p.id) || !expected.has(p.id) || seen.has(p.id))
        errors.push('Invalid, duplicate or ineligible player assignment.'); seen.add(p.id); }); for (let i = 0; i < team.length; i++)
        for (let j = i + 1; j < team.length; j++)
            if (prohibited.has(pairKey(team[i].id, team[j].id)))
                repeats++; });
    if (seen.size !== expected.size)
        errors.push('An eligible player is missing.');
    if (repeats > repeatLimit)
        errors.push('Selected historical restrictions were violated.');
    return errors;
}
export async function generateScramble(input: ScrambleInput, random: RandomInt = secureRandomInt): Promise<ScrambleResult> {
    const started = Date.now(), result: ScrambleResult = { status: 'invalid-configuration', reason: '', teams: [], byes: [], retainedTopIds: [], demotedTopIds: [], repeatedPairs: [], historyCost: 0, strictImpossible: false, minimumRepeatsProven: false, balancingOptimal: false, historyOptimal: false, nodes: 0, elapsedMilliseconds: 0, warnings: [] };
    const finish = (status: ScrambleStatus, reason: string) => { result.status = status; result.reason = reason; result.elapsedMilliseconds = Date.now() - started; return result; };
    try {
        if (!input || !Array.isArray(input.players) || input.players.length > 256 || !['random', 'balanced'].includes(input.mode))
            return finish('invalid-configuration', 'Select a valid roster of up to 256 players and a scramble mode.');
        if (input.players.some(p => !p || !validId(p.id) || typeof p.isMale !== 'boolean') || new Set(input.players.map(p => p.id)).size !== input.players.length)
            return finish('invalid-configuration', 'Every selected player needs a unique positive PlayerId and gender classification.');
        if (input.cancelled && input.cancelled())
            return finish('cancelled', 'Generation canceled.');
        const players = input.players.filter(p => !p.isByePlayer);
        result.byes = input.players.filter(p => p.isByePlayer);
        let caps: number[];
        try {
            caps = capacitiesFor(players.length, input.maxTeamSize, input.numberOfTeams);
        }
        catch (error) {
            return finish('invalid-configuration', error.message);
        }
        const balanced = input.mode === 'balanced', ids = new Set(players.map(p => p.id));
        const topCandidates = new Set((input.topIds || players.filter(p => p.isTopPlayer).map(p => p.id)).filter(id => ids.has(id)));
        const ranked = balanced ? rankTopPlayers(players.filter(p => topCandidates.has(p.id)), input.configuredTop, input.standings) : [];
        const hasPriority = (id: number) => (input.configuredTop || []).some(p => p.playerId === id && Number.isFinite(p.rank) && p.rank > 0)
            || (input.standings || []).some(p => p.playerId === id);
        if (ranked.length > caps.length && ranked.slice(0, caps.length).some(p => !hasPriority(p.id)))
            return finish('invalid-configuration', 'Excess Top Players need configured ranks or loaded King/Queen standings to determine priority. No player was arbitrarily demoted.');
        result.retainedTopIds = ranked.slice(0, caps.length).map(p => p.id);
        result.demotedTopIds = ranked.slice(caps.length).map(p => p.id);
        const tops = new Set(result.retainedTopIds), lows = new Set(balanced ? (input.lowIds || players.filter(p => p.isLowPlayer).map(p => p.id)).filter(id => ids.has(id) && !topCandidates.has(id)) : []);
        if (balanced && players.some(p => topCandidates.has(p.id) && p.isLowPlayer))
            result.warnings.push('Overlapping Top/Low designations use Top precedence for this generation.');
        const prohibited = new Set<string>();
        for (const pair of input.prohibitedPairs || []) {
            const parts = pair.split(':').map(Number);
            if (parts.length !== 2 || parts.some(id => !validId(id)) || parts[0] === parts[1])
                return finish('invalid-configuration', 'Historical pair identities are invalid.');
            if (ids.has(parts[0]) && ids.has(parts[1]))
                prohibited.add(pairKey(parts[0], parts[1]));
        }
        const frequencies = new Map<string, number>();
        if (input.prioritizeHistory && !Array.isArray(input.frequencies))
            return finish('invalid-configuration', 'League history must load successfully before prioritizing previous teammates.');
        for (const pair of input.prioritizeHistory ? input.frequencies : []) {
            if (!validId(pair.player1Id) || !validId(pair.player2Id) || pair.player1Id === pair.player2Id || !Number.isInteger(pair.count) || pair.count < 0)
                return finish('invalid-configuration', 'League teammate history contains unreliable identities or counts.');
            const key = pairKey(pair.player1Id, pair.player2Id);
            if (frequencies.has(key))
                return finish('invalid-configuration', 'League teammate history repeats an aggregate pair.');
            frequencies.set(key, pair.count);
        }
        if (!balanced && !prohibited.size && !input.prioritizeHistory) {
            const pool = shuffled(players, random);
            let offset = 0;
            result.teams = caps.map(size => { const team = pool.slice(offset, offset + size); offset += size; return team; });
            if (validateAllocation(input.players, caps, result.teams, [], prohibited, 0).length) {
                result.teams = [];
                return finish('unexpected-error', 'Random allocation failed validation.');
            }
            result.minimumRepeatsProven = true;
            result.balancingOptimal = true;
            result.historyOptimal = true;
            return finish('success', 'Random scramble generated.');
        }
        caps = shuffled(caps, random);
        const budget = input.maxNodes === undefined ? 150000 : input.maxNodes, milliseconds = input.maxMilliseconds === undefined ? 2500 : input.maxMilliseconds;
        if (!Number.isInteger(budget) || budget < 0 || !Number.isFinite(milliseconds) || milliseconds < 0)
            return finish('invalid-configuration', 'Invalid search budget.');
        let lastYield = Date.now(), exhausted = false, cancelled = false;
        const checkpoint = async (): Promise<boolean> => { if (input.cancelled && input.cancelled()) {
            cancelled = true;
            return false;
        } if (result.nodes >= budget || Date.now() - started >= milliseconds) {
            exhausted = true;
            return false;
        } if (Date.now() - lastYield >= 8) {
            await new Promise(resolve => setTimeout(resolve, 0));
            lastYield = Date.now();
        } return true; };
        const minimumGender = balanced ? minimumCost(caps, players.filter(p => p.isMale).length, true) : 0, minimumLow = balanced ? minimumCost(caps, lows.size, false) : 0;
        const degree = new Map<number, number>();
        players.forEach(p => degree.set(p.id, players.filter(q => prohibited.has(pairKey(p.id, q.id))).length));
        // Any discovered clique is a sound pigeonhole lower bound, not a claim of a maximum clique.
        let pairLowerBound = 0;
        const order = players.slice().sort((a, b) => degree.get(b.id) - degree.get(a.id));
        for (const first of order.slice(0, 20)) {
            const clique = [first];
            for (const p of order)
                if (p !== first && clique.every(q => prohibited.has(pairKey(p.id, q.id))))
                    clique.push(p);
            const q = Math.floor(clique.length / caps.length), r = clique.length % caps.length;
            pairLowerBound = Math.max(pairLowerBound, caps.length * q * (q - 1) / 2 + r * q);
        }
        const teams: ScramblePlayer[][] = caps.map(() => []), used = new Set<number>();
        let repeatCount = 0;
        const candidates = (player: ScramblePlayer, limit: number): {
            team: number;
            extra: number;
            gender: number;
            low: number;
            history: number;
        }[] => {
            const choices = [];
            for (let t = 0; t < teams.length; t++) {
                const team = teams[t];
                if (team.length === caps[t] || (tops.has(player.id) && team.some(p => tops.has(p.id))))
                    continue;
                let extra = 0, history = 0;
                team.forEach(p => { const key = pairKey(player.id, p.id); if (prohibited.has(key))
                    extra++; history += frequencies.get(key) || 0; });
                if (repeatCount + extra > limit)
                    continue;
                const male = team.filter(p => p.isMale).length, female = team.length - male, low = team.filter(p => lows.has(p.id)).length;
                choices.push({ team: t, extra, gender: balanced ? 2 * (player.isMale ? male : female) + 1 : 0, low: lows.has(player.id) ? 2 * low + 1 : 0, history });
            }
            return choices;
        };
        const find = async (limit: number): Promise<boolean> => {
            if (!await checkpoint())
                return false;
            result.nodes++;
            if (used.size === players.length)
                return true;
            const remainingTop = players.filter(p => !used.has(p.id) && tops.has(p.id)).length;
            if (remainingTop > teams.filter((team, i) => team.length < caps[i] && !team.some(p => tops.has(p.id))).length)
                return false;
            let best: ScramblePlayer = null, choices: any[] = null, ties = 0, bestDegree = -1, bestRole = -1;
            for (const p of players) {
                if (used.has(p.id))
                    continue;
                const allowed = candidates(p, limit);
                if (!allowed.length)
                    return false;
                const d = degree.get(p.id), role = tops.has(p.id) ? 2 : lows.has(p.id) ? 1 : 0;
                if (!choices || allowed.length < choices.length || allowed.length === choices.length && (d > bestDegree || d === bestDegree && role > bestRole)) {
                    best = p;
                    choices = allowed;
                    ties = 1;
                    bestDegree = d;
                    bestRole = role;
                }
                else if (allowed.length === choices.length && d === bestDegree && role === bestRole && random(++ties) === 0) {
                    best = p;
                    choices = allowed;
                }
            }
            choices = shuffled(choices, random).sort((a, b) => a.extra - b.extra || a.gender - b.gender || a.low - b.low || a.history - b.history);
            const empty = new Set<number>();
            for (const choice of choices) {
                const team = teams[choice.team];
                if (!team.length) {
                    if (empty.has(caps[choice.team]))
                        continue;
                    empty.add(caps[choice.team]);
                }
                team.push(best);
                used.add(best.id);
                repeatCount += choice.extra;
                if (await find(limit))
                    return true;
                repeatCount -= choice.extra;
                used.delete(best.id);
                team.pop();
                if (exhausted || cancelled)
                    return false;
            }
            return false;
        };
        let found = false, limit = 0;
        if (!await checkpoint())
            return finish(cancelled ? 'cancelled' : 'budget-exhausted', cancelled ? 'Generation canceled.' : 'Search budget exhausted before determining strict feasibility.');
        if (pairLowerBound === 0)
            found = await find(0);
        if (!found) {
            if (cancelled || exhausted)
                return finish(cancelled ? 'cancelled' : 'budget-exhausted', cancelled ? 'Generation canceled.' : 'Search budget exhausted; strict impossibility was not proved. No fallback was used.');
            result.strictImpossible = true;
            if (!input.allowMinimumRepeats || !prohibited.size)
                return finish('impossible', 'No arrangement satisfies the mandatory team and selected-history restrictions.');
            const maximum = caps.reduce((sum, size) => sum + size * (size - 1) / 2, 0);
            for (limit = Math.max(1, pairLowerBound); limit <= maximum; limit++) {
                found = await find(limit);
                if (found || exhausted || cancelled)
                    break;
            }
            if (!found)
                return finish(cancelled ? 'cancelled' : exhausted ? 'budget-exhausted' : 'impossible', exhausted ? 'Minimum-repeat search budget exhausted; no unproved fallback was returned.' : 'No valid arrangement found.');
        }
        result.minimumRepeatsProven = true;
        const metric = (all: ScramblePlayer[][]): number[] => { let gender = 0, low = 0, history = 0, repeats = 0; all.forEach(team => { const m = team.filter(p => p.isMale).length, l = team.filter(p => lows.has(p.id)).length; gender += balanced ? m * m + (team.length - m) * (team.length - m) : 0; low += l * l; for (let i = 0; i < team.length; i++)
            for (let j = i + 1; j < team.length; j++) {
                const key = pairKey(team[i].id, team[j].id);
                if (prohibited.has(key))
                    repeats++;
                history += frequencies.get(key) || 0;
            } }); return [repeats, gender - minimumGender, low - minimumLow, history]; };
        let score = metric(teams);
        const steps = input.improveSteps === undefined ? Math.min(8000, players.length * players.length * 4) : input.improveSteps;
        if (!Number.isInteger(steps) || steps < 0)
            return finish('invalid-configuration', 'Invalid improvement budget.');
        for (let step = 0; step < steps; step++) {
            if (score[1] === 0 && score[2] === 0 && (!input.prioritizeHistory || score[3] === 0))
                break;
            if (Date.now() - started >= milliseconds)
                break;
            if (input.cancelled && input.cancelled()) {
                cancelled = true;
                break;
            }
            if (Date.now() - lastYield >= 8) {
                await new Promise(resolve => setTimeout(resolve, 0));
                lastYield = Date.now();
            }
            if (teams.length < 2)
                break;
            const a = random(teams.length), b = random(teams.length);
            if (a === b)
                continue;
            const i = random(teams[a].length), j = random(teams[b].length), pa = teams[a][i], pb = teams[b][j];
            teams[a][i] = pb;
            teams[b][j] = pa;
            const topValid = [teams[a], teams[b]].every(team => team.filter(p => tops.has(p.id)).length <= 1);
            const next = topValid ? metric(teams) : null;
            let comparison = 0;
            if (next)
                for (let k = 0; k < next.length; k++) {
                    if (next[k] !== score[k]) {
                        comparison = next[k] < score[k] ? -1 : 1;
                        break;
                    }
                }
            if (next && next[0] <= limit && (comparison < 0 || comparison === 0 && random(2) === 0))
                score = next;
            else {
                teams[a][i] = pa;
                teams[b][j] = pb;
            }
        }
        if (cancelled)
            return finish('cancelled', 'Generation canceled.');
        result.teams = balanced ? pairByComposition(teams, random) : teams.map(team => team.slice());
        const errors = validateAllocation(input.players, caps, result.teams, result.retainedTopIds, prohibited, limit);
        if (errors.length) {
            result.teams = [];
            return finish('unexpected-error', 'Final validation failed: ' + errors.join(' '));
        }
        result.teams.forEach(team => { for (let i = 0; i < team.length; i++)
            for (let j = i + 1; j < team.length; j++)
                if (prohibited.has(pairKey(team[i].id, team[j].id)))
                    result.repeatedPairs.push([team[i].id, team[j].id]); });
        result.historyCost = score[3];
        result.balancingOptimal = score[1] === 0 && score[2] === 0;
        result.historyOptimal = score[3] === 0;
        if (!result.balancingOptimal)
            result.warnings.push('A valid scramble was found; globally best gender/low balance was not proved within the improvement budget.');
        if (input.prioritizeHistory && !result.historyOptimal)
            result.warnings.push('League history preference was optimized within a bounded search; global minimum history cost is not proved.');
        return finish('success', result.strictImpossible ? 'Strict scrambling was impossible. This arrangement contains ' + result.repeatedPairs.length + ' repeated teammate pairings.' : 'Scramble generated within the selected constraints.');
    }
    catch (_) {
        result.teams = [];
        return finish('unexpected-error', 'An unexpected generation error occurred. No partial scramble was returned.');
    }
}

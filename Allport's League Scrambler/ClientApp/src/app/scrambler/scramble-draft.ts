import { RandomInt, secureRandomInt, shuffled } from './scramble-engine';

type DraftGender = 'male' | 'female' | 'neutral';
interface DraftIdentity { readonly id: number; readonly name: string; readonly gender?: string; readonly isMale?: boolean; }
interface DraftPlayer {
    readonly id: number;
    readonly name: string;
    readonly top: boolean;
    readonly gender: DraftGender;
}
interface DraftTeam { readonly id: number; readonly label: string; readonly players: readonly DraftPlayer[]; }
export interface DraftMatchup { readonly id: number; readonly label: string; readonly teams: readonly DraftTeam[]; }
export interface DraftReveal {
    readonly player: DraftPlayer;
    readonly matchupId: number;
    readonly teamId: number;
    readonly slot: number;
}
export interface ScrambleDraft {
    readonly matchups: readonly DraftMatchup[];
    readonly queue: readonly DraftReveal[];
    readonly matchupCount: number;
}

export function buildScrambleDraft(
    teams: readonly { readonly id: number; readonly playerIds: readonly number[] }[],
    byes: readonly number[],
    selected: readonly DraftIdentity[],
    topIds: readonly number[],
    lowIds: readonly number[],
    random: RandomInt = secureRandomInt
): ScrambleDraft {
    const top = new Set(topIds);
    const low = new Set(lowIds);
    const players = new Map(selected.map(player => [player.id, Object.freeze({
        id: player.id, name: player.name, top: top.has(player.id), gender: draftGender(player)
    })]));
    const assigned = new Set<number>();
    const teamIds = new Set<number>();
    const makeTeam = (id: number, label: string, ids: readonly number[]): DraftTeam => {
        if (teamIds.has(id) || !ids.length) throw new Error('A draft destination has an invalid team or roster.');
        teamIds.add(id);
        const roster = ids.map(playerId => {
            if (assigned.has(playerId) || !players.has(playerId)) throw new Error('The draft has an invalid player assignment.');
            assigned.add(playerId);
            return players.get(playerId)!;
        });
        return Object.freeze({ id, label, players: Object.freeze(roster) });
    };
    const finalTeams = teams.map(team => makeTeam(team.id, 'Team ' + team.id, team.playerIds));
    const matchups: DraftMatchup[] = [];
    for (let i = 0; i < finalTeams.length; i += 2) {
        const pair = finalTeams.slice(i, i + 2);
        const label = pair.length === 2 ? 'Matchup ' + (i / 2 + 1) : 'Unpaired team';
        matchups.push(Object.freeze({ id: matchups.length, label, teams: Object.freeze(pair) }));
    }
    const matchupCount = Math.floor(finalTeams.length / 2);
    if (byes.length) matchups.push(Object.freeze({
        id: matchups.length, label: 'Sitting out', teams: Object.freeze([makeTeam(0, 'Bye players', byes)])
    }));
    if (assigned.size !== selected.length) throw new Error('The draft does not contain every selected player.');

    const destinations = matchups.flatMap(matchup => matchup.teams.map(team => ({
        count: 0,
        entries: team.players.map((player, slot) => Object.freeze({ player, matchupId: matchup.id, teamId: team.id, slot }))
    })));
    const queue: DraftReveal[] = [];
    for (const isTop of [true, false]) {
        const pending = destinations.map(destination => ({
            destination,
            entries: shuffled(destination.entries.filter(entry => entry.player.top === isTop), random)
                .sort((a, b) => Number(low.has(b.player.id)) - Number(low.has(a.player.id)))
        }));
        // Bye players get the same reveal but don't affect the playing teams' balance.
        const playing = pending.filter(group => group.destination.entries[0].teamId !== 0);
        const visited = new Set<number>();
        let previousMatchup: number | undefined;
        while (playing.some(group => group.entries.length)) {
            let eligible = playing.filter(group => group.entries.length);
            if (isTop) {
                const nextMatchups = eligible.filter(group => !visited.has(group.entries[0].matchupId));
                if (nextMatchups.length) eligible = nextMatchups;
                else visited.clear();
            }
            const minimum = Math.min(...eligible.map(group => group.destination.count));
            let leastFilled = eligible.filter(group => group.destination.count === minimum);
            if (isTop) {
                // Randomize the matchup first so a matchup with two eligible
                // teams has the same chance as one with only one eligible team.
                const matchups = [...new Set(leastFilled.map(group => group.entries[0].matchupId))];
                const alternatives = matchups.filter(id => id !== previousMatchup);
                const choices = alternatives.length ? alternatives : matchups;
                const matchup = choices[random(choices.length)];
                leastFilled = leastFilled.filter(group => group.entries[0].matchupId === matchup);
            }
            const chosen = leastFilled[random(leastFilled.length)];
            const reveal = chosen.entries.pop()!;
            chosen.destination.count++;
            queue.push(reveal);
            if (isTop) {
                visited.add(reveal.matchupId);
                previousMatchup = reveal.matchupId;
            }
        }
        const sittingOut = pending.find(group => group.destination.entries[0].teamId === 0);
        if (sittingOut) queue.push(...sittingOut.entries);
    }
    return Object.freeze({ matchups: Object.freeze(matchups), queue: Object.freeze(queue), matchupCount });
}

function draftGender(player: DraftIdentity): DraftGender {
    const gender = player.gender?.trim().toLowerCase();
    if (gender === 'male' || gender === 'female') return gender;
    if (gender || typeof player.isMale !== 'boolean') return 'neutral';
    // Existing league rosters can carry gender as a persisted boolean only.
    return player.isMale ? 'male' : 'female';
}

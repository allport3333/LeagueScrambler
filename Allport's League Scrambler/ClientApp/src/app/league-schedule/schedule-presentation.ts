// Presentation only: preserve event information without repeating the team pairing.
export function scheduleEventDescription(match: any): string {
    const normalize=(value: string)=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const description=(match.matchDescription||'').trim(),text=normalize(description);
    const a=normalize(match.team1Name),b=normalize(match.team2Name),division=normalize(match.division);
    const pairings=[a+'vs'+b,a+'v'+b,b+'vs'+a,b+'v'+a];
    return description && !['regularseason','regularseasonmatch',division].includes(text) && !pairings.some(pair=>text===pair||text===division+pair||text===pair+division) ? description : '';
}

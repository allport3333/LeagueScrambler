export function transferTeamPlayer<T extends { id: number }>(
    source: { players: T[] }, destination: { players: T[] }, playerId: number, swapId?: number
): boolean {
    if (source === destination) return false;
    const player = source.players.find(item => item.id === playerId);
    const swap = destination.players.find(item => item.id === swapId);
    if (!player || (swapId !== undefined && !swap) || destination.players.some(item => item.id === playerId)) return false;
    source.players = source.players.filter(item => item.id !== playerId);
    destination.players = destination.players.filter(item => item.id !== swapId);
    destination.players.push(player);
    if (swap) source.players.push(swap);
    return true;
}

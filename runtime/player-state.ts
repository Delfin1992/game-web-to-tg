import type { GameState } from "../game-engine/types";

const playerGameStateByUserId = new Map<string, GameState>();

export function getPlayerRuntimeState(userId: string) {
  return playerGameStateByUserId.get(userId);
}

export function setPlayerRuntimeState(userId: string, state: GameState) {
  playerGameStateByUserId.set(userId, state);
  return state;
}

export function deletePlayerRuntimeState(userId: string) {
  playerGameStateByUserId.delete(userId);
}

export function clearAllPlayerRuntimeState() {
  playerGameStateByUserId.clear();
}

export function getPlayerRuntimeStateMap() {
  return playerGameStateByUserId;
}

export function exportPlayerRuntimeStateSnapshot() {
  return Array.from(playerGameStateByUserId.entries()).map(([userId, state]) => [
    userId,
    structuredClone(state),
  ] as const);
}

export function importPlayerRuntimeStateSnapshot(snapshot: Array<readonly [string, GameState]> | null | undefined) {
  playerGameStateByUserId.clear();
  for (const entry of Array.isArray(snapshot) ? snapshot : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [userId, state] = entry;
    if (!userId || !state) continue;
    playerGameStateByUserId.set(String(userId), structuredClone(state));
  }
}

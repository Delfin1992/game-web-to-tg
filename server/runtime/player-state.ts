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

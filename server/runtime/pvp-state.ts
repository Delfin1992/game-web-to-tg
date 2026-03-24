import type { PvpBoostId } from "../../shared/pvp-duel";
import type { EngineActiveDuel } from "../pvp-engine";
import type { PvpQueuePlayer, PvpDuelResult } from "../pvp-duel";

type PendingResult = {
  result: PvpDuelResult;
};

export const pvpQueueByUserId = new Map<string, PvpQueuePlayer>();
export const pendingPvpResultByUserId = new Map<string, PendingResult>();
export const activePvpDuelById = new Map<string, EngineActiveDuel>();
export const activePvpDuelIdByUserId = new Map<string, string>();
export const pendingPvpBoostsByUserId = new Map<string, Set<PvpBoostId>>();

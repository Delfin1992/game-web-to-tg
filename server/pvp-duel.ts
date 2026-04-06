import {
  PVP_DUEL_CONFIG,
  getPvpDailyBoostCatalog,
  getPvpBoostDefinition,
  getPvpShopRotation,
  type DuelProjectStageKey,
  type DuelRoundResult,
  type DuelTacticId,
  type PvpActiveDuelStageView,
  type PvpActiveDuelView,
  type PvpBoostDefinition,
  type PvpBoostId,
} from "../shared/pvp-duel";
import {
  applyDuelBoost,
  applyDuelTactic,
  generateBalancedPvpBot,
  processDuelTicks,
  startDuel as startDuelEngine,
  startPreparedDuel,
  type DuelBoostState,
  type DuelParticipantSeed,
  type DuelSkills,
  type EngineActiveDuel,
} from "./pvp-engine";
import type { ProfessionId } from "../shared/professions";
import {
  activePvpDuelById as activeDuelById,
  activePvpDuelIdByUserId as activeDuelIdByUserId,
  pendingPvpBoostsByUserId as pendingBoostsByUserId,
  pendingPvpResultByUserId as pendingResultByUserId,
  pendingPvpTacticsByUserId as pendingTacticsByUserId,
  pvpQueueByUserId as queueByUserId,
} from "./runtime/pvp-state";

export type PvpQueuePlayer = {
  userId: string;
  username: string;
  level: number;
  rating: number;
  professionId?: ProfessionId | null;
  skills: DuelSkills;
  skillSum: number;
  pvpPowerScore: number;
  gadget?: DuelParticipantSeed["gadget"];
  tacticsByStage?: Partial<Record<DuelProjectStageKey, DuelTacticId>>;
  joinedAtMs: number;
  lastActiveAtMs: number;
  boosts: DuelBoostState;
  isBot?: boolean;
};

export type PvpDuelResult = {
  id: string;
  createdAtMs: number;
  playerAUserId: string;
  playerAName: string;
  playerARatingBefore: number;
  playerARatingAfter: number;
  playerBUserId: string;
  playerBName: string;
  playerBRatingBefore: number;
  playerBRatingAfter: number;
  playerAIsBot?: boolean;
  playerBIsBot?: boolean;
  winnerUserId: string | null;
  rounds: DuelRoundResult[];
  winnerXp: number;
  winnerReputation: number;
  loserXp: number;
  drawXp?: number;
  drawReputation?: number;
  energyCostA?: number;
  energyCostB?: number;
  boostIdsA?: PvpBoostId[];
  boostIdsB?: PvpBoostId[];
};

const TEST_BOT_USERNAME = String(process.env.PVP_TEST_BOT_USERNAME || "pvp_test_bot").trim().toLowerCase();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getWaitSeconds(joinedAtMs: number, nowMs: number) {
  return Math.max(0, Math.floor((nowMs - joinedAtMs) / 1000));
}

function isLowLevel(level: number) {
  return Number(level || 1) < 10;
}

function getExpandedLimits(entry: PvpQueuePlayer, nowMs: number) {
  const waited = getWaitSeconds(entry.joinedAtMs, nowMs);
  const expandFactor = clamp(waited / 18, 0, 1);
  const levelMax = isLowLevel(entry.level)
    ? Math.round(PVP_DUEL_CONFIG.matchmaking.lowLevelBaseDelta + (PVP_DUEL_CONFIG.matchmaking.lowLevelExpandedDelta - PVP_DUEL_CONFIG.matchmaking.lowLevelBaseDelta) * expandFactor)
    : Math.round(PVP_DUEL_CONFIG.matchmaking.highLevelBaseDelta + (PVP_DUEL_CONFIG.matchmaking.highLevelExpandedDelta - PVP_DUEL_CONFIG.matchmaking.highLevelBaseDelta) * expandFactor);
  const ratingMax = Math.round(
    PVP_DUEL_CONFIG.matchmaking.ratingDiffBase
    + (PVP_DUEL_CONFIG.matchmaking.ratingDiffExpanded - PVP_DUEL_CONFIG.matchmaking.ratingDiffBase) * expandFactor,
  );
  const powerMax = Number(
    (
      PVP_DUEL_CONFIG.matchmaking.powerDiffBase
      + (PVP_DUEL_CONFIG.matchmaking.powerDiffExpanded - PVP_DUEL_CONFIG.matchmaking.powerDiffBase) * expandFactor
    ).toFixed(3),
  );
  return { levelMax, ratingMax, powerMax };
}

function isQueueEntryActive(entry: PvpQueuePlayer, nowMs: number) {
  return nowMs - entry.lastActiveAtMs <= PVP_DUEL_CONFIG.queueOfflineTimeoutMs;
}

function isTestBotEntry(entry: PvpQueuePlayer) {
  const username = String(entry.username || "").trim().toLowerCase();
  return entry.isBot || username === TEST_BOT_USERNAME || username.startsWith(`${TEST_BOT_USERNAME}_`);
}

function toParticipantSeed(entry: PvpQueuePlayer): DuelParticipantSeed {
  return {
    userId: entry.userId,
    username: entry.username,
    rating: entry.rating,
    skills: { ...entry.skills },
    professionId: entry.professionId ?? null,
    boosts: { selectedBoosts: [...entry.boosts.selectedBoosts] },
    gadget: entry.gadget ?? null,
    pvpPowerScore: entry.pvpPowerScore,
    tacticsByStage: { ...(entry.tacticsByStage || {}) },
    isBot: Boolean(entry.isBot),
  };
}

function isPairAllowed(a: PvpQueuePlayer, b: PvpQueuePlayer, nowMs: number) {
  const limitsA = getExpandedLimits(a, nowMs);
  const limitsB = getExpandedLimits(b, nowMs);
  const levelDiff = Math.abs(Number(a.level || 1) - Number(b.level || 1));
  if (levelDiff > limitsA.levelMax || levelDiff > limitsB.levelMax) return false;

  const maxPower = Math.max(1, Number(a.pvpPowerScore || 0), Number(b.pvpPowerScore || 0));
  const powerDiffRatio = Math.abs(Number(a.pvpPowerScore || 0) - Number(b.pvpPowerScore || 0)) / maxPower;
  if (powerDiffRatio > limitsA.powerMax || powerDiffRatio > limitsB.powerMax) return false;

  const ratingDiff = Math.abs(Number(a.rating || 0) - Number(b.rating || 0));
  if (ratingDiff > limitsA.ratingMax || ratingDiff > limitsB.ratingMax) return false;

  return true;
}

function scorePair(a: PvpQueuePlayer, b: PvpQueuePlayer) {
  const diffLevel = Math.abs(Number(a.level || 1) - Number(b.level || 1));
  const maxPower = Math.max(1, Number(a.pvpPowerScore || 0), Number(b.pvpPowerScore || 0));
  const diffPowerRatio = Math.abs(Number(a.pvpPowerScore || 0) - Number(b.pvpPowerScore || 0)) / maxPower;
  const diffRating = Math.abs(Number(a.rating || 0) - Number(b.rating || 0));
  return diffLevel * PVP_DUEL_CONFIG.matchmaking.levelWeight
    + diffPowerRatio * PVP_DUEL_CONFIG.matchmaking.powerWeight
    + diffRating * PVP_DUEL_CONFIG.matchmaking.ratingWeight;
}

function findBestPair(nowMs: number): [PvpQueuePlayer, PvpQueuePlayer] | null {
  const active = Array.from(queueByUserId.values()).filter((entry) => isQueueEntryActive(entry, nowMs));
  if (active.length < 2) return null;

  const pickBestPair = (pool: PvpQueuePlayer[]) => {
    let bestPair: [PvpQueuePlayer, PvpQueuePlayer] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const a = pool[i];
        const b = pool[j];
        if (!isPairAllowed(a, b, nowMs)) continue;
        const pairScore = scorePair(a, b);
        if (pairScore < bestScore) {
          bestScore = pairScore;
          bestPair = [a, b];
        }
      }
    }

    return bestPair;
  };

  const humanOnly = active.filter((entry) => !isTestBotEntry(entry));
  return pickBestPair(humanOnly) ?? pickBestPair(active);
}

function getCurrentStageKeySafe(participant: EngineActiveDuel["playerA"]) {
  return PVP_DUEL_CONFIG.process.stages[participant.currentStageIndex]?.key ?? PVP_DUEL_CONFIG.process.stages.at(-1)?.key ?? "tests";
}

function buildStageView(duel: EngineActiveDuel, userId: string, stageKey: DuelProjectStageKey): PvpActiveDuelStageView {
  const stage = PVP_DUEL_CONFIG.process.stages.find((item) => item.key === stageKey)!;
  const me = duel.playerA.userId === userId ? duel.playerA : duel.playerB;
  const opponent = duel.playerA.userId === userId ? duel.playerB : duel.playerA;
  const target = duel.stageTargets[stageKey];
  const myProgress = Number(me.stageProgress[stageKey] || 0);
  const opponentProgress = Number(opponent.stageProgress[stageKey] || 0);
  const myPercent = Math.round((myProgress / Math.max(1, target)) * 100);
  const opponentPercent = Math.round((opponentProgress / Math.max(1, target)) * 100);
  const myCompleted = Boolean(me.stageCompletedTick[stageKey] !== undefined);
  const opponentCompleted = Boolean(opponent.stageCompletedTick[stageKey] !== undefined);
  return {
    key: stageKey,
    label: stage.label,
    description: stage.description,
    targetScore: target,
    myProgress: Number(myProgress.toFixed(2)),
    opponentProgress: Number(opponentProgress.toFixed(2)),
    myPercent: Math.max(0, Math.min(100, myPercent)),
    opponentPercent: Math.max(0, Math.min(100, opponentPercent)),
    myCompleted,
    opponentCompleted,
    isCurrent: getCurrentStageKeySafe(me) === stageKey || getCurrentStageKeySafe(opponent) === stageKey,
    isCompleted: myCompleted || opponentCompleted,
    leaderUserId: myProgress === opponentProgress ? null : (myProgress > opponentProgress ? me.userId : opponent.userId),
    myTactic: me.tacticsByStage[stageKey] ?? null,
    opponentTactic: opponent.tacticsByStage[stageKey] ?? null,
  };
}

function buildActiveDuelView(duel: EngineActiveDuel, userId: string, nowMs: number = Date.now()): PvpActiveDuelView {
  const me = duel.playerA.userId === userId ? duel.playerA : duel.playerB;
  const opponent = duel.playerA.userId === userId ? duel.playerB : duel.playerA;
  const latestEvent = duel.recentEvents.at(-1);
  const myLatestEvent = [...duel.recentEvents].reverse().find((event) => event.actorUserId === me.userId);
  const opponentLatestEvent = [...duel.recentEvents].reverse().find((event) => event.actorUserId === opponent.userId);
  const currentStageKey = getCurrentStageKeySafe(me);
  const currentStage = PVP_DUEL_CONFIG.process.stages.find((stage) => stage.key === currentStageKey) ?? PVP_DUEL_CONFIG.process.stages[2];
  const currentRoundState = duel.roundStates[currentStageKey];
  const stagePreparationRemainingMs = currentRoundState ? Math.max(0, Number(currentRoundState.startsAtMs || 0) - nowMs) : 0;
  const stageViews = PVP_DUEL_CONFIG.process.stages.map((stage) => buildStageView(duel, userId, stage.key));
  const totalTarget = Object.values(duel.stageTargets).reduce((sum, value) => sum + value, 0);
  const myProgressTotal = Object.values(me.stageProgress).reduce((sum, value) => sum + Number(value || 0), 0);
  const overallProgress = Math.round((myProgressTotal / Math.max(1, totalTarget)) * 100);
  return {
    duelId: duel.duelId,
    awaitingStart: nowMs < duel.startedAtMs,
    preparationEndsAtMs: duel.preparationEndsAtMs,
    preparationRemainingMs: Math.max(0, duel.startedAtMs - nowMs),
    startedAtMs: duel.startedAtMs,
    updatedAtMs: duel.updatedAtMs,
    expectedEndAtMs: duel.expectedEndAtMs,
    opponentName: opponent.username,
    myName: me.username,
    currentStageKey,
    currentStageLabel: currentStage.label,
    currentStageDescription: currentStage.description,
    overallProgress: Math.max(0, Math.min(100, overallProgress)),
    tick: duel.lastProcessedTick,
    tickIntervalMs: PVP_DUEL_CONFIG.process.tickIntervalMs,
    closeMatch: duel.closeMatch,
    myTotalPower: Number(me.totalPower.toFixed(2)),
    opponentTotalPower: Number(opponent.totalPower.toFixed(2)),
    myTickGain: Number(me.latestTickGain.toFixed(2)),
    opponentTickGain: Number(opponent.latestTickGain.toFixed(2)),
    myFreezeTicks: me.effects.freezeTicks,
    opponentFreezeTicks: opponent.effects.freezeTicks,
    latestLog: duel.latestLog,
    latestEventKind: latestEvent?.kind,
    latestEventActorName: latestEvent?.actorName,
    latestEventTitle: latestEvent?.title,
    latestEventDetails: latestEvent?.details,
    myLatestEventKind: myLatestEvent?.kind,
    myLatestEventTitle: myLatestEvent?.title,
    myLatestEventDetails: myLatestEvent?.details,
    opponentLatestEventKind: opponentLatestEvent?.kind,
    opponentLatestEventTitle: opponentLatestEvent?.title,
    opponentLatestEventDetails: opponentLatestEvent?.details,
    recentLogs: duel.recentEvents.map((event) => `${event.actorName}: ${event.title}`),
    myBoosts: [...me.boostIds],
    opponentBoosts: [...opponent.boostIds],
    myBoostName: me.boostIds[0] ? getPvpBoostDefinition(me.boostIds[0])?.name ?? me.boostIds[0] : null,
    opponentBoostName: opponent.boostIds[0] ? getPvpBoostDefinition(opponent.boostIds[0])?.name ?? opponent.boostIds[0] : null,
    myGadgetName: me.gadget?.name ?? null,
    opponentGadgetName: opponent.gadget?.name ?? null,
    stagePreparationRemainingMs,
    myTactics: { ...me.tacticsByStage },
    opponentTactics: { ...opponent.tacticsByStage },
    stages: stageViews,
    myStages: PVP_DUEL_CONFIG.process.stages.map((stage) => ({
      stageKey: stage.key,
      progress: Number(me.stageProgress[stage.key].toFixed(2)),
      target: duel.stageTargets[stage.key],
      percent: Math.max(0, Math.min(100, Math.round((me.stageProgress[stage.key] / Math.max(1, duel.stageTargets[stage.key])) * 100))),
      completed: Boolean(me.stageCompletedTick[stage.key] !== undefined),
    })),
    opponentStages: PVP_DUEL_CONFIG.process.stages.map((stage) => ({
      stageKey: stage.key,
      progress: Number(opponent.stageProgress[stage.key].toFixed(2)),
      target: duel.stageTargets[stage.key],
      percent: Math.max(0, Math.min(100, Math.round((opponent.stageProgress[stage.key] / Math.max(1, duel.stageTargets[stage.key])) * 100))),
      completed: Boolean(opponent.stageCompletedTick[stage.key] !== undefined),
    })),
  };
}

function computeRatingDelta(selfRating: number, opponentRating: number, didWin: boolean, isDraw: boolean, isBotFight: boolean) {
  if (isDraw) return PVP_DUEL_CONFIG.rating.drawDelta;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - selfRating) / 400));
  const adjustment = PVP_DUEL_CONFIG.rating.maxAdjustment;
  const baseDelta = didWin
    ? Math.round(PVP_DUEL_CONFIG.rating.winDelta + (1 - expected) * adjustment)
    : -Math.round(Math.abs(PVP_DUEL_CONFIG.rating.loseDelta) + expected * adjustment);

  if (!isBotFight) return baseDelta;

  // Bot fights should still move rating, but a bit softer than full PvP.
  if (didWin) return Math.max(5, Math.round(baseDelta * 0.6));
  return Math.min(-4, Math.round(baseDelta * 0.6));
}

function finalizeDuelResult(duel: EngineActiveDuel): PvpDuelResult {
  const isWinnerA = duel.winnerUserId === duel.playerA.userId;
  const isWinnerB = duel.winnerUserId === duel.playerB.userId;
  const isDraw = duel.winnerUserId === null;
  const isBotFight = duel.playerA.isBot || duel.playerB.isBot;
  const playerARatingAfter = Math.max(
    0,
    duel.playerA.ratingBefore + computeRatingDelta(duel.playerA.ratingBefore, duel.playerB.ratingBefore, isWinnerA, isDraw, isBotFight),
  );
  const playerBRatingAfter = Math.max(
    0,
    duel.playerB.ratingBefore + computeRatingDelta(duel.playerB.ratingBefore, duel.playerA.ratingBefore, isWinnerB, isDraw, isBotFight),
  );
  return {
    id: duel.duelId,
    createdAtMs: duel.finishedAtMs ?? duel.updatedAtMs,
    playerAUserId: duel.playerA.userId,
    playerAName: duel.playerA.username,
    playerARatingBefore: duel.playerA.ratingBefore,
    playerARatingAfter,
    playerBUserId: duel.playerB.userId,
    playerBName: duel.playerB.username,
    playerBRatingBefore: duel.playerB.ratingBefore,
    playerBRatingAfter,
    playerAIsBot: duel.playerA.isBot,
    playerBIsBot: duel.playerB.isBot,
    winnerUserId: duel.winnerUserId,
    rounds: duel.rounds,
    winnerXp: PVP_DUEL_CONFIG.reward.winnerXp,
    winnerReputation: PVP_DUEL_CONFIG.reward.winnerReputation,
    loserXp: duel.winnerUserId === null ? PVP_DUEL_CONFIG.reward.drawXp : PVP_DUEL_CONFIG.reward.loserXp,
    drawXp: PVP_DUEL_CONFIG.reward.drawXp,
    drawReputation: PVP_DUEL_CONFIG.reward.drawReputation,
    energyCostA: duel.energyCostA,
    energyCostB: duel.energyCostB,
    boostIdsA: [...duel.playerA.boostIds],
    boostIdsB: [...duel.playerB.boostIds],
  };
}

function getActiveDuelForUser(userId: string) {
  const activeDuelId = activeDuelIdByUserId.get(userId);
  return activeDuelId ? activeDuelById.get(activeDuelId) ?? null : null;
}

export function getPvpBoostCatalog(): PvpBoostDefinition[] {
  return getPvpDailyBoostCatalog();
}

export function getPendingPvpBoosts(userId: string): PvpBoostId[] {
  return Array.from(pendingBoostsByUserId.get(userId) ?? []);
}

export function getPendingPvpTactics(userId: string): Partial<Record<DuelProjectStageKey, DuelTacticId>> {
  return { ...(pendingTacticsByUserId.get(userId) ?? {}) };
}

export function purchasePvpBoost(userId: string, boostId: PvpBoostId) {
  const definition = getPvpBoostDefinition(boostId);
  if (!definition) throw new Error("Неизвестный PvP-предмет");

  const activeDuel = getActiveDuelForUser(userId);
  if (activeDuel && Date.now() < activeDuel.startedAtMs) {
    applyDuelBoost(activeDuel, userId, boostId);
    return activeDuel.playerA.userId === userId ? [...activeDuel.playerA.boostIds] : [...activeDuel.playerB.boostIds];
  }

  const owned = pendingBoostsByUserId.get(userId) ?? new Set<PvpBoostId>();
  if (owned.size >= 1) {
    throw new Error("На бой можно выбрать только 1 PvP-предмет");
  }
  if (owned.has(boostId)) {
    throw new Error("Этот предмет уже выбран для следующей дуэли");
  }
  owned.add(boostId);
  pendingBoostsByUserId.set(userId, owned);
  return [...owned];
}

export function selectPvpTactic(userId: string, stageKey: DuelProjectStageKey, tacticId: DuelTacticId) {
  const activeDuel = getActiveDuelForUser(userId);
  if (activeDuel && Date.now() < activeDuel.finishedAtMs! ? activeDuel.finishedAtMs : Number.MAX_SAFE_INTEGER) {
    if (activeDuel && Date.now() < activeDuel.startedAtMs) {
      applyDuelTactic(activeDuel, userId, stageKey, tacticId);
      return activeDuel.playerA.userId === userId ? { ...activeDuel.playerA.tacticsByStage } : { ...activeDuel.playerB.tacticsByStage };
    }
    if (activeDuel) {
      applyDuelTactic(activeDuel, userId, stageKey, tacticId);
      return activeDuel.playerA.userId === userId ? { ...activeDuel.playerA.tacticsByStage } : { ...activeDuel.playerB.tacticsByStage };
    }
  }

  const next = { ...(pendingTacticsByUserId.get(userId) ?? {}) };
  next[stageKey] = tacticId;
  pendingTacticsByUserId.set(userId, next);
  return next;
}

export function clearPendingPvpBoosts(userId: string) {
  pendingBoostsByUserId.delete(userId);
}

export function clearPendingPvpTactics(userId: string) {
  pendingTacticsByUserId.delete(userId);
}

export function updatePvpHeartbeat(userId: string, nowMs: number = Date.now()) {
  const entry = queueByUserId.get(userId);
  if (!entry) return;
  queueByUserId.set(userId, { ...entry, lastActiveAtMs: nowMs });
}

export function leavePvpQueue(userId: string) {
  queueByUserId.delete(userId);
}

export function startActivePvpDuelNow(userId: string, nowMs: number = Date.now()) {
  const duel = getActiveDuelForUser(userId);
  if (!duel) return null;
  startPreparedDuel(duel, nowMs);
  processDuelTicks(duel, nowMs);
  return duel;
}

export function getPvpQueueState(userId: string, nowMs: number = Date.now()) {
  const queueEntry = queueByUserId.get(userId);
  const pending = pendingResultByUserId.get(userId);
  const duel = getActiveDuelForUser(userId);
  if (duel && nowMs >= duel.startedAtMs) {
    processDuelTicks(duel, nowMs);
  }
  return {
    inQueue: !!queueEntry,
    queueJoinedAtMs: queueEntry?.joinedAtMs ?? null,
    queueWaitSec: queueEntry ? Math.max(0, Math.floor((nowMs - queueEntry.joinedAtMs) / 1000)) : 0,
    queueSize: Array.from(queueByUserId.values()).filter((entry) => isQueueEntryActive(entry, nowMs)).length,
    hasPendingResult: !!pending,
    result: pending?.result ?? null,
    activeDuel: duel ? buildActiveDuelView(duel, userId, nowMs) : null,
    pendingBoosts: getPendingPvpBoosts(userId),
    pendingTactics: getPendingPvpTactics(userId),
  };
}

export function consumePendingPvpResult(userId: string) {
  const pending = pendingResultByUserId.get(userId);
  if (!pending) return null;
  pendingResultByUserId.delete(userId);
  return pending.result;
}

export function queuePlayerForPvp(player: Omit<PvpQueuePlayer, "joinedAtMs" | "lastActiveAtMs" | "boosts">, nowMs: number = Date.now()) {
  const selectedBoosts = getPendingPvpBoosts(player.userId).slice(0, 1);
  const tacticsByStage = getPendingPvpTactics(player.userId);
  const entry: PvpQueuePlayer = {
    ...player,
    joinedAtMs: nowMs,
    lastActiveAtMs: nowMs,
    boosts: { selectedBoosts },
    tacticsByStage,
  };
  queueByUserId.set(player.userId, entry);
}

export function runPvpMatchmaking(nowMs: number = Date.now()) {
  for (const entry of Array.from(queueByUserId.values())) {
    if (!isQueueEntryActive(entry, nowMs)) {
      queueByUserId.delete(entry.userId);
    }
  }

  const pair = findBestPair(nowMs);
  if (!pair) return null;
  const [a, b] = pair;
  queueByUserId.delete(a.userId);
  queueByUserId.delete(b.userId);

  const duel = startDuelEngine(toParticipantSeed(a), toParticipantSeed(b), nowMs);
  activeDuelById.set(duel.duelId, duel);
  activeDuelIdByUserId.set(a.userId, duel.duelId);
  activeDuelIdByUserId.set(b.userId, duel.duelId);
  clearPendingPvpBoosts(a.userId);
  clearPendingPvpBoosts(b.userId);
  clearPendingPvpTactics(a.userId);
  clearPendingPvpTactics(b.userId);
  return duel;
}

export function settleCompletedPvpDuels(nowMs: number = Date.now()) {
  const completed: PvpDuelResult[] = [];
  for (const duel of Array.from(activeDuelById.values())) {
    processDuelTicks(duel, nowMs);
    if (!duel.finishedAtMs || duel.finishedAtMs > nowMs) continue;
    activeDuelById.delete(duel.duelId);
    activeDuelIdByUserId.delete(duel.playerA.userId);
    activeDuelIdByUserId.delete(duel.playerB.userId);
    const result = finalizeDuelResult(duel);
    pendingResultByUserId.set(duel.playerA.userId, { result });
    pendingResultByUserId.set(duel.playerB.userId, { result });
    completed.push(result);
  }
  return completed;
}

export function findBestPvpBotTarget(botUserId: string, nowMs: number = Date.now(), excludedUserIds: string[] = []) {
  const blocked = new Set(excludedUserIds);
  const active = Array.from(queueByUserId.values())
    .filter((entry) => entry.userId !== botUserId && !blocked.has(entry.userId) && isQueueEntryActive(entry, nowMs) && !isTestBotEntry(entry))
    .filter((entry) => {
      const waited = getWaitSeconds(entry.joinedAtMs, nowMs);
      const minWait = isLowLevel(entry.level) ? PVP_DUEL_CONFIG.bots.lowLevelWaitSecMin : PVP_DUEL_CONFIG.bots.highLevelWaitSecMin;
      return waited >= minWait;
    })
    .sort((a, b) => {
      const waitDiff = a.joinedAtMs - b.joinedAtMs;
      if (waitDiff !== 0) return waitDiff;
      return scorePair(a, b);
    });
  return active[0] ?? null;
}

export function generateBalancedBotForTarget(target: Omit<PvpQueuePlayer, "joinedAtMs" | "lastActiveAtMs" | "boosts">, botUserId: string, username: string) {
  return generateBalancedPvpBot(
    {
      userId: target.userId,
      username: target.username,
      rating: target.rating,
      skills: target.skills,
      boosts: { selectedBoosts: [] },
      gadget: target.gadget ?? null,
      pvpPowerScore: target.pvpPowerScore,
      tacticsByStage: {},
    },
    botUserId,
    username,
  );
}

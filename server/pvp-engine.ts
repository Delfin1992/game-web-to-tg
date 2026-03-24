import { randomUUID } from "crypto";
import {
  PVP_DUEL_CONFIG,
  type DuelProjectStageKey,
  type DuelRoundResult,
  type PvpBattleEventLog,
  type PvpBoostId,
} from "../shared/pvp-duel";

export type DuelSkills = {
  analytics: number;
  coding: number;
  testing: number;
  attention: number;
  design: number;
  drawing: number;
  modeling: number;
};

export type DuelBoostState = {
  selectedBoosts: PvpBoostId[];
};

export type DuelParticipantSeed = {
  userId: string;
  username: string;
  rating: number;
  skills: DuelSkills;
  boosts?: DuelBoostState;
  isBot?: boolean;
};

type ParticipantRuntime = {
  userId: string;
  username: string;
  ratingBefore: number;
  skills: DuelSkills;
  totalPower: number;
  stageProgress: Record<DuelProjectStageKey, number>;
  stageCompletedTick: Partial<Record<DuelProjectStageKey, number>>;
  currentStageIndex: number;
  freezeUntilTick: number;
  tickMultiplierUntilTick: number;
  tickMultiplierValue: number;
  latestTickGain: number;
  boostIds: PvpBoostId[];
  negativeImmunity: boolean;
};

export type EngineActiveDuel = {
  duelId: string;
  createdAtMs: number;
  startedAtMs: number;
  preparationEndsAtMs: number;
  updatedAtMs: number;
  lastProcessedTick: number;
  expectedEndAtMs: number;
  seed: number;
  closeMatch: boolean;
  stageTargets: Record<DuelProjectStageKey, number>;
  rounds: DuelRoundResult[];
  recentEvents: PvpBattleEventLog[];
  latestLog: string;
  playerA: ParticipantRuntime;
  playerB: ParticipantRuntime;
  winnerUserId: string | null;
  finishedAtMs: number | null;
  energyCostA: number;
  energyCostB: number;
};

type TickParticipantState = {
  gain: number;
  overflow: number;
  eventLog?: PvpBattleEventLog;
};

const POSITIVE_EVENTS = [
  "Нашёл полезный сниппет",
  "IDE подсказала верное решение",
  "Поймал идеальный фокус",
  "Логика внезапно сошлась",
] as const;

const NEGATIVE_EVENTS = [
  "Merge conflict",
  "Плавающий баг",
  "Сломался hot reload",
  "Тест внезапно упал",
] as const;

const duelProcessingLocks = new Set<string>();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let temp = value;
    temp = Math.imul(temp ^ (temp >>> 15), temp | 1);
    temp ^= temp + Math.imul(temp ^ (temp >>> 7), temp | 61);
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(duel: EngineActiveDuel, salt: string) {
  return createSeededRandom(hashSeed(`${duel.seed}:${salt}`));
}

function getPrimarySkillValue(skills: DuelSkills, stageKey: DuelProjectStageKey) {
  if (stageKey === "concept") return Number(skills.analytics || 0);
  if (stageKey === "core") return Number(skills.coding || 0);
  return Number(skills.testing || 0);
}

function computeTotalDuelPower(skills: DuelSkills) {
  const primary = Number(skills.analytics || 0) + Number(skills.coding || 0) + Number(skills.testing || 0);
  const secondary = Number(skills.attention || 0) * 0.65
    + Number(skills.design || 0) * 0.35
    + Number(skills.drawing || 0) * 0.15
    + Number(skills.modeling || 0) * 0.35;
  return Number((primary + secondary).toFixed(2));
}

function getSecondaryModifier(skills: DuelSkills, stageKey: DuelProjectStageKey) {
  if (stageKey === "concept") {
    return 1 + Number(skills.design || 0) * 0.02 + Number(skills.attention || 0) * 0.01;
  }
  if (stageKey === "core") {
    return 1 + Number(skills.modeling || 0) * 0.015 + Number(skills.attention || 0) * 0.01;
  }
  return 1 + Number(skills.attention || 0) * 0.02 + Number(skills.design || 0) * 0.005;
}

function formatStageLabel(stageKey: DuelProjectStageKey) {
  return PVP_DUEL_CONFIG.process.stages.find((stage) => stage.key === stageKey)?.label ?? stageKey;
}

function createParticipant(seed: DuelParticipantSeed): ParticipantRuntime {
  const boostIds = Array.from(new Set(seed.boosts?.selectedBoosts ?? []));
  return {
    userId: seed.userId,
    username: seed.username,
    ratingBefore: seed.rating,
    skills: { ...seed.skills },
    totalPower: computeTotalDuelPower(seed.skills),
    stageProgress: { concept: 0, core: 0, tests: 0 },
    stageCompletedTick: {},
    currentStageIndex: 0,
    freezeUntilTick: 0,
    tickMultiplierUntilTick: 0,
    tickMultiplierValue: 1,
    latestTickGain: 0,
    boostIds,
    negativeImmunity: boostIds.includes("qa_outsource"),
  };
}

function getEnergyCostForParticipant(participant: ParticipantRuntime) {
  const base = PVP_DUEL_CONFIG.process.baseEnergyCost;
  return participant.boostIds.includes("energy_drink")
    ? Number((base * PVP_DUEL_CONFIG.process.energyDrinkMultiplier).toFixed(4))
    : Number(base.toFixed(4));
}

function getCurrentStageKey(participant: ParticipantRuntime): DuelProjectStageKey | null {
  return PVP_DUEL_CONFIG.process.stages[participant.currentStageIndex]?.key ?? null;
}

function isParticipantFinished(participant: ParticipantRuntime) {
  return participant.currentStageIndex >= PVP_DUEL_CONFIG.process.stages.length;
}

function hasCompletedAllStages(duel: EngineActiveDuel, participant: ParticipantRuntime) {
  return PVP_DUEL_CONFIG.process.stages.every((stage) => (
    Number(participant.stageProgress[stage.key] || 0) >= Number(duel.stageTargets[stage.key] || 0)
      && participant.stageCompletedTick[stage.key] !== undefined
  ));
}

function isAwaitingStart(duel: EngineActiveDuel, nowMs: number) {
  return nowMs < duel.startedAtMs && !duel.finishedAtMs;
}

function calculateStageTarget(duel: EngineActiveDuel, stageKey: DuelProjectStageKey) {
  const playerSkill = getPrimarySkillValue(duel.playerA.skills, stageKey);
  const opponentSkill = getPrimarySkillValue(duel.playerB.skills, stageKey);
  return Math.round(
    clamp(
      (playerSkill + opponentSkill) * 7,
      PVP_DUEL_CONFIG.process.stageTarget.min,
      PVP_DUEL_CONFIG.process.stageTarget.max,
    ),
  );
}

function maybeCreateEvent(
  duel: EngineActiveDuel,
  actor: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
  tick: number,
  gain: number,
) {
  const rng = rngFor(duel, `${tick}:${actor.userId}:${stageKey}:event`);
  const attention = Number(actor.skills.attention || 0);
  const eventChance = 0.15 + (duel.closeMatch ? 0.03 : 0);
  if (rng() > eventChance) {
    return { gainDelta: 0, event: undefined as PvpBattleEventLog | undefined };
  }

  const positiveBias = actor.negativeImmunity ? 0.8 : 0.5 + clamp(attention * 0.01, 0, 0.12);
  const isPositive = rng() <= positiveBias;

  if (isPositive) {
    const title = POSITIVE_EVENTS[Math.floor(rng() * POSITIVE_EVENTS.length)] ?? POSITIVE_EVENTS[0];
    if (rng() < 0.55) {
      const instant = Number((gain * (1 + rng())).toFixed(2));
      return {
        gainDelta: instant,
        event: {
          tick,
          actorUserId: actor.userId,
          actorName: actor.username,
          stageKey,
          kind: "positive" as const,
          title,
          details: `Рывок +${instant.toFixed(1)} прогресса`,
          effectType: "instant_progress" as const,
          progressDelta: instant,
        },
      };
    }
    const multiplier = Number((1.35 + rng() * 0.45).toFixed(2));
    actor.tickMultiplierValue = multiplier;
    actor.tickMultiplierUntilTick = tick + 1;
    return {
      gainDelta: 0,
      event: {
        tick,
        actorUserId: actor.userId,
        actorName: actor.username,
        stageKey,
        kind: "positive" as const,
        title,
        details: `Следующий тик идёт с множителем x${multiplier}`,
        effectType: "tick_multiplier" as const,
        progressDelta: 0,
        durationTicks: 1,
      },
    };
  }

  const title = NEGATIVE_EVENTS[Math.floor(rng() * NEGATIVE_EVENTS.length)] ?? NEGATIVE_EVENTS[0];
  if (actor.negativeImmunity) {
    return {
      gainDelta: 0,
      event: {
        tick,
        actorUserId: actor.userId,
        actorName: actor.username,
        stageKey,
        kind: "positive" as const,
        title: "Debugger погасил проблему",
        details: `Событие "${title}" было нейтрализовано`,
        effectType: "freeze" as const,
        progressDelta: 0,
      },
    };
  }

  if (rng() < 0.5) {
    const freezeTicks = attention >= 8 ? 1 : 2;
    actor.freezeUntilTick = tick + freezeTicks;
    return {
      gainDelta: 0,
      event: {
        tick,
        actorUserId: actor.userId,
        actorName: actor.username,
        stageKey,
        kind: "negative" as const,
        title,
        details: `Прогресс заморожен на ${freezeTicks} тика`,
        effectType: "freeze" as const,
        progressDelta: 0,
        durationTicks: freezeTicks,
      },
    };
  }

  const rollback = -Number((gain * (0.8 + rng() * 0.8) * (attention >= 8 ? 0.7 : 1)).toFixed(2));
  return {
    gainDelta: rollback,
    event: {
      tick,
      actorUserId: actor.userId,
      actorName: actor.username,
      stageKey,
      kind: "negative" as const,
      title,
      details: `Откат ${rollback.toFixed(1)} прогресса`,
      effectType: "rollback" as const,
      progressDelta: rollback,
    },
  };
}

function computeTickGain(
  duel: EngineActiveDuel,
  actor: ParticipantRuntime,
  opponent: ParticipantRuntime,
  tick: number,
  stageKey: DuelProjectStageKey,
) {
  const primary = getPrimarySkillValue(actor.skills, stageKey);
  const rng = rngFor(duel, `${tick}:${actor.userId}:${stageKey}:gain`);
  const variance = 0.92 + rng() * 0.16;
  const secondary = getSecondaryModifier(actor.skills, stageKey);
  const closeMatchSwing = duel.closeMatch ? 0.92 + rng() * 0.2 : 0.96 + rng() * 0.08;
  const catchup = actor.currentStageIndex === opponent.currentStageIndex
    && actor.stageProgress[stageKey] < opponent.stageProgress[stageKey]
    ? 1.05
    : 1;
  const boost = stageKey === "core" && actor.boostIds.includes("overclock_cpu") ? 1.2 : 1;
  const temporaryMultiplier = tick <= actor.tickMultiplierUntilTick ? actor.tickMultiplierValue : 1;
  return Number((Math.max(1.25, primary) * secondary * variance * closeMatchSwing * catchup * boost * temporaryMultiplier).toFixed(2));
}

function pushEvent(duel: EngineActiveDuel, event?: PvpBattleEventLog) {
  if (!event) return;
  duel.recentEvents.push(event);
  if (duel.recentEvents.length > 6) {
    duel.recentEvents.splice(0, duel.recentEvents.length - 6);
  }
  duel.latestLog = `${event.actorName}: ${event.title}. ${event.details}`;
}

function applyParticipantTick(
  duel: EngineActiveDuel,
  actor: ParticipantRuntime,
  opponent: ParticipantRuntime,
  tick: number,
): TickParticipantState {
  const stageKey = getCurrentStageKey(actor);
  if (!stageKey) {
    actor.latestTickGain = 0;
    return { gain: 0, overflow: 0 };
  }
  if (tick <= actor.freezeUntilTick) {
    actor.latestTickGain = 0;
    return { gain: 0, overflow: 0 };
  }

  const baseGain = computeTickGain(duel, actor, opponent, tick, stageKey);
  const event = maybeCreateEvent(duel, actor, stageKey, tick, baseGain);
  const gain = Number((baseGain + event.gainDelta).toFixed(2));
  const target = duel.stageTargets[stageKey];
  const next = Math.max(0, Number((actor.stageProgress[stageKey] + gain).toFixed(2)));
  actor.stageProgress[stageKey] = next;
  actor.latestTickGain = gain;

  let overflow = 0;
  if (next >= target) {
    overflow = Number((next - target).toFixed(2));
    actor.stageProgress[stageKey] = Number(target.toFixed(2));
    actor.stageCompletedTick[stageKey] = tick;
    actor.currentStageIndex += 1;
  }

  return { gain, overflow, eventLog: event.event };
}

function logTickState(duel: EngineActiveDuel, tick: number) {
  const stageA = getCurrentStageKey(duel.playerA);
  const stageB = getCurrentStageKey(duel.playerB);
  const formatProgress = (participant: ParticipantRuntime, stageKey: DuelProjectStageKey | null) => {
    if (!stageKey) return "done";
    return `${Number(participant.stageProgress[stageKey] || 0).toFixed(1)}/${Number(duel.stageTargets[stageKey] || 0).toFixed(1)}`;
  };
  console.info(
    `[pvp tick] duel=${duel.duelId} tick=${tick} `
      + `A(${duel.playerA.username}) stage=${stageA ?? "finished"} progress=${formatProgress(duel.playerA, stageA)} gain=${duel.playerA.latestTickGain.toFixed(2)} freezeUntil=${duel.playerA.freezeUntilTick} `
      + `B(${duel.playerB.username}) stage=${stageB ?? "finished"} progress=${formatProgress(duel.playerB, stageB)} gain=${duel.playerB.latestTickGain.toFixed(2)} freezeUntil=${duel.playerB.freezeUntilTick} `
      + `log="${duel.latestLog}"`,
  );
}

function finalizeStageRound(duel: EngineActiveDuel, stageKey: DuelProjectStageKey, tick: number, overflowA: number, overflowB: number) {
  if (duel.rounds.some((round) => round.round === stageKey)) return;
  const scoreA = duel.playerA.stageProgress[stageKey];
  const scoreB = duel.playerB.stageProgress[stageKey];
  let winnerUserId: string | null = null;
  if (scoreA > scoreB) winnerUserId = duel.playerA.userId;
  if (scoreB > scoreA) winnerUserId = duel.playerB.userId;
  duel.rounds.push({
    round: stageKey,
    playerAUserId: duel.playerA.userId,
    playerBUserId: duel.playerB.userId,
    scoreA,
    scoreB,
    winnerUserId,
    targetScore: duel.stageTargets[stageKey],
    overflowA,
    overflowB,
    ticksSpent: tick,
  });
}

function ensureCompletedStageRounds(duel: EngineActiveDuel, tick: number, overflowA: number, overflowB: number) {
  for (const stage of PVP_DUEL_CONFIG.process.stages) {
    if (duel.rounds.some((round) => round.round === stage.key)) continue;
    const progressA = Number(duel.playerA.stageProgress[stage.key] || 0);
    const progressB = Number(duel.playerB.stageProgress[stage.key] || 0);
    const target = Number(duel.stageTargets[stage.key] || 0);
    const playerACompleted = duel.playerA.stageCompletedTick[stage.key] !== undefined;
    const playerBCompleted = duel.playerB.stageCompletedTick[stage.key] !== undefined;
    if ((playerACompleted || playerBCompleted) && (progressA >= target || progressB >= target)) {
      finalizeStageRound(duel, stage.key, tick, overflowA, overflowB);
    }
  }
}

function resolveWinner(duel: EngineActiveDuel, tick: number, overflowA: number, overflowB: number) {
  const playerAFinished = isParticipantFinished(duel.playerA) && hasCompletedAllStages(duel, duel.playerA);
  const playerBFinished = isParticipantFinished(duel.playerB) && hasCompletedAllStages(duel, duel.playerB);
  if (!playerAFinished && !playerBFinished) return;

  duel.finishedAtMs = duel.startedAtMs + tick * PVP_DUEL_CONFIG.process.tickIntervalMs;

  if (playerAFinished && !playerBFinished) {
    duel.winnerUserId = duel.playerA.userId;
    return;
  }
  if (playerBFinished && !playerAFinished) {
    duel.winnerUserId = duel.playerB.userId;
    return;
  }
  if (overflowA !== overflowB) {
    duel.winnerUserId = overflowA > overflowB ? duel.playerA.userId : duel.playerB.userId;
    return;
  }

  duel.winnerUserId = null;
}

function recalculateDuelAfterBoosts(duel: EngineActiveDuel) {
  duel.playerA.negativeImmunity = duel.playerA.boostIds.includes("qa_outsource");
  duel.playerB.negativeImmunity = duel.playerB.boostIds.includes("qa_outsource");
  duel.energyCostA = getEnergyCostForParticipant(duel.playerA);
  duel.energyCostB = getEnergyCostForParticipant(duel.playerB);
}

export function applyDuelBoost(duel: EngineActiveDuel, userId: string, boostId: PvpBoostId) {
  const participant = duel.playerA.userId === userId ? duel.playerA : duel.playerB.userId === userId ? duel.playerB : null;
  if (!participant) throw new Error("Участник дуэли не найден");
  if (participant.boostIds.includes(boostId)) {
    throw new Error("Этот boost уже куплен для текущей дуэли");
  }
  participant.boostIds.push(boostId);
  recalculateDuelAfterBoosts(duel);
  duel.latestLog = `${participant.username} активировал boost ${boostId}`;
}

export function startPreparedDuel(duel: EngineActiveDuel, nowMs: number = Date.now()) {
  if (duel.finishedAtMs || nowMs >= duel.startedAtMs) return duel;
  duel.startedAtMs = nowMs;
  duel.updatedAtMs = nowMs;
  duel.expectedEndAtMs = nowMs + (PVP_DUEL_CONFIG.process.expectedDurationTicks.max * PVP_DUEL_CONFIG.process.tickIntervalMs);
  duel.latestLog = "Подготовка завершена. Команды вошли в dev race.";
  return duel;
}

export function startDuel(playerASeed: DuelParticipantSeed, playerBSeed: DuelParticipantSeed, nowMs: number = Date.now()): EngineActiveDuel {
  const duelId = randomUUID();
  const seed = hashSeed(`${duelId}:${playerASeed.userId}:${playerBSeed.userId}:${nowMs}`);
  const playerA = createParticipant(playerASeed);
  const playerB = createParticipant(playerBSeed);
  const maxPower = Math.max(playerA.totalPower, playerB.totalPower, 1);
  const powerDiff = Math.abs(playerA.totalPower - playerB.totalPower) / maxPower;
  const startedAtMs = nowMs + PVP_DUEL_CONFIG.process.preparationWindowMs;
  const duel: EngineActiveDuel = {
    duelId,
    createdAtMs: nowMs,
    startedAtMs,
    preparationEndsAtMs: startedAtMs,
    updatedAtMs: nowMs,
    lastProcessedTick: 0,
    expectedEndAtMs: startedAtMs + (PVP_DUEL_CONFIG.process.expectedDurationTicks.max * PVP_DUEL_CONFIG.process.tickIntervalMs),
    seed,
    closeMatch: powerDiff <= PVP_DUEL_CONFIG.process.closeMatchThreshold,
    stageTargets: { concept: 0, core: 0, tests: 0 },
    rounds: [],
    recentEvents: [],
    latestLog: "Преддуэльный бриф открыт. Можно докупить boosts перед стартом.",
    playerA,
    playerB,
    winnerUserId: null,
    finishedAtMs: null,
    energyCostA: getEnergyCostForParticipant(playerA),
    energyCostB: getEnergyCostForParticipant(playerB),
  };

  for (const stage of PVP_DUEL_CONFIG.process.stages) {
    duel.stageTargets[stage.key] = calculateStageTarget(duel, stage.key);
  }

  return duel;
}

export function processDuelTicks(duel: EngineActiveDuel, nowMs: number = Date.now()) {
  if (duel.finishedAtMs) return duel;
  if (duelProcessingLocks.has(duel.duelId)) return duel;
  duelProcessingLocks.add(duel.duelId);
  try {
  if (isAwaitingStart(duel, nowMs)) {
    duel.updatedAtMs = nowMs;
    return duel;
  }
  if (duel.startedAtMs > duel.preparationEndsAtMs) {
    duel.preparationEndsAtMs = duel.startedAtMs;
  }

  const targetTick = Math.max(0, Math.floor((nowMs - duel.startedAtMs) / PVP_DUEL_CONFIG.process.tickIntervalMs));
  while (duel.lastProcessedTick < targetTick) {
    const tick = duel.lastProcessedTick + 1;
    const stageBeforeA = getCurrentStageKey(duel.playerA);
    const stageBeforeB = getCurrentStageKey(duel.playerB);
    const aState = applyParticipantTick(duel, duel.playerA, duel.playerB, tick);
    const bState = applyParticipantTick(duel, duel.playerB, duel.playerA, tick);

    pushEvent(duel, aState.eventLog);
    pushEvent(duel, bState.eventLog);

    if (stageBeforeA && duel.playerA.stageCompletedTick[stageBeforeA] === tick) {
      finalizeStageRound(duel, stageBeforeA, tick, aState.overflow, bState.overflow);
      duel.latestLog = `${duel.playerA.username} завершил этап ${formatStageLabel(stageBeforeA)}`;
    }
    if (stageBeforeB && stageBeforeB !== stageBeforeA && duel.playerB.stageCompletedTick[stageBeforeB] === tick) {
      finalizeStageRound(duel, stageBeforeB, tick, aState.overflow, bState.overflow);
      duel.latestLog = `${duel.playerB.username} завершил этап ${formatStageLabel(stageBeforeB)}`;
    }

    ensureCompletedStageRounds(duel, tick, aState.overflow, bState.overflow);
    resolveWinner(duel, tick, aState.overflow, bState.overflow);
    duel.lastProcessedTick = tick;
    duel.updatedAtMs = duel.startedAtMs + tick * PVP_DUEL_CONFIG.process.tickIntervalMs;
    logTickState(duel, tick);
    if (duel.finishedAtMs) break;
  }

  if (!duel.finishedAtMs) {
    duel.expectedEndAtMs = duel.updatedAtMs + (PVP_DUEL_CONFIG.process.expectedDurationTicks.max - Math.min(duel.lastProcessedTick, PVP_DUEL_CONFIG.process.expectedDurationTicks.max)) * PVP_DUEL_CONFIG.process.tickIntervalMs;
  }
  return duel;
  } finally {
    duelProcessingLocks.delete(duel.duelId);
  }
}

export function generateBalancedPvpBot(player: DuelParticipantSeed, botUserId: string, username: string): DuelParticipantSeed {
  const rng = createSeededRandom(hashSeed(`${player.userId}:${player.rating}:${player.username}:bot`));
  const scale = (value: number) => Number((Math.max(0.5, value) * (0.95 + rng() * 0.1)).toFixed(2));
  let botSkills: DuelSkills = {
    analytics: scale(player.skills.analytics),
    coding: scale(player.skills.coding),
    testing: scale(player.skills.testing),
    attention: scale(player.skills.attention),
    design: scale(player.skills.design),
    drawing: scale(player.skills.drawing),
    modeling: scale(player.skills.modeling),
  };
  const playerPower = Math.max(1, computeTotalDuelPower(player.skills));
  const botPower = Math.max(1, computeTotalDuelPower(botSkills));
  const minAllowedPower = playerPower * 0.95;
  const maxAllowedPower = playerPower * 1.05;
  if (botPower < minAllowedPower || botPower > maxAllowedPower) {
    const correction = clamp(
      (botPower < minAllowedPower ? minAllowedPower : maxAllowedPower) / Math.max(1, botPower),
      0.9,
      1.1,
    );
    botSkills = {
      analytics: Number((botSkills.analytics * correction).toFixed(2)),
      coding: Number((botSkills.coding * correction).toFixed(2)),
      testing: Number((botSkills.testing * correction).toFixed(2)),
      attention: Number((botSkills.attention * correction).toFixed(2)),
      design: Number((botSkills.design * correction).toFixed(2)),
      drawing: Number((botSkills.drawing * correction).toFixed(2)),
      modeling: Number((botSkills.modeling * correction).toFixed(2)),
    };
  }

  return {
    userId: botUserId,
    username,
    rating: Math.max(900, Math.round(player.rating * (0.98 + rng() * 0.04))),
    skills: botSkills,
    boosts: { selectedBoosts: [] },
    isBot: true,
  };
}

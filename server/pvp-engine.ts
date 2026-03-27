import { randomUUID } from "crypto";
import {
  getProfessionPvpRoundMultiplier,
  getProfessionPvpSkillMultiplier,
  type ProfessionId,
} from "../shared/professions";
import {
  PVP_DUEL_CONFIG,
  getPvpBoostDefinition,
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

export type DuelGadgetProfile = {
  id: string;
  name: string;
  stats: Partial<DuelSkills>;
  powerScore: number;
};

export type DuelParticipantSeed = {
  userId: string;
  username: string;
  rating: number;
  skills: DuelSkills;
  professionId?: ProfessionId | null;
  boosts?: DuelBoostState;
  gadget?: DuelGadgetProfile | null;
  pvpPowerScore?: number;
  isBot?: boolean;
};

type ParticipantRuntime = {
  userId: string;
  username: string;
  ratingBefore: number;
  skills: DuelSkills;
  professionId: ProfessionId | null;
  totalPower: number;
  pvpPowerScore: number;
  stageProgress: Record<DuelProjectStageKey, number>;
  stageCompletedTick: Partial<Record<DuelProjectStageKey, number>>;
  currentStageIndex: number;
  latestTickGain: number;
  boostIds: PvpBoostId[];
  gadget: DuelGadgetProfile | null;
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

type RoundComputation = {
  stageKey: DuelProjectStageKey;
  targetScore: number;
  scoreA: number;
  scoreB: number;
  baseSkillsA: number;
  baseSkillsB: number;
  gadgetBonusA: number;
  gadgetBonusB: number;
  itemBonusA: number;
  itemBonusB: number;
  professionBonusA: number;
  professionBonusB: number;
  randomFactorA: number;
  randomFactorB: number;
  explanationA: string;
  explanationB: string;
};

const duelProcessingLocks = new Set<string>();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number) {
  return Number(value.toFixed(2));
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

function getCurrentStageKey(participant: ParticipantRuntime): DuelProjectStageKey | null {
  return PVP_DUEL_CONFIG.process.stages[participant.currentStageIndex]?.key ?? null;
}

function getRoundLabel(stageKey: DuelProjectStageKey) {
  return PVP_DUEL_CONFIG.process.stages.find((stage) => stage.key === stageKey)?.label ?? stageKey;
}

function getRoundSkillKeys(stageKey: DuelProjectStageKey): Array<keyof DuelSkills> {
  if (stageKey === "concept") return ["design", "analytics"];
  if (stageKey === "core") return ["coding"];
  return ["testing", "attention"];
}

function getBaseRoundSkills(skills: DuelSkills, stageKey: DuelProjectStageKey) {
  if (stageKey === "concept") {
    return Number(skills.design || 0) + Number(skills.analytics || 0);
  }
  if (stageKey === "core") {
    return Number(skills.coding || 0);
  }
  return Number(skills.testing || 0) + Number(skills.attention || 0);
}

function getWeightedProfessionSkillBonus(
  professionId: ProfessionId | null,
  skills: DuelSkills,
  stageKey: DuelProjectStageKey,
) {
  const keys = getRoundSkillKeys(stageKey);
  return round2(keys.reduce((sum, skillKey) => {
    const skillValue = Number(skills[skillKey] || 0);
    const multiplier = getProfessionPvpSkillMultiplier(professionId, skillKey);
    return sum + Math.max(0, skillValue * (multiplier - 1));
  }, 0));
}

function getProfessionRoundBonus(
  professionId: ProfessionId | null,
  baseSkills: number,
  stageKey: DuelProjectStageKey,
) {
  const roundMultiplier = getProfessionPvpRoundMultiplier(professionId, stageKey);
  return round2(Math.max(0, baseSkills * (roundMultiplier - 1)));
}

function getGadgetRoundBonus(gadget: DuelGadgetProfile | null, stageKey: DuelProjectStageKey) {
  if (!gadget) return 0;
  const stats = gadget.stats || {};
  let weighted = 0;
  if (stageKey === "concept") {
    weighted = Number(stats.design || 0) + Number(stats.analytics || 0) * 0.9 + Number(stats.attention || 0) * 0.3;
  } else if (stageKey === "core") {
    weighted = Number(stats.coding || 0) + Number(stats.analytics || 0) * 0.2 + Number(stats.modeling || 0) * 0.25;
  } else {
    weighted = Number(stats.testing || 0) + Number(stats.attention || 0) * 0.9 + Number(stats.coding || 0) * 0.15;
  }
  const universal = Number(gadget.powerScore || 0) * PVP_DUEL_CONFIG.scoring.gadgetUniversalMultiplier;
  return round2(weighted * PVP_DUEL_CONFIG.scoring.gadgetImpactMultiplier + universal);
}

function getItemRoundMultiplier(
  boostId: PvpBoostId | undefined,
  stageKey: DuelProjectStageKey,
  participant: ParticipantRuntime,
) {
  if (!boostId) return 1;
  if (boostId === "energy_drink") return 1.05;
  if (boostId === "focus_sprint") return stageKey === "core" ? 1.1 : 1;
  if (boostId === "debug_tool") return stageKey === "tests" ? 1.1 : 1;
  if (boostId === "risk_module") {
    if (stageKey === "core") return 1.15;
    if (stageKey === "concept") return 0.9;
    return 1;
  }
  if (boostId === "tactical_boost") {
    const values = {
      concept: getBaseRoundSkills(participant.skills, "concept"),
      core: getBaseRoundSkills(participant.skills, "core"),
      tests: getBaseRoundSkills(participant.skills, "tests"),
    } as const;
    const weakest = (Object.entries(values).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "concept") as DuelProjectStageKey;
    return stageKey === weakest ? 1.12 : 1;
  }
  return 1;
}

function getItemRoundBonus(
  boostId: PvpBoostId | undefined,
  stageKey: DuelProjectStageKey,
  subtotal: number,
  participant: ParticipantRuntime,
) {
  const multiplier = getItemRoundMultiplier(boostId, stageKey, participant);
  return round2(Math.max(0, subtotal * (multiplier - 1)));
}

function getRandomFactor(
  duel: EngineActiveDuel,
  participant: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
) {
  const rng = rngFor(duel, `${participant.userId}:${stageKey}:random`);
  const randomMultiplier =
    PVP_DUEL_CONFIG.scoring.randomMinMultiplier
    + rng() * (PVP_DUEL_CONFIG.scoring.randomMaxMultiplier - PVP_DUEL_CONFIG.scoring.randomMinMultiplier);
  return round2(randomMultiplier);
}

function computeTotalDuelPower(skills: DuelSkills, gadget?: DuelGadgetProfile | null, levelWeight = 0) {
  const base =
    Number(skills.analytics || 0)
    + Number(skills.design || 0)
    + Number(skills.coding || 0)
    + Number(skills.testing || 0)
    + Number(skills.attention || 0)
    + Number(skills.modeling || 0) * 0.4
    + Number(skills.drawing || 0) * 0.35;
  const gadgetPower = Number(gadget?.powerScore || 0) * 0.65;
  return round2(base + gadgetPower + levelWeight);
}

function createParticipant(seed: DuelParticipantSeed): ParticipantRuntime {
  const boostIds = Array.from(new Set(seed.boosts?.selectedBoosts ?? [])).slice(0, 1);
  return {
    userId: seed.userId,
    username: seed.username,
    ratingBefore: seed.rating,
    skills: { ...seed.skills },
    professionId: seed.professionId ?? null,
    totalPower: computeTotalDuelPower(seed.skills, seed.gadget, 0),
    pvpPowerScore: Number(seed.pvpPowerScore || 0),
    stageProgress: { concept: 0, core: 0, tests: 0 },
    stageCompletedTick: {},
    currentStageIndex: 0,
    latestTickGain: 0,
    boostIds,
    gadget: seed.gadget ?? null,
  };
}

function getEnergyCostForParticipant() {
  return Number(PVP_DUEL_CONFIG.process.baseEnergyCost.toFixed(4));
}

function buildExplanation(
  stageKey: DuelProjectStageKey,
  gadgetBonus: number,
  itemBonus: number,
  professionBonus: number,
  randomMultiplier: number,
  gadgetName?: string | null,
  boostId?: PvpBoostId,
) {
  const parts: string[] = [];
  if (gadgetBonus > 0.01) {
    parts.push(`гаджет ${gadgetName || "усилил раунд"} (+${gadgetBonus.toFixed(1)})`);
  }
  if (itemBonus > 0.01) {
    const itemName = getPvpBoostDefinition(boostId)?.name || "PvP-предмет";
    parts.push(`${itemName} дал бонус (+${itemBonus.toFixed(1)})`);
  }
  if (professionBonus > 0.01) {
    parts.push(`специализация помогла (+${professionBonus.toFixed(1)})`);
  }
  const randomPct = Math.round((randomMultiplier - 1) * 100);
  if (randomPct > 0) {
    parts.push(`удачный темп (+${randomPct}%)`);
  } else if (randomPct < 0) {
    parts.push(`темп просел (${randomPct}%)`);
  }
  if (!parts.length) {
    return `${getRoundLabel(stageKey)} прошёл без заметных модификаторов.`;
  }
  return parts.join(", ");
}

function computeRound(
  duel: EngineActiveDuel,
  stageKey: DuelProjectStageKey,
): RoundComputation {
  const baseSkillsA = round2(getBaseRoundSkills(duel.playerA.skills, stageKey));
  const baseSkillsB = round2(getBaseRoundSkills(duel.playerB.skills, stageKey));
  const gadgetBonusA = getGadgetRoundBonus(duel.playerA.gadget, stageKey);
  const gadgetBonusB = getGadgetRoundBonus(duel.playerB.gadget, stageKey);
  const professionBonusA = round2(
    getWeightedProfessionSkillBonus(duel.playerA.professionId, duel.playerA.skills, stageKey)
    + getProfessionRoundBonus(duel.playerA.professionId, baseSkillsA, stageKey),
  );
  const professionBonusB = round2(
    getWeightedProfessionSkillBonus(duel.playerB.professionId, duel.playerB.skills, stageKey)
    + getProfessionRoundBonus(duel.playerB.professionId, baseSkillsB, stageKey),
  );
  const subtotalA = round2(baseSkillsA + gadgetBonusA + professionBonusA);
  const subtotalB = round2(baseSkillsB + gadgetBonusB + professionBonusB);
  const itemBonusA = getItemRoundBonus(duel.playerA.boostIds[0], stageKey, subtotalA, duel.playerA);
  const itemBonusB = getItemRoundBonus(duel.playerB.boostIds[0], stageKey, subtotalB, duel.playerB);
  const randomFactorA = getRandomFactor(duel, duel.playerA, stageKey);
  const randomFactorB = getRandomFactor(duel, duel.playerB, stageKey);
  const scoreA = round2((subtotalA + itemBonusA) * randomFactorA);
  const scoreB = round2((subtotalB + itemBonusB) * randomFactorB);
  const targetScore = round2(Math.max(1, scoreA, scoreB));
  return {
    stageKey,
    targetScore,
    scoreA,
    scoreB,
    baseSkillsA,
    baseSkillsB,
    gadgetBonusA,
    gadgetBonusB,
    itemBonusA,
    itemBonusB,
    professionBonusA,
    professionBonusB,
    randomFactorA,
    randomFactorB,
    explanationA: buildExplanation(
      stageKey,
      gadgetBonusA,
      itemBonusA,
      professionBonusA,
      randomFactorA,
      duel.playerA.gadget?.name,
      duel.playerA.boostIds[0],
    ),
    explanationB: buildExplanation(
      stageKey,
      gadgetBonusB,
      itemBonusB,
      professionBonusB,
      randomFactorB,
      duel.playerB.gadget?.name,
      duel.playerB.boostIds[0],
    ),
  };
}

function computeRounds(duel: EngineActiveDuel): DuelRoundResult[] {
  return PVP_DUEL_CONFIG.process.stages.map((stage) => {
    const computed = computeRound(duel, stage.key);
    const winnerUserId =
      computed.scoreA === computed.scoreB
        ? null
        : computed.scoreA > computed.scoreB
          ? duel.playerA.userId
          : duel.playerB.userId;
    return {
      round: stage.key,
      playerAUserId: duel.playerA.userId,
      playerBUserId: duel.playerB.userId,
      scoreA: computed.scoreA,
      scoreB: computed.scoreB,
      winnerUserId,
      targetScore: computed.targetScore,
      baseSkillsA: computed.baseSkillsA,
      baseSkillsB: computed.baseSkillsB,
      gadgetBonusA: computed.gadgetBonusA,
      gadgetBonusB: computed.gadgetBonusB,
      itemBonusA: computed.itemBonusA,
      itemBonusB: computed.itemBonusB,
      professionBonusA: computed.professionBonusA,
      professionBonusB: computed.professionBonusB,
      randomFactorA: computed.randomFactorA,
      randomFactorB: computed.randomFactorB,
      explanationA: computed.explanationA,
      explanationB: computed.explanationB,
    };
  });
}

function resolveWinner(duel: EngineActiveDuel) {
  const winsA = duel.rounds.filter((round) => round.winnerUserId === duel.playerA.userId).length;
  const winsB = duel.rounds.filter((round) => round.winnerUserId === duel.playerB.userId).length;
  if (winsA > winsB) return duel.playerA.userId;
  if (winsB > winsA) return duel.playerB.userId;
  const totalA = duel.rounds.reduce((sum, round) => sum + Number(round.scoreA || 0), 0);
  const totalB = duel.rounds.reduce((sum, round) => sum + Number(round.scoreB || 0), 0);
  if (totalA > totalB) return duel.playerA.userId;
  if (totalB > totalA) return duel.playerB.userId;
  return null;
}

function buildRoundEvent(
  duel: EngineActiveDuel,
  round: DuelRoundResult,
  stageKey: DuelProjectStageKey,
  tick: number,
) {
  const isPlayerAWinner = round.winnerUserId === duel.playerA.userId;
  const isDraw = round.winnerUserId === null;
  const actor = isDraw ? duel.playerA : isPlayerAWinner ? duel.playerA : duel.playerB;
  const kind: PvpBattleEventLog["kind"] = isDraw ? "negative" : "positive";
  const title = isDraw
    ? `${getRoundLabel(stageKey)}: ничья`
    : `${getRoundLabel(stageKey)}: ${actor.username} забирает раунд`;
  const details =
    isDraw
      ? `${duel.playerA.username} ${round.scoreA.toFixed(1)} vs ${duel.playerB.username} ${round.scoreB.toFixed(1)}`
      : `${duel.playerA.username} ${round.scoreA.toFixed(1)} vs ${duel.playerB.username} ${round.scoreB.toFixed(1)}`;
  return {
    tick,
    actorUserId: actor.userId,
    actorName: actor.username,
    stageKey,
    kind,
    title,
    details,
    effectType: "instant_progress" as const,
    progressDelta: round2(Math.abs(round.scoreA - round.scoreB)),
  };
}

function getPreparationLog(duel: EngineActiveDuel) {
  return `Матч найден. Можно выбрать 1 PvP-предмет перед стартом. Активный гаджет: ${duel.playerA.gadget?.name || "нет"} vs ${duel.playerB.gadget?.name || "нет"}.`;
}

export function applyDuelBoost(duel: EngineActiveDuel, userId: string, boostId: PvpBoostId) {
  const participant = duel.playerA.userId === userId ? duel.playerA : duel.playerB.userId === userId ? duel.playerB : null;
  if (!participant) throw new Error("Участник дуэли не найден");
  if (participant.boostIds.includes(boostId)) {
    throw new Error("Этот PvP-предмет уже выбран для текущей дуэли");
  }
  if (participant.boostIds.length >= 1) {
    throw new Error("На бой можно взять только 1 PvP-предмет");
  }
  participant.boostIds.push(boostId);
  duel.rounds = computeRounds(duel);
  for (const stage of PVP_DUEL_CONFIG.process.stages) {
    const round = duel.rounds.find((item) => item.round === stage.key);
    duel.stageTargets[stage.key] = round ? round.targetScore : 1;
  }
  duel.latestLog = `${participant.username} выбрал предмет ${getPvpBoostDefinition(boostId)?.name || boostId}`;
}

export function startPreparedDuel(duel: EngineActiveDuel, nowMs: number = Date.now()) {
  if (duel.finishedAtMs || nowMs >= duel.startedAtMs) return duel;
  duel.startedAtMs = nowMs;
  duel.updatedAtMs = nowMs;
  duel.expectedEndAtMs = nowMs + (PVP_DUEL_CONFIG.process.expectedDurationTicks.max * PVP_DUEL_CONFIG.process.tickIntervalMs);
  duel.latestLog = "Дуэль началась. Раунды будут открываться по очереди.";
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
    stageTargets: { concept: 1, core: 1, tests: 1 },
    rounds: [],
    recentEvents: [],
    latestLog: "",
    playerA,
    playerB,
    winnerUserId: null,
    finishedAtMs: null,
    energyCostA: getEnergyCostForParticipant(),
    energyCostB: getEnergyCostForParticipant(),
  };

  duel.rounds = computeRounds(duel);
  for (const stage of PVP_DUEL_CONFIG.process.stages) {
    const round = duel.rounds.find((item) => item.round === stage.key);
    duel.stageTargets[stage.key] = round ? round.targetScore : 1;
  }
  duel.latestLog = getPreparationLog(duel);
  return duel;
}

export function processDuelTicks(duel: EngineActiveDuel, nowMs: number = Date.now()) {
  if (duel.finishedAtMs) return duel;
  if (duelProcessingLocks.has(duel.duelId)) return duel;
  duelProcessingLocks.add(duel.duelId);
  try {
    if (nowMs < duel.startedAtMs) {
      duel.updatedAtMs = nowMs;
      return duel;
    }

    const targetTick = Math.max(0, Math.floor((nowMs - duel.startedAtMs) / PVP_DUEL_CONFIG.process.tickIntervalMs) + 1);
    while (duel.lastProcessedTick < targetTick) {
      const tick = duel.lastProcessedTick + 1;
      const round = duel.rounds[tick - 1];
      if (!round) {
        duel.finishedAtMs = duel.startedAtMs + (duel.rounds.length * PVP_DUEL_CONFIG.process.tickIntervalMs);
        duel.winnerUserId = resolveWinner(duel);
        break;
      }

      const stageKey = round.round;
      duel.playerA.stageProgress[stageKey] = round.scoreA;
      duel.playerB.stageProgress[stageKey] = round.scoreB;
      duel.playerA.stageCompletedTick[stageKey] = tick;
      duel.playerB.stageCompletedTick[stageKey] = tick;
      duel.playerA.latestTickGain = round.scoreA;
      duel.playerB.latestTickGain = round.scoreB;
      duel.playerA.currentStageIndex = Math.min(PVP_DUEL_CONFIG.process.stages.length - 1, tick);
      duel.playerB.currentStageIndex = Math.min(PVP_DUEL_CONFIG.process.stages.length - 1, tick);
      const event = buildRoundEvent(duel, round, stageKey, tick);
      duel.recentEvents.push(event);
      if (duel.recentEvents.length > 6) {
        duel.recentEvents.splice(0, duel.recentEvents.length - 6);
      }
      duel.latestLog = `${getRoundLabel(stageKey)}: ${event.details}`;
      duel.lastProcessedTick = tick;
      duel.updatedAtMs = duel.startedAtMs + tick * PVP_DUEL_CONFIG.process.tickIntervalMs;
    }

    if (!duel.finishedAtMs && duel.lastProcessedTick >= duel.rounds.length) {
      duel.finishedAtMs = duel.startedAtMs + (duel.rounds.length * PVP_DUEL_CONFIG.process.tickIntervalMs);
      duel.updatedAtMs = duel.finishedAtMs;
      duel.winnerUserId = resolveWinner(duel);
    }

    if (!duel.finishedAtMs) {
      duel.expectedEndAtMs = duel.startedAtMs + (duel.rounds.length * PVP_DUEL_CONFIG.process.tickIntervalMs);
    }
    return duel;
  } finally {
    duelProcessingLocks.delete(duel.duelId);
  }
}

export function generateBalancedPvpBot(player: DuelParticipantSeed, botUserId: string, username: string): DuelParticipantSeed {
  const rng = createSeededRandom(hashSeed(`${player.userId}:${player.rating}:${player.username}:bot`));
  const scale = (value: number) => round2(Math.max(0.5, value) * (0.93 + rng() * 0.14));
  const botSkills: DuelSkills = {
    analytics: scale(player.skills.analytics),
    coding: scale(player.skills.coding),
    testing: scale(player.skills.testing),
    attention: scale(player.skills.attention),
    design: scale(player.skills.design),
    drawing: scale(player.skills.drawing),
    modeling: scale(player.skills.modeling),
  };
  return {
    userId: botUserId,
    username,
    rating: Math.max(900, Math.round(player.rating * (0.98 + rng() * 0.04))),
    skills: botSkills,
    boosts: { selectedBoosts: [] },
    gadget: null,
    pvpPowerScore: computeTotalDuelPower(botSkills, null, 0),
    isBot: true,
  };
}

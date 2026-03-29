import { randomUUID } from "crypto";
import {
  getProfessionPvpRoundMultiplier,
  getProfessionPvpSkillMultiplier,
  type ProfessionId,
} from "../shared/professions";
import {
  PVP_DUEL_CONFIG,
  getPvpBoostDefinition,
  getPvpTacticDefinition,
  type DuelProjectStageKey,
  type DuelRoundResult,
  type DuelTacticId,
  type PvpBattleEventLog,
  type PvpBoostId,
  type PvpEventEffectType,
  type PvpEventKind,
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
  requiredLevel?: number;
  quality?: number;
  wear?: number;
  pvpRoundBonus?: {
    round: DuelProjectStageKey;
    bonusPct: number;
  } | null;
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
  tacticsByStage?: Partial<Record<DuelProjectStageKey, DuelTacticId>>;
  isBot?: boolean;
};

type RoundEffectState = {
  freezeTicks: number;
  slowdownTicks: number;
  slowdownMultiplier: number;
  insightTicks: number;
  insightMultiplier: number;
  momentumTicks: number;
  momentumMultiplier: number;
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
  tacticsByStage: Partial<Record<DuelProjectStageKey, DuelTacticId>>;
  effects: RoundEffectState;
  lastRoundOutcome: "win" | "lose" | "draw" | null;
  isBot: boolean;
};

type RoundRuntime = {
  stageKey: DuelProjectStageKey;
  targetScore: number;
  tick: number;
  totalTicks: number;
  prepared: boolean;
  startsAtMs: number;
};

type TickComputation = {
  baseSkillPower: number;
  tacticAdjustedPower: number;
  professionBonus: number;
  gadgetBonus: number;
  itemBonus: number;
  comebackBonus: number;
  finalPreEventPower: number;
  tickPower: number;
  explanation: string;
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
  roundStates: Record<DuelProjectStageKey, RoundRuntime>;
  recentEvents: PvpBattleEventLog[];
  latestLog: string;
  playerA: ParticipantRuntime;
  playerB: ParticipantRuntime;
  winnerUserId: string | null;
  finishedAtMs: number | null;
  energyCostA: number;
  energyCostB: number;
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

function getRoundSkillKeys(stageKey: DuelProjectStageKey): [keyof DuelSkills, keyof DuelSkills] {
  if (stageKey === "concept") return ["analytics", "design"];
  if (stageKey === "core") return ["coding", "attention"];
  return ["testing", "analytics"];
}

function getBaseRoundSkills(skills: DuelSkills, stageKey: DuelProjectStageKey) {
  const [skill1, skill2] = getRoundSkillKeys(stageKey);
  return round2(Number(skills[skill1] || 0) + Number(skills[skill2] || 0));
}

function getTacticForStage(participant: ParticipantRuntime, stageKey: DuelProjectStageKey) {
  return participant.tacticsByStage[stageKey] ?? "stability";
}

function buildSkillModifierMap(stageKey: DuelProjectStageKey, tacticId: DuelTacticId, opponentTacticId: DuelTacticId) {
  const [skill1, skill2] = getRoundSkillKeys(stageKey);
  const ownBonuses: Record<string, number> = { [skill1]: 1, [skill2]: 1 };
  const opponentDebuffs: Record<string, number> = { [skill1]: 1, [skill2]: 1 };

  if (tacticId === "speed") ownBonuses[skill1] = 1.04;
  if (tacticId === "quality") ownBonuses[skill2] = 1.04;
  if (tacticId === "stability") {
    ownBonuses[skill1] = 1.02;
    ownBonuses[skill2] = 1.02;
  }

  if (opponentTacticId === "speed") opponentDebuffs[skill2] = 0.97;
  if (opponentTacticId === "quality") opponentDebuffs[skill1] = 0.97;
  if (opponentTacticId === "pressure") {
    const debuff = tacticId === "pressure" ? 0.985 : 0.975;
    opponentDebuffs[skill1] = debuff;
    opponentDebuffs[skill2] = debuff;
  }

  return { skill1, skill2, ownBonuses, opponentDebuffs };
}

function getTacticAdjustedPower(
  participant: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
  tacticId: DuelTacticId,
  opponentTacticId: DuelTacticId,
) {
  const { skill1, skill2, ownBonuses, opponentDebuffs } = buildSkillModifierMap(stageKey, tacticId, opponentTacticId);
  const base1 = Number(participant.skills[skill1] || 0);
  const base2 = Number(participant.skills[skill2] || 0);
  const debuffFloor = PVP_DUEL_CONFIG.scoring.tacticDebuffFloor;
  const modified1 = Math.max(base1 * debuffFloor, round2(base1 * ownBonuses[skill1] * opponentDebuffs[skill1]));
  const modified2 = Math.max(base2 * debuffFloor, round2(base2 * ownBonuses[skill2] * opponentDebuffs[skill2]));
  return {
    skill1,
    skill2,
    base1,
    base2,
    modified1,
    modified2,
    total: round2(modified1 + modified2),
  };
}

function getProfessionRoundBonus(
  participant: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
  tacticAdjustedPower: number,
  modified1: number,
  modified2: number,
  skill1: keyof DuelSkills,
  skill2: keyof DuelSkills,
) {
  const skillBonus =
    Math.max(0, modified1 * (getProfessionPvpSkillMultiplier(participant.professionId, skill1) - 1))
    + Math.max(0, modified2 * (getProfessionPvpSkillMultiplier(participant.professionId, skill2) - 1));
  const roundBonus =
    Math.max(0, tacticAdjustedPower * (getProfessionPvpRoundMultiplier(participant.professionId, stageKey) - 1));
  return round2(Math.min(tacticAdjustedPower * PVP_DUEL_CONFIG.scoring.maxProfessionBonusRatio, skillBonus + roundBonus));
}

function getGadgetRoundBonus(participant: ParticipantRuntime, stageKey: DuelProjectStageKey, baseSkillPower: number) {
  const gadget = participant.gadget;
  if (!gadget) return 0;
  const [skill1, skill2] = getRoundSkillKeys(stageKey);
  const relevant = Number(gadget.stats?.[skill1] || 0) + Number(gadget.stats?.[skill2] || 0);
  const roundSpecificBonus = gadget.pvpRoundBonus?.round === stageKey
    ? baseSkillPower * Math.max(0, Number(gadget.pvpRoundBonus?.bonusPct || 0))
    : 0;
  const bonus =
    relevant * PVP_DUEL_CONFIG.scoring.gadgetRelevantMultiplier
    + Number(gadget.powerScore || 0) * PVP_DUEL_CONFIG.scoring.gadgetPowerMultiplier
    + roundSpecificBonus;
  return round2(Math.min(baseSkillPower * PVP_DUEL_CONFIG.scoring.maxGadgetBonusRatio, Math.max(0, bonus)));
}

function getItemRoundBonus(participant: ParticipantRuntime, stageKey: DuelProjectStageKey, subtotal: number) {
  const boostId = participant.boostIds[0];
  if (!boostId) return 0;
  const boost = getPvpBoostDefinition(boostId);
  if (!boost) return 0;

  let multiplier = 0;
  if (boost.weakestRoundBonus) {
    const values: Record<DuelProjectStageKey, number> = {
      concept: getBaseRoundSkills(participant.skills, "concept"),
      core: getBaseRoundSkills(participant.skills, "core"),
      tests: getBaseRoundSkills(participant.skills, "tests"),
    };
    const weakest = (Object.entries(values).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "concept") as DuelProjectStageKey;
    multiplier = weakest === stageKey ? boost.weakestRoundBonus : 0;
  } else {
    multiplier = Math.max(0, Number(boost.roundMultipliers?.[stageKey] || 1) - 1);
  }
  multiplier += Number(boost.tradeoffPenalty?.[stageKey] || 1) - 1;
  return round2(Math.max(0, subtotal * multiplier));
}

function getComebackBonus(participant: ParticipantRuntime, basePower: number) {
  if (participant.lastRoundOutcome !== "lose") return 0;
  return round2(basePower * PVP_DUEL_CONFIG.scoring.comebackMultiplier);
}

function applyPreEventCap(baseSkillPower: number, adjustedPower: number) {
  return round2(Math.min(baseSkillPower * (1 + PVP_DUEL_CONFIG.scoring.maxPreEventBonusRatio), adjustedPower));
}

function getEventReductionMultiplier(tacticId: DuelTacticId) {
  return tacticId === "stability" ? 1 - PVP_DUEL_CONFIG.events.stabilityNegativeReduction : 1;
}

function createRoundEffectState(): RoundEffectState {
  return {
    freezeTicks: 0,
    slowdownTicks: 0,
    slowdownMultiplier: 1,
    insightTicks: 0,
    insightMultiplier: 0,
    momentumTicks: 0,
    momentumMultiplier: 0,
  };
}

function computeTickPower(
  participant: ParticipantRuntime,
  opponent: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
): TickComputation {
  const tacticId = getTacticForStage(participant, stageKey);
  const opponentTacticId = getTacticForStage(opponent, stageKey);
  const adjusted = getTacticAdjustedPower(participant, stageKey, tacticId, opponentTacticId);
  const baseSkillPower = round2(adjusted.base1 + adjusted.base2);
  const professionBonus = getProfessionRoundBonus(
    participant,
    stageKey,
    adjusted.total,
    adjusted.modified1,
    adjusted.modified2,
    adjusted.skill1,
    adjusted.skill2,
  );
  const gadgetBonus = getGadgetRoundBonus(participant, stageKey, baseSkillPower);
  const subtotal = round2(adjusted.total + professionBonus + gadgetBonus);
  const itemBonus = round2(Math.min(baseSkillPower * 0.08, getItemRoundBonus(participant, stageKey, subtotal)));
  const comebackBonus = getComebackBonus(participant, baseSkillPower);
  const preEvent = applyPreEventCap(baseSkillPower, adjusted.total + professionBonus + gadgetBonus + itemBonus);

  let tickPower = preEvent + comebackBonus;
  if (participant.effects.insightTicks > 0) {
    tickPower *= 1 + participant.effects.insightMultiplier;
  }
  if (participant.effects.momentumTicks > 0) {
    tickPower *= 1 + participant.effects.momentumMultiplier;
  }

  return {
    baseSkillPower,
    tacticAdjustedPower: adjusted.total,
    professionBonus,
    gadgetBonus,
    itemBonus,
    comebackBonus,
    finalPreEventPower: preEvent,
    tickPower: round2(Math.max(1, tickPower)),
    explanation: [
      `Тактика: ${getPvpTacticDefinition(tacticId)?.name || tacticId}`,
      professionBonus > 0 ? `профессия +${professionBonus.toFixed(2)}` : "",
      gadgetBonus > 0 ? `гаджет +${gadgetBonus.toFixed(2)}` : "",
      itemBonus > 0 ? `предмет +${itemBonus.toFixed(2)}` : "",
      comebackBonus > 0 ? `камбэк +${comebackBonus.toFixed(2)}` : "",
    ].filter(Boolean).join(", "),
  };
}

function decrementEffectTimers(participant: ParticipantRuntime) {
  if (participant.effects.freezeTicks > 0) participant.effects.freezeTicks -= 1;
  if (participant.effects.slowdownTicks > 0) {
    participant.effects.slowdownTicks -= 1;
    if (participant.effects.slowdownTicks <= 0) {
      participant.effects.slowdownMultiplier = 1;
    }
  }
  if (participant.effects.insightTicks > 0) {
    participant.effects.insightTicks -= 1;
    if (participant.effects.insightTicks <= 0) {
      participant.effects.insightMultiplier = 0;
    }
  }
  if (participant.effects.momentumTicks > 0) {
    participant.effects.momentumTicks -= 1;
    if (participant.effects.momentumTicks <= 0) {
      participant.effects.momentumMultiplier = 0;
    }
  }
}

function buildEventLog(
  tick: number,
  participant: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
  kind: PvpEventKind,
  effectType: PvpEventEffectType,
  title: string,
  details: string,
  progressDelta: number,
): PvpBattleEventLog {
  return {
    tick,
    actorUserId: participant.userId,
    actorName: participant.username,
    stageKey,
    kind,
    title,
    details,
    effectType,
    progressDelta: round2(progressDelta),
  };
}

function applyEventForParticipant(
  duel: EngineActiveDuel,
  participant: ParticipantRuntime,
  opponent: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
  tick: number,
  baseTickPower: number,
): PvpBattleEventLog | null {
  const rng = rngFor(duel, `${stageKey}:${participant.userId}:event:${tick}`);
  const roll = rng();
  const reduction = getEventReductionMultiplier(getTacticForStage(participant, stageKey));
  const target = duel.stageTargets[stageKey];

  if (roll < 0.16) {
    const delta = round2(baseTickPower * PVP_DUEL_CONFIG.events.positiveBurstProgress);
    participant.stageProgress[stageKey] = round2(participant.stageProgress[stageKey] + delta);
    return buildEventLog(tick, participant, stageKey, "positive", "burst_progress", "Burst", "Моментальный рывок прогресса.", delta);
  }
  if (roll < 0.32) {
    participant.effects.insightTicks = PVP_DUEL_CONFIG.events.positiveInsightTicks;
    participant.effects.insightMultiplier = PVP_DUEL_CONFIG.events.positiveInsightMultiplier;
    return buildEventLog(tick, participant, stageKey, "positive", "insight", "Insight", "Следующие 2 тика идут чуть сильнее.", 0);
  }
  if (roll < 0.48) {
    participant.effects.momentumTicks = 1;
    participant.effects.momentumMultiplier = PVP_DUEL_CONFIG.events.positiveMomentumMultiplier;
    return buildEventLog(tick, participant, stageKey, "positive", "momentum", "Momentum", "Следующий тик получает ускорение.", 0);
  }
  if (roll < 0.64) {
    participant.effects.freezeTicks = Math.max(1, Math.round(PVP_DUEL_CONFIG.events.negativeFreezeTicks * reduction));
    return buildEventLog(tick, participant, stageKey, "negative", "freeze", "Freeze", "Текущий тик застыл.", 0);
  }
  if (roll < 0.8) {
    participant.effects.slowdownTicks = Math.max(1, Math.round(PVP_DUEL_CONFIG.events.negativeSlowdownTicks * reduction));
    participant.effects.slowdownMultiplier = 1 - (1 - PVP_DUEL_CONFIG.events.negativeSlowdownMultiplier) * reduction;
    return buildEventLog(tick, participant, stageKey, "negative", "slowdown", "Slowdown", "Темп просел на пару тиков.", 0);
  }

  const rawLoss = participant.stageProgress[stageKey] * PVP_DUEL_CONFIG.events.negativeMistakeProgressLoss * reduction;
  const capLoss = target * PVP_DUEL_CONFIG.events.negativeMistakeTargetCap;
  const loss = round2(Math.min(capLoss, rawLoss));
  if (loss <= 0) return null;
  participant.stageProgress[stageKey] = round2(Math.max(0, participant.stageProgress[stageKey] - loss));
  return buildEventLog(tick, participant, stageKey, "negative", "mistake", "Mistake", "Часть накопленного прогресса потеряна.", -loss);
}

function selectBotTactic(
  participant: ParticipantRuntime,
  opponent: ParticipantRuntime,
  stageKey: DuelProjectStageKey,
  duel: EngineActiveDuel,
) {
  const [skill1, skill2] = getRoundSkillKeys(stageKey);
  const value1 = Number(participant.skills[skill1] || 0);
  const value2 = Number(participant.skills[skill2] || 0);
  const rng = rngFor(duel, `${participant.userId}:${stageKey}:bot_tactic:${duel.roundStates[stageKey].tick}`);
  const lastOpponentWin = opponent.lastRoundOutcome === "win";
  const selfLost = participant.lastRoundOutcome === "lose";

  const pool: DuelTacticId[] = [];
  if (selfLost) {
    pool.push("stability", "stability", "pressure");
  } else if (lastOpponentWin) {
    pool.push("pressure", "stability", "pressure");
  } else if (value1 > value2) {
    pool.push("speed", "speed", "stability", "quality");
  } else if (value2 > value1) {
    pool.push("quality", "quality", "stability", "speed");
  } else {
    pool.push("stability", "speed", "quality", "pressure");
  }
  return pool[Math.floor(rng() * pool.length)] ?? "stability";
}

function prepareRound(duel: EngineActiveDuel, stageKey: DuelProjectStageKey) {
  const roundState = duel.roundStates[stageKey];
  if (roundState.prepared) return;
  if (duel.playerA.isBot) {
    duel.playerA.tacticsByStage[stageKey] = selectBotTactic(duel.playerA, duel.playerB, stageKey, duel);
  }
  if (duel.playerB.isBot) {
    duel.playerB.tacticsByStage[stageKey] = selectBotTactic(duel.playerB, duel.playerA, stageKey, duel);
  }
  if (!duel.playerA.tacticsByStage[stageKey]) duel.playerA.tacticsByStage[stageKey] = "stability";
  if (!duel.playerB.tacticsByStage[stageKey]) duel.playerB.tacticsByStage[stageKey] = "stability";
  duel.playerA.effects = createRoundEffectState();
  duel.playerB.effects = createRoundEffectState();
  roundState.prepared = true;
  duel.latestLog = `Раунд «${getRoundLabel(stageKey)}» стартовал.`;
}

function finishRound(
  duel: EngineActiveDuel,
  stageKey: DuelProjectStageKey,
  tick: number,
  compA: TickComputation,
  compB: TickComputation,
  winnerUserId: string | null,
) {
  const roundState = duel.roundStates[stageKey];
  const result: DuelRoundResult = {
    round: stageKey,
    playerAUserId: duel.playerA.userId,
    playerBUserId: duel.playerB.userId,
    scoreA: round2(duel.playerA.stageProgress[stageKey]),
    scoreB: round2(duel.playerB.stageProgress[stageKey]),
    winnerUserId,
    targetScore: roundState.targetScore,
    baseSkillsA: compA.baseSkillPower,
    baseSkillsB: compB.baseSkillPower,
    tacticAdjustedPowerA: compA.tacticAdjustedPower,
    tacticAdjustedPowerB: compB.tacticAdjustedPower,
    gadgetBonusA: compA.gadgetBonus,
    gadgetBonusB: compB.gadgetBonus,
    itemBonusA: compA.itemBonus,
    itemBonusB: compB.itemBonus,
    professionBonusA: compA.professionBonus,
    professionBonusB: compB.professionBonus,
    comebackBonusA: compA.comebackBonus,
    comebackBonusB: compB.comebackBonus,
    explanationA: compA.explanation,
    explanationB: compB.explanation,
    tacticA: getTacticForStage(duel.playerA, stageKey),
    tacticB: getTacticForStage(duel.playerB, stageKey),
    ticksSpent: roundState.totalTicks,
    eventCountA: duel.recentEvents.filter((event) => event.stageKey === stageKey && event.actorUserId === duel.playerA.userId).length,
    eventCountB: duel.recentEvents.filter((event) => event.stageKey === stageKey && event.actorUserId === duel.playerB.userId).length,
  };
  duel.rounds.push(result);
  duel.playerA.stageCompletedTick[stageKey] = tick;
  duel.playerB.stageCompletedTick[stageKey] = tick;
  duel.playerA.lastRoundOutcome = winnerUserId === null ? "draw" : winnerUserId === duel.playerA.userId ? "win" : "lose";
  duel.playerB.lastRoundOutcome = winnerUserId === null ? "draw" : winnerUserId === duel.playerB.userId ? "win" : "lose";
  duel.playerA.currentStageIndex = Math.min(PVP_DUEL_CONFIG.process.stages.length, duel.playerA.currentStageIndex + 1);
  duel.playerB.currentStageIndex = Math.min(PVP_DUEL_CONFIG.process.stages.length, duel.playerB.currentStageIndex + 1);
  duel.latestLog =
    winnerUserId === null
      ? `${getRoundLabel(stageKey)}: ничья`
      : `${getRoundLabel(stageKey)}: ${winnerUserId === duel.playerA.userId ? duel.playerA.username : duel.playerB.username} забирает раунд`;
  const nextStageKey = getCurrentStageKey(duel.playerA);
  if (nextStageKey) {
    const nextRoundState = duel.roundStates[nextStageKey];
    nextRoundState.prepared = false;
    nextRoundState.startsAtMs = duel.startedAtMs + tick * PVP_DUEL_CONFIG.process.tickIntervalMs + PVP_DUEL_CONFIG.process.roundPreparationWindowMs;
    duel.latestLog = `Раунд «${getRoundLabel(stageKey)}» завершён. На выбор тактики для «${getRoundLabel(nextStageKey)}» есть 5 сек.`;
  }
}

function resolveWinner(duel: EngineActiveDuel) {
  const winsA = duel.rounds.filter((round) => round.winnerUserId === duel.playerA.userId).length;
  const winsB = duel.rounds.filter((round) => round.winnerUserId === duel.playerB.userId).length;
  if (winsA > winsB) return duel.playerA.userId;
  if (winsB > winsA) return duel.playerB.userId;
  return null;
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
    tacticsByStage: { ...(seed.tacticsByStage || {}) },
    effects: createRoundEffectState(),
    lastRoundOutcome: null,
    isBot: Boolean(seed.isBot),
  };
}

function getEnergyCostForParticipant() {
  return Number(PVP_DUEL_CONFIG.process.baseEnergyCost.toFixed(4));
}

function getPreparationLog(duel: EngineActiveDuel) {
  return `Матч найден. Выбери 1 PvP-предмет и тактику на первый раунд. Активный гаджет: ${duel.playerA.gadget?.name || "нет"} vs ${duel.playerB.gadget?.name || "нет"}.`;
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
  duel.latestLog = `${participant.username} выбрал предмет ${getPvpBoostDefinition(boostId)?.name || boostId}`;
}

export function applyDuelTactic(duel: EngineActiveDuel, userId: string, stageKey: DuelProjectStageKey, tacticId: DuelTacticId) {
  const participant = duel.playerA.userId === userId ? duel.playerA : duel.playerB.userId === userId ? duel.playerB : null;
  if (!participant) throw new Error("Участник дуэли не найден");
  if (!PVP_DUEL_CONFIG.process.stages.find((stage) => stage.key === stageKey)) {
    throw new Error("Неизвестный раунд");
  }
  if (!getPvpTacticDefinition(tacticId)) {
    throw new Error("Неизвестная тактика");
  }
  if (duel.finishedAtMs) throw new Error("Дуэль уже завершена");
  const currentIndex = duel.playerA.currentStageIndex;
  const stageIndex = PVP_DUEL_CONFIG.process.stages.findIndex((stage) => stage.key === stageKey);
  if (stageIndex < currentIndex) {
    throw new Error("Для завершённого раунда тактику менять нельзя");
  }
  if (stageIndex > currentIndex) {
    throw new Error("Тактику можно выбрать только для текущего раунда");
  }
  const roundState = duel.roundStates[stageKey];
  if (participant.tacticsByStage[stageKey]) {
    throw new Error("Тактика для этого раунда уже зафиксирована");
  }
  if (roundState.tick > 0 || Date.now() >= roundState.startsAtMs) {
    throw new Error("Время выбора тактики для этого раунда уже закончилось");
  }
  participant.tacticsByStage[stageKey] = tacticId;
  duel.latestLog = `${participant.username} выбрал тактику ${getPvpTacticDefinition(tacticId)?.name || tacticId} для раунда «${getRoundLabel(stageKey)}».`;
}

export function startPreparedDuel(duel: EngineActiveDuel, nowMs: number = Date.now()) {
  if (duel.finishedAtMs || nowMs >= duel.startedAtMs) return duel;
  duel.startedAtMs = nowMs;
  duel.updatedAtMs = nowMs;
  duel.expectedEndAtMs = nowMs + (PVP_DUEL_CONFIG.process.expectedDurationTicks.max * PVP_DUEL_CONFIG.process.tickIntervalMs);
  duel.latestLog = "Дуэль началась. Первый раунд уже собирает прогресс.";
  return duel;
}

export function startDuel(playerASeed: DuelParticipantSeed, playerBSeed: DuelParticipantSeed, nowMs: number = Date.now()): EngineActiveDuel {
  const duelId = randomUUID();
  const seed = hashSeed(`${duelId}:${playerASeed.userId}:${playerBSeed.userId}:${nowMs}`);
  const playerA = createParticipant(playerASeed);
  const playerB = createParticipant(playerBSeed);
  const maxPower = Math.max(playerA.totalPower, playerB.totalPower, 1);
  const powerDiff = Math.abs(playerA.totalPower - playerB.totalPower) / maxPower;

  const stageTargets = PVP_DUEL_CONFIG.process.stages.reduce((acc, stage) => {
    const baseA = getBaseRoundSkills(playerA.skills, stage.key);
    const baseB = getBaseRoundSkills(playerB.skills, stage.key);
    const avgBase = Math.round((baseA + baseB) / 2);
    acc[stage.key] = Math.max(PVP_DUEL_CONFIG.scoring.targetMin, avgBase * PVP_DUEL_CONFIG.scoring.targetMultiplier);
    return acc;
  }, {} as Record<DuelProjectStageKey, number>);

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
    stageTargets,
    rounds: [],
    roundStates: {
      concept: { stageKey: "concept", targetScore: stageTargets.concept, tick: 0, totalTicks: 0, prepared: false, startsAtMs: startedAtMs },
      core: { stageKey: "core", targetScore: stageTargets.core, tick: 0, totalTicks: 0, prepared: false, startsAtMs: Number.MAX_SAFE_INTEGER },
      tests: { stageKey: "tests", targetScore: stageTargets.tests, tick: 0, totalTicks: 0, prepared: false, startsAtMs: Number.MAX_SAFE_INTEGER },
    },
    recentEvents: [],
    latestLog: "",
    playerA,
    playerB,
    winnerUserId: null,
    finishedAtMs: null,
    energyCostA: getEnergyCostForParticipant(),
    energyCostB: getEnergyCostForParticipant(),
  };

  duel.latestLog = getPreparationLog(duel);
  return duel;
}

function finishDuelIfNeeded(duel: EngineActiveDuel, nowMs: number) {
  if (duel.finishedAtMs) return;
  if (duel.rounds.length < PVP_DUEL_CONFIG.process.stages.length) return;
  duel.finishedAtMs = nowMs;
  duel.updatedAtMs = nowMs;
  duel.winnerUserId = resolveWinner(duel);
  duel.latestLog = duel.winnerUserId
    ? `Финал: ${duel.winnerUserId === duel.playerA.userId ? duel.playerA.username : duel.playerB.username} побеждает.`
    : "Финал: общая ничья.";
}

function processSingleTick(duel: EngineActiveDuel, tickNumber: number, tickAtMs: number) {
  const stageKey = getCurrentStageKey(duel.playerA);
  if (!stageKey) {
    finishDuelIfNeeded(duel, tickAtMs);
    return;
  }

  const roundState = duel.roundStates[stageKey];
  if (tickAtMs < roundState.startsAtMs) {
    duel.playerA.latestTickGain = 0;
    duel.playerB.latestTickGain = 0;
    duel.latestLog = `До старта раунда «${getRoundLabel(stageKey)}» осталось ${Math.max(1, Math.ceil((roundState.startsAtMs - tickAtMs) / 1000))} сек. Выбери тактику.`;
    return;
  }

  prepareRound(duel, stageKey);
  roundState.tick += 1;
  roundState.totalTicks += 1;

  const compA = computeTickPower(duel.playerA, duel.playerB, stageKey);
  const compB = computeTickPower(duel.playerB, duel.playerA, stageKey);

  if (roundState.tick % PVP_DUEL_CONFIG.events.everyTicks === 0) {
    const eventA = applyEventForParticipant(duel, duel.playerA, duel.playerB, stageKey, tickNumber, compA.tickPower);
    const eventB = applyEventForParticipant(duel, duel.playerB, duel.playerA, stageKey, tickNumber, compB.tickPower);
    if (eventA) duel.recentEvents.push(eventA);
    if (eventB) duel.recentEvents.push(eventB);
    if (duel.recentEvents.length > 12) {
      duel.recentEvents.splice(0, duel.recentEvents.length - 12);
    }
  }

  const progressBeforeA = duel.playerA.stageProgress[stageKey];
  const progressBeforeB = duel.playerB.stageProgress[stageKey];

  let deltaA = compA.tickPower;
  let deltaB = compB.tickPower;

  if (duel.playerA.effects.freezeTicks > 0) {
    deltaA = 0;
  } else if (duel.playerA.effects.slowdownTicks > 0) {
    deltaA *= duel.playerA.effects.slowdownMultiplier;
  }

  if (duel.playerB.effects.freezeTicks > 0) {
    deltaB = 0;
  } else if (duel.playerB.effects.slowdownTicks > 0) {
    deltaB *= duel.playerB.effects.slowdownMultiplier;
  }

  deltaA = round2(Math.max(0, deltaA));
  deltaB = round2(Math.max(0, deltaB));

  duel.playerA.stageProgress[stageKey] = round2(progressBeforeA + deltaA);
  duel.playerB.stageProgress[stageKey] = round2(progressBeforeB + deltaB);
  duel.playerA.latestTickGain = deltaA;
  duel.playerB.latestTickGain = deltaB;

  const target = duel.stageTargets[stageKey];
  const reachedA = duel.playerA.stageProgress[stageKey] >= target;
  const reachedB = duel.playerB.stageProgress[stageKey] >= target;

  decrementEffectTimers(duel.playerA);
  decrementEffectTimers(duel.playerB);

  if (reachedA || reachedB) {
    finishRound(
      duel,
      stageKey,
      tickNumber,
      compA,
      compB,
      reachedA && reachedB ? null : reachedA ? duel.playerA.userId : duel.playerB.userId,
    );
  } else {
    duel.latestLog = `${getRoundLabel(stageKey)}: ${duel.playerA.username} +${deltaA.toFixed(2)} / ${duel.playerB.username} +${deltaB.toFixed(2)}`;
  }
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
    while (duel.lastProcessedTick < targetTick && !duel.finishedAtMs) {
      const tick = duel.lastProcessedTick + 1;
      const tickAtMs = duel.startedAtMs + tick * PVP_DUEL_CONFIG.process.tickIntervalMs;
      processSingleTick(duel, tick, tickAtMs);
      duel.lastProcessedTick = tick;
      duel.updatedAtMs = tickAtMs;
      finishDuelIfNeeded(duel, duel.updatedAtMs);
    }

    if (!duel.finishedAtMs) {
      duel.expectedEndAtMs = duel.updatedAtMs + (PVP_DUEL_CONFIG.process.expectedDurationTicks.max * PVP_DUEL_CONFIG.process.tickIntervalMs);
    }

    return duel;
  } finally {
    duelProcessingLocks.delete(duel.duelId);
  }
}

export function generateBalancedPvpBot(player: DuelParticipantSeed, botUserId: string, username: string): DuelParticipantSeed {
  const rng = createSeededRandom(hashSeed(`${player.userId}:${player.rating}:${player.username}:bot`));
  const isLowLevel = Number(player.skills.analytics || 0) + Number(player.skills.coding || 0) + Number(player.skills.testing || 0) < 30;
  const minScale = isLowLevel ? PVP_DUEL_CONFIG.bots.lowLevelPowerMin : PVP_DUEL_CONFIG.bots.normalPowerMin;
  const maxScale = isLowLevel ? PVP_DUEL_CONFIG.bots.lowLevelPowerMax : PVP_DUEL_CONFIG.bots.normalPowerMax;
  const scale = (value: number) => round2(Math.max(0.5, value) * (minScale + rng() * (maxScale - minScale)));
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
    rating: Math.max(900, Math.round(player.rating * (0.99 + rng() * 0.02))),
    skills: botSkills,
    boosts: { selectedBoosts: [] },
    gadget: null,
    pvpPowerScore: computeTotalDuelPower(botSkills, null, 0),
    tacticsByStage: {},
    isBot: true,
  };
}

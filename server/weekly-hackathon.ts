import type { User } from "../shared/schema";
import type { CompanyEconomyLike } from "../client/src/lib/companySystem";
import {
  HACKATHON_ALLOWED_PART_TYPES,
  HACKATHON_PART_SCORES,
  WEEKLY_HACKATHON_CONFIG,
  getDayKey,
  getHackathonGrmContributionPoints,
  getNextWeeklyAutoStart,
  type HackathonPartType,
  type HackathonSabotageType,
  type HackathonStatus,
  type WinnerBoost,
} from "../shared/weekly-hackathon";

type SkillInput = {
  coding?: number;
  analytics?: number;
  design?: number;
  testing?: number;
};

type HackathonCompanyScore = {
  companyId: string;
  companyName: string;
  city: string;
  level: number;
  rndLevel: number;
  skillContribution: number;
  partContribution: number;
  grmInvested: number;
  grmContribution: number;
  companyBonus: number;
  randomBonus: number;
  score: number;
  sabotageAdjustment: number;
  securityLevel: 1 | 2 | 3;
  randomSeedPercent: number;
  partTypeCounts: Record<string, number>;
};

type PlayerContributionStats = {
  userId: string;
  companyId: string;
  dayKey: string;
  dailyActions: number;
  totalParts: number;
  totalGrm: number;
};

type WeeklyHackathonState = {
  eventId: string | null;
  status: HackathonStatus;
  startedAt: number | null;
  endsAt: number | null;
  finalizedAt: number | null;
  companies: Map<string, HackathonCompanyScore>;
  playerStats: Map<string, PlayerContributionStats>;
  winners: HackathonCompanyScore[];
  leaderboardUpdatedAt: number;
  nextAutoStartAt: number;
  winnerBoost: WinnerBoost | null;
  winnerBoostExpiresAt: number | null;
  companyDebuffs: Map<string, { marketRumorUntil: number; partsPenaltyRemaining: number }>;
  sabotageCountByCompany: Map<string, number>;
  sabotageInitiatedByUser: Set<string>;
  pendingPoachOffers: Map<string, {
    id: string;
    eventId: string;
    attackerCompanyId: string;
    targetCompanyId: string;
    targetUserId: string;
    initiatorUserId: string;
    createdAt: number;
    expiresAt: number;
    status: "pending" | "accepted" | "declined" | "expired";
  }>;
  announcementQueue: Array<{ id: string; text: string; winnerCompanyId?: string }>;
};

const state: WeeklyHackathonState = {
  // TODO: Persist weekly hackathon state/winners/player stats in DB tables for crash-safe recovery.
  eventId: null,
  status: "idle",
  startedAt: null,
  endsAt: null,
  finalizedAt: null,
  companies: new Map(),
  playerStats: new Map(),
  winners: [],
  leaderboardUpdatedAt: 0,
  nextAutoStartAt: getNextWeeklyAutoStart(Date.now()),
  winnerBoost: null,
  winnerBoostExpiresAt: null,
  companyDebuffs: new Map(),
  sabotageCountByCompany: new Map(),
  sabotageInitiatedByUser: new Set(),
  pendingPoachOffers: new Map(),
  announcementQueue: [],
};

let schedulerTimer: NodeJS.Timeout | null = null;

function nextRandom(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function normalizeScore(entry: HackathonCompanyScore) {
  entry.grmContribution = getHackathonGrmContributionPoints(entry.grmInvested);
  const base = Math.max(0, entry.skillContribution + entry.partContribution + entry.grmContribution + entry.sabotageAdjustment);
  const rawCompanyBonus = (entry.level * WEEKLY_HACKATHON_CONFIG.companyBonusLevelWeight)
    + (entry.rndLevel * WEEKLY_HACKATHON_CONFIG.companyBonusRndWeight);
  const cappedCompanyBonus = Math.min(rawCompanyBonus, base * WEEKLY_HACKATHON_CONFIG.companyBonusMaxShare);
  entry.companyBonus = cappedCompanyBonus;
  entry.randomBonus = base * entry.randomSeedPercent;
  entry.score = Math.max(0, Number((base + entry.companyBonus + entry.randomBonus).toFixed(2)));
}

function getCompanyDebuffs(companyId: string) {
  const now = Date.now();
  const current = state.companyDebuffs.get(companyId);
  const next = {
    marketRumorUntil: current?.marketRumorUntil && current.marketRumorUntil > now ? current.marketRumorUntil : 0,
    partsPenaltyRemaining: Math.max(0, Number(current?.partsPenaltyRemaining || 0)),
  };
  state.companyDebuffs.set(companyId, next);
  return next;
}

function applySabotageDelta(companyId: string, delta: number) {
  const entry = ensureCompanyRegistered(companyId);
  entry.sabotageAdjustment = Number((entry.sabotageAdjustment + delta).toFixed(2));
  normalizeScore(entry);
}

function refreshLeaderboard() {
  Array.from(state.companies.values()).forEach((entry) => {
    normalizeScore(entry);
  });
  state.leaderboardUpdatedAt = Date.now();
}

function getSortedLeaderboard() {
  if (Date.now() - state.leaderboardUpdatedAt >= WEEKLY_HACKATHON_CONFIG.leaderboardRefreshMs) {
    refreshLeaderboard();
  }
  return Array.from(state.companies.values()).sort((a, b) => b.score - a.score);
}

function getPlayerStatsKey(userId: string, companyId: string) {
  return `${userId}:${companyId}`;
}

function getOrCreatePlayerStats(userId: string, companyId: string) {
  const key = getPlayerStatsKey(userId, companyId);
  const dayKey = getDayKey(Date.now());
  const current = state.playerStats.get(key);
  if (current && current.dayKey === dayKey) return current;
  const next: PlayerContributionStats = {
    userId,
    companyId,
    dayKey,
    dailyActions: 0,
    totalParts: current?.totalParts ?? 0,
    totalGrm: current?.totalGrm ?? 0,
  };
  state.playerStats.set(key, next);
  return next;
}

function assertEventActive() {
  if (state.status !== "registration" && state.status !== "active") {
    throw new Error("Weekly Hackathon сейчас не активен");
  }
}

function assertContributionAvailable(stats: PlayerContributionStats) {
  if (stats.dailyActions >= WEEKLY_HACKATHON_CONFIG.playerDailyContributionLimit) {
    throw new Error("Дневной лимит вкладов исчерпан (5/5)");
  }
}

function ensureCompanyRegistered(companyId: string) {
  const entry = state.companies.get(companyId);
  if (!entry) throw new Error("Компания не зарегистрирована в Weekly Hackathon");
  return entry;
}

export function getWeeklyHackathonState() {
  const leaderboard = getSortedLeaderboard();
  return {
    eventId: state.eventId,
    status: state.status,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    finalizedAt: state.finalizedAt,
    leaderboardUpdatedAt: state.leaderboardUpdatedAt,
    leaderboard,
    winners: state.winners,
    winnerBoost: state.winnerBoost,
    winnerBoostExpiresAt: state.winnerBoostExpiresAt,
    nextAutoStartAt: state.nextAutoStartAt,
  };
}

export function startWeeklyHackathon(nowMs: number = Date.now(), source: "manual" | "auto" = "manual") {
  if (state.status === "registration" || state.status === "active") {
    throw new Error("Weekly Hackathon уже запущен");
  }
  state.eventId = `hackathon-${nowMs}`;
  state.status = "registration";
  state.startedAt = nowMs;
  state.endsAt = nowMs + WEEKLY_HACKATHON_CONFIG.durationMs;
  state.finalizedAt = null;
  state.companies.clear();
  state.playerStats.clear();
  companyDailyGrmByDayKey.clear();
  state.companyDebuffs.clear();
  state.sabotageCountByCompany.clear();
  state.sabotageInitiatedByUser.clear();
  state.pendingPoachOffers.clear();
  state.winners = [];
  state.leaderboardUpdatedAt = 0;
  if (source === "auto") {
    state.nextAutoStartAt = getNextWeeklyAutoStart(nowMs + 60_000);
  }
  const announcementId = `start:${state.eventId}`;
  state.announcementQueue.push({
    id: announcementId,
    text: "🌍 Weekly Hackathon начался! Регистрация компаний открыта на 24 часа.",
  });
  return getWeeklyHackathonState();
}

function finalizeHackathon(nowMs: number = Date.now()) {
  refreshLeaderboard();
  state.status = "ended";
  state.finalizedAt = nowMs;
  state.winners = getSortedLeaderboard().slice(0, 3);

  if (state.winners.length > 0) {
    const boost = WEEKLY_HACKATHON_CONFIG.winnerBoosts[Math.floor(Math.random() * WEEKLY_HACKATHON_CONFIG.winnerBoosts.length)];
    state.winnerBoost = boost;
    state.winnerBoostExpiresAt = nowMs + WEEKLY_HACKATHON_CONFIG.winnerBoostDurationMs;
    const winner = state.winners[0];
    state.announcementQueue.push({
      id: `end:${state.eventId}:${nowMs}`,
      text: `🌍 Weekly Hackathon завершён\n\n🏆 Победитель: ${winner.companyName}\nИх проект стал лучшим проектом недели.`,
      winnerCompanyId: winner.companyId,
    });
  }

  return getWeeklyHackathonState();
}

export function endWeeklyHackathon(nowMs: number = Date.now()) {
  if (state.status !== "registration" && state.status !== "active") {
    throw new Error("Нет активного Weekly Hackathon");
  }
  return finalizeHackathon(nowMs);
}

export function resetWeeklyHackathon(nowMs: number = Date.now()) {
  state.eventId = null;
  state.status = "idle";
  state.startedAt = null;
  state.endsAt = null;
  state.finalizedAt = nowMs;
  state.companies.clear();
  state.playerStats.clear();
  companyDailyGrmByDayKey.clear();
  state.companyDebuffs.clear();
  state.sabotageCountByCompany.clear();
  state.sabotageInitiatedByUser.clear();
  state.pendingPoachOffers.clear();
  state.winners = [];
  state.leaderboardUpdatedAt = 0;
  state.announcementQueue.push({
    id: `reset:${nowMs}`,
    text: "🧹 Weekly Hackathon сброшен администратором.",
  });
  return getWeeklyHackathonState();
}

export function registerCompanyForWeeklyHackathon(input: {
  companyId: string;
  companyName: string;
  city: string;
  companyLevel: number;
  rndLevel: number;
  securityLevel?: number;
}) {
  assertEventActive();
  if (state.companies.has(input.companyId)) {
    throw new Error("Компания уже зарегистрирована в Weekly Hackathon");
  }
  const entry: HackathonCompanyScore = {
    companyId: input.companyId,
    companyName: input.companyName,
    city: input.city,
    level: Math.max(1, Math.floor(input.companyLevel || 1)),
    rndLevel: Math.max(0, Math.floor(input.rndLevel || 0)),
    skillContribution: 0,
    partContribution: 0,
    grmInvested: 0,
    grmContribution: 0,
    companyBonus: 0,
    randomBonus: 0,
    score: 0,
    sabotageAdjustment: 0,
    securityLevel: [1, 2, 3].includes(Number(input.securityLevel || 1)) ? (Number(input.securityLevel || 1) as 1 | 2 | 3) : 1,
    randomSeedPercent: nextRandom(0, WEEKLY_HACKATHON_CONFIG.randomBonusMaxPercent),
    partTypeCounts: {},
  };
  normalizeScore(entry);
  state.companies.set(input.companyId, entry);
  return entry;
}

export function contributeSkillToWeeklyHackathon(input: {
  userId: string;
  companyId: string;
  skills: SkillInput;
  multiplier?: number;
  fixedRandomBonus?: number;
}) {
  if (state.status !== "active" && state.status !== "registration") {
    throw new Error("Weekly Hackathon сейчас не принимает вклады");
  }
  const entry = ensureCompanyRegistered(input.companyId);
  const stats = getOrCreatePlayerStats(input.userId, input.companyId);
  assertContributionAvailable(stats);

  const sumSkills = Math.max(0, Number(input.skills.coding || 0))
    + Math.max(0, Number(input.skills.analytics || 0))
    + Math.max(0, Number(input.skills.design || 0))
    + Math.max(0, Number(input.skills.testing || 0));
  const randomFactor = Number.isFinite(Number(input.fixedRandomBonus))
    ? Number(input.fixedRandomBonus)
    : nextRandom(
      WEEKLY_HACKATHON_CONFIG.skillRandomMin,
      WEEKLY_HACKATHON_CONFIG.skillRandomMax,
    );
  const debuffs = getCompanyDebuffs(input.companyId);
  const marketRumorMultiplier = debuffs.marketRumorUntil > Date.now()
    ? WEEKLY_HACKATHON_CONFIG.sabotage.marketRumorContributionMultiplier
    : 1;
  const contribution = Math.max(
    1,
    Number(((sumSkills + randomFactor) * marketRumorMultiplier * Math.max(0.1, Number(input.multiplier || 1))).toFixed(2)),
  );
  entry.skillContribution += contribution;
  stats.dailyActions += 1;

  normalizeScore(entry);
  return { contribution, score: entry.score };
}

export function contributePartToWeeklyHackathon(input: {
  userId: string;
  companyId: string;
  partType: HackathonPartType;
  rarity: string;
  quantity: number;
  multiplier?: number;
}) {
  assertEventActive();
  if (!HACKATHON_ALLOWED_PART_TYPES.has(input.partType)) {
    throw new Error("Эта запчасть не участвует в Weekly Hackathon");
  }
  const entry = ensureCompanyRegistered(input.companyId);
  const stats = getOrCreatePlayerStats(input.userId, input.companyId);
  assertContributionAvailable(stats);
  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  if (stats.totalParts + quantity > WEEKLY_HACKATHON_CONFIG.playerPartLimit) {
    throw new Error("Превышен лимит деталей от игрока (10 за ивент)");
  }

  const debuffs = getCompanyDebuffs(input.companyId);
  let totalPoints = 0;
  const base = HACKATHON_PART_SCORES[input.partType][input.rarity] ?? HACKATHON_PART_SCORES[input.partType].Common;
  for (let i = 0; i < quantity; i += 1) {
    const usedCount = Number(entry.partTypeCounts[input.partType] ?? 0);
    const multiplier = Math.pow(WEEKLY_HACKATHON_CONFIG.partDiminishingRate, usedCount);
    const sabotageMultiplier = debuffs.partsPenaltyRemaining > 0
      ? WEEKLY_HACKATHON_CONFIG.sabotage.partsPenaltyMultiplier
      : 1;
    const gain = Math.max(0.5, base * multiplier * sabotageMultiplier * Math.max(0.1, Number(input.multiplier || 1)));
    totalPoints += gain;
    entry.partTypeCounts[input.partType] = usedCount + 1;
    if (debuffs.partsPenaltyRemaining > 0) {
      debuffs.partsPenaltyRemaining -= 1;
    }
  }
  entry.partContribution += Number(totalPoints.toFixed(2));
  stats.totalParts += quantity;
  stats.dailyActions += 1;

  normalizeScore(entry);
  return { contribution: Number(totalPoints.toFixed(2)), score: entry.score };
}

export function contributeGrmToWeeklyHackathon(input: {
  userId: string;
  companyId: string;
  amount: number;
}) {
  assertEventActive();
  const entry = ensureCompanyRegistered(input.companyId);
  const stats = getOrCreatePlayerStats(input.userId, input.companyId);
  assertContributionAvailable(stats);
  const amount = Math.max(0, Math.floor(input.amount || 0));
  if (!WEEKLY_HACKATHON_CONFIG.grmPackages.includes(amount)) {
    throw new Error("Доступны только вклады 100 / 500 / 1000 GRM");
  }
  if (stats.totalGrm + amount > WEEKLY_HACKATHON_CONFIG.playerGrmLimit) {
    throw new Error("Превышен лимит игрока по GRM (3000 за ивент)");
  }
  const dayCapKey = `${input.companyId}:${stats.dayKey}`;
  const currentCompanyDaily = Number(companyDailyGrmByDayKey.get(dayCapKey) ?? 0);
  if (currentCompanyDaily + amount > WEEKLY_HACKATHON_CONFIG.companyGrmDailyCap) {
    throw new Error("Дневной лимит GRM компании для хакатона исчерпан");
  }
  if (entry.grmInvested + amount > WEEKLY_HACKATHON_CONFIG.companyGrmTotalCap) {
    throw new Error("Общий лимит GRM компании для хакатона исчерпан");
  }

  stats.totalGrm += amount;
  stats.dailyActions += 1;
  companyDailyGrmByDayKey.set(dayCapKey, currentCompanyDaily + amount);

  const before = entry.grmContribution;
  entry.grmInvested += amount;
  normalizeScore(entry);
  return { contribution: Number((entry.grmContribution - before).toFixed(2)), score: entry.score };
}

const companyDailyGrmByDayKey = new Map<string, number>();

function getSecuritySuccessMultiplier(targetSecurityLevel: 1 | 2 | 3) {
  const reduce = Number(WEEKLY_HACKATHON_CONFIG.sabotage.securityReduceChance[targetSecurityLevel] || 0);
  return Math.max(0.05, 1 - reduce);
}

function getDetectChance(targetSecurityLevel: 1 | 2 | 3) {
  return Math.max(0, Math.min(1, targetSecurityLevel * WEEKLY_HACKATHON_CONFIG.sabotage.detectChancePerSecurityLevel));
}

function assertSabotageAllowed(input: {
  attackerCompanyId: string;
  targetCompanyId: string;
  initiatorUserId: string;
}) {
  if (state.status !== "active") {
    throw new Error("Саботаж доступен только во время активного Weekly Hackathon");
  }
  if (input.attackerCompanyId === input.targetCompanyId) {
    throw new Error("Нельзя атаковать свою компанию");
  }
  ensureCompanyRegistered(input.attackerCompanyId);
  ensureCompanyRegistered(input.targetCompanyId);

  const companyUses = Number(state.sabotageCountByCompany.get(input.attackerCompanyId) || 0);
  if (companyUses >= WEEKLY_HACKATHON_CONFIG.sabotage.maxPerCompanyPerEvent) {
    throw new Error("Лимит саботажей компании исчерпан (3/3)");
  }
  if (state.sabotageInitiatedByUser.has(input.initiatorUserId)) {
    throw new Error("Игрок уже инициировал саботаж в этом хакатоне");
  }
}

function commitSabotageUsage(attackerCompanyId: string, initiatorUserId: string) {
  const next = Number(state.sabotageCountByCompany.get(attackerCompanyId) || 0) + 1;
  state.sabotageCountByCompany.set(attackerCompanyId, next);
  state.sabotageInitiatedByUser.add(initiatorUserId);
}

function ensureSecurityLevel(value: number | undefined): 1 | 2 | 3 {
  const normalized = Math.floor(Number(value || 1));
  if (normalized === 2 || normalized === 3) return normalized;
  return 1;
}

export function setHackathonCompanySecurityLevel(companyId: string, level: number) {
  const entry = ensureCompanyRegistered(companyId);
  entry.securityLevel = ensureSecurityLevel(level);
  return entry.securityLevel;
}

export function launchWeeklyHackathonSabotage(input: {
  initiatorUserId: string;
  initiatorRole: string;
  attackerCompanyId: string;
  targetCompanyId: string;
  sabotageType: HackathonSabotageType;
  targetUserId?: string;
  defenseMultiplier?: number;
}) {
  const role = String(input.initiatorRole || "").toLowerCase();
  const allowedRoles = new Set(["owner", "cto", "security_lead"]);
  if (!allowedRoles.has(role)) {
    throw new Error("Запускать саботаж могут только CEO / CTO / Security Lead");
  }

  assertSabotageAllowed({
    attackerCompanyId: input.attackerCompanyId,
    targetCompanyId: input.targetCompanyId,
    initiatorUserId: input.initiatorUserId,
  });

  const attacker = ensureCompanyRegistered(input.attackerCompanyId);
  const target = ensureCompanyRegistered(input.targetCompanyId);
  const securityLevel = ensureSecurityLevel(target.securityLevel);
  const defenseMultiplier = Math.max(0.3, Number(input.defenseMultiplier || 1));
  const now = Date.now();
  const typeConfig = WEEKLY_HACKATHON_CONFIG.sabotage.types[input.sabotageType] as Record<string, number>;
  const logId = `sab:${now}:${Math.random().toString(36).slice(2, 8)}`;
  const baseResult = {
    logId,
    eventId: String(state.eventId || ""),
    sabotageType: input.sabotageType,
    attackerCompanyId: attacker.companyId,
    attackerCompanyName: attacker.companyName,
    targetCompanyId: target.companyId,
    targetCompanyName: target.companyName,
    initiatorUserId: input.initiatorUserId,
    targetUserId: input.targetUserId || null,
    detected: false,
    status: "resolved" as "resolved" | "poach_pending",
    success: true as boolean | null,
    scoreDeltaAttacker: 0,
    scoreDeltaTarget: 0,
    details: {
      securityLevel,
      configuredCostGrm: Number(typeConfig.costGrm || 0),
    } as Record<string, unknown>,
  };

  if (input.sabotageType === "tech_leak" || input.sabotageType === "cyber_attack") {
    const chanceBase = Number(typeConfig.successChance || 0);
    const chanceFinal = Math.max(0.01, Math.min(0.99, chanceBase * getSecuritySuccessMultiplier(securityLevel) * defenseMultiplier));
    const success = Math.random() < chanceFinal;
    baseResult.success = success;
    baseResult.details.successChanceFinal = Number(chanceFinal.toFixed(4));
    if (success) {
      const attackerDelta = Number(typeConfig.successAttackerDelta || 0);
      const targetDelta = Number(typeConfig.successTargetDelta || 0);
      applySabotageDelta(attacker.companyId, attackerDelta);
      applySabotageDelta(target.companyId, targetDelta);
      baseResult.scoreDeltaAttacker = attackerDelta;
      baseResult.scoreDeltaTarget = targetDelta;
    } else {
      const failPenalty = Number(typeConfig.failAttackerDelta || 0);
      if (failPenalty) {
        applySabotageDelta(attacker.companyId, failPenalty);
        baseResult.scoreDeltaAttacker = failPenalty;
      }
      baseResult.scoreDeltaTarget = 0;
    }
  } else if (input.sabotageType === "market_rumor") {
    const chanceFinal = Math.max(0.01, Math.min(0.99, getSecuritySuccessMultiplier(securityLevel) * defenseMultiplier));
    const success = Math.random() < chanceFinal;
    baseResult.success = success;
    baseResult.details.successChanceFinal = Number(chanceFinal.toFixed(4));
    if (success) {
      const debuff = getCompanyDebuffs(target.companyId);
      debuff.marketRumorUntil = Math.max(debuff.marketRumorUntil, now + WEEKLY_HACKATHON_CONFIG.sabotage.marketRumorDurationMs);
    }
  } else if (input.sabotageType === "parts_sabotage") {
    const chanceFinal = Math.max(0.01, Math.min(0.99, getSecuritySuccessMultiplier(securityLevel) * defenseMultiplier));
    const success = Math.random() < chanceFinal;
    baseResult.success = success;
    baseResult.details.successChanceFinal = Number(chanceFinal.toFixed(4));
    if (success) {
      const debuff = getCompanyDebuffs(target.companyId);
      debuff.partsPenaltyRemaining += WEEKLY_HACKATHON_CONFIG.sabotage.partsPenaltyCount;
    }
  } else if (input.sabotageType === "talent_poaching") {
    if (!input.targetUserId) {
      throw new Error("Для Talent Poaching нужно указать targetUserId");
    }
    const offer = {
      id: logId,
      eventId: String(state.eventId || ""),
      attackerCompanyId: attacker.companyId,
      targetCompanyId: target.companyId,
      targetUserId: String(input.targetUserId),
      initiatorUserId: input.initiatorUserId,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      status: "pending" as const,
    };
    state.pendingPoachOffers.set(offer.id, offer);
    baseResult.status = "poach_pending";
    baseResult.success = null;
  }

  const detected = Math.random() < Math.min(1, getDetectChance(securityLevel) / defenseMultiplier);
  baseResult.detected = detected;
  if (detected) {
    // Brand is not persisted in base company table yet; apply a small score penalty in hackathon context.
    applySabotageDelta(attacker.companyId, -10);
    baseResult.scoreDeltaAttacker -= 10;
    baseResult.details.detectPenalty = "brand:-10 (converted to hackathon score -10)";
  }

  commitSabotageUsage(attacker.companyId, input.initiatorUserId);
  refreshLeaderboard();
  return baseResult;
}

export function resolveHackathonPoachOffer(input: { offerId: string; userId: string; accept: boolean }) {
  const offer = state.pendingPoachOffers.get(input.offerId);
  if (!offer) throw new Error("Предложение Talent Poaching не найдено");
  if (offer.targetUserId !== input.userId) throw new Error("Это предложение предназначено другому игроку");
  if (offer.status !== "pending") throw new Error("Предложение уже обработано");
  if (Date.now() > offer.expiresAt) {
    offer.status = "expired";
    throw new Error("Срок предложения истёк");
  }

  offer.status = input.accept ? "accepted" : "declined";
  let deltaTarget = 0;
  if (input.accept) {
    deltaTarget = Number(WEEKLY_HACKATHON_CONFIG.sabotage.types.talent_poaching.acceptTargetDelta || -100);
    applySabotageDelta(offer.targetCompanyId, deltaTarget);
  }
  refreshLeaderboard();
  return {
    offerId: offer.id,
    accepted: input.accept,
    targetScoreDelta: deltaTarget,
    attackerCompanyId: offer.attackerCompanyId,
    targetCompanyId: offer.targetCompanyId,
    eventId: offer.eventId,
  };
}

export function getWeeklyHackathonSabotageState(companyId?: string) {
  const pendingOffers = Array.from(state.pendingPoachOffers.values())
    .filter((offer) => offer.status === "pending" && (!companyId || offer.targetCompanyId === companyId || offer.attackerCompanyId === companyId));
  const debuffs = companyId ? getCompanyDebuffs(companyId) : null;
  return {
    maxPerCompanyPerEvent: WEEKLY_HACKATHON_CONFIG.sabotage.maxPerCompanyPerEvent,
    maxPerUserPerEvent: WEEKLY_HACKATHON_CONFIG.sabotage.maxPerUserPerEvent,
    usedByCompany: companyId ? Number(state.sabotageCountByCompany.get(companyId) || 0) : null,
    companyDebuffs: debuffs,
    pendingPoachOffers: pendingOffers,
  };
}

export function getPendingPoachOffersForUser(userId: string) {
  return Array.from(state.pendingPoachOffers.values()).filter((offer) => offer.status === "pending" && offer.targetUserId === userId);
}

export function popWeeklyHackathonAnnouncements() {
  const queue = state.announcementQueue.slice();
  state.announcementQueue = [];
  return queue;
}

export function getWinnerBoostForCompany(companyId: string) {
  if (!state.winnerBoost || !state.winnerBoostExpiresAt) return null;
  if (Date.now() > state.winnerBoostExpiresAt) return null;
  if (state.winners[0]?.companyId !== companyId) return null;
  return {
    ...state.winnerBoost,
    expiresAt: state.winnerBoostExpiresAt,
  };
}

export function applyWinnerRewardsToCompanies(updateCompanyBalance: (companyId: string, addGrm: number) => Promise<void>) {
  const rewards = WEEKLY_HACKATHON_CONFIG.rewards;
  const winners = state.winners;
  const jobs: Array<Promise<void>> = [];
  if (winners[0]) jobs.push(updateCompanyBalance(winners[0].companyId, rewards.first.grm));
  if (winners[1]) jobs.push(updateCompanyBalance(winners[1].companyId, rewards.second.grm));
  if (winners[2]) jobs.push(updateCompanyBalance(winners[2].companyId, rewards.third.grm));
  return Promise.all(jobs);
}

export function startWeeklyHackathonScheduler(options: {
  onAutoEnd?: () => Promise<void> | void;
  onAutoStart?: () => Promise<void> | void;
}) {
  if (schedulerTimer) return;
  const tick = async () => {
    const now = Date.now();
    try {
      if ((state.status === "registration" || state.status === "active") && state.endsAt && now >= state.endsAt) {
        endWeeklyHackathon(now);
        await options.onAutoEnd?.();
      } else if ((state.status === "idle" || state.status === "ended") && now >= state.nextAutoStartAt) {
        startWeeklyHackathon(now, "auto");
        await options.onAutoStart?.();
      } else if (state.status === "registration" && state.startedAt && now - state.startedAt > 30_000) {
        state.status = "active";
      }
    } catch (error) {
      console.error("Weekly hackathon scheduler tick failed:", error);
    } finally {
      schedulerTimer = setTimeout(tick, WEEKLY_HACKATHON_CONFIG.schedulerTickMs);
    }
  };
  schedulerTimer = setTimeout(tick, WEEKLY_HACKATHON_CONFIG.schedulerTickMs);
}

export function stopWeeklyHackathonScheduler() {
  if (!schedulerTimer) return;
  clearTimeout(schedulerTimer);
  schedulerTimer = null;
}

export function getCompanyRndLevelFromEconomy(companyEconomy?: CompanyEconomyLike | null) {
  if (!companyEconomy?.departments) return 0;
  const rnd = Number((companyEconomy.departments as any)?.researchAndDevelopment || 0);
  return Math.max(0, Math.floor(rnd));
}

export function formatWeeklyHackathonTop(limit: number = 10) {
  const top = getSortedLeaderboard().slice(0, Math.max(1, Math.min(50, limit)));
  return top.map((row, index) => ({
    place: index + 1,
    companyId: row.companyId,
    companyName: row.companyName,
    city: row.city,
    score: row.score,
  }));
}

export function getWeeklyHackathonPlayerStats(userId: string, companyId: string) {
  const stats = state.playerStats.get(getPlayerStatsKey(userId, companyId));
  return stats ?? null;
}

export function getWeeklyHackathonCompanyScore(companyId: string) {
  return state.companies.get(companyId) ?? null;
}

export function promoteRegistrationToActive() {
  if (state.status === "registration") {
    state.status = "active";
  }
}

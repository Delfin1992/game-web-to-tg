import {
  HACKATHON_ALLOWED_PART_TYPES,
  HACKATHON_PART_SCORES,
  HACKATHON_ROUNDS,
  WEEKLY_HACKATHON_CONFIG,
  getHackathonRoundByStatus,
  getNextWeeklyAutoStart,
  type HackathonPartType,
  type HackathonRoundId,
  type HackathonSabotageType,
  type HackathonSkillKey,
  type HackathonStatus,
  type WinnerBoost,
} from "../shared/weekly-hackathon";

type PlayerSnapshot = {
  userId: string;
  username: string;
  skills: Partial<Record<HackathonSkillKey, number>>;
  level?: number;
  companyId?: string;
  membershipCreatedAt?: number | null;
  totalPvpBattles?: number;
  recentPvpBattles7d?: number;
};

type LockedParticipantSnapshot = {
  userId: string;
  username: string;
  companyId: string;
  lockedAt: number;
  membershipCreatedAt: number | null;
  level: number;
  totalPvpBattles: number;
  recentPvpBattles7d: number;
  skills: Partial<Record<HackathonSkillKey, number>>;
};

type HackathonParticipant = {
  userId: string;
  username: string;
  joinedAt: number;
};

type RegisteredCompany = {
  companyId: string;
  companyName: string;
  city: string;
  level: number;
  rndLevel: number;
  companyEmoji?: string | null;
  startedByUserId?: string | null;
  registeredAt: number;
  participants: HackathonParticipant[];
};

type PlayerContributionStats = {
  userId: string;
  companyId: string;
  username: string;
  totalContribution: number;
  byRound: Record<HackathonRoundId, number>;
};

type RoundResult = {
  roundId: HackathonRoundId;
  rankings: Array<{
    place: number;
    companyId: string;
    companyName: string;
    score: number;
  }>;
};

type WeeklyHackathonAnnouncement = {
  id: string;
  text: string;
  winnerCompanyId?: string;
  targetCompanyId?: string;
  joinCompanyId?: string;
};

type RewardApplicationState = {
  appliedAt: number | null;
};

type WeeklyHackathonState = {
  eventId: string | null;
  status: HackathonStatus;
  registrationEndsAt: number | null;
  rosterLockedAt: number | null;
  roundStartAt: number | null;
  roundEndAt: number | null;
  finalizedAt: number | null;
  currentRound: HackathonRoundId | null;
  roundScores: Record<HackathonRoundId, Map<string, number>>;
  roundResults: RoundResult[];
  totalTournamentPoints: Map<string, number>;
  totalRawScores: Map<string, number>;
  playerContribution: Map<string, PlayerContributionStats>;
  registeredCompanies: Map<string, RegisteredCompany>;
  participantSnapshots: Map<string, LockedParticipantSnapshot>;
  userCompanyParticipation: Map<string, string>;
  winners: Array<{ companyId: string; companyName: string; tournamentPoints: number; rawScore: number }>;
  mvpPlayerId: string | null;
  announcementQueue: WeeklyHackathonAnnouncement[];
  nextAutoStartAt: number;
  rewards: RewardApplicationState;
  winnerBoostByCompanyId: Map<string, WinnerBoost & { expiresAt: number }>;
};

const EMPTY_BY_ROUND = (): Record<HackathonRoundId, number> => ({
  concept: 0,
  prototype: 0,
  pitch: 0,
});

const state: WeeklyHackathonState = {
  eventId: null,
  status: "idle",
  registrationEndsAt: null,
  rosterLockedAt: null,
  roundStartAt: null,
  roundEndAt: null,
  finalizedAt: null,
  currentRound: null,
  roundScores: {
    concept: new Map(),
    prototype: new Map(),
    pitch: new Map(),
  },
  roundResults: [],
  totalTournamentPoints: new Map(),
  totalRawScores: new Map(),
  playerContribution: new Map(),
  registeredCompanies: new Map(),
  participantSnapshots: new Map(),
  userCompanyParticipation: new Map(),
  winners: [],
  mvpPlayerId: null,
  announcementQueue: [],
  nextAutoStartAt: getNextWeeklyAutoStart(Date.now()),
  rewards: { appliedAt: null },
  winnerBoostByCompanyId: new Map(),
};

let schedulerTimer: NodeJS.Timeout | null = null;

function roundToTwo(value: number) {
  return Number(value.toFixed(2));
}

function getCurrentRoundDefinition() {
  return state.currentRound ? HACKATHON_ROUNDS.find((round) => round.id === state.currentRound) ?? null : null;
}

function getCompanyParticipantCount(companyId: string) {
  return state.registeredCompanies.get(companyId)?.participants.length ?? 0;
}

function getRegisteredCompany(companyId: string) {
  const company = state.registeredCompanies.get(companyId);
  if (!company) throw new Error("Компания не зарегистрирована в weekly hackathon");
  return company;
}

function sortCompaniesForOverall() {
  return Array.from(state.registeredCompanies.values())
    .map((company) => ({
      companyId: company.companyId,
      companyName: company.companyName,
      tournamentPoints: Number(state.totalTournamentPoints.get(company.companyId) ?? 0),
      rawScore: roundToTwo(Number(state.totalRawScores.get(company.companyId) ?? 0)),
    }))
    .sort((a, b) => (b.tournamentPoints - a.tournamentPoints) || (b.rawScore - a.rawScore) || a.companyName.localeCompare(b.companyName, "ru"));
}

function sortCompaniesForRound(roundId: HackathonRoundId) {
  const roundMap = state.roundScores[roundId];
  return Array.from(state.registeredCompanies.values())
    .map((company) => ({
      companyId: company.companyId,
      companyName: company.companyName,
      score: roundToTwo(Number(roundMap.get(company.companyId) ?? 0)),
    }))
    .sort((a, b) => (b.score - a.score) || a.companyName.localeCompare(b.companyName, "ru"));
}

function buildRoundLeaderboard(limit = 10) {
  if (!state.currentRound) return [];
  return sortCompaniesForRound(state.currentRound).slice(0, Math.max(1, Math.min(50, limit)));
}

function ensurePlayerContribution(userId: string, companyId: string, username: string) {
  const current = state.playerContribution.get(userId);
  if (current) return current;
  const next: PlayerContributionStats = {
    userId,
    companyId,
    username,
    totalContribution: 0,
    byRound: EMPTY_BY_ROUND(),
  };
  state.playerContribution.set(userId, next);
  return next;
}

function buildTeamSynergyMultiplier(participantCount: number) {
  if (participantCount >= 5) return 1.1;
  if (participantCount === 4) return 1.08;
  if (participantCount === 3) return 1.06;
  if (participantCount === 2) return 1.03;
  return 1;
}

function randomMultiplier() {
  const min = WEEKLY_HACKATHON_CONFIG.randomMultiplierMin;
  const max = WEEKLY_HACKATHON_CONFIG.randomMultiplierMax;
  return min + Math.random() * (max - min);
}

function resetEventState(nowMs: number) {
  state.eventId = null;
  state.status = "idle";
  state.registrationEndsAt = null;
  state.rosterLockedAt = null;
  state.roundStartAt = null;
  state.roundEndAt = null;
  state.finalizedAt = nowMs;
  state.currentRound = null;
  state.roundScores = {
    concept: new Map(),
    prototype: new Map(),
    pitch: new Map(),
  };
  state.roundResults = [];
  state.totalTournamentPoints.clear();
  state.totalRawScores.clear();
  state.playerContribution.clear();
  state.registeredCompanies.clear();
  state.participantSnapshots.clear();
  state.userCompanyParticipation.clear();
  state.winners = [];
  state.mvpPlayerId = null;
  state.announcementQueue = [];
  state.rewards.appliedAt = null;
  state.winnerBoostByCompanyId.clear();
}

export function validateHackathonEligibility(input: {
  membershipCreatedAt?: number | null;
  level: number;
  totalPvpBattles: number;
  recentPvpBattles7d: number;
  nowMs?: number;
}) {
  const nowMs = Number(input.nowMs || Date.now());
  const membershipCreatedAt = Number(input.membershipCreatedAt || 0);
  const membershipDays = membershipCreatedAt > 0
    ? Math.max(0, Math.floor((nowMs - membershipCreatedAt * 1000) / (24 * 60 * 60 * 1000)))
    : Number.POSITIVE_INFINITY;
  const reasons: string[] = [];

  if (membershipDays < WEEKLY_HACKATHON_CONFIG.eligibility.minMembershipDays) {
    reasons.push(`Вы должны состоять в компании минимум ${WEEKLY_HACKATHON_CONFIG.eligibility.minMembershipDays} дней.`);
  }
  if (Number(input.level || 0) < WEEKLY_HACKATHON_CONFIG.eligibility.minLevel) {
    reasons.push(`Необходим минимум ${WEEKLY_HACKATHON_CONFIG.eligibility.minLevel} уровень.`);
  }
  if (
    Number(input.totalPvpBattles || 0) < WEEKLY_HACKATHON_CONFIG.eligibility.minTotalPvpBattles
    || Number(input.recentPvpBattles7d || 0) < WEEKLY_HACKATHON_CONFIG.eligibility.minRecentPvpBattles7d
  ) {
    reasons.push(
      `Недостаточно PvP-активности (минимум ${WEEKLY_HACKATHON_CONFIG.eligibility.minTotalPvpBattles} боёв за всё время и ${WEEKLY_HACKATHON_CONFIG.eligibility.minRecentPvpBattles7d} за последние 7 дней).`,
    );
  }

  return {
    ok: reasons.length === 0,
    reasons,
    membershipDays: Number.isFinite(membershipDays) ? membershipDays : null,
    level: Number(input.level || 0),
    totalPvpBattles: Number(input.totalPvpBattles || 0),
    recentPvpBattles7d: Number(input.recentPvpBattles7d || 0),
  };
}

function getCompanyStatusBadge(place: number) {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return "•";
}

function buildParticipantRosterText(company: RegisteredCompany, snapshots: PlayerSnapshot[], roundId: HackathonRoundId) {
  const round = HACKATHON_ROUNDS.find((entry) => entry.id === roundId);
  const lines = [
    "🏁 Хакатон начался!",
    `🏢 ${company.companyName}`,
    "",
    "Участники:",
  ];
  snapshots.forEach((snapshot, index) => {
    const coding = Number(snapshot.skills.coding || 0);
    const testing = Number(snapshot.skills.testing || 0);
    const design = Number(snapshot.skills.design || 0);
    const analytics = Number(snapshot.skills.analytics || 0);
    if (roundId === "concept") {
      lines.push(`${index + 1}. ${snapshot.username} — Дизайн ${design} / Аналитика ${analytics}`);
    } else if (roundId === "prototype") {
      lines.push(`${index + 1}. ${snapshot.username} — Кодинг ${coding} / Тестирование ${testing}`);
    } else {
      lines.push(`${index + 1}. ${snapshot.username} — Кодинг ${coding} / Тестирование ${testing} / Дизайн ${design} / Аналитика ${analytics}`);
    }
  });
  lines.push("");
  lines.push(`${round?.emoji ?? "🏁"} Первый этап: ${round?.title ?? roundId}`);
  return lines.join("\n");
}

function queueAnnouncement(entry: WeeklyHackathonAnnouncement) {
  state.announcementQueue.push(entry);
}

function getEventSummaryText() {
  const top = sortCompaniesForOverall().slice(0, 3);
  const mvp = state.mvpPlayerId ? state.playerContribution.get(state.mvpPlayerId) ?? null : null;
  const lines = [
    "🏆 РЕЗУЛЬТАТ ХАКАТОНА",
    "",
    ...(top.length
      ? top.map((row, index) => `${getCompanyStatusBadge(index + 1)} ${index + 1} место: ${row.companyName}`)
      : ["Участников не было."]),
    "",
    "Очки:",
    ...(top.length
      ? top.map((row) => `${row.companyName} — ${row.tournamentPoints} очк. • сырой счёт ${roundToTwo(row.rawScore)}`)
      : ["Нет данных"]),
  ];
  if (mvp) {
    lines.push("");
    lines.push("🎯 MVP ХАКАТОНА");
    lines.push(`${mvp.username} (${getRegisteredCompany(mvp.companyId).companyName})`);
    lines.push("");
    lines.push(`🎨 Концепт: ${roundToTwo(mvp.byRound.concept)}`);
    lines.push(`💻 Прототип: ${roundToTwo(mvp.byRound.prototype)}`);
    lines.push(`🚀 Питч: ${roundToTwo(mvp.byRound.pitch)}`);
    lines.push(`Всего: ${roundToTwo(mvp.totalContribution)}`);
  }
  return lines.join("\n");
}

function assignWinnerBoosts(nowMs: number) {
  state.winnerBoostByCompanyId.clear();
  const first = state.winners[0];
  if (first) {
    const duration = WEEKLY_HACKATHON_CONFIG.rewards.first.researchBuffDurationMs;
    state.winnerBoostByCompanyId.set(first.companyId, {
      id: "hackathon_first_place_research",
      title: "Hackathon Winner Boost",
      description: "+10% к скорости разработки на 24 часа",
      researchSpeedMultiplier: 1.1,
      expiresAt: nowMs + duration,
    });
  }
  const second = state.winners[1];
  if (second) {
    const duration = WEEKLY_HACKATHON_CONFIG.rewards.second.researchBuffDurationMs;
    state.winnerBoostByCompanyId.set(second.companyId, {
      id: "hackathon_second_place_research",
      title: "Hackathon Finalist Boost",
      description: "+5% к скорости разработки на 12 часов",
      researchSpeedMultiplier: 1.05,
      expiresAt: nowMs + duration,
    });
  }
}

function finalizeCurrentRound(nowMs: number) {
  const roundId = state.currentRound;
  if (!roundId) return;
  const round = HACKATHON_ROUNDS.find((entry) => entry.id === roundId);
  const rankings = sortCompaniesForRound(roundId).map((row, index) => ({
    place: index + 1,
    companyId: row.companyId,
    companyName: row.companyName,
    score: row.score,
  }));
  state.roundResults.push({ roundId, rankings });

  rankings.slice(0, 3).forEach((row, index) => {
    const current = Number(state.totalTournamentPoints.get(row.companyId) ?? 0);
    state.totalTournamentPoints.set(row.companyId, current + Number(WEEKLY_HACKATHON_CONFIG.tournamentPointsByPlace[index] || 0));
  });

  queueAnnouncement({
    id: `round-end:${state.eventId}:${roundId}:${nowMs}`,
    text: [
      `${round?.emoji ?? "🏁"} ${round?.title ?? roundId} завершён!`,
      "",
      ...rankings.slice(0, 3).map((row) => `${getCompanyStatusBadge(row.place)} ${row.place} место: ${row.companyName} — ${roundToTwo(row.score)}`),
    ].join("\n"),
  });
}

function startRound(roundId: HackathonRoundId, nowMs: number) {
  const round = HACKATHON_ROUNDS.find((entry) => entry.id === roundId);
  if (!round) return;
  state.currentRound = roundId;
  state.status = round.status;
  state.roundStartAt = nowMs;
  state.roundEndAt = nowMs + WEEKLY_HACKATHON_CONFIG.roundDurationMs;
  queueAnnouncement({
    id: `round-start:${state.eventId}:${roundId}:${nowMs}`,
    text: [
      "🏁 Хакатон недели",
      "",
      `${round.emoji} ${round.title}`,
      `Этап начался. До завершения: ${Math.floor(WEEKLY_HACKATHON_CONFIG.roundDurationMs / 1000)} сек.`,
    ].join("\n"),
  });
}

function finalizeHackathon(nowMs: number = Date.now()) {
  state.status = "finished";
  state.finalizedAt = nowMs;
  state.roundStartAt = null;
  state.roundEndAt = null;
  state.currentRound = null;
  state.winners = sortCompaniesForOverall().slice(0, 3);

  let best: PlayerContributionStats | null = null;
  for (const contribution of state.playerContribution.values()) {
    if (!best || contribution.totalContribution > best.totalContribution) {
      best = contribution;
    }
  }
  state.mvpPlayerId = best?.userId ?? null;
  assignWinnerBoosts(nowMs);
  queueAnnouncement({
    id: `finished:${state.eventId}:${nowMs}`,
    text: getEventSummaryText(),
    winnerCompanyId: state.winners[0]?.companyId,
  });
  return getWeeklyHackathonState();
}

async function buildRoundRosterAnnouncements(_resolvePlayerSnapshot: ((userId: string) => Promise<PlayerSnapshot | null>) | undefined) {
  if (!state.currentRound) return;
  for (const company of state.registeredCompanies.values()) {
    const snapshots = company.participants
      .slice(0, WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany)
      .map((participant) => state.participantSnapshots.get(participant.userId))
      .filter(Boolean) as LockedParticipantSnapshot[];
    queueAnnouncement({
      id: `roster:${state.eventId}:${company.companyId}:${state.currentRound}`,
      text: buildParticipantRosterText(company, snapshots, state.currentRound),
      targetCompanyId: company.companyId,
    });
  }
}

async function lockRegisteredParticipants(resolvePlayerSnapshot: ((userId: string) => Promise<PlayerSnapshot | null>) | undefined, nowMs: number) {
  if (state.rosterLockedAt) return;
  for (const company of state.registeredCompanies.values()) {
    const activeParticipants = company.participants.slice(0, WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany);
    for (const participant of activeParticipants) {
      const liveSnapshot = await resolvePlayerSnapshot?.(participant.userId);
      const lockedSnapshot: LockedParticipantSnapshot = {
        userId: participant.userId,
        username: String(liveSnapshot?.username || participant.username || "Игрок"),
        companyId: company.companyId,
        lockedAt: nowMs,
        membershipCreatedAt: Number(liveSnapshot?.membershipCreatedAt || 0) || null,
        level: Math.max(1, Number(liveSnapshot?.level || 1)),
        totalPvpBattles: Math.max(0, Number(liveSnapshot?.totalPvpBattles || 0)),
        recentPvpBattles7d: Math.max(0, Number(liveSnapshot?.recentPvpBattles7d || 0)),
        skills: { ...(liveSnapshot?.skills ?? {}) },
      };
      state.participantSnapshots.set(participant.userId, lockedSnapshot);
    }
  }
  state.rosterLockedAt = nowMs;
}

async function applyRoundTick(_resolvePlayerSnapshot: ((userId: string) => Promise<PlayerSnapshot | null>) | undefined) {
  if (!state.currentRound) return;
  const round = getCurrentRoundDefinition();
  if (!round) return;

  for (const company of state.registeredCompanies.values()) {
    const activeParticipants = company.participants.slice(0, WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany);
    const synergy = buildTeamSynergyMultiplier(activeParticipants.length);
    let companyTick = 0;

    for (const participant of activeParticipants) {
      const snapshot = state.participantSnapshots.get(participant.userId);
      if (!snapshot) continue;
      const stats = snapshot.skills ?? {};
      let contribution = 0;
      for (const skill of round.skills) {
        const value = Math.max(0, Number(stats[skill] || 0));
        if (skill === "attention" && round.attentionWeight) {
          contribution += value * round.attentionWeight;
        } else {
          contribution += value;
        }
      }
      if (contribution <= 0) continue;
      const playerStats = ensurePlayerContribution(participant.userId, company.companyId, snapshot.username || participant.username);
      const roundedContribution = roundToTwo(contribution);
      playerStats.totalContribution = roundToTwo(playerStats.totalContribution + roundedContribution);
      playerStats.byRound[round.id] = roundToTwo((playerStats.byRound[round.id] ?? 0) + roundedContribution);
      companyTick += contribution;
    }

    if (companyTick <= 0) continue;
    const finalTick = roundToTwo(companyTick * synergy * randomMultiplier());
    const currentRoundScore = Number(state.roundScores[round.id].get(company.companyId) ?? 0);
    const nextRoundScore = roundToTwo(currentRoundScore + finalTick);
    state.roundScores[round.id].set(company.companyId, nextRoundScore);
    state.totalRawScores.set(company.companyId, roundToTwo(Number(state.totalRawScores.get(company.companyId) ?? 0) + finalTick));
  }
}

export function getWeeklyHackathonState() {
  const overallLeaderboard = sortCompaniesForOverall().map((row, index) => ({
    place: index + 1,
    ...row,
    city: state.registeredCompanies.get(row.companyId)?.city ?? "",
    score: row.rawScore,
  }));
  return {
    eventId: state.eventId,
    status: state.status,
    registrationEndsAt: state.registrationEndsAt,
    rosterLockedAt: state.rosterLockedAt,
    roundStartAt: state.roundStartAt,
    roundEndAt: state.roundEndAt,
    finalizedAt: state.finalizedAt,
    currentRound: state.currentRound,
    registeredCompanies: Array.from(state.registeredCompanies.values()).map((company) => ({
      companyId: company.companyId,
      companyName: company.companyName,
      companyEmoji: company.companyEmoji ?? null,
      city: company.city,
      level: company.level,
      participantCount: company.participants.length,
      participants: company.participants.map((participant) => ({
        userId: participant.userId,
        username: participant.username,
        joinedAt: participant.joinedAt,
        locked: state.participantSnapshots.has(participant.userId),
      })),
    })),
    currentRoundLeaderboard: buildRoundLeaderboard(20).map((row, index) => ({
      place: index + 1,
      companyId: row.companyId,
      companyName: row.companyName,
      score: row.score,
    })),
    overallLeaderboard,
    leaderboard: overallLeaderboard,
    roundResults: state.roundResults,
    winners: state.winners,
    mvpPlayerId: state.mvpPlayerId,
    mvp: state.mvpPlayerId ? state.playerContribution.get(state.mvpPlayerId) ?? null : null,
    nextAutoStartAt: state.nextAutoStartAt,
    rewardsAppliedAt: state.rewards.appliedAt,
  };
}

export function startWeeklyHackathon(nowMs: number = Date.now(), source: "manual" | "auto" = "manual") {
  resetEventState(nowMs);
  state.eventId = `hackathon-${nowMs}`;
  state.status = "registration";
  state.registrationEndsAt = nowMs + WEEKLY_HACKATHON_CONFIG.registrationWindowMs;
  if (source === "auto") {
    state.nextAutoStartAt = getNextWeeklyAutoStart(nowMs + 60_000);
  }
  queueAnnouncement({
    id: `registration:${state.eventId}`,
    text: [
      "🏁 Weekly Hackathon стартовал!",
      `Регистрация компаний открыта на ${Math.floor(WEEKLY_HACKATHON_CONFIG.registrationWindowMs / 1000)} сек.`,
      "",
      "CEO может зарегистрировать компанию через /hackathon_join.",
    ].join("\n"),
  });
  return getWeeklyHackathonState();
}

export function endWeeklyHackathon(nowMs: number = Date.now()) {
  if (state.status === "idle" || state.status === "finished") {
    throw new Error("Нет активного weekly hackathon");
  }
  return finalizeHackathon(nowMs);
}

export function resetWeeklyHackathon(nowMs: number = Date.now()) {
  resetEventState(nowMs);
  queueAnnouncement({
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
  companyEmoji?: string | null;
  startedByUserId?: string | null;
  securityLevel?: number;
}) {
  if (state.status !== "registration") {
    throw new Error("Регистрация в weekly hackathon сейчас закрыта");
  }
  if (state.registeredCompanies.has(input.companyId)) {
    throw new Error("Компания уже зарегистрирована в weekly hackathon");
  }
  const company: RegisteredCompany = {
    companyId: input.companyId,
    companyName: input.companyName,
    city: input.city,
    level: Math.max(1, Math.floor(input.companyLevel || 1)),
    rndLevel: Math.max(0, Math.floor(input.rndLevel || 0)),
    companyEmoji: input.companyEmoji ?? null,
    startedByUserId: input.startedByUserId ?? null,
    registeredAt: Date.now(),
    participants: [],
  };
  state.registeredCompanies.set(company.companyId, company);
  state.totalTournamentPoints.set(company.companyId, 0);
  state.totalRawScores.set(company.companyId, 0);
  return {
    companyId: company.companyId,
    companyName: company.companyName,
    city: company.city,
    participantCount: 0,
  };
}

export function joinPlayerToWeeklyHackathonTeam(input: {
  userId: string;
  username: string;
  companyId: string;
}) {
  if (state.status !== "registration") {
    throw new Error("Набор участников уже закрыт");
  }
  const company = getRegisteredCompany(input.companyId);
  const existingCompanyId = state.userCompanyParticipation.get(input.userId);
  if (existingCompanyId && existingCompanyId !== input.companyId) {
    throw new Error("Игрок уже записан за другую компанию");
  }
  if (company.participants.some((participant) => participant.userId === input.userId)) {
    throw new Error("Игрок уже записан в состав компании");
  }
  if (company.participants.length >= WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany) {
    throw new Error("Все места в составе уже заняты");
  }
  const participant: HackathonParticipant = {
    userId: input.userId,
    username: input.username,
    joinedAt: Date.now(),
  };
  company.participants.push(participant);
  state.userCompanyParticipation.set(input.userId, input.companyId);
  state.registeredCompanies.set(company.companyId, company);
  return {
    companyId: company.companyId,
    participantCount: company.participants.length,
    slotsLeft: Math.max(0, WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany - company.participants.length),
    closed: company.participants.length >= WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany,
  };
}

export function formatWeeklyHackathonTop(limit: number = 10) {
  return sortCompaniesForOverall()
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map((row, index) => ({
      place: index + 1,
      companyId: row.companyId,
      companyName: row.companyName,
      city: state.registeredCompanies.get(row.companyId)?.city ?? "",
      score: row.rawScore,
      tournamentPoints: row.tournamentPoints,
    }));
}

export function getWeeklyHackathonPlayerStats(userId: string, _companyId: string) {
  return state.playerContribution.get(userId) ?? null;
}

export function getWeeklyHackathonCompanyScore(companyId: string) {
  const company = state.registeredCompanies.get(companyId);
  if (!company) return null;
  return {
    companyId,
    companyName: company.companyName,
    participantCount: getCompanyParticipantCount(companyId),
    tournamentPoints: Number(state.totalTournamentPoints.get(companyId) ?? 0),
    rawScore: roundToTwo(Number(state.totalRawScores.get(companyId) ?? 0)),
    currentRoundScore: state.currentRound ? roundToTwo(Number(state.roundScores[state.currentRound].get(companyId) ?? 0)) : 0,
    securityLevel: 1,
  };
}

export function getWeeklyHackathonSabotageState(_companyId?: string) {
  return {
    maxPerCompanyPerEvent: 0,
    maxPerUserPerEvent: 0,
    usedByCompany: 0,
    companyDebuffs: null,
    pendingPoachOffers: [],
  };
}

export function getPendingPoachOffersForUser(_userId: string) {
  return [];
}

export function setHackathonCompanySecurityLevel(_companyId: string, level: number) {
  return Math.max(1, Math.min(3, Math.floor(level || 1)));
}

export function launchWeeklyHackathonSabotage(_input: {
  initiatorUserId: string;
  initiatorRole: string;
  attackerCompanyId: string;
  targetCompanyId: string;
  sabotageType: HackathonSabotageType;
  targetUserId?: string;
  defenseMultiplier?: number;
}): {
  eventId: string;
  attackerCompanyId: string;
  attackerCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  initiatorUserId: string;
  targetUserId: string | null;
  sabotageType: HackathonSabotageType;
  status: string;
  success: boolean | null;
  detected: boolean;
  scoreDeltaAttacker: number;
  scoreDeltaTarget: number;
  details: Record<string, unknown>;
} {
  throw new Error("Саботаж отключён в новом формате weekly hackathon");
}

export function resolveHackathonPoachOffer(_input: { offerId: string; userId: string; accept: boolean }): {
  targetScoreDelta: number;
} {
  throw new Error("Talent poaching отключён в новом формате weekly hackathon");
}

export function contributeSkillToWeeklyHackathon(_input: {
  userId: string;
  companyId: string;
  skills: Partial<Record<HackathonSkillKey, number>>;
  multiplier?: number;
  fixedRandomBonus?: number;
}): { contribution: number; score: number } {
  throw new Error("Старая система личных вкладов в weekly hackathon отключена");
}

export function contributePartToWeeklyHackathon(_input: {
  userId: string;
  companyId: string;
  partType: HackathonPartType;
  rarity: string;
  quantity: number;
  multiplier?: number;
}): { contribution: number; score: number } {
  throw new Error("Старая система вкладов деталями в weekly hackathon отключена");
}

export function contributeGrmToWeeklyHackathon(_input: {
  userId: string;
  companyId: string;
  amount: number;
}): { contribution: number; score: number } {
  throw new Error("Старая система вкладов GRM в weekly hackathon отключена");
}

export function popWeeklyHackathonAnnouncements() {
  const queue = state.announcementQueue.slice();
  state.announcementQueue = [];
  return queue;
}

export function getWinnerBoostForCompany(companyId: string) {
  const boost = state.winnerBoostByCompanyId.get(companyId);
  if (!boost) return null;
  if (Date.now() > boost.expiresAt) {
    state.winnerBoostByCompanyId.delete(companyId);
    return null;
  }
  return boost;
}

export async function applyWinnerRewardsToCompanies(updateCompanyBalance: (companyId: string, addGrm: number) => Promise<void>) {
  for (const winner of state.winners.slice(0, 3)) {
    const place = state.winners.findIndex((row) => row.companyId === winner.companyId) + 1;
    if (place === 1) {
      await updateCompanyBalance(winner.companyId, WEEKLY_HACKATHON_CONFIG.rewards.first.companyGrm);
    } else if (place === 2) {
      await updateCompanyBalance(winner.companyId, WEEKLY_HACKATHON_CONFIG.rewards.second.companyGrm);
    } else if (place === 3) {
      await updateCompanyBalance(winner.companyId, WEEKLY_HACKATHON_CONFIG.rewards.third.companyGrm);
    }
  }
}

export async function applyWeeklyHackathonRewards(input: {
  updateCompanyBalance: (companyId: string, addGrm: number) => Promise<void>;
  addCompanyPart: (companyId: string, quality: "Common" | "Uncommon" | "Rare" | "Epic") => Promise<void>;
  updatePlayerGramBalance: (userId: string, addGrm: number) => Promise<void>;
  addPlayerPart: (userId: string, quality: "Common" | "Uncommon" | "Rare" | "Epic") => Promise<void>;
}) {
  if (state.status !== "finished" || state.rewards.appliedAt) {
    return { applied: false, winners: state.winners, mvpPlayerId: state.mvpPlayerId };
  }

  for (const winner of state.winners.slice(0, 3)) {
    const place = state.winners.findIndex((row) => row.companyId === winner.companyId) + 1;
    if (place === 1) {
      await input.updateCompanyBalance(winner.companyId, WEEKLY_HACKATHON_CONFIG.rewards.first.companyGrm);
      for (let i = 0; i < WEEKLY_HACKATHON_CONFIG.rewards.first.rareParts; i += 1) {
        await input.addCompanyPart(winner.companyId, "Rare");
      }
      if (Math.random() < WEEKLY_HACKATHON_CONFIG.rewards.first.epicPartChance) {
        await input.addCompanyPart(winner.companyId, "Epic");
      }
    } else if (place === 2) {
      await input.updateCompanyBalance(winner.companyId, WEEKLY_HACKATHON_CONFIG.rewards.second.companyGrm);
      for (let i = 0; i < WEEKLY_HACKATHON_CONFIG.rewards.second.uncommonParts; i += 1) {
        await input.addCompanyPart(winner.companyId, "Uncommon");
      }
      for (let i = 0; i < WEEKLY_HACKATHON_CONFIG.rewards.second.rareParts; i += 1) {
        await input.addCompanyPart(winner.companyId, "Rare");
      }
    } else if (place === 3) {
      await input.updateCompanyBalance(winner.companyId, WEEKLY_HACKATHON_CONFIG.rewards.third.companyGrm);
      for (let i = 0; i < WEEKLY_HACKATHON_CONFIG.rewards.third.uncommonParts; i += 1) {
        await input.addCompanyPart(winner.companyId, "Uncommon");
      }
    }
  }

  for (const company of state.registeredCompanies.values()) {
    for (const participant of company.participants) {
      const addGrm = WEEKLY_HACKATHON_CONFIG.rewards.participant.minGrm
        + Math.floor(Math.random() * (WEEKLY_HACKATHON_CONFIG.rewards.participant.maxGrm - WEEKLY_HACKATHON_CONFIG.rewards.participant.minGrm + 1));
      await input.updatePlayerGramBalance(participant.userId, addGrm);
      const quality = Math.random() < 0.35 ? "Uncommon" : "Common";
      await input.addPlayerPart(participant.userId, quality);
    }
  }

  if (state.mvpPlayerId) {
    await input.updatePlayerGramBalance(state.mvpPlayerId, WEEKLY_HACKATHON_CONFIG.rewards.mvp.grm);
  }

  state.rewards.appliedAt = Date.now();
  return { applied: true, winners: state.winners, mvpPlayerId: state.mvpPlayerId };
}

export function getHackathonRoundView() {
  if (!state.currentRound) return null;
  return {
    currentRound: state.currentRound,
    roundStartAt: state.roundStartAt,
    roundEndAt: state.roundEndAt,
    leaderboard: buildRoundLeaderboard(20),
  };
}

export function startWeeklyHackathonScheduler(options: {
  resolvePlayerSnapshot?: (userId: string) => Promise<PlayerSnapshot | null>;
  onAutoEnd?: () => Promise<void> | void;
  onAutoStart?: () => Promise<void> | void;
}) {
  if (schedulerTimer) return;
  const tick = async () => {
    const now = Date.now();
    try {
      if ((state.status === "idle" || state.status === "finished") && now >= state.nextAutoStartAt) {
        startWeeklyHackathon(now, "auto");
        await options.onAutoStart?.();
      } else if (state.status === "registration" && state.registrationEndsAt && now >= state.registrationEndsAt) {
        await lockRegisteredParticipants(options.resolvePlayerSnapshot, now);
        startRound("concept", now);
        await buildRoundRosterAnnouncements(options.resolvePlayerSnapshot);
      } else if (state.status === "round1" || state.status === "round2" || state.status === "round3") {
        await applyRoundTick(options.resolvePlayerSnapshot);
        if (state.roundEndAt && now >= state.roundEndAt) {
          const currentRound = state.currentRound;
          finalizeCurrentRound(now);
          if (currentRound === "concept") {
            startRound("prototype", now);
          } else if (currentRound === "prototype") {
            startRound("pitch", now);
          } else {
            finalizeHackathon(now);
            await options.onAutoEnd?.();
          }
          if (currentRound !== "pitch") {
            await buildRoundRosterAnnouncements(options.resolvePlayerSnapshot);
          }
        }
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

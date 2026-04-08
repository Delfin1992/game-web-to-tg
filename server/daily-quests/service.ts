import { randomUUID } from "crypto";
import { RARITY_LEVELS, rollRandomPartDrop, type PartQuality } from "../../client/src/lib/parts";
import type { GameInventoryItem } from "../game-engine";
import { createTutorialMedalItem, grantInventoryItemToPlayer } from "../game-engine";
import { createNotification, markNotificationClaimedByClaimKind } from "../notifications/service";
import type { User } from "../../shared/schema";
import { registerRuntimeSnapshotProvider, storage } from "../storage";
import {
  DAILY_QUEST_DEFINITIONS,
  DAILY_QUESTS_PER_DAY,
  type DailyQuestCategory,
  type DailyQuestDefinition,
  type DailyQuestEventType,
  type DailyQuestReward,
} from "./definitions";
import { formatDailyQuestCompletionNotice } from "./format";

export type DailyQuestRecord = {
  id: string;
  userId: string;
  definitionId: string;
  category: DailyQuestCategory;
  periodKey: string;
  title: string;
  description: string;
  eventType: DailyQuestEventType;
  progress: number;
  target: number;
  reward: DailyQuestReward;
  isCompleted: boolean;
  isClaimed: boolean;
  createdAt: number;
  updatedAt: number;
  claimedAt: number | null;
};

export type DailyQuestView = DailyQuestRecord;

export type DailyQuestSnapshot = {
  periodKey: string;
  serverTime: number;
  nextResetAt: number;
  nextResetAtLabel: string;
  completedUnclaimedCount: number;
  quests: DailyQuestView[];
};

export type DailyQuestTrackEvent = {
  type: DailyQuestEventType;
  value?: number;
};

export type DailyQuestTrackResult = {
  periodKey: string;
  notices: string[];
  completedQuestIds: string[];
  quests: DailyQuestRecord[];
};

type DailyQuestStoreSnapshot = Array<[string, DailyQuestRecord[]]>;

type DailyQuestDeps = {
  applyGameStatePatch?: (userId: string, payload: Record<string, unknown>) => void;
  getUserWithGameState?: (userId: string) => Promise<any | null>;
};

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const dailyQuestsByUserId = new Map<string, DailyQuestRecord[]>();

function getMoscowDayParts(nowMs: number) {
  const shifted = new Date(nowMs + MOSCOW_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    day: String(shifted.getUTCDate()).padStart(2, "0"),
  };
}

export function getDailyQuestPeriodKey(nowMs: number = Date.now()) {
  const { year, month, day } = getMoscowDayParts(nowMs);
  return `${year}-${month}-${day}`;
}

export function getNextDailyQuestResetAt(nowMs: number = Date.now()) {
  const shifted = new Date(nowMs + MOSCOW_OFFSET_MS);
  shifted.setUTCHours(24, 0, 0, 0);
  return shifted.getTime() - MOSCOW_OFFSET_MS;
}

function formatResetLabel(nextResetAt: number) {
  return new Date(nextResetAt).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function applyExperience(user: User, gain: number) {
  let level = Number(user.level || 1);
  let experience = Number(user.experience || 0) + Math.max(0, Math.floor(gain));
  while (experience >= 100) {
    level += 1;
    experience -= 100;
  }
  return { level, experience };
}

function getUserQuestBucket(userId: string) {
  const existing = dailyQuestsByUserId.get(userId);
  if (existing) return existing;
  const created: DailyQuestRecord[] = [];
  dailyQuestsByUserId.set(userId, created);
  return created;
}

function getEligibleDefinitions(user: User) {
  return DAILY_QUEST_DEFINITIONS.filter((definition) => {
    if (!definition.enabled) return false;
    if (definition.minLevel && Number(user.level || 1) < definition.minLevel) return false;
    if (definition.isEligible && !definition.isEligible(user)) return false;
    return true;
  });
}

function pickWeightedDefinition(pool: DailyQuestDefinition[]) {
  const total = pool.reduce((sum, item) => sum + Math.max(1, Number(item.weight || 1)), 0);
  let cursor = Math.random() * Math.max(1, total);
  for (const item of pool) {
    cursor -= Math.max(1, Number(item.weight || 1));
    if (cursor <= 0) return item;
  }
  return pool[pool.length - 1] ?? null;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function getPreviousDayDefinitionIds(userId: string, periodKey: string) {
  const bucket = getUserQuestBucket(userId);
  const periods = Array.from(
    new Set(
      bucket
        .map((quest) => quest.periodKey)
        .filter((value) => value && value !== periodKey),
    ),
  ).sort();
  const previousPeriod = periods.at(-1);
  if (!previousPeriod) return new Set<string>();
  return new Set(
    bucket
      .filter((quest) => quest.periodKey === previousPeriod)
      .map((quest) => quest.definitionId),
  );
}

function buildQuestMix(pool: DailyQuestDefinition[], limit: number) {
  const picked: DailyQuestDefinition[] = [];
  const chosenIds = new Set<string>();
  const categoryPool = new Map<DailyQuestCategory, DailyQuestDefinition[]>();

  for (const item of pool) {
    const bucket = categoryPool.get(item.category) ?? [];
    bucket.push(item);
    categoryPool.set(item.category, bucket);
  }

  for (const category of shuffle(Array.from(categoryPool.keys()))) {
    if (picked.length >= limit) break;
    const next = pickWeightedDefinition(categoryPool.get(category) ?? []);
    if (!next || chosenIds.has(next.id)) continue;
    picked.push(next);
    chosenIds.add(next.id);
  }

  const remaining = pool.filter((item) => !chosenIds.has(item.id));
  while (picked.length < limit && remaining.length > 0) {
    const next = pickWeightedDefinition(remaining);
    if (!next) break;
    picked.push(next);
    chosenIds.add(next.id);
    const index = remaining.findIndex((item) => item.id === next.id);
    if (index >= 0) remaining.splice(index, 1);
  }

  return picked;
}

function maybeAddSmallBonus(reward: DailyQuestReward) {
  if (Math.random() < 0.35) {
    reward.reputation = Math.max(0, Number(reward.reputation || 0)) + (3 + Math.floor(Math.random() * 4));
  }
  return reward;
}

function createRewardPart() {
  const part = rollRandomPartDrop(100, {
    allowedQualities: ["Common", "Uncommon", "Rare"] as PartQuality[],
  });
  if (!part) return null;
  const icon = RARITY_LEVELS[part.rarity]?.icon ?? "";
  return {
    itemId: part.id,
    itemName: icon ? `${icon} ${part.name}` : part.name,
    itemType: "part" as const,
    itemQuantity: 1,
    itemRarity: part.rarity,
    itemStats: { ...(part.stats as Record<string, number>) },
  };
}

function createRewardTrophy() {
  return {
    itemId: "daily-trophy",
    itemName: "🏆 Трофей дня",
    itemType: "trophy" as const,
    itemQuantity: 1,
    itemRarity: "Epic",
    itemStats: {},
  };
}

function rollDailyQuestReward(definition: DailyQuestDefinition, user: User): DailyQuestReward {
  type RewardBucketKey = "money" | "xp" | "workEnergy" | "studyEnergy" | "gram" | "part" | "trophy";
  type RewardBucketEntry = { key: RewardBucketKey; weight: number };
  const level = Math.max(1, Number(user.level || 1));
  const questTarget = Math.max(1, Number(definition.target || 1));
  const rewardTier = Math.max(1, Math.min(4, Math.floor((level - 1) / 5) + 1));
  const moneyBase = 120 + rewardTier * 30 + questTarget * 25;
  const xpBase = 35 + rewardTier * 12 + questTarget * 8;

  const categoryPoolByCategory: Record<DailyQuestCategory, RewardBucketEntry[]> = {
    pvp: [
      { key: "xp", weight: 24 },
      { key: "money", weight: 20 },
      { key: "gram", weight: 12 },
      { key: "part", weight: 20 },
      { key: "workEnergy", weight: 10 },
      { key: "trophy", weight: 4 },
    ],
    education: [
      { key: "xp", weight: 28 },
      { key: "studyEnergy", weight: 24 },
      { key: "money", weight: 12 },
      { key: "gram", weight: 10 },
      { key: "part", weight: 12 },
      { key: "trophy", weight: 2 },
    ],
    repair: [
      { key: "money", weight: 24 },
      { key: "part", weight: 24 },
      { key: "xp", weight: 16 },
      { key: "workEnergy", weight: 14 },
      { key: "gram", weight: 8 },
      { key: "trophy", weight: 2 },
    ],
    economy: [
      { key: "money", weight: 26 },
      { key: "gram", weight: 18 },
      { key: "xp", weight: 18 },
      { key: "workEnergy", weight: 8 },
      { key: "studyEnergy", weight: 8 },
      { key: "part", weight: 10 },
      { key: "trophy", weight: 2 },
    ],
    general: [
      { key: "money", weight: 24 },
      { key: "xp", weight: 22 },
      { key: "workEnergy", weight: 14 },
      { key: "studyEnergy", weight: 12 },
      { key: "gram", weight: 8 },
      { key: "part", weight: 12 },
      { key: "trophy", weight: 2 },
    ],
  };
  const categoryPool = categoryPoolByCategory[definition.category];

  const totalWeight = categoryPool.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  let selected = categoryPool[0]?.key ?? "money";
  for (const item of categoryPool) {
    cursor -= item.weight;
    if (cursor <= 0) {
      selected = item.key;
      break;
    }
  }

  const reward: DailyQuestReward = {};
  switch (selected) {
    case "xp":
      reward.xp = xpBase + Math.floor(Math.random() * 25);
      break;
    case "money":
      reward.money = moneyBase + Math.floor(Math.random() * 140);
      break;
    case "workEnergy":
      reward.workEnergy = 12 + Math.floor(Math.random() * 11);
      reward.money = Math.round(moneyBase * 0.45);
      break;
    case "studyEnergy":
      reward.studyEnergy = 12 + Math.floor(Math.random() * 11);
      reward.xp = Math.round(xpBase * 0.65);
      break;
    case "gram":
      reward.gram = 4 + rewardTier + Math.floor(Math.random() * 6);
      reward.money = Math.round(moneyBase * 0.35);
      break;
    case "part":
      Object.assign(reward, createRewardPart() ?? { money: moneyBase });
      reward.money = Math.round(moneyBase * 0.3);
      break;
    case "trophy":
      if (Math.random() < 0.75) {
        Object.assign(reward, createRewardTrophy());
      } else {
        Object.assign(reward, createRewardPart() ?? createRewardTrophy());
      }
      reward.xp = Math.round(xpBase * 0.75);
      reward.reputation = 8 + rewardTier;
      break;
    default:
      reward.money = moneyBase;
      break;
  }

  return maybeAddSmallBonus(reward);
}

function assignDailyQuestSet(user: User, periodKey: string) {
  const eligible = getEligibleDefinitions(user);
  const previousDayDefinitionIds = getPreviousDayDefinitionIds(user.id, periodKey);
  const preferred = eligible.filter((definition) => !previousDayDefinitionIds.has(definition.id));

  let picked = buildQuestMix(preferred, Math.min(DAILY_QUESTS_PER_DAY, eligible.length));
  if (picked.length < Math.min(DAILY_QUESTS_PER_DAY, eligible.length)) {
    const fallbackPool = eligible.filter((definition) => !picked.some((item) => item.id === definition.id));
    picked = [
      ...picked,
      ...buildQuestMix(fallbackPool, Math.min(DAILY_QUESTS_PER_DAY, eligible.length) - picked.length),
    ];
  }

  const now = Date.now();
  const records = picked.map((definition) => ({
    id: randomUUID(),
    userId: user.id,
    definitionId: definition.id,
    category: definition.category,
    periodKey,
    title: definition.title,
    description: definition.description,
    eventType: definition.eventType,
    progress: 0,
    target: definition.target,
    reward: rollDailyQuestReward(definition, user),
    isCompleted: false,
    isClaimed: false,
    createdAt: now,
    updatedAt: now,
    claimedAt: null,
  }));

  const bucket = getUserQuestBucket(user.id);
  const preserved = bucket.filter((quest) => quest.periodKey !== periodKey).slice(-30);
  dailyQuestsByUserId.set(user.id, [...preserved, ...records]);
  return records;
}

export async function ensureDailyQuests(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");

  const periodKey = getDailyQuestPeriodKey();
  const bucket = getUserQuestBucket(userId);
  const current = bucket.filter((quest) => quest.periodKey === periodKey);
  if (current.length > 0) return current;
  return assignDailyQuestSet(user, periodKey);
}

export async function getDailyQuestSnapshot(userId: string): Promise<DailyQuestSnapshot> {
  const quests = await ensureDailyQuests(userId);
  const now = Date.now();
  const nextResetAt = getNextDailyQuestResetAt(now);
  return {
    periodKey: getDailyQuestPeriodKey(now),
    serverTime: now,
    nextResetAt,
    nextResetAtLabel: formatResetLabel(nextResetAt),
    completedUnclaimedCount: quests.filter((quest) => quest.isCompleted && !quest.isClaimed).length,
    quests: quests
      .map((quest) => ({ ...quest }))
      .sort(
        (a, b) =>
          Number(a.isClaimed) - Number(b.isClaimed) ||
          Number(b.isCompleted) - Number(a.isCompleted) ||
          a.createdAt - b.createdAt,
      ),
  };
}

export async function trackDailyQuestEvent(userId: string, event: DailyQuestTrackEvent): Promise<DailyQuestTrackResult> {
  const quests = await ensureDailyQuests(userId);
  const safeValue = Math.max(0, Number(event.value ?? 1));
  const notices: string[] = [];
  const completedQuestIds: string[] = [];
  const now = Date.now();

  for (const quest of quests) {
    if (quest.eventType !== event.type || quest.isClaimed || quest.isCompleted) continue;
    if (safeValue <= 0) continue;

    const before = quest.progress;
    quest.progress = Math.min(quest.target, Number((quest.progress + safeValue).toFixed(3)));
    quest.updatedAt = now;

    if (before < quest.target && quest.progress >= quest.target) {
      quest.isCompleted = true;
      completedQuestIds.push(quest.id);
      notices.push(formatDailyQuestCompletionNotice(quest.title));

      createNotification(userId, {
        type: "DAILY_QUEST_COMPLETED",
        title: "🎯 Ежедневное задание выполнено",
        message: quest.title,
        dataJson: { questId: quest.id, definitionId: quest.definitionId },
      });

      createNotification(userId, {
        type: "DAILY_QUEST_REWARD_AVAILABLE",
        title: "🎁 Награда за задание доступна",
        message: `Задание «${quest.title}» завершено. Награду уже можно забрать.`,
        dataJson: { questId: quest.id, definitionId: quest.definitionId },
        reward: { ...quest.reward },
        isClaimable: true,
        claimKind: "daily_quest_reward",
      });
    }
  }

  return {
    periodKey: getDailyQuestPeriodKey(now),
    notices,
    completedQuestIds,
    quests: quests.map((quest) => ({ ...quest })),
  };
}

async function resolveGameStateDeps(deps: DailyQuestDeps) {
  if (deps.applyGameStatePatch && deps.getUserWithGameState) return deps;
  const { applyGameStatePatch, getUserWithGameState } = await import("../game-engine");
  return {
    applyGameStatePatch: deps.applyGameStatePatch ?? applyGameStatePatch,
    getUserWithGameState: deps.getUserWithGameState ?? getUserWithGameState,
  };
}

function buildRewardInventoryItem(reward: DailyQuestReward): GameInventoryItem | null {
  if (!reward.itemName || !reward.itemType) return null;
  if (reward.itemType === "trophy") {
    const base = createTutorialMedalItem();
    return {
      ...base,
      id: reward.itemId || "daily-trophy",
      name: reward.itemName,
      rarity: reward.itemRarity || "Epic",
      quantity: Math.max(1, Number(reward.itemQuantity || 1)),
      stats: { ...(reward.itemStats || {}) },
    };
  }

  return {
    id: reward.itemId || randomUUID(),
    name: reward.itemName,
    stats: { ...(reward.itemStats || {}) },
    rarity: reward.itemRarity || "Common",
    quantity: Math.max(1, Number(reward.itemQuantity || 1)),
    type: "part",
  };
}

export async function claimDailyQuestReward(userId: string, questId: string, deps: DailyQuestDeps = {}) {
  const quests = await ensureDailyQuests(userId);
  const quest = quests.find((item) => item.id === questId);
  if (!quest) throw new Error("Задание не найдено");
  if (quest.isClaimed) throw new Error("Награда по этому заданию уже получена");
  if (!quest.isCompleted) throw new Error("Задание ещё не выполнено");

  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");

  const reward = quest.reward || {};
  const expState = applyExperience(user, Number(reward.xp || 0));
  const updatedUser = await storage.updateUser(user.id, {
    balance: Number(user.balance || 0) + Math.max(0, Math.floor(Number(reward.money || 0))),
    reputation: Number(user.reputation || 0) + Math.max(0, Math.floor(Number(reward.reputation || 0))),
    level: expState.level,
    experience: expState.experience,
  });

  const gameStateDeps = await resolveGameStateDeps(deps);
  const snapshot = await gameStateDeps.getUserWithGameState?.(userId);
  if (snapshot && gameStateDeps.applyGameStatePatch) {
    const workEnergyReward = Number(reward.workEnergy || 0);
    const studyEnergyReward = Number(reward.studyEnergy || 0);
    const gramReward = Number(reward.gram || 0);
    const nextWorkTime = Math.min(1, Math.max(0, Number(snapshot.game?.workTime || 0)) + workEnergyReward / 100);
    const nextStudyTime = Math.min(1, Math.max(0, Number(snapshot.game?.studyTime || 0)) + studyEnergyReward / 100);
    const nextGram = Number((Math.max(0, Number(snapshot.game?.gramBalance || 0)) + gramReward).toFixed(3));
    gameStateDeps.applyGameStatePatch(userId, {
      workTime: Number(nextWorkTime.toFixed(4)),
      studyTime: Number(nextStudyTime.toFixed(4)),
      gramBalance: nextGram,
    });
  }

  const rewardItem = buildRewardInventoryItem(reward);
  if (rewardItem) {
    await grantInventoryItemToPlayer(userId, rewardItem);
  }

  quest.isClaimed = true;
  quest.claimedAt = Date.now();
  quest.updatedAt = quest.claimedAt;
  markNotificationClaimedByClaimKind(
    userId,
    "daily_quest_reward",
    (item) => String(item.dataJson?.questId || "") === quest.id,
  );

  return {
    quest: { ...quest },
    reward: { ...reward },
    user: updatedUser,
    snapshot: await getDailyQuestSnapshot(userId),
  };
}

registerRuntimeSnapshotProvider("daily-quests", {
  exportSnapshot: () =>
    Array.from(dailyQuestsByUserId.entries()).map(([userId, quests]) => [userId, quests]) as DailyQuestStoreSnapshot,
  importSnapshot: (snapshot) => {
    dailyQuestsByUserId.clear();
    if (!Array.isArray(snapshot)) return;
    for (const entry of snapshot) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const userId = String(entry[0] ?? "").trim();
      const rawQuests = Array.isArray(entry[1]) ? entry[1] : [];
      if (!userId) continue;
      const quests = rawQuests
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const source = item as Partial<DailyQuestRecord>;
          return {
            id: String(source.id || randomUUID()),
            userId,
            definitionId: String(source.definitionId || ""),
            category: String(source.category || "general") as DailyQuestCategory,
            periodKey: String(source.periodKey || ""),
            title: String(source.title || ""),
            description: String(source.description || ""),
            eventType: String(source.eventType || "complete_jobs") as DailyQuestEventType,
            progress: Math.max(0, Number(source.progress || 0)),
            target: Math.max(1, Number(source.target || 1)),
            reward: { ...(source.reward || {}) },
            isCompleted: Boolean(source.isCompleted),
            isClaimed: Boolean(source.isClaimed),
            createdAt: Number(source.createdAt || Date.now()),
            updatedAt: Number(source.updatedAt || Date.now()),
            claimedAt: source.claimedAt == null ? null : Number(source.claimedAt),
          } satisfies DailyQuestRecord;
        })
        .filter((quest) => quest.periodKey && quest.title && quest.definitionId);
      dailyQuestsByUserId.set(userId, quests);
    }
  },
  clear: () => {
    dailyQuestsByUserId.clear();
  },
});

import { randomUUID } from "crypto";
import { registerRuntimeSnapshotProvider, storage } from "../storage";
import type {
  CreateNotificationInput,
  NotificationListSnapshot,
  NotificationRecord,
  NotificationReward,
  NotificationScope,
  NotificationView,
  UpsertPersistentEventInput,
} from "./types";

type NotificationStoreSnapshot = {
  personal: Array<[string, NotificationRecord[]]>;
  persistent: NotificationRecord[];
  persistentReadState: Array<[string, string[]]>;
};

const personalNotificationsByUserId = new Map<string, NotificationRecord[]>();
const persistentNotifications: NotificationRecord[] = [];
const persistentReadStateByUserId = new Map<string, Set<string>>();

function applyExperience(level: number, experience: number, gain: number) {
  let nextLevel = Math.max(1, Number(level || 1));
  let nextExperience = Math.max(0, Number(experience || 0)) + Math.max(0, Math.floor(Number(gain || 0)));
  while (nextExperience >= 100) {
    nextLevel += 1;
    nextExperience -= 100;
  }
  return { level: nextLevel, experience: nextExperience };
}

function getPersonalBucket(userId: string) {
  const existing = personalNotificationsByUserId.get(userId);
  if (existing) return existing;
  const created: NotificationRecord[] = [];
  personalNotificationsByUserId.set(userId, created);
  return created;
}

function getPersistentReadState(userId: string) {
  const existing = persistentReadStateByUserId.get(userId);
  if (existing) return existing;
  const created = new Set<string>();
  persistentReadStateByUserId.set(userId, created);
  return created;
}

function isActivePersistent(item: NotificationRecord, nowMs: number) {
  if (!item.isPersistent) return false;
  if (item.scope !== "city" && item.scope !== "global") return false;
  if (item.activeFrom && item.activeFrom > nowMs) return false;
  if (item.activeUntil && item.activeUntil <= nowMs) return false;
  return true;
}

function cloneRecord(record: NotificationRecord): NotificationRecord {
  return {
    ...record,
    dataJson: record.dataJson ? { ...record.dataJson } : null,
    reward: record.reward ? { ...record.reward } : null,
  };
}

function buildRecord(input: {
  userId: string | null;
  scope: NotificationScope;
  isPersistent?: boolean;
  city?: string | null;
  eventKey?: string | null;
  activeFrom?: number | null;
  activeUntil?: number | null;
  replacesEventKey?: string | null;
} & CreateNotificationInput): NotificationRecord {
  const now = Date.now();
  return {
    id: randomUUID(),
    userId: input.userId,
    scope: input.scope,
    type: input.type,
    title: input.title,
    message: input.message,
    dataJson: input.dataJson ? { ...input.dataJson } : null,
    reward: input.reward ? { ...input.reward } : null,
    claimKind: input.claimKind ?? null,
    isRead: Boolean(input.isRead),
    isClaimable: Boolean(input.isClaimable),
    isClaimed: false,
    isPersistent: Boolean(input.isPersistent),
    city: input.city ?? null,
    eventKey: input.eventKey ?? null,
    activeFrom: input.activeFrom ?? null,
    activeUntil: input.activeUntil ?? null,
    replacesEventKey: input.replacesEventKey ?? null,
    createdAt: now,
    updatedAt: now,
    readAt: input.isRead ? now : null,
    claimedAt: null,
  };
}

export function createNotification(userId: string, input: CreateNotificationInput) {
  const bucket = getPersonalBucket(userId);
  const record = buildRecord({
    ...input,
    userId,
    scope: "personal",
    isPersistent: false,
  });
  bucket.unshift(record);
  personalNotificationsByUserId.set(userId, bucket.slice(0, 150));
  return cloneRecord(record);
}

export function createNotifications(userIds: string[], input: CreateNotificationInput) {
  const uniqueUserIds = Array.from(new Set(userIds.map((item) => String(item || "").trim()).filter(Boolean)));
  return uniqueUserIds.map((userId) => createNotification(userId, input));
}

export function upsertCityEventNotification(city: string, input: UpsertPersistentEventInput) {
  const now = Date.now();
  for (const item of persistentNotifications) {
    if (item.scope !== "city") continue;
    if (String(item.city || "") !== String(city || "")) continue;
    if (String(item.eventKey || "") !== String(input.eventKey || "")) continue;
    if (isActivePersistent(item, now)) {
      item.activeUntil = now;
      item.updatedAt = now;
    }
  }

  const record = buildRecord({
    ...input,
    userId: null,
    scope: "city",
    city,
    isPersistent: true,
  });
  persistentNotifications.unshift(record);
  return cloneRecord(record);
}

export function upsertGlobalEventNotification(input: UpsertPersistentEventInput) {
  const now = Date.now();
  for (const item of persistentNotifications) {
    if (item.scope !== "global") continue;
    if (String(item.eventKey || "") !== String(input.eventKey || "")) continue;
    if (isActivePersistent(item, now)) {
      item.activeUntil = now;
      item.updatedAt = now;
    }
  }

  const record = buildRecord({
    ...input,
    userId: null,
    scope: "global",
    isPersistent: true,
  });
  persistentNotifications.unshift(record);
  return cloneRecord(record);
}

export function listActiveCityEvents(city: string, nowMs: number = Date.now()) {
  return persistentNotifications
    .filter((item) => item.scope === "city" && String(item.city || "") === String(city || "") && isActivePersistent(item, nowMs))
    .map(cloneRecord);
}

export function listActiveGlobalEvents(nowMs: number = Date.now()) {
  return persistentNotifications
    .filter((item) => item.scope === "global" && isActivePersistent(item, nowMs))
    .map(cloneRecord);
}

export function deactivateCityEvent(eventKey: string, city: string, nowMs: number = Date.now()) {
  let changed = 0;
  for (const item of persistentNotifications) {
    if (item.scope !== "city") continue;
    if (String(item.city || "") !== String(city || "")) continue;
    if (String(item.eventKey || "") !== String(eventKey || "")) continue;
    if (!isActivePersistent(item, nowMs)) continue;
    item.activeUntil = nowMs;
    item.updatedAt = nowMs;
    changed += 1;
  }
  return changed;
}

export function deactivateGlobalEvent(eventKey: string, nowMs: number = Date.now()) {
  let changed = 0;
  for (const item of persistentNotifications) {
    if (item.scope !== "global") continue;
    if (String(item.eventKey || "") !== String(eventKey || "")) continue;
    if (!isActivePersistent(item, nowMs)) continue;
    item.activeUntil = nowMs;
    item.updatedAt = nowMs;
    changed += 1;
  }
  return changed;
}

function toView(item: NotificationRecord, effectiveRead: boolean): NotificationView {
  return {
    ...cloneRecord(item),
    effectiveRead,
  };
}

export async function listUserNotifications(userId: string): Promise<NotificationListSnapshot> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const now = Date.now();
  const personal = (personalNotificationsByUserId.get(userId) ?? []).map((item) => toView(item, item.isRead));
  const persistentRead = getPersistentReadState(userId);
  const cityEvents = listActiveCityEvents(String(user.city || ""), now).map((item) => toView(item, persistentRead.has(item.id)));
  const globalEvents = listActiveGlobalEvents(now).map((item) => toView(item, persistentRead.has(item.id)));
  const items = [...personal, ...cityEvents, ...globalEvents].sort((left, right) => right.createdAt - left.createdAt);
  return {
    serverTime: now,
    unreadCount: items.filter((item) => !item.effectiveRead).length,
    claimableCount: items.filter((item) => item.scope === "personal" && item.isClaimable && !item.isClaimed).length,
    items,
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const personal = personalNotificationsByUserId.get(userId) ?? [];
  const own = personal.find((item) => item.id === notificationId);
  if (own) {
    if (!own.isRead) {
      own.isRead = true;
      own.readAt = Date.now();
      own.updatedAt = own.readAt;
    }
    return cloneRecord(own);
  }

  const persistent = persistentNotifications.find((item) => item.id === notificationId);
  if (!persistent) throw new Error("Уведомление не найдено");
  getPersistentReadState(userId).add(notificationId);
  return cloneRecord(persistent);
}

export async function markAllNotificationsRead(userId: string) {
  const now = Date.now();
  const personal = personalNotificationsByUserId.get(userId) ?? [];
  for (const item of personal) {
    if (!item.isRead) {
      item.isRead = true;
      item.readAt = now;
      item.updatedAt = now;
    }
  }

  const user = await storage.getUser(userId);
  if (user) {
    const readSet = getPersistentReadState(userId);
    for (const item of persistentNotifications) {
      if ((item.scope === "global" || (item.scope === "city" && String(item.city || "") === String(user.city || ""))) && isActivePersistent(item, now)) {
        readSet.add(item.id);
      }
    }
  }
}

async function applyGenericReward(userId: string, reward: NotificationReward | null | undefined) {
  const safeReward = reward ?? {};
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const expState = applyExperience(user.level, user.experience, Number(safeReward.xp || 0));
  const updatedUser = await storage.updateUser(user.id, {
    balance: Number(user.balance || 0) + Math.max(0, Math.floor(Number(safeReward.money || 0))),
    reputation: Number(user.reputation || 0) + Math.max(0, Math.floor(Number(safeReward.reputation || 0))),
    level: expState.level,
    experience: expState.experience,
  });

  const gramReward = Number(safeReward.gram || 0);
  if (gramReward > 0) {
    const { applyGameStatePatch, getUserWithGameState } = await import("../game-engine");
    const snapshot = await getUserWithGameState(userId);
    const currentGram = Number(snapshot?.game?.gramBalance || 0);
    applyGameStatePatch(userId, { gramBalance: Number((currentGram + gramReward).toFixed(3)) });
  }

  return updatedUser;
}

export async function claimNotificationReward(userId: string, notificationId: string) {
  const personal = personalNotificationsByUserId.get(userId) ?? [];
  const item = personal.find((entry) => entry.id === notificationId);
  if (!item) throw new Error("Уведомление не найдено");
  if (!item.isClaimable) throw new Error("У этого уведомления нет награды");
  if (item.isClaimed) throw new Error("Награда уже получена");

  let user: any = null;
  let rewardPayload: NotificationReward | null = item.reward ? { ...item.reward } : null;

  if (item.claimKind === "daily_quest_reward") {
    const questId = String(item.dataJson?.questId || "").trim();
    if (!questId) throw new Error("Связь с заданием потеряна");
    const { claimDailyQuestReward } = await import("../daily-quests/service");
    const { applyGameStatePatch, getUserWithGameState } = await import("../game-engine");
    const result = await claimDailyQuestReward(userId, questId, {
      applyGameStatePatch,
      getUserWithGameState,
    });
    user = result.user;
    rewardPayload = result.reward ? { ...result.reward } : rewardPayload;
  } else {
    user = await applyGenericReward(userId, rewardPayload);
  }

  item.isClaimed = true;
  item.claimedAt = Date.now();
  item.updatedAt = item.claimedAt;
  item.isRead = true;
  item.readAt = item.claimedAt;

  return {
    notification: cloneRecord(item),
    reward: rewardPayload,
    user,
  };
}

export function markNotificationClaimedByClaimKind(userId: string, claimKind: NotificationRecord["claimKind"], matcher: (item: NotificationRecord) => boolean) {
  const bucket = personalNotificationsByUserId.get(userId) ?? [];
  const now = Date.now();
  for (const item of bucket) {
    if (item.claimKind !== claimKind) continue;
    if (!matcher(item)) continue;
    item.isClaimed = true;
    item.isRead = true;
    item.claimedAt = now;
    item.readAt = now;
    item.updatedAt = now;
  }
}

registerRuntimeSnapshotProvider("notifications", {
  exportSnapshot() {
    const snapshot: NotificationStoreSnapshot = {
      personal: Array.from(personalNotificationsByUserId.entries()).map(([userId, items]) => [userId, items.map(cloneRecord)]),
      persistent: persistentNotifications.map(cloneRecord),
      persistentReadState: Array.from(persistentReadStateByUserId.entries()).map(([userId, readSet]) => [userId, Array.from(readSet)]),
    };
    return snapshot;
  },
  importSnapshot(snapshot) {
    personalNotificationsByUserId.clear();
    persistentNotifications.splice(0, persistentNotifications.length);
    persistentReadStateByUserId.clear();

    const source = snapshot as NotificationStoreSnapshot | null | undefined;
    for (const [userId, items] of source?.personal ?? []) {
      personalNotificationsByUserId.set(String(userId), Array.isArray(items) ? items.map(cloneRecord) : []);
    }
    for (const item of source?.persistent ?? []) {
      persistentNotifications.push(cloneRecord(item));
    }
    for (const [userId, ids] of source?.persistentReadState ?? []) {
      persistentReadStateByUserId.set(String(userId), new Set(Array.isArray(ids) ? ids.map(String) : []));
    }
  },
  clear() {
    personalNotificationsByUserId.clear();
    persistentNotifications.splice(0, persistentNotifications.length);
    persistentReadStateByUserId.clear();
  },
});

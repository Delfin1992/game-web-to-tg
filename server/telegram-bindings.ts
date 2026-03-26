const telegramIdToUserId = new Map<string, string>();
const userIdToTelegramId = new Map<string, string>();

export function bindTelegramIdToUser(telegramId: string, userId: string) {
  const prevUserId = telegramIdToUserId.get(telegramId);
  if (prevUserId && prevUserId !== userId) {
    userIdToTelegramId.delete(prevUserId);
  }
  const prevTelegramId = userIdToTelegramId.get(userId);
  if (prevTelegramId && prevTelegramId !== telegramId) {
    telegramIdToUserId.delete(prevTelegramId);
  }
  telegramIdToUserId.set(telegramId, userId);
  userIdToTelegramId.set(userId, telegramId);
}

export function getUserIdByTelegramId(telegramId: string) {
  return telegramIdToUserId.get(telegramId);
}

export function getTelegramIdByUserId(userId: string) {
  return userIdToTelegramId.get(userId);
}

export function unbindTelegramByUserId(userId: string) {
  const telegramId = userIdToTelegramId.get(userId);
  if (telegramId) {
    telegramIdToUserId.delete(telegramId);
  }
  userIdToTelegramId.delete(userId);
}

export function unbindTelegramByTelegramId(telegramId: string) {
  const userId = telegramIdToUserId.get(telegramId);
  telegramIdToUserId.delete(telegramId);
  if (userId) {
    userIdToTelegramId.delete(userId);
  }
}

export function exportTelegramBindingsSnapshot() {
  return Array.from(telegramIdToUserId.entries());
}

export function importTelegramBindingsSnapshot(entries: Array<readonly [string, string]> | null | undefined) {
  telegramIdToUserId.clear();
  userIdToTelegramId.clear();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const telegramId = String(entry[0] || "").trim();
    const userId = String(entry[1] || "").trim();
    if (!telegramId || !userId) continue;
    telegramIdToUserId.set(telegramId, userId);
    userIdToTelegramId.set(userId, telegramId);
  }
}

export function clearTelegramBindings() {
  telegramIdToUserId.clear();
  userIdToTelegramId.clear();
}

import type { NotificationReward, NotificationScope, NotificationView } from "./types";

function formatCompactNumber(value: number) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) return "0";
  if (Math.abs(normalized) >= 1_000_000) return `${Math.round(normalized / 1_000_000)}m`;
  if (Math.abs(normalized) >= 1_000) return `${Math.round(normalized / 1_000)}k`;
  return `${Math.round(normalized)}`;
}

export function formatNotificationReward(reward: NotificationReward | null | undefined) {
  if (!reward) return "";
  const parts: string[] = [];
  if (Number(reward.money || 0) > 0) parts.push(`$${formatCompactNumber(Number(reward.money || 0))}`);
  if (Number(reward.xp || 0) > 0) parts.push(`${Math.round(Number(reward.xp || 0))} XP`);
  if (Number(reward.reputation || 0) > 0) parts.push(`${Math.round(Number(reward.reputation || 0))} репутации`);
  if (Number(reward.gram || 0) > 0) parts.push(`${Number(reward.gram || 0)} GRM`);
  if (Number(reward.workEnergy || 0) > 0) parts.push(`+${Math.round(Number(reward.workEnergy || 0))}% энергии работы`);
  if (Number(reward.studyEnergy || 0) > 0) parts.push(`+${Math.round(Number(reward.studyEnergy || 0))}% энергии учёбы`);
  if (reward.itemName) parts.push(`${reward.itemName} x${Math.max(1, Number(reward.itemQuantity || 1))}`);
  return parts.join(" + ");
}

export function getNotificationScopeLabel(scope: NotificationScope) {
  if (scope === "city") return "Событие города";
  if (scope === "global") return "Глобальное событие";
  return "Личное";
}

export function getNotificationStatusLabel(item: Pick<NotificationView, "isClaimable" | "isClaimed" | "effectiveRead">) {
  if (item.isClaimable && item.isClaimed) return "Получено";
  if (item.isClaimable && !item.isClaimed) return "Можно забрать";
  if (item.effectiveRead) return "Прочитано";
  return "Новое";
}

export function formatTelegramInbox(snapshot: { items: NotificationView[]; unreadCount: number; claimableCount: number }) {
  const lines = [
    "📥 УВЕДОМЛЕНИЯ",
    "━━━━━━━━━━━━━━",
    `Новых: ${snapshot.unreadCount} | Наград: ${snapshot.claimableCount}`,
    "",
  ];

  if (!snapshot.items.length) {
    lines.push("Пока ничего нового нет.");
    return lines.join("\n");
  }

  snapshot.items.slice(0, 12).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(item.message);
    lines.push(`${getNotificationScopeLabel(item.scope)} • ${getNotificationStatusLabel(item)}`);
    const rewardLabel = formatNotificationReward(item.reward);
    if (rewardLabel) {
      lines.push(`Награда: ${rewardLabel}`);
    }
    lines.push("");
  });

  lines.push("Команды: /inbox, /inbox_claim <номер>");
  return lines.join("\n");
}

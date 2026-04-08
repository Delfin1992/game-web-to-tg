import type { DailyQuestReward } from "./definitions";
import type { DailyQuestSnapshot, DailyQuestView } from "./service";

function formatCompactNumber(value: number) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) return "0";
  if (Math.abs(normalized) >= 1_000_000) return `${Math.round(normalized / 1_000_000)}m`;
  if (Math.abs(normalized) >= 1_000) return `${Math.round(normalized / 1_000)}k`;
  return `${Math.round(normalized)}`;
}

export function formatDailyQuestReward(reward: DailyQuestReward) {
  const parts: string[] = [];
  if (Number(reward.money || 0) > 0) parts.push(`$${formatCompactNumber(Number(reward.money || 0))}`);
  if (Number(reward.xp || 0) > 0) parts.push(`${Math.round(Number(reward.xp || 0))} XP`);
  if (Number(reward.reputation || 0) > 0) parts.push(`${Math.round(Number(reward.reputation || 0))} репутации`);
  if (Number(reward.gram || 0) > 0) parts.push(`${Number(reward.gram || 0)} GRM`);
  if (Number(reward.workEnergy || 0) > 0) parts.push(`+${Math.round(Number(reward.workEnergy || 0))}% энергии работы`);
  if (Number(reward.studyEnergy || 0) > 0) parts.push(`+${Math.round(Number(reward.studyEnergy || 0))}% энергии учёбы`);
  if (reward.itemName) {
    const qty = Math.max(1, Number(reward.itemQuantity || 1));
    parts.push(`${reward.itemName} x${qty}`);
  }
  return parts.join(" + ");
}

function formatQuestStatus(quest: DailyQuestView) {
  if (quest.isClaimed) return "Получено";
  if (quest.isCompleted) return "Готово к получению";
  return "В процессе";
}

function formatQuestBar(quest: DailyQuestView) {
  const percent = Math.max(0, Math.min(100, Math.round((quest.progress / Math.max(1, quest.target)) * 100)));
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  const progressValue = Number.isInteger(quest.progress) ? String(quest.progress) : quest.progress.toFixed(1);
  return `[${"=".repeat(filled)}${"-".repeat(10 - filled)}] ${progressValue}/${quest.target} (${percent}%)`;
}

export function formatDailyQuestCompletionNotice(title: string) {
  return [
    `🎯 Ежедневное задание выполнено: ${title}`,
    "Забери награду в разделе заданий.",
  ].join("\n");
}

export function formatDailyQuestList(snapshot: DailyQuestSnapshot) {
  const lines = [
    "🗓 ЕЖЕДНЕВНЫЕ ЗАДАНИЯ",
    "━━━━━━━━━━━━━━",
    `Дата: ${snapshot.periodKey}`,
    `Следующий сброс: ${snapshot.nextResetAtLabel}`,
    "",
  ];

  snapshot.quests.forEach((quest, index) => {
    lines.push(`${index + 1}. ${quest.title}`);
    lines.push(quest.description);
    lines.push(`Прогресс: ${formatQuestBar(quest)}`);
    lines.push(`Статус: ${formatQuestStatus(quest)}`);
    lines.push(`Награда: ${formatDailyQuestReward(quest.reward)}`);
    lines.push("");
  });

  if (snapshot.completedUnclaimedCount > 0) {
    lines.push(`🎁 Готово к получению: ${snapshot.completedUnclaimedCount}`);
    lines.push("Забери награду: /quest_claim");
  } else {
    lines.push("Команды: /quest_claim, /reputation");
  }

  return lines.join("\n");
}

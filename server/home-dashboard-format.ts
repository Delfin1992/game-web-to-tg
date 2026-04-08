import type { HomeDashboardSummary } from "./home-dashboard";

function formatProgressBar(percent: number, size: number = 10) {
  const normalized = Math.max(0, Math.min(100, Math.round(Number(percent || 0))));
  const filled = Math.max(0, Math.min(size, Math.round((normalized / 100) * size)));
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, size - filled))}`;
}

function formatTodayItem(item: HomeDashboardSummary["today"]["items"][number]) {
  return `• ${item.label} (${item.progress}/${item.target})`;
}

function formatDepartmentLine(item: NonNullable<HomeDashboardSummary["company"]>["departments"][number]) {
  const marker = item.status === "good" ? "⚡" : "⚠️";
  return `${item.label}: ${item.percent}% ${marker}`;
}

export function formatTelegramHomeDashboard(summary: HomeDashboardSummary) {
  const playerLine = `${summary.player.professionEmoji ?? "👤"} ${summary.player.name} | Уровень ${summary.player.level}${summary.player.professionName ? ` (${summary.player.professionName})` : ""}`;
  const todayLines = summary.today.items.map(formatTodayItem);
  const companyLines = summary.company
    ? [
        `🏢 Компания: ${summary.company.companyName}`,
        summary.company.activeContract
          ? `Контракт: ${summary.company.activeContract.title}`
          : "Контракт: нет активного",
        summary.company.activeContract
          ? `Прогресс: ${formatProgressBar(summary.company.activeContract.progressPercent)} ${summary.company.activeContract.progressPercent}%`
          : "Прогресс: —",
        "Отделы:",
        ...summary.company.departments.slice(0, 3).map(formatDepartmentLine),
      ]
    : ["🏢 Компания: пока не состоишь"];

  return [
    "🏠 ГЛАВНАЯ ПАНЕЛЬ",
    "━━━━━━━━━━━━━━",
    playerLine,
    "",
    "📅 Сегодня:",
    ...todayLines,
    "",
    ...companyLines,
    "",
    `⚔️ PvP: рейтинг ${summary.pvp.rating}`,
    `📬 Уведомления: ${summary.inbox.unreadCount} | 🏅 Достижения: ${summary.achievements.totalCount}/${summary.achievements.claimableCount}`,
  ].join("\n");
}

export function buildTelegramHomeDashboardInlineMarkup(summary: HomeDashboardSummary) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  if (summary.quickActions.contractContribution.visible) {
    rows.push([{
      text: summary.quickActions.contractContribution.enabled
        ? "🛠 Внести вклад в контракт"
        : "🛠 Вклад уже сделан",
      callback_data: summary.quickActions.contractContribution.enabled ? "home:contract_contribute" : "home:noop",
    }]);
  }

  const rewardRow: Array<{ text: string; callback_data: string }> = [];
  if (summary.quickActions.rewards.visible) {
    rewardRow.push({
      text: `🎁 Забрать награды (${summary.today.rewardsCount})`,
      callback_data: summary.quickActions.rewards.enabled ? "home:claim_rewards" : "home:noop",
    });
  }
  if (summary.quickActions.pvp.visible) {
    rewardRow.push({
      text: "⚔️ Сыграть PvP",
      callback_data: summary.quickActions.pvp.enabled ? "home:pvp" : "home:noop",
    });
  }
  if (rewardRow.length > 0) {
    rows.push(rewardRow);
  }

  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

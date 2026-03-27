import { buildReplyKeyboard } from "./shared";

/**
 * Reply keyboard for the admin panel.
 * Labels are aligned with the plain-text aliases in telegram.ts.
 */
export const ADMIN_MENU_REPLY_MARKUP = buildReplyKeyboard([
  ["💸 Выдать деньги", "⭐ Выдать опыт"],
  ["♻️ Сброс игрока", "🔄 Рестарт игры"],
  ["🏁 Старт хакатона", "🛑 Финиш хакатона"],
  ["♻️ Сброс хакатона", "🌍 Глобальное событие"],
  ["🚪 Выйти из админки", "🏠 Домой"],
]);

import { buildReplyKeyboard } from "./shared";

/**
 * Home keyboard must only be shown on the actual home screen.
 */
export function buildMainMenuReplyMarkup(showTutorialButton: boolean) {
  const keyboard: Array<Array<{ text: string }>> = [
    [{ text: "👤 Профиль" }, { text: "🎒 Инвентарь" }],
    [{ text: "🧩 Допы" }, { text: "🏙 Город" }],
    [{ text: "⚔️ PvP Arena" }],
    showTutorialButton
      ? [{ text: "🏢 Компания" }, { text: "🎓 Обучение" }]
      : [{ text: "🏢 Компания" }],
    [{ text: "🛠 Админ" }],
  ];
  return {
    keyboard,
    resize_keyboard: true,
  };
}

export const MAIN_MENU_REPLY_MARKUP = buildMainMenuReplyMarkup(true);

export const EXTRAS_MENU_REPLY_MARKUP = buildReplyKeyboard([
  ["🏆 Рейтинг", "🗓 Квесты"],
  ["🏅 Репутация", "👥 Рефералы"],
  ["🏠 Домой"],
]);

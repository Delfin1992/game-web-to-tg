import { buildReplyKeyboard } from "./shared";

export const CITY_MENU_REPLY_MARKUP = buildReplyKeyboard([
  ["💼 Вакансии", "📚 Учёба"],
  ["🛍 Магазин", "🏦 Банк"],
  ["🔧 Сервис", "🏘 Недвижимость"],
  ["🏷 Аукцион"],
  ["🏠 Домой"],
]);

export const JOB_RESULT_REPLY_MARKUP = buildReplyKeyboard([
  ["💼 Вакансии", "🏙 Город"],
]);

export const STUDY_RESULT_REPLY_MARKUP = buildReplyKeyboard([
  ["📚 Учёба", "🏙 Город"],
]);

export const BANK_MENU_REPLY_MARKUP = buildReplyKeyboard([
  ["📉 Кредиты", "📈 Вклады"],
  ["💳 Погасить кредит", "🏧 Снять вклад"],
  ["🪙 Купить GRM", "💵 Продать GRM"],
  ["📊 Биржа"],
  ["⬅️ Назад"],
]);

export const SHOP_MENU_REPLY_MARKUP = buildReplyKeyboard([
  ["📚 Курсы", "📱 Гаджеты"],
  ["💱 Продажа"],
  ["⬅️ Назад"],
]);

export const CITY_REPLY_MARKUP = {
  keyboard: [
    [{ text: "Сан-Франциско" }],
    [{ text: "⬅️ Назад" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
};

export function buildNumericSelectionReplyMarkup(count: number) {
  const options = Math.max(1, Math.min(count, 9));
  const buttons = Array.from({ length: options }, (_, index) => ({ text: String(index + 1) }));
  const rows: Array<Array<{ text: string }>> = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  rows.push([{ text: "⬅️ Назад" }]);
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: false };
}

export function buildBankSelectionReplyMarkup(count: number) {
  return buildNumericSelectionReplyMarkup(count);
}

export function buildEducationLevelsReplyMarkup(levelNames: string[]) {
  const row = levelNames.map((name) => ({ text: name }));
  return {
    keyboard: [row, [{ text: "⬅️ Назад" }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function buildEducationCoursesReplyMarkup(count: number) {
  return buildNumericSelectionReplyMarkup(count);
}

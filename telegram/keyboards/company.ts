import { buildReplyKeyboard } from "./shared";

/**
 * Company reply keyboard by section.
 */
export function buildCompanyReplyMarkup(input: {
  role?: string | null;
  section: string;
}) {
  const { role, section } = input;

  if (!role) {
    return buildReplyKeyboard([
      ["➕ Создать компанию", "📨 Вступить в компанию"],
      ["🏠 Домой"],
    ]);
  }

  if (section === "work") {
    return buildReplyKeyboard([
      ["📋 Контракты города", "⛏ Добыча запчастей"],
      ["⬅️ Назад"],
    ]);
  }

  if (section === "service") {
    return buildReplyKeyboard([
      ["🛠 Сервис компании", "⬅️ Назад"],
    ]);
  }

  if (section === "warehouse") {
    return buildReplyKeyboard([
      ["📦 Склад компании", "📥 Передать запчасти"],
      ["⬅️ Назад"],
    ]);
  }

  if (section === "bureau") {
    return buildReplyKeyboard([
      ["🧪 Разработка базовых чертежей", "🌟 Разработка редких гаджетов"],
      ["🏭 Производство гаджетов", "⬅️ Назад"],
    ]);
  }

  if (section === "bureau_exclusive") {
    return buildReplyKeyboard([
      ["🪄 Старт", "📈 Прогресс"],
      ["🏭 Выпуск", "⬅️ Назад"],
    ]);
  }

  if (section === "hackathon_event") {
    return buildReplyKeyboard([
      ["✅ Присоединиться", "🧠 Вложить навыки"],
      ["💰 Вложить GRM", "🧩 Вложить запчасти"],
      ["⬅️ Назад"],
    ]);
  }

  if (section === "management_hr") {
    return buildReplyKeyboard([
      ["🧑‍💼 Назначение сотрудников на должности", "📥 Заявки на вступление"],
      ["⬅️ Назад"],
    ]);
  }

  if (section === "management_departments") {
    return buildReplyKeyboard([
      ["🏛 Прокачка отделов", "📦 Прокачка склада"],
      ["⬆️ Legacy апгрейд", "⬅️ Назад"],
    ]);
  }

  if (section === "hackathon_sabotage") {
    return buildReplyKeyboard([
      ["🎯 Атака", "🛡 Security"],
      ["📨 Офферы", "⬅️ Назад"],
    ]);
  }

  if (section === "hackathon") {
    return buildReplyKeyboard([
      ["🏁 Хакатон", "🕶 Саботаж"],
      ["⬅️ Назад"],
    ]);
  }

  if (section === "management") {
    return buildReplyKeyboard([
      ["👥 HR", "💱 Пополнить GRM"],
      ["🏛 Отделы", "💸 Зарплаты"],
      ["🚀 IPO", "⬅️ Назад"],
    ]);
  }

  return buildReplyKeyboard([
    ["🏢 Профиль", "💼 Работа"],
    ["📦 Склад", "🧪 Бюро"],
    ["🛠 Сервис", "🛠 Управление"],
    ["🏁 Хакатон"],
    ["🏠 Домой"],
  ]);
}

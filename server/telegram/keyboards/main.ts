/**
 * Centralized Telegram keyboard builders.
 * Kept behavior-compatible with the legacy monolith.
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

export const EXTRAS_MENU_REPLY_MARKUP = {
  keyboard: [
    [{ text: "🏆 Рейтинг" }, { text: "🗓 Квесты" }],
    [{ text: "🏅 Репутация" }, { text: "👥 Рефералы" }],
    [{ text: "🏠 Домой" }],
  ],
  resize_keyboard: true,
};

export const CITY_MENU_REPLY_MARKUP = {
  keyboard: [
    [{ text: "💼 Вакансии" }, { text: "📚 Учёба" }],
    [{ text: "🛍 Магазин" }, { text: "🏦 Банк" }],
    [{ text: "🔧 Сервис" }, { text: "🏘 Недвижимость" }],
    [{ text: "🏷 Аукцион" }],
    [{ text: "🏠 Домой" }],
  ],
  resize_keyboard: true,
};

export const PVP_MENU_REPLY_MARKUP = {
  keyboard: [
    [{ text: "⚔️ Найти соперника" }, { text: "🚪 Выйти из PvP" }],
    [{ text: "🧾 История PvP" }, { text: "🏠 Домой" }],
  ],
  resize_keyboard: true,
};

export const JOB_RESULT_REPLY_MARKUP = {
  keyboard: [
    [{ text: "💼 Вакансии" }, { text: "🏙 Город" }],
  ],
  resize_keyboard: true,
};

export const STUDY_RESULT_REPLY_MARKUP = {
  keyboard: [
    [{ text: "📚 Учёба" }, { text: "🏙 Город" }],
  ],
  resize_keyboard: true,
};

export const ADMIN_MENU_REPLY_MARKUP = {
  keyboard: [
    [{ text: "💸 Выдать деньги" }, { text: "⭐ Выдать опыт" }],
    [{ text: "♻️ Сброс игрока" }, { text: "🔄 Рестарт игры" }],
    [{ text: "🏁 Старт хакатона" }, { text: "🛑 Финиш хакатона" }],
    [{ text: "♻️ Сброс хакатона" }, { text: "🌍 Глобальное событие" }],
    [{ text: "🚪 Выйти из админки" }, { text: "🏠 Домой" }],
  ],
  resize_keyboard: true,
};

export const BANK_MENU_REPLY_MARKUP = {
  keyboard: [
    [{ text: "📉 Кредиты" }, { text: "📈 Вклады" }],
    [{ text: "💳 Погасить кредит" }, { text: "🏧 Снять вклад" }],
    [{ text: "🪙 Купить GRM" }, { text: "💵 Продать GRM" }],
    [{ text: "📊 Биржа" }],
    [{ text: "⬅️ Назад" }],
  ],
  resize_keyboard: true,
};

export const SHOP_MENU_REPLY_MARKUP = {
  keyboard: [
    [{ text: "📚 Курсы" }, { text: "📱 Гаджеты" }],
    [{ text: "💱 Продажа" }],
    [{ text: "⬅️ Назад" }],
  ],
  resize_keyboard: true,
};

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

export function buildReplyKeyboard(rows: string[][]) {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
  };
}

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

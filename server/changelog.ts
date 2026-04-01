export type BotChangelogEntry = {
  date: string;
  version: string;
  title: string;
  summary: string[];
  details: string[];
  createdAt: string;
  restartMessageEnabled: boolean;
};

const CHANGELOG_ENTRIES: BotChangelogEntry[] = [
  {
    date: "2026-04-01",
    version: "2026.04.01-2105",
    title: "Компания, склад, квесты и биржа стали понятнее",
    summary: [
      "добавлены кнопки продажи запчастей со склада компании без ручного ввода команды",
      "после продажи запчастей бот больше не открывает склад повторным сообщением",
      "Legacy убран из Telegram UI компании и из профиля компании, а прокачка склада перенесена в экран отделов",
      "команда /quest_claim больше не блокируется shop-flow и после получения награды оставляет игрока в экране квеста",
      "новости биржи и их эффекты теперь обновляются один раз в день в 08:00 по МСК",
    ],
    details: [
      "в экране продажи запчастей со склада компании появились inline-кнопки выбора позиции и сценарий с запросом количества через pending-flow",
      "результат продажи запчастей теперь остаётся отдельным итоговым сообщением без автоматического открытия экрана склада компании",
      "из Telegram-клавиатур и профиля компании убраны Legacy-пункты, которые путали игроков и дублировали новую систему компании",
      "кнопка прокачки склада перенесена в экран отделов и добавлена рядом с улучшениями компании",
      "инвентарь игрока получил более компактный формат отображения гаджетов с основными характеристиками вместо длинного техблока",
      "склад компании и экран переноса запчастей теперь используют тот же стиль названий и компактных карточек, что и инвентарь игрока",
      "в окне запуска производства показывается реальное наличие деталей на складе в формате «есть / надо» для рецепта гаджета",
      "сообщение о блокировке shop-действия больше не ссылается на несуществующую кнопку «Назад» и предлагает использовать /cancel",
      "команды /quest_claim, /quests и /reputation теперь совместимы с pending shop-flow, поэтому еженедельную награду можно забрать без ложного отказа",
      "после /quest_claim бот теперь оставляет игрока в экране квеста с актуальным статусом, а не перебрасывает в длинный профиль",
      "в callback-flow company mining убран автопереход обратно в бюро: после забора награды игрок видит только сообщение о добытой детали и обычное меню компании",
      "новости биржи и связанные рыночные эффекты больше не крутятся каждые 2 часа: одна новость действует в окне 08:00 МСК -> 08:00 МСК и рассылается один раз в день",
      "runtime-состояние биржевой новости сохраняется в local persistent storage, поэтому после обычного рестарта бот не пушит ту же новость повторно в тот же день",
    ],
    createdAt: "2026-04-01T21:05:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-03-31",
    version: "2026.03.31-1642",
    title: "Weekly hackathon, company auction и защита экономики",
    summary: [
      "weekly hackathon переведён на timed-формат: CEO регистрирует компанию, игроки занимают до 5 мест, а очки копятся в 3 этапах по времени",
      "добавлены live-экраны хакатона в Telegram с таймером, лидербордом этапа, турнирными очками и MVP по суммарному вкладу",
      "company-аукцион доработан: можно выставлять любые гаджеты, pending-ввод цены больше не ломает reply-навигацию, а лоты рынка показывают и гаджеты, и запчасти",
      "loot balance переделан: редкие PvP-награды вынесены в победы PvP, а company mining больше не роняет epic-детали и реже выдаёт rare",
      "в экономику добавлены анти-абьюз и аудит: гаджет после покупки на аукционе нельзя перепродать 7 дней, а активами компании управляют только CEO и его заместитель",
    ],
    details: [
      "weekly hackathon теперь работает через статусы registration -> round1 -> round2 -> round3 -> finished, без старой зависимости от мгновенного сравнения компаний по числу сотрудников",
      "CEO регистрирует компанию в хакатоне, после чего всем сотрудникам компании приходит Telegram-уведомление с кнопкой участия, а состав ограничен 5 слотами",
      "каждые 5 секунд вклад участников считается из effective stats игрока, поэтому бонусы от гаджетов автоматически влияют на очки этапов",
      "три этапа хакатона разделены по ролям: Концепт = design + analytics, Прототип = coding + testing, Питч = coding + testing + design + analytics с мягким вкладом attention",
      "после каждого этапа начисляются турнирные очки 3 / 2 / 1, а финальный итог определяется по сумме турнирных очков с tie-break по raw score",
      "в конце хакатона считается MVP по суммарному личному вкладу, а награды выдаются компании-победителю, топ-3 компаниям, всем участникам и MVP",
      "в company-аукционе снят лимит «только для редких гаджетов», исправлен конфликт reply-кнопки «Аукцион компании» с pending-вводом цены и добавлен показ общих рыночных лотов",
      "в аукционе и company-аукционе доработаны компактные карточки гаджетов, группировка одинаковых предметов и более короткие форматы вывода для длинных списков",
      "дроп с вакансий больше не показывает шанс детали в сообщении и больше не выдаёт rare/epic запчасти; ценные детали вынесены в PvP, чтобы арена стала осмысленнее",
      "company mining больше не выдаёт epic-запчасти и заметно реже роняет rare, а со склада компании теперь можно продавать запчасти за GRM отдельным flow",
      "рейтинг игроков переведён на reply-кнопки вместо исчезающих inline-кнопок, чтобы можно было безопасно переключать сортировки и возвращаться назад",
      "в Telegram почищены сообщения магазина, инвентаря и weekly-quest flow: убраны пустые эффекты и нулевые бонусы, а при выполнении квеста бот сразу пишет, что награду можно забрать",
      "для гаджетов добавлена история приобретения: предметы, купленные на аукционе, получают acquisitionSource / acquiredAt / lastAuctionPurchaseAt и не могут быть повторно выставлены в течение 7 дней",
      "в company market, production, blueprint research, exclusive-flow и delivery city-контрактов добавлен единый backend-guard: деньгами и активами компании теперь могут управлять только CEO и его заместитель",
      "добавлен persistent economy audit log с событиями покупки гаджета на рынке, попытки перепродажи, блокировки relist, создания company-лота, трат компании, отказов по правам и продажи запчастей со склада",
    ],
    createdAt: "2026-03-31T16:42:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-03-30",
    version: "2026.03.30-2210",
    title: "Упрощение запчастей и новые company/gadget flows",
    summary: [
      "система запчастей упрощена до схемы тип детали + категория устройства + качество, без series и поколений",
      "рецепты чертежей теперь quality-based: partType + quality + quantity, с плавной tier-прогрессией",
      "добавлена команда /gadgets с каталогом гаджетов, характеристиками, рецептами и перелистыванием по страницам",
      "в компании добавлен отдельный экран аукциона и глобальная пометка уже разработанных чертежей",
      "при завершении разработки нового гаджета Telegram-уведомление о компании-разработчике получают все игроки",
    ],
    details: [
      "система запчастей упрощена до схемы тип детали + категория устройства + качество, без series и поколений",
      "каталог деталей пересобран на common / uncommon / rare / epic с безопасной нормализацией старых part id",
      "рецепты чертежей теперь quality-based: partType + quality + quantity, с плавной tier-прогрессией",
      "ветки гаджетов получили акцентные детали в рецептах: performance, creative, business и industrial теперь ощущаются по составу",
      "производство компании теперь проверяет не только тип детали, но и нужное качество и количество",
      "склады компании автоматически нормализуют старые детали в новый каталог без потери предметов",
      "в Telegram список чертежей и производство стали прозрачнее: логика рецептов теперь соответствует реальному складу",
      "добавлена команда /gadgets с каталогом гаджетов, характеристиками, рецептами и перелистыванием по страницам",
      "в компании добавлен отдельный экран аукциона: со склада можно выставлять гаджеты и запчасти, а запчасти с рынка теперь видны прямо из company UX",
      "после завершения исследования чертёж помечается глобально: в бюро он больше не выбирается другой компанией и показывает, кто разработал модель",
      "в окне запуска производства теперь явно показывается полный рецепт: какие детали, какого качества и сколько нужно на партию",
      "при завершении разработки нового гаджета Telegram-уведомление о компании-разработчике получают все игроки с привязанным ботом",
    ],
    createdAt: "2026-03-30T22:10:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-03-29",
    version: "2026.03.29-2145",
    title: "Telegram dispatcher и модульный рефакторинг",
    summary: [
      "Telegram dispatcher стал тоньше: PvP, Registration и Company теперь заходят через модульную делегацию",
      "company callback-router почти полностью вынесен из legacy telegram.ts в отдельный company module",
      "inventory/shop, bank/stocks и repair вынесены в отдельные Telegram-фасады",
      "legacy command-islands для auction, bank и company собраны в отдельные orchestration-helper'ы",
    ],
    details: [
      "Telegram dispatcher стал тоньше: PvP, Registration и Company теперь заходят через модульную делегацию",
      "для feature-routing добавлены общие helpers для message/callback path и сборки module payload'ов",
      "registration gates, tutorial locks и profession autoprompt теперь вынесены в именованные policy-helper'ы",
      "company message-routing собран через модуль, а не через разрозненные прямые вызовы handlers",
      "company callback-router почти полностью вынесен из legacy telegram.ts в отдельный company module",
      "в company module собраны navigation, warehouse, HR, salaries, mining, blueprint progress, contracts и exclusive-flow",
      "hub/navigation, player systems, utility и commerce callback/message routing сжаты в отдельные orchestration-helper'ы",
      "inventory/shop вынесены в отдельный Telegram-фасад с message и callback routing",
      "bank/stocks вынесены в отдельный Telegram-фасад с message и callback routing",
      "repair вынесен в отдельный Telegram-фасад, и message/callback routing больше не сидят напрямую в основном dispatcher",
      "legacy command-islands для auction, bank и company собраны в отдельный helper вместо больших блоков внутри handleIncomingMessage",
    ],
    createdAt: "2026-03-29T21:45:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-03-28",
    version: "2026.03.28-1409",
    title: "Компании, отделы и командная разработка чертежей",
    summary: [
      "участие в разработке чертежей теперь получает мягкий буст от отдела сотрудника",
      "CEO теперь тоже можно назначать в отделы компании",
      "в прогрессе чертежа теперь показываются шкалы навыков, участники, вклад за тик и ETA",
      "после завершения исследования компания автоматически получает чертёж и может запускать производство",
    ],
    details: [
      "участие в разработке чертежей теперь получает мягкий буст от отдела сотрудника",
      "CEO теперь тоже можно назначать в отделы компании",
      "при выборе отдела бот кратко показывает бонусы каждого отдела",
      "прокачка склада теперь сначала показывает цену и новый лимит, а потом просит подтверждение",
      "разработка чертежей стала командным исследованием с очками по навыкам и тиком каждые 5 секунд",
      "CEO запускает проект, сотрудники получают уведомление и могут присоединиться кнопкой",
      "в прогрессе чертежа теперь показываются шкалы навыков, участники, вклад за тик и ETA",
      "после завершения исследования компания автоматически получает чертёж и может запускать производство",
    ],
    createdAt: "2026-03-28T14:09:00+03:00",
    restartMessageEnabled: true,
  },
];

function sortEntriesDesc(entries: BotChangelogEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) return right.date.localeCompare(left.date);
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function normalizeChangelogDateInput(input?: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const localMatch = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (localMatch) return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  return "";
}

export function formatChangelogDateLabel(dateKey: string) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function getAllChangelogEntries() {
  return sortEntriesDesc(CHANGELOG_ENTRIES);
}

export function getLatestChangelogEntry(options?: { restartOnly?: boolean }) {
  const entries = options?.restartOnly
    ? CHANGELOG_ENTRIES.filter((entry) => entry.restartMessageEnabled)
    : CHANGELOG_ENTRIES;
  return sortEntriesDesc(entries)[0] ?? null;
}

export function getChangelogEntryByDate(date: string) {
  const normalizedDate = normalizeChangelogDateInput(date);
  if (!normalizedDate) return null;
  return CHANGELOG_ENTRIES.find((entry) => entry.date === normalizedDate) ?? null;
}

export function getRecentChangelogEntries(days: number) {
  const normalizedDays = Math.max(1, Math.floor(days));
  return getAllChangelogEntries().slice(0, normalizedDays);
}

export function formatChangelogShortMessage(entry: BotChangelogEntry, options?: { restart?: boolean }) {
  const title = options?.restart ? "🔄 Бот перезапустился" : "📝 Последнее обновление";
  return [
    title,
    `🗓 Последнее обновление: ${formatChangelogDateLabel(entry.date)}`,
    `🏷 Версия: ${entry.version}`,
    "",
    "Кратко:",
    ...entry.summary.slice(0, 5).map((line) => `• ${line}`),
    "",
    "Команды:",
    "• /updates — последние изменения",
    `• /updates ${entry.date} — изменения за дату`,
    "• /updates list — список дат",
  ].join("\n");
}

export function formatChangelogDetailedMessage(entry: BotChangelogEntry) {
  return [
    "📝 ОБНОВЛЕНИЕ БОТА",
    `🗓 Дата: ${formatChangelogDateLabel(entry.date)}`,
    `🏷 Версия: ${entry.version}`,
    `📌 ${entry.title}`,
    "",
    "Кратко:",
    ...entry.summary.map((line) => `• ${line}`),
    "",
    "Подробно:",
    ...entry.details.map((line) => `• ${line}`),
  ].join("\n");
}

export function formatChangelogListMessage(entries: BotChangelogEntry[]) {
  if (!entries.length) {
    return "📝 История обновлений пока пуста.";
  }

  return [
    "📝 ИСТОРИЯ ОБНОВЛЕНИЙ",
    ...entries.map((entry, index) => `${index + 1}. ${formatChangelogDateLabel(entry.date)} — ${entry.title}`),
    "",
    "Открыть дату: /updates YYYY-MM-DD",
  ].join("\n");
}

export function formatChangelogRecentMessage(entries: BotChangelogEntry[], _days?: number) {
  if (!entries.length) {
    return "📝 За этот период обновления не найдены.";
  }

  return [
    "📝 ОБНОВЛЕНИЯ ЗА ПОСЛЕДНИЕ ДНИ",
    ...entries.map((entry) => `• ${formatChangelogDateLabel(entry.date)} — ${entry.title}`),
    "",
    "Подробно: /updates YYYY-MM-DD",
  ].join("\n");
}

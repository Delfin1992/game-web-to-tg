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
    date: "2026-04-07",
    version: "2026.04.07-1635",
    title: "Daily-квесты, Home Dashboard и Telegram-кодировка стали лучше",
    summary: [
      "ежедневные задания переведены на сервер: теперь каждый день игрок получает 3 случайных daily без company-задач",
      "для daily добавлены случайные награды: деньги, XP, энергия, GRM, детали и редкий трофей дня",
      "новый Home Dashboard работает и в Telegram, и в mini app, показывая игрока, daily, компанию, PvP и награды",
      "inbox-уведомления теперь используются для daily claim и других значимых игровых событий",
      "исправлены живые Telegram-строки с битой кодировкой в обмене валюты, PvP-отчётах и смежных экранах",
    ],
    details: [
      "daily-квесты теперь генерируются на сервере с учётом доступности игрока, попыткой избегать повторов прошлого дня и распределением по разным категориям",
      "прогресс daily обновляется только из server-side действий: работа, обучение, магазин, банк, обмен GRM, PvP, биржа и ремонт",
      "claim наград идёт через сервер и inbox, а Home Dashboard сразу показывает число готовых наград",
      "в PvP-отчёте об износе гаджетов имена предметов теперь проходят нормализацию, поэтому 4K Монитор, MacBook Pro и наушники отображаются корректно",
      "Telegram-обмен GRM и связанные сообщения очищены от mojibake и снова показываются нормальным русским текстом",
    ],
    createdAt: "2026-04-07T16:35:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-04-06",
    version: "2026.04.06-1535",
    title: "Mini app, хакатон, вакансии и сервис стали аккуратнее",
    summary: [
      "в mini app добавлены полноценные экраны «Сервис» и «Недвижимость», чтобы городские механики совпадали с Telegram",
      "ремонт в mini app теперь идёт только через городской сервис, без прямой починки из инвентаря",
      "для тестов допуск в weekly hackathon временно ослаблен: в компании можно состоять 0 дней",
      "из Telegram-меню хакатона убраны старые кнопки «Вложить навыки», «Вложить GRM» и «Вложить запчасти»",
      "вакансии по всем городам, включая San Francisco, очищены от битой кодировки в названиях и описаниях",
    ],
    details: [
      "добавлены server API и mini app-страницы для жилья и городского сервиса ремонта, чтобы web-механики не отставали от Telegram",
      "городской сервис теперь одинаково работает и с gadget, и с gear, а прямой ремонт из инвентаря убран",
      "в weekly hackathon тестовый чек допуска использует 0 дней в компании, остальные условия по уровню и PvP сохранены",
      "в уведомлении о награде за победу в хакатоне теперь явно указан бафф: +10% к скорости разработки на 24 часа",
      "reply-меню компании очищено от legacy-кнопок старого хакатона, а словарь вакансий в server/game-engine.ts переведён в нормальный русский UTF-8",
    ],
    createdAt: "2026-04-06T15:35:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-04-04",
    version: "2026.04.04-0031",
    title: "Вступление в компанию и заявки на вступление стали надёжнее",
    summary: [
      "вступление в компанию из реестра снова работает и кнопкой, и номером, и текстом вида 1. Бордель",
      "уведомления CEO о новых заявках очищены от кракозябр",
      "входящие заявки на вступление переведены на reply-flow с действиями одобрить, отклонить и назад",
      "согласование заявок больше не зависит от хрупких длинных inline callback id",
      "добавлены диагностические логи на создание, просмотр и согласование заявок",
    ],
    details: [
      "кнопки реестра компаний теперь используют короткие refs, а выбор компании понимает номер, текст кнопки и имя компании",
      "уведомления о заявках и тексты company membership приведены к нормальному UTF-8",
      "экран заявок открывается как отдельный reply-screen, где CEO выбирает действие и потом номер заявки",
      "кнопка «Назад» из заявок возвращает в предыдущее HR-меню компании",
      "для совместимости оставлены fallback-пути для старых callback-форматов по request id",
    ],
    createdAt: "2026-04-04T00:31:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-04-03",
    version: "2026.04.03-2349",
    title: "Telegram UX, профессии, компании и баланс вакансий стали аккуратнее",
    summary: [
      "исправлен company-flow вступления: выбор компании из реестра снова работает и кнопкой, и номером",
      "экран выбора профессии стал компактнее и показывает краткие бонусы специализации до выбора",
      "после завершения обучения кнопки PvP Arena и Компания стоят в одной строке главного меню",
      "сообщение после покупки бумаг на бирже стало короче и не дублирует весь экран биржи",
      "подкручен баланс вакансий по деньгам, XP и шансу выпадения запчастей",
    ],
    details: [
      "реестр компаний переводит чат в режим выбора, поэтому ответ номером больше не теряется",
      "company membership и callback-тексты очищены от битой кодировки",
      "в экране профессий убраны лишние пустые строки и длинные пояснения, а у каждой профессии показаны навыки, PvP-бонусы и повышенный потолок",
      "покупка бумаг на бирже теперь отвечает коротким подтверждением с ценой, списанием и остатком",
      "доход компании от продажи лотов на рынке теперь попадает не только в капитал, но и в показатель прибыли компании",
    ],
    createdAt: "2026-04-03T23:49:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-04-02",
    version: "2026.04.02-2315",
    title: "IPO, биржа компаний, Telegram UX и аукцион стали удобнее",
    summary: [
      "добавлен понятный IPO checklist для компании с требованиями по возрасту, сотрудникам, навыкам, гаджетам, хакатону и балансу",
      "CEO теперь может вывести компанию на IPO, после чего у неё появляются акции, стартовая цена и free float",
      "акции публичных компаний торгуются на общей бирже, а цена компании меняется раз в день по реальным действиям компании",
      "исправлены Telegram-экраны компании: HR, зарплаты, профиль компании и русские подписи IPO",
      "при покупке фиксированных gadget-лотов на аукционе теперь можно выбрать количество одинаковых гаджетов по одной цене",
    ],
    details: [
      "добавлен отдельный company stock service с IPO eligibility, запуском IPO, стартовой ценой акций и daily recalculation",
      "внутренняя страница акций компании показывает текущую цену, изменение за день, факторы роста и падения и историю цены",
      "внешняя биржа показывает только название публичной компании, текущую цену и изменение за день",
      "в Telegram исправлены HR и Зарплаты: выбор сотрудника и CEO снова работает стабильно",
      "в аукционе после новой ставки теперь используется короткий 15-минутный финальный таймер",
    ],
    createdAt: "2026-04-02T23:15:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-04-01",
    version: "2026.04.01-2105",
    title: "Компания, склад, квесты и биржа стали понятнее",
    summary: [
      "добавлены кнопки продажи запчастей со склада компании без ручного ввода команды",
      "после продажи запчастей бот больше не открывает склад повторным сообщением",
      "Legacy убран из Telegram UI компании и из профиля компании, а прокачка склада перенесена в экран отделов",
      "команда /quest_claim больше не блокируется shop-flow и после награды оставляет игрока в экране квеста",
      "новости биржи и их эффекты теперь обновляются один раз в день в 08:00 по МСК",
    ],
    details: [
      "экран продажи запчастей со склада компании получил inline-кнопки выбора позиции и сценарий с запросом количества через pending-flow",
      "результат продажи запчастей остаётся отдельным итоговым сообщением без автоматического открытия склада компании",
      "инвентарь игрока, склад компании и перенос запчастей приведены к более компактному и единому виду",
      "в окне запуска производства показывается реальное наличие деталей на складе в формате «есть / надо»",
      "после company mining бот показывает только итог добычи без автоперехода в бюро разработок",
    ],
    createdAt: "2026-04-01T21:05:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-03-31",
    version: "2026.03.31-1642",
    title: "Weekly hackathon, company auction и защита экономики",
    summary: [
      "weekly hackathon переведён на timed-формат с CEO-регистрацией, составом до 5 игроков и тремя этапами по времени",
      "добавлены live-экраны хакатона в Telegram с таймером, лидербордом, турнирными очками и MVP",
      "company-аукцион доработан: можно выставлять любые гаджеты, а pending-ввод цены больше не ломает навигацию",
      "loot balance переделан: редкие PvP-награды вынесены в победы PvP, а company mining больше не роняет epic-детали",
      "в экономику добавлены анти-абьюз и аудит для рынка и активов компании",
    ],
    details: [
      "CEO регистрирует компанию в хакатоне, а сотрудники сами занимают до 5 слотов участия",
      "каждые 5 секунд вклад игроков считается из effective stats, поэтому бонусы гаджетов влияют на очки этапов",
      "в sensitive company-действиях добавлен backend-guard для CEO и заместителя",
      "добавлен persistent economy audit log для покупок на рынке, relist-блокировок, трат компании и продажи запчастей со склада",
      "gadget после покупки на аукционе нельзя перепродать 7 дней",
    ],
    createdAt: "2026-03-31T16:42:00+03:00",
    restartMessageEnabled: true,
  },
  {
    date: "2026-03-30",
    version: "2026.03.30-2210",
    title: "Упрощение запчастей и новые company/gadget flows",
    summary: [
      "система запчастей упрощена до схемы тип детали + категория устройства + качество",
      "рецепты чертежей стали quality-based и лучше совпадают с реальным складом",
      "добавлена команда /gadgets с каталогом гаджетов, характеристиками и рецептами",
      "в компании появился отдельный экран аукциона и пометка уже разработанных чертежей",
      "при завершении разработки нового гаджета уведомление о компании-разработчике получают все игроки",
    ],
    details: [
      "каталог деталей пересобран на common / uncommon / rare / epic с безопасной нормализацией старых part id",
      "склады компании автоматически переводят старые детали в новый каталог без потери предметов",
      "Telegram-экраны чертежей и производства стали прозрачнее и лучше соответствуют реальному складу",
      "со склада компании теперь можно выставлять на аукцион и гаджеты, и запчасти",
      "глобальная пометка уже разработанных чертежей помогает не тратить время на дубли",
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
      "company callback-router почти полностью вынесен из legacy telegram.ts в отдельный module",
      "inventory/shop, bank/stocks и repair вынесены в отдельные Telegram-фасады",
      "legacy command-islands для auction, bank и company собраны в отдельные orchestration-helper'ы",
    ],
    details: [
      "registration gates, tutorial locks и profession autoprompt вынесены в отдельные policy-helper'ы",
      "repair вынесен в отдельный Telegram-фасад, и message/callback routing больше не сидят напрямую в основном dispatcher",
      "legacy крупные блоки внутри handleIncomingMessage постепенно заменяются на отдельные helpers и router-модули",
      "структура Telegram-слоя стала безопаснее для дальнейшего рефакторинга routes и company flows",
    ],
    createdAt: "2026-03-29T21:45:00+03:00",
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
  if (!entries.length) return "📝 История обновлений пока пуста.";
  return [
    "📝 ИСТОРИЯ ОБНОВЛЕНИЙ",
    ...entries.map((entry) => `${formatChangelogDateLabel(entry.date)} • ${entry.version} • ${entry.title}`),
  ].join("\n");
}

export function formatChangelogRecentMessage(entries: BotChangelogEntry[], _days?: number) {
  if (!entries.length) return "📝 Обновления за выбранный период не найдены.";
  return [
    "📝 НЕДАВНИЕ ОБНОВЛЕНИЯ",
    ...entries.map((entry) => [
      `${formatChangelogDateLabel(entry.date)} • ${entry.version}`,
      ...entry.summary.slice(0, 3).map((line) => `• ${line}`),
    ].join("\n")),
  ].join("\n\n");
}

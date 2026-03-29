/**
 * Repair service menu helpers extracted from the legacy telegram.ts.
 * Business mechanics stay in the original services; this module only renders and wires repair menus.
 */

export function formatRepairDuration(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  if (minutes < 60) return `${minutes} мин.`;
  const hours = Math.floor(minutes / 60);
  const leftMinutes = minutes % 60;
  return leftMinutes > 0 ? `${hours} ч. ${leftMinutes} мин.` : `${hours} ч.`;
}

export async function formatRepairServiceMenu(input: {
  userId: string;
  chatId: number;
  storage: {
    getUser: (id: string) => Promise<any>;
  };
  listRepairableGadgets: (userId: string) => Promise<any[]>;
  listRepairOrdersForCity: (city: string) => any[];
  repairGadgetRefsByChatId: Map<number, string[]>;
  repairOrderRefsByChatId: Map<number, string[]>;
  calculateRepairEstimate: (item: any) => { minPrice: number; maxPrice: number; repairTimeMs: number };
  getGadgetConditionStatusLabel: (item: any) => string;
  getCurrencySymbol: (city: string) => string;
}) {
  const user = await input.storage.getUser(input.userId);
  if (!user) return "🔧 Сервис\nИгрок не найден.";

  const gadgets = await input.listRepairableGadgets(input.userId);
  const activeOrders = input.listRepairOrdersForCity(user.city)
    .filter((order) => order.playerId === input.userId && order.status !== "failed" && order.status !== "cancelled");

  input.repairGadgetRefsByChatId.set(input.chatId, gadgets.map((item) => String(item.id)));
  input.repairOrderRefsByChatId.set(input.chatId, activeOrders.map((order) => String(order.id)));

  if (!gadgets.length && !activeOrders.length) {
    return [
      "🔧 Сервис города",
      "Повреждённых гаджетов сейчас нет.",
      "Когда у гаджета падает состояние, его можно отправить сюда на ремонт.",
    ].join("\n\n");
  }

  return [
    "🔧 Сервис города",
    activeOrders.length
      ? [
        "Активные заказы:",
        ...activeOrders.map((order, index) => `#${index + 1}. ${order.gadgetName} — ${order.statusLabel ?? order.status}`),
      ].join("\n")
      : "",
    gadgets.length
      ? [
        "Гаджеты для ремонта:",
        ...gadgets.map((item, index) => {
          const estimate = input.calculateRepairEstimate(item);
          const symbol = input.getCurrencySymbol(user.city);
          return [
            `${index + 1}. ${item.name}`,
            `Состояние: ${Math.round(item.condition ?? 0)}/${Math.round(item.maxCondition ?? 100)} (${input.getGadgetConditionStatusLabel(item)})`,
            `Стоимость ремонта: ${symbol}${estimate.minPrice} - ${symbol}${estimate.maxPrice}`,
            `Время ремонта: ${formatRepairDuration(estimate.repairTimeMs)}`,
            "Открой оценку кнопкой ниже.",
          ].join("\n");
        }),
      ].join("\n\n")
      : "",
    activeOrders.some((order) => order.status === "queued")
      ? "Очередь можно отменить кнопкой внизу."
      : "",
  ].filter(Boolean).join("\n\n");
}

export function buildRepairServiceInlineMarkup(chatId: number, repairGadgetRefsByChatId: Map<number, string[]>, repairOrderRefsByChatId: Map<number, string[]>) {
  const gadgets = repairGadgetRefsByChatId.get(chatId) ?? [];
  const orderIds = repairOrderRefsByChatId.get(chatId) ?? [];
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let index = 0; index < Math.min(gadgets.length, 8); index += 1) {
    rows.push([{ text: `🔍 Оценка #${index + 1}`, callback_data: `repair:preview:${index + 1}` }]);
  }
  for (let index = 0; index < Math.min(orderIds.length, 6); index += 1) {
    rows.push([{ text: `❌ Отменить заказ #${index + 1}`, callback_data: `repair:cancel:${orderIds[index]}` }]);
  }
  rows.push([{ text: "🔄 Обновить сервис", callback_data: "repair:refresh" }]);
  rows.push([{ text: "⬅️ Назад в город", callback_data: "repair:back" }]);
  return { inline_keyboard: rows };
}

export async function sendRepairServiceMenu(input: {
  token: string;
  chatId: number;
  userId: string;
  prefix?: string;
  rememberTelegramMenu: (userId: string, state: any) => void;
  formatRepairServiceMenu: (userId: string, chatId: number) => Promise<string>;
  buildRepairServiceInlineMarkup: (chatId: number) => Record<string, unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  input.rememberTelegramMenu(input.userId, { menu: "repair_service" });
  const base = await input.formatRepairServiceMenu(input.userId, input.chatId);
  await input.sendMessage(input.token, input.chatId, [input.prefix, base].filter(Boolean).join("\n\n"), {
    reply_markup: input.buildRepairServiceInlineMarkup(input.chatId),
  });
}

export async function formatCompanyRepairServiceMenu(input: {
  membership: any;
  chatId: number;
  listRepairOrdersForCity: (city: string) => any[];
  listRepairOrdersForCompany: (companyId: string) => any[];
  companyRepairOrderRefsByChatId: Map<number, string[]>;
  getCurrencySymbol: (city: string) => string;
  formatRepairPartsAvailability: (companyId: string, requiredParts: any[]) => string;
  hasCompanyRepairParts: (companyId: string, requiredParts: any[]) => boolean;
}) {
  const queued = input.listRepairOrdersForCity(input.membership.company.city).filter((order) => order.status === "queued");
  const assigned = input.listRepairOrdersForCompany(input.membership.company.id);
  input.companyRepairOrderRefsByChatId.set(input.chatId, [...queued, ...assigned].map((order) => order.id));

  if (!queued.length && !assigned.length) {
    return "🛠 Сервис компании\nНовых заказов пока нет.";
  }

  return [
    "🛠 Сервис компании",
    queued.length
      ? [
        "Новые городские заказы:",
        ...queued.map((order, index) => [
          `${index + 1}. ${order.gadgetName} [${order.rarity}]`,
          `Состояние: ${order.condition}/${order.maxCondition}`,
          `Оплата клиента: ${input.getCurrencySymbol(input.membership.company.city)}${order.finalPrice} (${order.minPrice}-${order.maxPrice})`,
          `Награда компании: ${Math.max(40, Math.round(Number(order.finalPrice || 0) / 8))} GRM`,
          `Время: ${formatRepairDuration(order.repairTimeMs)}`,
          input.formatRepairPartsAvailability(input.membership.company.id, order.requiredParts),
          input.hasCompanyRepairParts(input.membership.company.id, order.requiredParts)
            ? "Можно принять кнопкой ниже."
            : "Недостаточно запчастей",
        ].join("\n")),
      ].join("\n\n")
      : "",
    assigned.length
      ? [
        "Заказы компании:",
        ...assigned.map((order) => [
          `• ${order.gadgetName} — ${order.statusLabel ?? order.status}`,
          `Награда компании: ${Math.max(40, Math.round(Number(order.finalPrice || 0) / 8))} GRM`,
          order.status === "accepted"
            ? "Ожидает запуска."
            : `Завершение через: ${order.dueAt ? formatRepairDuration(Math.max(0, order.dueAt - Date.now())) : "скоро"}`,
        ].join("\n")),
      ].join("\n\n")
      : "",
  ].filter(Boolean).join("\n\n");
}

export function buildCompanyRepairServiceInlineMarkup(input: {
  membership: any;
  listRepairOrdersForCity: (city: string) => any[];
  hasCompanyRepairParts: (companyId: string, requiredParts: any[]) => boolean;
}) {
  const queued = input.listRepairOrdersForCity(input.membership.company.city).filter((order) => order.status === "queued");
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const order of queued.slice(0, 6)) {
    if (input.hasCompanyRepairParts(input.membership.company.id, order.requiredParts)) {
      rows.push([{ text: `✅ Принять: ${order.gadgetName}`, callback_data: `repairco:accept:${order.id}` }]);
    }
  }
  rows.push([{ text: "🔄 Обновить сервис", callback_data: "repairco:refresh" }]);
  rows.push([{ text: "⬅️ Назад в компанию", callback_data: "repairco:back" }]);
  return { inline_keyboard: rows };
}

export async function sendCompanyRepairServiceMenu(input: {
  token: string;
  chatId: number;
  membership: any;
  playerId: string;
  prefix?: string;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  rememberTelegramMenu: (userId: string, state: any) => void;
  formatCompanyRepairServiceMenu: (membership: any, chatId: number) => Promise<string>;
  buildCompanyRepairServiceInlineMarkup: (membership: any) => Record<string, unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  input.setCompanyMenuSection(input.chatId, "service");
  input.rememberTelegramMenu(input.playerId, { menu: "company", section: "service" });
  await input.sendMessage(
    input.token,
    input.chatId,
    [input.prefix, await input.formatCompanyRepairServiceMenu(input.membership, input.chatId)].filter(Boolean).join("\n\n"),
    {
      reply_markup: input.buildCompanyRepairServiceInlineMarkup(input.membership),
    },
  );
}

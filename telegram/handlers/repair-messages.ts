/**
 * Repair/service message commands extracted from the legacy message router.
 * Returns false when the command is unrelated to repair flows.
 */

export async function handleRepairMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  ensureCompanyHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  sendRepairServiceMenu: (token: string, chatId: number, userId: string, prefix?: string) => Promise<void>;
  repairGadgetRefsByChatId: Map<number, string[]>;
  createRepairOrder: (input: any) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  formatRepairDuration: (ms: number) => string;
  extractErrorMessage: (error: unknown) => string;
  repairOrderRefsByChatId: Map<number, string[]>;
  cancelRepairOrderByPlayer: (playerId: string, orderId: string) => Promise<any>;
  getPlayerCompanyContext: (userId: string) => Promise<any | null>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  sendCompanyRepairServiceMenu: (token: string, chatId: number, membership: any, playerId: string, prefix?: string) => Promise<void>;
  listRepairOrdersForCity: (city: string) => any[];
  getRepairOrder: (orderId: string) => any;
  hasCompanyRepairParts: (companyId: string, requiredParts: any[]) => boolean;
  acceptRepairOrder: (input: any) => Promise<any>;
  consumeCompanyRepairParts: (companyId: string, requiredParts: any[]) => void;
  startRepairOrder: (input: any) => Promise<any>;
  getTelegramIdByUserId: (userId: string) => string | undefined;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  failRepairOrder: (orderId: string, reason: string) => Promise<any>;
}) {
  const { command, args, token, chatId, message } = input;

  if (command === "/repair_service") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    await input.sendRepairServiceMenu(token, chatId, player.id);
    return true;
  }

  if (command === "/repair_send") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    const ref = String(args[0] || "").trim();
    if (!ref) {
      await input.sendRepairServiceMenu(token, chatId, player.id, "Выбери гаджет кнопкой ниже.");
      return true;
    }
    try {
      const gadgetRefs = input.repairGadgetRefsByChatId.get(chatId) ?? [];
      const gadgetRef = gadgetRefs[Math.max(0, Number(ref) - 1)] ?? ref;
      const order = await input.createRepairOrder({ userId: player.id, gadgetRef, playerChatId: chatId });
      await input.sendRepairServiceMenu(
        token,
        chatId,
        player.id,
        [
          "✅ Гаджет отправлен в сервис.",
          `Стоимость ремонта: ${input.getCurrencySymbol(player.city)}${order.minPrice} - ${input.getCurrencySymbol(player.city)}${order.maxPrice}.`,
          `Срок ремонта: ${input.formatRepairDuration(order.repairTimeMs)}.`,
        ].join("\n"),
      );
    } catch (error) {
      await input.sendRepairServiceMenu(token, chatId, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/repair_cancel") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    const ref = String(args[0] || "").trim();
    if (!ref) {
      await input.sendRepairServiceMenu(token, chatId, player.id, "Выбери заказ на отмену кнопкой ниже.");
      return true;
    }
    try {
      const orderIds = input.repairOrderRefsByChatId.get(chatId) ?? [];
      const orderId = orderIds[Math.max(0, Number(ref) - 1)] ?? ref;
      await input.cancelRepairOrderByPlayer(player.id, orderId);
      await input.sendRepairServiceMenu(token, chatId, player.id, "✅ Заказ на ремонт отменён. Гаджет разблокирован.");
    } catch (error) {
      await input.sendRepairServiceMenu(token, chatId, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/company_service") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await input.sendWithMainKeyboard(token, chatId, "Раздел сервиса компании доступен только CEO.");
      return true;
    }
    await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id);
    return true;
  }

  if (command === "/company_service_accept") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await input.sendWithMainKeyboard(token, chatId, "Раздел сервиса компании доступен только CEO.");
      return true;
    }
    const ref = String(args[0] || "").trim();
    if (!ref) {
      await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, "Выбери заказ кнопкой ниже.");
      return true;
    }
    try {
      const queued = input.listRepairOrdersForCity(membership.company.city).filter((order) => order.status === "queued");
      const order = queued[Math.max(0, Number(ref) - 1)] ?? input.getRepairOrder(ref);
      if (!order) throw new Error("Заказ не найден");
      if (!input.hasCompanyRepairParts(membership.company.id, order.requiredParts)) {
        throw new Error("Недостаточно запчастей");
      }
      await input.acceptRepairOrder({
        orderId: order.id,
        company: membership.company,
        acceptedBy: player.id,
        companyChatId: chatId,
      });
      input.consumeCompanyRepairParts(membership.company.id, order.requiredParts);
      await input.startRepairOrder({ orderId: order.id, companyId: membership.company.id, startedBy: player.id });
      const playerChatId = Number(input.getTelegramIdByUserId(order.playerId) || order.playerChatId || 0);
      if (Number.isFinite(playerChatId) && playerChatId > 0) {
        await input.sendMessage(token, playerChatId, [
          "✅ Компания приняла заказ.",
          `Гаджет: ${order.gadgetName}`,
          `Срок ремонта: ${input.formatRepairDuration(order.repairTimeMs)}.`,
        ].join("\n"));
      }
      await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, "✅ Заказ принят. Запчасти списаны, ремонт запущен.");
    } catch (error) {
      const order = input.getRepairOrder(String(args[0] || "").trim());
      if (order && order.status === "accepted" && order.assignedCompanyId === membership.company.id) {
        await input.failRepairOrder(order.id, "Ошибка запуска ремонта");
      }
      await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/company_service_start") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await input.sendWithMainKeyboard(token, chatId, "Раздел сервиса компании доступен только CEO.");
      return true;
    }
    const orderId = String(args[0] || "").trim();
    if (!orderId) {
      await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, "Укажи заказ для запуска.");
      return true;
    }
    try {
      await input.startRepairOrder({ orderId, companyId: membership.company.id, startedBy: player.id });
      await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, "✅ Ремонт запущен.");
    } catch (error) {
      await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}

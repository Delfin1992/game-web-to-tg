/**
 * Repair-related callback handler extracted from the legacy callback router.
 * Returns null when the callback does not belong to repair flows.
 */

export async function handleRepairCallback(input: {
  data: string;
  token: string;
  chatId: number;
  messageId?: number;
  query: any;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  ensureCompanyHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  formatRepairServiceMenu: (userId: string, chatId: number) => Promise<string>;
  buildRepairServiceInlineMarkup: (chatId: number) => any;
  callTelegramApi: (token: string, method: string, body: Record<string, unknown>) => Promise<any>;
  extractErrorMessage: (error: unknown) => string;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  sendCityHubSummary: (token: string, chatId: number, userId: string, prefix?: string) => Promise<void>;
  repairGadgetRefsByChatId: Map<number, string[]>;
  listRepairableGadgets: (userId: string) => Promise<any[]>;
  sendRepairServiceMenu: (token: string, chatId: number, userId: string, prefix?: string) => Promise<void>;
  calculateRepairEstimate: (gadget: any) => any;
  getGadgetConditionStatusLabel: (gadget: any) => string;
  getCurrencySymbol: (city: string) => string;
  formatRepairDuration: (ms: number) => string;
  createRepairOrder: (input: any) => Promise<any>;
  cancelRepairOrderByPlayer: (playerId: string, orderId: string) => Promise<any>;
  getPlayerCompanyContext: (userId: string) => Promise<any | null>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  formatCompanyRepairServiceMenu: (membership: any, chatId: number) => Promise<string>;
  buildCompanyRepairServiceInlineMarkup: (membership: any) => any;
  sendCompanyRootMenu: (token: string, chatId: number, player: any, prefix?: string) => Promise<void>;
  getRepairOrder: (orderId: string) => any;
  sendCompanyRepairServiceMenu: (token: string, chatId: number, membership: any, playerId: string, prefix?: string) => Promise<void>;
  hasCompanyRepairParts: (companyId: string, requiredParts: any[]) => boolean;
  acceptRepairOrder: (input: any) => Promise<any>;
  consumeCompanyRepairParts: (companyId: string, requiredParts: any[]) => void;
  startRepairOrder: (input: any) => Promise<any>;
  getTelegramIdByUserId: (userId: string) => string | undefined;
  failRepairOrder: (orderId: string, reason: string) => Promise<any>;
}) {
  const { data, token, chatId, messageId, query } = input;

  if (data.startsWith("repair:")) {
    const player = await input.resolveOrCreateTelegramPlayer(query.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/repair_service" }))) {
      return { handled: true, callbackText: "Сервис недоступен" };
    }

    const [, action, rawValue = ""] = data.split(":");
    if (action === "refresh") {
      const text = await input.formatRepairServiceMenu(player.id, chatId);
      if (messageId) {
        try {
          await input.callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: input.buildRepairServiceInlineMarkup(chatId),
          });
        } catch (error) {
          if (!input.extractErrorMessage(error).toLowerCase().includes("message is not modified")) {
            throw error;
          }
        }
      } else {
        await input.sendMessage(token, chatId, text, { reply_markup: input.buildRepairServiceInlineMarkup(chatId) });
      }
      return { handled: true, callbackText: "Сервис обновлён", shouldClearInlineButtons: false };
    }

    if (action === "back") {
      await input.sendCityHubSummary(token, chatId, player.id);
      return { handled: true, callbackText: "Возврат в город" };
    }

    if (action === "preview") {
      const gadgetRefs = input.repairGadgetRefsByChatId.get(chatId) ?? [];
      const gadgetRef = gadgetRefs[Math.max(0, Number(rawValue) - 1)];
      if (!gadgetRef) {
        await input.sendRepairServiceMenu(token, chatId, player.id, "Гаджет не найден. Обнови список.");
        return { handled: true, callbackText: "Оценка ремонта" };
      }
      const gadgets = await input.listRepairableGadgets(player.id);
      const gadget = gadgets.find((item) => String(item.id) === String(gadgetRef));
      if (!gadget) {
        await input.sendRepairServiceMenu(token, chatId, player.id, "Гаджет больше недоступен для ремонта.");
        return { handled: true, callbackText: "Оценка ремонта" };
      }
      const estimate = input.calculateRepairEstimate(gadget);
      const text = [
        "🔧 Оценка ремонта",
        `Гаджет: ${gadget.name}`,
        `Состояние: ${Math.round(gadget.condition ?? 0)}/${Math.round(gadget.maxCondition ?? 100)} (${input.getGadgetConditionStatusLabel(gadget)})`,
        `Стоимость ремонта: ${input.getCurrencySymbol(player.city)}${estimate.minPrice} - ${input.getCurrencySymbol(player.city)}${estimate.maxPrice}`,
        `Срок ремонта: ${input.formatRepairDuration(estimate.repairTimeMs)}`,
        "",
        "Нужно для ремонта:",
        ...estimate.requiredParts.map((part: any) => `• ${part.label} x${part.quantity}`),
        "",
        "Подтвердить отправку в сервис?",
      ].join("\n");
      const reply_markup = {
        inline_keyboard: [
          [{ text: "✅ Отправить в сервис", callback_data: `repair:confirm:${rawValue}` }],
          [{ text: "⬅️ Назад к списку", callback_data: "repair:refresh" }],
        ],
      };
      if (messageId) {
        await input.callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text,
          reply_markup,
        });
      } else {
        await input.sendMessage(token, chatId, text, { reply_markup });
      }
      return { handled: true, callbackText: "Оценка ремонта", shouldClearInlineButtons: false };
    }

    if (action === "confirm") {
      const gadgetRefs = input.repairGadgetRefsByChatId.get(chatId) ?? [];
      const gadgetRef = gadgetRefs[Math.max(0, Number(rawValue) - 1)] ?? rawValue;
      try {
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
      return { handled: true, callbackText: "Заказ создан" };
    }

    if (action === "cancel") {
      try {
        await input.cancelRepairOrderByPlayer(player.id, rawValue);
        await input.sendRepairServiceMenu(token, chatId, player.id, "✅ Заказ на ремонт отменён. Гаджет разблокирован.");
      } catch (error) {
        await input.sendRepairServiceMenu(token, chatId, player.id, `❌ ${input.extractErrorMessage(error)}`);
      }
      return { handled: true, callbackText: "Заказ отменён" };
    }
  }

  if (data.startsWith("repairco:")) {
    const player = await input.resolveOrCreateTelegramPlayer(query.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/company_service" }))) {
      return { handled: true, callbackText: "Сервис компании недоступен" };
    }
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await input.sendWithMainKeyboard(token, chatId, "Раздел сервиса компании доступен только CEO.");
      return { handled: true, callbackText: "Только CEO" };
    }

    const [, action, orderId = ""] = data.split(":");
    if (action === "refresh") {
      const text = await input.formatCompanyRepairServiceMenu(membership, chatId);
      if (messageId) {
        try {
          await input.callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: input.buildCompanyRepairServiceInlineMarkup(membership),
          });
        } catch (error) {
          if (!input.extractErrorMessage(error).toLowerCase().includes("message is not modified")) {
            throw error;
          }
        }
      } else {
        await input.sendMessage(token, chatId, text, { reply_markup: input.buildCompanyRepairServiceInlineMarkup(membership) });
      }
      return { handled: true, callbackText: "Сервис обновлён", shouldClearInlineButtons: false };
    }

    if (action === "back") {
      await input.sendCompanyRootMenu(token, chatId, player);
      return { handled: true, callbackText: "Возврат в компанию" };
    }

    if (action === "accept") {
      const order = input.getRepairOrder(orderId);
      if (!order) {
        await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, "Заказ уже недоступен.");
        return { handled: true, callbackText: "Заказ принят" };
      }
      try {
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
            `Ремонт уже запущен. Срок: ${input.formatRepairDuration(order.repairTimeMs)}.`,
          ].join("\n"));
        }
        await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, "✅ Заказ принят. Запчасти списаны, ремонт запущен.");
      } catch (error) {
        if (order && order.status === "accepted" && order.assignedCompanyId === membership.company.id) {
          await input.failRepairOrder(order.id, "Ошибка запуска ремонта");
        }
        await input.sendCompanyRepairServiceMenu(token, chatId, membership, player.id, `❌ ${input.extractErrorMessage(error)}`);
      }
      return { handled: true, callbackText: "Заказ принят" };
    }
  }

  return null;
}

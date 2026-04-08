export function createInventoryTelegramModule(deps: {
  handleInventoryMessage: (input: any) => Promise<boolean>;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  resolveTelegramSnapshot: (user?: any) => Promise<any>;
  inventoryRefsByChatId: Map<number, string[]>;
  buildInventoryMenu: (snapshot: any) => { text: string; refs: string[] };
  formatNotices: (notices: any[]) => string;
  buildInventoryInlineButtons: (view: any) => any;
  callTelegramApi: (token: string, method: string, payload: Record<string, unknown>) => Promise<any>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  buildInventoryItemDetailText: (item: any, index: number) => string;
  buildInventoryItemDetailInlineButtons: (item: any, index: number) => any;
  handleIncomingMessage: (token: string, webAppUrl: string, message: any) => Promise<void>;
  buyShopItem: (userId: string, ref: string) => Promise<any>;
  tryApplyTutorialEvent: (userId: string, event: string) => Promise<any>;
  formatShopPurchaseResultText: (input: any) => string;
  buildShopPurchaseInlineMarkup: (item: any) => Record<string, unknown> | undefined;
  sendWithCityHubKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  extractErrorMessage: (error: unknown) => string;
  answerCallbackQuery: (token: string, callbackId: string, text?: string) => Promise<any>;
  useInventoryItem: (userId: string, ref: string) => Promise<any>;
  toggleGearItem: (userId: string, ref: string) => Promise<any>;
  formatStats: (stats: Record<string, number>) => string;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
}) {
  return {
    async handleMessage(input: any) {
      return deps.handleInventoryMessage(input);
    },

    async handleCallback(input: {
      data: string;
      token: string;
      webAppUrl: string;
      chatId: number;
      messageId?: number;
      callbackId: string;
      query: any;
    }) {
      const { data, token, webAppUrl, chatId, messageId, callbackId, query } = input;

      if (data === "inv:open") {
        const snapshot = await deps.resolveTelegramSnapshot(query.from);
        const inventoryView = deps.buildInventoryMenu(snapshot);
        deps.inventoryRefsByChatId.set(chatId, inventoryView.refs);
        const notices = deps.formatNotices(snapshot.notices);
        const base = notices ? `${inventoryView.text}\n\n${notices}` : inventoryView.text;
        if (messageId) {
          await deps.callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: base,
            reply_markup: deps.buildInventoryInlineButtons(inventoryView),
          });
        } else {
          await deps.sendMessage(token, chatId, base, {
            reply_markup: deps.buildInventoryInlineButtons(inventoryView),
          });
        }
        return { handled: true as const, callbackText: "Инвентарь" };
      }

      const inventoryActionMatch = data.match(/^inv:(inspect|use|equip|scrap):(\d+)$/);
      if (inventoryActionMatch) {
        const action = inventoryActionMatch[1];
        const index = inventoryActionMatch[2];
        if (action === "inspect") {
          const snapshot = await deps.resolveTelegramSnapshot(query.from);
          const inventoryView = deps.buildInventoryMenu(snapshot);
          deps.inventoryRefsByChatId.set(chatId, inventoryView.refs);
          const item = snapshot.game.inventory
            .slice()
            .sort((a: any, b: any) => {
              const order: Record<string, number> = { consumable: 1, gear: 2, gadget: 3, part: 4 };
              return (order[a.type] - order[b.type]) || a.name.localeCompare(b.name, "ru");
            })[Math.max(0, Number(index) - 1)];
          if (!item) {
            if (messageId) {
              await deps.callTelegramApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: messageId,
                text: "❌ Предмет не найден. Открой инвентарь заново.",
                reply_markup: deps.buildInventoryInlineButtons(inventoryView),
              });
            } else {
              await deps.sendMessage(token, chatId, "❌ Предмет не найден. Открой инвентарь заново.");
            }
            return { handled: true as const, callbackText: "Инвентарь" };
          }

          const text = deps.buildInventoryItemDetailText(item, Number(index));
          const replyMarkup = deps.buildInventoryItemDetailInlineButtons(item, Number(index));
          if (messageId) {
            await deps.callTelegramApi(token, "editMessageText", {
              chat_id: chatId,
              message_id: messageId,
              text,
              reply_markup: replyMarkup,
            });
          } else {
            await deps.sendMessage(token, chatId, text, { reply_markup: replyMarkup });
          }
          return { handled: true as const, callbackText: "Инвентарь" };
        }

        const command = action === "use"
          ? `/use ${index}`
          : action === "equip"
            ? `/equip ${index}`
            : `/scrap ${index}`;
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: command,
        });
        return { handled: true as const, callbackText: "Инвентарь" };
      }

      const shopPickMatch = data.match(/^shop:pick:(.+)$/);
      if (shopPickMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        try {
          const result = await deps.buyShopItem(player.id, shopPickMatch[1]);
          const tutorialAdvance = await deps.tryApplyTutorialEvent(
            player.id,
            result.item.type === "consumable" ? "first_course_item_bought" : "first_gadget_bought",
          );
          const lines = deps.formatShopPurchaseResultText({
            itemName: result.item.name,
            balance: result.user.balance,
            city: result.user.city,
            price: Number(result.item.price || 0),
            tutorialAdvance,
            notices: result.notices,
          });
          const purchaseMarkup = deps.buildShopPurchaseInlineMarkup(result.item);
          if (purchaseMarkup) {
            await deps.sendMessage(token, chatId, lines, { reply_markup: purchaseMarkup });
          } else {
            await deps.sendWithCityHubKeyboard(token, chatId, lines);
          }
          await deps.answerCallbackQuery(token, callbackId);
        } catch (error) {
          await deps.sendWithCityHubKeyboard(token, chatId, `❌ ${deps.extractErrorMessage(error)}`);
        }
        return { handled: true as const, callbackText: "Покупка" };
      }

      const shopBuyActionMatch = data.match(/^shopbuy:(use|equip):([^:]+)(?::(.+))?$/);
      if (shopBuyActionMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        const [, action, itemRef, priceRaw] = shopBuyActionMatch;
        const purchasePrice = Math.max(0, Number(priceRaw || 0));
        if (action === "use") {
          try {
            const result = await deps.useInventoryItem(player.id, itemRef);
            const tutorialAdvance = await deps.tryApplyTutorialEvent(player.id, "first_course_item_used");
            const lines = [
              deps.formatShopPurchaseResultText({
                itemName: result.item.name,
                balance: result.user.balance,
                city: result.user.city,
                price: purchasePrice,
                tutorialAdvance,
                used: true,
                bonusesText: deps.formatStats(result.item.stats),
                notices: result.notices,
              }),
            ];
            await deps.callTelegramApi(token, "editMessageText", {
              chat_id: chatId,
              message_id: query.message?.message_id,
              text: lines.join("\n"),
              reply_markup: { inline_keyboard: [] },
            });
            await deps.answerCallbackQuery(token, callbackId);
          } catch (error) {
            await deps.sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${deps.extractErrorMessage(error)}`);
          }
          return { handled: true as const, callbackText: "Использование" };
        }
        if (action === "equip") {
          try {
            const result = await deps.toggleGearItem(player.id, itemRef);
            const tutorialAdvance = result.isEquipped
              ? await deps.tryApplyTutorialEvent(player.id, "first_gadget_equipped")
              : null;
            const lines = [
              deps.formatShopPurchaseResultText({
                itemName: result.item.name,
                balance: result.user.balance,
                city: result.user.city,
                price: purchasePrice,
                tutorialAdvance,
                equipped: result.isEquipped,
                bonusesText: deps.formatStats(result.item.stats),
              }),
            ];
            await deps.callTelegramApi(token, "editMessageText", {
              chat_id: chatId,
              message_id: query.message?.message_id,
              text: lines.join("\n"),
              reply_markup: { inline_keyboard: [] },
            });
            await deps.answerCallbackQuery(token, callbackId);
          } catch (error) {
            await deps.sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${deps.extractErrorMessage(error)}`);
          }
          return { handled: true as const, callbackText: "Экипировка" };
        }
      }

      return { handled: false as const };
    },
  };
}

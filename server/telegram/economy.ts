export function createEconomyTelegramModule(deps: {
  handleEconomyMessage: (input: any) => Promise<boolean>;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  resolveTelegramSnapshot: (user?: any) => Promise<any>;
  rememberTelegramMenu: (userId: string, state: any) => void;
  pendingActionByChatId: Map<number, any>;
  formatBankProgramsMenu: (productType: any, snapshot: any) => string;
  buildBankSelectionReplyMarkup: (productType: any) => any;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  sendWithBankKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  parseBankOpenInput: (value: string) => any;
  openBankProduct: (userId: string, type: any, programRef: string, amount: number, days: number) => Promise<any>;
  formatLiveProfile: (user: any, state: any) => Promise<string>;
  getCurrencySymbol: (city: string) => string;
  extractErrorMessage: (error: unknown) => string;
  closeBankProduct: (userId: string, action: "repay" | "withdraw") => Promise<any>;
  formatStocksMenu: (userId: string) => Promise<string>;
  formatStocksNewsMenu: (userId: string) => Promise<string>;
  buildStocksHomeReplyMarkup: () => any;
  buyStockAsset: (userId: string, ticker: string, quantity: number) => Promise<any>;
  sellStockAsset: (userId: string, ticker: string, quantity: number) => Promise<any>;
  tryApplyTutorialEvent: (userId: string, event: string) => Promise<any>;
  formatTutorialAdvanceNotice: (advance: any, city: string) => string;
}) {
  return {
    async handleMessage(input: any) {
      if (await deps.handleEconomyMessage(input)) {
        return true;
      }

      const { command, args, token, chatId, message } = input;

      if (command === "/credits" || command === "/deposits") {
        const snapshot = await deps.resolveTelegramSnapshot(message.from);
        if (!(await deps.ensureCityHubAccess(token, chatId, snapshot.user, message))) return true;
        const productType = command === "/credits" ? "credit" : "deposit";
        deps.rememberTelegramMenu(snapshot.user.id, { menu: "bank" });
        deps.pendingActionByChatId.delete(chatId);
        await deps.sendMessage(token, chatId, deps.formatBankProgramsMenu(productType, snapshot), { reply_markup: deps.buildBankSelectionReplyMarkup(productType) });
        deps.pendingActionByChatId.set(chatId, { type: "open_bank_product", productType });
        return true;
      }

      if (command === "/credit" || command === "/deposit") {
        const parsed = deps.parseBankOpenInput(args.join(" "));
        if (!parsed) {
          await deps.sendWithBankKeyboard(token, chatId, `Использование: ${command} <номер программы> <сумма>\nПример: ${command} 1 800`);
          return true;
        }
        const player = await deps.resolveOrCreateTelegramPlayer(message.from);
        if (!(await deps.ensureCityHubAccess(token, chatId, player, message))) return true;
        const type = command === "/credit" ? "credit" : "deposit";
        try {
          const result = await deps.openBankProduct(player.id, type, parsed.programRef, parsed.amount, parsed.days);
          await deps.sendWithBankKeyboard(token, chatId, [type === "credit" ? `✅ РљСЂРµРґРёС‚ РѕС„РѕСЂРјР»РµРЅ: ${result.program.name}` : `✅ Р’РєР»Р°Рґ РѕС‚РєСЂС‹С‚: ${result.program.name}`, ...result.notices, "", await deps.formatLiveProfile(result.user, result.state)].join("\n"));
        } catch (error) {
          await deps.sendWithBankKeyboard(token, chatId, `❌ ${deps.extractErrorMessage(error)}`);
        }
        return true;
      }

      if (command === "/repay" || command === "/withdraw") {
        const player = await deps.resolveOrCreateTelegramPlayer(message.from);
        if (!(await deps.ensureCityHubAccess(token, chatId, player, message))) return true;
        const action = command === "/repay" ? "repay" : "withdraw";
        try {
          const result = await deps.closeBankProduct(player.id, action);
          const symbol = deps.getCurrencySymbol(result.user.city);
          await deps.sendWithBankKeyboard(token, chatId, [action === "repay" ? `✅ РљСЂРµРґРёС‚ РїРѕРіР°С€РµРЅ: -${symbol}${Math.round(result.amount)}` : `✅ Р’РєР»Р°Рґ СЃРЅСЏС‚: +${symbol}${Math.round(result.amount)}`, ...result.notices, "", await deps.formatLiveProfile(result.user, result.state)].join("\n"));
        } catch (error) {
          await deps.sendWithBankKeyboard(token, chatId, `❌ ${deps.extractErrorMessage(error)}`);
        }
        return true;
      }

      return false;
    },

    async handleCallback(input: {
      data: string;
      token: string;
      chatId: number;
      query: any;
    }) {
      const { data, token, chatId, query } = input;

      if (!data.startsWith("stocks:")) {
        return { handled: false as const };
      }

      const player = await deps.resolveOrCreateTelegramPlayer(query.from);
      if (!(await deps.ensureCityHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/stocks" }))) {
        return { handled: true as const, callbackText: "Биржа недоступна" };
      }

      const [, action, ticker = "", qtyRaw = "0"] = data.split(":");
      try {
        if (action === "refresh") {
          await deps.sendMessage(token, chatId, await deps.formatStocksMenu(player.id), {
            reply_markup: deps.buildStocksHomeReplyMarkup(),
          });
          return { handled: true as const, callbackText: "Открой биржу заново" };
        }

        if (action === "news") {
          const text = await deps.formatStocksNewsMenu(player.id);
          await deps.sendMessage(token, chatId, text, {
            reply_markup: deps.buildStocksHomeReplyMarkup(),
          });
          return { handled: true as const, callbackText: "Новости рынка" };
        }

        const quantity = Math.max(1, Math.floor(Number(qtyRaw || 0)));
        if (!ticker || !Number.isFinite(quantity)) {
          return { handled: true as const, callbackText: "Неверная сделка" };
        }

        if (action === "buy") {
          const result = await deps.buyStockAsset(player.id, ticker, quantity);
          const tutorialAdvance = await deps.tryApplyTutorialEvent(player.id, "first_stock_bought");
          const text = [
            `✅ Куплено: ${result.ticker} x${result.quantity}`,
            `Цена: ${deps.getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
            `Списано: ${deps.getCurrencySymbol(player.city)}${result.totalCost.toFixed(2)}`,
            deps.formatTutorialAdvanceNotice(tutorialAdvance, player.city),
            "",
            await deps.formatStocksMenu(player.id),
          ].filter(Boolean).join("\n");
          await deps.sendMessage(token, chatId, text, { reply_markup: deps.buildStocksHomeReplyMarkup() });
          return { handled: true as const, callbackText: `Куплено ${ticker}` };
        }

        if (action === "sell") {
          const result = await deps.sellStockAsset(player.id, ticker, quantity);
          const text = [
            `✅ Продано: ${result.ticker} x${result.quantity}`,
            `Цена: ${deps.getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
            `Получено: ${deps.getCurrencySymbol(player.city)}${result.totalRevenue.toFixed(2)}`,
            "",
            await deps.formatStocksMenu(player.id),
          ].join("\n");
          await deps.sendMessage(token, chatId, text, { reply_markup: deps.buildStocksHomeReplyMarkup() });
          return { handled: true as const, callbackText: `Продано ${ticker}` };
        }
      } catch (error) {
        await deps.sendWithBankKeyboard(token, chatId, `❌ ${deps.extractErrorMessage(error)}`);
        return { handled: true as const, callbackText: "Ошибка биржи" };
      }

      return { handled: false as const };
    },
  };
}

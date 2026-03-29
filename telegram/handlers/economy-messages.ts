/**
 * Economy/bank/stock message commands extracted from the legacy message router.
 * Returns false when the command is unrelated to economy flows.
 */

export async function handleEconomyMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveTelegramSnapshot: (user?: any) => Promise<any>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  formatBankMenu: (snapshot: any) => string;
  formatNotices: (notices: any[]) => string;
  rememberTelegramMenu: (userId: string, state: any) => void;
  sendWithBankKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  getStockMarketSnapshot: (userId: string) => Promise<any>;
  formatStocksMenu: (userId: string) => Promise<string>;
  formatStocksNewsMenu: (userId: string) => Promise<string>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  buildStocksHomeReplyMarkup: () => any;
  buildStocksTickerReplyMarkup: (snapshot: any, action: "buy" | "sell") => any;
  buyStockAsset: (userId: string, ticker: string, quantity: number) => Promise<any>;
  tryApplyTutorialEvent: (userId: string, event: string) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  formatTutorialAdvanceNotice: (advance: any, city: string) => string;
  sellStockAsset: (userId: string, ticker: string, quantity: number) => Promise<any>;
  formatGramExchangeMenu: (snapshot: any) => string;
  pendingActionByChatId: Map<number, any>;
  parseDecimalInput: (value: string) => number | null;
  exchangeCurrencyToGram: (userId: string, amount: number) => Promise<any>;
  formatGramValue: (value: number) => string;
  formatLiveProfile: (user: any, state: any) => Promise<string>;
  exchangeGramToCurrency: (userId: string, amount: number) => Promise<any>;
  extractErrorMessage: (error: unknown) => string;
}) {
  const { command, args, token, chatId, message } = input;

  if (command === "/bank") {
    const snapshot = await input.resolveTelegramSnapshot(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, snapshot.user, message))) return true;
    const base = input.formatBankMenu(snapshot);
    const notices = input.formatNotices(snapshot.notices);
    input.rememberTelegramMenu(snapshot.user.id, { menu: "bank" });
    await input.sendWithBankKeyboard(token, chatId, notices ? `${base}\n\n${notices}` : base);
    return true;
  }

  if (command === "/stocks") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    input.rememberTelegramMenu(player.id, { menu: "bank" });
    await input.sendMessage(token, chatId, await input.formatStocksMenu(player.id), {
      reply_markup: input.buildStocksHomeReplyMarkup(),
    });
    return true;
  }

  if (command === "/stocks_news") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    input.rememberTelegramMenu(player.id, { menu: "bank" });
    await input.sendMessage(token, chatId, await input.formatStocksNewsMenu(player.id), {
      reply_markup: input.buildStocksHomeReplyMarkup(),
    });
    return true;
  }

  if (command === "/stocks_buy") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    const ticker = String(args[0] ?? "").trim().toUpperCase();
    const quantity = Number(args[1] ?? 0);
    if (!ticker || !Number.isFinite(quantity) || quantity <= 0) {
      const snapshot = await input.getStockMarketSnapshot(player.id);
      input.pendingActionByChatId.set(chatId, { type: "stocks_buy_select" });
      await input.sendMessage(token, chatId, "Выбери бумагу для покупки:", {
        reply_markup: input.buildStocksTickerReplyMarkup(snapshot, "buy"),
      });
      return true;
    }
    try {
      const result = await input.buyStockAsset(player.id, ticker, quantity);
      const tutorialAdvance = await input.tryApplyTutorialEvent(player.id, "first_stock_bought");
      await input.sendMessage(
        token,
        chatId,
        [
          `✅ Куплено: ${result.ticker} x${result.quantity}`,
          `Цена: ${input.getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
          `Списано: ${input.getCurrencySymbol(player.city)}${result.totalCost.toFixed(2)}`,
          input.formatTutorialAdvanceNotice(tutorialAdvance, player.city),
          "",
          await input.formatStocksMenu(player.id),
        ].filter(Boolean).join("\n"),
        { reply_markup: input.buildStocksHomeReplyMarkup() },
      );
    } catch (error) {
      await input.sendMessage(token, chatId, `❌ ${input.extractErrorMessage(error)}`, {
        reply_markup: input.buildStocksHomeReplyMarkup(),
      });
    }
    return true;
  }

  if (command === "/stocks_sell") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    const ticker = String(args[0] ?? "").trim().toUpperCase();
    const quantity = Number(args[1] ?? 0);
    if (!ticker || !Number.isFinite(quantity) || quantity <= 0) {
      const snapshot = await input.getStockMarketSnapshot(player.id);
      if (!snapshot.holdings.length) {
        await input.sendMessage(token, chatId, "В портфеле пока нет бумаг для продажи.", {
          reply_markup: input.buildStocksHomeReplyMarkup(),
        });
        return true;
      }
      input.pendingActionByChatId.set(chatId, { type: "stocks_sell_select" });
      await input.sendMessage(token, chatId, "Выбери бумагу для продажи:", {
        reply_markup: input.buildStocksTickerReplyMarkup(snapshot, "sell"),
      });
      return true;
    }
    try {
      const result = await input.sellStockAsset(player.id, ticker, quantity);
      await input.sendMessage(
        token,
        chatId,
        [
          `✅ Продано: ${result.ticker} x${result.quantity}`,
          `Цена: ${input.getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
          `Получено: ${input.getCurrencySymbol(player.city)}${result.totalRevenue.toFixed(2)}`,
          "",
          await input.formatStocksMenu(player.id),
        ].join("\n"),
        { reply_markup: input.buildStocksHomeReplyMarkup() },
      );
    } catch (error) {
      await input.sendMessage(token, chatId, `❌ ${input.extractErrorMessage(error)}`, {
        reply_markup: input.buildStocksHomeReplyMarkup(),
      });
    }
    return true;
  }

  if (command === "/gram" || command === "/exchange") {
    const snapshot = await input.resolveTelegramSnapshot(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, snapshot.user, message))) return true;
    input.rememberTelegramMenu(snapshot.user.id, { menu: "bank" });
    await input.sendWithBankKeyboard(token, chatId, input.formatGramExchangeMenu(snapshot));
    return true;
  }

  if (command === "/exchange_to_gram") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    const amountRaw = args.join(" ").trim();
    if (!amountRaw) {
      input.pendingActionByChatId.set(chatId, { type: "exchange_to_gram" });
      input.rememberTelegramMenu(player.id, { menu: "bank" });
      await input.sendWithBankKeyboard(token, chatId, "Введи сумму в валюте для покупки GRM.");
      return true;
    }
    const amountCurrency = input.parseDecimalInput(amountRaw);
    if (amountCurrency === null) {
      await input.sendWithBankKeyboard(token, chatId, "Неверный формат. Пример: /exchange_to_gram 500");
      return true;
    }
    try {
      const result = await input.exchangeCurrencyToGram(player.id, amountCurrency);
      await input.sendWithBankKeyboard(
        token,
        chatId,
        [
          `✅ Обмен выполнен: -${input.getCurrencySymbol(result.user.city)}${result.amountCurrency}, +${input.formatGramValue(result.amountGram)} GRM`,
          "",
          await input.formatLiveProfile(result.user, result.state),
        ].join("\n"),
      );
    } catch (error) {
      await input.sendWithBankKeyboard(token, chatId, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/exchange_from_gram") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    const amountRaw = args.join(" ").trim();
    if (!amountRaw) {
      input.pendingActionByChatId.set(chatId, { type: "exchange_from_gram" });
      input.rememberTelegramMenu(player.id, { menu: "bank" });
      await input.sendWithBankKeyboard(token, chatId, "Введи количество GRM для продажи.");
      return true;
    }
    const amountGram = input.parseDecimalInput(amountRaw);
    if (amountGram === null) {
      await input.sendWithBankKeyboard(token, chatId, "Неверный формат. Пример: /exchange_from_gram 12.5");
      return true;
    }
    try {
      const result = await input.exchangeGramToCurrency(player.id, amountGram);
      await input.sendWithBankKeyboard(
        token,
        chatId,
        [
          `✅ Обмен выполнен: -${input.formatGramValue(result.amountGram)} GRM, +${input.getCurrencySymbol(result.user.city)}${result.amountCurrency}`,
          "",
          await input.formatLiveProfile(result.user, result.state),
        ].join("\n"),
      );
    } catch (error) {
      await input.sendWithBankKeyboard(token, chatId, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}

/**
 * Inventory/shop message commands extracted from the legacy message router.
 * Returns false when the command is unrelated to inventory/shop flows.
 */

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const normalized = Number(value || 0);
  const abs = Math.abs(normalized);
  const units = [
    { threshold: 1_000_000_000_000, suffix: "t" },
    { threshold: 1_000_000_000, suffix: "b" },
    { threshold: 1_000_000, suffix: "m" },
    { threshold: 1_000, suffix: "k" },
  ];
  const rounded = (input: number) => Number(input.toFixed(1)).toString();

  for (const unit of units) {
    if (abs >= unit.threshold) {
      return `${rounded(normalized / unit.threshold)}${unit.suffix}`;
    }
  }

  return rounded(normalized);
}

export async function handleInventoryMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveTelegramSnapshot: (user?: any) => Promise<any>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  sendShopMenu: (token: string, chatId: number, snapshot: any, userId: string, tab?: any) => Promise<void>;
  resolveShopSellRefFromChat: (chatId: number, ref: string) => string;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  sellInventoryItem: (userId: string, ref: string) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  formatLiveProfile: (user: any, state: any) => Promise<string>;
  formatNotices: (notices: any[]) => string;
  sendWithCityHubKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  extractErrorMessage: (error: unknown) => string;
  buyShopItem: (userId: string, ref: string) => Promise<any>;
  resolveShopBuyRefFromChat: (chatId: number, ref: string) => string;
  tryApplyTutorialEvent: (userId: string, event: string) => Promise<any>;
  updateWeeklyQuestProgress: (user: any, key: any, amount?: number) => any;
  formatStats: (stats: Record<string, number>) => string;
  formatWeeklyQuestProgressNotice: (progress: any) => string;
  formatTutorialAdvanceNotice: (advance: any, city: string) => string;
  buildShopPurchaseInlineMarkup: (item: any) => Record<string, unknown> | undefined;
  buildInventoryMenu: (snapshot: any) => { text: string; refs: string[] };
  inventoryRefsByChatId: Map<number, string[]>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  buildInventoryInlineButtons: (view: any) => any;
  resolveInventoryRefFromChat: (chatId: number, ref: string) => string;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  useInventoryItem: (userId: string, ref: string) => Promise<any>;
  toggleGearItem: (userId: string, ref: string) => Promise<any>;
  serviceGadgetItem: (userId: string, ref: string) => Promise<any>;
  scrapBrokenGadgetItem: (userId: string, ref: string) => Promise<any>;
}) {
  const { command, args, token, chatId, message } = input;

  if (command === "/shop") {
    const snapshot = await input.resolveTelegramSnapshot(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, snapshot.user, message))) return true;
    await input.sendShopMenu(token, chatId, snapshot, snapshot.user.id, "all");
    return true;
  }

  if (command === "/shop_parts" || command === "/shop_courses") {
    const snapshot = await input.resolveTelegramSnapshot(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, snapshot.user, message))) return true;
    await input.sendShopMenu(token, chatId, snapshot, snapshot.user.id, "parts");
    return true;
  }

  if (command === "/shop_gadgets") {
    const snapshot = await input.resolveTelegramSnapshot(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, snapshot.user, message))) return true;
    await input.sendShopMenu(token, chatId, snapshot, snapshot.user.id, "gadgets");
    return true;
  }

  if (command === "/sell") {
    const snapshot = await input.resolveTelegramSnapshot(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, snapshot.user, message))) return true;
    const ref = args.join(" ").trim();
    if (!ref) {
      await input.sendShopMenu(token, chatId, snapshot, snapshot.user.id, "sell");
      return true;
    }

    const resolvedRef = input.resolveShopSellRefFromChat(chatId, ref);
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    try {
      const result = await input.sellInventoryItem(player.id, resolvedRef);
      const currency = input.getCurrencySymbol(result.user.city);
      const lines = [
        "✅ Продано:",
        `${result.item.name} +${currency}${formatCompactNumber(result.salePrice)}`,
        "",
        `💰 Баланс: ${currency}${formatCompactNumber(result.user.balance)}`,
      ];
      if (result.notices.length) lines.push("", input.formatNotices(result.notices));
      await input.sendWithCityHubKeyboard(token, chatId, lines.join("\n"));
    } catch (error) {
      await input.sendWithCityHubKeyboard(token, chatId, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/buy") {
    const ref = args.join(" ").trim();
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCityHubAccess(token, chatId, player, message))) return true;
    if (!ref) {
      await input.sendWithCityHubKeyboard(token, chatId, "Использование: /buy <номер товара>");
      return true;
    }
    try {
      const result = await input.buyShopItem(player.id, input.resolveShopBuyRefFromChat(chatId, ref));
      const tutorialAdvance = await input.tryApplyTutorialEvent(
        player.id,
        result.item.type === "consumable" ? "first_course_item_bought" : "first_gadget_bought",
      );
      const questProgress = input.updateWeeklyQuestProgress(result.user, "shop", 1);
      const currency = input.getCurrencySymbol(result.user.city);
      const lines = [
        `✅ Куплено: ${result.item.name}`,
        `-${currency}${formatCompactNumber(result.item.price)}`,
        `Бонусы: ${input.formatStats(result.item.stats)}`,
        `💰 Баланс: ${currency}${formatCompactNumber(result.user.balance)}`,
      ];
      const questNotice = input.formatWeeklyQuestProgressNotice(questProgress);
      if (questNotice) lines.push("", questNotice);
      const tutorialNotice = input.formatTutorialAdvanceNotice(tutorialAdvance, result.user.city);
      if (tutorialNotice) lines.push("", tutorialNotice);
      if (result.notices.length) lines.push("", input.formatNotices(result.notices));
      const purchaseMarkup = input.buildShopPurchaseInlineMarkup(result.item);
      if (purchaseMarkup) {
        await input.sendMessage(token, chatId, lines.join("\n"), { reply_markup: purchaseMarkup });
      } else {
        await input.sendWithCityHubKeyboard(token, chatId, lines.join("\n"));
      }
    } catch (error) {
      await input.sendWithCityHubKeyboard(token, chatId, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/inventory" || command === "/inv") {
    const snapshot = await input.resolveTelegramSnapshot(message.from);
    const inventoryView = input.buildInventoryMenu(snapshot);
    input.inventoryRefsByChatId.set(chatId, inventoryView.refs);
    const notices = input.formatNotices(snapshot.notices);
    const base = inventoryView.text;
    await input.sendMessage(token, chatId, notices ? `${base}\n\n${notices}` : base, {
      reply_markup: input.buildInventoryInlineButtons(inventoryView),
    });
    return true;
  }

  if (command === "/use") {
    const ref = input.resolveInventoryRefFromChat(chatId, args.join(" ").trim());
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!ref) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /use <номер предмета>");
      return true;
    }
    try {
      const result = await input.useInventoryItem(player.id, ref);
      const tutorialAdvance = await input.tryApplyTutorialEvent(player.id, "first_course_item_used");
      const lines = [
        `✅ Использовано: ${result.item.name}`,
        `Эффект: ${input.formatStats(result.item.stats)}`,
      ];
      const tutorialNotice = input.formatTutorialAdvanceNotice(tutorialAdvance, result.user.city);
      if (tutorialNotice) lines.push("", tutorialNotice);
      if (result.notices.length) lines.push("", input.formatNotices(result.notices));
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, lines.join("\n"));
    } catch (error) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/equip") {
    const ref = input.resolveInventoryRefFromChat(chatId, args.join(" ").trim());
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!ref) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /equip <номер предмета>");
      return true;
    }
    try {
      const result = await input.toggleGearItem(player.id, ref);
      const tutorialAdvance = result.isEquipped
        ? await input.tryApplyTutorialEvent(player.id, "first_gadget_equipped")
        : null;
      const lines = [
        `${result.isEquipped ? "🟢 Надето" : "⚪ Снято"}: ${result.item.name}`,
        `Бонусы: ${input.formatStats(result.item.stats)}`,
      ];
      const tutorialNotice = input.formatTutorialAdvanceNotice(tutorialAdvance, result.user.city);
      if (tutorialNotice) lines.push("", tutorialNotice);
      if (result.notices.length) lines.push("", input.formatNotices(result.notices));
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, lines.join("\n"));
    } catch (error) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/service") {
    const ref = input.resolveInventoryRefFromChat(chatId, args.join(" ").trim());
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!ref) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /service <номер предмета>");
      return true;
    }
    try {
      const result = await input.serviceGadgetItem(player.id, ref);
      const currency = input.getCurrencySymbol(result.user.city);
      const lines = [
        `🔧 Гаджет обслужен: ${result.item.name}`,
        `Стоимость: ${currency}${formatCompactNumber(result.serviceCost)}`,
        `💰 Баланс: ${currency}${formatCompactNumber(result.user.balance)}`,
      ];
      if (result.notices.length) lines.push("", input.formatNotices(result.notices));
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, lines.join("\n"));
    } catch (error) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/scrap") {
    const ref = input.resolveInventoryRefFromChat(chatId, args.join(" ").trim());
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!ref) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /scrap <номер предмета>");
      return true;
    }
    try {
      const result = await input.scrapBrokenGadgetItem(player.id, ref);
      const lines = [
        `♻️ Гаджет разобран: ${result.item.name}`,
        result.recoveredParts.length
          ? `Компоненты: ${result.recoveredParts.map((part: any) => part.name).join(", ")}`
          : "Полезных компонентов не удалось спасти.",
      ];
      if (result.notices.length) lines.push("", input.formatNotices(result.notices));
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, lines.join("\n"));
    } catch (error) {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${input.extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}

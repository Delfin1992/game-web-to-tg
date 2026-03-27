/**
 * Company operational process commands extracted from telegram.ts.
 * Covers mining, warehouse part deposit and company auction listing.
 */
export async function handleCompanyProcessMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  ensureCompanyHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  rememberTelegramMenu: (userId: string, state: any) => void;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  ensureCompanyProcessUnlocked: (token: string, chatId: number, userId: string, companyId: string, action: string) => Promise<boolean>;
  COMPANY_MINING_PLANS: readonly any[];
  getCompanyMiningPlan: (ref: string) => any;
  callInternalApi: (method: "POST" | "GET", path: string, body?: Record<string, unknown>) => Promise<any>;
  scheduleCompanyMiningReadyNotification: (token: string, chatId: number, membership: any, userId: string, remainingSeconds: number) => void;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  buildCompanyMiningInlineButtons: (status: any) => any;
  extractErrorMessage: (error: unknown) => string;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => any;
  getCompanyMiningStatus: (companyId: string, userId: string) => Promise<any>;
  formatMiningPlansMenu: (status: any) => string;
  ensureCompanyWarehouseCanStoreMiningReward: (company: any, rewardQty: number) => Promise<{ ok: boolean; free: number }>;
  claimCompanyMining: (companyId: string, userId: string) => Promise<{ ok: boolean; reward: any }>;
  addPartToCompanyWarehouse: (companyId: string, reward: any) => void;
  resolveWarehousePartRefFromChat: (chatId: number, ref: string) => string | null;
  resolveWarehouseGadgetRefFromChat: (chatId: number, ref: string) => string | null;
  resolveTelegramSnapshot: (from: any) => Promise<any>;
  formatCompanyPartDepositList: (game: any, chatId: number, withQuickCommands?: boolean) => string;
  pendingActionByChatId: Map<number, any>;
  getCompanyBlueprintSnapshot: (companyId: string) => Promise<any>;
  getCompanyWarehouseUsedSlots: (companyId: string, producedCount: number) => number;
  applyGameStatePatch: (userId: string, patch: Record<string, unknown>) => void;
  ALL_PARTS: Record<string, any>;
  getCompanyWarehouseParts: (companyId: string) => any[];
  setCompanyWarehouseParts: (companyId: string, parts: any[]) => void;
  normalizePartRarity: (value: string) => any;
  sendCompanyWarehouseSection: (token: string, chatId: number, membership: any, playerId: string) => Promise<void>;
  getUserWithGameState: (userId: string) => Promise<any>;
  companyPartDepositRefsByChatId: Map<number, string[]>;
  resolveCompanyPartDepositRefFromChat: (chatId: number, ref: string) => string;
  transferCompanyPartToWarehouse: (userId: string, membership: any, partRef: string, qtyRaw?: string) => Promise<any>;
}) {
  const {
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    ensureCompanyHubAccess,
    setCompanyMenuSection,
    rememberTelegramMenu,
    getPlayerCompanyContext,
    sendWithMainKeyboard,
    ensureCompanyProcessUnlocked,
    COMPANY_MINING_PLANS,
    getCompanyMiningPlan,
    callInternalApi,
    scheduleCompanyMiningReadyNotification,
    sendMessage,
    buildCompanyMiningInlineButtons,
    extractErrorMessage,
    buildCompanyReplyMarkup,
    getCompanyMiningStatus,
    formatMiningPlansMenu,
    ensureCompanyWarehouseCanStoreMiningReward,
    claimCompanyMining,
    addPartToCompanyWarehouse,
    resolveWarehousePartRefFromChat,
    resolveWarehouseGadgetRefFromChat,
    resolveTelegramSnapshot,
    formatCompanyPartDepositList,
    pendingActionByChatId,
    getCompanyBlueprintSnapshot,
    getCompanyWarehouseUsedSlots,
    applyGameStatePatch,
    ALL_PARTS,
    getCompanyWarehouseParts,
    setCompanyWarehouseParts,
    normalizePartRarity,
    sendCompanyWarehouseSection,
    getUserWithGameState,
    companyPartDepositRefsByChatId,
    resolveCompanyPartDepositRefFromChat,
    transferCompanyPartToWarehouse,
  } = input;

  if (command === "/company_mining_start") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "work");
    rememberTelegramMenu(player.id, { menu: "company", section: "work" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Добыча запчастей"))) {
      return true;
    }

    const rawRef = String(args[0] || "").trim();
    const byIndex = Math.max(0, Number(rawRef) - 1);
    const plan = COMPANY_MINING_PLANS[byIndex] ?? getCompanyMiningPlan(rawRef);
    try {
      const started = await callInternalApi("POST", `/api/companies/${membership.company.id}/mining/start`, {
        userId: player.id,
        planId: plan.id,
      }) as any;
      if (started.status === "in_progress") {
        scheduleCompanyMiningReadyNotification(token, chatId, membership, player.id, started.remainingSeconds);
      }
      await sendMessage(token, chatId, `⛏ Запущена смена: ${plan.label}\nВремя: ~${started.remainingSeconds} сек.\nОжидаемая добыча: ${plan.minRewardQty}-${plan.maxRewardQty} запчастей`, {
        reply_markup: buildCompanyMiningInlineButtons(started),
      });
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (command === "/company_mining_claim") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "work");
    rememberTelegramMenu(player.id, { menu: "company", section: "work" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Забор добычи"))) {
      return true;
    }

    try {
      const currentStatus = await getCompanyMiningStatus(membership.company.id, player.id);
      if (currentStatus.status !== "ready_to_claim" || !currentStatus.rewardPreview) {
        await sendMessage(token, chatId, formatMiningPlansMenu(currentStatus), {
          reply_markup: buildCompanyMiningInlineButtons(currentStatus),
        });
        return true;
      }
      const warehouseCheck = await ensureCompanyWarehouseCanStoreMiningReward(
        membership.company,
        currentStatus.rewardPreview.quantity,
      );
      if (!warehouseCheck.ok) {
        await sendMessage(token, chatId, `⚠️ На складе нет места. Свободно слотов: ${warehouseCheck.free}.`, {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return true;
      }
      const claimed = await claimCompanyMining(membership.company.id, player.id);
      addPartToCompanyWarehouse(membership.company.id, claimed.reward);
      await sendMessage(
        token,
        chatId,
        `✅ Добыча завершена: ${claimed.reward.partName} x${claimed.reward.quantity}\nРедкость: ${claimed.reward.rarity}\nДеталь перемещена на склад компании.`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (command === "/company_auction_list") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (!["owner", "manager"].includes(String(membership.role || "").toLowerCase())) {
      await sendMessage(token, chatId, "Только руководящий состав может выставлять лоты компании на аукцион.");
      return true;
    }
    const ref = String(args[0] || "").trim();
    const price = Number(args[1] || 0);
    const durationHours = Math.max(2, Math.min(12, Number(args[2] || 2)));
    if (!ref || !Number.isFinite(price) || price <= 0) {
      await sendMessage(token, chatId, "Использование: /company_auction_list <номер гаджета|pномер запчасти> <цена> [часы]");
      return true;
    }
    try {
      const partRef = resolveWarehousePartRefFromChat(chatId, ref);
      const gadgetId = partRef ? undefined : resolveWarehouseGadgetRefFromChat(chatId, ref);
      await callInternalApi("POST", `/api/companies/${membership.company.id}/market/list`, {
        userId: player.id,
        gadgetId,
        partRef,
        price,
        mode: "auction",
        durationHours,
      });
      await sendMessage(token, chatId, "✅ Лот выставлен на аукцион.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (command === "/company_part_deposit") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "warehouse");
    rememberTelegramMenu(player.id, { menu: "company", section: "warehouse" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }

    const argsText = args.join(" ").trim();
    const snapshot = await resolveTelegramSnapshot(message.from);
    const game = snapshot.game;
    if (!argsText) {
      pendingActionByChatId.set(chatId, { type: "company_part_deposit" });
      await sendMessage(token, chatId, formatCompanyPartDepositList(game, chatId, true), {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const [refRaw, qtyRaw] = argsText.split(/\s+/);
    const partRef = resolveCompanyPartDepositRefFromChat(chatId, refRaw);
    const inventory = [...(game.inventory ?? [])];
    const partItem = inventory.find((item: any) => item.type === "part" && item.id === partRef);
    if (!partItem) {
      await sendMessage(token, chatId, "❌ На склад компании можно добавлять только запчасти. Открой склад компании и выбери деталь из списка.");
      return true;
    }

    const availableQty = Math.max(1, Number(partItem.quantity) || 1);
    const requestedQty = qtyRaw && qtyRaw.toLowerCase() !== "all"
      ? Math.floor(Number(qtyRaw))
      : availableQty;
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      await sendMessage(token, chatId, "❌ Неверное количество. Пример: /company_part_deposit 1 3");
      return true;
    }
    const moveQty = Math.min(availableQty, requestedQty);

    const companySnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
    const capacity = Math.max(0, Number(membership.company.warehouseCapacity) || 50);
    const used = getCompanyWarehouseUsedSlots(membership.company.id, companySnapshot.produced.length);
    const free = Math.max(0, capacity - used);
    if (moveQty > free) {
      await sendMessage(token, chatId, `❌ Склад заполнен, добавить невозможно. Свободно слотов: ${free}.`);
      return true;
    }

    const nextInventory = inventory.flatMap((item: any) => {
      if (item.type !== "part" || item.id !== partItem.id) return [item];
      const left = availableQty - moveQty;
      if (left <= 0) return [];
      return [{ ...item, quantity: left }];
    });
    applyGameStatePatch(player.id, { inventory: nextInventory });

    const partDef = ALL_PARTS[partItem.id];
    const nextWarehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
    const existingIndex = nextWarehouseParts.findIndex((item: any) => item.id === partItem.id);
    if (existingIndex >= 0) {
      nextWarehouseParts[existingIndex] = {
        ...nextWarehouseParts[existingIndex],
        quantity: Math.max(0, Number(nextWarehouseParts[existingIndex].quantity) || 0) + moveQty,
      };
    } else {
      nextWarehouseParts.push({
        id: partItem.id,
        name: partItem.name,
        type: partDef?.type ?? "unknown",
        rarity: normalizePartRarity(String(partItem.rarity || partDef?.rarity || "Common")),
        quantity: moveQty,
      });
    }
    setCompanyWarehouseParts(membership.company.id, nextWarehouseParts);
    pendingActionByChatId.delete(chatId);

    await sendMessage(token, chatId, `✅ На склад компании перенесено: ${partItem.name} x${moveQty}.`, {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    await sendCompanyWarehouseSection(token, chatId, membership, player.id);
    return true;
  }

  if (command === "/cpd") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }

    const refRaw = String(args[0] || "").trim();
    if (!refRaw) {
      await sendMessage(token, chatId, "Использование: /cpd1 (или /cpd2, /cpd3...)");
      return true;
    }

    const snapshot = await getUserWithGameState(player.id);
    const game = snapshot?.game;
    const parts = [...(game?.inventory ?? [])].filter((item: any) => item.type === "part");
    companyPartDepositRefsByChatId.set(chatId, parts.map((item: any) => item.id));
    const partRef = resolveCompanyPartDepositRefFromChat(chatId, refRaw);
    const partItem = parts.find((item: any) => item.id === partRef);
    if (!partItem) {
      await sendMessage(token, chatId, "❌ Запчасть не найдена. Открой список: /company_part_deposit");
      return true;
    }

    const availableQty = Math.max(1, Number(partItem.quantity) || 1);
    if (availableQty <= 1) {
      const result = await transferCompanyPartToWarehouse(player.id, membership, partItem.id, "1");
      if (!result.ok) {
        await sendMessage(token, chatId, `❌ ${result.error}`);
        return true;
      }
      await sendMessage(token, chatId, `✅ На склад компании перенесено: ${result.partName} x${result.moveQty}.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      await sendCompanyWarehouseSection(token, chatId, membership, player.id);
      return true;
    }

    pendingActionByChatId.set(chatId, { type: "company_part_deposit_qty", partRef: partItem.id });
    await sendMessage(
      token,
      chatId,
      `🧮 Выбрано: ${partItem.name}\nВ наличии: ${availableQty}\n\nВведи количество для переноса (1-${availableQty}) или all.`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    return true;
  }

  return false;
}

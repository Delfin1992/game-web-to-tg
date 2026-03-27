/**
 * Company contracts, blueprint and exclusive development commands extracted from telegram.ts.
 */
export async function handleCompanyDevelopmentMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  ensureCompanyProcessUnlocked: (token: string, chatId: number, userId: string, companyId: string, action: string) => Promise<boolean>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  getCityContracts: (city: string) => Promise<any[]>;
  resolveContractRef: (chatId: number, ref: string, contracts: any[]) => any;
  startCompanyContractPartSelection: (token: string, chatId: number, membership: any, userId: string, contract: any) => Promise<void>;
  completeCompanyContractDelivery: (token: string, chatId: number, membership: any, contract: any, userId: string, input?: any) => Promise<void>;
  callInternalApi: (method: "POST" | "GET", path: string, body?: Record<string, unknown>) => Promise<any>;
  extractErrorMessage: (error: unknown) => string;
  sendCompanyWorkSection: (token: string, chatId: number, membership: any) => Promise<void>;
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, intent: any) => Promise<boolean>;
  sendOrEditCompanyBureauSection: (token: string, chatId: number, membership: any, playerId: string, messageId?: number, prefix?: string) => Promise<void>;
  startCompanyBlueprintDevelopment: (token: string, chatId: number, membership: any, player: any, ref: string) => Promise<void>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  formatCompanyExclusiveSection: (membership: any, playerId: string, chatId: number) => Promise<string>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => any;
  buildCompanyExclusiveStartInlineMarkup: (snapshot: any) => any;
  companyExclusiveSelectedPartRefsByChatId: Map<number, any>;
  companyExclusivePartPageByChatId: Map<number, number>;
  pendingActionByChatId: Map<number, any>;
  sendCompanyExclusivePartsPicker: (token: string, chatId: number, membership: any, playerId: string, gadgetName: string, messageId?: number, prefix?: string) => Promise<void>;
  getCompanyExclusiveSnapshot: (companyId: string) => Promise<any>;
  formatExclusiveProgressLiveText: (project: any) => string;
  storage: any;
  getTelegramIdByUserId: (userId: string) => string | undefined;
  formatExclusiveBlueprintSummary: (blueprint: any) => string;
  formatProductionOrderRemaining: (order?: any) => string;
  formatExclusiveProduceMenu: (snapshot: any) => string;
  buildCompanyExclusiveProduceInlineMarkup: (snapshot: any, role: string | null | undefined, chatId: number) => any;
  tryHandlePendingAction: (token: string, chatId: number, text: string, message: any) => Promise<boolean>;
  getCompanyBlueprintSnapshot: (companyId: string) => Promise<any>;
  ensureCompanyEconomyState: (company: any, membersCount: number) => Promise<any>;
  getDepartmentEffects: (departments: any) => any;
  getCompanyWarehouseParts: (companyId: string) => any[];
}) {
  const {
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    getPlayerCompanyContext,
    sendWithMainKeyboard,
    ensureCompanyProcessUnlocked,
    sendMessage,
    getCityContracts,
    resolveContractRef,
    startCompanyContractPartSelection,
    completeCompanyContractDelivery,
    callInternalApi,
    extractErrorMessage,
    sendCompanyWorkSection,
    ensureExclusiveActionAllowed,
    sendOrEditCompanyBureauSection,
    startCompanyBlueprintDevelopment,
    setCompanyMenuSection,
    formatCompanyExclusiveSection,
    buildCompanyReplyMarkup,
    buildCompanyExclusiveStartInlineMarkup,
    companyExclusiveSelectedPartRefsByChatId,
    companyExclusivePartPageByChatId,
    pendingActionByChatId,
    sendCompanyExclusivePartsPicker,
    getCompanyExclusiveSnapshot,
    formatExclusiveProgressLiveText,
    storage,
    getTelegramIdByUserId,
    formatExclusiveBlueprintSummary,
    formatProductionOrderRemaining,
    formatExclusiveProduceMenu,
    buildCompanyExclusiveProduceInlineMarkup,
    tryHandlePendingAction,
    getCompanyBlueprintSnapshot,
    ensureCompanyEconomyState,
    getDepartmentEffects,
    getCompanyWarehouseParts,
  } = input;

  if (command === "/company_contract_accept" || command === "/company_contract_deliver") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Контракты компании"))) {
      return true;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      await sendMessage(token, chatId, `Использование: ${command} <номер контракта>`);
      return true;
    }

    const contracts = await getCityContracts(membership.company.city);
    const selected = resolveContractRef(chatId, ref, contracts);
    if (!selected) {
      await sendMessage(token, chatId, "Контракт не найден. Открой раздел «Работа» кнопкой ниже.");
      return true;
    }

    const action = command === "/company_contract_accept" ? "accept" : "deliver";
    try {
      if (action === "deliver" && selected.kind === "parts_supply") {
        await startCompanyContractPartSelection(token, chatId, membership, player.id, selected);
        return true;
      } else {
        if (action === "deliver") {
          await completeCompanyContractDelivery(token, chatId, membership, selected, player.id);
        } else {
          await callInternalApi("POST", `/api/city-contracts/${selected.id}/${action}`, {
            userId: player.id,
            companyId: membership.company.id,
          });
          await sendMessage(token, chatId, "✅ Контракт принят.");
        }
      }
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }

    await sendCompanyWorkSection(token, chatId, membership);
    return true;
  }

  if (command === "/company_bp_start") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
      return true;
    }
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Разработка базового чертежа"))) {
      return true;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      await sendOrEditCompanyBureauSection(token, chatId, membership, player.id);
      return true;
    }
    await startCompanyBlueprintDevelopment(token, chatId, membership, player, ref);
    return true;
  }

  if (command === "/company_exclusive") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    await sendMessage(token, chatId, await formatCompanyExclusiveSection(membership, player.id, chatId), {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return true;
  }

  if (command === "/company_exclusive_start") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
      return true;
    }
    const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
    const candidates = Array.isArray(snapshot.upgradeCandidates) ? snapshot.upgradeCandidates : [];
    if (!candidates.length) {
      await sendMessage(token, chatId, "На складе компании нет обычных гаджетов для эксклюзивного апгрейда.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    const raw = args.join(" ").trim();
    if (raw) {
      const target = candidates[Math.max(0, Number(raw) - 1)];
      if (!target) {
        await sendMessage(token, chatId, "Гаджет не найден. Выбери номер из списка ниже.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return true;
      }
      companyExclusiveSelectedPartRefsByChatId.delete(chatId);
      companyExclusivePartPageByChatId.set(chatId, 0);
      pendingActionByChatId.set(chatId, { type: "company_exclusive_parts", gadgetName: target.name, gadgetId: target.id });
      await sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, target.name);
      return true;
    }
    await sendMessage(
      token,
      chatId,
      [
        "🌟 Эксклюзивный апгрейд",
        "Выбери обычный гаджет со склада компании, который хочешь улучшить.",
        "После выбора бот откроет подбор 5 деталей для апгрейда.",
      ].join("\n"),
      {
        reply_markup: buildCompanyExclusiveStartInlineMarkup(snapshot),
      },
    );
    return true;
    await sendMessage(
      token,
      chatId,
      [
        "🌟 Эксклюзивный апгрейд",
        "Выбери номер обычного гаджета со склада компании, который хочешь улучшить.",
        "",
        ...candidates.map((item: any, index: number) => `${index + 1}. ${item.name}`),
        "",
        "После выбора бот откроет подбор 5 деталей для апгрейда.",
      ].join("\n"),
      {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      },
    );
    return true;
    await sendMessage(token, chatId, "🌟 Выбери номер гаджета для EX-апгрейда из списка выше.", {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return true;
  }

  if (command === "/company_exclusive_progress") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    try {
      const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
      if (!snapshot.active) {
        await sendMessage(token, chatId, "Активной редкой разработки сейчас нет.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return true;
      }
      if (snapshot.active.status === "in_progress") {
        const progressed = await callInternalApi("POST", `/api/companies/${membership.company.id}/exclusive/progress`, {
          userId: player.id,
        }) as any;
        const prefix = progressed.status === "production_ready"
          ? "✅ Исследование завершено. Чертёж готов к выпуску."
          : progressed.status === "failed"
            ? `❌ Апгрейд провален: ${progressed.failedReason || "не удалось стабилизировать улучшение"}`
            : "📈 EX-апгрейд выполняется. Ниже текущий статус.";
        await sendMessage(token, chatId, `${prefix}\n\n${formatExclusiveProgressLiveText(progressed)}`, {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        if (progressed.status === "production_ready") {
          const users = await storage.getUsers();
          const announcement = [
            "🌟 НОВЫЙ ЭКСКЛЮЗИВНЫЙ ГАДЖЕТ",
            "━━━━━━━━━━━━━━",
            `Компания ${membership.company.name} завершила EX-апгрейд гаджета "${progressed.blueprint?.targetGadgetName ?? progressed.blueprint?.name ?? "гаджет"}".`,
            progressed.blueprint ? formatExclusiveBlueprintSummary(progressed.blueprint) : "",
          ].filter(Boolean).join("\n");
          for (const user of users) {
            const telegramId = Number(getTelegramIdByUserId(user.id) || 0);
            if (!telegramId) continue;
            try {
              await sendMessage(token, telegramId, announcement);
            } catch {
              // ignore per-user delivery issues
            }
          }
        }
        if (progressed.status !== "in_progress") {
          await sendMessage(token, chatId, await formatCompanyExclusiveSection(membership, player.id, chatId), {
            reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return true;
      }
      await sendMessage(token, chatId, formatExclusiveProgressLiveText(snapshot.active), {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/company_exclusive_produce") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }
    const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
    if (snapshot.productionOrder?.isExclusive) {
      if (snapshot.productionOrder.status === "ready_to_claim") {
        try {
          const claimed = await callInternalApi("POST", `/api/companies/${membership.company.id}/production/claim`, {
            userId: player.id,
          }) as any;
          await sendMessage(
            token,
            chatId,
            [
              `✅ Партия выдана: ${snapshot.productionOrder.blueprintName} x${claimed.produced?.length || snapshot.productionOrder.quantity}`,
              claimed.bonusApplied?.financeGrm ? `Финансы: +${claimed.bonusApplied.financeGrm} GRM` : "",
              claimed.bonusApplied?.xp ? `XP: +${claimed.bonusApplied.xp}` : "",
              claimed.bonusApplied?.skill ? `Навык ${claimed.bonusApplied.skill}: +${claimed.bonusApplied.amount}` : "",
              claimed.gadgetWear?.summary ? String(claimed.gadgetWear.summary) : "",
            ].filter(Boolean).join("\n"),
            { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
          );
        } catch (error) {
          await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
            reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return true;
      }

      await sendMessage(
        token,
        chatId,
        `🏭 Уже идет выпуск: ${snapshot.productionOrder.blueprintName} x${snapshot.productionOrder.quantity}\nОсталось: ${formatProductionOrderRemaining(snapshot.productionOrder)}`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
      return true;
    }
    const ref = String(args[0] || "").trim();
    if (!ref) {
      pendingActionByChatId.set(chatId, { type: "company_exclusive_produce_select" });
      await sendMessage(token, chatId, formatExclusiveProduceMenu(snapshot), {
        reply_markup: buildCompanyExclusiveProduceInlineMarkup(snapshot, membership.role, chatId),
      });
      return true;
    }
    const quantity = args[1] ? Math.max(1, Math.min(5, Number(args[1] || 1))) : null;
    const index = Math.max(0, Number(ref) - 1);
    const target = snapshot.catalog?.[index];
    if (!target) {
      await sendMessage(token, chatId, "Чертёж не найден. Открой «Выпуск» ещё раз.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    if (quantity === null) {
      pendingActionByChatId.set(chatId, {
        type: "company_exclusive_produce_qty",
        blueprintId: target.id,
        blueprintName: target.name,
      });
      await sendMessage(token, chatId, `🏭 ${target.name}\nВведи количество для выпуска (1-${Math.max(1, target.remainingUnits)}).`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    pendingActionByChatId.set(chatId, {
      type: "company_exclusive_produce_qty",
      blueprintId: target.id,
      blueprintName: target.name,
    });
    if (await tryHandlePendingAction(token, chatId, String(quantity), { ...message, text: String(quantity) })) return true;
    return true;
  }

  if (command === "/company_bp_progress") {
    await sendWithMainKeyboard(token, chatId, "⛔ Ускорение разработки (+24ч) отключено.");
    return true;
  }

  if (command === "/company_bp_produce") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau");
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
      return true;
    }
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Производство гаджетов"))) {
      return true;
    }

    try {
      const blueprintSnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
      const productionOrder = blueprintSnapshot.productionOrder;
      if (productionOrder) {
        if (productionOrder.status === "ready_to_claim") {
          const claimed = await callInternalApi("POST", `/api/companies/${membership.company.id}/production/claim`, {
            userId: player.id,
          }) as any;
          await sendMessage(
            token,
            chatId,
            [
              `✅ Партия выдана: ${productionOrder.blueprintName} x${claimed.produced?.length || productionOrder.quantity}`,
              productionOrder.isExclusive && claimed.bonusApplied?.financeGrm ? `Финансы: +${claimed.bonusApplied.financeGrm} GRM` : "",
              productionOrder.isExclusive && claimed.bonusApplied?.xp ? `XP: +${claimed.bonusApplied.xp}` : "",
              productionOrder.isExclusive && claimed.bonusApplied?.skill ? `Навык ${claimed.bonusApplied.skill}: +${claimed.bonusApplied.amount}` : "",
              claimed.gadgetWear?.summary ? String(claimed.gadgetWear.summary) : "",
            ].filter(Boolean).join("\n"),
          );
          await sendCompanyWorkSection(token, chatId, membership);
          return true;
        }

        await sendMessage(
          token,
          chatId,
          `🏭 Уже идет производство: ${productionOrder.blueprintName} x${productionOrder.quantity}\nОсталось: ${formatProductionOrderRemaining(productionOrder)}`,
          { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
        );
        return true;
      }
      const active = blueprintSnapshot.active;
      if (!active || active.status !== "production_ready") {
        await sendMessage(token, chatId, "❌ Чертеж еще не готов к производству. Дождитесь завершения разработки.");
        return true;
      }

      const blueprint = blueprintSnapshot.available.find((item: any) => item.id === active.blueprintId);
      if (!blueprint) {
        await sendMessage(token, chatId, "❌ Активный чертеж не найден.");
        return true;
      }

      const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
      const departmentEffects = getDepartmentEffects(companyEconomy.departments);
      const warehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
      const requiredParts = blueprint.production?.parts ?? {};
      const maxByParts = Object.entries(requiredParts).reduce((limit, [partType, qtyRaw]) => {
        const perUnit = Math.max(1, Number(qtyRaw || 0));
        const available = warehouseParts
          .filter((item: any) => item.type === partType)
          .reduce((sum: number, item: any) => sum + Math.max(1, Number(item.quantity || 1)), 0);
        return Math.min(limit, Math.floor(available / perUnit));
      }, 10);

      const maxQuantity = Math.max(1, Math.min(10, Number.isFinite(maxByParts) ? maxByParts : 1));
      pendingActionByChatId.set(chatId, {
        type: "company_bp_produce_qty",
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        maxQuantity,
      });
      await sendMessage(
        token,
        chatId,
        [
          `🏭 ${blueprint.name}`,
          `Доступно для партии: до ${maxQuantity} шт.`,
          `Себестоимость за 1 шт: ${Math.max(1, Math.round(Number(blueprint.production?.costGram || 0) * departmentEffects.productionCostMultiplier))} GRM`,
          "Введи количество для запуска производства.",
        ].join("\n"),
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
      return true;
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}

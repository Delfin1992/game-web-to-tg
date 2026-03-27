/**
 * Weekly Hackathon and sabotage command-entry handlers extracted from telegram.ts.
 * Keeps texts, checks and side effects unchanged.
 */
export async function handleHackathonMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  formatHackathonMenu: (player: any) => Promise<string>;
  formatGlobalEventsMenu: (player: any) => Promise<string>;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  storage: any;
  WEEKLY_HACKATHON_CONFIG: any;
  registerCompanyForWeeklyHackathon: (input: any) => any;
  extractErrorMessage: (error: unknown) => string;
  getUserWithGameState: (userId: string) => Promise<any>;
  startHackathonSkillProgress: (token: string, chatId: number, player: any, membership: any, game: any) => Promise<void>;
  formatHackathonGrmMenu: () => string;
  spendGram: (userId: string, amount: number, reason: string) => Promise<any>;
  contributeGRMToWeeklyHackathon: (input: any) => any;
  hackathonPartRefsByChatId: Map<number, string[]>;
  ALL_PARTS: Record<string, any>;
  mapPartTypeToHackathonType: (type: string) => any;
  contributePartToWeeklyHackathon: (input: any) => any;
  applyGameStatePatch: (userId: string, patch: Record<string, unknown>) => void;
  resolveHackathonPartRefFromChat: (chatId: number, ref: string) => string;
  formatSabotageMenu: (player: any) => Promise<any>;
  hackathonSabotageTargetRefsByChatId: Map<number, string[]>;
  setHackathonCompanySecurityLevel: (companyId: string, level: number) => number;
  getPendingPoachOffersForUser: (userId: string) => any[];
  resolveHackathonSabotageType: (raw: string) => any;
  resolveHackathonSabotageTargetRef: (chatId: number, ref: string) => string;
  getWeeklyHackathonState: () => any;
  launchWeeklyHackathonSabotage: (input: any) => any;
  resolveHackathonPoachOffer: (input: any) => any;
}) {
  const {
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    setCompanyMenuSection,
    sendWithCurrentHubKeyboard,
    formatHackathonMenu,
    formatGlobalEventsMenu,
    getPlayerCompanyContext,
    storage,
    WEEKLY_HACKATHON_CONFIG,
    registerCompanyForWeeklyHackathon,
    extractErrorMessage,
    getUserWithGameState,
    startHackathonSkillProgress,
    formatHackathonGrmMenu,
    spendGram,
    contributeGRMToWeeklyHackathon,
    hackathonPartRefsByChatId,
    ALL_PARTS,
    mapPartTypeToHackathonType,
    contributePartToWeeklyHackathon,
    applyGameStatePatch,
    resolveHackathonPartRefFromChat,
    formatSabotageMenu,
    hackathonSabotageTargetRefsByChatId,
    setHackathonCompanySecurityLevel,
    getPendingPoachOffersForUser,
    resolveHackathonSabotageType,
    resolveHackathonSabotageTargetRef,
    getWeeklyHackathonState,
    launchWeeklyHackathonSabotage,
    resolveHackathonPoachOffer,
  } = input;

  if (command === "/hackathon") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, await formatHackathonMenu(player));
    return true;
  }

  if (command === "/events") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    await sendWithCurrentHubKeyboard(token, chatId, player.id, await formatGlobalEventsMenu(player));
    return true;
  }

  if (command === "/hackathon_join") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (membership.role !== "owner") {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Регистрировать компанию в хакатоне может только CEO.");
      return true;
    }
    try {
      const company = await storage.getCompany(membership.company.id);
      if (!company) throw new Error("Компания не найдена");
      if (Number(company.balance || 0) < WEEKLY_HACKATHON_CONFIG.registrationCostGrm) {
        throw new Error(`Недостаточно GRM на балансе компании. Нужно ${WEEKLY_HACKATHON_CONFIG.registrationCostGrm}`);
      }
      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
      });
      const rndLevel = Math.max(0, Math.floor(Number(company.ork || 0) / 100));
      registerCompanyForWeeklyHackathon({
        companyId: company.id,
        companyName: company.name,
        city: company.city,
        companyLevel: company.level,
        rndLevel,
      });
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "✅ Компания зарегистрирована в Weekly Hackathon.");
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/hackathon_skill") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    try {
      const snapshot = await getUserWithGameState(player.id);
      if (!snapshot) throw new Error("Профиль игрока не найден");
      const game = snapshot.game;
      const workTime = Number(game.workTime || 0);
      if (workTime < WEEKLY_HACKATHON_CONFIG.skillEnergyCost) {
        throw new Error(`Недостаточно энергии. Нужно ${Math.round(WEEKLY_HACKATHON_CONFIG.skillEnergyCost * 100)}%.`);
      }
      await startHackathonSkillProgress(token, chatId, player, membership, game);
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/hackathon_grm_menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, formatHackathonGrmMenu());
    return true;
  }

  if (command === "/hackathon_grm") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    const amount = Math.floor(Number(args[0] || 0));
    if (!WEEKLY_HACKATHON_CONFIG.grmPackages.includes(amount)) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /hackathon_grm <100|500|1000>");
      return true;
    }
    try {
      await spendGram(player.id, amount, `Weekly Hackathon вклад ${amount} GRM`);
      const result = contributeGRMToWeeklyHackathon({
        userId: player.id,
        companyId: membership.company.id,
        amount,
      });
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        `✅ GRM-вклад: ${amount}\n+${result.contribution.toFixed(2)} очков\nСчёт компании: ${result.score.toFixed(2)}`,
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/hackathon_part") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const snapshot = await getUserWithGameState(player.id);
    if (!snapshot) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Профиль игрока не найден.");
      return true;
    }
    const parts = (snapshot.game.inventory || []).filter((item: any) => item.type === "part");
    if (!parts.length) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "В инвентаре нет деталей для хакатона.");
      return true;
    }
    hackathonPartRefsByChatId.set(chatId, parts.map((item: any) => item.id));
    const text = [
      "🏁 Вклад деталей в Weekly Hackathon",
      ...parts.slice(0, 10).map((item: any, idx: number) => `${idx + 1}. ${item.name} x${Math.max(1, item.quantity || 1)}  /hpart${idx + 1}`),
      "",
      "Нажми /hpartN или /hackathon_part_apply <номер>",
    ].join("\n");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, text);
    return true;
  }

  if (command === "/hackathon_part_apply") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    const rawRef = String(args[0] || "");
    if (!rawRef) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /hackathon_part_apply <номер>");
      return true;
    }
    const resolvedRef = resolveHackathonPartRefFromChat(chatId, rawRef);
    try {
      const snapshot = await getUserWithGameState(player.id);
      if (!snapshot) throw new Error("Профиль игрока не найден");
      const inventory = [...(snapshot.game.inventory || [])];
      const index = inventory.findIndex((item: any) => item.type === "part" && item.id === resolvedRef);
      if (index < 0) throw new Error("Деталь не найдена. Открой /hackathon_part");
      const partItem = inventory[index];
      const partDef = ALL_PARTS[partItem.id];
      if (!partDef) throw new Error("Справочник детали не найден");
      const mappedType = mapPartTypeToHackathonType(partDef.type);
      if (!mappedType) throw new Error("Эта деталь не участвует в хакатоне");
      const result = contributePartToWeeklyHackathon({
        userId: player.id,
        companyId: membership.company.id,
        partType: mappedType,
        rarity: partItem.rarity,
        quantity: 1,
      });

      const qty = Math.max(1, Math.floor(Number(partItem.quantity || 1)));
      if (qty <= 1) {
        inventory.splice(index, 1);
      } else {
        inventory[index] = { ...partItem, quantity: qty - 1 };
      }
      applyGameStatePatch(player.id, { inventory });
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        `✅ Деталь вложена: ${partItem.name}\n+${result.contribution.toFixed(2)} очков\nСчёт компании: ${result.score.toFixed(2)}`,
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/sabotage") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    const payload = await formatSabotageMenu(player);
    if (typeof payload === "string") {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, payload);
      return true;
    }
    hackathonSabotageTargetRefsByChatId.set(chatId, payload.refs);
    await sendWithCurrentHubKeyboard(token, chatId, player.id, payload.text);
    return true;
  }

  if (command === "/sabotage_security") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (membership.role !== "owner") {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Изменять security level может только CEO.");
      return true;
    }
    const level = Math.floor(Number(args[0] || 0));
    if (![1, 2, 3].includes(level)) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /sabotage_security <1|2|3>");
      return true;
    }
    try {
      const updated = setHackathonCompanySecurityLevel(membership.company.id, level);
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `✅ Security level обновлён: ${updated}`);
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/sabotage_security_menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    await sendWithCurrentHubKeyboard(
      token,
      chatId,
      player.id,
      "🛡 SECURITY ХАКАТОНА\n━━━━━━━━━━━━━━\nВыбери уровень защиты командой:\n/sabotage_security 1\n/sabotage_security 2\n/sabotage_security 3",
    );
    return true;
  }

  if (command === "/poach_menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    const offers = getPendingPoachOffersForUser(player.id);
    await sendWithCurrentHubKeyboard(
      token,
      chatId,
      player.id,
      offers.length
        ? [
          "📨 TALENT POACHING",
          "━━━━━━━━━━━━━━",
          ...offers.map((offer) => `${offer.id}: /poach_accept ${offer.id} | /poach_decline ${offer.id}`),
        ].join("\n")
        : "📨 Активных talent-poaching офферов нет.",
    );
    return true;
  }

  if (command === "/sabotage_attack") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    const sabotageType = resolveHackathonSabotageType(String(args[0] || ""));
    const targetRef = String(args[1] || "");
    const targetUserId = args[2] ? String(args[2]) : undefined;
    if (!sabotageType || !targetRef) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /sabotage_attack <type> <targetCompanyId|номер> [targetUserId]");
      return true;
    }
    const targetCompanyId = resolveHackathonSabotageTargetRef(chatId, targetRef);
    try {
      if (!["owner", "cto", "security_lead"].includes(String(membership.role || "").toLowerCase())) {
        throw new Error("Только CEO / CTO / Security Lead могут запускать саботаж");
      }
      const state = getWeeklyHackathonState();
      if (state.status !== "active") throw new Error("Саботаж доступен только при активном хакатоне");
      const attackerCompany = await storage.getCompany(membership.company.id);
      const targetCompany = await storage.getCompany(targetCompanyId);
      if (!attackerCompany || !targetCompany) throw new Error("Компания не найдена");
      const typeConfig = WEEKLY_HACKATHON_CONFIG.sabotage.types[sabotageType];
      const cost = Number(typeConfig.costGrm || 0);
      if (Number(attackerCompany.balance || 0) < cost) throw new Error(`Недостаточно GRM у компании. Нужно ${cost}`);
      await storage.updateCompany(attackerCompany.id, {
        balance: Number(attackerCompany.balance || 0) - cost,
      });

      const result = launchWeeklyHackathonSabotage({
        initiatorUserId: player.id,
        initiatorRole: membership.role,
        attackerCompanyId: attackerCompany.id,
        targetCompanyId: targetCompany.id,
        sabotageType,
        targetUserId,
      });
      await storage.createHackathonSabotageLog({
        id: result.logId,
        eventId: result.eventId,
        attackerCompanyId: result.attackerCompanyId,
        attackerCompanyName: result.attackerCompanyName,
        targetCompanyId: result.targetCompanyId,
        targetCompanyName: result.targetCompanyName,
        initiatorUserId: result.initiatorUserId,
        targetUserId: result.targetUserId,
        sabotageType: result.sabotageType,
        status: result.status,
        success: typeof result.success === "boolean" ? result.success : null,
        detected: result.detected,
        scoreDeltaAttacker: result.scoreDeltaAttacker,
        scoreDeltaTarget: result.scoreDeltaTarget,
        details: JSON.stringify(result.details || {}),
        createdAt: Math.floor(Date.now() / 1000),
        resolvedAt: result.status === "resolved" ? Math.floor(Date.now() / 1000) : null,
      });

      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        [
          "✅ Саботаж выполнен",
          `Тип: ${result.sabotageType}`,
          `Цель: ${result.targetCompanyName}`,
          `Статус: ${result.status}`,
          `Успех: ${result.success === null ? "ожидает ответа" : result.success ? "да" : "нет"}`,
          `Δ attacker: ${result.scoreDeltaAttacker}`,
          `Δ target: ${result.scoreDeltaTarget}`,
          `Раскрыт: ${result.detected ? "да" : "нет"}`,
        ].join("\n"),
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/poach_accept" || command === "/poach_decline") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const offerId = String(args[0] || "");
    if (!offerId) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `Использование: ${command} <offerId>`);
      return true;
    }
    try {
      const accepted = command === "/poach_accept";
      const result = resolveHackathonPoachOffer({
        offerId,
        userId: player.id,
        accept: accepted,
      });
      await storage.updateHackathonSabotageLog(offerId, {
        status: accepted ? "accepted" : "declined",
        success: accepted,
        scoreDeltaTarget: result.targetScoreDelta,
        resolvedAt: Math.floor(Date.now() / 1000),
      });
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        accepted
          ? `✅ Предложение принято. Компания-цель получила ${result.targetScoreDelta} score.`
          : "✅ Предложение отклонено.",
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}

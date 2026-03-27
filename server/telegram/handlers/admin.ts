/**
 * Admin command handlers extracted from telegram.ts.
 * Preserves the existing side effects while keeping the password flow readable.
 */
export async function handleAdminMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  ADMIN_PASSWORD?: string | null;
  isAdminEnabled: () => boolean;
  adminAuthByChatId: Map<number, boolean>;
  pendingActionByChatId: Map<number, any>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  sendWithAdminKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  storage: any;
  getUserWithGameState: (userId: string) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  formatPlayerProfile: (snapshot: any) => Promise<string>;
  applyExperienceGain: (user: any, gain: number) => { level: number; experience: number };
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  ensureCompanyEconomyState: (company: any, membersCount: number) => Promise<any>;
  clearPlayerGameState: (userId: string) => void;
  unbindTelegramByUserId: (userId: string) => void;
  unbindTelegramByTelegramId: (telegramId: string) => void;
  companyEconomyByCompanyId: Map<string, any>;
  companySalaryByCompanyId: Map<string, any>;
  companySalaryClaimAtByCompanyId: Map<string, any>;
  referralCodeByUserId: Map<string, string>;
  referralOwnerByCode: Map<string, string>;
  referredByUserId: Map<string, string>;
  referralChildrenByUserId: Map<string, Set<string>>;
  weeklyQuestStateByUserId: Map<string, any>;
  inventoryRefsByChatId: Map<number, string[]>;
  companyMemberRefsByChatId: Map<number, string[]>;
  stopCompanyBlueprintProgressTicker: (chatId: number) => void;
  companyBlueprintProgressMessageByChatId: Map<number, any>;
  registrationDraftByChatId: Map<number, any>;
  callInternalAdminApi: (method: "POST" | "GET" | "PATCH", path: string, body?: Record<string, unknown>) => Promise<any>;
  extractErrorMessage: (error: unknown) => string;
}) {
  const {
    command,
    args,
    token,
    chatId,
    message,
    ADMIN_PASSWORD,
    isAdminEnabled,
    adminAuthByChatId,
    pendingActionByChatId,
    sendWithMainKeyboard,
    sendWithAdminKeyboard,
    resolveOrCreateTelegramPlayer,
    storage,
    getUserWithGameState,
    getCurrencySymbol,
    formatPlayerProfile,
    applyExperienceGain,
    getPlayerCompanyContext,
    ensureCompanyEconomyState,
    clearPlayerGameState,
    unbindTelegramByUserId,
    unbindTelegramByTelegramId,
    companyEconomyByCompanyId,
    companySalaryByCompanyId,
    companySalaryClaimAtByCompanyId,
    referralCodeByUserId,
    referralOwnerByCode,
    referredByUserId,
    referralChildrenByUserId,
    weeklyQuestStateByUserId,
    inventoryRefsByChatId,
    companyMemberRefsByChatId,
    stopCompanyBlueprintProgressTicker,
    companyBlueprintProgressMessageByChatId,
    registrationDraftByChatId,
    callInternalAdminApi,
    extractErrorMessage,
  } = input;

  const isAuthorized = () => Boolean(adminAuthByChatId.get(chatId));
  const ensureAuthorized = async () => {
    if (isAuthorized()) return true;
    await sendWithMainKeyboard(token, chatId, "❌ Доступ запрещен. Авторизуйся через /admin.");
    return false;
  };

  if (command === "/admin") {
    if (!isAdminEnabled()) {
      await sendWithMainKeyboard(token, chatId, "❌ Админ-режим отключён: ADMIN_PASSWORD не настроен.");
      return true;
    }

    const password = args.join(" ").trim();
    if (!password) {
      pendingActionByChatId.set(chatId, { type: "admin_auth" });
      await sendWithMainKeyboard(token, chatId, "🔐 Введи пароль администратора.");
      return true;
    }

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      await sendWithMainKeyboard(token, chatId, "❌ Неверный пароль администратора.");
      return true;
    }

    adminAuthByChatId.set(chatId, true);
    pendingActionByChatId.delete(chatId);
    await sendWithAdminKeyboard(token, chatId, "🛠 Админ-режим включен.\nВыбирай действие кнопками ниже.");
    return true;
  }

  if (command === "/admin_add_money") {
    if (!(await ensureAuthorized())) return true;

    const amountRaw = args.join(" ").trim();
    if (!amountRaw) {
      pendingActionByChatId.set(chatId, { type: "admin_add_money" });
      await sendWithAdminKeyboard(token, chatId, "Введите сумму для начисления.");
      return true;
    }

    const player = await resolveOrCreateTelegramPlayer(message.from);
    const amount = Math.floor(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendWithAdminKeyboard(token, chatId, "Введите корректную сумму > 0.");
      return true;
    }

    const updated = await storage.updateUser(player.id, { balance: player.balance + amount });
    const refreshed = await getUserWithGameState(updated.id);
    await sendWithAdminKeyboard(
      token,
      chatId,
      refreshed
        ? `✅ Начислено ${getCurrencySymbol(updated.city)}${amount}\n\n${await formatPlayerProfile(refreshed)}`
        : `✅ Начислено ${getCurrencySymbol(updated.city)}${amount}`,
    );
    return true;
  }

  if (command === "/admin_add_exp") {
    if (!(await ensureAuthorized())) return true;

    const expRaw = args.join(" ").trim();
    if (!expRaw) {
      pendingActionByChatId.set(chatId, { type: "admin_add_exp" });
      await sendWithAdminKeyboard(token, chatId, "Введите количество опыта.");
      return true;
    }

    const player = await resolveOrCreateTelegramPlayer(message.from);
    const gain = Math.floor(Number(expRaw));
    if (!Number.isFinite(gain) || gain <= 0) {
      await sendWithAdminKeyboard(token, chatId, "Введите корректное значение опыта > 0.");
      return true;
    }

    const next = applyExperienceGain(player, gain);
    const updated = await storage.updateUser(player.id, {
      level: next.level,
      experience: next.experience,
    });
    const refreshed = await getUserWithGameState(updated.id);
    await sendWithAdminKeyboard(
      token,
      chatId,
      refreshed ? `✅ Начислено ${gain} XP\n\n${await formatPlayerProfile(refreshed)}` : `✅ Начислено ${gain} XP`,
    );
    return true;
  }

  if (command === "/admin_reset_player" || command === "/admin_restart") {
    if (!(await ensureAuthorized())) return true;

    const player = await resolveOrCreateTelegramPlayer(message.from);
    const tutorialCompany = await storage.getTutorialCompanyByOwner(player.id);
    if (tutorialCompany) {
      await storage.deleteCompany(tutorialCompany.id);
      companyEconomyByCompanyId.delete(String(tutorialCompany.id));
      companySalaryByCompanyId.delete(String(tutorialCompany.id));
      companySalaryClaimAtByCompanyId.delete(String(tutorialCompany.id));
    }

    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      if (membership.role === "owner") {
        await storage.deleteCompany(membership.company.id);
        companyEconomyByCompanyId.delete(String(membership.company.id));
        companySalaryByCompanyId.delete(String(membership.company.id));
        companySalaryClaimAtByCompanyId.delete(String(membership.company.id));
      } else {
        await storage.removeCompanyMember(membership.company.id, player.id);
        const updatedCompany = await storage.getCompany(membership.company.id);
        if (updatedCompany) {
          const members = await storage.getCompanyMembers(updatedCompany.id);
          await ensureCompanyEconomyState(updatedCompany, members.length);
        }
      }
    }

    const ownReferralCode = referralCodeByUserId.get(player.id);
    if (ownReferralCode) {
      referralOwnerByCode.delete(ownReferralCode);
    }
    referralCodeByUserId.delete(player.id);

    const inviterId = referredByUserId.get(player.id);
    if (inviterId) {
      const inviterChildren = referralChildrenByUserId.get(inviterId);
      if (inviterChildren) {
        inviterChildren.delete(player.id);
        if (!inviterChildren.size) {
          referralChildrenByUserId.delete(inviterId);
        }
      }
    }
    referredByUserId.delete(player.id);

    const children = referralChildrenByUserId.get(player.id);
    if (children) {
      for (const childId of Array.from(children)) {
        referredByUserId.delete(childId);
      }
    }
    referralChildrenByUserId.delete(player.id);
    weeklyQuestStateByUserId.delete(player.id);

    clearPlayerGameState(player.id);
    unbindTelegramByUserId(player.id);
    if (message.from?.id) {
      unbindTelegramByTelegramId(String(message.from.id));
    }
    inventoryRefsByChatId.delete(chatId);
    companyMemberRefsByChatId.delete(chatId);
    stopCompanyBlueprintProgressTicker(chatId);
    companyBlueprintProgressMessageByChatId.delete(chatId);
    registrationDraftByChatId.delete(chatId);
    pendingActionByChatId.delete(chatId);
    await storage.deleteUser(player.id);

    await sendWithAdminKeyboard(
      token,
      chatId,
      [
        "✅ Полный сброс выполнен.",
        "Аккаунт игрока удалён полностью.",
        "Отправь /start и пройди регистрацию заново.",
      ].join("\n"),
    );
    return true;
  }

  if (command === "/admin_hackathon_start" || command === "/admin_hackathon_end" || command === "/admin_hackathon_reset") {
    if (!(await ensureAuthorized())) return true;

    try {
      const action = command === "/admin_hackathon_start"
        ? "start"
        : command === "/admin_hackathon_end"
          ? "end"
          : "reset";
      const snapshot = await callInternalAdminApi("POST", `/api/admin/events/hackathon/${action}`);
      const topLine = action === "start"
        ? "✅ Weekly Hackathon запущен."
        : action === "end"
          ? "✅ Weekly Hackathon завершён."
          : "✅ Weekly Hackathon сброшен.";
      const lines = [
        topLine,
        `Статус: ${String(snapshot?.status ?? "unknown")}`,
      ];
      if (snapshot?.registeredCompanies) {
        lines.push(`Компаний зарегистрировано: ${Number(snapshot.registeredCompanies)}`);
      }
      if (snapshot?.startedAt) {
        lines.push(`Старт: ${new Date(Number(snapshot.startedAt)).toLocaleString("ru-RU")}`);
      }
      if (snapshot?.endsAt) {
        lines.push(`Финиш: ${new Date(Number(snapshot.endsAt)).toLocaleString("ru-RU")}`);
      }
      await sendWithAdminKeyboard(token, chatId, lines.join("\n"));
    } catch (error) {
      await sendWithAdminKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/admin_global_event") {
    if (!(await ensureAuthorized())) return true;

    try {
      const event = await callInternalAdminApi("POST", "/api/admin/events/global/start");
      const lines = [
        "✅ Глобальное событие создано.",
        `Название: ${String(event?.title ?? "Без названия")}`,
        `Интенсивность: ${String(event?.intensity ?? "—")}`,
        event?.description ? `Описание: ${String(event.description)}` : "",
        event?.city ? `Город: ${String(event.city)}` : "",
        event?.target ? `Цель: ${String(event.target)}` : "",
      ].filter(Boolean);
      await sendWithAdminKeyboard(token, chatId, lines.join("\n"));
    } catch (error) {
      await sendWithAdminKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/admin_logout") {
    adminAuthByChatId.delete(chatId);
    pendingActionByChatId.delete(chatId);
    await sendWithMainKeyboard(token, chatId, "Админ-режим выключен.");
    return true;
  }

  return false;
}

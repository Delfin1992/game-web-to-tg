/**
 * Company membership and registry mutation commands extracted from telegram.ts.
 * Keeps existing checks and side effects, while isolating membership flows.
 */
export async function handleCompanyMembershipMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  getCompanyCreateCostForPlayer: (city: string) => number;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => any;
  pendingActionByChatId: Map<number, any>;
  getCurrencySymbol: (city: string) => string;
  normalizeTelegramCompanyName: (name: string) => string;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  storage: any;
  companyListByChatId: Map<number, string[]>;
  getTopCompanies: (companies: any[]) => any[];
  buildCompanyRegistryInlineMarkup: (companies: any[]) => any;
  ensureCompanyEconomyState: (company: any, membersCount: number) => Promise<any>;
  stopCompanyBlueprintProgressTicker: (chatId: number) => void;
  companyBlueprintProgressMessageByChatId: Map<number, any>;
  ensureCompanyHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  rememberTelegramMenu: (userId: string, state: any) => void;
  companyRequestsByChatId: Map<number, string[]>;
  sendCompanyRequestsSection: (token: string, chatId: number, membership: any) => Promise<void>;
  companyEconomyByCompanyId: Map<string, any>;
  companySalaryByCompanyId: Map<string, any>;
  companySalaryClaimAtByCompanyId: Map<string, any>;
  getTelegramIdByUserId: (userId: string) => string | number | null | undefined;
}) {
  const {
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    getCompanyCreateCostForPlayer,
    getPlayerCompanyContext,
    sendMessage,
    buildCompanyReplyMarkup,
    pendingActionByChatId,
    getCurrencySymbol,
    normalizeTelegramCompanyName,
    sendWithMainKeyboard,
    storage,
    companyListByChatId,
    getTopCompanies,
    buildCompanyRegistryInlineMarkup,
    ensureCompanyEconomyState,
    stopCompanyBlueprintProgressTicker,
    companyBlueprintProgressMessageByChatId,
    ensureCompanyHubAccess,
    setCompanyMenuSection,
    rememberTelegramMenu,
    companyRequestsByChatId,
    sendCompanyRequestsSection,
    companyEconomyByCompanyId,
    companySalaryByCompanyId,
    companySalaryClaimAtByCompanyId,
    getTelegramIdByUserId,
  } = input;

  if (command === "/company_create") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const companyCreateCost = getCompanyCreateCostForPlayer(player.city);
    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      await sendMessage(token, chatId, "Ты уже состоишь в компании. Используй раздел «🏢 Компания».", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const companyName = args.join(" ").trim();
    if (!companyName) {
      pendingActionByChatId.set(chatId, { type: "company_create" });
      await sendMessage(
        token,
        chatId,
        [
          "Введи название новой компании (3-40 символов).",
          "После этого бот попросит один эмоджи компании.",
          `Стоимость: ${getCurrencySymbol(player.city)}${companyCreateCost}`,
        ].join("\n"),
        { reply_markup: buildCompanyReplyMarkup(null) },
      );
      return true;
    }

    const normalizedCompanyName = normalizeTelegramCompanyName(companyName);
    if (normalizedCompanyName.length < 3 || normalizedCompanyName.length > 40) {
      await sendWithMainKeyboard(token, chatId, "Название компании должно быть длиной от 3 до 40 символов.");
      return true;
    }

    if (player.balance < companyCreateCost) {
      await sendWithMainKeyboard(
        token,
        chatId,
        `Недостаточно средств для создания компании. Нужно ${getCurrencySymbol(player.city)}${companyCreateCost}.`,
      );
      return true;
    }

    pendingActionByChatId.set(chatId, { type: "company_create", companyName: normalizedCompanyName });
    await sendMessage(
      token,
      chatId,
      "Теперь отправь один эмоджи для компании. Пример: 🚀 или 🏢",
      { reply_markup: buildCompanyReplyMarkup(null) },
    );
    return true;
  }

  if (command === "/company_join") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      await sendMessage(token, chatId, "Ты уже состоишь в компании. Сначала выйди из текущей компании: /company_leave", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      const companies = (await storage.getAllCompanies()).filter((company: any) => !company.isTutorial);
      companyListByChatId.set(chatId, getTopCompanies(companies).map((company: any) => company.id));
      await sendMessage(token, chatId, "Выбери компанию для вступления:", {
        reply_markup: buildCompanyRegistryInlineMarkup(companies),
      });
      return true;
    }

    const companies = (await storage.getAllCompanies()).filter((company: any) => !company.isTutorial);
    let selectedCompany = null as any;

    if (/^\d+$/.test(ref)) {
      const list = companyListByChatId.get(chatId) ?? [];
      const index = Number(ref) - 1;
      const companyId = index >= 0 && index < list.length ? list[index] : "";
      selectedCompany = companies.find((company: any) => company.id === companyId) ?? null;
    } else {
      selectedCompany = companies.find((company: any) => company.id === ref)
        ?? companies.find((company: any) => company.id.startsWith(ref))
        ?? companies.find((company: any) => company.name.toLowerCase() === ref.toLowerCase())
        ?? null;
    }

    if (!selectedCompany) {
      await sendMessage(token, chatId, "Компания не найдена. Открой раздел «🏢 Компания» и выбери компанию из списка.", {
        reply_markup: buildCompanyReplyMarkup(null),
      });
      return true;
    }

    const pendingRequests = await storage.getJoinRequestsByUser(player.id);
    const existsPending = pendingRequests.some(
      (request: any) => request.companyId === selectedCompany.id && request.status === "pending",
    );
    if (existsPending) {
      await sendMessage(token, chatId, "Заявка уже отправлена и ожидает решения.", {
        reply_markup: buildCompanyReplyMarkup(null),
      });
      return true;
    }

    await storage.createJoinRequest({
      companyId: selectedCompany.id,
      userId: player.id,
      username: player.username,
    });

    await sendMessage(token, chatId, `✅ Заявка отправлена в компанию "${selectedCompany.name}".`, {
      reply_markup: buildCompanyReplyMarkup(null),
    });

    const ownerTelegramId = Number(getTelegramIdByUserId(String(selectedCompany.ownerId)) || 0);
    if (ownerTelegramId > 0 && ownerTelegramId !== chatId) {
      await sendMessage(
        token,
        ownerTelegramId,
        [
          "📥 Новая заявка в компанию",
          `Компания: ${selectedCompany.name}`,
          `Игрок: ${player.username}`,
          "Открой раздел «📥 Заявки», чтобы принять или отклонить её.",
        ].join("\n"),
      );
    }
    return true;
  }

  if (command === "/company_leave") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании.");
      return true;
    }

    if (membership.role === "owner") {
      await sendMessage(token, chatId, "CEO не может выйти из своей компании. Используй /company_delete.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    await storage.removeCompanyMember(membership.company.id, player.id);
    const updatedCompany = await storage.getCompany(membership.company.id);
    if (updatedCompany) {
      const members = await storage.getCompanyMembers(updatedCompany.id);
      await ensureCompanyEconomyState(updatedCompany, members.length);
    }
    stopCompanyBlueprintProgressTicker(chatId);
    companyBlueprintProgressMessageByChatId.delete(chatId);
    await sendMessage(token, chatId, `✅ Ты вышел из компании "${membership.company.name}".`, {
      reply_markup: buildCompanyReplyMarkup(null),
    });
    return true;
  }

  if (command === "/company_accept" || command === "/company_decline") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "management_hr");
    rememberTelegramMenu(player.id, { menu: "company", section: "management_hr" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      await sendMessage(token, chatId, `Использование: ${command} <номер>. Список: /company_requests`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const requests = await storage.getJoinRequestsByCompany(membership.company.id);
    let request = null as any;

    if (/^\d+$/.test(ref)) {
      const ids = companyRequestsByChatId.get(chatId) ?? [];
      const index = Number(ref) - 1;
      const requestId = index >= 0 && index < ids.length ? ids[index] : "";
      request = requests.find((item: any) => item.id === requestId) ?? null;
    } else {
      request = requests.find((item: any) => item.id === ref)
        ?? requests.find((item: any) => item.id.startsWith(ref))
        ?? null;
    }

    if (!request) {
      await sendMessage(token, chatId, "Заявка не найдена. Открой раздел заявок ещё раз.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const nextStatus = command === "/company_accept" ? "accepted" : "rejected";
    await storage.updateJoinRequestStatus(request.id, nextStatus);

    if (nextStatus === "accepted") {
      const existingMember = await storage.getMemberByUserId(membership.company.id, request.userId);
      if (!existingMember) {
        const currentMembers = await storage.getCompanyMembers(membership.company.id);
        const companyEconomy = await ensureCompanyEconomyState(membership.company, currentMembers.length);
        if (currentMembers.length >= companyEconomy.employeeLimit) {
          await sendMessage(
            token,
            chatId,
            `❌ Лимит сотрудников достигнут (${currentMembers.length}/${companyEconomy.employeeLimit}). Улучши профильный отдел и расширь компанию.`,
            { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
          );
          return true;
        }

        await storage.addCompanyMember({
          companyId: membership.company.id,
          userId: request.userId,
          username: request.username,
          role: "member",
        });

        const updatedMembers = await storage.getCompanyMembers(membership.company.id);
        await ensureCompanyEconomyState(membership.company, updatedMembers.length);
      }
      await sendMessage(token, chatId, `✅ Заявка ${request.username} одобрена.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      await sendCompanyRequestsSection(token, chatId, membership);
      return true;
    }

    await sendMessage(token, chatId, `✅ Заявка ${request.username} отклонена.`, {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    await sendCompanyRequestsSection(token, chatId, membership);
    return true;
  }

  if (command === "/company_delete") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }

    await storage.deleteCompany(membership.company.id);
    companyEconomyByCompanyId.delete(String(membership.company.id));
    companySalaryByCompanyId.delete(String(membership.company.id));
    companySalaryClaimAtByCompanyId.delete(String(membership.company.id));
    stopCompanyBlueprintProgressTicker(chatId);
    companyBlueprintProgressMessageByChatId.delete(chatId);
    await sendMessage(token, chatId, `🗑 Компания "${membership.company.name}" удалена.`, {
      reply_markup: buildCompanyReplyMarkup(null),
    });
    return true;
  }

  return false;
}

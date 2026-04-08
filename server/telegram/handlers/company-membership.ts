/**
 * Company membership and registry mutation commands extracted from telegram.ts.
 * Keeps existing checks and side effects, while isolating membership flows.
 */
import { createNotification } from "../../notifications/service";

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

  function resolveCompanySelection(companies: any[], refRaw: string) {
    const trimmed = String(refRaw || "").trim();
    if (!trimmed) return null;

    const list = companyListByChatId.get(chatId) ?? [];
    const indexedMatch = trimmed.match(/^(\d+)(?:\.\s*|\s+|$)/);
    if (indexedMatch) {
      const index = Number(indexedMatch[1]) - 1;
      const companyId = index >= 0 && index < list.length ? String(list[index]) : "";
      const byIndex = companies.find((company: any) => String(company.id) === companyId) ?? null;
      if (byIndex) return byIndex;
    }

    const normalizedNamedRef = trimmed.replace(/^\d+\.\s*/, "").trim();
    return companies.find((company: any) => String(company.id) === trimmed)
      ?? companies.find((company: any) => String(company.id).startsWith(trimmed))
      ?? companies.find((company: any) => String(company.name || "").toLowerCase() === trimmed.toLowerCase())
      ?? companies.find((company: any) => String(company.name || "").toLowerCase() === normalizedNamedRef.toLowerCase())
      ?? null;
  }

  if (command === "/company_create") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const companyCreateCost = getCompanyCreateCostForPlayer(player.city);
    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      await sendMessage(token, chatId, "Ты уже состоишь в компании. Открой раздел «🏢 Компания».", {
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
          "Введи название новой компании: от 3 до 40 символов.",
          "После этого бот попросит один эмодзи для компании.",
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
      "Теперь отправь один эмодзи для компании. Пример: 🚀 или 🏢",
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
      companyListByChatId.set(chatId, getTopCompanies(companies).map((company: any) => String(company.id)));
      pendingActionByChatId.set(chatId, { type: "company_join_select" });
      await sendMessage(token, chatId, "Выбери компанию для вступления кнопкой ниже или просто отправь её номер.", {
        reply_markup: buildCompanyRegistryInlineMarkup(companies),
      });
      return true;
    }

    const companies = (await storage.getAllCompanies()).filter((company: any) => !company.isTutorial);
    const selectedCompany = resolveCompanySelection(companies, ref);

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
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, "Заявка уже отправлена и ждёт решения.", {
        reply_markup: buildCompanyReplyMarkup(null),
      });
      return true;
    }

    await storage.createJoinRequest({
      companyId: selectedCompany.id,
      userId: player.id,
      username: player.username,
    });
    console.info("[company_join_request_created]", JSON.stringify({
      chatId,
      companyId: String(selectedCompany.id),
      companyName: String(selectedCompany.name || ""),
      ownerId: String(selectedCompany.ownerId || ""),
      userId: String(player.id || ""),
      username: String(player.username || ""),
    }));
    pendingActionByChatId.delete(chatId);

    await sendMessage(token, chatId, `✅ Заявка отправлена в компанию «${selectedCompany.name}».`, {
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
          "Открой раздел «📨 Заявки», чтобы принять или отклонить её.",
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
    await sendMessage(token, chatId, `✅ Ты вышел из компании «${membership.company.name}».`, {
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
    console.info("[company_join_requests_command]", JSON.stringify({
      chatId,
      companyId: String(membership.company.id || ""),
      companyName: String(membership.company.name || ""),
      ownerId: String(membership.company.ownerId || ""),
      requestsCount: requests.length,
      requestIds: requests.map((request: any) => String(request.id || "")),
    }));
    let request = null as any;

    if (/^\d+$/.test(ref)) {
      const ids = companyRequestsByChatId.get(chatId) ?? [];
      const index = Number(ref) - 1;
      const requestId = index >= 0 && index < ids.length ? String(ids[index]) : "";
      request = requests.find((item: any) => String(item.id) === requestId) ?? null;
    } else {
      request = requests.find((item: any) => String(item.id) === ref)
        ?? requests.find((item: any) => String(item.id).startsWith(ref))
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
            `❌ Лимит сотрудников достигнут (${currentMembers.length}/${companyEconomy.employeeLimit}). Сначала расширь компанию.`,
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
      createNotification(String(request.userId), {
        type: "COMPANY_JOIN_ACCEPTED",
        title: "🏢 Тебя приняли в компанию",
        message: `Компания «${membership.company.name}» одобрила твою заявку.`,
        dataJson: {
          companyId: membership.company.id,
          companyName: membership.company.name,
        },
      });
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

  if (command === "/company_request_accept_menu" || command === "/company_request_decline_menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "management_requests");
    rememberTelegramMenu(player.id, { menu: "company", section: "management_requests" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }
    const requests = await storage.getJoinRequestsByCompany(membership.company.id);
    companyRequestsByChatId.set(chatId, requests.map((request: any) => String(request.id)));
    if (!requests.length) {
      await sendMessage(token, chatId, "📥 Входящих заявок пока нет.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    pendingActionByChatId.set(chatId, {
      type: "company_request_pick",
      action: command === "/company_request_accept_menu" ? "accept" : "decline",
    });
    await sendMessage(
      token,
      chatId,
      [
        command === "/company_request_accept_menu" ? "✅ Какую заявку одобрить?" : "❌ Какую заявку отклонить?",
        "Отправь номер заявки из списка ниже.",
        "",
        ...requests.map((request: any, index: number) => `${index + 1}. ${request.username}`),
      ].join("\n"),
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
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
    await sendMessage(token, chatId, `🗑 Компания «${membership.company.name}» удалена.`, {
      reply_markup: buildCompanyReplyMarkup(null),
    });
    return true;
  }

  return false;
}

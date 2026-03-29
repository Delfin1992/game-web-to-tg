/**
 * Company management commands extracted from telegram.ts.
 * Covers staffing, salaries, topups, departments and IPO flows.
 */
export async function handleCompanyManagementMessage(input: {
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
  formatCompanyStaffingSection: (membership: any, chatId: number) => Promise<string>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  buildCompanyStaffingInlineMarkup: (chatId: number, role: string | null | undefined) => any;
  resolveCompanyDepartmentKey: (value: string) => any;
  callInternalApi: (method: "POST" | "GET", path: string, body?: Record<string, unknown>) => Promise<any>;
  extractErrorMessage: (error: unknown) => string;
  formatCompanySalariesSection: (membership: any, chatId: number) => Promise<string>;
  buildCompanySalariesInlineMarkup: (membership: any, chatId: number) => any;
  companyMemberRefsByChatId: Map<number, string[]>;
  storage: any;
  resolveCompanyMemberRef: (chatId: number, ref: string, members: Array<{ userId: string; username: string }>) => { userId: string; username: string } | null;
  getCompanySalaryMap: (companyId: string) => Map<string, number>;
  getCompanySalaryClaimMap: (companyId: string) => Map<string, number>;
  ensureCompanyEconomyState: (company: any, membersCount: number) => Promise<any>;
  saveCompanyEconomyState: (company: any, nextEconomy: any) => Promise<any>;
  getUserWithGameState: (userId: string) => Promise<any>;
  formatLiveProfile: (user: any, state: any) => Promise<string>;
  getCurrencySymbol: (city: string) => string;
  formatNumber: (value: number) => string;
  pendingActionByChatId: Map<number, any>;
  getLocalToGRMRate: (city: string) => number;
  formatRate: (value: number) => string;
  parseDecimalInput: (value: string) => number | null;
  applyCompanyTopUpFromPlayer: (player: any, company: any, companyEconomy: any, amountLocal: number) => Promise<any>;
  sendCompanyEconomySection: (token: string, chatId: number, membership: any) => Promise<void>;
  COMPANY_DEPARTMENT_ORDER: readonly any[];
  upgradeDepartment: (companyEconomy: any, departmentKey: any) => any;
  DEPARTMENT_LABELS: Record<string, string>;
  sendCompanyDepartmentsSection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  runIPO: (companyEconomy: any) => any;
  sendCompanyIpoSection: (token: string, chatId: number, membership: any) => Promise<void>;
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
    formatCompanyStaffingSection,
    sendMessage,
    buildCompanyStaffingInlineMarkup,
    resolveCompanyDepartmentKey,
    callInternalApi,
    extractErrorMessage,
    formatCompanySalariesSection,
    buildCompanySalariesInlineMarkup,
    companyMemberRefsByChatId,
    storage,
    resolveCompanyMemberRef,
    getCompanySalaryMap,
    getCompanySalaryClaimMap,
    ensureCompanyEconomyState,
    saveCompanyEconomyState,
    getUserWithGameState,
    formatLiveProfile,
    getCurrencySymbol,
    formatNumber,
    pendingActionByChatId,
    getLocalToGRMRate,
    formatRate,
    parseDecimalInput,
    applyCompanyTopUpFromPlayer,
    sendCompanyEconomySection,
    COMPANY_DEPARTMENT_ORDER,
    upgradeDepartment,
    DEPARTMENT_LABELS,
    sendCompanyDepartmentsSection,
    sendWithCurrentHubKeyboard,
    runIPO,
    sendCompanyIpoSection,
  } = input;

  if (command === "/company_staffing") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "management_hr");
    rememberTelegramMenu(player.id, { menu: "company", section: "management_hr" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return true;
    }
    await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
      reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
    });
    return true;
  }

  if (command === "/company_salaries") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "management");
    rememberTelegramMenu(player.id, { menu: "company", section: "management" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    await sendMessage(token, chatId, await formatCompanySalariesSection(membership, chatId), {
      reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
    });
    return true;
  }

  if (command === "/company_assign_department") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management_hr");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return true;
    }
    const memberRef = String(args[0] || "").trim();
    const departmentKey = resolveCompanyDepartmentKey(String(args[1] || ""));
    if (!memberRef || !departmentKey) {
      await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
        reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
      });
      return true;
    }
    const memberRefs = companyMemberRefsByChatId.get(chatId) ?? [];
    const memberIndex = Math.max(0, Number(memberRef) - 1);
    const targetUserId = memberRefs[memberIndex] ?? memberRef;
    try {
      await callInternalApi("POST", `/api/companies/${membership.company.id}/staffing/assign`, {
        actorUserId: player.id,
        targetUserId,
        department: departmentKey,
      });
      await sendMessage(token, chatId, "✅ Сотрудник назначен в отдел.");
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
      reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
    });
    return true;
  }

  if (command === "/company_set_salary") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }

    const argsText = args.join(" ").trim();
    if (!argsText) {
      await sendMessage(token, chatId, await formatCompanySalariesSection(membership, chatId), {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return true;
    }

    const [memberRef, amountRaw] = argsText.split(/\s+/);
    const amount = Math.floor(Number(amountRaw));
    if (!memberRef || !Number.isFinite(amount) || amount < 0) {
      await sendMessage(token, chatId, "Неверная сумма зарплаты. Выбери сотрудника кнопкой и введи число от 0 до 5000.", {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return true;
    }
    if (amount > 5000) {
      await sendMessage(token, chatId, "Слишком большая зарплата. Максимум: 5000 GRM.", {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return true;
    }

    const members = await storage.getCompanyMembers(membership.company.id);
    const target = resolveCompanyMemberRef(chatId, memberRef, members.map((member: any) => ({
      userId: member.userId,
      username: member.username,
    })));
    if (!target) {
      await sendMessage(token, chatId, "Сотрудник не найден. Открой раздел зарплат и выбери сотрудника кнопкой.", {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return true;
    }

    const targetMember = members.find((member: any) => member.userId === target.userId);
    if (!targetMember) {
      await sendMessage(token, chatId, "Сотрудник не найден.", {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return true;
    }

    const salaryMap = getCompanySalaryMap(membership.company.id);
    salaryMap.set(targetMember.userId, amount);
    await sendMessage(token, chatId, `✅ Зарплата для ${targetMember.username} установлена: ${amount} GRM`, {
      reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
    });
    await sendMessage(token, chatId, await formatCompanySalariesSection(membership, chatId), {
      reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
    });
    return true;
  }

  if (command === "/company_salary_claim" || command === "/salary") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }

    const latestCompany = await storage.getCompany(membership.company.id);
    if (!latestCompany) {
      await sendWithMainKeyboard(token, chatId, "Компания не найдена.");
      return true;
    }

    const ownMember = await storage.getMemberByUserId(latestCompany.id, player.id);
    if (!ownMember) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании.");
      return true;
    }

    const salaryMap = getCompanySalaryMap(latestCompany.id);
    const salary = Math.max(0, Math.floor(Number(salaryMap.get(player.id) || 0)));
    if (salary <= 0) {
      await sendWithMainKeyboard(token, chatId, "Зарплата для тебя пока не назначена.");
      return true;
    }

    const claimMap = getCompanySalaryClaimMap(latestCompany.id);
    const now = Date.now();
    const lastClaimAt = Math.max(0, Number(claimMap.get(player.id) || 0));
    const nextClaimAt = lastClaimAt + 24 * 60 * 60 * 1000;
    if (lastClaimAt > 0 && nextClaimAt > now) {
      const hoursLeft = Math.ceil((nextClaimAt - now) / (60 * 60 * 1000));
      await sendWithMainKeyboard(token, chatId, `Зарплату можно получить позже. Осталось ~${hoursLeft} ч.`);
      return true;
    }

    const companyEconomy = await ensureCompanyEconomyState(latestCompany, membership.membersCount);
    if (companyEconomy.capitalGRM < salary) {
      await sendWithMainKeyboard(token, chatId, "У компании недостаточно капитала GRM для выплаты зарплаты.");
      return true;
    }

    const updatedEconomy = await saveCompanyEconomyState(latestCompany, {
      ...companyEconomy,
      capitalGRM: companyEconomy.capitalGRM - salary,
      profitGRM: companyEconomy.profitGRM - salary,
    });
    const updatedUser = await storage.updateUser(player.id, {
      balance: player.balance + salary,
    });
    claimMap.set(player.id, now);

    const snapshot = await getUserWithGameState(updatedUser.id);
    const profile = snapshot
      ? await formatLiveProfile(snapshot.user, snapshot.game)
      : `Баланс: ${getCurrencySymbol(updatedUser.city)}${updatedUser.balance}`;

    await sendWithMainKeyboard(
      token,
      chatId,
      [
        `✅ Зарплата выплачена: +${getCurrencySymbol(updatedUser.city)}${salary}`,
        `💼 Капитал компании: ${formatNumber(updatedEconomy.capitalGRM)} GRM`,
        "",
        profile,
      ].join("\n"),
    );
    return true;
  }

  if (command === "/company_topup") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return true;
    setCompanyMenuSection(chatId, "management");
    rememberTelegramMenu(player.id, { menu: "company", section: "management" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }

    const amountRaw = args.join(" ").trim();
    if (!amountRaw) {
      pendingActionByChatId.set(chatId, { type: "company_topup", companyId: String(membership.company.id) });
      const rate = getLocalToGRMRate(player.city);
      await sendWithMainKeyboard(
        token,
        chatId,
        [
          "💱 Пополнение компании в GRM",
          `Твой курс: 1 локальная единица = ${formatRate(rate)} GRM`,
          `Баланс игрока: ${getCurrencySymbol(player.city)}${player.balance}`,
          "Введи сумму в локальной валюте (например: 1000).",
        ].join("\n"),
      );
      return true;
    }

    const amountLocal = parseDecimalInput(amountRaw);
    if (amountLocal === null) {
      await sendWithMainKeyboard(token, chatId, "Неверный формат. Введи сумму в локальной валюте, например: 1000.");
      return true;
    }

    const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
    const topUp = await applyCompanyTopUpFromPlayer(player, membership.company, companyEconomy, amountLocal);
    if (!topUp.ok) {
      await sendWithMainKeyboard(token, chatId, `❌ ${topUp.reason ?? "Пополнение недоступно"}`);
      return true;
    }

    await sendMessage(
      token,
      chatId,
      [
        `✅ Компания пополнена: -${getCurrencySymbol(player.city)}${formatNumber(topUp.spentLocal)}, +${formatNumber(topUp.receivedGRM)} GRM`,
        `Личный баланс: ${getCurrencySymbol(player.city)}${topUp.playerBalanceAfter}`,
      ].join("\n"),
    );
    const refreshed = await getPlayerCompanyContext(player.id);
    if (refreshed) {
      await sendCompanyEconomySection(token, chatId, refreshed);
    }
    return true;
  }

  if (command === "/company_department_upgrade") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }

    const rawValue = args.join(" ").trim();
    const departmentRaw = /^\d+$/.test(rawValue)
      ? COMPANY_DEPARTMENT_ORDER[Math.max(0, Number(rawValue) - 1)] ?? null
      : resolveCompanyDepartmentKey(rawValue);
    if (!departmentRaw) {
      await sendCompanyDepartmentsSection(token, chatId, membership);
      return true;
    }

    const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
    const result = upgradeDepartment(companyEconomy, departmentRaw);
    if (!result.ok) {
      await sendWithMainKeyboard(token, chatId, `❌ ${result.reason ?? "Улучшение недоступно"}`);
      await sendCompanyDepartmentsSection(token, chatId, membership);
      return true;
    }

    await saveCompanyEconomyState(membership.company, result.company);
    await sendMessage(
      token,
      chatId,
      `✅ Отдел ${DEPARTMENT_LABELS[departmentRaw]} улучшен до уровня ${result.company.departments[departmentRaw]} (-${formatNumber(result.spentGRM ?? 0)} GRM)`,
    );
    const refreshed = await getPlayerCompanyContext(player.id);
    if (refreshed) {
      await sendCompanyDepartmentsSection(token, chatId, refreshed);
    }
    return true;
  }

  if (command === "/company_ipo_stub") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, "🚀 IPO находится в разработке.");
    return true;
  }

  if (command === "/company_ipo_run") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }

    const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
    const ipoResult = runIPO(companyEconomy);
    if (!ipoResult.ok) {
      await sendWithMainKeyboard(token, chatId, `❌ ${ipoResult.reason ?? "IPO пока недоступно"}`);
      await sendCompanyIpoSection(token, chatId, membership);
      return true;
    }

    await saveCompanyEconomyState(membership.company, ipoResult.company);
    await sendMessage(token, chatId, "✅ IPO успешно проведено. Компания получила публичный статус.");
    const refreshed = await getPlayerCompanyContext(player.id);
    if (refreshed) {
      await sendCompanyIpoSection(token, chatId, refreshed);
    }
    return true;
  }

  return false;
}

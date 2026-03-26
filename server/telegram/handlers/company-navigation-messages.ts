/**
 * Company navigation and section-display commands extracted from the legacy message router.
 * Mutation-heavy company management commands stay in the main file for now.
 */

export async function handleCompanyNavigationMessage(input: {
  command: string;
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  playerTravelByUserId: Map<string, any>;
  getTravelRemainingSeconds: (userId: string) => number;
  formatTravelTargetLabel: (target: any) => string;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, mode: any) => Promise<boolean>;
  getPlayerHubLocation: (userId: string) => string;
  forceReturnHome: (token: string, chatId: number, player: any, message: any, text: string) => Promise<void>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  getHousingTravelDurationMs: (user: any, baseMs: number) => number;
  travelToCompanyMs: number;
  rememberTelegramMenu: (userId: string, state: any) => void;
  getPlayerCompanyContext: (userId: string) => Promise<any | null>;
  sendCompanyProfile: (token: string, chatId: number, membership: any) => Promise<void>;
  storage: any;
  getTopCompanies: (companies: any[]) => any[];
  companyListByChatId: Map<number, string[]>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  formatCompanyMenuWithoutMembership: (companies: any[], city: string) => string;
  buildCompanyRegistryInlineMarkup: (companies: any[]) => any;
  buildCompanyReplyMarkup: (role?: any, chatId?: number) => any;
  setPlayerHubLocation: (userId: string, location: any) => void;
  ensureCompanyHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  formatHackathonMenu: (player: any) => Promise<string>;
  formatSabotageMenu: (player: any) => Promise<any>;
  hackathonSabotageTargetRefsByChatId: Map<number, string[]>;
  getCompanyMenuParentSection: (section: any) => any;
  getCompanyMenuSection: (chatId: number) => any;
  sendCompanyRootMenu: (token: string, chatId: number, player: any) => Promise<void>;
  sendCompanyWorkSection: (token: string, chatId: number, membership: any) => Promise<void>;
  ensureCompanyProcessUnlocked: (token: string, chatId: number, userId: string, companyId: string, action: string) => Promise<boolean>;
  getCompanyMiningStatus: (companyId: string, userId: string) => Promise<any>;
  formatMiningPlansMenu: (status: any) => string;
  buildCompanyMiningInlineButtons: (status: any) => any;
  extractErrorMessage: (error: unknown) => string;
  sendCompanyWarehouseSection: (token: string, chatId: number, membership: any, playerId: string) => Promise<void>;
  sendCompanyBureauSection: (token: string, chatId: number, membership: any, playerId: string) => Promise<void>;
  sendCompanyManagementSection: (token: string, chatId: number, membership: any) => Promise<void>;
  formatCompanySalariesSection: (membership: any, chatId: number) => Promise<string>;
  sendCompanyEconomySection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendCompanyDepartmentsSection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendCompanyIpoSection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendCompanyRequestsSection: (token: string, chatId: number, membership: any) => Promise<void>;
}) {
  const { command, token, chatId, message } = input;

  if (command === "/company") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    const activeTravel = input.playerTravelByUserId.get(player.id);
    if (activeTravel) {
      const secondsLeft = input.getTravelRemainingSeconds(player.id);
      await input.sendWithMainKeyboard(token, chatId, `🚶 Вы уже в пути в ${input.formatTravelTargetLabel(activeTravel.target)}. Осталось ~${secondsLeft} сек.`);
      return true;
    }
    if (!(await input.ensureExclusiveActionAllowed(token, chatId, player.id, "travel"))) {
      return true;
    }

    const currentLocation = input.getPlayerHubLocation(player.id);
    if (currentLocation === "city") {
      await input.forceReturnHome(token, chatId, player, message, "⛔ Из города нельзя сразу перейти в компанию.");
      return true;
    }

    if (currentLocation === "home") {
      input.setCompanyMenuSection(chatId, "root");
      const travelMs = input.getHousingTravelDurationMs(player, input.travelToCompanyMs);
      const arrivesAtMs = Date.now() + travelMs;
      await input.sendWithMainKeyboard(token, chatId, `🚶 Вы вышли из дома в компанию. Прибытие через ${Math.ceil(travelMs / 1000)} сек.`);
      const timer = setTimeout(async () => {
        try {
          const state = input.playerTravelByUserId.get(player.id);
          if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "company") return;
          input.playerTravelByUserId.delete(player.id);
          input.setPlayerHubLocation(player.id, "company");

          const membership = await input.getPlayerCompanyContext(player.id);
          if (membership) {
            input.rememberTelegramMenu(player.id, { menu: "company", section: "root" });
            await input.sendCompanyProfile(token, state.chatId, membership);
            return;
          }

          const companies = (await input.storage.getAllCompanies()).filter((company: any) => !company.isTutorial);
          const top = input.getTopCompanies(companies);
          input.companyListByChatId.set(state.chatId, top.map((company: any) => company.id));
          await input.sendMessage(token, state.chatId, `✅ Вы прибыли в компанию.\n\n${input.formatCompanyMenuWithoutMembership(companies, player.city)}`, {
            reply_markup: input.buildCompanyRegistryInlineMarkup(companies),
          });
        } catch (error) {
          console.error("Travel to company completion error:", error);
        }
      }, travelMs);
      input.playerTravelByUserId.set(player.id, { target: "company", arrivesAtMs, timer, chatId });
      return true;
    }

    input.setPlayerHubLocation(player.id, "company");
    input.setCompanyMenuSection(chatId, "root");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "root" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (membership) {
      await input.sendCompanyProfile(token, chatId, membership);
      return true;
    }

    const companies = (await input.storage.getAllCompanies()).filter((company: any) => !company.isTutorial);
    const top = input.getTopCompanies(companies);
    input.companyListByChatId.set(chatId, top.map((company: any) => company.id));
    await input.sendMessage(token, chatId, input.formatCompanyMenuWithoutMembership(companies, player.city), {
      reply_markup: input.buildCompanyRegistryInlineMarkup(companies),
    });
    return true;
  }

  if (command === "/company_menu_work") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "work");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "work" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "💼 Работа компании");
    return true;
  }

  if (command === "/company_menu_warehouse") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "warehouse");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "warehouse" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "📦 Склад компании");
    return true;
  }

  if (command === "/company_menu_bureau") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "bureau");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "bureau" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "🧪 Бюро компании");
    return true;
  }

  if (command === "/company_menu_management") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "management");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "management" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "🛠 Управление компанией");
    return true;
  }

  if (command === "/company_menu_management_hr") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "management_hr");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "management_hr" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "👥 HR компании");
    return true;
  }

  if (command === "/company_menu_management_departments") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "management_departments");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "management_departments" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "🏛 Отделы и апгрейды");
    return true;
  }

  if (command === "/company_menu_hackathon") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "hackathon");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "hackathon" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "🏁 Раздел хакатона компании");
    return true;
  }

  if (command === "/company_menu_hackathon_event") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "hackathon_event");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "hackathon_event" });
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, await input.formatHackathonMenu(player));
    return true;
  }

  if (command === "/company_menu_hackathon_sabotage") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "hackathon_sabotage");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "hackathon_sabotage" });
    const payload = await input.formatSabotageMenu(player);
    if (typeof payload === "string") {
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, payload);
      return true;
    }
    input.hackathonSabotageTargetRefsByChatId.set(chatId, payload.refs);
    await input.sendWithCurrentHubKeyboard(token, chatId, player.id, payload.text);
    return true;
  }

  if (command === "/company_back") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    const nextSection = input.getCompanyMenuParentSection(input.getCompanyMenuSection(chatId));
    input.setCompanyMenuSection(chatId, nextSection);
    if (nextSection === "management") {
      input.rememberTelegramMenu(player.id, { menu: "company", section: "management" });
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "🛠 Управление компанией");
      return true;
    }
    if (nextSection === "bureau") {
      input.rememberTelegramMenu(player.id, { menu: "company", section: "bureau" });
      await input.sendWithCurrentHubKeyboard(token, chatId, player.id, "🧪 Бюро компании");
      return true;
    }
    input.rememberTelegramMenu(player.id, { menu: "company", section: "root" });
    await input.sendCompanyRootMenu(token, chatId, player);
    return true;
  }

  if (command === "/company_work") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "work");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "work" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendCompanyWorkSection(token, chatId, membership);
    return true;
  }

  if (command === "/company_mining") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "work");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "work" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    if (!(await input.ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Добыча запчастей"))) {
      return true;
    }

    try {
      const currentStatus = await input.getCompanyMiningStatus(membership.company.id, player.id);
      await input.sendMessage(token, chatId, input.formatMiningPlansMenu(currentStatus), {
        reply_markup: input.buildCompanyMiningInlineButtons(currentStatus),
      });
    } catch (error) {
      await input.sendMessage(token, chatId, `❌ ${input.extractErrorMessage(error)}`, {
        reply_markup: input.buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (command === "/company_warehouse") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "warehouse");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "warehouse" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendCompanyWarehouseSection(token, chatId, membership, player.id);
    return true;
  }

  if (command === "/company_bureau") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "bureau");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "bureau" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendCompanyBureauSection(token, chatId, membership, player.id);
    return true;
  }

  if (command === "/company_management") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "management");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "management" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendCompanyManagementSection(token, chatId, membership);
    return true;
  }

  if (command === "/company_salaries") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    input.setCompanyMenuSection(chatId, "management");
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendMessage(token, chatId, await input.formatCompanySalariesSection(membership, chatId), {
      reply_markup: input.buildCompanyReplyMarkup(membership.role, chatId),
    });
    return true;
  }

  if (command === "/company_economy") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.rememberTelegramMenu(player.id, { menu: "company", section: "root" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendCompanyEconomySection(token, chatId, membership);
    return true;
  }

  if (command === "/company_departments") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "management_departments");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "management_departments" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendCompanyDepartmentsSection(token, chatId, membership);
    return true;
  }

  if (command === "/company_ipo") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    input.setCompanyMenuSection(chatId, "management");
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership) {
      await input.sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    await input.sendCompanyIpoSection(token, chatId, membership);
    return true;
  }

  if (command === "/company_requests") {
    const player = await input.resolveOrCreateTelegramPlayer(message.from);
    if (!(await input.ensureCompanyHubAccess(token, chatId, player, message))) return true;
    input.setCompanyMenuSection(chatId, "management_hr");
    input.rememberTelegramMenu(player.id, { menu: "company", section: "management_hr" });
    const membership = await input.getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await input.sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }
    await input.sendCompanyRequestsSection(token, chatId, membership);
    return true;
  }

  return false;
}

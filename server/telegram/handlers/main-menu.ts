import {
  ADMIN_MENU_REPLY_MARKUP,
  BANK_MENU_REPLY_MARKUP,
  buildMainMenuReplyMarkup,
  CITY_MENU_REPLY_MARKUP,
  EXTRAS_MENU_REPLY_MARKUP,
  MAIN_MENU_REPLY_MARKUP,
} from "../keyboards/main";
import {
  getHiddenKeyboardMarkup,
  shouldShowHomeKeyboard,
  shouldShowHomeKeyboardForMenu,
  type PlayerHubLocation,
  type TelegramMenuLike,
  type TelegramMenuState,
} from "../ui-state";
import { sendMessage } from "../transport";

/**
 * Shared menu senders extracted from the legacy monolith.
 * They keep the exact keyboard behavior while reducing coupling in telegram.ts.
 */
export async function sendWithMainKeyboard(input: {
  token: string;
  chatId: number;
  text: string;
  getUserIdByTelegramId: (telegramId: string) => string | undefined;
  getTutorialSnapshotByUser: (userId: string) => Promise<{ state: { isCompleted: boolean } }>;
  getPlayerHubLocation?: (userId: string) => PlayerHubLocation;
  getLastTelegramMenuState?: (userId: string) => TelegramMenuLike;
}) {
  const {
    token,
    chatId,
    text,
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
    getPlayerHubLocation,
    getLastTelegramMenuState,
  } = input;
  let replyMarkup = MAIN_MENU_REPLY_MARKUP;
  try {
    const userId = getUserIdByTelegramId(String(chatId));
    if (userId) {
      const isActualHomeMenu = getLastTelegramMenuState
        ? shouldShowHomeKeyboardForMenu(getLastTelegramMenuState(userId))
        : true;
      if (!isActualHomeMenu) {
        await sendMessage(token, chatId, text, { reply_markup: getHiddenKeyboardMarkup() });
        return;
      }
      if (getPlayerHubLocation && !shouldShowHomeKeyboard(getPlayerHubLocation(userId))) {
        await sendMessage(token, chatId, text, { reply_markup: getHiddenKeyboardMarkup() });
        return;
      }
      const tutorialSnapshot = await getTutorialSnapshotByUser(userId);
      replyMarkup = buildMainMenuReplyMarkup(!tutorialSnapshot.state.isCompleted);
    }
  } catch {
    replyMarkup = MAIN_MENU_REPLY_MARKUP;
  }
  await sendMessage(token, chatId, text, { reply_markup: replyMarkup });
}

export async function sendWithExtrasKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: EXTRAS_MENU_REPLY_MARKUP });
}

export async function sendWithCityHubKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: CITY_MENU_REPLY_MARKUP });
}

export async function sendWithAdminKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: ADMIN_MENU_REPLY_MARKUP });
}

export async function sendWithBankKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: BANK_MENU_REPLY_MARKUP });
}

export async function sendWithoutReplyKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: getHiddenKeyboardMarkup() });
}

export async function sendWithCurrentHubKeyboard(input: {
  token: string;
  chatId: number;
  userId: string;
  text: string;
  getPlayerHubLocation: (userId: string) => PlayerHubLocation;
  getPlayerCompanyContext: (userId: string) => Promise<{ role?: string | null } | null>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendWithMainKeyboard: (input: {
    token: string;
    chatId: number;
    text: string;
    getUserIdByTelegramId: (telegramId: string) => string | undefined;
    getTutorialSnapshotByUser: (userId: string) => Promise<{ state: { isCompleted: boolean } }>;
    getLastTelegramMenuState?: (userId: string) => TelegramMenuLike;
  }) => Promise<void>;
  getUserIdByTelegramId: (telegramId: string) => string | undefined;
  getTutorialSnapshotByUser: (userId: string) => Promise<{ state: { isCompleted: boolean } }>;
  getLastTelegramMenuState?: (userId: string) => TelegramMenuLike;
}) {
  const {
    token,
    chatId,
    userId,
    text,
    getPlayerHubLocation,
    getPlayerCompanyContext,
    buildCompanyReplyMarkup,
    sendWithMainKeyboard: sendMain,
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
    getLastTelegramMenuState,
  } = input;

  const location = getPlayerHubLocation(userId);
  if (location === "city") {
    await sendWithCityHubKeyboard(token, chatId, text);
    return;
  }
  if (location === "company") {
    const membership = await getPlayerCompanyContext(userId);
    await sendMessage(token, chatId, text, {
      reply_markup: buildCompanyReplyMarkup(membership?.role ?? null, chatId),
    });
    return;
  }
  await sendMain({
    token,
    chatId,
    text,
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
    getLastTelegramMenuState,
  });
}

export async function sendHomeMenu(input: {
  token: string;
  chatId: number;
  snapshot: any;
  userId: string;
  prefix?: string;
  rememberTelegramMenu: (userId: string, state: TelegramMenuState) => void;
  shouldSuppressNonRegistrationMessages: (userId: string) => Promise<boolean>;
  formatNotices: (notices: string[]) => string;
  buildBotModeMessage: (snapshot: any) => Promise<string>;
  sendWithHomeKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
}) {
  const {
    token,
    chatId,
    snapshot,
    userId,
    prefix,
    rememberTelegramMenu,
    shouldSuppressNonRegistrationMessages,
    formatNotices,
    buildBotModeMessage,
    sendWithHomeKeyboard: sendHome,
  } = input;

  rememberTelegramMenu(userId, { menu: "home" });
  const notices = await shouldSuppressNonRegistrationMessages(userId) ? "" : formatNotices(snapshot.notices);
  const base = await buildBotModeMessage(snapshot);
  const text = [prefix, notices ? `${base}\n\n${notices}` : base].filter(Boolean).join("\n\n");
  await sendHome(token, chatId, text);
}

export async function sendCityHubSummary(input: {
  token: string;
  chatId: number;
  userId: string;
  prefix?: string;
  rememberTelegramMenu: (userId: string, state: TelegramMenuState) => void;
  getCityHubSummaryText: () => string;
  sendWithCityHubKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
}) {
  const {
    token,
    chatId,
    userId,
    prefix,
    rememberTelegramMenu,
    getCityHubSummaryText,
    sendWithCityHubKeyboard,
  } = input;
  rememberTelegramMenu(userId, { menu: "city" });
  const text = prefix ? `${prefix}\n\n${getCityHubSummaryText()}` : getCityHubSummaryText();
  await sendWithCityHubKeyboard(token, chatId, text);
}

export async function restoreTelegramMenuState(input: {
  token: string;
  chatId: number;
  player: any;
  message: any;
  prefix?: string;
  getLastTelegramMenuState: (userId: string) => TelegramMenuState | undefined;
  resolveTelegramSnapshot: (from: any) => Promise<any>;
  sendHomeMenu: (token: string, chatId: number, snapshot: any, userId: string, prefix?: string) => Promise<void>;
  rememberTelegramMenu: (userId: string, state: TelegramMenuState) => void;
  sendWithExtrasKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  setPlayerHubLocation: (userId: string, location: PlayerHubLocation) => void;
  sendCityHubSummary: (token: string, chatId: number, userId: string, prefix?: string) => Promise<void>;
  sendRepairServiceMenu: (token: string, chatId: number, userId: string, prefix?: string) => Promise<void>;
  storage: {
    getUser: (userId: string) => Promise<any>;
  };
  getActiveHousing: (user: any) => any;
  getStarterHousingForCity: (city: string) => any;
  formatHousingMenuText: (user: any) => string;
  sendHousingCard: (token: string, chatId: number, user: any, house: any, prefix?: string) => Promise<void>;
  pendingActionByChatId: Map<number, any>;
  formatJobsMenu: (snapshot: any) => string;
  listJobsByCity: (city: string, professionId?: any, level?: number) => any[];
  getPlayerProfessionId: (user: any) => string | null;
  buildJobsInlineMarkup: (snapshot: any) => any;
  sendMessage: (token: string, chatId: number, text: string, options?: Record<string, unknown>) => Promise<any>;
  formatEducationLevelsMenu: (player: any) => string;
  buildEducationLevelsReplyMarkup: (level: number) => any;
  formatEducationCoursesMenu: (player: any, levelKey: any) => string;
  buildEducationCoursesReplyMarkup: (levelKey: any) => any;
  sendShopMenu: (token: string, chatId: number, snapshot: any, userId: string, tab?: any) => Promise<void>;
  formatBankMenu: (snapshot: any) => string;
  sendWithBankKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  sendCompanyRootMenu: (token: string, chatId: number, player: any, prefix?: string) => Promise<void>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendCompanyWorkSection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendCompanyWarehouseSection: (token: string, chatId: number, membership: any, playerId?: string) => Promise<void>;
  sendCompanyRepairServiceMenu: (token: string, chatId: number, membership: any, playerId: string, prefix?: string) => Promise<void>;
  sendCompanyBureauSection: (token: string, chatId: number, membership: any, userId: string) => Promise<void>;
  sendCompanyManagementSection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendCompanyDepartmentsSection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
}) {
  const {
    token,
    chatId,
    player,
    message,
    prefix,
    getLastTelegramMenuState,
    resolveTelegramSnapshot,
    sendHomeMenu: sendHome,
    rememberTelegramMenu,
    sendWithExtrasKeyboard,
    setPlayerHubLocation,
    sendCityHubSummary,
    sendRepairServiceMenu,
    storage,
    getActiveHousing,
    getStarterHousingForCity,
    formatHousingMenuText,
    sendHousingCard,
    pendingActionByChatId,
    formatJobsMenu,
    listJobsByCity,
    getPlayerProfessionId,
    buildJobsInlineMarkup,
    sendMessage,
    formatEducationLevelsMenu,
    buildEducationLevelsReplyMarkup,
    formatEducationCoursesMenu,
    buildEducationCoursesReplyMarkup,
    sendShopMenu,
    formatBankMenu,
    sendWithBankKeyboard,
    setCompanyMenuSection,
    getPlayerCompanyContext,
    sendCompanyRootMenu,
    buildCompanyReplyMarkup,
    sendCompanyWorkSection,
    sendCompanyWarehouseSection,
    sendCompanyRepairServiceMenu,
    sendCompanyBureauSection,
    sendCompanyManagementSection,
    sendCompanyDepartmentsSection,
    sendWithCurrentHubKeyboard,
  } = input;

  const state = getLastTelegramMenuState(player.id);
  if (!state) {
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHome(token, chatId, snapshot, player.id, prefix);
    return;
  }

  const typedState = state as any;

  if (state.menu === "extras") {
    rememberTelegramMenu(player.id, state);
    await sendWithExtrasKeyboard(
      token,
      chatId,
      [prefix, ["🧩 Допы", "• Рейтинг", "• Квесты", "• Репутация", "• Рефералы"].join("\n")].filter(Boolean).join("\n\n"),
    );
    return;
  }

  if (state.menu === "home") {
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHome(token, chatId, snapshot, player.id, prefix);
    return;
  }

  if (state.menu === "city") {
    setPlayerHubLocation(player.id, "city");
    await sendCityHubSummary(token, chatId, player.id, prefix);
    return;
  }

  if (state.menu === "repair_service") {
    setPlayerHubLocation(player.id, "city");
    await sendRepairServiceMenu(token, chatId, player.id, prefix);
    return;
  }

  if (state.menu === "housing") {
    setPlayerHubLocation(player.id, "city");
    const refreshedUser = await storage.getUser(player.id);
    if (!refreshedUser) {
      const snapshot = await resolveTelegramSnapshot(message.from);
      await sendHome(token, chatId, snapshot, player.id, prefix);
      return;
    }
    const house = getActiveHousing(refreshedUser) ?? getStarterHousingForCity(refreshedUser.city);
    if (!house) {
      await sendCityHubSummary(token, chatId, player.id, prefix ?? "Недвижимость в этом городе пока закрыта.");
      return;
    }
    rememberTelegramMenu(player.id, state);
    await sendHousingCard(token, chatId, refreshedUser, house, prefix ?? formatHousingMenuText(refreshedUser));
    return;
  }

  if (state.menu === "jobs") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    const snapshot = await resolveTelegramSnapshot(message.from);
    const jobsCount = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level).length;
    if (jobsCount <= 0) {
      await sendCityHubSummary(token, chatId, player.id, prefix ?? "В вашем городе сейчас нет вакансий.");
      return;
    }
    pendingActionByChatId.set(chatId, { type: "job_select" });
    await sendMessage(token, chatId, [prefix, formatJobsMenu(snapshot)].filter(Boolean).join("\n\n"), {
      reply_markup: buildJobsInlineMarkup(snapshot),
    });
    return;
  }

  if (state.menu === "study_levels") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    pendingActionByChatId.set(chatId, { type: "study_level_select" });
    await sendMessage(token, chatId, [prefix, formatEducationLevelsMenu(player)].filter(Boolean).join("\n\n"), {
      reply_markup: buildEducationLevelsReplyMarkup(player.level),
    });
    return;
  }

  if (state.menu === "study_courses") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    pendingActionByChatId.set(chatId, { type: "study_course_select", levelKey: typedState.levelKey });
    await sendMessage(token, chatId, [prefix, formatEducationCoursesMenu(player, typedState.levelKey)].filter(Boolean).join("\n\n"), {
      reply_markup: buildEducationCoursesReplyMarkup(typedState.levelKey),
    });
    return;
  }

  if (state.menu === "shop") {
    setPlayerHubLocation(player.id, "city");
    const snapshot = await resolveTelegramSnapshot(message.from);
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: getHiddenKeyboardMarkup() });
    }
    await sendShopMenu(token, chatId, snapshot, player.id, typedState.tab);
    return;
  }

  if (state.menu === "bank") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendWithBankKeyboard(token, chatId, [prefix, formatBankMenu(snapshot)].filter(Boolean).join("\n\n"));
    return;
  }

  setPlayerHubLocation(player.id, "company");
  setCompanyMenuSection(chatId, typedState.section);
  rememberTelegramMenu(player.id, state);
  const membership = await getPlayerCompanyContext(player.id);
  if (!membership) {
    await sendCompanyRootMenu(token, chatId, player, prefix);
    return;
  }
  if (typedState.section === "work") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyWorkSection(token, chatId, membership);
    return;
  }
  if (typedState.section === "warehouse") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyWarehouseSection(token, chatId, membership, player.id);
    return;
  }
  if (typedState.section === "service") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyRepairServiceMenu(token, chatId, membership, player.id);
    return;
  }
  if (typedState.section === "bureau" || typedState.section === "bureau_exclusive") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyBureauSection(token, chatId, membership, player.id);
    return;
  }
  if (typedState.section === "management") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyManagementSection(token, chatId, membership);
    return;
  }
  if (typedState.section === "management_hr") {
    await sendWithCurrentHubKeyboard(token, chatId, player.id, [prefix, "👥 HR компании"].filter(Boolean).join("\n\n"));
    return;
  }
  if (typedState.section === "management_departments") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyDepartmentsSection(token, chatId, membership);
    return;
  }
  await sendCompanyRootMenu(token, chatId, player, prefix);
}
